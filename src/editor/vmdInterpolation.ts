/**
 * MMD VMD bone keyframe interpolation bytes (64-byte block).
 * Linear default is 20 per byte; bezier uses eased control points on rotation channel.
 */

export type VmdInterpMode = 'linear' | 'bezier';

/** Fill with MMD linear interpolation (constant 20). */
export function linearVmdInterpolation(): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.fill(20);
  return bytes;
}

/**
 * Approximate timeline bezier handles as MMD rotation-channel bezier bytes.
 * Position channels stay linear for simplified export bones.
 */
export function encodeVmdBoneInterpolation(
  mode: VmdInterpMode,
  easeOut = 0.33,
  easeIn = 0.33
): Uint8Array {
  const bytes = linearVmdInterpolation();
  if (mode !== 'bezier') return bytes;

  const out = Math.max(0, Math.min(127, Math.round(easeOut * 127)));
  const inn = Math.max(0, Math.min(127, Math.round(easeIn * 127)));

  // Rotation interpolation block — bytes 48..63 (4 curves × 4 bytes)
  const rot = 48;
  bytes[rot] = 0;
  bytes[rot + 1] = out;
  bytes[rot + 4] = 127;
  bytes[rot + 5] = 127 - inn;

  bytes[rot + 8] = 0;
  bytes[rot + 9] = out;
  bytes[rot + 12] = 127;
  bytes[rot + 13] = 127 - inn;

  return bytes;
}

export function morphUsesBezier(mode: VmdInterpMode, easeOut = 0.33, easeIn = 0.33): boolean {
  return mode === 'bezier' && (easeOut > 0.05 || easeIn > 0.05);
}
