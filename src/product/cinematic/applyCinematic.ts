import type { AppState } from '../../types';
import type {
  CinematicEngineState,
  CinematicLookPatch,
  CinematicCameraMode,
  CinematicLightingPresetId,
} from './types';
import { DEFAULT_CINEMATIC_ENGINE } from './types';
import { getCinematicLightingPatch } from './lighting/presets';
import { generateCinematicCameraPath } from './camera/pathGenerator';
import type { ViewportFormat } from '../../types';
import { normalizeSceneComposerLights } from '../../sceneComposer';

export function applyCinematicLookPatch(
  prev: AppState,
  look: CinematicLookPatch
): AppState {
  if (!look.sceneComposer) {
    return {
      ...prev,
      visualFx: { ...prev.visualFx, ...look.visualFx },
      rtxModeEnabled: look.rtxModeEnabled ?? prev.rtxModeEnabled,
      characterQuality: look.characterQuality ?? prev.characterQuality,
    };
  }

  const composerPatch = look.sceneComposer;
  return {
    ...prev,
    visualFx: { ...prev.visualFx, ...look.visualFx },
    sceneComposer: {
      ...prev.sceneComposer,
      ...composerPatch,
      lights: normalizeSceneComposerLights({
        ...prev.sceneComposer.lights,
        ...composerPatch.lights,
      }),
      effectLevels: {
        ...prev.sceneComposer.effectLevels,
        ...(composerPatch.effectLevels ?? {}),
      },
    },
    rtxModeEnabled: look.rtxModeEnabled ?? prev.rtxModeEnabled,
    characterQuality: look.characterQuality ?? prev.characterQuality,
  };
}

export function applyCinematicEnginePatch(
  prev: AppState,
  patch: Partial<CinematicEngineState>
): AppState {
  return {
    ...prev,
    cinematic: {
      ...(prev.cinematic ?? DEFAULT_CINEMATIC_ENGINE),
      ...patch,
    },
  };
}

export function applyCinematicLighting(
  prev: AppState,
  presetId: CinematicLightingPresetId
): AppState {
  const look = getCinematicLightingPatch(presetId);
  let next = applyCinematicLookPatch(prev, look);
  next = applyCinematicEnginePatch(next, { lightingPreset: presetId, enabled: true });
  return next;
}

export function applyCinematicCameraPath(
  prev: AppState,
  mode: CinematicCameraMode,
  viewportFormat: ViewportFormat,
  motionIntensity = 0.5
): AppState {
  const modelCount = prev.models.filter((m) => m.visible).length || 1;
  const keyframes = generateCinematicCameraPath({
    mode,
    maxFrames: prev.maxFrames,
    modelCount,
    viewportFormat,
    motionIntensity,
    stageTarget: prev.cameraOrbitAnchor ?? undefined,
  });

  return {
    ...applyCinematicEnginePatch(prev, { cameraMode: mode, enabled: true }),
    cameraKeyframes: keyframes,
    cameraMode: 'mmd',
    timelineActiveTrack: 'camera',
    currentFrame: 0,
    isPlaying: false,
    cameraStudio: {
      ...prev.cameraStudio,
      autoFocus: false,
      manualCameraLock: false,
    },
  };
}
