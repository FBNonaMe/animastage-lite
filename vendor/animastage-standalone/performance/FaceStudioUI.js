import { FACIAL_CHANNELS } from "./FacialChannels.js";
import { EXPRESSION_PRESETS } from "./FacialExpressionController.js";
import { EMOTION_PRESETS } from "./EmotionController.js";
import { PERSONALITY_PRESETS } from "./MicroExpressionEngine.js?v=perf10";
import { faceModelSourceLabel, modelSourceFromFile, resolveFaceLandmarkerModel } from "./MediaPipeModelResolver.js?v=perf11";

function ensureStyles() {
  if (document.getElementById("faceStudioStyles")) return;
  const style = document.createElement("style"); style.id = "faceStudioStyles";
  style.textContent = `
    .face-studio { border:1px solid #38315a; background:#12101d; border-radius:8px; padding:8px; margin:0 0 10px; }
    .face-title { display:flex; justify-content:space-between; color:#eeeaff; font-weight:700; margin-bottom:7px; }
    .face-tabs { display:flex; gap:4px; overflow-x:auto; padding-bottom:6px; }
    .face-tabs .btn { flex:0 0 auto; padding:5px 8px; font-size:11px; }
    .face-tabs .btn.active { background:#392d68; border-color:#aa94ff; color:#fff; }
    .face-content { border-top:1px solid #2c2842; padding-top:7px; }
    .face-preset-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; max-height:250px; overflow:auto; }
    .face-preset-grid .btn.active { background:#403273; border-color:#bcaaff; }
    .face-slider { display:grid; grid-template-columns:minmax(0,1fr) 54px; gap:6px; align-items:end; margin:6px 0; }
    .face-slider label { color:#b8b2d0; font-size:11px; display:block; margin-bottom:2px; }
    .face-slider input[type=range] { width:100%; } .face-slider .val { width:54px; }
    .face-subtitle { color:#b6aed4; font-size:11px; margin:8px 0 5px; }
    .face-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; }
    .emotion-pad { height:170px; border:1px solid #4a3d73; border-radius:8px; position:relative; cursor:crosshair; overflow:hidden; background:linear-gradient(to top,#29243e,#402d55),linear-gradient(to right,#5a3347,#31584f); touch-action:none; }
    .emotion-pad::before,.emotion-pad::after { content:""; position:absolute; background:#77708d55; } .emotion-pad::before { left:50%; top:0; width:1px; height:100%; } .emotion-pad::after { top:50%; left:0; height:1px; width:100%; }
    .emotion-point { position:absolute; width:16px; height:16px; border-radius:50%; background:#b69cff; border:2px solid #fff; box-shadow:0 0 10px #8d65ff; transform:translate(-50%,-50%); pointer-events:none; }
    .emotion-labels { display:flex; justify-content:space-between; color:#8f88a8; font-size:10px; margin:3px 1px 7px; }
    .face-status { color:#aaa3c1; font-size:11px; padding:7px 2px; }
    .face-map { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) 48px; gap:5px; padding:4px 0; border-bottom:1px solid #27233b; font-size:10px; }
    .face-confidence { text-align:right; color:#77d4bb; font-family:ui-monospace,monospace; }
    .face-capture-video { width:100%; max-height:210px; object-fit:cover; background:#080710; border:1px solid #39315b; border-radius:6px; transform:scaleX(-1); margin:6px 0; }
    .face-file { width:100%; min-width:0; color:#cbc4e4; background:#171328; border:1px solid #39315b; border-radius:4px; padding:6px; }
    .face-studio {
      border-color:var(--ui-line,rgba(142,102,255,.18));
      background:linear-gradient(155deg,rgba(37,27,70,.72),rgba(10,8,23,.94) 42%,rgba(8,15,29,.94));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 12px 28px rgba(0,0,0,.18);
    }
    .face-title { color:var(--ui-text,#f2efff); letter-spacing:.055em; font-size:12px; }
    .face-tabs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; overflow:visible; padding:0 0 8px; }
    .face-tabs .btn { width:100%; min-width:0; margin:0; padding:6px 4px; overflow:hidden; text-overflow:ellipsis; }
    .face-tabs .btn.active,.face-preset-grid .btn.active,.face-eye-side .btn.active {
      color:#fff; border-color:rgba(168,128,255,.72);
      background:linear-gradient(135deg,rgba(123,70,255,.82),rgba(39,230,255,.15));
      box-shadow:0 0 14px rgba(139,92,255,.2),inset 0 1px 0 rgba(255,255,255,.08);
    }
    .face-content { border-top-color:var(--ui-line,rgba(142,102,255,.18)); }
    .face-grid .btn,.face-preset-grid .btn { width:100%; margin:0; min-width:0; }
    .face-subtitle { color:#c8baff; text-transform:uppercase; letter-spacing:.065em; font-size:10px; }
    .face-slider { align-items:center; margin:8px 0; }
    .face-slider label { color:#c4bbdc; }
    .face-slider input[type=range] { -webkit-appearance:none; appearance:none; height:5px; border-radius:999px; outline:none; background:linear-gradient(90deg,rgba(139,92,255,.88),rgba(39,230,255,.72)); box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); }
    .face-slider input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:15px; height:15px; border-radius:50%; border:2px solid #eae4ff; background:var(--ui-accent,#8b5cff); box-shadow:0 0 0 3px rgba(139,92,255,.16),0 0 10px rgba(39,230,255,.28); cursor:pointer; }
    .face-slider input[type=range]::-moz-range-thumb { width:13px; height:13px; border-radius:50%; border:2px solid #eae4ff; background:var(--ui-accent,#8b5cff); }
    .face-slider .val { box-sizing:border-box; width:54px; color:#d9d0ff; background:rgba(5,4,13,.92); border-color:var(--ui-line,rgba(142,102,255,.22)); }
    .face-studio .check-row input { accent-color:var(--ui-accent,#8b5cff); }
    .face-coordinate,.face-eye-support { border:1px solid var(--ui-line,rgba(142,102,255,.18)); border-radius:6px; padding:7px 8px; margin:6px 0; background:rgba(5,4,14,.52); color:#bcb3d5; font:10px ui-monospace,monospace; line-height:1.55; }
    .face-warning,.face-ok { border:1px solid rgba(232,184,77,.3); border-left:3px solid #e8b84d; border-radius:5px; padding:7px 8px; margin:6px 0; background:rgba(54,42,20,.48); color:#e8def7; font-size:11px; line-height:1.45; }
    .face-ok { border-color:rgba(39,230,255,.22); border-left-color:var(--ui-accent-2,#27e6ff); background:rgba(10,42,52,.35); color:#ccefff; }
    .face-eye-support strong { color:var(--ui-accent-2,#27e6ff); font-weight:600; }
    .face-eye-side { margin:5px 0; }
    .face-color { display:grid; grid-template-columns:minmax(0,1fr) 54px; gap:6px; align-items:center; margin:8px 0; color:#c4bbdc; font-size:11px; }
    .face-color input[type=color] { width:54px; height:28px; padding:2px; border:1px solid var(--ui-line,rgba(142,102,255,.28)); border-radius:5px; background:rgba(5,4,13,.92); }
    .face-file,.face-studio textarea,.face-studio select { color:#d9d0ff; background:rgba(5,4,13,.92); border-color:var(--ui-line,rgba(142,102,255,.22)); border-radius:5px; }
    .face-studio,.face-studio * { scrollbar-width:thin; scrollbar-color:rgba(139,92,255,.55) rgba(4,3,11,.35); }
    .face-studio *::-webkit-scrollbar { width:6px; height:6px; }
    .face-studio *::-webkit-scrollbar-track { background:rgba(4,3,11,.35); border-radius:999px; }
    .face-studio *::-webkit-scrollbar-thumb { background:linear-gradient(180deg,rgba(139,92,255,.74),rgba(39,230,255,.45)); border-radius:999px; }
    .morph-toolbar { display:flex; gap:5px; align-items:center; margin:5px 0 8px; }
    .morph-toolbar .face-file { flex:1 1 auto; }
    .morph-mode { display:flex; gap:4px; flex:0 0 auto; }
    .morph-mode .btn { width:auto; padding:5px 8px; }
    .morph-mode .btn.active { border-color:#aa94ff; background:#392d68; }
    .morph-category-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
    .morph-card { min-width:0; border:1px solid rgba(142,102,255,.2); border-radius:7px; padding:7px; background:rgba(5,4,14,.46); }
    .morph-card-head { display:flex; justify-content:space-between; gap:5px; align-items:center; color:#ddd5f5; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; margin-bottom:5px; }
    .morph-badge { display:inline-flex; align-items:center; border:1px solid rgba(140,112,205,.35); border-radius:999px; padding:1px 5px; color:#aea4c9; font:9px ui-monospace,monospace; text-transform:none; letter-spacing:0; }
    .morph-name { min-height:30px; margin:5px 0; color:#eeeaff; font-size:11px; line-height:1.35; overflow-wrap:anywhere; }
    .morph-name small { display:block; color:#8f88a8; font:9px ui-monospace,monospace; }
    .morph-actions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; margin-top:5px; }
    .morph-actions .btn { min-width:0; width:100%; padding:5px 2px; font-size:10px; }
    .morph-actions .btn.active { color:#ffe780; border-color:#b99b42; background:rgba(97,72,15,.42); }
    .morph-nav { display:grid; grid-template-columns:28px minmax(0,1fr) 28px; gap:4px; }
    .morph-nav .btn { min-width:0; width:100%; padding:4px 2px; }
    .morph-detail { color:#9188a8; font:9px ui-monospace,monospace; line-height:1.45; margin-top:4px; }
    .morph-warning { color:#f0c46d; font-size:9px; line-height:1.4; margin-top:4px; }
    .morph-group { margin-top:5px; border-top:1px solid #29243e; padding-top:4px; color:#aaa3c1; font-size:9px; }
    .morph-group div { display:flex; justify-content:space-between; gap:5px; }
    .morph-table-wrap { max-height:420px; overflow:auto; border:1px solid rgba(142,102,255,.18); border-radius:6px; }
    .morph-table { width:100%; border-collapse:collapse; font-size:9px; }
    .morph-table th { position:sticky; top:0; z-index:1; background:#181329; color:#c8baff; text-align:left; padding:5px; }
    .morph-table td { padding:5px; border-top:1px solid #29243e; color:#bbb3d1; vertical-align:middle; }
    .morph-table tr.active td { background:rgba(67,48,112,.3); color:#eeeaff; }
    .morph-table .btn { width:auto; min-width:25px; padding:3px 5px; }
    .morph-filter-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; margin:5px 0; }
    @media (max-width:560px) { .morph-category-grid { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}

function button(label) { const el = document.createElement("button"); el.type = "button"; el.className = "btn"; el.textContent = label; return el; }
function subtitle(text) { const el = document.createElement("div"); el.className = "face-subtitle"; el.textContent = text; return el; }
function pretty(text) { return String(text).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function downloadVmd(system, showError, clearError) {
  const bytes = system.exportActivePerformanceVmd("AnimeStage Performance", { fps: 30 });
  if (!bytes) { showError?.("No performance channels are available to export."); return false; }
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  const link = document.createElement("a"); link.href = url; link.download = "AnimeStage_Performance.vmd"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); clearError?.(); return true;
}
function check(label, checked, onChange) { const row = document.createElement("label"); row.className = "check-row"; const input = document.createElement("input"); input.type = "checkbox"; input.checked = checked; input.addEventListener("change", () => onChange(input.checked)); row.append(input, document.createTextNode(` ${label}`)); return row; }
function slider(label, value, min, max, step, onInput) {
  const row = document.createElement("div"); row.className = "face-slider";
  const wrap = document.createElement("div"), lab = document.createElement("label"), range = document.createElement("input"), out = document.createElement("input");
  lab.textContent = label; range.type = "range"; range.min = min; range.max = max; range.step = step; range.value = value;
  out.type = "number"; out.className = "val"; out.min = min; out.max = max; out.step = step; out.value = Number(value).toFixed(2);
  const apply = (raw) => { const next = Math.max(min, Math.min(max, Number(raw) || 0)); range.value = next; out.value = next.toFixed(2); onInput(next); };
  range.addEventListener("input", () => apply(range.value)); out.addEventListener("change", () => apply(out.value));
  wrap.append(lab, range); row.append(wrap, out); return row;
}
function colorControl(label, value, onInput) {
  const row = document.createElement("label"); row.className = "face-color"; row.appendChild(document.createTextNode(label));
  const input = document.createElement("input"); input.type = "color"; input.value = value; input.addEventListener("input", () => onInput(input.value)); row.appendChild(input); return row;
}

export function mountFaceStudioUI({ system, cBoneEdit, showError, clearError }) {
  ensureStyles();
  const body = cBoneEdit?.closest(".body");
  if (!body || document.getElementById("faceStudio")) return null;
  const shell = document.createElement("section"); shell.id = "faceStudio"; shell.className = "face-studio";
  const heading = document.createElement("div"); heading.className = "face-title"; heading.append(document.createTextNode("FACE STUDIO"));
  const badge = document.createElement("span"); badge.className = "performance-badge"; heading.appendChild(badge); shell.appendChild(heading);
  const bar = document.createElement("div"); bar.className = "face-tabs";
  const content = document.createElement("div"); content.className = "face-content"; shell.append(bar, content);
  const tabs = ["Expressions", "Facial Morphs", "All Morphs", "Director", "Face Controls", "Emotion Pad", "Eyes & Gaze", "Blink", "Lip Sync", "Capture", "Micro Motion", "Mapping", "Advanced"];
  let active = "Expressions", faceModelSource = null, eyeEditSide = "left", morphMode = "basic", morphQuery = "";
  const morphSelections = new Map(), buttons = new Map();
  for (const name of tabs) { const el = button(name); el.addEventListener("click", () => { active = name; render(); }); bar.appendChild(el); buttons.set(name, el); }

  function getRuntime() { const runtime = system.getActiveRuntime(); badge.textContent = runtime ? `${runtime.facialRig.supportedChannels().length} channels` : "no model"; return runtime; }

  function renderExpressions(runtime) {
    const grid = document.createElement("div"); grid.className = "face-preset-grid";
    for (const name of Object.keys(EXPRESSION_PRESETS)) { const el = button(pretty(name)); el.classList.toggle("active", runtime.expressions.preset === name); el.addEventListener("click", () => { runtime.timeline.checkpoint(); runtime.expressions.setPreset(name); render(); }); grid.appendChild(el); }
    content.append(grid, slider("Expression Intensity", runtime.expressions.intensity, 0, 1, 0.01, (value) => runtime.expressions.setIntensity(value)));
  }

  function renderFaceControls(runtime) {
    const supported = new Set(runtime.facialRig.supportedChannels());
    content.appendChild(subtitle("Semantic facial coefficients"));
    for (const channel of FACIAL_CHANNELS) {
      if (!supported.has(channel) || channel.startsWith("eyeLook") || channel.startsWith("viseme") || /^(?:irisSize|pupilSize|corneaRadius|eyeHighlight)/.test(channel)) continue;
      const value = runtime.expressions.manual[FACIAL_CHANNELS.indexOf(channel)];
      content.appendChild(slider(channel, value, -1, 1, 0.01, (next) => runtime.expressions.setChannel(channel, next)));
    }
    const reset = button("Reset Manual Face"); reset.addEventListener("click", () => { runtime.expressions.resetManual(); render(); }); content.appendChild(reset);
  }

  function renderEmotion(runtime) {
    const emotions = runtime.emotions;
    const pad = document.createElement("div"); pad.className = "emotion-pad";
    const point = document.createElement("div"); point.className = "emotion-point"; pad.appendChild(point);
    const updatePoint = () => { point.style.left = `${(emotions.valence + 1) * 50}%`; point.style.top = `${(1 - emotions.arousal) * 50}%`; };
    const setFromEvent = (event) => { const rect = pad.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)); emotions.setPad(x * 2 - 1, 1 - y * 2); updatePoint(); };
    pad.addEventListener("pointerdown", (event) => { pad.setPointerCapture(event.pointerId); setFromEvent(event); });
    pad.addEventListener("pointermove", (event) => { if (pad.hasPointerCapture(event.pointerId)) setFromEvent(event); });
    updatePoint(); content.appendChild(pad);
    const labels = document.createElement("div"); labels.className = "emotion-labels"; labels.innerHTML = "<span>negative</span><span>low ↔ high energy</span><span>positive</span>"; content.appendChild(labels);
    content.appendChild(slider("Dominance", emotions.dominance, -1, 1, 0.01, (value) => emotions.setPad(emotions.valence, emotions.arousal, value)));
    content.appendChild(slider("Emotion Intensity", emotions.intensity, 0, 1, 0.01, (value) => emotions.setIntensity(value)));
    content.appendChild(subtitle("Emotion presets")); const grid = document.createElement("div"); grid.className = "face-preset-grid";
    for (const name of Object.keys(EMOTION_PRESETS)) { const el = button(pretty(name)); el.addEventListener("click", () => { runtime.timeline.checkpoint(); emotions.setPreset(name); render(); }); grid.appendChild(el); } content.appendChild(grid);
  }

  function renderGaze(runtime) {
    const gaze = runtime.gaze, eyes = runtime.eyeAppearance; const grid = document.createElement("div"); grid.className = "face-grid";
    const camera = button("Look at Camera"); camera.addEventListener("click", () => { gaze.setTargetCamera(); if (runtime.timeline.faceAutoKeyEnabled()) runtime.timeline.keyGaze(false); clearError?.(); render(); });
    const selected = button("Look at Selected"); selected.addEventListener("click", () => { if (!gaze.setTargetSelectedObject()) showError?.("Select a scene object first."); else { if (runtime.timeline.faceAutoKeyEnabled()) runtime.timeline.keyGaze(false); clearError?.(); render(); } });
    const off = button("Gaze Off"); off.addEventListener("click", () => { gaze.clearTarget(); render(); });
    grid.append(camera, selected, off); content.append(grid);
    const soloLayer = runtime.stack.layers.find((layer) => layer.solo && layer.enabled && !layer.muted && layer.id !== "gaze" && layer.id !== "eyeAppearance");
    if (soloLayer) {
      const warning = document.createElement("div"); warning.className = "performance-warning error"; warning.textContent = `Gaze is paused because “${soloLayer.label}” is in Solo mode.`;
      const clearSolo = button("Clear Solo Lock"); clearSolo.addEventListener("click", () => { for (const layer of runtime.stack.layers) layer.setSolo(false); render(); }); content.append(warning, clearSolo);
    }
    const target = gaze.getTargetSnapshot(), coordinate = document.createElement("div"); coordinate.className = "face-coordinate";
    coordinate.textContent = `${target.type.toUpperCase()}  X ${target.position[0].toFixed(3)}  Y ${target.position[1].toFixed(3)}  Z ${target.position[2].toFixed(3)}  ·  ${target.distance.toFixed(3)} units`;
    content.appendChild(coordinate);
    content.append(check("Enable Gaze", gaze.enabled, (value) => { gaze.enabled = value; }));
    content.appendChild(subtitle("Tracking calibration"));
    content.append(slider("Eye Lead / Smoothness", gaze.settings.smoothing, 2, 24, 0.1, (value) => gaze.settings.smoothing = value));
    content.append(slider("Eye Yaw Limit", gaze.settings.eyeYaw * 180 / Math.PI, 1, 60, 0.5, (value) => gaze.settings.eyeYaw = value * Math.PI / 180));
    content.append(slider("Eye Pitch Limit", gaze.settings.eyePitch * 180 / Math.PI, 1, 45, 0.5, (value) => gaze.settings.eyePitch = value * Math.PI / 180));
    content.append(slider("Vergence", gaze.settings.vergence, 0, 1, 0.01, (value) => gaze.settings.vergence = value));
    content.append(slider("Head Follow", gaze.settings.headContribution, 0, 1, 0.01, (value) => gaze.settings.headContribution = value));
    content.append(slider("Neck Follow", gaze.settings.neckContribution, 0, 1, 0.01, (value) => gaze.settings.neckContribution = value));
    content.append(slider("Chest Follow", gaze.settings.chestContribution, 0, 0.5, 0.01, (value) => gaze.settings.chestContribution = value));
    content.append(slider("Micro Saccades", gaze.settings.microSaccades, 0, 1, 0.01, (value) => gaze.settings.microSaccades = value));
    content.append(check("Model eye forward axis is -Z", gaze.settings.forwardSign < 0, (value) => gaze.settings.forwardSign = value ? -1 : 1));
    content.appendChild(subtitle("Camera lens offset (local coordinates)"));
    content.append(slider("Camera X", gaze.settings.cameraOffsetX, -5, 5, 0.01, (value) => gaze.settings.cameraOffsetX = value));
    content.append(slider("Camera Y", gaze.settings.cameraOffsetY, -5, 5, 0.01, (value) => gaze.settings.cameraOffsetY = value));
    content.append(slider("Camera Z", gaze.settings.cameraOffsetZ, -5, 5, 0.01, (value) => gaze.settings.cameraOffsetZ = value));
    content.appendChild(subtitle("Per-eye aiming correction"));
    const sideRow = document.createElement("div"); sideRow.className = "face-grid face-eye-side";
    for (const side of ["left", "right"]) { const el = button(side === "left" ? "Left Eye" : "Right Eye"); el.classList.toggle("active", eyeEditSide === side); el.addEventListener("click", () => { eyeEditSide = side; render(); }); sideRow.appendChild(el); } content.appendChild(sideRow);
    const sideKey = eyeEditSide === "left" ? "left" : "right";
    content.append(slider("Yaw Offset", gaze.settings[`${sideKey}YawOffset`] * 180 / Math.PI, -20, 20, 0.1, (value) => gaze.settings[`${sideKey}YawOffset`] = value * Math.PI / 180));
    content.append(slider("Pitch Offset", gaze.settings[`${sideKey}PitchOffset`] * 180 / Math.PI, -20, 20, 0.1, (value) => gaze.settings[`${sideKey}PitchOffset`] = value * Math.PI / 180));

    content.appendChild(subtitle("Eye anatomy & appearance"));
    const report = eyes.supportReport(), support = document.createElement("div"); support.className = "face-eye-support";
    support.innerHTML = `<strong>Detected:</strong> ${report.eyeBones} eye bones · ${report.partBones} iris/pupil/cornea bones · ${report.eyeMaterials} eye materials · ${report.morphRoles} size morph roles`;
    content.appendChild(support);
    content.append(check("Link Left / Right Eyes", eyes.linked, (value) => { eyes.setLinked(value); render(); }));
    content.append(check("Enable Eye Appearance", eyes.enabled, (value) => eyes.enabled = value));
    const anatomy = eyes.state[eyeEditSide];
    for (const [label, key, min, max] of [
      ["Eyeball Radius", "eyeballRadius", 0.85, 1.15], ["Retina / Iris Radius", "irisRadius", 0.5, 1.5],
      ["Pupil Radius", "pupilRadius", 0.35, 1.65], ["Cornea Radius", "corneaRadius", 0.85, 1.15],
      ["Cornea Gloss", "corneaGloss", 0, 1], ["Sclera Brightness", "scleraBrightness", 0.5, 1.5],
      ["Iris Brightness", "irisBrightness", 0.5, 1.5], ["Highlight Strength", "highlightStrength", 0, 2],
      ["Iris Tint Strength", "tintStrength", 0, 1],
    ]) content.appendChild(slider(label, anatomy[key], min, max, 0.01, (value) => { eyes.setControl(eyeEditSide, key, value); if (runtime.timeline.faceAutoKeyEnabled()) runtime.timeline.keyEyeAppearance(eyes.linked ? "both" : eyeEditSide, false); }));
    content.appendChild(colorControl("Iris Tint", anatomy.irisTint, (value) => { eyes.setControl(eyeEditSide, "irisTint", value); if (runtime.timeline.faceAutoKeyEnabled()) runtime.timeline.keyEyeAppearance(eyes.linked ? "both" : eyeEditSide, false); }));
    const resetEyes = button("Reset Eye Anatomy"); resetEyes.addEventListener("click", () => { runtime.timeline.checkpoint(); eyes.reset(eyes.linked ? "both" : eyeEditSide); render(); }); content.appendChild(resetEyes);
  }

  function renderBlink(runtime) {
    const blink = runtime.blink;
    content.append(check("Blink Layer Enabled", blink.enabled, (value) => blink.enabled = value));
    content.append(check("Automatic Blinking", blink.auto, (value) => blink.auto = value));
    content.append(slider("Blink Rate", blink.rate, 0.1, 3, 0.05, (value) => blink.setRate(value)));
    const grid = document.createElement("div"); grid.className = "face-grid";
    for (const [label, type] of [["Blink", "normal"], ["Double Blink", "double"], ["Slow Blink", "slow"], ["Half Blink", "half"], ["Wink Left", "winkLeft"], ["Wink Right", "winkRight"]]) {
      const el = button(label); el.addEventListener("click", () => { blink.trigger(type); if (runtime.timeline.faceAutoKeyEnabled()) runtime.timeline.keyBlink(type, false); }); grid.appendChild(el);
    }
    content.appendChild(grid);
  }

  function renderLipSync(runtime) {
    const lip = runtime.lipSync;
    content.appendChild(subtitle("Offline audio analysis"));
    const file = document.createElement("input"); file.type = "file"; file.accept = "audio/*"; file.className = "val"; file.style.width = "100%";
    file.addEventListener("change", async () => {
      const audioFile = file.files?.[0]; if (!audioFile) return;
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) throw new Error("Web Audio is unavailable");
        const context = new AudioContextCtor();
        const buffer = await context.decodeAudioData(await audioFile.arrayBuffer());
        const samples = buffer.getChannelData(0);
        if (!lip.analyzeAmplitude(samples, buffer.sampleRate)) throw new Error("No usable audio samples");
        await context.close(); clearError?.(); render();
      } catch (error) { showError?.(`Lip-sync analysis failed: ${error.message || error}`); }
    });
    content.appendChild(file);
    if (lip.waveform.length) {
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 90; canvas.style.cssText = "width:100%;height:70px;background:#0c0a14;border:1px solid #30294b;border-radius:5px;margin-top:6px";
      const ctx = canvas.getContext("2d"); ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < lip.waveform.length; i++) { const x = i / Math.max(1, lip.waveform.length - 1) * canvas.width; const amp = lip.waveform[i] * canvas.height * 0.45; if (i === 0) ctx.moveTo(x, canvas.height / 2 - amp); else ctx.lineTo(x, canvas.height / 2 - amp); }
      for (let i = lip.waveform.length - 1; i >= 0; i--) { const x = i / Math.max(1, lip.waveform.length - 1) * canvas.width; ctx.lineTo(x, canvas.height / 2 + lip.waveform[i] * canvas.height * 0.45); }
      ctx.closePath(); ctx.fillStyle = "#7454c755"; ctx.fill(); ctx.stroke(); content.appendChild(canvas);
      const status = document.createElement("div"); status.className = "face-status"; status.textContent = `${lip.duration.toFixed(2)} s · ${lip.tracks.size} semantic tracks`; content.appendChild(status);
    }
    content.append(slider("Speaking Intensity", lip.intensity, 0, 1.5, 0.01, (value) => lip.intensity = value));
    content.append(slider("Attack", lip.attack, 0.01, 0.25, 0.005, (value) => lip.attack = value));
    content.append(slider("Release", lip.release, 0.01, 0.3, 0.005, (value) => lip.release = value));
    const controls = document.createElement("div"); controls.className = "face-grid";
    const play = button("Preview"); play.addEventListener("click", () => lip.playPreview());
    const stop = button("Stop"); stop.addEventListener("click", () => lip.stopPreview());
    const bake = button("Bake Morph Clip"); bake.addEventListener("click", () => { if (system.bakeActiveLipSync(`Lip Sync ${new Date().toLocaleTimeString()}`)) clearError?.(); else showError?.("Analyze audio before baking lip-sync."); });
    const clear = button("Clear"); clear.addEventListener("click", () => { lip.clear(); render(); }); controls.append(play, stop, bake, clear); content.appendChild(controls);
    content.appendChild(subtitle("Phoneme timestamps (advanced JSON)"));
    const json = document.createElement("textarea"); json.className = "val"; json.rows = 4; json.style.width = "100%"; json.placeholder = '[{"time":0.1,"duration":0.12,"phoneme":"M"},{"time":0.22,"duration":0.2,"phoneme":"A"}]'; content.appendChild(json);
    const apply = button("Apply Phonemes"); apply.addEventListener("click", () => { try { const events = JSON.parse(json.value); if (!Array.isArray(events) || !lip.setPhonemeTimeline(events)) throw new Error("No valid events"); clearError?.(); render(); } catch (error) { showError?.(`Invalid phoneme timeline: ${error.message || error}`); } }); content.appendChild(apply);
  }

  function renderMicro(runtime) {
    const micro = runtime.microExpressions;
    const layer = runtime.stack.get("microExpression");
    const soloBlockers = runtime.stack.layers.filter((item) => item.solo && item.enabled && !item.muted && item.id !== "microExpression");
    const support = micro.supportReport();
    if (soloBlockers.length) {
      const warning = document.createElement("div"); warning.className = "face-warning";
      warning.textContent = `Micro Motion is blocked by Solo: ${soloBlockers.map((item) => item.label).join(", ")}.`;
      const unlock = button("Clear Solo Lock"); unlock.addEventListener("click", () => { for (const item of runtime.stack.layers) item.setSolo(false); render(); });
      content.append(warning, unlock);
    } else if (!layer?.enabled || layer?.muted || (layer?.weight ?? 0) <= 0) {
      const warning = document.createElement("div"); warning.className = "face-warning"; warning.textContent = "The Micro Expression layer is disabled, muted, or has zero weight.";
      const activate = button("Activate Micro Layer"); activate.addEventListener("click", () => { layer?.setEnabled(true).setMuted(false).setWeight(1); render(); }); content.append(warning, activate);
    } else {
      const status = document.createElement("div"); status.className = support.mapped ? "face-ok" : "face-warning";
      status.textContent = support.mapped
        ? `Live output: ${support.mapped}/${support.generated} semantic micro channels mapped to this model.`
        : "No generated micro-expression channel is mapped to this model. Assign facial morphs in Mapping.";
      content.appendChild(status);
    }
    content.append(check("Micro Motion Enabled", micro.enabled, (value) => micro.enabled = value));
    content.append(slider("Intensity", micro.intensity, 0, 1, 0.01, (value) => { micro.intensity = value; if (runtime.timeline.faceAutoKeyEnabled()) runtime.timeline.keyMicro(false); }));
    content.appendChild(subtitle("Personality")); const grid = document.createElement("div"); grid.className = "face-preset-grid";
    for (const name of Object.keys(PERSONALITY_PRESETS)) { const el = button(pretty(name)); el.classList.toggle("active", micro.personality === name); el.addEventListener("click", () => { micro.setPersonality(name); if (runtime.timeline.faceAutoKeyEnabled()) runtime.timeline.keyMicro(false); render(); }); grid.appendChild(el); } content.appendChild(grid);
  }

  function renderCapture(runtime) {
    const capture = runtime.faceCapture;
    content.appendChild(subtitle("MediaPipe Face Capture"));
    const note = document.createElement("div"); note.className = "performance-warning"; note.textContent = "The face tracker loads automatically: bundled model → browser cache → official MediaPipe model. A manual .task file is optional. Camera frames stay local in this browser."; content.appendChild(note);
    const model = document.createElement("input"); model.type = "file"; model.accept = ".task,application/octet-stream"; model.className = "face-file";
    const video = document.createElement("video"); video.className = "face-capture-video"; video.autoplay = true; video.muted = true; video.playsInline = true;
    const status = document.createElement("div"); status.className = "face-status"; status.textContent = capture.frames.length ? `${capture.frames.length} recorded frames` : "Capture idle";
    model.addEventListener("change", async () => {
      const file = model.files?.[0];
      if (!file) { faceModelSource = null; status.textContent = "Automatic face model enabled"; return; }
      try {
        status.textContent = `Reading ${file.name}…`;
        faceModelSource = await modelSourceFromFile(file);
        status.textContent = `Manual model ready · ${file.name}`;
        clearError?.();
      } catch (error) {
        faceModelSource = null;
        status.textContent = "Manual model rejected · automatic model still available";
        showError?.(`Invalid face model: ${error.message || error}`);
      }
    });
    content.append(model, video, status);
    const controls = document.createElement("div"); controls.className = "face-grid";
    const start = button("Start Camera"); start.addEventListener("click", async () => {
      if (start.disabled) return;
      start.disabled = true; start.textContent = "Preparing…";
      try {
        if (!faceModelSource) faceModelSource = await resolveFaceLandmarkerModel({ onStatus: (message) => { status.textContent = message; } });
        status.textContent = "Starting camera…";
        await runtime.capture.startCamera("face", video, faceModelSource);
        status.textContent = `Face tracking live · ${faceModelSourceLabel(faceModelSource)}`;
        clearError?.();
      } catch (error) {
        showError?.(`Face capture failed: ${error.message || error}`);
        status.textContent = "Capture failed · manual .task selection is available";
      } finally {
        start.disabled = false; start.textContent = "Start Camera";
      }
    });
    const stop = button("Stop Camera"); stop.addEventListener("click", async () => { await runtime.capture.stopCamera(); status.textContent = "Capture stopped"; });
    const record = button("Start Record"); record.addEventListener("click", () => { runtime.capture.startRecording("face"); status.textContent = "Recording face motion…"; });
    const write = button("Stop + Write Keys"); write.addEventListener("click", () => { runtime.timeline.checkpoint(); if (runtime.capture.stopRecording("face", { offset: runtime.timeline.time() })) { status.textContent = `${capture.frames.length} frames written to capture tracks`; clearError?.(); } else showError?.("No tracked face frames were recorded."); });
    const neutral = button("Calibrate Neutral"); neutral.addEventListener("click", () => { capture.calibrateNeutral(); status.textContent = "Neutral face calibrated"; });
    const maximum = button("Calibrate Current Max"); maximum.addEventListener("click", () => { capture.calibrateMaximum(); status.textContent = "Expression range calibrated"; });
    controls.append(start, stop, record, write, neutral, maximum); content.appendChild(controls);
    const confidence = document.createElement("div"); confidence.className = "performance-ok"; confidence.textContent = `Tracking confidence: ${Math.round(capture.confidence * 100)}%`; content.appendChild(confidence);
    content.appendChild(subtitle("Prerecorded tracking JSON"));
    const prerecorded = document.createElement("input"); prerecorded.type = "file"; prerecorded.accept = ".json,application/json"; prerecorded.className = "face-file";
    prerecorded.addEventListener("change", async () => { try { const frames = JSON.parse(await prerecorded.files[0].text()); if (!runtime.capture.loadRecording("face", frames, { offset: runtime.timeline.time() })) throw new Error("No valid face frames"); status.textContent = `${frames.length} prerecorded frames written`; clearError?.(); } catch (error) { showError?.(`Invalid face capture JSON: ${error.message || error}`); } });
    content.appendChild(prerecorded);
  }

  function renderDirector(runtime) {
    const director = runtime.director;
    content.appendChild(subtitle("Text-driven Performance Director"));
    const note = document.createElement("div"); note.className = "performance-warning"; note.textContent = "Text is converted into validated semantic commands. It never writes bones or PMX morphs directly."; content.appendChild(note);
    const prompt = document.createElement("textarea"); prompt.className = "val"; prompt.rows = 4; prompt.style.width = "100%";
    prompt.placeholder = "She looks away shyly, softly smiles, slowly blinks, and nervously tightens her fingers.";
    const json = document.createElement("textarea"); json.className = "val"; json.rows = 10; json.style.width = "100%"; json.value = director.preview ? JSON.stringify(director.preview, null, 2) : "";
    const status = document.createElement("div"); status.className = "face-status"; status.textContent = director.preview ? "Validated preview ready" : "Enter a direction, then Generate Preview";
    const controls = document.createElement("div"); controls.className = "face-grid";
    const generate = button("Generate Preview"); generate.addEventListener("click", () => { const result = director.generate(prompt.value); if (!result.ok) { showError?.(result.errors.join("; ")); status.textContent = "Validation failed"; return; } json.value = JSON.stringify(result.value, null, 2); status.textContent = "Validated preview ready"; clearError?.(); });
    const apply = button("Apply as Layers"); apply.addEventListener("click", () => { try { const checked = director.setPreview(JSON.parse(json.value)); if (!checked.ok) throw new Error(checked.errors.join("; ")); const result = director.apply(); if (!result.ok) throw new Error(result.errors.join("; ")); status.textContent = `Applied ${result.start.toFixed(2)}–${result.end.toFixed(2)} s`; clearError?.(); } catch (error) { showError?.(`Director command rejected: ${error.message || error}`); } });
    const undo = button("Undo Director"); undo.addEventListener("click", () => { if (runtime.timeline.undo()) status.textContent = "Director edit undone"; });
    const redo = button("Redo"); redo.addEventListener("click", () => { if (runtime.timeline.redo()) status.textContent = "Director edit restored"; });
    controls.append(generate, apply, undo, redo); content.append(prompt, controls, status, subtitle("Validated command JSON"), json);
    const saveRow = document.createElement("div"); saveRow.className = "face-grid"; saveRow.style.marginTop = "6px";
    const name = document.createElement("input"); name.className = "val"; name.placeholder = "Performance preset name";
    const save = button("Save Preset"); save.addEventListener("click", () => { try { const checked = director.setPreview(JSON.parse(json.value)); if (!checked.ok || !director.savePreset(name.value)) throw new Error(checked.errors?.join("; ") || "Enter a preset name"); status.textContent = `Saved preset: ${name.value}`; clearError?.(); } catch (error) { showError?.(`Could not save preset: ${error.message || error}`); } });
    saveRow.append(name, save); content.appendChild(saveRow);
    if (Object.keys(director.userPresets).length) {
      content.appendChild(subtitle("Saved performance presets")); const grid = document.createElement("div"); grid.className = "face-preset-grid";
      for (const [presetName, command] of Object.entries(director.userPresets)) { const el = button(presetName); el.addEventListener("click", () => { director.setPreview(command); json.value = JSON.stringify(command, null, 2); status.textContent = `Loaded preset: ${presetName}`; }); grid.appendChild(el); } content.appendChild(grid);
    }
  }

  function renderMapping(runtime) {
    content.appendChild(subtitle("Detected PMX morph graph"));
    for (const [role, mappings] of Object.entries(runtime.profile.morphs)) for (const mapping of mappings) {
      const row = document.createElement("div"); row.className = "face-map"; const confidence = document.createElement("span"); confidence.className = "face-confidence"; confidence.textContent = `${Math.round(mapping.confidence * 100)}%`;
      row.append(Object.assign(document.createElement("span"), { textContent: role }), Object.assign(document.createElement("span"), { textContent: mapping.targetMorphName }), confidence); content.appendChild(row);
    }
    if (!Object.keys(runtime.profile.morphs).length) { const empty = document.createElement("div"); empty.className = "face-status"; empty.textContent = "No compatible facial morphs were detected."; content.appendChild(empty); }
    content.appendChild(subtitle("Manual eye morph correction"));
    const note = document.createElement("div"); note.className = "performance-warning"; note.textContent = "Use this when a model names left/right eyelids unusually. A manual assignment is saved for this PMX fingerprint only."; content.appendChild(note);
    const cached = system.mappingCache.get(runtime.profile.fingerprint) || {}, manualMorphs = { ...(cached.morphRoles || {}) };
    const morphEntries = Object.entries(runtime.mesh.morphTargetDictionary || {}).sort((a, b) => a[1] - b[1]);
    const roles = ["blinkLeft", "blinkRight", "eyeWideLeft", "eyeWideRight", "eyeSquintLeft", "eyeSquintRight", "pupilLarge", "pupilSmall", "irisLarge", "irisSmall", "corneaLarge", "corneaSmall", "eyeHighlightOn", "eyeHighlightOff"];
    for (const role of roles) {
      const row = document.createElement("div"); row.className = "face-map"; row.style.gridTemplateColumns = "minmax(0,1fr) minmax(0,1.5fr)";
      const label = document.createElement("span"); label.textContent = role;
      const select = document.createElement("select"); select.className = "face-file";
      const automatic = document.createElement("option"); automatic.value = ""; automatic.textContent = `Auto → ${runtime.profile.morphs[role]?.[0]?.targetMorphName || "not found"}`; select.appendChild(automatic);
      const disabled = document.createElement("option"); disabled.value = "-1"; disabled.textContent = "Disabled / no morph"; select.appendChild(disabled);
      for (const [name, index] of morphEntries) { const option = document.createElement("option"); option.value = String(index); option.textContent = `${name} (#${index})`; select.appendChild(option); }
      if (Object.prototype.hasOwnProperty.call(manualMorphs, role)) {
        const value = Array.isArray(manualMorphs[role]) ? manualMorphs[role][0] : manualMorphs[role];
        select.value = value === undefined ? "-1" : String(typeof value === "object" ? value.index : value);
      }
      select.addEventListener("change", () => { if (select.value === "") delete manualMorphs[role]; else if (select.value === "-1") manualMorphs[role] = []; else manualMorphs[role] = [Number(select.value)]; });
      row.append(label, select); content.appendChild(row);
    }
    const save = button("Save Eye Morph Mapping"); save.addEventListener("click", () => {
      if (system.setMappingOverrides(runtime.mesh, { ...cached, morphRoles: manualMorphs })) { clearError?.(); render(); }
      else showError?.("Could not save eye morph mapping.");
    }); content.appendChild(save);
  }

  function morphState(runtime) {
    let state = morphSelections.get(runtime.profile.fingerprint);
    if (!state) {
      state = { eyes: -1, mouth: -1, brow: -1, other: -1 };
      morphSelections.set(runtime.profile.fingerprint, state);
    }
    return state;
  }

  function bindMorphSearch(input) {
    input.addEventListener("input", () => {
      const cursor = input.selectionStart ?? input.value.length;
      morphQuery = input.value;
      render();
      queueMicrotask(() => {
        const next = content.querySelector('.morph-toolbar input[type="search"]');
        next?.focus();
        next?.setSelectionRange?.(cursor, cursor);
      });
    });
  }

  function morphCandidates(runtime, category) {
    const list = runtime.morphRegistry.visible(category);
    if (!morphQuery.trim()) return list;
    const matches = new Set(runtime.morphRegistry.search(morphQuery, { category }).map((record) => record.index));
    return list.filter((record) => matches.has(record.index));
  }

  function selectMorph(runtime, category, index) {
    morphState(runtime)[category] = Number(index);
  }

  function selectedMorph(runtime, category, candidates) {
    const state = morphState(runtime);
    let record = runtime.morphRegistry.get(state[category]);
    if (!record || record.category !== category || record.isHidden || record.isSystem || (morphQuery && !candidates.some((item) => item.index === record.index))) {
      record = candidates[0] || runtime.morphRegistry.visible(category)[0] || null;
      state[category] = record?.index ?? -1;
    }
    return record;
  }

  function setRawMorph(runtime, record, value) {
    if (!record?.runtimeSupported || record.targetInfluenceIndex < 0) {
      showError?.(runtime.morphRegistry.label(record) + " is metadata-only: the current renderer does not evaluate " + (record?.typeName || "this") + " morphs.");
      return false;
    }
    runtime.manualCorrections.setMorph(record.targetInfluenceIndex, value);
    clearError?.();
    return true;
  }

  function morphDrivers(runtime, record) {
    const drivers = [];
    if (runtime.timeline.isMorphAnimated(record.index)) drivers.push("Raw timeline");
    if (Math.abs(runtime.manualCorrections.morphs[record.targetInfluenceIndex] || 0) > 1e-6) drivers.push("Manual raw");
    const roles = [];
    for (const [role, mappings] of Object.entries(runtime.profile.morphs || {})) {
      if (mappings.some((mapping) => mapping.targetMorphIndex === record.targetInfluenceIndex)) roles.push(role);
    }
    if (roles.length) drivers.push("Semantic: " + roles.slice(0, 3).join(", "));
    if (Math.abs(runtime.morphRegistry.currentValue(record.index)) > 1e-6) drivers.push("Evaluated/VMD");
    return drivers.length ? drivers.join(" · ") : "No active driver";
  }

  function renderMorphCard(runtime, category) {
    const registry = runtime.morphRegistry;
    const candidates = morphCandidates(runtime, category);
    const all = registry.visible(category);
    const card = document.createElement("section"); card.className = "morph-card";
    const head = document.createElement("div"); head.className = "morph-card-head";
    const badge = document.createElement("span"); badge.className = "morph-badge"; badge.textContent = all.length + " morphs";
    head.append(document.createTextNode(pretty(category)), badge); card.appendChild(head);
    if (!all.length || !candidates.length) {
      const empty = document.createElement("div"); empty.className = "face-status";
      empty.textContent = all.length ? "No morph matches the current search." : "No model morphs in this category.";
      card.appendChild(empty); return card;
    }
    let record = selectedMorph(runtime, category, candidates);
    const nav = document.createElement("div"); nav.className = "morph-nav";
    const previous = button("‹"), next = button("›"), select = document.createElement("select"); select.className = "face-file";
    for (const candidate of candidates) {
      const option = document.createElement("option"); option.value = String(candidate.index); option.textContent = registry.label(candidate); select.appendChild(option);
    }
    select.value = String(record.index);
    const move = (step) => {
      const at = candidates.findIndex((candidate) => candidate.index === record.index);
      record = candidates[(at + step + candidates.length) % candidates.length];
      selectMorph(runtime, category, record.index); render();
    };
    previous.addEventListener("click", () => move(-1)); next.addEventListener("click", () => move(1));
    select.addEventListener("change", () => { selectMorph(runtime, category, Number(select.value)); render(); });
    nav.append(previous, select, next); card.appendChild(nav);

    const name = document.createElement("div"); name.className = "morph-name";
    name.appendChild(document.createTextNode(record.originalName || "Unnamed Morph"));
    const secondary = document.createElement("small");
    secondary.textContent = [record.displayLabel || record.englishName, record.typeName + " #" + record.index].filter(Boolean).join(" · ");
    name.appendChild(secondary); card.appendChild(name);

    const correction = Number(runtime.manualCorrections.morphs[record.targetInfluenceIndex]) || 0;
    const control = slider("Raw contribution", correction, record.minValue, record.maxValue, 0.01, (value) => setRawMorph(runtime, record, value));
    if (!record.runtimeSupported) for (const input of control.querySelectorAll("input")) input.disabled = true;
    card.appendChild(control);
    const detail = document.createElement("div"); detail.className = "morph-detail";
    detail.textContent = "final " + registry.currentValue(record.index).toFixed(3) + " · " + Math.round(record.confidence * 100) + "% " + record.categorySource + " · " + (record.exportCompatible ? "VMD" : "not exportable") + " · " + morphDrivers(runtime, record);
    card.appendChild(detail);

    const actions = document.createElement("div"); actions.className = "morph-actions";
    const reset = button("Reset"), key = button(runtime.timeline.isMorphAnimated(record.index) ? "Key ✓" : "Register Key"), favorite = button(record.favorite ? "★ Favorite" : "☆ Favorite");
    favorite.classList.toggle("active", record.favorite);
    reset.addEventListener("click", () => { runtime.timeline.checkpoint(); setRawMorph(runtime, record, 0); render(); });
    key.addEventListener("click", () => {
      if (!runtime.timeline.keyMorph(record.index, correction)) showError?.("This morph cannot be keyed because the current renderer does not support it.");
      else { clearError?.(); render(); }
    });
    favorite.addEventListener("click", () => runtime.morphRegistry.setFavorite(record.index, !record.favorite));
    actions.append(reset, key, favorite); card.appendChild(actions);

    if (morphMode === "pro") {
      const assignment = document.createElement("select"); assignment.className = "face-file"; assignment.style.marginTop = "5px";
      for (const value of ["eyes", "mouth", "brow", "other", "hidden", "system"]) {
        const option = document.createElement("option"); option.value = value; option.textContent = "Category: " + pretty(value); assignment.appendChild(option);
      }
      assignment.value = record.category;
      assignment.addEventListener("change", () => runtime.morphRegistry.setCategory(record.index, assignment.value));
      card.appendChild(assignment);
      const labelInput = document.createElement("input"); labelInput.className = "face-file"; labelInput.style.marginTop = "5px";
      labelInput.placeholder = "Optional friendly UI label"; labelInput.value = record.displayLabel || "";
      labelInput.addEventListener("change", () => runtime.morphRegistry.setLabel(record.index, labelInput.value));
      card.appendChild(labelInput);
      if (record.isGroup) {
        const group = document.createElement("div"); group.className = "morph-group";
        for (const child of registry.groupChildren(record.index)) {
          const row = document.createElement("div");
          row.append(document.createTextNode(registry.label(child.record)), document.createTextNode("× " + child.ratio.toFixed(2)));
          group.appendChild(row);
        }
        card.appendChild(group);
      }
      if (record.warnings.length) {
        const warning = document.createElement("div"); warning.className = "morph-warning"; warning.textContent = record.warnings.join(" "); card.appendChild(warning);
      }
    }
    return card;
  }

  function renderMorphBrowser(runtime) {
    const diagnostics = runtime.morphRegistry.diagnostics();
    const toolbar = document.createElement("div"); toolbar.className = "morph-toolbar";
    const search = document.createElement("input"); search.className = "face-file"; search.type = "search"; search.placeholder = "Search Japanese, English or semantic tags…"; search.value = morphQuery;
    bindMorphSearch(search);
    const mode = document.createElement("div"); mode.className = "morph-mode";
    for (const value of ["basic", "pro"]) {
      const el = button(pretty(value)); el.classList.toggle("active", morphMode === value);
      el.addEventListener("click", () => { morphMode = value; render(); }); mode.appendChild(el);
    }
    toolbar.append(search, mode); content.appendChild(toolbar);
    const status = document.createElement("div"); status.className = "face-status";
    status.textContent = diagnostics.count + " model morphs · " + diagnostics.supported + " runtime-supported · " + diagnostics.exportable + " VMD targets";
    content.appendChild(status);
    const grid = document.createElement("div"); grid.className = "morph-category-grid";
    for (const category of ["eyes", "mouth", "brow", "other"]) grid.appendChild(renderMorphCard(runtime, category));
    content.appendChild(grid);
    const favorites = runtime.morphRegistry.favorites();
    if (favorites.length) {
      content.appendChild(subtitle("Favorites"));
      const favoriteGrid = document.createElement("div"); favoriteGrid.className = "face-preset-grid";
      for (const record of favorites) {
        const el = button(runtime.morphRegistry.label(record));
        el.addEventListener("click", () => { morphQuery = ""; selectMorph(runtime, record.category, record.index); render(); });
        favoriteGrid.appendChild(el);
      }
      content.appendChild(favoriteGrid);
    }
  }

  function renderAllMorphs(runtime) {
    const registry = runtime.morphRegistry, animated = runtime.timeline.animatedMorphIndices();
    const toolbar = document.createElement("div"); toolbar.className = "morph-toolbar";
    const search = document.createElement("input"); search.className = "face-file"; search.type = "search"; search.placeholder = "Search all morphs…"; search.value = morphQuery;
    bindMorphSearch(search); toolbar.appendChild(search); content.appendChild(toolbar);
    const filters = document.createElement("div"); filters.className = "morph-filter-grid";
    const category = document.createElement("select"); category.className = "face-file";
    for (const value of ["", "eyes", "mouth", "brow", "other"]) { const option = document.createElement("option"); option.value = value; option.textContent = value ? pretty(value) : "All categories"; category.appendChild(option); }
    const type = document.createElement("select"); type.className = "face-file";
    for (const value of ["", "group", "vertex", "bone", "material", "uv", "additional-uv1", "additional-uv2", "additional-uv3", "additional-uv4", "flip", "impulse"]) { const option = document.createElement("option"); option.value = value; option.textContent = value ? pretty(value) : "All types"; type.appendChild(option); }
    const special = document.createElement("select"); special.className = "face-file";
    for (const item of [["", "All states"], ["favorites", "Favorites"], ["active", "Active only"], ["animated", "Animated only"], ["unknown", "Unknown"], ["nonExportable", "Non-exportable"]]) {
      const option = document.createElement("option"); option.value = item[0]; option.textContent = item[1]; special.appendChild(option);
    }
    filters.append(category, type, special); content.appendChild(filters);
    const wrap = document.createElement("div"); wrap.className = "morph-table-wrap";
    const table = document.createElement("table"); table.className = "morph-table"; table.innerHTML = "<thead><tr><th>★</th><th>Name</th><th>Category</th><th>Type</th><th>Value</th><th>State</th><th>VMD</th><th>Confidence</th></tr></thead>";
    const tbody = document.createElement("tbody"); table.appendChild(tbody); wrap.appendChild(table); content.appendChild(wrap);
    const draw = () => {
      tbody.replaceChildren();
      const matches = registry.search(morphQuery, {
        category: category.value || null, type: type.value || null,
        favorites: special.value === "favorites", active: special.value === "active",
        animated: special.value === "animated" ? animated : null,
        unknown: special.value === "unknown", nonExportable: special.value === "nonExportable", includeSystem: true,
      });
      const limit = Math.min(matches.length, 180);
      for (let i = 0; i < limit; i++) {
        const record = matches[i], tr = document.createElement("tr");
        tr.classList.toggle("active", Math.abs(registry.currentValue(record.index)) > 1e-6);
        const starCell = document.createElement("td"), star = button(record.favorite ? "★" : "☆");
        star.addEventListener("click", () => runtime.morphRegistry.setFavorite(record.index, !record.favorite)); starCell.appendChild(star);
        const name = document.createElement("td"); name.textContent = registry.label(record);
        const values = [record.category, record.typeName, registry.currentValue(record.index).toFixed(3), (runtime.timeline.isMorphAnimated(record.index) ? "animated · " : "") + (record.runtimeSupported ? "supported" : "metadata only"), record.exportCompatible ? "yes" : "no", Math.round(record.confidence * 100) + "%"];
        tr.append(starCell, name);
        for (const value of values) tr.appendChild(Object.assign(document.createElement("td"), { textContent: value }));
        tr.addEventListener("dblclick", () => {
          if (["eyes", "mouth", "brow", "other"].includes(record.category)) { selectMorph(runtime, record.category, record.index); active = "Facial Morphs"; render(); }
        });
        tbody.appendChild(tr);
      }
      if (matches.length > limit) {
        const tr = document.createElement("tr"), td = document.createElement("td"); td.colSpan = 8; td.className = "face-status"; td.textContent = "Showing " + limit + " of " + matches.length + ". Refine the search to inspect more."; tr.appendChild(td); tbody.appendChild(tr);
      }
    };
    category.addEventListener("change", draw); type.addEventListener("change", draw); special.addEventListener("change", draw); draw();
  }

  function renderAdvanced(runtime) {
    content.appendChild(subtitle("Semantic timeline"));
    const timeline = runtime.timeline, stats = timeline.stats();
    const status = document.createElement("div"); status.className = "face-status"; status.textContent = `${stats.keys} keys / ${stats.channels} channels · Face Auto-key ${timeline.faceAutoKeyEnabled() ? "ON" : "OFF"}`; content.appendChild(status);
    const grid = document.createElement("div"); grid.className = "face-grid";
    for (const [label, action] of [
      ["Key Face", () => timeline.keyFace()], ["Key Emotion", () => timeline.keyEmotion()],
      ["Key Gaze", () => timeline.keyGaze()], ["Key Eyes", () => timeline.keyEyeAppearance()], ["Key Micro", () => timeline.keyMicro()],
      ["Delete at Time", () => timeline.deleteAtPlayhead()], ["Copy", () => timeline.copyAtPlayhead()],
      ["Paste", () => timeline.pasteAtPlayhead()], ["Undo", () => timeline.undo()], ["Redo", () => timeline.redo()],
    ]) { const el = button(label); el.addEventListener("click", () => { action(); render(); }); grid.appendChild(el); }
    const bakeAll = button("Bake Full Performance"); bakeAll.addEventListener("click", () => { if (system.bakeActivePerformance(`Baked Performance ${new Date().toLocaleTimeString()}`)) clearError?.(); else showError?.("No performance channels are available to bake."); }); grid.appendChild(bakeAll);
    const exportVmd = button("Export .VMD"); exportVmd.addEventListener("click", () => downloadVmd(system, showError, clearError)); grid.appendChild(exportVmd);
    content.appendChild(grid);
    const report = runtime.baker.morphExportReport();
    const exportStatus = document.createElement("div"); exportStatus.className = "face-status";
    exportStatus.textContent = "Morph Export Report · Native " + report.nativeModelMorphs + " · Animated raw " + report.animatedRawMorphs + " · Semantic " + report.semanticChannelsBaked + " · Missing " + report.missingVmdTargets + " · Procedural-only " + report.proceduralOnlyControls;
    content.appendChild(exportStatus);
    content.appendChild(subtitle("Layer controls"));
    const relevant = ["facialBase", "emotion", "speech", "eyeAppearance", "gaze", "blink", "microExpression", "capture", "manualCorrection"];
    for (const id of relevant) {
      const layer = runtime.stack.get(id), row = document.createElement("div"); row.className = "performance-layer-row";
      row.append(check(layer.label, layer.enabled, (value) => layer.setEnabled(value)), check("Mute", layer.muted, (value) => layer.setMuted(value)), check("Solo", layer.solo, (value) => layer.setSolo(value)), slider(`${layer.label} Weight`, layer.weight, 0, 1, 0.01, (value) => layer.setWeight(value)));
      const blend = document.createElement("select"); blend.className = "face-file"; for (const mode of ["additive", "override", "maximum", "multiply"]) { const option = document.createElement("option"); option.value = mode; option.textContent = `${pretty(mode)} blend`; blend.appendChild(option); } blend.value = layer.blendMode; blend.addEventListener("change", () => layer.blendMode = blend.value); row.appendChild(blend); content.appendChild(row);
    }
    content.appendChild(subtitle("Raw PMX morph corrections"));
    const rawNote = document.createElement("div"); rawNote.className = "face-status"; rawNote.textContent = "These values are evaluated last and preserve the imported VMD morph animation underneath."; content.appendChild(rawNote);
    const mode = document.createElement("select"); mode.className = "face-file"; for (const value of ["additive", "override"]) { const option = document.createElement("option"); option.value = value; option.textContent = pretty(value); mode.appendChild(option); } mode.value = runtime.manualCorrections.mode; mode.addEventListener("change", () => runtime.manualCorrections.mode = mode.value); content.appendChild(mode);
    const morphList = document.createElement("div"); morphList.style.cssText = "max-height:300px;overflow:auto;margin-top:6px;padding-right:3px";
    for (const record of runtime.morphRegistry.visible()) morphList.appendChild(slider(runtime.morphRegistry.label(record), runtime.manualCorrections.morphs[record.targetInfluenceIndex] || 0, -1, Math.max(1, record.maxValue), 0.01, (value) => { runtime.manualCorrections.setMorph(record.targetInfluenceIndex, value); }));
    content.appendChild(morphList);
    const resetRaw = button("Reset Raw Morph Corrections"); resetRaw.addEventListener("click", () => { runtime.timeline.checkpoint(); runtime.manualCorrections.resetMorphs(); render(); }); content.appendChild(resetRaw);
  }

  function render() {
    for (const [name, el] of buttons) el.classList.toggle("active", name === active);
    content.replaceChildren(); const runtime = getRuntime();
    if (!runtime) { const empty = document.createElement("div"); empty.className = "face-status"; empty.textContent = "Load and select a PMX/PMD character to map its face."; content.appendChild(empty); return; }
    if (active === "Expressions") renderExpressions(runtime); else if (active === "Facial Morphs") renderMorphBrowser(runtime); else if (active === "All Morphs") renderAllMorphs(runtime); else if (active === "Director") renderDirector(runtime); else if (active === "Face Controls") renderFaceControls(runtime); else if (active === "Emotion Pad") renderEmotion(runtime); else if (active === "Eyes & Gaze") renderGaze(runtime); else if (active === "Blink") renderBlink(runtime); else if (active === "Lip Sync") renderLipSync(runtime); else if (active === "Capture") renderCapture(runtime); else if (active === "Micro Motion") renderMicro(runtime); else if (active === "Mapping") renderMapping(runtime); else renderAdvanced(runtime);
  }

  system.onChange((reason) => { if (["attached", "detached", "mapping-changed", "morph-registry-changed"].includes(reason)) render(); });
  const hand = document.getElementById("performanceStudio"); if (hand?.parentElement === body) hand.insertAdjacentElement("afterend", shell); else body.insertBefore(shell, body.firstChild);
  render(); return { shell, refresh: render };
}
