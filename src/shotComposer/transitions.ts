/** Camera transition easing between saved shots. */
import type { CameraSnapshot } from '../types';
import type { ShotTransitionEase } from './types';

export function easeSample(ease: ShotTransitionEase, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (ease) {
    case 'linear':
      return x;
    case 'ease_in':
      return x * x;
    case 'ease_out':
      return 1 - (1 - x) * (1 - x);
    case 'ease_in_out':
    case 'smooth':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'cubic':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'quintic':
      return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
    case 'bezier': {
      // Smoothstep-like cubic bezier approximation
      return x * x * (3 - 2 * x);
    }
    default:
      return x;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpTuple(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function interpolateCameraSnapshot(
  from: CameraSnapshot,
  to: CameraSnapshot,
  tRaw: number,
  ease: ShotTransitionEase = 'ease_in_out'
): CameraSnapshot {
  const t = easeSample(ease, tRaw);
  return {
    position: lerpTuple(from.position, to.position, t),
    rotation: lerpTuple(from.rotation, to.rotation, t),
    fov: lerp(from.fov, to.fov, t),
    target: lerpTuple(from.target, to.target, t),
  };
}
