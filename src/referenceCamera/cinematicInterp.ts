/**
 * Cinematic Camera 2.0 — advanced path interpolation.
 * Positions / look-targets use splines; FOV / roll / focus use eased scalars.
 */
import type { CameraEasingId, CameraKeyframe, CameraSnapshot } from '../types';
import { applyEasing } from '../product/cinematic/easing';

export type Vec3 = [number, number, number];

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Cubic Hermite between p1→p2 with tangents m1, m2. */
export function hermite3(p1: Vec3, p2: Vec3, m1: Vec3, m2: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return [
    h00 * p1[0] + h10 * m1[0] + h01 * p2[0] + h11 * m2[0],
    h00 * p1[1] + h10 * m1[1] + h01 * p2[1] + h11 * m2[1],
    h00 * p1[2] + h10 * m1[2] + h01 * p2[2] + h11 * m2[2],
  ];
}

/** Catmull-Rom (centripetal-ish via chord-length tangents). */
export function catmullRom3(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const out: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] =
      0.5 *
      (2 * p1[i] +
        (-p0[i] + p2[i]) * t +
        (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
        (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
  }
  return out;
}

/** Cubic Bezier with auto handles from chord. */
export function cubicBezier3(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t;
  const uu = u * u;
  const uuu = uu * u;
  const tt = t * t;
  const ttt = tt * t;
  return [
    uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0],
    uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1],
    uuu * p0[2] + 3 * uu * t * p1[2] + 3 * u * tt * p2[2] + ttt * p3[2],
  ];
}

function autoBezierHandles(a: Vec3, b: Vec3, tension = 0.35): { c1: Vec3; c2: Vec3 } {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const mz = (a[2] + b[2]) / 2;
  return {
    c1: [
      a[0] + (mx - a[0]) * (1 - tension) + (b[0] - a[0]) * tension * 0.25,
      a[1] + (my - a[1]) * (1 - tension) + (b[1] - a[1]) * tension * 0.25,
      a[2] + (mz - a[2]) * (1 - tension) + (b[2] - a[2]) * tension * 0.25,
    ],
    c2: [
      b[0] - (b[0] - mx) * (1 - tension) - (b[0] - a[0]) * tension * 0.25,
      b[1] - (b[1] - my) * (1 - tension) - (b[1] - a[1]) * tension * 0.25,
      b[2] - (b[2] - mz) * (1 - tension) - (b[2] - a[2]) * tension * 0.25,
    ],
  };
}

function chordTangent(prev: Vec3, next: Vec3, scale = 0.5): Vec3 {
  return [(next[0] - prev[0]) * scale, (next[1] - prev[1]) * scale, (next[2] - prev[2]) * scale];
}

function resolveTarget(kf: CameraKeyframe, fallback: Vec3): Vec3 {
  if (kf.target) return [...kf.target];
  return [...fallback];
}

function segmentParam(
  prev: CameraKeyframe,
  next: CameraKeyframe,
  frame: number
): number {
  const range = next.frame - prev.frame;
  if (range <= 0) return 0;
  const hold = Math.min(Math.max(0, prev.transitionDuration ?? 0), Math.max(0, range - 1));
  if (frame <= prev.frame + hold) return 0;
  const moveRange = Math.max(1, range - hold);
  let rawT = (frame - prev.frame - hold) / moveRange;
  const speed = Math.max(0.25, Math.min(2, prev.speed ?? 1));
  if (speed !== 1) {
    rawT = Math.pow(clamp01(rawT), 1 / speed);
  }
  return clamp01(rawT);
}

/**
 * Evaluate cinematic camera pose at frame — never plain linear for cinematic modes.
 */
export function evaluateCinematicCameraAtFrame(
  keyframes: CameraKeyframe[],
  frame: number,
  fallback: CameraSnapshot
): CameraSnapshot {
  if (keyframes.length === 0) return fallback;

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const exact = sorted.find((kf) => kf.frame === frame);
  if (exact) {
    return {
      position: [...exact.position],
      rotation: [...exact.rotation],
      fov: exact.fov,
      target: resolveTarget(exact, fallback.target),
    };
  }

  if (frame <= sorted[0].frame) {
    const k = sorted[0];
    return {
      position: [...k.position],
      rotation: [...k.rotation],
      fov: k.fov,
      target: resolveTarget(k, fallback.target),
    };
  }
  if (frame >= sorted[sorted.length - 1].frame) {
    const k = sorted[sorted.length - 1];
    return {
      position: [...k.position],
      rotation: [...k.rotation],
      fov: k.fov,
      target: resolveTarget(k, fallback.target),
    };
  }

  let i = 0;
  for (; i < sorted.length - 1; i++) {
    if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) break;
  }

  const prev = sorted[i];
  const next = sorted[i + 1];
  const p0 = sorted[Math.max(0, i - 1)];
  const p3 = sorted[Math.min(sorted.length - 1, i + 2)];

  const rawT = segmentParam(prev, next, frame);
  const easing = (prev.easing ?? 'cinematic') as CameraEasingId;
  const t = applyEasing(rawT, easing);

  const prevT = resolveTarget(prev, fallback.target);
  const nextT = resolveTarget(next, fallback.target);
  const p0T = resolveTarget(p0, fallback.target);
  const p3T = resolveTarget(p3, fallback.target);

  let position: Vec3;
  let target: Vec3;

  switch (easing) {
    case 'linear':
      position = lerp3(prev.position, next.position, t);
      target = lerp3(prevT, nextT, t);
      break;
    case 'bezier': {
      const hPos = autoBezierHandles(prev.position, next.position, 0.4);
      const hTgt = autoBezierHandles(prevT, nextT, 0.4);
      position = cubicBezier3(prev.position, hPos.c1, hPos.c2, next.position, t);
      target = cubicBezier3(prevT, hTgt.c1, hTgt.c2, nextT, t);
      break;
    }
    case 'hermite': {
      const m1 = chordTangent(p0.position, next.position, 0.5);
      const m2 = chordTangent(prev.position, p3.position, 0.5);
      const mt1 = chordTangent(p0T, nextT, 0.5);
      const mt2 = chordTangent(prevT, p3T, 0.5);
      position = hermite3(prev.position, next.position, m1, m2, t);
      target = hermite3(prevT, nextT, mt1, mt2, t);
      break;
    }
    case 'catmull':
    case 'cinematic':
    case 'cubic':
    case 'custom':
      position = catmullRom3(p0.position, prev.position, next.position, p3.position, t);
      target = catmullRom3(p0T, prevT, nextT, p3T, t);
      break;
    default:
      // easeIn / easeOut / easeInOut — eased lerp (already eased via applyEasing)
      position = lerp3(prev.position, next.position, t);
      target = lerp3(prevT, nextT, t);
      break;
  }

  // Rotation: slerp-ish via eased lerp + optional roll blend (gimbal-friendly)
  const rollA = prev.roll ?? prev.rotation[2] ?? 0;
  const rollB = next.roll ?? next.rotation[2] ?? 0;
  const rotation: Vec3 = [
    lerp(prev.rotation[0], next.rotation[0], t),
    lerp(prev.rotation[1], next.rotation[1], t),
    lerp(rollA, rollB, t),
  ];

  const fovA = prev.zoom != null ? prev.fov * (0.85 + prev.zoom * 0.3) : prev.fov;
  const fovB = next.zoom != null ? next.fov * (0.85 + next.zoom * 0.3) : next.fov;
  const fov = lerp(fovA, fovB, t);

  return { position, rotation, fov, target };
}
