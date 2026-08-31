export const PERFORMANCE_SYSTEM_VERSION = 1;
export const RIG_PROFILE_VERSION = 1;
export const MAPPING_CACHE_VERSION = 1;

export const PERFORMANCE_LAYER_ORDER = Object.freeze([
  "handPose",
  "fingerProcedural",
  "facialBase",
  "emotion",
  "speech",
  "eyeAppearance",
  "gaze",
  "blink",
  "microExpression",
  "capture",
  "manualCorrection",
]);

export const HAND_SIDES = Object.freeze(["left", "right"]);
export const FINGER_NAMES = Object.freeze(["thumb", "index", "middle", "ring", "little"]);
export const FINGER_JOINT_NAMES = Object.freeze(["proximal", "middle", "distal"]);

export const DEFAULT_MAPPING_CONFIDENCE = 0.52;

export function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function clampSigned(value) {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}
