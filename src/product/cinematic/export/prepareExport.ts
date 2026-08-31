import type { AppState } from '../../../types';
import type { CinematicExportProfile } from '../types';
import { applyEffectQualityBudget } from '../quality/adaptive';
import { getCinematicLightingPatch } from '../lighting/presets';

export interface ExportPrepareResult {
  appStatePatch: Partial<AppState>;
  preserveCameraKeyframes: boolean;
}

/**
 * Dedicated export pipeline — preserves user camera keys, locks MMD mode, applies FX budget.
 */
export function prepareCinematicExport(
  appState: AppState,
  profile: CinematicExportProfile
): ExportPrepareResult {
  const lighting = appState.cinematic?.lightingPreset ?? 'anime_soft';
  const look = getCinematicLightingPatch(lighting);
  const fxBudget = applyEffectQualityBudget(
    { ...appState.visualFx, ...look.visualFx },
    profile.fxBudget
  );

  const hasUserKeys = appState.cameraKeyframes.length > 0;
  const keepManualLock = Boolean(appState.cameraStudio.manualCameraLock);
  const keepFreeCam = appState.cameraMode === 'free' || keepManualLock;

  return {
    preserveCameraKeyframes: hasUserKeys && !keepFreeCam,
    appStatePatch: {
      visualFx: fxBudget,
      // Keep free / MY CAM framing during export — forcing MMD unlocked the
      // camera track and made the view jump upward to keyed / fallback poses.
      cameraMode: keepFreeCam ? appState.cameraMode : 'mmd',
      isPlaying: false,
      currentFrame: 0,
      timelineActiveTrack: keepFreeCam ? appState.timelineActiveTrack : 'camera',
      cameraStudio: {
        ...appState.cameraStudio,
        autoFocus: keepFreeCam || hasUserKeys ? false : appState.cameraStudio.autoFocus,
        manualCameraLock: keepManualLock || keepFreeCam,
      },
      sceneComposer: look.sceneComposer
        ? { ...appState.sceneComposer, ...look.sceneComposer }
        : appState.sceneComposer,
      rtxModeEnabled: look.rtxModeEnabled ?? appState.rtxModeEnabled,
      characterQuality: look.characterQuality ?? appState.characterQuality,
    },
  };
}
