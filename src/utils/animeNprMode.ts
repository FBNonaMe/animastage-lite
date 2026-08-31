import type { AnimeNprSettings, RenderMode } from '../types';
import { DEFAULT_ANIME_NPR_SETTINGS } from '../standaloneEffects/presets';

export function isAnimeNprMode(renderMode?: RenderMode): boolean {
  return renderMode === 'anime_npr';
}

export function isAnimeNprActive(
  renderMode?: RenderMode,
  settings?: AnimeNprSettings | null
): boolean {
  const npr = settings ?? DEFAULT_ANIME_NPR_SETTINGS;
  return isAnimeNprMode(renderMode) && npr.acknowledged;
}
