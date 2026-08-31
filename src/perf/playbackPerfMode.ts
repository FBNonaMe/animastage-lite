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

/** Minimum DPR multiplier while playing in 16:9 — characters stay crisp during dance. */
export function getPlaybackDprFloor(): number {
  if (!playbackActive || isPortraitFormat(viewportFormat)) return 0;
  if (getSceneTriangleCount() >= 500_000) return 0.85;
  if (getSceneTriangleCount() >= 300_000) return 0.9;

  switch (characterQuality) {
    case 'uhd4k':
      return 0.95;
    case 'hd':
      return 0.92;
    default:
      return 0.9;
  }
}

/**
 * Max perf-governor tier index during playback.
 * Tier 4 = all FX/lighting/scene/physics cuts, still 100% render scale —
 * playback never enters the render-scale tiers unless the scene is very heavy.
 */
export function getPlaybackGovernorTierCap(): number {
  const heavyScene = getSceneTriangleCount() >= 400_000;
  if (heavyScene) {
    return GOVERNOR_MAX_TIER;
  }
  return playbackActive && !isPortraitFormat(viewportFormat) ? 4 : GOVERNOR_MAX_TIER;
}

/** Max combined visual degrade level during playback. */
export function getPlaybackDegradeCap(): number {
  const heavyScene = getSceneTriangleCount() >= 400_000;
  if (heavyScene) return 4;
  return playbackActive && !isPortraitFormat(viewportFormat) ? 2 : 4;
}
