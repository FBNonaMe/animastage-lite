import type { AppState, ViewportFormat } from '../../types';
import { applyCinematicLighting } from '../cinematic/applyCinematic';
import type { CinematicLightingPresetId } from '../cinematic/types';
import { analyzeCharacterProfile } from './character/analyzeProfile';
import { generateVcsCameraPath } from './camera/pathGenerator';
import { getDirectorRules } from './camera/directorModes';
import { generateAutoDirectorVariations, pickBestVariation } from './autoDirector';
import { createVirtualCamera, createShot, shotsToTimelineKeyframes, duplicateVirtualCamera } from './shots/shotManager';
import type { VcsDirectorMode, VcsShot, VcsState, VcsVirtualCamera } from './types';
import { DEFAULT_VCS_STATE } from './types';
import type { PmxBoneInfo } from '../../types';
import type * as THREE from 'three';

export function applyVcsPatch(prev: AppState, patch: Partial<VcsState>): AppState {
  return {
    ...prev,
    vcs: {
      ...(prev.vcs ?? DEFAULT_VCS_STATE),
      ...patch,
    },
  };
}

export function registerCharacterProfile(
  prev: AppState,
  modelId: string,
  bones: PmxBoneInfo[],
  mesh?: THREE.SkinnedMesh | null
): AppState {
  const profile = analyzeCharacterProfile(modelId, bones, mesh);
  return applyVcsPatch(prev, {
    characterProfiles: {
      ...(prev.vcs?.characterProfiles ?? {}),
      [modelId]: profile,
    },
  });
}

export function applyDirectorMode(
  prev: AppState,
  mode: VcsDirectorMode,
  viewportFormat: ViewportFormat
): AppState {
  const profiles = Object.values(prev.vcs?.characterProfiles ?? {});
  const profile = profiles[0] ?? null;
  const modelCount = Math.max(1, prev.models.filter((m) => m.visible).length);
  const rules = getDirectorRules(mode);

  const keyframes = generateVcsCameraPath({
    mode,
    maxFrames: prev.maxFrames,
    modelCount,
    viewportFormat,
    profile,
    motionSpeed: rules.motionIntensity,
    stageTarget: prev.cameraOrbitAnchor,
  });

  const cam = createVirtualCamera(rules.label, keyframes);
  cam.active = true;

  let next = applyVcsPatch(prev, {
    enabled: true,
    directorMode: mode,
    cameras: [cam, ...(prev.vcs?.cameras ?? []).filter((c) => c.id !== cam.id)],
    activeCameraId: cam.id,
    manualDirector: false,
  });

  next = applyCinematicLighting(next, prev.vcs?.lightingPreset ?? 'anime_soft');

  return {
    ...next,
    cameraKeyframes: keyframes,
    cameraMode: 'mmd',
    timelineActiveTrack: 'camera',
    currentFrame: 0,
    isPlaying: false,
    cameraStudio: {
      ...next.cameraStudio,
      autoFocus: false,
      manualCameraLock: false,
      focusTarget: rules.focusTarget === 'eyes' || rules.focusTarget === 'face' ? 'face' : 'body',
    },
  };
}

export function runAutoDirector(
  prev: AppState,
  count: 5 | 10 | 20 | 50,
  viewportFormat: ViewportFormat
): AppState {
  const profiles = Object.values(prev.vcs?.characterProfiles ?? {});
  const profile = profiles[0] ?? null;
  const modelCount = Math.max(1, prev.models.filter((m) => m.visible).length);

  const variations = generateAutoDirectorVariations(count, {
    maxFrames: prev.maxFrames,
    modelCount,
    viewportFormat,
    profile,
  });

  const best = pickBestVariation(variations);

  let next = applyVcsPatch(prev, {
    enabled: true,
    variations,
    variationCount: count,
    selectedVariationId: best?.id ?? null,
    lastDirectorScore: best?.score ?? null,
    directorMode: best?.mode ?? prev.vcs?.directorMode ?? 'character_showcase',
  });

  if (best) {
    const cam = createVirtualCamera(best.label, best.keyframes);
    cam.active = true;
    next = applyVcsPatch(next, {
      cameras: [cam, ...(prev.vcs?.cameras ?? [])],
      activeCameraId: cam.id,
    });
    next = {
      ...next,
      cameraKeyframes: best.keyframes,
      cameraMode: 'mmd',
      timelineActiveTrack: 'camera',
      currentFrame: 0,
      isPlaying: false,
    };
  }

  return next;
}

export function applyVariation(prev: AppState, variationId: string): AppState {
  const variation = prev.vcs?.variations.find((v) => v.id === variationId);
  if (!variation) return prev;

  const cam = createVirtualCamera(variation.label, variation.keyframes);
  return {
    ...applyVcsPatch(prev, {
      selectedVariationId: variationId,
      directorMode: variation.mode,
      activeCameraId: cam.id,
      cameras: [cam, ...(prev.vcs?.cameras ?? [])],
      lastDirectorScore: variation.score,
    }),
    cameraKeyframes: variation.keyframes,
    cameraMode: 'mmd',
    timelineActiveTrack: 'camera',
  };
}

export function buildShotsFromCameras(
  cameras: VcsVirtualCamera[],
  maxFrames: number
): VcsShot[] {
  return cameras.map((cam, i) =>
    createShot(
      cam.name,
      cam.id,
      0,
      maxFrames,
      cam.keyframes.length > 0 ? cam.keyframes : []
    )
  );
}

export function applyShotsToTimeline(prev: AppState): AppState {
  const shots = prev.vcs?.shots ?? [];
  if (shots.length === 0) return prev;
  return {
    ...prev,
    cameraKeyframes: shotsToTimelineKeyframes(shots),
    cameraMode: 'mmd',
    timelineActiveTrack: 'camera',
  };
}

export function applyVcsLighting(prev: AppState, preset: CinematicLightingPresetId): AppState {
  const next = applyCinematicLighting(prev, preset);
  return applyVcsPatch(next, { lightingPreset: preset, enabled: true });
}

export function createCameraFromSnapshot(
  prev: AppState,
  name: string,
  keyframes: import('../../types').CameraKeyframe[] = prev.cameraKeyframes
): AppState {
  const cam = createVirtualCamera(name, keyframes);
  cam.active = true;
  return applyVcsPatch(prev, {
    enabled: true,
    cameras: [...(prev.vcs?.cameras ?? []), cam],
    activeCameraId: cam.id,
  });
}

export function duplicateVcsCamera(prev: AppState, cameraId: string): AppState {
  const cam = prev.vcs?.cameras.find((c) => c.id === cameraId);
  if (!cam) return prev;
  const copy = duplicateVirtualCamera(cam);
  return applyVcsPatch(prev, {
    cameras: [...(prev.vcs?.cameras ?? []), copy],
  });
}

export function deleteVcsCamera(prev: AppState, cameraId: string): AppState {
  return applyVcsPatch(prev, {
    cameras: (prev.vcs?.cameras ?? []).filter((c) => c.id !== cameraId),
    activeCameraId: prev.vcs?.activeCameraId === cameraId ? null : prev.vcs?.activeCameraId,
  });
}

export function renameVcsCamera(prev: AppState, cameraId: string, name: string): AppState {
  return applyVcsPatch(prev, {
    cameras: (prev.vcs?.cameras ?? []).map((c) =>
      c.id === cameraId ? { ...c, name } : c
    ),
  });
}

export function activateVcsCamera(prev: AppState, cameraId: string): AppState {
  const cam = prev.vcs?.cameras.find((c) => c.id === cameraId);
  if (!cam) return prev;
  return {
    ...applyVcsPatch(prev, {
      activeCameraId: cameraId,
      cameras: (prev.vcs?.cameras ?? []).map((c) => ({
        ...c,
        active: c.id === cameraId,
      })),
    }),
    cameraKeyframes: cam.keyframes,
    cameraMode: 'mmd',
    timelineActiveTrack: 'camera',
  };
}

export function addVcsShot(prev: AppState, name: string, cameraId?: string): AppState {
  const camId = cameraId ?? prev.vcs?.activeCameraId;
  const cam = prev.vcs?.cameras.find((c) => c.id === camId);
  const keyframes = cam?.keyframes ?? prev.cameraKeyframes;
  const shot = createShot(name, camId ?? 'manual', 0, prev.maxFrames, keyframes);
  return applyVcsPatch(prev, {
    enabled: true,
    shots: [...(prev.vcs?.shots ?? []), shot],
    activeShotId: shot.id,
  });
}

export function deleteVcsShot(prev: AppState, shotId: string): AppState {
  return applyVcsPatch(prev, {
    shots: (prev.vcs?.shots ?? []).filter((s) => s.id !== shotId),
    activeShotId: prev.vcs?.activeShotId === shotId ? null : prev.vcs?.activeShotId,
  });
}

export { DEFAULT_VCS_STATE };
