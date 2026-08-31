import { DEFAULT_DYNAMIC_SKY } from '../dynamicSky/types';
import { DEFAULT_SCENE_COMPOSER } from '../sceneComposer/defaults';
import { DEFAULT_VISUAL_FX } from '../visualFx/visualFxPresets';
import { createSceneFxInstance } from './library';
import { getSceneMoodPreset } from './presets';
import {
  DEFAULT_SCENE_STUDIO,
  type SceneMoodPresetId,
  type SceneStudioApplyPatch,
  type SceneStudioState,
} from './types';

export interface SceneStudioSourceState {
  sceneStudio?: SceneStudioState;
  dynamicSky?: typeof DEFAULT_DYNAMIC_SKY;
  sceneComposer?: typeof DEFAULT_SCENE_COMPOSER;
  visualFx?: typeof DEFAULT_VISUAL_FX;
}

/** Resolve a complete, atomic state transaction from one mood selection. */
export function buildSceneMoodPatch(
  id: SceneMoodPresetId,
  source: SceneStudioSourceState
): SceneStudioApplyPatch {
  const preset = getSceneMoodPreset(id);
  const currentStudio = source.sceneStudio ?? DEFAULT_SCENE_STUDIO;
  const currentSky = source.dynamicSky ?? DEFAULT_DYNAMIC_SKY;
  const currentComposer = source.sceneComposer ?? DEFAULT_SCENE_COMPOSER;
  const currentVisualFx = source.visualFx ?? DEFAULT_VISUAL_FX;

  const fxStack = preset.effects.map((effect, order) =>
    createSceneFxInstance(effect.effectId, {
      name: effect.name,
      mount: effect.mount,
      category: effect.category,
      intensity: effect.intensity,
      order,
    })
  );

  return {
    sceneStudio: {
      ...currentStudio,
      version: 1,
      activeMoodPresetId: preset.id,
      weather: { ...preset.weather },
      fxStack,
      materialStyle:
        id === 'mmd'
          ? 'classic_mmd'
          : id === 'cyberpunk' || id === 'neon_night'
            ? 'cyberpunk'
            : id === 'fantasy'
              ? 'fantasy'
              : id === 'cinematic'
                ? 'cinematic'
                : 'anime',
    },
    dynamicSky: {
      ...currentSky,
      ...preset.dynamicSky,
    },
    sceneComposer: {
      ...currentComposer,
      ...preset.sceneComposer,
      lights: {
        ...currentComposer.lights,
        ...(preset.sceneComposer.lights ?? {}),
      },
    },
    visualFx: {
      ...currentVisualFx,
      ...preset.visualFx,
    },
  };
}

export interface SmartSceneRequest {
  mood: SceneMoodPresetId;
  aspectRatio?: SceneStudioApplyPatch['viewportFormat'];
}

export function buildSmartScenePatch(
  request: SmartSceneRequest,
  source: SceneStudioSourceState
): SceneStudioApplyPatch {
  return {
    ...buildSceneMoodPatch(request.mood, source),
    ...(request.aspectRatio ? { viewportFormat: request.aspectRatio } : {}),
  };
}
