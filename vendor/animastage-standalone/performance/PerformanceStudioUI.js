import { FINGER_NAMES } from "./PerformanceConstants.js";
import { GRIP_TYPES } from "./AutoGripSolver.js?v=perf15";

function injectStyles() {
  if (document.getElementById("performanceStudioStyles")) return;
  const style = document.createElement("style");
  style.id = "performanceStudioStyles";
  style.textContent = `
    .performance-studio { border:1px solid #38315a; background:#12101d; border-radius:8px; padding:8px; margin:0 0 10px; }
    .performance-title { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#eeeaff; font-weight:700; margin-bottom:7px; }
    .performance-badge { color:#a9a1c5; font:10px ui-monospace,monospace; font-weight:400; }
    .performance-tabs { display:flex; gap:4px; overflow-x:auto; padding-bottom:6px; }
    .performance-tabs .btn { flex:0 0 auto; padding:5px 8px; font-size:11px; }
    .performance-tabs .btn.active { background:#392d68; border-color:#aa94ff; color:#fff; }
    .performance-content { border-top:1px solid #2c2842; padding-top:7px; }
    .performance-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; }
    .performance-preset-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; max-height:220px; overflow:auto; }
    .performance-preset-grid .btn.active { background:#403273; border-color:#bcaaff; }
    .performance-slider { display:grid; grid-template-columns:minmax(0,1fr) 54px; gap:6px; align-items:end; margin:6px 0; }
    .performance-slider label { display:block; color:#b8b2d0; font-size:11px; margin-bottom:2px; }
    .performance-slider input[type=range] { width:100%; }
    .performance-slider .val { width:54px; }
    .performance-subtitle { color:#b6aed4; font-size:11px; margin:8px 0 5px; }
    .performance-side .btn.active { background:#3a2f67; border-color:#a996ff; }
    .performance-warning { border-left:3px solid #e8b84d; background:#241f2b; color:#d8d1e8; padding:5px 7px; margin:4px 0; font-size:11px; }
    .performance-warning.error { border-color:#ef6678; }
    .performance-ok { color:#75d7bc; font-size:11px; margin:5px 0; }
    .performance-map-row { display:grid; grid-template-columns:minmax(0,1fr) 55px; gap:5px; align-items:center; padding:4px 0; border-bottom:1px solid #252139; font-size:10px; }
    .performance-map-row select { grid-column:1/-1; min-width:0; width:100%; background:#171328; color:#ddd8f1; border:1px solid #39315b; padding:3px; }
    .performance-confidence { text-align:right; font-family:ui-monospace,monospace; }
    .performance-confidence.high { color:#75d7bc; } .performance-confidence.medium { color:#e8c56d; } .performance-confidence.low { color:#ef7d8d; }
    .performance-layer-row { border:1px solid #2d2944; border-radius:6px; padding:6px; margin:5px 0; }
    .performance-layer-head { display:flex; align-items:center; gap:7px; font-size:11px; }
    .performance-empty { color:#aaa3c1; font-size:11px; padding:8px 2px; }
    .performance-wide { grid-column:1/-1; }
    .performance-contact { display:grid; grid-template-columns:1fr auto; gap:8px; padding:4px 6px; margin:3px 0; border-radius:4px; background:#201c31; color:#c8c2dd; font-size:10px; }
    .performance-contact.valid { border-left:3px solid #68d6b5; }
    .performance-contact.locked { border-left:3px solid #5d9cff; }
    .performance-contact.near { border-left:3px solid #e8c56d; }
    .performance-contact.penetration, .performance-contact.miss { border-left:3px solid #ef7d8d; }
    .performance-select { width:100%; min-width:0; background:#171328; color:#ddd8f1; border:1px solid #39315b; border-radius:4px; padding:6px; }
    .performance-capture-video { width:100%; max-height:210px; object-fit:cover; background:#080710; border:1px solid #39315b; border-radius:6px; transform:scaleX(-1); margin:6px 0; }
    .performance-studio {
      border-color:var(--ui-line,rgba(142,102,255,.18));
      background:linear-gradient(155deg,rgba(37,27,70,.72),rgba(10,8,23,.94) 42%,rgba(8,15,29,.94));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 12px 28px rgba(0,0,0,.18);
    }
    .performance-title { color:var(--ui-text,#f2efff); letter-spacing:.055em; font-size:12px; }
    .performance-badge { color:var(--ui-accent-2,#27e6ff); opacity:.78; }
    .performance-tabs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; overflow:visible; padding:0 0 8px; }
    .performance-tabs .btn { width:100%; min-width:0; margin:0; padding:6px 4px; overflow:hidden; text-overflow:ellipsis; }
    .performance-tabs .btn.active,.performance-side .btn.active,.performance-preset-grid .btn.active {
      color:#fff; border-color:rgba(168,128,255,.72);
      background:linear-gradient(135deg,rgba(123,70,255,.82),rgba(39,230,255,.15));
      box-shadow:0 0 14px rgba(139,92,255,.2),inset 0 1px 0 rgba(255,255,255,.08);
    }
    .performance-content { border-top-color:var(--ui-line,rgba(142,102,255,.18)); }
    .performance-grid .btn,.performance-preset-grid .btn { width:100%; margin:0; min-width:0; }
    .performance-subtitle { color:#c8baff; text-transform:uppercase; letter-spacing:.065em; font-size:10px; }
    .performance-slider { align-items:center; margin:8px 0; }
    .performance-slider label { color:#c4bbdc; }
    .performance-slider input[type=range] { -webkit-appearance:none; appearance:none; height:5px; border-radius:999px; outline:none; background:linear-gradient(90deg,rgba(139,92,255,.88),rgba(39,230,255,.72)); box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); }
    .performance-slider input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:15px; height:15px; border-radius:50%; border:2px solid #eae4ff; background:var(--ui-accent,#8b5cff); box-shadow:0 0 0 3px rgba(139,92,255,.16),0 0 10px rgba(39,230,255,.28); cursor:pointer; }
    .performance-slider input[type=range]::-moz-range-thumb { width:13px; height:13px; border-radius:50%; border:2px solid #eae4ff; background:var(--ui-accent,#8b5cff); }
    .performance-slider .val { box-sizing:border-box; width:54px; color:#d9d0ff; background:rgba(5,4,13,.92); border-color:var(--ui-line,rgba(142,102,255,.22)); }
    .performance-studio .check-row input { accent-color:var(--ui-accent,#8b5cff); }
    .performance-layer-row { border-color:var(--ui-line,rgba(142,102,255,.18)); background:rgba(8,6,20,.42); }
    .performance-studio,.performance-studio * { scrollbar-width:thin; scrollbar-color:rgba(139,92,255,.55) rgba(4,3,11,.35); }
    .performance-studio *::-webkit-scrollbar { width:6px; height:6px; }
    .performance-studio *::-webkit-scrollbar-track { background:rgba(4,3,11,.35); border-radius:999px; }
    .performance-studio *::-webkit-scrollbar-thumb { background:linear-gradient(180deg,rgba(139,92,255,.74),rgba(39,230,255,.45)); border-radius:999px; }
  `;
  document.head.appendChild(style);
}

function button(label, title = "") {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "btn";
  el.textContent = label;
  if (title) el.title = title;
  return el;
}

function checkbox(label, checked, onChange) {
  const row = document.createElement("label");
  row.className = "check-row";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.addEventListener("change", () => onChange(input.checked));
  row.append(input, document.createTextNode(` ${label}`));
  return row;
}

function slider(label, value, min, max, step, onInput) {
  const row = document.createElement("div");
  row.className = "performance-slider";
  const wrap = document.createElement("div");
  const lab = document.createElement("label");
  lab.textContent = label;
  const range = document.createElement("input");
  range.type = "range";
  range.min = String(min); range.max = String(max); range.step = String(step); range.value = String(value);
  const out = document.createElement("input");
  out.className = "val"; out.type = "number"; out.min = String(min); out.max = String(max); out.step = String(step); out.value = Number(value).toFixed(2);
  const apply = (raw) => {
    const next = Math.max(min, Math.min(max, Number(raw) || 0));
    range.value = String(next); out.value = next.toFixed(2); onInput(next);
  };
  range.addEventListener("input", () => apply(range.value));
  out.addEventListener("change", () => apply(out.value));
  wrap.append(lab, range); row.append(wrap, out);
  return row;
}

function title(text) { const el = document.createElement("div"); el.className = "performance-subtitle"; el.textContent = text; return el; }
function pretty(value) { return String(value).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function downloadVmd(system, showError, clearError) {
  const bytes = system.exportActivePerformanceVmd("AnimeStage Performance", { fps: 30 });
  if (!bytes) { showError?.("No performance channels are available to export."); return false; }
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  const link = document.createElement("a"); link.href = url; link.download = "AnimeStage_Performance.vmd"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); clearError?.(); return true;
}

export function mountPerformanceStudioUI({ system, cBoneEdit, showError, clearError }) {
  injectStyles();
  const body = cBoneEdit?.closest(".body");
  if (!body || document.getElementById("performanceStudio")) return null;
  const shell = document.createElement("section");
  shell.id = "performanceStudio";
  shell.className = "performance-studio";
  const heading = document.createElement("div");
  heading.className = "performance-title";
  heading.append(document.createTextNode("HAND STUDIO"));
  const badge = document.createElement("span");
  badge.className = "performance-badge";
  heading.appendChild(badge);
  shell.appendChild(heading);
  const tabBar = document.createElement("div");
  tabBar.className = "performance-tabs";
  const content = document.createElement("div");
  content.className = "performance-content";
  shell.append(tabBar, content);
  const tabs = ["Quick", "Fingers", "Presets", "Auto Grip", "Capture", "Mapping", "Advanced"];
  let activeTab = "Quick";
  let editSide = "left";
  let handModelUrl = "";
  const tabButtons = new Map();
  for (const name of tabs) {
    const tab = button(name);
    tab.addEventListener("click", () => { activeTab = name; render(); });
    tabBar.appendChild(tab); tabButtons.set(name, tab);
  }

  function current() {
    const runtime = system.getActiveRuntime();
    badge.textContent = runtime ? `${runtime.profile.stats.mappedFingerJoints} joints` : "no model";
    return runtime;
  }

  function sideControls(parent, hands) {
    const row = document.createElement("div");
    row.className = "performance-grid performance-side";
    for (const side of ["left", "right"]) {
      const el = button(side === "left" ? "Left Hand" : "Right Hand");
      el.classList.toggle("active", editSide === side);
      el.addEventListener("click", () => { editSide = side; render(); });
      row.appendChild(el);
    }
    const symmetry = checkbox("Mirror / Symmetry", hands.state.symmetry, (value) => { hands.setSymmetry(value); render(); });
    symmetry.classList.add("performance-wide"); row.appendChild(symmetry); parent.appendChild(row);
  }

  function renderQuick(runtime) {
    const hands = runtime.hands;
    sideControls(content, hands);
    content.appendChild(title("Quick presets"));
    const presets = document.createElement("div"); presets.className = "performance-preset-grid";
    for (const name of ["relaxed", "open_palm", "fist", "pointing", "peace_sign", "thumbs_up", "pinch", "anime_pose"]) {
      const el = button(pretty(name));
      el.addEventListener("click", () => { runtime.timeline.checkpoint(); hands.applyPreset(name, hands.state.symmetry ? "both" : editSide); clearError?.(); render(); });
      presets.appendChild(el);
    }
    content.appendChild(presets);
    const master = hands.state.hands[editSide].master;
    content.appendChild(title("Master controls"));
    for (const [label, key, min, max] of [
      ["Curl", "curl", 0, 1], ["Spread", "spread", -1, 1], ["Relax", "relax", 0, 1], ["Tension", "tension", 0, 1],
      ["Cup", "cup", 0, 1], ["Fan", "fan", -1, 1], ["Thumb Opposition", "thumbOpposition", -1, 1], ["Thumb Curl", "thumbCurl", 0, 1],
    ]) content.appendChild(slider(label, master[key], min, max, 0.01, (value) => hands.setMaster(editSide, key, value)));
  }

  function renderFingers(runtime) {
    const hands = runtime.hands; sideControls(content, hands);
    const master = hands.state.hands[editSide].master;
    content.appendChild(title("Wrist"));
    for (const [label, key] of [["Bend", "wristBend"], ["Twist", "wristTwist"], ["Side Bend", "wristSideBend"]]) {
      content.appendChild(slider(label, master[key], -1, 1, 0.01, (value) => hands.setMaster(editSide, key, value)));
    }
    for (const digit of FINGER_NAMES) {
      const finger = hands.state.hands[editSide].fingers[digit];
      content.appendChild(title(pretty(digit)));
      for (const [label, key] of [["Curl", "curl"], ["Spread", "spread"], ["Twist", "twist"], ["Proximal", "proximal"], ["Middle joint", "middle"], ["Distal", "distal"]]) {
        content.appendChild(slider(label, finger[key], -1, 1, 0.01, (value) => hands.setFinger(editSide, digit, key, value)));
      }
    }
  }

  function renderPresets(runtime) {
    const hands = runtime.hands; sideControls(content, hands);
    const grid = document.createElement("div"); grid.className = "performance-preset-grid";
    for (const name of hands.presets.names()) {
      const el = button(pretty(name));
      el.addEventListener("click", () => { runtime.timeline.checkpoint(); hands.applyPreset(name, hands.state.symmetry ? "both" : editSide); render(); });
      grid.appendChild(el);
    }
    content.appendChild(grid);
    content.appendChild(title("Save semantic preset"));
    const row = document.createElement("div"); row.className = "performance-grid";
    const name = document.createElement("input"); name.className = "val performance-wide"; name.placeholder = "Preset name";
    const save = button("Save Current"); save.className += " performance-wide";
    save.addEventListener("click", () => {
      if (!hands.saveCurrentPreset(name.value, editSide)) showError?.("Enter a valid hand preset name.");
      else { clearError?.(); render(); }
    });
    row.append(name, save); content.appendChild(row);
  }

  function renderAutoGrip(runtime) {
    const grip = runtime.autoGrip;
    sideControls(content, runtime.hands);
    content.appendChild(title("Grip target"));
    const target = grip.target;
    const targetInfo = document.createElement("div");
    targetInfo.className = target ? "performance-ok" : "performance-warning";
    targetInfo.textContent = target ? `Target: ${target.name || target.userData?.sceneObjId || "selected prop"}` : "Select a prop in Scene Editor, then run Auto Grip.";
    content.appendChild(targetInfo);
    const select = document.createElement("select");
    select.className = "performance-select";
    for (const type of GRIP_TYPES) {
      const option = document.createElement("option"); option.value = type; option.textContent = pretty(type); select.appendChild(option);
    }
    select.value = grip.gripType;
    select.addEventListener("change", () => { grip.gripType = select.value; });
    content.appendChild(select);
    content.appendChild(checkbox(
      "Attach prop to character hand",
      grip.autoAttach,
      (value) => { grip.setAutoAttach(value); render(); },
    ));
    if (!grip.autoAttach) content.appendChild(checkbox(
      "Lock wrist to moving target",
      grip.followTarget,
      (value) => { grip.setFollowTarget(value); },
    ));
    const ownershipNote = document.createElement("div");
    ownershipNote.className = "performance-warning";
    ownershipNote.textContent = grip.attached
      ? "Attached to the wrist bone: the prop now follows the character and does not own the bone gizmo."
      : grip.autoAttach
        ? "Auto Grip will preserve the prop's world pose, then make it a child attachment of the wrist bone."
        : grip.followTarget
      ? "Wrist lock is active only when the prop moves; manual bone edits remain available between target updates."
      : "One-shot grip: Auto Grip positions the arm once, then releases the skeleton for Smart Pose or Classic Bones.";
    content.appendChild(ownershipNote);
    const row = document.createElement("div"); row.className = "performance-grid"; row.style.marginTop = "7px";
    const solve = button("Auto Grip", "Solves the arm and fingers, then optionally attaches the selected prop to the wrist as part of the character");
    solve.addEventListener("click", () => {
      const result = system.solveActiveGrip({ side: editSide, gripType: select.value, attach: grip.autoAttach, maintain: !grip.autoAttach && grip.followTarget });
      if (!result.ok) showError?.(result.message); else clearError?.();
      render();
    });
    const release = button(grip.attached ? "Detach / Release" : "Release"); release.addEventListener("click", () => { system.releaseActiveGrip(); clearError?.(); render(); });
    row.append(solve, release); content.appendChild(row);
    if (grip.lastResult?.message) {
      const status = document.createElement("div"); status.className = grip.lastResult.ok ? "performance-ok" : "performance-warning error"; status.textContent = grip.lastResult.message; content.appendChild(status);
    }
    if (grip.contacts.length) {
      content.appendChild(title("Finger contacts"));
      for (const contact of grip.contacts) {
        const item = document.createElement("div"); item.className = `performance-contact ${contact.status}`;
        const distance = Number.isFinite(contact.distance) ? Math.abs(contact.distance).toFixed(3) : "—";
        item.append(document.createTextNode(pretty(contact.finger)), document.createTextNode(`${contact.status} · ${distance}`));
        content.appendChild(item);
      }
    }
  }

  function renderCapture(runtime) {
    const capture = runtime.handCapture;
    content.appendChild(title("MediaPipe Hand Capture"));
    const note = document.createElement("div"); note.className = "performance-warning";
    note.textContent = "Choose a MediaPipe hand_landmarker.task model. Processing stays local in the browser."; content.appendChild(note);
    const model = document.createElement("input"); model.type = "file"; model.accept = ".task,application/octet-stream"; model.className = "performance-select";
    model.addEventListener("change", () => { if (handModelUrl) URL.revokeObjectURL(handModelUrl); handModelUrl = model.files?.[0] ? URL.createObjectURL(model.files[0]) : ""; });
    const video = document.createElement("video"); video.className = "performance-capture-video"; video.autoplay = true; video.muted = true; video.playsInline = true;
    const status = document.createElement("div"); status.className = "performance-ok"; status.textContent = capture.frames.length ? `${capture.frames.length} recorded frames` : "Capture idle";
    content.append(model, video, status);
    content.appendChild(checkbox("Mirrored webcam", capture.mirror, (value) => { capture.mirror = value; video.style.transform = value ? "scaleX(-1)" : "none"; }));
    const controls = document.createElement("div"); controls.className = "performance-grid";
    const start = button("Start Camera"); start.addEventListener("click", async () => {
      if (!handModelUrl) return showError?.("Choose a MediaPipe hand_landmarker.task model first.");
      try { await runtime.capture.startCamera("hand", video, handModelUrl); status.textContent = "Hand tracking live"; clearError?.(); } catch (error) { showError?.(`Hand capture failed: ${error.message || error}`); status.textContent = "Capture failed"; }
    });
    const stop = button("Stop Camera"); stop.addEventListener("click", async () => { await runtime.capture.stopCamera(); status.textContent = "Capture stopped"; });
    const record = button("Start Record"); record.addEventListener("click", () => { runtime.capture.startRecording("hand"); status.textContent = "Recording hand motion…"; });
    const write = button("Stop + Write Keys"); write.addEventListener("click", () => { runtime.timeline.checkpoint(); if (runtime.capture.stopRecording("hand", { offset: runtime.timeline.time() })) { status.textContent = `${capture.frames.length} frames written to semantic hand tracks`; clearError?.(); } else showError?.("No tracked hand frames were recorded."); });
    controls.append(start, stop, record, write); content.appendChild(controls);
    const live = document.createElement("div"); live.className = "performance-ok"; live.textContent = `Gesture: L ${capture.lastGesture.left} · R ${capture.lastGesture.right}`; content.appendChild(live);
    content.appendChild(title("Prerecorded tracking JSON"));
    const prerecorded = document.createElement("input"); prerecorded.type = "file"; prerecorded.accept = ".json,application/json"; prerecorded.className = "performance-select";
    prerecorded.addEventListener("change", async () => { try { const frames = JSON.parse(await prerecorded.files[0].text()); if (!runtime.capture.loadRecording("hand", frames, { offset: runtime.timeline.time() })) throw new Error("No valid hand frames"); status.textContent = `${frames.length} prerecorded frames written`; clearError?.(); } catch (error) { showError?.(`Invalid hand capture JSON: ${error.message || error}`); } });
    content.appendChild(prerecorded);
  }

  function confidenceClass(value) { return value >= 0.8 ? "high" : value >= 0.55 ? "medium" : "low"; }

  function renderMapping(runtime) {
    const profile = runtime.profile;
    if (!profile.warnings.length) { const ok = document.createElement("div"); ok.className = "performance-ok"; ok.textContent = "Rig mapping validation passed."; content.appendChild(ok); }
    for (const warning of profile.warnings) {
      const el = document.createElement("div"); el.className = `performance-warning ${warning.severity === "error" ? "error" : ""}`; el.textContent = warning.message; content.appendChild(el);
    }
    content.appendChild(title("Finger axis calibration"));
    content.appendChild(checkbox("Invert Left Finger Curl", runtime.hands.curlSigns.left < 0, (value) => runtime.hands.setCurlInverted("left", value)));
    content.appendChild(checkbox("Invert Right Finger Curl", runtime.hands.curlSigns.right < 0, (value) => runtime.hands.setCurlInverted("right", value)));
    content.appendChild(title("Bone mapping (manual overrides are cached for this model)"));
    const bones = runtime.mesh.skeleton.bones;
    const manual = { ...(system.mappingCache.get(profile.fingerprint)?.boneRoles || {}) };
    const roles = ["left.wrist", "right.wrist"];
    for (const side of ["left", "right"]) for (const digit of FINGER_NAMES) for (const joint of ["proximal", "middle", "distal"]) roles.push(`${side}.${digit}.${joint}`);
    for (const role of roles) {
      const binding = profile.boneRoles[role];
      const row = document.createElement("div"); row.className = "performance-map-row";
      const name = document.createElement("span"); name.textContent = role;
      const confidence = document.createElement("span"); confidence.className = `performance-confidence ${confidenceClass(binding?.confidence || 0)}`; confidence.textContent = binding ? `${Math.round(binding.confidence * 100)}%` : "missing";
      const select = document.createElement("select");
      const missing = document.createElement("option"); missing.value = ""; missing.textContent = "— unmapped —"; select.appendChild(missing);
      for (let i = 0; i < bones.length; i++) { const option = document.createElement("option"); option.value = String(i); option.textContent = `#${i} ${bones[i].name || "(unnamed)"}`; select.appendChild(option); }
      select.value = binding ? String(binding.targetBoneIndex) : "";
      select.addEventListener("change", () => { if (select.value === "") delete manual[role]; else manual[role] = Number(select.value); });
      row.append(name, confidence, select); content.appendChild(row);
    }
    const save = button("Save Mapping", "Rebuild the runtime with these model-specific assignments");
    save.style.marginTop = "7px";
    save.addEventListener("click", () => {
      const existing = system.mappingCache.get(profile.fingerprint) || {};
      if (system.setMappingOverrides(runtime.mesh, { ...existing, boneRoles: manual })) { clearError?.(); render(); }
      else showError?.("Could not save the rig mapping.");
    });
    content.appendChild(save);
  }

  function renderAdvanced(runtime) {
    content.appendChild(title("Semantic timeline"));
    const timeline = runtime.timeline, stats = timeline.stats();
    const status = document.createElement("div"); status.className = "performance-ok";
    status.textContent = `${stats.keys} keys / ${stats.channels} channels · Finger Auto-key ${timeline.handAutoKeyEnabled() ? "ON" : "OFF"}`;
    content.appendChild(status);
    const keyGrid = document.createElement("div"); keyGrid.className = "performance-grid";
    const actions = [
      ["Key Both Hands", () => timeline.keyHand("both")], ["Delete at Time", () => timeline.deleteAtPlayhead()],
      ["Copy Keys", () => timeline.copyAtPlayhead()], ["Paste Keys", () => timeline.pasteAtPlayhead()],
      ["Mirror Paste", () => timeline.pasteAtPlayhead({ mirrorHands: true })], ["Undo", () => timeline.undo()],
      ["Redo", () => timeline.redo()], ["Time ×2", () => timeline.scaleTime(2)],
      ["Time ×0.5", () => timeline.scaleTime(0.5)],
    ];
    for (const [label, action] of actions) { const el = button(label); el.addEventListener("click", () => { action(); render(); }); keyGrid.appendChild(el); }
    const bake = button("Bake Full Performance"); bake.className += " performance-wide"; bake.addEventListener("click", () => { if (system.bakeActivePerformance(`Baked Performance ${new Date().toLocaleTimeString()}`)) clearError?.(); else showError?.("No performance channels are available to bake."); }); keyGrid.appendChild(bake);
    const exportVmd = button("Export Performance .VMD"); exportVmd.className += " performance-wide"; exportVmd.addEventListener("click", () => downloadVmd(system, showError, clearError)); keyGrid.appendChild(exportVmd);
    content.appendChild(keyGrid);
    content.appendChild(title("Performance layers"));
    for (const layer of runtime.stack.layers) {
      const row = document.createElement("div"); row.className = "performance-layer-row";
      const head = document.createElement("div"); head.className = "performance-layer-head";
      head.append(
        checkbox(layer.label, layer.enabled, (value) => layer.setEnabled(value)),
        checkbox("Mute", layer.muted, (value) => layer.setMuted(value)),
        checkbox("Solo", layer.solo, (value) => layer.setSolo(value)),
      );
      row.append(head, slider("Weight", layer.weight, 0, 1, 0.01, (value) => layer.setWeight(value)));
      content.appendChild(row);
    }
    const reset = button("Reset Hand Layer"); reset.addEventListener("click", () => { runtime.hands.reset(); runtime.stack.get("handPose").reset(); render(); });
    content.appendChild(reset);
  }

  function render() {
    for (const [name, el] of tabButtons) el.classList.toggle("active", name === activeTab);
    content.replaceChildren();
    const runtime = current();
    if (!runtime) { const empty = document.createElement("div"); empty.className = "performance-empty"; empty.textContent = "Load and select a PMX/PMD character to map its hands."; content.appendChild(empty); return; }
    if (activeTab === "Quick") renderQuick(runtime);
    else if (activeTab === "Fingers") renderFingers(runtime);
    else if (activeTab === "Presets") renderPresets(runtime);
    else if (activeTab === "Auto Grip") renderAutoGrip(runtime);
    else if (activeTab === "Capture") renderCapture(runtime);
    else if (activeTab === "Mapping") renderMapping(runtime);
    else renderAdvanced(runtime);
  }

  system.onChange((reason) => { if (["attached", "detached", "mapping-changed", "auto-grip", "auto-grip-release"].includes(reason)) render(); });
  shell.addEventListener("pointerenter", () => { const runtime = system.getActiveRuntime(); badge.textContent = runtime ? `${runtime.profile.stats.mappedFingerJoints} joints` : "no model"; });
  const smartShell = document.getElementById("smartPoseShell");
  if (smartShell?.parentElement === body) smartShell.insertAdjacentElement("afterend", shell);
  else body.insertBefore(shell, body.firstChild);
  render();
  return { shell, refresh: render };
}
