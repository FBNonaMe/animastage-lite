/**
 * Cinema camera motion — weight, inertia, and natural damping for cinematic feel.
 * Offline Cinema Render uses damp=1 (exact keyframe timing); these apply to live preview / free cam.
 */
export interface CinemaCameraMotionSettings {
  /** 0–1 — higher = heavier camera, slower catch-up. */
  weight: number;
  /** Orbit / free-cam damping (OrbitControls dampingFactor). */
  orbitDamping: number;
  /** Playback keyframe catch-up alpha (lower = smoother). */
  playbackDamp: number;
  /** Optional subtle handheld — off during Cinema Render export. */
  handheld: boolean;
}

export const DEFAULT_CINEMA_CAMERA_MOTION: CinemaCameraMotionSettings = {
  weight: 0.72,
  orbitDamping: 0.08,
  playbackDamp: 0.18,
  handheld: false,
};

/** Convert weight (0–1) into a playback damp alpha. */
export function cinemaPlaybackDamp(weight: number, base = 0.28): number {
  const w = Math.max(0, Math.min(1, weight));
  // Heavier camera → smaller alpha → more lag / inertia
  return Math.max(0.06, base * (1 - w * 0.55));
}

export function cinemaOrbitDamping(weight: number, base = 0.05): number {
  const w = Math.max(0, Math.min(1, weight));
  return Math.min(0.18, base + w * 0.06);
}
