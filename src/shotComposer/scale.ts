/** Character scale helpers — independent from environment bbox. */
import type { CharacterScaleMode } from './types';

/** Typical MMD model height in scene units (after import normalize). */
export const MMD_CHARACTER_HEIGHT = 16;

/** Approximate real-world adult height mapped into MMD units (~1.6m → 16). */
export const REAL_WORLD_TO_MMD = MMD_CHARACTER_HEIGHT / 1.6;

export function resolveCharacterHeight(
  mode: CharacterScaleMode,
  customHeightMeters: number,
  measuredHeight?: number | null
): number {
  switch (mode) {
    case 'real_world':
      return Math.max(4, customHeightMeters * REAL_WORLD_TO_MMD);
    case 'custom':
      return Math.max(2, customHeightMeters * REAL_WORLD_TO_MMD);
    case 'auto':
      if (measuredHeight && measuredHeight > 1) return measuredHeight;
      return MMD_CHARACTER_HEIGHT;
    case 'mmd':
    default:
      return MMD_CHARACTER_HEIGHT;
  }
}

/**
 * worldScale multiplier so measured mesh height becomes targetHeight.
 * Does NOT scale to environment size.
 */
export function worldScaleForTargetHeight(
  measuredHeight: number,
  targetHeight: number,
  currentWorldScale = 1
): number {
  if (!(measuredHeight > 0.01) || !(targetHeight > 0.01)) return currentWorldScale;
  const unscaled = measuredHeight / Math.max(0.001, currentWorldScale);
  return Math.min(8, Math.max(0.05, targetHeight / unscaled));
}
