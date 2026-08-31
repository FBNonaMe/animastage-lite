// LegSolverOwnership.js — ported from MMD_modoki-main/src/editor/smart-pose/leg-solver-ownership.ts
// Decides which system OWNS the legs while Smart Pose is active:
//   "nativeMmdIk" — the model's own MMD leg IK chains stay active
//   "smartPoseIk" — Smart Pose two-bone IK drives the legs (native IK off)
//   "disabled"    — nobody solves the legs
// Exactly one owner at a time — two solvers fighting over the same chain is
// what makes joints snap and spin.

export function chooseDefaultLegSolverMode(availability) {
  if (availability?.hasNativeMmdIk) return "nativeMmdIk";
  if (availability?.hasCustomChain) return "smartPoseIk";
  return "disabled";
}

export function isLegSolverModeAvailable(mode, availability) {
  if (mode === "nativeMmdIk") return !!availability?.hasNativeMmdIk;
  if (mode === "smartPoseIk") return !!availability?.hasCustomChain;
  return true;
}

export function nativeIkEnabledForLegMode(mode) {
  return mode === "nativeMmdIk";
}
