import type { ViewportFormat } from '../types';

/** Vertical FOV fills height; tall 9:16 needs more distance so the character is not cropped. */
export const PORTRAIT_DISTANCE_MUL = 1.42;
export const PORTRAIT_FOV_MUL = 0.92;

export function isPortraitViewport(format: ViewportFormat): boolean {
  return format === '9:16';
}

/** Pull camera farther / slightly tighter FOV for portrait canvas. */
export function adjustFramingForViewport(
  distance: number,
  fov: number,
  format: ViewportFormat
): { distance: number; fov: number } {
  if (!isPortraitViewport(format)) {
    return { distance, fov };
  }
  return {
    distance: Math.max(12, distance * PORTRAIT_DISTANCE_MUL),
    fov: Math.min(48, Math.max(34, fov * PORTRAIT_FOV_MUL)),
  };
}

/** Scale a world-space camera offset length for the current aspect. */
export function portraitPullDistance(distance: number, format: ViewportFormat): number {
  return isPortraitViewport(format)
    ? Math.max(12, distance * PORTRAIT_DISTANCE_MUL)
    : distance;
}
