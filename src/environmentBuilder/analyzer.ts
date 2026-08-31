/** Heuristic scene analysis + placement + showcase generation. */
import type { AppState } from '../types';
import { ENVIRONMENT_CATEGORIES, SMART_CAMERAS, getEnvironmentCategory } from './catalogs';
import type {
  CharacterPlacementId,
  EnvironmentCategoryId,
  EnvironmentPatches,
  SceneAnalysisResult,
  SceneKind,
  SmartCameraId,
} from './types';

export function analyzeScene(
  state: AppState,
  categoryId: EnvironmentCategoryId | null
): SceneAnalysisResult {
  const stages = state.models.filter((m) => m.assetKind === 'stage');
  const characters = state.models.filter((m) => m.assetKind !== 'stage');
  const hasEnvironment = stages.length > 0;
  const category = categoryId ? getEnvironmentCategory(categoryId) : null;
  const kind: SceneKind = category?.kind ?? (hasEnvironment ? 'stage' : 'unknown');

  const suggestions: string[] = [];
  if (!hasEnvironment) suggestions.push('Import a 3D environment (GLB/FBX/OBJ) or pick a Background Library scene.');
  if (characters.length === 0) suggestions.push('Add a character, then use Snap to Floor for correct placement.');
  if (characters.length > 0 && hasEnvironment) suggestions.push('Use Snap to Floor so the character stands on the ground.');
  if (kind === 'indoor') suggestions.push('Indoor scene — enable Portrait DOF and softer bloom.');
  if (kind === 'outdoor') suggestions.push('Outdoor scene — enable Dynamic Sky and try Golden Hour.');
  if (!state.visualFx.dofEnabled) suggestions.push('Enable Background DOF to separate character from the scene.');
  if (!state.visualFx.ssaoEnabled) suggestions.push('Enable Ambient Occlusion for grounded contact shadows.');
  if (!state.dynamicSky?.enabled && kind === 'outdoor') suggestions.push('Turn on Dynamic Sky for realistic outdoor light.');
  suggestions.push('Press Generate Showcase for an instant cinematic setup.');

  const recommendedCamera: SmartCameraId =
    kind === 'indoor' ? 'portrait' : characters.length > 1 ? 'wide' : 'hero';
  const recommendedCategory =
    categoryId ?? (hasEnvironment ? null : ENVIRONMENT_CATEGORIES[0]!.id);

  return {
    kind,
    hasEnvironment,
    characterCount: characters.length,
    suggestions: suggestions.slice(0, 6),
    recommendedCamera,
    recommendedCategory,
  };
}

const SPAWN_OFFSETS: Record<CharacterPlacementId, { x?: number; y?: number; z?: number }> = {
  snap_floor: { y: 0 },
  snap_stage: { y: 0 },
  center: { x: 0, z: 0 },
  spawn_left: { x: -8 },
  spawn_right: { x: 8 },
  spawn_back: { z: -8 },
};

export function placementToPosition(id: CharacterPlacementId): {
  x?: number;
  y?: number;
  z?: number;
} {
  return SPAWN_OFFSETS[id] ?? {};
}

/** Build a complete cinematic setup from the current scene + optional category. */
export function generateShowcase(
  state: AppState,
  categoryId: EnvironmentCategoryId | null
): EnvironmentPatches {
  const category = categoryId
    ? getEnvironmentCategory(categoryId)
    : ENVIRONMENT_CATEGORIES.find((c) => c.id === analyzeScene(state, null).recommendedCategory);
  const base = category?.patches ?? {};
  const camera = SMART_CAMERAS.find((c) => c.id === analyzeScene(state, categoryId).recommendedCamera);
  return {
    visualFx: {
      bloomEnabled: true,
      bloomIntensity: 0.6,
      dofEnabled: true,
      dofFocusDistance: 0.02,
      dofBokehScale: 3,
      ssaoEnabled: true,
      ssaoIntensity: 1.1,
      vignetteEnabled: true,
      vignetteIntensity: 0.4,
      ...base.visualFx,
    },
    dynamicSky: base.dynamicSky,
    sceneComposer: base.sceneComposer,
    cameraPreset: base.cameraPreset ?? camera?.preset,
    message: category
      ? `Showcase ready · ${category.label}`
      : 'Showcase ready',
  };
}
