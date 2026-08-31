import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useRef } from 'react';
import type { AppState, ViewportFormat } from '../../types';
import type {
  CinematicCameraMode,
  CinematicEngineState,
  CinematicExportProfileId,
  CinematicLightingPresetId,
  VisualQualityReport,
} from './types';
import { DEFAULT_CINEMATIC_ENGINE } from './types';
import {
  applyCinematicCameraPath,
  applyCinematicEnginePatch,
  applyCinematicLighting,
} from './applyCinematic';
import { analyzeVisualQuality } from './quality/visualAnalyzer';
import { applyEffectQualityBudget, suggestQualityModeFromFps } from './quality/adaptive';
import { prepareCinematicExport } from './export/prepareExport';
import { resolveExportProfile } from './export/profiles';
import { pickCinematicModeForMotion } from './camera/pathGenerator';

export interface CinematicEngineBridge {
  getAppState: () => AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  setViewportFormat: (format: ViewportFormat) => void;
  setQualityMode: (mode: import('../scene/types').QualityMode) => void;
  invalidateScene: () => void;
}

export function useCinematicEngine(bridge: CinematicEngineBridge) {
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  const getState = useCallback((): CinematicEngineState => {
    return bridgeRef.current.getAppState().cinematic ?? DEFAULT_CINEMATIC_ENGINE;
  }, []);

  const patchEngine = useCallback((patch: Partial<CinematicEngineState>) => {
    bridgeRef.current.setAppState((prev) => applyCinematicEnginePatch(prev, patch));
  }, []);

  const enable = useCallback(() => {
    patchEngine({ enabled: true });
  }, [patchEngine]);

  const setCameraMode = useCallback(
    (mode: CinematicCameraMode, motionIntensity = 0.5) => {
      const app = bridgeRef.current.getAppState();
      const viewportFormat: ViewportFormat =
        app.sceneComposer?.bgMode === 'scene' ? '16:9' : '9:16';
      bridgeRef.current.setAppState((prev) =>
        applyCinematicCameraPath(prev, mode, viewportFormat, motionIntensity)
      );
      bridgeRef.current.invalidateScene();
    },
    []
  );

  const applyLighting = useCallback((preset: CinematicLightingPresetId) => {
    bridgeRef.current.setAppState((prev) => applyCinematicLighting(prev, preset));
    bridgeRef.current.invalidateScene();
  }, []);

  const autoCameraForMotion = useCallback(
    (motionIntensity: number, viewportFormat: ViewportFormat) => {
      const mode = pickCinematicModeForMotion(motionIntensity, viewportFormat);
      bridgeRef.current.setAppState((prev) =>
        applyCinematicCameraPath(prev, mode, viewportFormat, motionIntensity)
      );
      bridgeRef.current.invalidateScene();
      return mode;
    },
    []
  );

  const analyzeQuality = useCallback((): VisualQualityReport => {
    const report = analyzeVisualQuality(bridgeRef.current.getAppState());
    patchEngine({ lastVisualScore: report.score });
    return report;
  }, [patchEngine]);

  const prepareExport = useCallback((profileId: CinematicExportProfileId) => {
    const app = bridgeRef.current.getAppState();
    const profile = resolveExportProfile(profileId);
    const { appStatePatch } = prepareCinematicExport(app, profile);
    bridgeRef.current.setViewportFormat(profile.viewportFormat);
    bridgeRef.current.setQualityMode(profile.qualityMode);
    bridgeRef.current.setAppState((prev) => ({
      ...prev,
      ...appStatePatch,
      visualFx: appStatePatch.visualFx ?? prev.visualFx,
      sceneComposer: appStatePatch.sceneComposer ?? prev.sceneComposer,
    }));
    return profile;
  }, []);

  const tickAdaptiveQuality = useCallback((fps: number) => {
    const engine = getState();
    if (!engine.adaptiveEffects) return;
    const qualityMode = suggestQualityModeFromFps(fps);
    bridgeRef.current.setQualityMode(qualityMode);
    bridgeRef.current.setAppState((prev) => ({
      ...prev,
      visualFx: applyEffectQualityBudget(
        prev.visualFx,
        engine.effectQuality,
        fps
      ),
    }));
  }, [getState]);

  return {
    getState,
    enable,
    patchEngine,
    setCameraMode,
    applyLighting,
    autoCameraForMotion,
    analyzeQuality,
    prepareExport,
    tickAdaptiveQuality,
  };
}

export type CinematicEngineApi = ReturnType<typeof useCinematicEngine>;
