// anim-timeline.js
// ANIMASTAGE PRO — Stage-1 animation timeline editor.
//
// A dockable bottom panel with a professional canvas timeline: one row per
// keyed bone (grouped by rig region) plus a master "All keys" row, playhead
// scrubbing, drag-to-move keys, per-bone or whole-key deletion, auto-key,
// zoom/pan, and a full undo/redo command stack.
//
// SAFETY CONTRACT (Pose Engine V2 is fragile — respect it):
//   * This module NEVER touches bones, skeletons, POSE2 or solvers directly.
//   * Every read/write goes through the narrow bridge exported by
//     mmd-character-motion.js (getTimelineBridge). Pose application uses the
//     SAME seekBoneTime/applyBoneAnimTime paths as the classic strip, which
//     already reset POSE2.cluster so the next manual drag re-syncs safely.
//   * The keyframe store (BONE.keys) stays the single source of truth; the
//     timeline is a VIEW over it with an undo stack of JSON snapshots.

/* ---------------------------------------------------------------------------
 * Local JP -> EN bone-name translation. Fully offline: a token dictionary of
 * the standard MMD bone vocabulary (semantic + PMX helpers). Longest tokens
 * are applied first, so 上半身2 wins over 上半身, 足ＩＫ over 足, etc.
 * ------------------------------------------------------------------------ */
const JP_TOKENS = [
  ["全ての親", "Mother"], ["操作中心", "View center"],
  ["センター", "Center"],
  ["グルーブ", "Groove"], ["グループ", "Groove"],
  ["上半身2", "Upper body 2"], ["上半身", "Upper body"], ["下半身", "Lower body"],
  ["首", "Neck"], ["頭", "Head"], ["両目", "Eyes"], ["目", "Eye"],
  ["肩P", "Shoulder P"], ["肩C", "Shoulder C"], ["肩", "Shoulder"],
  ["腕捩", "Arm twist"], ["腕", "Arm"],
  ["ひじ補助", "Elbow helper"], ["ひじ", "Elbow"], ["肘", "Elbow"],
  ["手捩", "Wrist twist"], ["手首", "Wrist"], ["手先", "Hand tip"],
  ["親指０", "Thumb 0"], ["親指", "Thumb"],
  ["人差指", "Index"], ["人指", "Index"], ["中指", "Middle"],
  ["薬指", "Ring"], ["小指", "Little"],
  ["足ＩＫ", "Leg IK"], ["足IK", "Leg IK"],
  ["つま先ＩＫ", "Toe IK"], ["つま先IK", "Toe IK"], ["つま先", "Toe"],
  ["足首", "Ankle"], ["足先EX", "Toe EX"], ["ひざ", "Knee"], ["膝", "Knee"],
  ["腰キャンセル", "Waist cancel"], ["腰", "Waist"], ["足", "Leg"],
  ["キャンセル", "Cancel"],
  ["胸上", "Chest up"], ["胸", "Chest"], ["乳", "Breast"],
  ["髪", "Hair"], ["前髪", "Bangs"], ["後髪", "Back hair"],
  ["スカート", "Skirt"], ["リボン", "Ribbon"], ["袖", "Sleeve"],
  ["ネクタイ", "Necktie"], ["マフラー", "Scarf"],
  ["しっぽ", "Tail"], ["尻尾", "Tail"], ["尻", "Hip"],
  ["耳", "Ear"], ["舌", "Tongue"], ["眉", "Brow"], ["まぶた", "Eyelid"],
  ["ダミー", "Dummy"], ["調整", "Adjust"], ["補助", "Helper"],
  ["捩", "Twist"], ["ＩＫ", "IK"], ["先", "Tip"], ["親", "Parent"],
  ["右", "R"], ["左", "L"], // mid/trailing sides (腰キャンセル右 etc.)
].sort((a, b) => b[0].length - a[0].length);

export function translateBoneName(name) {
  if (!/[^\x00-\x7F]/.test(name)) return name; // already ASCII
  let side = "";
  let s = name;
  if (s.startsWith("左")) { side = "L "; s = s.slice(1); }
  else if (s.startsWith("右")) { side = "R "; s = s.slice(1); }
  for (const [jp, en] of JP_TOKENS) {
    if (s.includes(jp)) s = s.split(jp).join(en + " ");
  }
  s = (side + s).replace(/\s+/g, " ").trim();
  return s;
}

export function createAnimTimeline({ bridge, cameraBridge = null, performanceBridge = null, actions = {}, getHost }) {
  if (!bridge) throw new Error("anim-timeline: bridge is required");

  /* ------------------------------ state --------------------------------- */
  const S = {
    open: false,
    pxPerSec: 60,          // zoom
    scrollX: 0,            // pan (seconds at the left edge)
    rowH: 20,
    headerH: 22,
    labelW: 190,
    sel: null,             // { t, bone|null }  (null bone = whole key)
    drag: null,            // active drag descriptor
    hoverRow: -1,
    undo: [],
    redo: [],
    lastRows: [],
    en: false,             // translate bone labels JP -> EN (local dictionary)
  };
  try { S.en = localStorage.getItem("mmd_timeline_en") === "1"; } catch (_) {}
  const MAX_UNDO = 60;

  /* --------------------------- undo / redo ------------------------------ */
  const cameraKeys = () => cameraBridge?.keys?.() || [];
  const faceKeys = () => performanceBridge?.faceKeys?.() || [];
  const handKeys = () => performanceBridge?.handKeys?.() || [];
  const masterDuration = () => Math.max(
    bridge.duration?.() || 0,
    cameraBridge?.duration?.() || 0,
    performanceBridge?.duration?.() || 0,
    1,
  );
  const masterTime = () => cameraKeys().length
    ? (cameraBridge?.time?.() ?? performanceBridge?.time?.() ?? bridge.time())
    : (performanceBridge?.time?.() ?? bridge.time());
  const masterPlaying = () =>
    !!performanceBridge?.playing?.() ||
    !!bridge.playing?.() ||
    !!cameraBridge?.playing?.();
  const masterHasKeys = () => bridge.keys().length > 0 || cameraKeys().length > 0 || faceKeys().length > 0 || handKeys().length > 0;
  function seekMaster(t) {
    const next = Math.max(0, Math.min(masterDuration(), Number(t) || 0));
    if (performanceBridge?.seek) performanceBridge.seek(next);
    else bridge.seek(next);
    cameraBridge?.seek?.(next);
  }
  function setMasterPlaying(value) {
    const next = !!value;
    // The bone clock is the shared playhead even for a face-only or fingers-only
    // performance. This keeps semantic animation moving without requiring a
    // decorative bone key.
    if (performanceBridge?.setPlaying) {
      performanceBridge.setPlaying(next && masterHasKeys());
    } else {
      bridge.setPlaying(next && masterHasKeys());
    }
    cameraBridge?.setPlaying?.(next && cameraKeys().length > 0);
  }
  function setMasterDuration(value) {
    const next = Math.max(1, Number(value) || masterDuration());
    bridge.setDuration?.(next);
    cameraBridge?.setDuration?.(next);
    performanceBridge?.setDuration?.(next);
  }

  const snapshot = () => JSON.stringify({
    keys: bridge.keys(),
    duration: bridge.duration(),
    cameraKeys: cameraKeys(),
    cameraDuration: cameraBridge?.duration?.() || 0,
    performance: performanceBridge?.snapshot?.() || null,
  });
  function pushUndo() {
    S.undo.push(snapshot());
    if (S.undo.length > MAX_UNDO) S.undo.shift();
    S.redo.length = 0;
  }
  function restore(json) {
    try {
      const d = JSON.parse(json);
      bridge.replaceKeys(d.keys || []);
      if (d.duration) bridge.setDuration(d.duration);
      if (cameraBridge) {
        cameraBridge.replaceKeys?.(d.cameraKeys || []);
        if (d.cameraDuration) cameraBridge.setDuration?.(d.cameraDuration);
        cameraBridge.commit?.();
      }
      if (performanceBridge && d.performance) performanceBridge.restore?.(d.performance);
    } catch (_) {}
  }
  function doUndo() {
    if (!S.undo.length) return;
    S.redo.push(snapshot());
    restore(S.undo.pop());
    draw();
  }
  function doRedo() {
    if (!S.redo.length) return;
    S.undo.push(snapshot());
    restore(S.redo.pop());
    draw();
  }

  /* --------------------------- data helpers ----------------------------- */
  // rows = [{ bone:null, label:"◆ All" }, { bone, label }...] for keyed bones
  function buildRows() {
    const keys = bridge.keys();
    const names = new Set();
    for (const k of keys) for (const n of Object.keys(k.pose || {})) names.add(n);
    const sel = bridge.selectedBone();
    if (sel) names.add(sel); // always show the working bone
    const arr = [...names];
    // group by region for a tidy, predictable order
    const regionRank = { root: 0, spine: 1, head: 2, armL: 3, armR: 4, legL: 5, legR: 6, ik: 7, finger: 8, accessory: 9, other: 10 };
    arr.sort((a, b) => {
      const ra = regionRank[bridge.regionOf(a)] ?? 10;
      const rb = regionRank[bridge.regionOf(b)] ?? 10;
      return ra - rb || a.localeCompare(b);
    });
    const rows = [{ kind: "all", bone: null, label: "◆ ALL TRACKS" }];
    if (cameraBridge) {
      rows.push({ kind: "camera", bone: null, label: "CAMERA · Transform / Lens" });
    }
    if (performanceBridge) {
      rows.push({ kind: "face", bone: null, label: "FACE · Morphs / Expressions" });
      rows.push({ kind: "hands", bone: null, label: "HANDS · Fingers / Gestures" });
    }
    rows.push({ kind: "pose", bone: null, label: "CHARACTER · Full Pose" });
    for (const n of arr) rows.push({ kind: "bone", bone: n, label: S.en ? translateBoneName(n) : n });
    S.lastRows = rows;
    return rows;
  }
  function boneKeyTimes(bone) {
    const out = [];
    for (const k of bridge.keys()) {
      if (bone == null || (k.pose && k.pose[bone])) out.push(k.t);
    }
    return out;
  }
  function keyTimesFor(row) {
    if (!row) return [];
    if (row.kind === "camera") return cameraKeys().map((key) => key.t);
    if (row.kind === "face") return faceKeys().map((key) => key.t);
    if (row.kind === "hands") return handKeys().map((key) => key.t);
    if (row.kind === "pose") return boneKeyTimes(null);
    if (row.kind === "bone") return boneKeyTimes(row.bone);
    const merged = new Set([
      ...boneKeyTimes(null).map((t) => Number(t).toFixed(5)),
      ...cameraKeys().map((key) => Number(key.t).toFixed(5)),
      ...faceKeys().map((key) => Number(key.t).toFixed(5)),
      ...handKeys().map((key) => Number(key.t).toFixed(5)),
    ]);
    return [...merged].map(Number).sort((a, b) => a - b);
  }
  function keyAt(t) {
    return bridge.keys().find((k) => Math.abs(k.t - t) < 0.03) || null;
  }
  // Move a key in time. bone=null moves the WHOLE key; a bone name moves only
  // that bone's channel (splitting/merging shared keys as needed).
  function moveBoneKey(bone, t0, t1) {
    const keys = bridge.keys();
    const src = keys.find((k) => Math.abs(k.t - t0) < 0.03);
    if (!src) return false;
    t1 = Math.max(0, Math.min(masterDuration(), t1));
    if (bone == null) {
      const clash = keys.find((k) => k !== src && Math.abs(k.t - t1) < 0.06);
      if (clash) clash.pose = { ...clash.pose, ...src.pose };
      else src.t = t1;
      if (clash) keys.splice(keys.indexOf(src), 1);
    } else {
      const q = src.pose && src.pose[bone];
      if (!q) return false;
      delete src.pose[bone];
      if (!Object.keys(src.pose).length) keys.splice(keys.indexOf(src), 1);
      const dst = keys.find((k) => Math.abs(k.t - t1) < 0.06);
      if (dst) dst.pose[bone] = q;
      else keys.push({ t: t1, pose: { [bone]: q } });
    }
    bridge.commit();
    return true;
  }
  function moveCameraKey(t0, t1) {
    if (!cameraBridge) return false;
    return cameraBridge.moveKey?.(t0, Math.max(0, Math.min(masterDuration(), t1))) !== false;
  }
  function moveKey(kind, bone, t0, t1) {
    if (kind === "camera") return moveCameraKey(t0, t1);
    if (kind === "face" || kind === "hands") return performanceBridge?.moveKey?.(kind, t0, Math.max(0, Math.min(masterDuration(), t1))) !== false;
    if (kind === "pose" || kind === "bone") return moveBoneKey(kind === "pose" ? null : bone, t0, t1);
    const movedBone = moveBoneKey(null, t0, t1);
    const movedCamera = moveCameraKey(t0, t1);
    const movedFace = performanceBridge?.moveKey?.("face", t0, Math.max(0, Math.min(masterDuration(), t1))) || false;
    const movedHands = performanceBridge?.moveKey?.("hands", t0, Math.max(0, Math.min(masterDuration(), t1))) || false;
    return movedBone || movedCamera || movedFace || movedHands;
  }
  function deleteSelected() {
    if (!S.sel) return;
    pushUndo();
    if (S.sel.kind === "camera") {
      cameraBridge?.deleteKey?.(S.sel.t);
      S.sel = null;
      draw();
      return;
    }
    if (S.sel.kind === "face" || S.sel.kind === "hands") {
      performanceBridge?.deleteKey?.(S.sel.kind, S.sel.t);
      S.sel = null;
      draw();
      return;
    }
    if (S.sel.kind === "all") {
      cameraBridge?.deleteKey?.(S.sel.t);
      performanceBridge?.deleteKey?.("face", S.sel.t);
      performanceBridge?.deleteKey?.("hands", S.sel.t);
    }
    const keys = bridge.keys();
    const k = keys.find((x) => Math.abs(x.t - S.sel.t) < 0.03);
    if (!k) {
      S.sel = null;
      cameraBridge?.commit?.();
      draw();
      return;
    }
    if (S.sel.kind === "all" || S.sel.kind === "pose") keys.splice(keys.indexOf(k), 1);
    else {
      delete k.pose[S.sel.bone];
      if (!Object.keys(k.pose).length) keys.splice(keys.indexOf(k), 1);
    }
    S.sel = null;
    bridge.commit();
    draw();
  }

  /* ------------------------------- DOM ---------------------------------- */
  const css = (s) => s;
  const host = getHost?.() || document.body;
  const embedded = host !== document.body;
  const panel = document.createElement("div");
  panel.id = "animTimelinePanel";
  panel.style.cssText = css(
    (embedded
      ? "position:absolute;inset:0;height:auto;z-index:2;"
      : "position:fixed;left:12px;right:12px;bottom:12px;height:238px;z-index:9998;") +
    "background:rgba(13,11,25,0.99);border:1px solid #30254b;border-radius:0;" +
    (embedded ? "box-shadow:none;" : "box-shadow:0 14px 44px rgba(0,0,0,0.55);") +
    "display:none;flex-direction:column;" +
    "backdrop-filter:blur(6px);color:#d7d2f5;font:12px system-ui,sans-serif;user-select:none");

  const bar = document.createElement("div");
  bar.style.cssText = css("display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid #372f60;flex:0 0 auto;flex-wrap:wrap");
  panel.appendChild(bar);

  const mkBtn = (label, title, onclick) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.title = title;
    b.style.cssText = css(
      "background:#241d43;border:1px solid #4a3f8c;color:#d7d2f5;border-radius:6px;" +
      "padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer");
    b.onmouseenter = () => (b.style.background = "#32285e");
    b.onmouseleave = () => (b.style.background = "#241d43");
    b.addEventListener("click", onclick);
    bar.appendChild(b);
    return b;
  };

  const btnPlay = mkBtn("▶", "Play / pause (Space)", () => togglePlay());
  btnPlay.id = "unifiedTimelinePlay";
  mkBtn("⏹", "Stop camera and character, then rewind", () => { setMasterPlaying(false); seekMaster(0); draw(); });
  const timeLbl = document.createElement("span");
  timeLbl.style.cssText = "min-width:120px;color:#9b8fd6;font-variant-numeric:tabular-nums";
  bar.appendChild(timeLbl);

  const btnKeyAll = mkBtn("◆ + Key all", "Key camera, body pose, facial animation and both hands at the master playhead", () => {
    pushUndo();
    seekMaster(masterTime());
    if (bridge.enabled()) bridge.addKeyPose();
    cameraBridge?.addKeyAt?.(masterTime());
    performanceBridge?.addFaceKeyAt?.(masterTime());
    performanceBridge?.addHandKeyAt?.(masterTime());
    draw();
  });
  btnKeyAll.id = "unifiedTimelineKeyAll";
  mkBtn("◇ + Key bone", "Key only the selected bone at the playhead", () => {
    const b = bridge.selectedBone();
    if (!b) return flash("Select a bone first");
    pushUndo();
    bridge.addKeyAt(masterTime(), b);
    draw();
  });
  if (cameraBridge) {
    mkBtn("🎥 + Camera", "Key camera transform, target, lens, roll and focus", () => {
      pushUndo();
      cameraBridge.addKeyAt?.(masterTime());
      draw();
    });
  }
  if (performanceBridge) {
    const btnFaceKey = mkBtn("🙂 + Face", "Key current facial morphs, expression, emotion, gaze, eye appearance and micro motion", () => {
      pushUndo();
      seekMaster(masterTime());
      if (performanceBridge.addFaceKeyAt?.(masterTime()) === false) return flash("Load and select a character first");
      flash("Face key added");
      draw();
    });
    btnFaceKey.id = "unifiedTimelineKeyFace";
    btnFaceKey.style.borderColor = "#7a3d70";
    btnFaceKey.style.color = "#ffc1e1";
    const btnHandKey = mkBtn("🖐 + Fingers", "Key both hands: master hand controls and every finger joint", () => {
      pushUndo();
      seekMaster(masterTime());
      if (performanceBridge.addHandKeyAt?.(masterTime()) === false) return flash("Load and select a character first");
      flash("Finger key added");
      draw();
    });
    btnHandKey.id = "unifiedTimelineKeyHands";
    btnHandKey.style.borderColor = "#2f7964";
    btnHandKey.style.color = "#a9f1d5";
  }
  const btnAuto = mkBtn("● Bone Auto", "Automatically key a bone when you finish dragging it", () => {
    bridge.setAutoKey(!bridge.autoKey());
    styleAuto();
  });
  btnAuto.id = "unifiedTimelineAutoBone";
  let btnFaceAuto = null, btnHandAuto = null;
  if (performanceBridge) {
    btnFaceAuto = mkBtn("● Face Auto", "Automatically key facial controls when they change", () => {
      performanceBridge.setAutoKey?.("face", !performanceBridge.autoKey?.("face"));
      styleAuto();
    });
    btnFaceAuto.id = "unifiedTimelineAutoFace";
    btnHandAuto = mkBtn("● Finger Auto", "Automatically key hand and finger controls when they change", () => {
      performanceBridge.setAutoKey?.("hands", !performanceBridge.autoKey?.("hands"));
      styleAuto();
    });
    btnHandAuto.id = "unifiedTimelineAutoHands";
  }
  function styleAuto() {
    const set = (button, enabled, activeBorder, activeColor) => {
      if (!button) return;
      button.style.borderColor = enabled ? activeBorder : "#4a3f8c";
      button.style.color = enabled ? activeColor : "#d7d2f5";
      button.style.background = enabled ? "#30234f" : "#241d43";
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    };
    set(btnAuto, bridge.autoKey(), "#e05f7a", "#ff9db1");
    set(btnFaceAuto, !!performanceBridge?.autoKey?.("face"), "#ff6fb5", "#ffb0d5");
    set(btnHandAuto, !!performanceBridge?.autoKey?.("hands"), "#52d6a5", "#9ff2d2");
  }
  mkBtn("↶", "Undo (Ctrl+Z)", doUndo);
  mkBtn("↷", "Redo (Ctrl+Y)", doRedo);
  mkBtn("🗑", "Delete selected key (Del)", deleteSelected);
  mkBtn("🧹 Clear all", "Delete EVERY key on the timeline (undo-able with Ctrl+Z)", () => {
    if (!masterHasKeys()) return flash("Timeline is already empty");
    pushUndo();
    setMasterPlaying(false);
    bridge.replaceKeys([]);
    cameraBridge?.replaceKeys?.([]);
    cameraBridge?.commit?.();
    performanceBridge?.clear?.("all");
    S.sel = null;
    flash("Timeline cleared — Ctrl+Z to undo");
    draw();
  });
  const btnEn = mkBtn("あ→A", "Translate bone names to English (local dictionary, works offline)", () => {
    S.en = !S.en;
    try { localStorage.setItem("mmd_timeline_en", S.en ? "1" : "0"); } catch (_) {}
    styleEn();
    draw();
  });
  function styleEn() {
    btnEn.style.borderColor = S.en ? "#7a5cff" : "#4a3f8c";
    btnEn.style.color = S.en ? "#b9a8ff" : "#d7d2f5";
  }
  mkBtn("⤢ Fit", "Fit the whole clip", () => { fitZoom(); draw(); });
  mkBtn("+30s", "Extend the shared camera and character timeline", () => {
    setMasterDuration(masterDuration() + 30);
    fitZoom();
    draw();
  });
  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "1";
  durationInput.max = "3600";
  durationInput.step = "1";
  durationInput.title = "Shared timeline duration in seconds";
  durationInput.setAttribute("aria-label", "Shared timeline duration in seconds");
  durationInput.style.cssText = "width:58px;height:23px;padding:0 6px;border:1px solid #4a3f8c;border-radius:6px;background:#17122c;color:#d7d2f5;font:11px ui-monospace,monospace";
  durationInput.addEventListener("change", () => {
    setMasterDuration(durationInput.value);
    fitZoom();
    draw();
  });
  bar.appendChild(durationInput);
  if (actions.bakeBone) mkBtn("🎬 Bake", "Bake the current pose performance", actions.bakeBone);
  if (actions.exportBone) mkBtn("Export", "Export character timeline JSON", actions.exportBone);
  if (actions.importBone) mkBtn("Import", "Import character timeline JSON", actions.importBone);

  const flashLbl = document.createElement("span");
  flashLbl.style.cssText = "color:#ffb86b;font-size:11px;margin-left:4px";
  bar.appendChild(flashLbl);
  let _flashT = 0;
  function flash(msg) {
    flashLbl.textContent = msg;
    const my = ++_flashT;
    setTimeout(() => { if (_flashT === my) flashLbl.textContent = ""; }, 2200);
  }

  const spacer = document.createElement("div");
  spacer.style.cssText = "flex:1";
  bar.appendChild(spacer);
  mkBtn("✕", "Close the timeline", () => setOpen(false));

  const canvasWrap = document.createElement("div");
  canvasWrap.style.cssText = "flex:1;position:relative;overflow:hidden;border-radius:0 0 12px 12px";
  panel.appendChild(canvasWrap);
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100%;height:100%;display:block;cursor:default";
  canvasWrap.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  host.appendChild(panel);

  /* ----------------------------- geometry -------------------------------- */
  const timeToX = (t) => S.labelW + (t - S.scrollX) * S.pxPerSec;
  const xToTime = (x) => S.scrollX + (x - S.labelW) / S.pxPerSec;
  function rowAtY(y) {
    if (y < S.headerH) return -1;
    return Math.floor((y - S.headerH) / S.rowH);
  }
  function fitZoom() {
    const w = canvas.clientWidth - S.labelW - 20;
    S.pxPerSec = Math.max(8, w / Math.max(masterDuration(), 0.001));
    S.scrollX = 0;
  }

  /* ------------------------------ drawing -------------------------------- */
  let _needsDraw = false;
  function draw() {
    if (_needsDraw) return;
    _needsDraw = true;
    requestAnimationFrame(() => { _needsDraw = false; paint(); });
  }
  function paint() {
    if (!S.open) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const rows = buildRows();
    const dur = masterDuration();
    const selBone = bridge.selectedBone();

    // --- ruler ---
    ctx.fillStyle = "#1b1633";
    ctx.fillRect(0, 0, W, S.headerH);
    const stepCandidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
    const step = stepCandidates.find((s) => s * S.pxPerSec >= 46) || 60;
    ctx.font = "10px system-ui";
    ctx.textBaseline = "middle";
    for (let t = Math.max(0, Math.floor(S.scrollX / step) * step); t <= Math.min(dur, S.scrollX + (W - S.labelW) / S.pxPerSec) + step; t += step) {
      const x = timeToX(t);
      if (x < S.labelW) continue;
      ctx.strokeStyle = "#2c2450";
      ctx.beginPath(); ctx.moveTo(x, S.headerH); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillStyle = "#7d72b8";
      ctx.fillText(t.toFixed(step < 1 ? 2 : 0) + "s", x + 3, S.headerH / 2);
    }
    // clip end shading
    const endX = timeToX(dur);
    if (endX < W) {
      ctx.fillStyle = "rgba(10,8,20,0.55)";
      ctx.fillRect(Math.max(endX, S.labelW), S.headerH, W - endX, H - S.headerH);
    }

    // --- rows ---
    for (let i = 0; i < rows.length; i++) {
      const y = S.headerH + i * S.rowH;
      if (y > H) break;
      const r = rows[i];
      const isSel = r.kind === "bone" && r.bone === selBone;
      // label cell
      ctx.fillStyle = i % 2 ? "#161129" : "#191331";
      ctx.fillRect(0, y, W, S.rowH);
      if (isSel) {
        ctx.fillStyle = "rgba(122,92,255,0.14)";
        ctx.fillRect(0, y, W, S.rowH);
      }
      if (i === S.hoverRow) {
        ctx.fillStyle = "rgba(255,255,255,0.035)";
        ctx.fillRect(0, y, W, S.rowH);
      }
      ctx.fillStyle = r.kind === "camera"
        ? "#6fe7f2"
        : r.kind === "face"
          ? "#ff8fc9"
          : r.kind === "hands"
            ? "#77e0b7"
        : r.kind === "all"
          ? "#f1ebff"
          : r.kind === "pose"
            ? "#e7c66f"
            : isSel ? "#b9a8ff" : "#8f85c4";
      ctx.font = r.kind === "bone" ? "12px system-ui" : "bold 12px system-ui";
      ctx.fillText(clipText(r.label, S.labelW - 12), 8, y + S.rowH / 2);
      // keys
      const times = keyTimesFor(r);
      for (const t of times) {
        const x = timeToX(t);
        if (x < S.labelW - 6 || x > W + 6) continue;
        const selected = S.sel && Math.abs(S.sel.t - t) < 0.03 &&
          S.sel.kind === r.kind && S.sel.bone === r.bone;
        const baseColor = r.kind === "camera"
          ? "#36d8ea"
          : r.kind === "face"
            ? "#ff5fac"
            : r.kind === "hands"
              ? "#42d49b"
          : r.kind === "pose"
            ? "#d9a92f"
            : r.kind === "all" ? "#c7b5ff" : "#7a5cff";
        drawDiamond(x, y + S.rowH / 2, r.kind === "bone" ? 4 : 5,
          selected ? "#ffd166" : baseColor,
          selected);
      }
    }

    // --- label column divider ---
    ctx.strokeStyle = "#372f60";
    ctx.beginPath(); ctx.moveTo(S.labelW, 0); ctx.lineTo(S.labelW, H); ctx.stroke();

    // --- playhead ---
    const px = timeToX(masterTime());
    if (px >= S.labelW) {
      ctx.strokeStyle = "#ff5f7a";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "#ff5f7a";
      ctx.beginPath();
      ctx.moveTo(px - 5, 0); ctx.lineTo(px + 5, 0); ctx.lineTo(px, 8);
      ctx.closePath(); ctx.fill();
    }

    // --- transport labels ---
    timeLbl.textContent = `${masterTime().toFixed(2)} / ${dur.toFixed(2)} s`;
    if (document.activeElement !== durationInput) durationInput.value = String(Math.round(dur));
    btnPlay.textContent = masterPlaying() ? "⏸" : "▶";
    if (S.open && masterPlaying()) requestAnimationFrame(draw);
  }
  function drawDiamond(x, y, r, color, ring) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill();
    if (ring) {
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
  }
  function clipText(s, w) {
    if (ctx.measureText(s).width <= w) return s;
    while (s.length > 1 && ctx.measureText(s + "…").width > w) s = s.slice(0, -1);
    return s + "…";
  }

  /* ---------------------------- interaction ------------------------------ */
  function hitKey(x, y) {
    const rows = S.lastRows;
    const i = rowAtY(y);
    if (i < 0 || i >= rows.length) return null;
    const r = rows[i];
    for (const t of keyTimesFor(r)) {
      if (Math.abs(timeToX(t) - x) <= 6) return { t, kind: r.kind, bone: r.bone, row: i };
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      S.drag = { kind: "pan", x0: x, s0: S.scrollX };
      return;
    }
    const hit = hitKey(x, y);
    if (hit) {
      S.sel = { t: hit.t, kind: hit.kind, bone: hit.bone };
      if (hit.bone) bridge.selectBone(hit.bone);
      if (hit.kind === "camera") cameraBridge?.selectKey?.(hit.t);
      S.drag = { kind: "key", trackKind: hit.kind, bone: hit.bone, t0: hit.t, tCur: hit.t, moved: false };
      draw();
      return;
    }
    // empty area / ruler: scrub
    S.drag = { kind: "scrub" };
    setMasterPlaying(false);
    seekMaster(Math.max(0, xToTime(x)));
    draw();
  });
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (!S.drag) {
      const row = rowAtY(y);
      if (row !== S.hoverRow) { S.hoverRow = row; draw(); }
      canvas.style.cursor = hitKey(x, y) ? "grab" : x > S.labelW ? "crosshair" : "default";
      return;
    }
    if (S.drag.kind === "pan") {
      S.scrollX = Math.max(0, S.drag.s0 - (x - S.drag.x0) / S.pxPerSec);
      draw();
    } else if (S.drag.kind === "scrub") {
      seekMaster(Math.max(0, xToTime(x)));
      draw();
    } else if (S.drag.kind === "key") {
      S.drag.tCur = Math.max(0, Math.min(masterDuration(), xToTime(x)));
      S.drag.moved = S.drag.moved || Math.abs(S.drag.tCur - S.drag.t0) * S.pxPerSec > 3;
      if (S.drag.moved) {
        canvas.style.cursor = "grabbing";
        // live preview: draw a ghost by temporarily selecting the new time
        S.sel = { t: S.drag.t0, kind: S.drag.trackKind, bone: S.drag.bone, ghost: S.drag.tCur };
        draw();
      }
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (S.drag && S.drag.kind === "key" && S.drag.moved) {
      pushUndo();
      const snapped = maybeSnap(S.drag.tCur);
      moveKey(S.drag.trackKind, S.drag.bone, S.drag.t0, snapped);
      S.sel = { t: snapped, kind: S.drag.trackKind, bone: S.drag.bone };
    }
    S.drag = null;
    canvas.style.cursor = "default";
    draw();
  });
  canvas.addEventListener("dblclick", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const rows = S.lastRows;
    const i = rowAtY(y);
    if (i < 0 || i >= rows.length || x <= S.labelW) return;
    const r = rows[i];
    const t = maybeSnap(Math.max(0, Math.min(masterDuration(), xToTime(x))));
    pushUndo();
    seekMaster(t);
    if (r.kind === "all") {
      if (bridge.enabled()) bridge.addKeyPose();
      cameraBridge?.addKeyAt?.(t);
      performanceBridge?.addFaceKeyAt?.(t);
      performanceBridge?.addHandKeyAt?.(t);
    } else if (r.kind === "camera") cameraBridge?.addKeyAt?.(t);
    else if (r.kind === "face") performanceBridge?.addFaceKeyAt?.(t);
    else if (r.kind === "hands") performanceBridge?.addHandKeyAt?.(t);
    else if (r.kind === "pose") bridge.addKeyPose();
    else bridge.addKeyAt(t, r.bone);
    S.sel = { t, kind: r.kind, bone: r.bone };
    draw();
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tAt = xToTime(x);
    const f = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    S.pxPerSec = Math.max(6, Math.min(600, S.pxPerSec * f));
    S.scrollX = Math.max(0, tAt - (x - S.labelW) / S.pxPerSec);
    draw();
  }, { passive: false });

  // snap to 1/30s grid when zoomed in enough for it to be meaningful
  function maybeSnap(t) {
    if (S.pxPerSec >= 90) return Math.round(t * 30) / 30;
    return t;
  }

  function togglePlay() {
    if (!masterHasKeys()) return flash("Add a camera or character key first");
    setMasterPlaying(!masterPlaying());
    draw();
  }

  function onKeyDown(e) {
    if (!S.open) return;
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    else if (e.code === "Delete" || e.code === "Backspace") { e.preventDefault(); deleteSelected(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey) { e.preventDefault(); doUndo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey))) { e.preventDefault(); doRedo(); }
  }
  window.addEventListener("keydown", onKeyDown, true);

  /* ----------------------------- lifecycle ------------------------------- */
  const unsub = bridge.onChange(() => { if (S.open) draw(); });
  const unsubPerformance = performanceBridge?.onChange?.(() => { if (S.open) { styleAuto(); draw(); } });

  function setOpen(v) {
    S.open = !!v;
    panel.style.display = S.open ? "flex" : "none";
    // Pose ownership: while open, the motion system must NOT re-assert the
    // paused animation over scrubbed poses (the "twisting limbs" bug).
    try { bridge.setTimelineActive?.(S.open); } catch (_) {}
    if (S.open) {
      setMasterDuration(masterDuration());
      fitZoom();
      styleAuto();
      styleEn();
      draw();
    }
  }
  function toggle() { setOpen(!S.open); }

  function dispose() {
    try { bridge.setTimelineActive?.(false); } catch (_) {}
    try { unsub(); } catch (_) {}
    try { unsubPerformance?.(); } catch (_) {}
    window.removeEventListener("keydown", onKeyDown, true);
    panel.remove();
  }

  return { setOpen, toggle, isOpen: () => S.open, draw, fit: () => { fitZoom(); draw(); }, dispose,
    _test: { moveKey, buildRows, keyTimesFor, pushUndo, doUndo, doRedo, S } };
}
