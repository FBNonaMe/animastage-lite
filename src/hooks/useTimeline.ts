import { useCallback, useEffect, useRef } from 'react';
import type {
  AppState,
  CameraSnapshot,
  TemplateApplyMode,
  TemplateApplyOptions,
  TimelineActiveTrack,
  TimelineTrackId,
  VisualFxSettings,
} from '../types';
import {
  addCameraKeyframe,
  deleteCameraKeyframe,
  mergeCameraKeyframes,
  sanitizeCameraKeyframes,
} from '../components/CameraLogic';
import { getStageTargetTuple } from '../scene/cameraFraming';
import {
  deleteKeyframe,
  mergeTimelineKeyframes,
  registerAllKeyframesAtFrame,
} from '../components/TimelineLogic';
import { getAnimationTemplate, visualFxFromTemplate, DEFAULT_VISUAL_FX } from '../templates/animationTemplates';
import { playheadRef, MMD_FPS, setPlayheadFrame } from '../utils/playhead';

interface UseTimelineOptions {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  captureCameraRef?: React.MutableRefObject<(() => CameraSnapshot | null) | null>;
  /** Snapshot before timeline/camera mutations for global undo stack. */
  recordGlobalUndo?: () => void;
}

export function useTimeline({
  appState,
  setAppState,
  captureCameraRef,
  recordGlobalUndo,
}: UseTimelineOptions) {
  const maxFramesRef = useRef(appState.maxFrames);

  useEffect(() => {
    maxFramesRef.current = appState.maxFrames;
  }, [appState.maxFrames]);

  useEffect(() => {
    if (!appState.isPlaying) {
      setPlayheadFrame(appState.currentFrame);
    }
  }, [appState.currentFrame, appState.isPlaying]);

  const setCurrentFrame = useCallback(
    (frame: number) => {
      setPlayheadFrame(frame);
      setAppState((prev) => ({
        ...prev,
        currentFrame: frame,
        isPlaying: false,
      }));
    },
    [setAppState]
  );

  const setMaxFrames = useCallback(
    (frames: number) => {
      setAppState((prev) => ({ ...prev, maxFrames: Math.max(10, frames) }));
    },
    [setAppState]
  );

  const setIsPlaying = useCallback(
    (playing: boolean) => {
      setAppState((prev) => {
        if (playing) {
          setPlayheadFrame(prev.currentFrame);
          return { ...prev, isPlaying: true };
        }
        const frame = Math.floor(playheadRef.current);
        setPlayheadFrame(frame);
        return { ...prev, isPlaying: false, currentFrame: frame };
      });
    },
    [setAppState]
  );

  const setTimelineActiveTrack = useCallback(
    (track: TimelineActiveTrack) => {
      setAppState((prev) => ({ ...prev, timelineActiveTrack: track }));
    },
    [setAppState]
  );

  const setCameraMode = useCallback(
    (mode: AppState['cameraMode']) => {
      setAppState((prev) => ({
        ...prev,
        cameraMode: mode,
        ...(mode === 'free'
          ? {
              timelineActiveTrack:
                prev.timelineActiveTrack === 'camera' ? null : prev.timelineActiveTrack,
              cameraStudio: {
                ...prev.cameraStudio,
                autoFocus: false,
                directPlacement: true,
              },
            }
          : {}),
      }));
    },
    [setAppState]
  );

  const setVisualFx = useCallback(
    (patch: Partial<VisualFxSettings>) => {
      setAppState((prev) => ({
        ...prev,
        visualFx: { ...prev.visualFx, ...patch },
      }));
    },
    [setAppState]
  );

  const replaceVisualFx = useCallback(
    (next: VisualFxSettings) => {
      setAppState((prev) => ({ ...prev, visualFx: next }));
    },
    [setAppState]
  );

  const handleRegisterKeyframe = useCallback(
    (modelId: string) => {
      recordGlobalUndo?.();
      setAppState((prev) => {
        const frame = prev.currentFrame;

        if (prev.timelineActiveTrack === 'camera') {
          const snapshot = captureCameraRef?.current?.();
          if (!snapshot) return prev;
          return {
            ...prev,
            cameraMode: 'mmd',
            cameraKeyframes: addCameraKeyframe(prev.cameraKeyframes, frame, snapshot),
          };
        }

        if (!modelId) return prev;

        return {
          ...prev,
          models: prev.models.map((m) => {
            if (m.id !== modelId) return m;
            return {
              ...m,
              keyframes: registerAllKeyframesAtFrame(m.keyframes, frame, m.morphs, m.bones),
              // Unlock timeline: VMD must not own the pose when user keys the body.
              vmdPlaybackEnabled: m.hasVmdAnimation ? false : m.vmdPlaybackEnabled,
              activeTemplateId: null,
              clipDirty: true,
            };
          }),
        };
      });
    },
    [captureCameraRef, recordGlobalUndo, setAppState]
  );

  const handleRegisterCameraKeyframe = useCallback(() => {
    recordGlobalUndo?.();
    setAppState((prev) => {
      const frame = prev.currentFrame;
      const snapshot = captureCameraRef?.current?.();
      if (!snapshot) return prev;
      return {
        ...prev,
        cameraMode: 'mmd',
        timelineActiveTrack: 'camera',
        cameraStudio: {
          ...prev.cameraStudio,
          manualCameraLock: false,
          autoFocus: false,
        },
        cameraKeyframes: addCameraKeyframe(prev.cameraKeyframes, frame, snapshot),
      };
    });
  }, [captureCameraRef, recordGlobalUndo, setAppState]);

  const handleDeleteKeyframe = useCallback(
    (modelId: string, trackName: string, frame: number) => {
      recordGlobalUndo?.();
      setAppState((prev) => {
        if (trackName === 'camera') {
          return {
            ...prev,
            cameraKeyframes: deleteCameraKeyframe(prev.cameraKeyframes, frame),
          };
        }

        return {
          ...prev,
          models: prev.models.map((m) => {
            if (m.id !== modelId) return m;
            return {
              ...m,
              keyframes: deleteKeyframe(m.keyframes, trackName as TimelineTrackId, frame),
            };
          }),
        };
      });
    },
    [recordGlobalUndo, setAppState]
  );

  const handleClearAllKeyframes = useCallback(() => {
    recordGlobalUndo?.();
    setPlayheadFrame(0);
    setAppState((prev) => {
      const modelId = prev.selectedObjectId;
      return {
        ...prev,
        cameraKeyframes: [],
        visualFx: { ...DEFAULT_VISUAL_FX },
        cameraMode: 'free',
        currentFrame: 0,
        isPlaying: false,
        models: prev.models.map((m) =>
          modelId && m.id === modelId
            ? { ...m, keyframes: [], activeTemplateId: null }
            : m
        ),
      };
    });
  }, [recordGlobalUndo, setAppState]);

  const handleApplyTemplate = useCallback(
    (templateId: string, mode: TemplateApplyMode = 'merge', options: TemplateApplyOptions = {}) => {
      const template = getAnimationTemplate(templateId);
      if (!template) return;

      const useTemplateCamera = options.useTemplateCamera === true;

      setAppState((prev) => {
        const modelId = prev.selectedObjectId;
        const needsModel =
          template.category === 'character' ||
          template.category === 'dance' ||
          template.category === 'emote' ||
          (template.category === 'combo' && template.generateModelKeyframes);

        if (needsModel && !modelId) return prev;

        let cameraKeyframes = prev.cameraKeyframes;
        let cameraMode = prev.cameraMode;
        let timelineActiveTrack = prev.timelineActiveTrack;
        let models = prev.models;
        let visualFx = prev.visualFx;
        let cameraStudio = prev.cameraStudio;

        const incomingCamera =
          useTemplateCamera && template.generateCameraKeyframes
            ? template.generateCameraKeyframes(prev.maxFrames)
            : null;
        const incomingModel =
          template.generateModelKeyframes && modelId
            ? template.generateModelKeyframes(prev.maxFrames)
            : null;

        if (incomingCamera) {
          const safeCamera = sanitizeCameraKeyframes(
            mode === 'merge'
              ? mergeCameraKeyframes(prev.cameraKeyframes, incomingCamera)
              : incomingCamera
          );
          cameraKeyframes = safeCamera;
          cameraMode = 'mmd';
          timelineActiveTrack = timelineActiveTrack ?? 'camera';
          cameraStudio = {
            ...prev.cameraStudio,
            autoFocus: false,
            manualCameraLock: false,
          };
        } else if (incomingModel) {
          // Motion only — keep user's free camera; don't chase bones during dance.
          if (mode === 'replace' && !options.preserveCameraKeyframes) {
            cameraKeyframes = [];
          }
          cameraMode = 'free';
          timelineActiveTrack = null;
          cameraStudio = {
            ...prev.cameraStudio,
            autoFocus: false,
            manualCameraLock: true,
            directPlacement: true,
          };
        }

        const cameraOrbitAnchor = incomingCamera
          ? getStageTargetTuple()
          : prev.cameraOrbitAnchor;

        const visibleModels = prev.models.filter((m) => m.visible);
        const applyToAllVisible =
          Boolean(incomingModel) &&
          visibleModels.length >= 2 &&
          (template.category === 'character' ||
            template.category === 'dance' ||
            template.category === 'emote' ||
            (template.category === 'combo' && template.generateModelKeyframes));

        if (applyToAllVisible) {
          models = prev.models.map((m) => {
            if (!m.visible) return m;
            return {
              ...m,
              activeTemplateId: templateId,
              keyframes:
                mode === 'merge'
                  ? mergeTimelineKeyframes(m.keyframes, incomingModel!)
                  : incomingModel!,
              vmdPlaybackEnabled: false,
            };
          });
        } else if (modelId) {
          models = prev.models.map((m) => {
            if (m.id !== modelId) return m;
            const next: typeof m = {
              ...m,
              activeTemplateId: templateId,
            };
            if (incomingModel) {
              next.keyframes =
                mode === 'merge'
                  ? mergeTimelineKeyframes(m.keyframes, incomingModel)
                  : incomingModel;
              next.vmdPlaybackEnabled = false;
            }
            return next;
          });
        }

        if (template.visualFx?.bloom) {
          visualFx = visualFxFromTemplate(template.visualFx);
        }

        const resetTransport = mode === 'replace';
        const startedTemplate =
          Boolean(incomingModel && modelId) || Boolean(incomingCamera);

        if (incomingModel && modelId) {
          setPlayheadFrame(0);
        }

        let maxFrames = prev.maxFrames;
        if (incomingModel || incomingCamera) {
          const modelEnd = incomingModel?.reduce((max, k) => Math.max(max, k.frame), 0) ?? 0;
          const cameraEnd =
            incomingCamera?.reduce((max, k) => Math.max(max, k.frame), 0) ?? 0;
          const templateEnd = Math.max(10, modelEnd, cameraEnd);
          maxFrames =
            mode === 'replace' ? templateEnd : Math.max(prev.maxFrames, templateEnd);
        }

        const autoPlayModel = Boolean(
          incomingModel && (applyToAllVisible || modelId)
        );

        return {
          ...prev,
          maxFrames,
          cameraKeyframes,
          cameraOrbitAnchor,
          cameraMode,
          cameraStudio,
          timelineActiveTrack,
          models,
          visualFx,
          ...(resetTransport || startedTemplate
            ? { currentFrame: 0, isPlaying: autoPlayModel }
            : autoPlayModel
              ? { isPlaying: true }
              : {}),
        };
      });
    },
    [setAppState]
  );

  const handleAddSampleKeyframes = useCallback(() => {
    handleApplyTemplate('char_wave', 'replace');
  }, [handleApplyTemplate]);

  useEffect(() => {
    if (!appState.isPlaying) return;
    let raf = 0;
    let last = performance.now();

    let lastPublished = -1;

    const tick = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;

      playheadRef.current += (dt / 1000) * MMD_FPS;
      if (playheadRef.current > maxFramesRef.current) {
        playheadRef.current = 0;
      }

      const frame = Math.floor(playheadRef.current);
      if (frame !== lastPublished) {
        lastPublished = frame;
        setAppState((prev) => {
          if (!prev.isPlaying) return prev;
          return prev.currentFrame === frame ? prev : { ...prev, currentFrame: frame };
        });
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [appState.isPlaying, setAppState]);

  return {
    setCurrentFrame,
    setMaxFrames,
    setIsPlaying,
    setTimelineActiveTrack,
    setCameraMode,
    setVisualFx,
    replaceVisualFx,
    handleRegisterKeyframe,
    handleRegisterCameraKeyframe,
    handleDeleteKeyframe,
    handleAddSampleKeyframes,
    handleApplyTemplate,
    handleClearAllKeyframes,
  };
}
