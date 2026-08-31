/**
 * Offline Scene Plan builder from keyword heuristics.
 * Used when OpenRouter is unavailable or as a fast local first pass.
 */
import type { AiDirectorRegistry } from './registry';
import { findClosestAsset, validateScenePlan } from './validate';
import type { AiScenePlan, AiScenePlanValidation } from './types';
import type { SceneMoodPresetId } from '../sceneStudio/types';

function hoursFromPrompt(prompt: string): number | null {
  const p = prompt.toLowerCase();
  if (/midnight|deep night/.test(p)) return 0;
  if (/night|moonlight|nocturnal/.test(p)) return 22;
  if (/blue hour/.test(p)) return 20.5;
  if (/sunset|dusk/.test(p)) return 19;
  if (/golden hour/.test(p)) return 17.5;
  if (/morning|sunrise|dawn/.test(p)) return 6.5;
  if (/noon|midday|daytime|day\b/.test(p)) return 13;
  return null;
}

function moodFromPrompt(prompt: string): SceneMoodPresetId {
  const p = prompt.toLowerCase();
  if (/cyberpunk|neon rain|neon/.test(p)) return 'cyberpunk';
  if (/apocalypse|ash|ruin/.test(p)) return 'apocalypse';
  if (/fantasy|magic/.test(p)) return 'fantasy';
  if (/heavy rain|pouring/.test(p)) return 'heavy_rain';
  if (/storm/.test(p)) return 'storm';
  if (/rain/.test(p)) return 'rain';
  if (/snow|winter/.test(p)) return 'snow';
  if (/heavy fog/.test(p)) return 'heavy_fog';
  if (/fog|mist/.test(p)) return 'fog';
  if (/moonlight/.test(p)) return 'moonlight';
  if (/sunset/.test(p)) return 'sunset';
  if (/golden/.test(p)) return 'golden_hour';
  if (/night/.test(p)) return 'night';
  if (/anime/.test(p)) return 'anime';
  if (/mmd/.test(p)) return 'mmd';
  if (/cinematic/.test(p)) return 'cinematic';
  return 'cinematic';
}

export function buildLocalScenePlan(
  prompt: string,
  registry: AiDirectorRegistry
): AiScenePlanValidation {
  const p = prompt.toLowerCase();
  const moodPresetId = moodFromPrompt(prompt);
  const envQuery = /city|street|abandoned|stage|forest|temple|room|studio|beach/.exec(p)?.[0];
  const environment =
    findClosestAsset(registry, envQuery ?? 'stage', ['environment', 'stage']) ??
    findClosestAsset(registry, 'city', ['environment', 'stage']);

  const aspectRatio = /9\s*[:x]\s*16|vertical|shorts|reels|tiktok/.test(p)
    ? '9:16'
    : /1\s*[:x]\s*1|square/.test(p)
      ? '1:1'
      : /21\s*[:x]\s*9|ultrawide/.test(p)
        ? '21:9'
        : /4\s*[:x]\s*5/.test(p)
          ? '4:5'
          : '16:9';

  const shotPreset = /close.?up|face/.test(p)
    ? 'close_up'
    : /portrait|bust/.test(p)
      ? 'portrait'
      : /wide|establish/.test(p)
        ? 'wide'
        : /hero/.test(p)
          ? 'hero'
          : /dance/.test(p)
            ? 'dance'
            : 'full_body';

  const lightingPresetId = /moonlight|night/.test(p)
    ? 'moonlight'
    : /sunset|golden/.test(p)
      ? 'golden_hour'
      : /cyberpunk|neon/.test(p)
        ? 'cyberpunk'
        : /anime/.test(p)
          ? 'anime_soft'
          : /studio/.test(p)
            ? 'studio'
            : 'soft_portrait';

  const fxIds: string[] = [];
  if (/rain|storm/.test(p)) fxIds.push('weather.rain');
  if (/snow/.test(p)) fxIds.push('weather.snow');
  if (/ash|apocalypse/.test(p)) fxIds.push('weather.ash');
  if (/aura|energy/.test(p)) fxIds.push('character.aura');
  if (/magic/.test(p)) fxIds.push('character.magic_circle');

  const plan: Partial<AiScenePlan> = {
    summary: `Local plan · ${moodPresetId} · ${shotPreset} · ${aspectRatio}`,
    environmentId: environment?.id ?? null,
    characterId: registry.selectedCharacterId,
    moodPresetId,
    timeHours: hoursFromPrompt(prompt),
    weather: /storm/.test(p)
      ? 'storm'
      : /rain/.test(p)
        ? 'rain'
        : /snow/.test(p)
          ? 'snow'
          : /fog/.test(p)
            ? 'fog'
            : /clear|sunny/.test(p)
              ? 'clear'
              : null,
    fog: /heavy fog/.test(p) ? 'heavy' : /fog|mist/.test(p) ? 'light' : null,
    lightingPresetId,
    shotPreset,
    aspectRatio,
    cameraMovement: /orbit|circle|around/.test(p)
      ? /slow/.test(p)
        ? 'slow_orbit'
        : 'orbit'
      : /push|dolly in/.test(p)
        ? 'push_in'
        : 'static',
    placement: /left/.test(p)
      ? 'left'
      : /right/.test(p)
        ? 'right'
        : /street|middle|center/.test(p)
          ? 'street_center'
          : 'center',
    physicsPresetId: /wind|rain|storm|cloth|hair/.test(p) ? 'windy' : 'safe',
    fxIds,
    colorGrade: /cinematic/.test(p) ? 'cinematic' : /anime/.test(p) ? 'anime' : null,
    materialStyle: /cyberpunk/.test(p)
      ? 'cyberpunk'
      : /anime|toon/.test(p)
        ? 'anime'
        : /realistic/.test(p)
          ? 'realistic'
          : null,
    notes: ['Built offline from keywords (OpenRouter optional for richer plans).'],
    warnings: [],
  };

  return validateScenePlan(plan, registry);
}
