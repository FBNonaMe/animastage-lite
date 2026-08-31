import { SMART_POSE_CONTROLLER_DEFS } from "./SmartPosePresets.js?v=sp15";

function injectStyles() {
  if (document.getElementById("smartPoseStyles")) return;
  const style = document.createElement("style");
  style.id = "smartPoseStyles";
  style.textContent = `
    .smart-pose-shell { border: 1px solid #343052; background: #12101d; border-radius: 8px; padding: 8px; margin-bottom: 10px; }
    .smart-pose-mode { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
    .smart-pose-mode .btn.active { border-color: #b9a8ff; color: #fff; background: #31285a; }
    .smart-pose-panel { display: none; border-top: 1px solid #2a2740; padding-top: 8px; }
    .smart-pose-shell.smart-active .smart-pose-panel { display: block; }
    .smart-pose-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .smart-pose-wide { grid-column: 1 / -1; }
    .smart-pose-small { font-size: 11px; color: #aaa3c8; margin: 6px 0 4px; }
    .smart-pose-row { display: grid; grid-template-columns: 1fr 88px; gap: 6px; align-items: center; margin: 6px 0; }
    .smart-pose-row input[type="range"] { width: 100%; }
  `;
  document.head.appendChild(style);
}

function button(label, title = "") {
  const el = document.createElement("button");
  el.className = "btn";
  el.type = "button";
  el.textContent = label;
  if (title) el.title = title;
  return el;
}

function checkbox(label, checked, onChange, title = "") {
  const row = document.createElement("label");
  row.className = "check-row";
  if (title) row.title = title;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.addEventListener("change", () => onChange(input.checked));
  row.appendChild(input);
  row.appendChild(document.createTextNode(` ${label}`));
  return row;
}

function slider(label, value, min, max, step, onChange) {
  const row = document.createElement("div");
  row.className = "smart-pose-row";
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const out = document.createElement("input");
  out.className = "val";
  out.value = Number(value).toFixed(2);
  input.addEventListener("input", () => {
    const n = Number(input.value);
    out.value = n.toFixed(2);
    onChange(n);
  });
  out.addEventListener("change", () => {
    const n = Math.min(max, Math.max(min, Number(out.value)));
    input.value = String(n);
    out.value = n.toFixed(2);
    onChange(n);
  });
  const wrap = document.createElement("div");
  const lab = document.createElement("label");
  lab.className = "lbl";
  lab.textContent = label;
  wrap.appendChild(lab);
  wrap.appendChild(input);
  row.appendChild(wrap);
  row.appendChild(out);
  return row;
}

export function mountSmartPoseUI({
  controller,
  cBoneEdit,
  setClassicEnabled,
  refreshAttach,
  showError,
  clearError,
}) {
  injectStyles();
  const classicToggle = cBoneEdit || document.getElementById("cBoneEdit");
  const body = classicToggle?.closest(".body");
  if (!body || document.getElementById("smartPoseShell")) return null;

  const shell = document.createElement("div");
  shell.id = "smartPoseShell";
  shell.className = "smart-pose-shell";

  const mode = document.createElement("div");
  mode.className = "smart-pose-mode";
  const classicBtn = button("Classic Bones", "Use the existing bone editor");
  const smartBtn = button("Smart Pose", "Use high-level IK controllers");
  mode.appendChild(classicBtn);
  mode.appendChild(smartBtn);
  shell.appendChild(mode);

  const panel = document.createElement("div");
  panel.className = "smart-pose-panel";

  const quick = document.createElement("div");
  quick.className = "smart-pose-grid";
  quick.appendChild(checkbox("Full Body IK", controller.settings.fullBodyIK, (v) => controller.setSetting("fullBodyIK", v)));
  quick.appendChild(checkbox("Foot Lock", controller.settings.footLock, (v) => controller.setSetting("footLock", v)));
  quick.appendChild(checkbox("Grounding", controller.settings.grounding, (v) => controller.setSetting("grounding", v)));
  quick.appendChild(checkbox("Collision Avoidance", controller.settings.collisionAvoidance, (v) => controller.setSetting("collisionAvoidance", v)));
  quick.appendChild(checkbox("Auto Shoulder", controller.settings.autoShoulder, (v) => controller.setSetting("autoShoulder", v)));
  quick.appendChild(checkbox("Auto Pelvis", controller.settings.autoPelvis, (v) => controller.setSetting("autoPelvis", v)));
  quick.appendChild(checkbox("Auto Key", controller.settings.autoKey, (v) => controller.setSetting("autoKey", v)));
  quick.appendChild(checkbox(
    "Physics During Playback",
    controller.settings.playbackPhysics,
    (v) => controller.setSetting("playbackPhysics", v),
    "Enable Reze physics for hair, clothes and accessories only while the animation is playing",
  ));
  panel.appendChild(quick);

  const ctrlTitle = document.createElement("div");
  ctrlTitle.className = "smart-pose-small";
  ctrlTitle.textContent = "Controllers";
  panel.appendChild(ctrlTitle);

  const ctrls = document.createElement("div");
  ctrls.className = "smart-pose-grid";
  for (const def of SMART_POSE_CONTROLLER_DEFS) {
    if (def.id.includes("Pole")) continue;
    const b = button(def.label);
    b.dataset.smartController = def.id;
    b.addEventListener("click", () => controller.selectController(def.id));
    ctrls.appendChild(b);
  }
  panel.appendChild(ctrls);

  const poleTitle = document.createElement("div");
  poleTitle.className = "smart-pose-small";
  poleTitle.textContent = "Pole Targets";
  panel.appendChild(poleTitle);
  const poles = document.createElement("div");
  poles.className = "smart-pose-grid";
  for (const def of SMART_POSE_CONTROLLER_DEFS.filter((d) => d.id.includes("Pole"))) {
    const b = button(def.label.replace(" Pole", ""));
    b.addEventListener("click", () => controller.selectController(def.id));
    poles.appendChild(b);
  }
  panel.appendChild(poles);

  const transformTitle = document.createElement("div");
  transformTitle.className = "smart-pose-small";
  transformTitle.textContent = "Transform";
  panel.appendChild(transformTitle);
  const tools = document.createElement("div");
  tools.className = "smart-pose-grid";
  const moveBtn = button("Move");
  const rotBtn = button("Rotate");
  const worldBtn = button("World");
  const localBtn = button("Local");
  moveBtn.addEventListener("click", () => controller.setTransformMode("translate"));
  rotBtn.addEventListener("click", () => controller.setTransformMode("rotate"));
  worldBtn.addEventListener("click", () => controller.setSpace("world"));
  localBtn.addEventListener("click", () => controller.setSpace("local"));
  tools.append(moveBtn, rotBtn, worldBtn, localBtn);
  panel.appendChild(tools);

  panel.appendChild(slider("IK Strength", controller.settings.ikStrength, 0, 1, 0.01, (v) => controller.setSetting("ikStrength", v)));
  panel.appendChild(slider("Body Influence", controller.settings.bodyInfluence, 0, 1, 0.01, (v) => controller.setSetting("bodyInfluence", v)));
  panel.appendChild(slider("Stretch Limit", controller.settings.stretchLimit, 0.5, 1.25, 0.01, (v) => controller.setSetting("stretchLimit", v)));

  const toolTitle = document.createElement("div");
  toolTitle.className = "smart-pose-small";
  toolTitle.textContent = "Pose Tools";
  panel.appendChild(toolTitle);
  const poseTools = document.createElement("div");
  poseTools.className = "smart-pose-grid";
  const reset = button("Reset", "Reset to rest pose");
  const mirror = button("Mirror", "Mirror left/right pose where a mirror map exists");
  const copy = button("Copy", "Copy current pose");
  const paste = button("Paste", "Paste copied pose");
  const save = button("Save Preset", "Save one local pose preset for this model");
  const load = button("Load Preset", "Load the saved pose preset for this model");
  const clear = button("Clear Layer", "Reset Smart Pose controller offsets");
  const bake = button("Bake to Keys", "Bake current solved pose to normal bone keys");
  reset.addEventListener("click", () => controller.resetPose());
  mirror.addEventListener("click", () => {
    if (!controller.mirrorPose()) showError?.("Smart Pose mirror needs detected left/right bone pairs.");
  });
  copy.addEventListener("click", () => controller.copyPose());
  paste.addEventListener("click", () => controller.pastePose());
  save.addEventListener("click", () => controller.savePosePreset());
  load.addEventListener("click", () => controller.loadPosePreset());
  clear.addEventListener("click", () => controller.clearLayer());
  bake.addEventListener("click", () => {
    if (controller.bakeToBoneKeys()) clearError?.();
    else showError?.("Smart Pose bake failed: load a model and enable the timeline bridge first.");
  });
  poseTools.append(reset, mirror, copy, paste, save, load, clear, bake);
  panel.appendChild(poseTools);

  shell.appendChild(panel);
  body.insertBefore(shell, body.firstChild);

  function setMode(smart) {
    if (smart) {
      if (classicToggle) classicToggle.checked = false;
      setClassicEnabled?.(false);
      controller.setEnabled(true);
    } else {
      controller.setEnabled(false);
      if (classicToggle) classicToggle.checked = true;
      setClassicEnabled?.(true);
    }
    shell.classList.toggle("smart-active", smart);
    classicBtn.classList.toggle("active", !smart);
    smartBtn.classList.toggle("active", smart);
    refreshAttach?.();
  }

  classicBtn.addEventListener("click", () => setMode(false));
  smartBtn.addEventListener("click", () => setMode(true));
  classicToggle?.addEventListener("change", () => {
    if (classicToggle.checked) setMode(false);
  });

  controller.onChange(() => {
    const smart = controller.isEnabled();
    shell.classList.toggle("smart-active", smart);
    classicBtn.classList.toggle("active", !smart);
    smartBtn.classList.toggle("active", smart);
    for (const btn of shell.querySelectorAll("[data-smart-controller]")) {
      btn.classList.toggle("active", btn.dataset.smartController === controller.selectedId);
    }
  });

  const initialSmart = controller.isEnabled();
  shell.classList.toggle("smart-active", initialSmart);
  classicBtn.classList.toggle("active", !initialSmart);
  smartBtn.classList.toggle("active", initialSmart);
  return { shell, setMode };
}
