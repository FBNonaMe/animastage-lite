import type { CharacterQuality, ViewportFormat } from '../types';
import { isPortraitFormat } from '../utils/characterQuality';
import { getSceneTriangleCount } from './sceneTriangleStress';
import { LITE_PERF_GOVERNOR_TIERS } from './controller/perfGovernor';

const GOVERNOR_MAX_TIER = LITE_PERF_GOVERNOR_TIERS.length - 1;

let playbackActive = false;
let viewportFormat: ViewportFormat = '16:9';
let characterQuality: CharacterQuality = 'hd';

export function setPlaybackPerfContext(ctx: {
  active: boolean;
  viewportFormat?: ViewportFormat;
  characterQuality?: CharacterQuality;
}): void {
  playbackActive = ctx.active;
  if (ctx.viewportFormat) viewportFormat = ctx.viewportFormat;
  if (ctx.characterQuality) characterQuality = ctx.characterQuality;
}

export function isPlaybackPerfActive(): boolean {
  return playbackActive;
}

/** Minimum DPR multiplier while playing in 16:9 — avoids blur from stacked downscales. */
export function getPlaybackDprFloor(): number {
  if (!playbackActive || isPortraitFormat(viewportFormat)) return 0;
  if (getSceneTriangleCount() >= 500_000) return 0.72;
  if (getSceneTriangleCount() >= 300_000) return 0.78;

  switch (characterQuality) {
    case 'uhd4k':
      return 0.95;
    case 'hd':
      return 0.88;
    default:
      return 0.82;
  }
}

/** Max perf-governor tier index during playback (0 = 100% scale). */
export function getPlaybackGovernorTierCap(): number {
  const heavyScene = getSceneTriangleCount() >= 400_000;
  if (heavyScene) {
    return GOVERNOR_MAX_TIER;
  }
  return playbackActive && !isPortraitFormat(viewportFormat) ? 3 : GOVERNOR_MAX_TIER;
}

/** Max combined visual degrade level during playback. */
export function getPlaybackDegradeCap(): number {
  const heavyScene = getSceneTriangleCount() >= 400_000;
  if (heavyScene) return 4;
  return playbackActive && !isPortraitFormat(viewportFormat) ? 2 : 4;
}
