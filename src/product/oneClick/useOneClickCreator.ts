import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { AppState, CameraSnapshot, ViewportFormat } from '../../types';
import type { QualityMode } from '../scene/types';
import { applyShortsPipeline, type ShortsPipelineBridge } from '../shorts/applyShortsPipeline';
import { durationSecToFrames } from '../templates/duration';
import { buildAutoBeautifyPatch } from '../ux/beautify';
import type { ExportFormatId } from '../../smartMetadata/types';
import { snapshotForCameraMode } from './autoCamera';
import { resolveAutoPerformance } from './deviceTier';
import {
  getMotionEntry,
  pushMotionRecent,
  toggleMotionFavorite,
  loadMotionFavorites,
} from './motionLibrary';
import { generateSceneVariations, buildAutoScenePatch, pickBestVariation } from './sceneScorer';
import { captureThumbnailCandidates } from './thumbnailPicker';
import {
  applyCinematicEnginePatch,
} from '../cinematic/applyCinematic';
import { applyDirectorMode } from '../vcs/applyVcs';
import { pickVcsDirectorMode } from '../vcs/camera/directorModes';
import {
  pickExportProfileForPlatform,
  prepareCinematicExport,
  resolveExportProfile,
} from '../cinematic';
import { getDefaultStyleCard } from './visualStyleCards';
import type {
  ExportPlatformId,
  MotionCategoryId,
  OneClickCreatorState,
  OneClickStep,
} from './types';

export interface OneClickCreatorBridge {
  getAppState: () => AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  loadDemo: (demoId: string) => Promise<void>;
  loadCustomModel: (files: FileList | File[]) => void;
  applyTemplate: (
    templateId: string,
    mode?: 'merge' | 'replace',
    options?: { useTemplateCamera?: boolean; preserveCameraKeyframes?: boolean }
  ) => void;
  applyStyle: (styleId: string) => void;
  fixPhysics: () => void;
  flyToCamera: (snapshot: CameraSnapshot) => void;
  setViewportFormat: (format: ViewportFormat) => void;
  setQualityMode: (mode: QualityMode) => void;
  setExportDurationSec: (sec: number) => void;
  setPlaying: (playing: boolean) => void;
  enterCameraEdit: () => void;
  registerCameraKeyframe: () => void;
  prepareMetadata: (mode: ExportFormatId) => void;
  startExport: () => void;
  captureFrame: () => string | null;
  setCurrentFrame: (frame: number) => void;
  invalidateScene: () => void;
  makeShortsBridge: () => ShortsPipelineBridge;
  onExportDone?: (fileName: string | null) => void;
}

const INITIAL_STATE = (): OneClickCreatorState => {
  const perf = resolveAutoPerformance();
  return {
    active: false,
    step: 'character',
    characterReady: false,
    selectedMotionId: null,
    selectedStyleId: getDefaultStyleCard().id,
    selectedPlatform: 'youtube_shorts',
    showcaseCount: 10,
    sceneVariations: [],
    selectedVariationId: null,
    thumbnails: [],
    selectedThumbnailFrame: null,
    preparing: false,
    exporting: false,
    statusMessage: null,
    deviceClass: perf.deviceClass,
    gpuTier: perf.gpuTier,
    qualityMode: perf.qualityMode,
    exportFileName: null,
    panelMinimized: false,
  };
};

function platformToViewport(platform: ExportPlatformId): ViewportFormat {
  if (platform === 'youtube' || platform === 'x') return '16:9';
  return '9:16';
}

export function useOneClickCreator(bridge: OneClickCreatorBridge) {
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  const [state, setState] = useState<OneClickCreatorState>(INITIAL_STATE);
  const favoritesRef = useRef(loadMotionFavorites());

  const setStatus = useCallback((message: string | null, ms = 2400) => {
    setState((prev) => ({ ...prev, statusMessage: message }));
    if (message) {
      window.setTimeout(() => {
        setState((prev) =>
          prev.statusMessage === message ? { ...prev, statusMessage: null } : prev
        );
      }, ms);
    }
  }, []);

  const enter = useCallback(() => {
    const perf = resolveAutoPerformance();
    setState({
      ...INITIAL_STATE(),
      active: true,
      deviceClass: perf.deviceClass,
      gpuTier: perf.gpuTier,
      qualityMode: perf.qualityMode,
    });
  }, []);

  const exit = useCallback(() => {
    setState(INITIAL_STATE());
  }, []);

  const goToStep = useCallback((step: OneClickStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const markCharacterReady = useCallback(() => {
    setState((prev) => ({
      ...prev,
      characterReady: true,
      step: 'motion',
      panelMinimized: true,
    }));
    setStatus('Character loaded — preview the scene, then pick a motion');
  }, [setStatus]);

  const loadDemoCharacter = useCallback(async () => {
    setState((prev) => ({ ...prev, preparing: true }));
    try {
      await bridgeRef.current.loadDemo('party-dance');
      markCharacterReady();
    } finally {
      setState((prev) => ({ ...prev, preparing: false }));
    }
  }, [markCharacterReady]);

  const handleCharacterImport = useCallback(
    (files: FileList | File[]) => {
      bridgeRef.current.loadCustomModel(files);
      window.setTimeout(() => {
        const models = bridgeRef.current.getAppState().models;
        if (models.length > 0) markCharacterReady();
      }, 400);
    },
    [markCharacterReady]
  );

  const runAutoPrepare = useCallback(async (opts?: { forExport?: boolean }) => {
    const b = bridgeRef.current;
    const appState = b.getAppState();
    const motion = state.selectedMotionId ? getMotionEntry(state.selectedMotionId) : null;
    const userCameraKeys = appState.cameraKeyframes.length > 0;
    const preserveCamera = Boolean(opts?.forExport || userCameraKeys);

    b.setQualityMode(state.qualityMode);

    const autoScene = buildAutoScenePatch(appState);
    b.setAppState((prev): AppState => ({
      ...prev,
      visualFx: { ...prev.visualFx, ...autoScene.visualFx },
      sceneComposer: {
        ...prev.sceneComposer,
        ...autoScene.composer,
        lights: {
          ...prev.sceneComposer.lights,
          ...(autoScene.composer.lights ?? {}),
        },
        effectLevels: {
          ...prev.sceneComposer.effectLevels,
          ...(autoScene.composer.effectLevels ?? {}),
        },
      },
      sceneBackground: autoScene.sceneBackground
        ? { ...prev.sceneBackground, ...autoScene.sceneBackground }
        : prev.sceneBackground,
    }));

    const beautify = buildAutoBeautifyPatch(appState.models.length, appState.hasCameraVmd);
    b.setAppState((prev) => ({
      ...prev,
      visualFx: { ...prev.visualFx, ...beautify.visualFx },
      characterQuality: beautify.characterQuality,
      cameraMode: 'mmd',
      timelineActiveTrack: 'camera',
      cameraStudio: {
        ...prev.cameraStudio,
        ...beautify.cameraStudio,
        manualCameraLock: false,
        autoFocus: false,
      },
    }));

    if (state.selectedStyleId) {
      b.applyStyle(state.selectedStyleId);
    }

    try {
      b.fixPhysics();
    } catch {
      /* physics optional */
    }

    const format = platformToViewport(state.selectedPlatform);
    b.setViewportFormat(format);

    if (motion) {
      const maxFrames = durationSecToFrames(motion.durationSec);
      b.setAppState((prev) => ({
        ...prev,
        maxFrames,
        ...(preserveCamera ? {} : { currentFrame: 0, isPlaying: false }),
      }));

      if (opts?.forExport) {
        // Export: motion already applied — never re-apply template (would risk camera loss).
      } else if (preserveCamera) {
        b.applyTemplate(motion.templateId, 'replace', {
          useTemplateCamera: false,
          preserveCameraKeyframes: true,
        });
        pushMotionRecent(motion.id);
      } else {
        b.applyTemplate(motion.templateId, 'replace', { useTemplateCamera: false });
        pushMotionRecent(motion.id);
        b.enterCameraEdit();

        const hasKeys = b.getAppState().cameraKeyframes.length > 0;
        if (!hasKeys) {
          const intensity =
            motion.difficulty === 'easy' ? 0.45 : motion.difficulty === 'hard' ? 0.85 : 0.65;
          const mode = pickVcsDirectorMode(intensity, format);
          b.setAppState((prev) => {
            let next = applyDirectorMode(prev, mode, format);
            return applyCinematicEnginePatch(next, {
              enabled: true,
              handheld: false,
              collisionAvoidance: true,
              adaptiveEffects: true,
            });
          });
        }
      }
    }

    if (format === '9:16' && !preserveCamera) {
      const shortsBridge = b.makeShortsBridge();
      const dur = motion?.durationSec ?? 12;
      await applyShortsPipeline(shortsBridge, appState.models.length, dur);
    }

    if (preserveCamera) {
      b.setAppState((prev) => ({
        ...prev,
        cameraMode: 'mmd',
        timelineActiveTrack: 'camera',
        cameraStudio: {
          ...prev.cameraStudio,
          manualCameraLock: false,
          autoFocus: false,
        },
      }));
    }

    b.invalidateScene();
  }, [state.selectedMotionId, state.selectedStyleId, state.selectedPlatform, state.qualityMode]);

  const selectMotion = useCallback(
    async (motionId: string) => {
      setState((prev) => ({
        ...prev,
        selectedMotionId: motionId,
        step: 'style',
        preparing: true,
      }));

      const motion = getMotionEntry(motionId);
      if (!motion) {
        setState((prev) => ({ ...prev, preparing: false }));
        return;
      }

      bridgeRef.current.applyTemplate(motion.templateId, 'replace', { useTemplateCamera: false });
      bridgeRef.current.enterCameraEdit();
      bridgeRef.current.setExportDurationSec(motion.durationSec);
      bridgeRef.current.setAppState((prev) => ({
        ...prev,
        maxFrames: durationSecToFrames(motion.durationSec),
        currentFrame: 0,
        isPlaying: true,
      }));

      await new Promise((r) => setTimeout(r, 300));
      setState((prev) => ({ ...prev, preparing: false, panelMinimized: true }));
      setStatus(`Applied ${motion.name} — adjust camera in the viewport`);
    },
    [setStatus]
  );

  const selectStyle = useCallback(
    async (styleId: string) => {
      setState((prev) => ({
        ...prev,
        selectedStyleId: styleId,
        step: 'export',
        preparing: true,
      }));

      bridgeRef.current.applyStyle(styleId);
      await runAutoPrepare();

      const variations = generateSceneVariations(state.showcaseCount, styleId);
      const best = pickBestVariation(variations);

      setState((prev) => ({
        ...prev,
        sceneVariations: variations,
        selectedVariationId: best?.id ?? null,
        preparing: false,
        panelMinimized: true,
      }));

      bridgeRef.current.setPlaying(false);
      bridgeRef.current.enterCameraEdit();
      setStatus('Scene ready — adjust camera in the viewport');
    },
    [runAutoPrepare, setStatus, state.showcaseCount]
  );

  const toggleFavorite = useCallback((motionId: string) => {
    favoritesRef.current = toggleMotionFavorite(motionId);
    setState((prev) => ({ ...prev }));
  }, []);

  const setPlatform = useCallback((platform: ExportPlatformId) => {
    setState((prev) => ({ ...prev, selectedPlatform: platform }));
    bridgeRef.current.setViewportFormat(platformToViewport(platform));
  }, []);

  const setShowcaseCount = useCallback((count: 5 | 10 | 20 | 50) => {
    setState((prev) => {
      const variations = generateSceneVariations(
        count,
        prev.selectedStyleId ?? getDefaultStyleCard().id
      );
      return {
        ...prev,
        showcaseCount: count,
        sceneVariations: variations,
        selectedVariationId: variations[0]?.id ?? null,
      };
    });
  }, []);

  const selectVariation = useCallback(
    async (variationId: string) => {
      const variation = state.sceneVariations.find((v) => v.id === variationId);
      if (!variation) return;

      setState((prev) => ({ ...prev, selectedVariationId: variationId, preparing: true }));
      bridgeRef.current.applyStyle(variation.styleId);

      const appState = bridgeRef.current.getAppState();
      const snap = snapshotForCameraMode(
        variation.cameraPreset as 'orbit' | 'showcase' | 'dance' | 'portrait',
        appState.models.length
      );
      bridgeRef.current.flyToCamera(snap);
      bridgeRef.current.invalidateScene();

      await new Promise((r) => setTimeout(r, 200));
      setState((prev) => ({ ...prev, preparing: false }));
    },
    [state.sceneVariations]
  );

  const generateThumbnails = useCallback(async () => {
    const b = bridgeRef.current;
    const maxFrames = b.getAppState().maxFrames;
    setState((prev) => ({ ...prev, preparing: true }));

    const setFrame = async (frame: number) => {
      b.setCurrentFrame(frame);
      b.invalidateScene();
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      );
    };

    const thumbs = await captureThumbnailCandidates(
      maxFrames,
      10,
      () => b.captureFrame(),
      setFrame
    );

    setState((prev) => ({
      ...prev,
      thumbnails: thumbs,
      selectedThumbnailFrame: thumbs[0]?.frame ?? null,
      preparing: false,
    }));
  }, []);

  const selectThumbnail = useCallback((frame: number) => {
    setState((prev) => ({ ...prev, selectedThumbnailFrame: frame }));
    bridgeRef.current.setCurrentFrame(frame);
    bridgeRef.current.invalidateScene();
  }, []);

  const exportVideo = useCallback(async () => {
    setState((prev) => ({ ...prev, exporting: true, preparing: true }));
    await runAutoPrepare({ forExport: true });
    const b = bridgeRef.current;
    const profileId = pickExportProfileForPlatform(state.selectedPlatform);
    const profile = resolveExportProfile(profileId);
    const { appStatePatch } = prepareCinematicExport(b.getAppState(), profile);
    b.setViewportFormat(profile.viewportFormat);
    b.setQualityMode(profile.qualityMode);
    b.setAppState((prev) => ({
      ...prev,
      ...appStatePatch,
      visualFx: appStatePatch.visualFx ?? prev.visualFx,
      sceneComposer: appStatePatch.sceneComposer ?? prev.sceneComposer,
      isPlaying: false,
      currentFrame: 0,
    }));
    b.setCurrentFrame(0);
    b.prepareMetadata('mp4_hq');
    b.startExport();
    setState((prev) => ({ ...prev, preparing: false }));
  }, [runAutoPrepare, state.selectedPlatform]);

  const onExportComplete = useCallback((fileName: string | null) => {
    setState((prev) => ({
      ...prev,
      exporting: false,
      step: 'complete',
      exportFileName: fileName,
    }));
    bridgeRef.current.onExportDone?.(fileName);
  }, []);

  const createAnother = useCallback(() => {
    setState({
      ...INITIAL_STATE(),
      active: true,
      characterReady: bridgeRef.current.getAppState().models.length > 0,
      step: bridgeRef.current.getAppState().models.length > 0 ? 'motion' : 'character',
    });
  }, []);

  const togglePanel = useCallback(() => {
    setState((prev) => ({ ...prev, panelMinimized: !prev.panelMinimized }));
  }, []);

  const togglePlayback = useCallback(() => {
    const playing = bridgeRef.current.getAppState().isPlaying;
    bridgeRef.current.setPlaying(!playing);
  }, []);

  const scrubToFrame = useCallback((frame: number) => {
    bridgeRef.current.setCurrentFrame(frame);
    bridgeRef.current.invalidateScene();
  }, []);

  const saveCameraKeyframe = useCallback(() => {
    bridgeRef.current.registerCameraKeyframe();
    setStatus('Camera keyframe saved');
  }, [setStatus]);

  const enterCameraEdit = useCallback(() => {
    bridgeRef.current.enterCameraEdit();
  }, []);

  return {
    state,
    favorites: favoritesRef.current,
    enter,
    exit,
    goToStep,
    markCharacterReady,
    loadDemoCharacter,
    handleCharacterImport,
    selectMotion,
    selectStyle,
    toggleFavorite,
    setPlatform,
    setShowcaseCount,
    selectVariation,
    generateThumbnails,
    selectThumbnail,
    exportVideo,
    onExportComplete,
    createAnother,
    setStatus,
    togglePanel,
    togglePlayback,
    scrubToFrame,
    saveCameraKeyframe,
    enterCameraEdit,
  };
}