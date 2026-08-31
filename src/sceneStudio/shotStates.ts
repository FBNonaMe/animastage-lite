/**
 * Capture / apply per-shot Scene Studio visual state (lighting, weather, FX).
 * Does not touch character placement or camera — Shot Composer owns those.
 */
import type { DynamicSkyState } from '../dynamicSky/types';
import type { SceneComposerState } from '../sceneComposer/types';
import type { VisualFxSettings } from '../types';
import { createSceneFxInstance } from './library';
import type {
  SceneFxInstance,
  SceneMoodPresetId,
  SceneStudioShotState,
  SceneStudioState,
  SceneWeatherControls,
} from './types';
import { DEFAULT_SCENE_STUDIO } from './types';

export function captureShotSceneState(
  shotId: string,
  studio: SceneStudioState,
  extras?: {
    dynamicSky?: Partial<DynamicSkyState>;
    sceneComposer?: Partial<SceneComposerState>;
    visualFx?: Partial<VisualFxSettings>;
  }
): SceneStudioShotState {
  return {
    shotId,
    moodPresetId: studio.activeMoodPresetId,
    fxStack: studio.fxStack.map((fx) => ({ ...fx, parameters: { ...fx.parameters } })),
    dynamicSky: extras?.dynamicSky ? { ...extras.dynamicSky } : undefined,
    sceneComposer: extras?.sceneComposer ? { ...extras.sceneComposer } : undefined,
    visualFx: extras?.visualFx ? { ...extras.visualFx } : undefined,
  };
}

export function upsertShotSceneState(
  studio: SceneStudioState,
  shotState: SceneStudioShotState
): SceneStudioState {
  const without = studio.shotStates.filter((s) => s.shotId !== shotState.shotId);
  return {
    ...studio,
    shotStates: [...without, shotState].slice(-40),
  };
}

export interface ApplyShotSceneResult {
  sceneStudio: SceneStudioState;
  dynamicSky?: Partial<DynamicSkyState>;
  sceneComposer?: Partial<SceneComposerState>;
  visualFx?: Partial<VisualFxSettings>;
}

export function applyShotSceneState(
  studio: SceneStudioState,
  shotId: string
): ApplyShotSceneResult | null {
  const shot = studio.shotStates.find((s) => s.shotId === shotId);
  if (!shot) return null;

  const fxStack: SceneFxInstance[] = shot.fxStack.map((fx, order) =>
    createSceneFxInstance(fx.effectId, {
      ...fx,
      order: fx.order ?? order,
    })
  );

  return {
    sceneStudio: {
      ...studio,
      activeMoodPresetId: shot.moodPresetId,
      fxStack,
    },
    dynamicSky: shot.dynamicSky,
    sceneComposer: shot.sceneComposer,
    visualFx: shot.visualFx,
  };
}

export function patchWeatherControls(
  studio: SceneStudioState | undefined,
  weather: Partial<SceneWeatherControls>
): SceneStudioState {
  const base = studio ?? DEFAULT_SCENE_STUDIO;
  return {
    ...base,
    weather: { ...base.weather, ...weather },
  };
}

export type { SceneMoodPresetId };
