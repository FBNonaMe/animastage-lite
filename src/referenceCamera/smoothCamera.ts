/**
 * Camera motion stabilization + one-click Smooth Camera (preserve timing).
 */
import type { CameraKeyframe } from '../types';

type V3 = [number, number, number];

function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function dist3(a: V3, b: V3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Laplacian + velocity clamp pass — removes micro-jitter like a gimbal.
 * Preserves keyframe frame numbers (timing).
 */
export function stabilizeCameraKeyframes(keyframes: CameraKeyframe[]): CameraKeyframe[] {
  if (keyframes.length < 2) {
    return keyframes.map((k) => ({
      ...k,
      easing: 'cinematic' as const,
      speed: 1,
    }));
  }

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  let next = sorted.map((k) => ({
    ...k,
    position: [...k.position] as V3,
    rotation: [...k.rotation] as V3,
    target: k.target ? ([...k.target] as V3) : undefined,
  }));

  // Pass 1: light Laplacian on interior keys
  for (let pass = 0; pass < 2; pass++) {
    const src = next.map((k) => ({ ...k, position: [...k.position] as V3, target: k.target ? ([...k.target] as V3) : undefined }));
    for (let i = 1; i < src.length - 1; i++) {
      const prev = src[i - 1];
      const cur = src[i];
      const aft = src[i + 1];
      const blend = 0.32;
      next[i] = {
        ...cur,
        position: lerp3(cur.position, lerp3(prev.position, aft.position, 0.5), blend),
        target: cur.target
          ? lerp3(cur.target, lerp3(prev.target ?? cur.target, aft.target ?? cur.target, 0.5), blend * 0.9)
          : cur.target,
        rotation: [
          cur.rotation[0] * 0.7 + ((prev.rotation[0] + aft.rotation[0]) / 2) * 0.3,
          cur.rotation[1] * 0.7 + ((prev.rotation[1] + aft.rotation[1]) / 2) * 0.3,
          cur.rotation[2] * 0.55 + ((prev.rotation[2] + aft.rotation[2]) / 2) * 0.45,
        ],
        fov: cur.fov * 0.65 + ((prev.fov + aft.fov) / 2) * 0.35,
        focusDistance:
          cur.focusDistance != null && prev.focusDistance != null && aft.focusDistance != null
            ? cur.focusDistance * 0.65 + ((prev.focusDistance + aft.focusDistance) / 2) * 0.35
            : cur.focusDistance,
      };
    }
  }

  // Pass 2: clamp abrupt FOV / roll spikes
  for (let i = 1; i < next.length; i++) {
    const dFov = next[i].fov - next[i - 1].fov;
    if (Math.abs(dFov) > 12) {
      next[i].fov = next[i - 1].fov + Math.sign(dFov) * 12;
    }
    const dRoll = (next[i].roll ?? next[i].rotation[2]) - (next[i - 1].roll ?? next[i - 1].rotation[2]);
    if (Math.abs(dRoll) > 8) {
      const base = next[i - 1].roll ?? next[i - 1].rotation[2];
      const roll = base + Math.sign(dRoll) * 8;
      next[i].roll = roll;
      next[i].rotation = [next[i].rotation[0], next[i].rotation[1], roll];
    }
  }

  // Pass 3: normalize segment speed + cinematic easing (keep frames)
  for (let i = 0; i < next.length; i++) {
    const span =
      i < next.length - 1 ? Math.max(1, next[i + 1].frame - next[i].frame) : 1;
    let speed = 1;
    if (i < next.length - 1) {
      const d = dist3(next[i].position, next[i + 1].position);
      // Prefer ~0.35 units/frame travel — normalize extremes
      const ideal = d / span;
      speed = Math.max(0.55, Math.min(1.45, 0.45 / Math.max(0.08, ideal)));
    }
    next[i] = {
      ...next[i],
      easing: i === 0 ? 'easeOut' : i === next.length - 1 ? 'easeIn' : 'cinematic',
      speed,
      transitionDuration: Math.min(Math.floor(span * 0.08), Math.max(0, span - 2)),
    };
  }

  return next;
}

/**
 * One-click Smooth Camera — stabilize + optimize for cinematic motion.
 * Timing (frame indices) is preserved.
 */
export function smoothCameraKeyframes(keyframes: CameraKeyframe[]): CameraKeyframe[] {
  return stabilizeCameraKeyframes(keyframes);
}
