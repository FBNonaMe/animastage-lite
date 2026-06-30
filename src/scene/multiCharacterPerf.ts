import type { AppState, MMDModel } from '../types';
import { setVisibleModelCount } from '../perf/sceneTriangleStress';
import { setSelectedPhysicsModelId } from './scenePhysicsRegistry';
import { countVisibleModels } from './sceneModelLayout';

/** Second character: physics schedule only — visual FX / quality stay user-controlled. */
export function patchStateForMultiCharacterLoad(prev: AppState): Partial<AppState> {
  if (prev.models.length < 1) return {};

  const patch: Partial<AppState> = {};

  if (prev.physicsMode === 'anytime') {
    patch.physicsMode = 'playtime';
  }

  if (prev.characterQuality === 'uhd4k') {
    patch.characterQuality = 'hd';
  }

  return patch;
}

/** Sync perf governor + physics caps when visible character count changes. */
export function syncMultiCharacterScenePerf(
  models: ReadonlyArray<MMDModel>,
  selectedObjectId: string | null | undefined
): void {
  const visible = countVisibleModels(models);
  setVisibleModelCount(visible);
  setSelectedPhysicsModelId(selectedObjectId ?? null);
}
