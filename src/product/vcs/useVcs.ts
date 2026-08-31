import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useRef } from 'react';
import type { AppState, ViewportFormat, VisualFxSettings } from '../../types';
import type { PmxBoneInfo } from '../../types';
import type * as THREE from 'three';
import type { CinematicLightingPresetId } from '../cinematic/types';
import { applyCinematicEnginePatch } from '../cinematic/applyCinematic';
import {
  activateVcsCamera,
  addVcsShot,
  applyDirectorMode,
  applyShotsToTimeline,
  applyVariation,
  applyVcsLighting,
  applyVcsPatch,
  createCameraFromSnapshot,
  deleteVcsCamera,
  deleteVcsShot,
  duplicateVcsCamera,
  registerCharacterProfile,
  renameVcsCamera,
  runAutoDirector,
} from './applyVcs';
import type { VcsDirectorMode, VcsFocusTarget, VcsState } from './types';
import { DEFAULT_VCS_STATE } from './types';
import { analyzeVisualQuality } from '../cinematic/quality/visualAnalyzer';
import { constrainToSafeVolume } from './camera/safeVolume';
import type { CameraSnapshot } from '../../types';
import { mergeCharacterProfiles } from './character/analyzeProfile';
import {
  analyzeReferenceVideo,
  formatReferenceAnalysis,
} from './reference/analyzer';

export interface VcsBridge {
  getAppState: () => AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  getViewportFormat: () => ViewportFormat;
  invalidateScene: () => void;
}

export function useVcs(bridge: VcsBridge) {
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  const getState = useCallback((): VcsState => {
    return bridgeRef.current.getAppState().vcs ?? DEFAULT_VCS_STATE;
  }, []);

  const patch = useCallback((p: Partial<VcsState>) => {
    bridgeRef.current.setAppState((prev) => applyVcsPatch(prev, p));
  }, []);

  const enableSystem = useCallback(() => {
    patch({ enabled: true });
    bridgeRef.current.invalidateScene();
  }, [patch]);

  const analyzeModel = useCallback(
    (modelId: string, bones: PmxBoneInfo[], mesh?: THREE.SkinnedMesh | null) => {
      bridgeRef.current.setAppState((prev) => registerCharacterProfile(prev, modelId, bones, mesh));
    },
    []
  );

  const setDirectorMode = useCallback((mode: VcsDirectorMode) => {
    const format = bridgeRef.current.getViewportFormat();
    bridgeRef.current.setAppState((prev) => applyDirectorMode(prev, mode, format));
    bridgeRef.current.invalidateScene();
  }, []);

  const autoDirector = useCallback((count?: 5 | 10 | 20 | 50) => {
    const format = bridgeRef.current.getViewportFormat();
    const c = count ?? getState().variationCount;
    bridgeRef.current.setAppState((prev) => runAutoDirector(prev, c, format));
    bridgeRef.current.invalidateScene();
  }, [getState]);

  const selectVariation = useCallback((variationId: string) => {
    bridgeRef.current.setAppState((prev) => applyVariation(prev, variationId));
    bridgeRef.current.invalidateScene();
  }, []);

  const setLighting = useCallback((preset: CinematicLightingPresetId) => {
    bridgeRef.current.setAppState((prev) => applyVcsLighting(prev, preset));
    bridgeRef.current.invalidateScene();
  }, []);

  const analyzeQuality = useCallback(() => {
    return analyzeVisualQuality(bridgeRef.current.getAppState());
  }, []);

  const safeCameraSnapshot = useCallback((snapshot: CameraSnapshot): CameraSnapshot => {
    const app = bridgeRef.current.getAppState();
    const profiles = Object.values(app.vcs?.characterProfiles ?? {});
    const profile = mergeCharacterProfiles(profiles);
    if (!app.vcs?.safeCamera) return snapshot;
    return constrainToSafeVolume(snapshot, profile).snapshot;
  }, []);

  const getActiveProfile = useCallback(() => {
    const profiles = Object.values(bridgeRef.current.getAppState().vcs?.characterProfiles ?? {});
    return mergeCharacterProfiles(profiles);
  }, []);

  const saveCameraFromTimeline = useCallback((name: string) => {
    bridgeRef.current.setAppState((prev) =>
      createCameraFromSnapshot(prev, name, prev.cameraKeyframes)
    );
  }, []);

  const duplicateCamera = useCallback((cameraId: string) => {
    bridgeRef.current.setAppState((prev) => duplicateVcsCamera(prev, cameraId));
  }, []);

  const deleteCamera = useCallback((cameraId: string) => {
    bridgeRef.current.setAppState((prev) => deleteVcsCamera(prev, cameraId));
  }, []);

  const renameCamera = useCallback((cameraId: string, name: string) => {
    bridgeRef.current.setAppState((prev) => renameVcsCamera(prev, cameraId, name));
  }, []);

  const activateCamera = useCallback((cameraId: string) => {
    bridgeRef.current.setAppState((prev) => activateVcsCamera(prev, cameraId));
    bridgeRef.current.invalidateScene();
  }, []);

  const addShot = useCallback((name: string, cameraId?: string) => {
    bridgeRef.current.setAppState((prev) => addVcsShot(prev, name, cameraId));
  }, []);

  const deleteShot = useCallback((shotId: string) => {
    bridgeRef.current.setAppState((prev) => deleteVcsShot(prev, shotId));
  }, []);

  const applyShots = useCallback(() => {
    bridgeRef.current.setAppState((prev) => applyShotsToTimeline(prev));
    bridgeRef.current.invalidateScene();
  }, []);

  const setFocusTarget = useCallback((focusTarget: VcsFocusTarget) => {
    patch({ focusTarget, enabled: true });
  }, [patch]);

  const patchRenderQuality = useCallback(
    (renderQuality: VcsState['renderQuality'], adaptivePerformance: boolean) => {
      bridgeRef.current.setAppState((prev) => {
        let next = applyVcsPatch(prev, { renderQuality, adaptivePerformance, enabled: true });
        next = applyCinematicEnginePatch(next, {
          enabled: true,
          adaptiveEffects: adaptivePerformance,
          effectQuality: renderQuality === 'auto' ? 'auto' : renderQuality,
        });
        return next;
      });
      bridgeRef.current.invalidateScene();
    },
    []
  );

  const patchVisualFx = useCallback((fx: Partial<VisualFxSettings>) => {
    bridgeRef.current.setAppState((prev) => ({
      ...prev,
      visualFx: { ...prev.visualFx, ...fx },
    }));
    bridgeRef.current.invalidateScene();
  }, []);

  const analyzeReference = useCallback(async (file: File) => {
    const result = await analyzeReferenceVideo(file);
    const text = formatReferenceAnalysis(result);
    patch({
      enabled: true,
      referenceVideoName: file.name,
      referenceAnalysis: text,
    });
    return result;
  }, [patch]);

  return {
    getState,
    patch,
    enableSystem,
    analyzeModel,
    setDirectorMode,
    autoDirector,
    selectVariation,
    setLighting,
    analyzeQuality,
    safeCameraSnapshot,
    getActiveProfile,
    saveCameraFromTimeline,
    duplicateCamera,
    deleteCamera,
    renameCamera,
    activateCamera,
    addShot,
    deleteShot,
    applyShots,
    setFocusTarget,
    patchRenderQuality,
    patchVisualFx,
    analyzeReference,
  };
}

export type VcsApi = ReturnType<typeof useVcs>;
