import type { CameraSnapshot } from '../../../types';

/** Procedural handheld — micro jitter + breathing sway. */
export function applyHandheldOffset(
  snapshot: CameraSnapshot,
  timeSec: number,
  amplitude: number,
  motionIntensity = 0.5
): CameraSnapshot {
  if (amplitude <= 0) return snapshot;

  const amp = amplitude * (0.4 + motionIntensity * 0.6);
  const breath = Math.sin(timeSec * 1.8) * amp * 0.35;
  const swayX = Math.sin(timeSec * 2.3 + 0.7) * amp * 0.22;
  const swayY = Math.cos(timeSec * 1.9) * amp * 0.18;
  const swayZ = Math.sin(timeSec * 2.7 + 1.2) * amp * 0.12;
  const rotJitter = Math.sin(timeSec * 3.1) * amp * 0.15;

  return {
    ...snapshot,
    position: [
      snapshot.position[0] + swayX,
      snapshot.position[1] + swayY + breath,
      snapshot.position[2] + swayZ,
    ],
    rotation: [
      snapshot.rotation[0] + rotJitter * 0.4,
      snapshot.rotation[1] + rotJitter * 0.6,
      snapshot.rotation[2],
    ],
    fov: snapshot.fov + Math.sin(timeSec * 2.5) * amp * 0.08,
  };
}
