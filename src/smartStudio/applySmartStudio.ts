import type { AppState } from '../types';
import { analyzeSceneProfile } from './analyzeScene';
import { buildSmartStudioPatch } from './buildSmartPatch';
import type {
  SmartCameraPreset,
  SmartPhotoPreset,
  SmartStudioMode,
  SmartStudioPatch,
  SmartStudioReport,
  SmartStudioSnapshot,
  SmartVideoPath,
  SmartVideoPreset,
  SceneProfile,
} from './types';

export function captureSmartSnapshot(state: AppState): SmartStudioSnapshot {
  return {
    visualFx: { ...state.visualFx },
    characterQuality: state.characterQuality,
    physicsMode: state.physicsMode,
    cameraMode: state.cameraMode,
    cameraStudio: { ...state.cameraStudio },
    cameraKeyframes: [...state.cameraKeyframes],
    isPlaying: state.isPlaying,
    currentFrame: state.currentFrame,
    rtxModeEnabled: state.rtxModeEnabled,
    models: state.models.map((m) => ({
      id: m.id,
      morphs: { ...m.morphs },
      poseHold: m.poseHold ?? null,
      vmdPlaybackEnabled: m.vmdPlaybackEnabled,
      activeTemplateId: m.activeTemplateId ?? null,
    })),
  };
}

export function restoreSmartSnapshot(
  prev: AppState,
  snapshot: SmartStudioSnapshot
): AppState {
  const morphById = new Map(snapshot.models.map((m) => [m.id, m]));
  return {
    ...prev,
    visualFx: snapshot.visualFx,
    characterQuality: snapshot.characterQuality,
    physicsMode: snapshot.physicsMode,
    cameraMode: snapshot.cameraMode,
    cameraStudio: snapshot.cameraStudio,
    cameraKeyframes: snapshot.cameraKeyframes,
    isPlaying: snapshot.isPlaying,
    currentFrame: snapshot.currentFrame,
    rtxModeEnabled: snapshot.rtxModeEnabled,
    models: prev.models.map((m) => {
      const snap = morphById.get(m.id);
      if (!snap) return m;
      return {
        ...m,
        morphs: snap.morphs,
        poseHold: snap.poseHold,
        vmdPlaybackEnabled: snap.vmdPlaybackEnabled,
        activeTemplateId: snap.activeTemplateId,
      };
    }),
  };
}

export function applyPatchToState(prev: AppState, patch: SmartStudioPatch): AppState {
  const morphMap = patch.modelMorphs ?? {};
  return {
    ...prev,
    visualFx: patch.visualFx,
    characterQuality: patch.characterQuality,
    physicsMode: patch.physicsMode,
    cameraMode: patch.cameraMode,
    cameraStudio: { ...prev.cameraStudio, ...patch.cameraStudio },
    cameraKeyframes: patch.cameraKeyframes ?? prev.cameraKeyframes,
    isPlaying: patch.isPlaying,
    currentFrame: patch.currentFrame,
    rtxModeEnabled: patch.rtxModeEnabled,
    models: prev.models.map((m) => {
      const morphs = morphMap[m.id];
      if (!morphs) return m;
      return { ...m, morphs };
    }),
  };
}

export interface PrepareSmartStudioResult {
  profile: SceneProfile;
  patch: SmartStudioPatch;
  report: SmartStudioReport;
  snapshot: SmartStudioSnapshot;
}

export function prepareSmartStudio(
  state: AppState,
  mode: SmartStudioMode,
  options: {
    cameraPreset?: SmartCameraPreset;
    photoPreset?: SmartPhotoPreset;
    videoPreset?: SmartVideoPreset;
    videoPath?: SmartVideoPath;
  } = {}
): PrepareSmartStudioResult | { error: string } {
  if (state.models.length === 0) {
    return { error: 'Load a PMX/PMD model first.' };
  }

  const profile = analyzeSceneProfile(state);
  const snapshot = captureSmartSnapshot(state);
  const { patch, report } = buildSmartStudioPatch(mode, profile, {
    ...options,
    maxFrames: state.maxFrames,
  });

  return { profile, patch, report, snapshot };
}
