import type { CameraEasingId } from './types';

/** Cubic ease-in — slow start. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Cubic ease-out — slow end (follow-through). */
export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/** Smooth ease-in-out — cinematic default. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Bezier-like S-curve with anticipation at start. */
export function easeBezierAnticipation(t: number): number {
  const c = easeInOutCubic(t);
  const anticipation = Math.sin(t * Math.PI) * 0.04 * (1 - t);
  return Math.max(0, Math.min(1, c - anticipation));
}

export function applyEasing(t: number, easing: CameraEasingId = 'easeInOut'): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'easeIn':
      return easeInCubic(clamped);
    case 'easeOut':
      return easeOutCubic(clamped);
    case 'bezier':
      return easeBezierAnticipation(clamped);
    case 'cubic':
      return easeInOutCubic(clamped);
    case 'catmull':
      // Smoothstep-ish for catmull segments
      return clamped * clamped * (3 - 2 * clamped);
    case 'hermite':
      return easeInOutCubic(clamped);
    case 'custom':
    case 'cinematic': {
      // Slow-in / slow-out with longer settle
      const s = clamped * clamped * (3 - 2 * clamped);
      return s * s * (3 - 2 * s);
    }
    case 'easeInOut':
      return easeInOutCubic(clamped);
    case 'linear':
    default:
      return clamped;
  }
}
