import { useCallback, useRef, useState } from 'react';
import type { AppState, CameraSnapshot, ViewportFormat } from '../types';
import {
  applyPatchToState,
  prepareSmartStudio,
  restoreSmartSnapshot,
} from './applySmartStudio';
import { captureSmartStill, type StillExportKind } from './captureStill';
import type {
  SmartCameraPreset,
  SmartExpressionId,
  SmartPhotoPreset,
  SmartStudioMode,
  SmartStudioPhase,
  SmartStudioReport,
  SmartStudioSnapshot,
  SmartStudioState,
  SmartVideoPath,
  SmartVideoPreset,
} from './types';
import { pickSmartExpression } from './expressions';
import { buildSmartStudioPatch } from './buildSmartPatch';

export interface SmartStudioBridge {
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  getAppState: () => AppState;
  flyToCamera: (snapshot: CameraSnapshot) => void;
  applyCameraMode: (mode: 'follow' | 'duo' | 'orbit' | 'closeUp') => void;
  applyTemplate: (templateId: string, mode?: 'merge' | 'replace') => void;
  fixPhysics: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  startVideoRecord: () => void;
  setViewportFormat?: (format: ViewportFormat) => void;
  invalidateScene?: () => void;
  setModelActiveVmdIndex?: (modelId: string, index: number) => void;
}

const INITIAL: SmartStudioState = {
  active: false,
  mode: null,
  phase: 'idle',
  profile: null,
  report: null,
  reportVisible: false,
  cameraPreset: 'orbit',
  photoPreset: 'portrait',
  videoPreset: 'youtube_shorts',
  videoPath: 'hero_orbit',
  expression: 'idle',
  background: 'studio',
  hideEditorChrome: false,
  activeAnimationId: null,
  activeAnimationLabel: null,
  statusMessage: null,
};

export function useSmartStudio(bridge: SmartStudioBridge) {
  const [state, setState] = useState<SmartStudioState>(INITIAL);
  const snapshotRef = useRef<SmartStudioSnapshot | null>(null);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  const setStatus = useCallback((message: string | null, ms = 2800) => {
    setState((prev) => ({ ...prev, statusMessage: message }));
    if (message) {
      window.setTimeout(() => {
        setState((prev) =>
          prev.statusMessage === message ? { ...prev, statusMessage: null } : prev
        );
      }, ms);
    }
  }, []);

  const enter = useCallback(async (mode: SmartStudioMode) => {
    const b = bridgeRef.current;
    const appState = b.getAppState();
    const prepared = prepareSmartStudio(appState, mode);
    if ('error' in prepared) {
      window.alert(prepared.error);
      return;
    }

    setState((prev) => ({
      ...prev,
      active: true,
      mode,
      phase: 'preparing',
      profile: prepared.profile,
      report: null,
      reportVisible: false,
      hideEditorChrome: true,
      cameraPreset: prepared.report.cameraPreset,
      background: prepared.report.background,
      expression: prepared.report.expression,
      activeAnimationId: prepared.patch.applyIdleTemplate ? 'char_idle_blink' : null,
      activeAnimationLabel: prepared.patch.applyIdleTemplate ? 'Idle Blink' : null,
      statusMessage: null,
    }));

    snapshotRef.current = prepared.snapshot;
    b.setAppState((prev) => applyPatchToState(prev, prepared.patch));

    await new Promise((r) => setTimeout(r, 80));
    try {
      b.fixPhysics();
    } catch {
      /* physics may be off */
    }

    await new Promise((r) => setTimeout(r, 200));

    if (prepared.patch.cameraSnapshot) {
      b.flyToCamera(prepared.patch.cameraSnapshot);
    }
    if (prepared.patch.productCameraMode) {
      b.applyCameraMode(prepared.patch.productCameraMode);
    }
    if (prepared.patch.applyIdleTemplate) {
      b.applyTemplate('char_idle_blink', 'merge');
    }
    if (prepared.patch.viewportFormat && b.setViewportFormat) {
      b.setViewportFormat(prepared.patch.viewportFormat);
    }

    b.invalidateScene?.();
    await new Promise((r) => setTimeout(r, 400));

    setState((prev) => ({
      ...prev,
      phase: 'ready',
      report: prepared.report,
      reportVisible: true,
    }));
  }, []);

  const exit = useCallback(() => {
    const snap = snapshotRef.current;
    if (snap) {
      bridgeRef.current.setAppState((prev) => restoreSmartSnapshot(prev, snap));
    }
    snapshotRef.current = null;
    setState(INITIAL);
  }, []);

  const setPhase = useCallback((phase: SmartStudioPhase) => {
    setState((prev) => ({ ...prev, phase }));
  }, []);

  const dismissReport = useCallback(() => {
    setState((prev) => ({
      ...prev,
      reportVisible: false,
      phase: prev.phase === 'preparing' ? 'preparing' : 'ready',
    }));
  }, []);

  const recaptureReport = useCallback(
    (overrides: {
      cameraPreset?: SmartCameraPreset;
      photoPreset?: SmartPhotoPreset;
      videoPreset?: SmartVideoPreset;
      videoPath?: SmartVideoPath;
      expression?: SmartExpressionId;
    } = {}): SmartStudioReport | null => {
      const mode = state.mode;
      const profile = state.profile;
      if (!mode || !profile) return null;

      const expression = overrides.expression ?? pickSmartExpression();
      const { patch, report } = buildSmartStudioPatch(mode, profile, {
        cameraPreset: overrides.cameraPreset ?? state.cameraPreset,
        photoPreset: overrides.photoPreset ?? state.photoPreset,
        videoPreset: overrides.videoPreset ?? state.videoPreset,
        videoPath: overrides.videoPath ?? state.videoPath,
        expression,
        maxFrames: bridgeRef.current.getAppState().maxFrames,
      });

      bridgeRef.current.setAppState((prev) => applyPatchToState(prev, patch));
      if (patch.cameraSnapshot) {
        bridgeRef.current.flyToCamera(patch.cameraSnapshot);
      }
      if (patch.productCameraMode) {
        bridgeRef.current.applyCameraMode(patch.productCameraMode);
      }
      bridgeRef.current.invalidateScene?.();

      setState((prev) => ({
        ...prev,
        report: { ...report, expression },
        reportVisible: true,
        expression,
        cameraPreset: report.cameraPreset,
        background: report.background,
        phase: 'ready',
      }));

      return report;
    },
    [state.mode, state.profile, state.cameraPreset, state.photoPreset, state.videoPreset, state.videoPath]
  );

  const takeScreenshot = useCallback(
    async (kind: StillExportKind = 'png') => {
      const b = bridgeRef.current;
      const prev = b.getAppState();
      const wasPlaying = prev.isPlaying;
      const photoMode = state.mode === 'photo';

      setState((s) => ({ ...s, phase: 'photo', reportVisible: false }));

      // Keep frameloop="always" so WebGL color buffer is filled (preserveDrawingBuffer is off).
      b.setAppState((s) => ({
        ...s,
        isPlaying: true,
        physicsMode: 'off',
      }));
      b.invalidateScene?.();

      const result = await captureSmartStill({
        canvas: b.getCanvas(),
        kind,
        invalidate: () => b.invalidateScene?.(),
        settleFrames: 4,
      });

      b.setAppState((s) => ({
        ...s,
        isPlaying: photoMode ? false : wasPlaying,
        physicsMode: photoMode ? 'off' : wasPlaying ? 'playtime' : s.physicsMode,
      }));

      setState((s) => ({ ...s, phase: 'ready' }));
      setStatus(result.message);
      if (!result.ok) {
        window.alert(result.message);
      }
      return result;
    },
    [setStatus, state.mode]
  );

  const startRecording = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'recording', reportVisible: false }));
    bridgeRef.current.setAppState((prev) => ({
      ...prev,
      isPlaying: true,
      currentFrame: 0,
      physicsMode: 'playtime',
    }));
    bridgeRef.current.startVideoRecord();
    setStatus('Recording…');
  }, [setStatus]);

  const cycleExpression = useCallback(() => {
    recaptureReport({ expression: pickSmartExpression() });
  }, [recaptureReport]);

  const cycleCamera = useCallback(() => {
    const presets: SmartCameraPreset[] = [
      'portrait',
      'half_body',
      'full_body',
      'hero',
      'close_face',
      'anime',
      'orbit',
      'dynamic',
    ];
    const idx = presets.indexOf(state.cameraPreset);
    const next = presets[(idx + 1) % presets.length]!;
    recaptureReport({ cameraPreset: next });
  }, [recaptureReport, state.cameraPreset]);

  const applyAnimationTemplate = useCallback(
    (templateId: string, label: string) => {
      const b = bridgeRef.current;
      b.applyTemplate(templateId, 'replace');
      b.setAppState((prev) => ({
        ...prev,
        isPlaying: true,
        currentFrame: 0,
        models: prev.models.map((m) =>
          m.id === prev.selectedObjectId || (!prev.selectedObjectId && m.id === prev.models[0]?.id)
            ? {
                ...m,
                vmdPlaybackEnabled: false,
                activeTemplateId: templateId,
                poseHold: null,
              }
            : m
        ),
      }));
      b.invalidateScene?.();
      setState((prev) => ({
        ...prev,
        activeAnimationId: templateId,
        activeAnimationLabel: label,
        phase: 'ready',
        reportVisible: false,
      }));
      setStatus(`Animation: ${label}`);
    },
    [setStatus]
  );

  const applyVmdMotion = useCallback(
    (modelId: string, index: number, label: string) => {
      const b = bridgeRef.current;
      b.setModelActiveVmdIndex?.(modelId, index);
      b.setAppState((prev) => ({
        ...prev,
        isPlaying: true,
        currentFrame: 0,
        models: prev.models.map((m) =>
          m.id === modelId
            ? {
                ...m,
                activeVmdIndex: index,
                vmdPlaybackEnabled: true,
                hasVmdAnimation: true,
                activeTemplateId: null,
                poseHold: null,
              }
            : m
        ),
      }));
      b.invalidateScene?.();
      setState((prev) => ({
        ...prev,
        activeAnimationId: `vmd:${index}`,
        activeAnimationLabel: label,
        phase: 'ready',
        reportVisible: false,
      }));
      setStatus(`Motion: ${label}`);
    },
    [setStatus]
  );

  return {
    state,
    enter,
    exit,
    setPhase,
    dismissReport,
    takeScreenshot,
    startRecording,
    cycleExpression,
    cycleCamera,
    recaptureReport,
    applyAnimationTemplate,
    applyVmdMotion,
  };
}

export type SmartStudioApi = ReturnType<typeof useSmartStudio>;
