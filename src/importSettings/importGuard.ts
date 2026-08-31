import type { AppState } from '../types';
import type { ModelImportSettings } from './types';
import { DEFAULT_MODEL_IMPORT_SETTINGS } from './types';

/** Strip env/camera/fog opts — silent loads must never mutate the project look. */
export function settingsForSilentImport(
  settings: ModelImportSettings = DEFAULT_MODEL_IMPORT_SETTINGS
): ModelImportSettings {
  return {
    ...settings,
    importLights: false,
    importCameras: false,
    applyEnvironment: false,
    enableFog: false,
  };
}

/**
 * Character / mesh import may only add model data.
 * Environment, fog, bloom, sky, weather, lighting, FX, camera, renderer stay untouched
 * unless the user explicitly opts in via Import Dialog.
 */
export function buildCharacterImportStatePatch(
  prev: AppState,
  settings: ModelImportSettings = DEFAULT_MODEL_IMPORT_SETTINGS
): Partial<AppState> {
  // Default: zero environment mutation.
  if (
    !settings.applyEnvironment &&
    !settings.enableFog &&
    !settings.importLights &&
    !settings.importCameras
  ) {
    return {};
  }

  const patch: Partial<AppState> = {};

  if (settings.enableFog) {
    patch.sceneComposer = {
      ...prev.sceneComposer,
      fogEnabled: true,
      fogDensity: Math.max(prev.sceneComposer.fogDensity ?? 0.2, 0.2),
    };
  }

  if (settings.importLights) {
    patch.sceneComposer = {
      ...(patch.sceneComposer ?? prev.sceneComposer),
      lights: {
        ...prev.sceneComposer.lights,
        sunEnabled: true,
        sunShadows: true,
      },
    };
  }

  if (settings.applyEnvironment) {
    patch.visualFx = {
      ...prev.visualFx,
      environmentIntensity: Math.max(prev.visualFx.environmentIntensity ?? 0.72, 0.78),
    };
  }

  // importCameras only affects camera VMD wiring in App — no sceneComposer writes here.
  return patch;
}

/**
 * Stage/background import — display the stage mesh only.
 * Never flips fog / bloom / weather / lights unless the user opted in.
 */
export function buildStageImportStatePatch(
  prev: AppState,
  settings: ModelImportSettings = DEFAULT_MODEL_IMPORT_SETTINGS
): Partial<AppState> {
  // Minimal display flag so the imported stage is treated as scene background —
  // not an environment look rewrite (fog/sky/FX stay project-owned).
  const displayOnly: Partial<AppState> = {
    sceneComposer: {
      ...prev.sceneComposer,
      presetPreviewSource: 'model',
    },
  };

  if (!settings.applyEnvironment && !settings.enableFog && !settings.importLights) {
    return displayOnly;
  }

  const env = buildCharacterImportStatePatch(prev, settings);
  return {
    ...env,
    sceneComposer: {
      ...prev.sceneComposer,
      ...(env.sceneComposer ?? {}),
      presetPreviewSource: 'model',
    },
  };
}
