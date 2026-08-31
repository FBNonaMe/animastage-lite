/**
 * Runtime-only performance state used by deterministic offline exports.
 *
 * Project serialization is deliberately not used here: toJSON()/restore()
 * resets procedural clocks and omits frame-local binding/filter buffers.  This
 * module snapshots those opaque buffers by value while preserving scene-object
 * references (Auto Grip target, runtime identity) by identity.
 */

export const PERFORMANCE_TRANSIENT_STATE_VERSION = 1;

function copyArray(value) {
  return value ? Array.from(value) : [];
}

function restoreArray(target, value) {
  if (!target?.fill || !value) return;
  target.fill(0);
  target.set(value.slice?.(0, target.length) || value);
}

function clonePlain(value) {
  if (value == null) return value;
  try { return JSON.parse(JSON.stringify(value)); }
  catch { return value; }
}

function captureHandBindings(hands) {
  return {
    eventSuppression: hands?._eventSuppression || 0,
    bindings: (hands?.bindings || []).map((binding) => ({
      base: binding.base.toArray(),
      applied: binding.applied.toArray(),
      hasLast: binding.hasLast,
    })),
  };
}

function restoreHandBindings(hands, state) {
  if (!hands || !state) return;
  hands._eventSuppression = Math.max(0, Number(state.eventSuppression) || 0);
  for (let index = 0; index < hands.bindings.length; index++) {
    const binding = hands.bindings[index], saved = state.bindings?.[index];
    if (!saved) continue;
    if (saved.base) binding.base.fromArray(saved.base);
    if (saved.applied) binding.applied.fromArray(saved.applied);
    binding.hasLast = !!saved.hasLast;
  }
}

function captureFacialRig(rig) {
  return {
    base: copyArray(rig?.base),
    work: copyArray(rig?.work),
    applied: copyArray(rig?.applied),
    wasApplied: copyArray(rig?.wasApplied),
    prepared: !!rig?.prepared,
  };
}

function restoreFacialRig(rig, state) {
  if (!rig || !state) return;
  restoreArray(rig.base, state.base);
  restoreArray(rig.work, state.work);
  restoreArray(rig.applied, state.applied);
  restoreArray(rig.wasApplied, state.wasApplied);
  rig.prepared = !!state.prepared;
}

function captureEyeAppearance(controller) {
  return {
    evaluated: clonePlain(controller?.evaluated),
    coefficients: copyArray(controller?.coefficients),
    boneBindings: (controller?.boneBindings || []).map((binding) => ({
      base: binding.base.toArray(),
      applied: binding.applied.toArray(),
      hasLast: binding.hasLast,
    })),
    materialBindings: (controller?.materialBindings || []).map((binding) => ({
      baseColor: binding.baseColor.toArray(),
      appliedColor: binding.appliedColor.toArray(),
      resultColor: binding.resultColor.toArray(),
      baseEmissive: binding.baseEmissive?.toArray() || null,
      appliedEmissive: binding.appliedEmissive?.toArray() || null,
      resultEmissive: binding.resultEmissive?.toArray() || null,
      baseRoughness: binding.baseRoughness,
      appliedRoughness: binding.appliedRoughness,
      hasLast: binding.hasLast,
    })),
  };
}

function restoreEyeAppearance(controller, state) {
  if (!controller || !state) return;
  if (state.evaluated) controller.evaluated = clonePlain(state.evaluated);
  restoreArray(controller.coefficients, state.coefficients);
  for (let index = 0; index < controller.boneBindings.length; index++) {
    const binding = controller.boneBindings[index], saved = state.boneBindings?.[index];
    if (!saved) continue;
    binding.base.fromArray(saved.base);
    binding.applied.fromArray(saved.applied);
    binding.hasLast = !!saved.hasLast;
  }
  for (let index = 0; index < controller.materialBindings.length; index++) {
    const binding = controller.materialBindings[index], saved = state.materialBindings?.[index];
    if (!saved) continue;
    binding.baseColor.fromArray(saved.baseColor);
    binding.appliedColor.fromArray(saved.appliedColor);
    binding.resultColor.fromArray(saved.resultColor);
    if (binding.baseEmissive && saved.baseEmissive) binding.baseEmissive.fromArray(saved.baseEmissive);
    if (binding.appliedEmissive && saved.appliedEmissive) binding.appliedEmissive.fromArray(saved.appliedEmissive);
    if (binding.resultEmissive && saved.resultEmissive) binding.resultEmissive.fromArray(saved.resultEmissive);
    binding.baseRoughness = saved.baseRoughness;
    binding.appliedRoughness = saved.appliedRoughness;
    binding.hasLast = !!saved.hasLast;
  }
}

function captureAutoGrip(solver) {
  return {
    target: solver?.target || null,
    side: solver?.side,
    gripType: solver?.gripType,
    autoAttach: !!solver?.autoAttach,
    attached: !!solver?.attached,
    followTarget: !!solver?.followTarget,
    maintainGrip: !!solver?.maintainGrip,
    contacts: clonePlain(solver?.contacts || []),
    lastResult: clonePlain(solver?.lastResult),
    pendingTargetId: solver?.pendingTargetId ?? null,
    pendingMaintain: !!solver?.pendingMaintain,
    pendingAttach: !!solver?.pendingAttach,
    localWrist: solver?._localWrist?.toArray() || [0, 0, 0],
    localQuaternion: solver?._localQ?.toArray() || [0, 0, 0, 1],
    lastTargetMatrix: copyArray(solver?._lastTargetMatrix),
    contactVisible: !!solver?.contactGroup?.visible,
    offlineSuspended: !!solver?._offlineSuspended,
  };
}

function restoreAutoGrip(solver, state) {
  if (!solver || !state) return;
  solver.target = state.target || null;
  solver.side = state.side === "right" ? "right" : "left";
  solver.gripType = state.gripType || "cylindrical";
  solver.autoAttach = !!state.autoAttach;
  solver.attached = !!state.attached;
  solver.followTarget = !!state.followTarget;
  solver.maintainGrip = !!state.maintainGrip;
  solver.contacts = clonePlain(state.contacts || []);
  solver.lastResult = clonePlain(state.lastResult);
  solver.pendingTargetId = state.pendingTargetId ?? null;
  solver.pendingMaintain = !!state.pendingMaintain;
  solver.pendingAttach = !!state.pendingAttach;
  solver._localWrist.fromArray(state.localWrist || [0, 0, 0]);
  solver._localQ.fromArray(state.localQuaternion || [0, 0, 0, 1]);
  restoreArray(solver._lastTargetMatrix, state.lastTargetMatrix);
  solver._offlineSuspended = !!state.offlineSuspended;
  solver._updateContactVisuals?.();
  if (solver.contactGroup) solver.contactGroup.visible = !!state.contactVisible;
}

export function captureCharacterPerformanceState(runtime) {
  if (!runtime || typeof runtime !== "object") return null;
  return {
    version: PERFORMANCE_TRANSIENT_STATE_VERSION,
    blink: runtime.blink.captureTransientState(),
    microExpressions: runtime.microExpressions.captureTransientState(),
    gaze: runtime.gaze.captureTransientState(),
    lipSync: runtime.lipSync.captureTransientState(),
    capture: runtime.capture.captureTransientState(),
    autoGrip: captureAutoGrip(runtime.autoGrip),
    hands: captureHandBindings(runtime.hands),
    facialRig: captureFacialRig(runtime.facialRig),
    eyeAppearance: captureEyeAppearance(runtime.eyeAppearance),
  };
}

export function restoreCharacterPerformanceState(runtime, state) {
  if (!runtime || !state || state.version !== PERFORMANCE_TRANSIENT_STATE_VERSION) return false;
  restoreHandBindings(runtime.hands, state.hands);
  restoreFacialRig(runtime.facialRig, state.facialRig);
  restoreEyeAppearance(runtime.eyeAppearance, state.eyeAppearance);
  runtime.blink.restoreTransientState(state.blink);
  runtime.microExpressions.restoreTransientState(state.microExpressions);
  runtime.gaze.restoreTransientState(state.gaze);
  runtime.lipSync.restoreTransientState(state.lipSync);
  runtime.capture.restoreTransientState(state.capture);
  restoreAutoGrip(runtime.autoGrip, state.autoGrip);
  return true;
}

export function resetCharacterPerformanceForOffline(runtime) {
  if (!runtime) return false;
  runtime.blink.resetTransientState();
  runtime.microExpressions.resetTransientState();
  runtime.gaze.resetTransientState();
  runtime.lipSync.resetTransientState();
  runtime.capture.resetTransientState();
  // Do not detach/reparent the prop. The flag is a side-effect fence in case a
  // future frame path forgets updateAutoGrip:false.
  runtime.autoGrip._offlineSuspended = true;
  return true;
}
