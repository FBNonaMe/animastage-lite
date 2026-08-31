export const FACIAL_CHANNELS = Object.freeze([
  "eyeBlinkLeft", "eyeBlinkRight", "eyeWideLeft", "eyeWideRight", "eyeSquintLeft", "eyeSquintRight",
  "eyeLookUpLeft", "eyeLookUpRight", "eyeLookDownLeft", "eyeLookDownRight",
  "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft", "eyeLookOutRight",
  "irisSizeLeft", "irisSizeRight", "pupilSizeLeft", "pupilSizeRight",
  "corneaRadiusLeft", "corneaRadiusRight", "eyeHighlightLeft", "eyeHighlightRight",
  "browInnerUp", "browOuterUpLeft", "browOuterUpRight", "browDownLeft", "browDownRight",
  "cheekPuff", "cheekSquintLeft", "cheekSquintRight", "noseSneerLeft", "noseSneerRight",
  "jawOpen", "jawForward", "jawLeft", "jawRight", "mouthClose", "mouthFunnel", "mouthPucker",
  "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight",
  "mouthDimpleLeft", "mouthDimpleRight", "mouthStretchLeft", "mouthStretchRight",
  "mouthPressLeft", "mouthPressRight", "mouthUpperUpLeft", "mouthUpperUpRight",
  "mouthLowerDownLeft", "mouthLowerDownRight", "mouthRollUpper", "mouthRollLower", "tongueOut",
  "visemeA", "visemeI", "visemeU", "visemeE", "visemeO", "visemeClosed",
]);

export const FACIAL_CHANNEL_INDEX = Object.freeze(Object.fromEntries(FACIAL_CHANNELS.map((name, index) => [name, index])));

export function createFacialBuffer() { return new Float32Array(FACIAL_CHANNELS.length); }

export function setFacialChannel(buffer, name, value) {
  const index = FACIAL_CHANNEL_INDEX[name];
  if (index === undefined) return false;
  buffer[index] = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  return true;
}

export function facialObjectToBuffer(source, target = createFacialBuffer()) {
  target.fill(0);
  for (const [name, value] of Object.entries(source || {})) setFacialChannel(target, name, value);
  return target;
}
