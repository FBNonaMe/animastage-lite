/** Fuzzy match + Scene Plan validation against the Asset Registry. */
import type { ViewportFormat } from '../types';
import type { SceneMoodPresetId } from '../sceneStudio/types';
import type { CinematicLightingPresetId } from '../sceneStudio/lighting';
import type { ShotPresetId } from '../shotComposer/types';
import type { PhysicsPresetId } from '../physics/physicsPresets';
import type { AiDirectorRegistry } from './registry';
import {
  EMPTY_SCENE_PLAN,
  type AiScenePlan,
  type AiScenePlanValidation,
  type SceneCommand,
} from './types';

function scoreMatch(query: string, asset: { id: string; name: string; tags: string[] }): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const id = asset.id.toLowerCase();
  const name = asset.name.toLowerCase();
  if (id === q || name === q) return 100;
  if (id.includes(q) || name.includes(q)) return 80;
  const parts = q.split(/[\s_/.-]+/).filter(Boolean);
  let hits = 0;
  for (const part of parts) {
    if (id.includes(part) || name.includes(part) || asset.tags.some((t) => t.includes(part))) {
      hits += 1;
    }
  }
  return parts.length ? (hits / parts.length) * 60 : 0;
}

export function findClosestAsset(
  registry: AiDirectorRegistry,
  query: string | null | undefined,
  categories: string[]
): { id: string; name: string; score: number } | null {
  if (!query) return null;
  let best: { id: string; name: string; score: number } | null = null;
  for (const asset of registry.assets) {
    if (categories.length && !categories.includes(asset.category) && !categories.includes(asset.type)) {
      continue;
    }
    const score = scoreMatch(query, asset);
    if (!best || score > best.score) best = { id: asset.id, name: asset.name, score };
  }
  return best && best.score >= 25 ? best : null;
}

function assetExists(registry: AiDirectorRegistry, id: string | null, categories: string[]): boolean {
  if (!id) return false;
  return registry.assets.some(
    (a) =>
      a.id === id &&
      (!categories.length || categories.includes(a.category) || categories.includes(a.type))
  );
}

const ASPECTS: ViewportFormat[] = ['9:16', '16:9', '1:1', '4:5', '21:9'];
const SHOTS: ShotPresetId[] = [
  'full_body',
  'medium',
  'close_up',
  'portrait',
  'hero',
  'wide',
  'low_angle',
  'high_angle',
  'side',
  'back',
  'showcase',
  'dance',
  'anime_intro',
  'shorts',
];

function coerceAspect(value: unknown): ViewportFormat | null {
  const raw = String(value ?? '');
  return ASPECTS.includes(raw as ViewportFormat) ? (raw as ViewportFormat) : null;
}

function coerceShot(value: unknown): ShotPresetId | null {
  const raw = String(value ?? '');
  return SHOTS.includes(raw as ShotPresetId) ? (raw as ShotPresetId) : null;
}

export function normalizeRawPlan(raw: Partial<AiScenePlan> | Record<string, unknown>): AiScenePlan {
  const plan: AiScenePlan = {
    ...EMPTY_SCENE_PLAN,
    ...(raw as Partial<AiScenePlan>),
    version: 1,
    fxIds: Array.isArray((raw as AiScenePlan).fxIds)
      ? (raw as AiScenePlan).fxIds.filter((id): id is string => typeof id === 'string')
      : [],
    notes: Array.isArray((raw as AiScenePlan).notes)
      ? (raw as AiScenePlan).notes.filter((n): n is string => typeof n === 'string')
      : [],
    warnings: Array.isArray((raw as AiScenePlan).warnings)
      ? (raw as AiScenePlan).warnings.filter((n): n is string => typeof n === 'string')
      : [],
  };
  plan.aspectRatio = coerceAspect(plan.aspectRatio);
  plan.shotPreset = coerceShot(plan.shotPreset);
  if (typeof plan.timeHours === 'number') {
    plan.timeHours = Math.max(0, Math.min(24, plan.timeHours));
  } else {
    plan.timeHours = null;
  }
  return plan;
}

export function validateScenePlan(
  raw: Partial<AiScenePlan> | Record<string, unknown>,
  registry: AiDirectorRegistry
): AiScenePlanValidation {
  const plan = normalizeRawPlan(raw);
  const suggestions: AiScenePlanValidation['suggestions'] = [];
  const errors: string[] = [];
  const warnings = [...plan.warnings];

  if (!registry.hasCharacter && !plan.characterId) {
    errors.push('No character in the scene — import a character first.');
  } else if (plan.characterId && !assetExists(registry, plan.characterId, ['character'])) {
    const closest = findClosestAsset(registry, plan.characterId, ['character']);
    if (closest) {
      suggestions.push({
        field: 'characterId',
        requested: plan.characterId,
        suggestedId: closest.id,
        suggestedName: closest.name,
      });
      plan.characterId = closest.id;
    } else {
      plan.characterId = registry.selectedCharacterId;
      warnings.push('Requested character not found — using selected character.');
    }
  } else if (!plan.characterId) {
    plan.characterId = registry.selectedCharacterId;
  }

  if (plan.environmentId && !assetExists(registry, plan.environmentId, ['environment', 'stage'])) {
    const closest = findClosestAsset(registry, plan.environmentId, ['environment', 'stage']);
    if (closest) {
      suggestions.push({
        field: 'environmentId',
        requested: plan.environmentId,
        suggestedId: closest.id,
        suggestedName: closest.name,
      });
      plan.environmentId = closest.id;
    } else {
      warnings.push(`Environment "${plan.environmentId}" not loaded — keeping current stage.`);
      plan.environmentId = null;
    }
  }

  if (plan.moodPresetId && !assetExists(registry, plan.moodPresetId, ['mood', 'scene_preset'])) {
    const closest = findClosestAsset(registry, String(plan.moodPresetId), ['mood', 'scene_preset']);
    if (closest) {
      suggestions.push({
        field: 'moodPresetId',
        requested: String(plan.moodPresetId),
        suggestedId: closest.id,
        suggestedName: closest.name,
      });
      plan.moodPresetId = closest.id as SceneMoodPresetId;
    } else {
      plan.moodPresetId = 'cinematic';
      warnings.push('Mood preset missing — falling back to Cinematic.');
    }
  }

  if (
    plan.lightingPresetId &&
    !assetExists(registry, plan.lightingPresetId, ['lighting'])
  ) {
    const closest = findClosestAsset(registry, String(plan.lightingPresetId), ['lighting']);
    if (closest) {
      suggestions.push({
        field: 'lightingPresetId',
        requested: String(plan.lightingPresetId),
        suggestedId: closest.id,
        suggestedName: closest.name,
      });
      plan.lightingPresetId = closest.id as CinematicLightingPresetId;
    } else {
      plan.lightingPresetId = null;
      warnings.push('Lighting preset unavailable — skipped.');
    }
  }

  if (plan.physicsPresetId && !assetExists(registry, plan.physicsPresetId, ['physics'])) {
    const closest = findClosestAsset(registry, String(plan.physicsPresetId), ['physics']);
    if (closest) {
      plan.physicsPresetId = closest.id as PhysicsPresetId;
    } else {
      plan.physicsPresetId = 'safe';
      warnings.push('Physics preset unavailable — using Safe.');
    }
  }

  plan.fxIds = plan.fxIds
    .map((id) => {
      if (assetExists(registry, id, ['fx', 'weather', 'particles'])) return id;
      const closest = findClosestAsset(registry, id, ['fx', 'weather', 'particles']);
      if (closest) {
        suggestions.push({
          field: 'fxIds',
          requested: id,
          suggestedId: closest.id,
          suggestedName: closest.name,
        });
        return closest.id;
      }
      warnings.push(`FX "${id}" not available — skipped.`);
      return null;
    })
    .filter((id): id is string => Boolean(id));

  if (plan.animationAssetId && !assetExists(registry, plan.animationAssetId, ['animation'])) {
    const closest = findClosestAsset(registry, plan.animationAssetId, ['animation']);
    if (closest) plan.animationAssetId = closest.id;
    else {
      warnings.push('Animation not found in library — skipped.');
      plan.animationAssetId = null;
    }
  }

  if (plan.weather) {
    const allowed = ['clear', 'cloudy', 'overcast', 'rain', 'storm', 'snow', 'fog', 'wind'];
    if (!allowed.includes(plan.weather)) {
      warnings.push(`Weather "${plan.weather}" unsupported — skipped`);
      plan.weather = null;
    }
  }
  if (!plan.shotPreset) plan.shotPreset = 'full_body';
  if (!plan.aspectRatio) plan.aspectRatio = '16:9';
  if (!plan.summary) {
    plan.summary = [
      plan.moodPresetId,
      plan.weather,
      plan.shotPreset,
      plan.aspectRatio,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  plan.warnings = warnings;

  const commands = planToCommands(plan);
  return {
    ok: errors.length === 0,
    plan,
    commands,
    suggestions,
    errors,
  };
}

export function planToCommands(plan: AiScenePlan): SceneCommand[] {
  const commands: SceneCommand[] = [];

  if (plan.moodPresetId) {
    commands.push({ action: 'setMood', payload: { moodPresetId: plan.moodPresetId } });
  }
  if (plan.environmentId) {
    commands.push({ action: 'setEnvironment', payload: { environmentId: plan.environmentId } });
  }
  if (plan.characterId) {
    commands.push({ action: 'setCharacter', payload: { characterId: plan.characterId } });
  }
  if (plan.placement && plan.placement !== 'keep') {
    commands.push({
      action: 'placeCharacter',
      payload: {
        characterId: plan.characterId,
        placement: plan.placement,
      },
    });
  }
  if (plan.aspectRatio) {
    commands.push({ action: 'setAspect', payload: { aspectRatio: plan.aspectRatio } });
    commands.push({ action: 'setRenderAspect', payload: { aspectRatio: plan.aspectRatio } });
  }
  if (plan.shotPreset) {
    commands.push({
      action: 'createShot',
      payload: {
        shotPreset: plan.shotPreset,
        aspectRatio: plan.aspectRatio,
        characterId: plan.characterId,
        movement: plan.cameraMovement,
      },
    });
  }
  if (plan.timeHours != null || plan.weather || plan.fog) {
    commands.push({
      action: 'setWeather',
      payload: {
        timeHours: plan.timeHours,
        weather: plan.weather,
        fog: plan.fog,
      },
    });
  }
  if (plan.lightingPresetId) {
    commands.push({
      action: 'setLighting',
      payload: { lightingPresetId: plan.lightingPresetId },
    });
  }
  if (plan.fxIds.length) {
    for (const effectId of plan.fxIds) {
      commands.push({ action: 'addEffect', payload: { effectId } });
    }
  }
  for (const effectId of plan.removeFxIds ?? []) {
    if (effectId) {
      commands.push({ action: 'removeEffect', payload: { effectId } });
    }
  }
  if (plan.physicsPresetId) {
    commands.push({
      action: 'setPhysicsPreset',
      payload: { physicsPresetId: plan.physicsPresetId },
    });
  }
  if (plan.materialStyle) {
    commands.push({
      action: 'setMaterialStyle',
      payload: { materialStyle: plan.materialStyle },
    });
  }
  if (plan.animationAssetId) {
    commands.push({
      action: 'applyAnimation',
      payload: {
        animationAssetId: plan.animationAssetId,
        characterId: plan.characterId,
      },
    });
  }
  if (plan.cameraMovement && plan.cameraMovement !== 'none') {
    commands.push({
      action: 'setCameraMovement',
      payload: { movement: plan.cameraMovement },
    });
  }

  return commands;
}

export function mergeSceneCommands(
  base: SceneCommand[],
  extra: SceneCommand[] | null | undefined
): SceneCommand[] {
  if (!extra?.length) return base;
  const allowed = new Set<SceneCommand['action']>([
    'setMood',
    'setEnvironment',
    'setCharacter',
    'placeCharacter',
    'createShot',
    'setAspect',
    'setWeather',
    'setLighting',
    'setFx',
    'addEffect',
    'removeEffect',
    'setPhysicsPreset',
    'setMaterialStyle',
    'applyAnimation',
    'setCameraMovement',
    'setRenderAspect',
  ]);
  const merged = [...base];
  for (const cmd of extra) {
    if (!cmd?.action || !allowed.has(cmd.action)) continue;
    if (cmd.action === 'addEffect' && !cmd.payload?.effectId) continue;
    if (cmd.action === 'removeEffect' && !cmd.payload?.effectId && !cmd.payload?.instanceId) {
      continue;
    }
    merged.push(cmd);
  }
  return merged;
}
