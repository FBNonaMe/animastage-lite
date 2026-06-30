import type { CharacterQuality, MMDModel } from '../types';
import { countVisibleModels } from './sceneModelLayout';

export function isMultiCharacterScene(models: readonly MMDModel[]): boolean {
  return countVisibleModels(models) >= 2;
}

/** Background characters skip physics when paused — both sim during playback. */
export function shouldSimulatePhysicsForModel(
  modelId: string,
  selectedModelId: string | null | undefined,
  models: readonly MMDModel[],
  isPlaying: boolean,
  modelVisible: boolean
): boolean {
  if (!modelVisible) return false;
  if (!isMultiCharacterScene(models)) return true;
  if (modelId === selectedModelId) return true;
  return isPlaying;
}

/** Lower material / texture cost for non-selected characters in duo scenes. */
export function shouldUseLiteRenderForModel(
  modelId: string,
  selectedModelId: string | null | undefined,
  models: readonly MMDModel[]
): boolean {
  if (!isMultiCharacterScene(models)) return false;
  return modelId !== selectedModelId;
}

export function shouldCastShadowForModel(
  modelId: string,
  selectedModelId: string | null | undefined,
  models: readonly MMDModel[]
): boolean {
  if (!isMultiCharacterScene(models)) return true;
  return modelId === selectedModelId;
}

export function resolveModelCharacterQuality(
  base: CharacterQuality,
  modelId: string,
  selectedModelId: string | null | undefined,
  models: readonly MMDModel[]
): CharacterQuality {
  if (!shouldUseLiteRenderForModel(modelId, selectedModelId, models)) {
    return base;
  }
  if (base === 'uhd4k') return 'hd';
  return 'standard';
}

/** @deprecated Use shouldSimulatePhysicsForModel — kept for exports. */
export function shouldDeferPhysicsForModel(
  modelId: string,
  selectedModelId: string | null | undefined,
  models: readonly MMDModel[]
): boolean {
  return shouldUseLiteRenderForModel(modelId, selectedModelId, models);
}
