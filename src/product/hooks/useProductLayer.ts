import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AppState, CameraMode, ViewportFormat } from '../../types';
import type { ModelAnalysisReport } from '../../analyzer/types';
import type { StudioUiMode } from '../../flow/types';
import { loadUiMode, saveUiMode } from '../../flow/storage';
import type { EditorInterfaceId } from '../../uiVersions';
import { loadEditorInterface, saveEditorInterface } from '../../uiVersions';
import {
  SceneManager,
  getCameraTemplateForScene,
  inferQualityMode,
  qualityModeToPatch,
} from '../scene';
import type { AnimaStageScene, QualityMode } from '../scene/types';
import { createShareLink, copyShareLinkToClipboard } from '../share';
import { navigateToEditorFork } from '../share/fork';
import { shortsGenerator } from '../shorts/ShortsGenerator';
import type { ShortsPipelineBridge } from '../shorts/applyShortsPipeline';
import { resolveFramingFromModelCount } from '../shorts/applyShortsPipeline';
import { buildShortCameraSnapshot } from '../camera/frameShortCamera';
import { resolveCameraFramingFromModels } from '../../scene/cameraFraming';
import { SHORTS_DURATION_SEC } from '../templates/duration';
import { clampShortsDuration, formatShortsDurationLabel } from '../shorts/shortsConfig';
import { processVmdFiles } from '../../utils/mmdFiles';
import type { CameraSnapshot } from '../../types';
import { templateManager, type TemplateEngineBridge } from '../templates/TemplateManager';
import { templateEngine } from '../templates/templateEngine';
import { DEFAULT_TEMPLATE_DURATION_SEC } from '../templates/duration';
import { cameraPresetManager, type CameraPresetKey } from '../camera-presets';
import { cameraController, type ProductCameraMode } from '../camera';
import { assetPipeline } from '../assets';
import { buildAutoBeautifyPatch } from '../ux/beautify';
import { buildSceneGraphFromObjects, type SceneGraphState } from '../ux/sceneGraph';
import {
  shouldShowOnboarding,
  dismissOnboardingFlag,
} from '../onboarding';
import { hasStoredScene } from '../scene/storage';

export interface UseProductLayerOptions {
  isViewer: boolean;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  viewportFormat: ViewportFormat;
  onViewportFormatChange: (format: ViewportFormat) => void;
  activeDemoId: string | null;
  onClearScene: () => void;
  loadDemo: (demoId: string) => Promise<void>;
  applyTemplate: (templateId: string) => void;
  setPlaying: (playing: boolean) => void;
  setCameraMode: (mode: CameraMode) => void;
  flyToCamera: (snapshot: CameraSnapshot) => void;
  /** Called when Generate Short pipeline finishes — parent shows shorts UI. */
  onShortGenerated?: () => void;
}

export function useProductLayer(opts: UseProductLayerOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const sceneManager = useMemo(
    () =>
      new SceneManager({
        read: () => ({
          appState: optsRef.current.appState,
          viewportFormat: optsRef.current.viewportFormat,
          activeDemoId: optsRef.current.activeDemoId,
        }),
        write: (updater) => optsRef.current.setAppState(updater),
        setViewportFormat: (f) => optsRef.current.onViewportFormatChange(f),
        loadDemo: (id) => optsRef.current.loadDemo(id),
        clearScene: () => optsRef.current.onClearScene(),
        applyTemplate: (id) => optsRef.current.applyTemplate(id),
        setPlaying: (p) => optsRef.current.setPlaying(p),
      }),
    []
  );

  const [uiMode, setUiMode] = useState<StudioUiMode>(() => loadUiMode());
  const [editorInterface, setEditorInterface] = useState<EditorInterfaceId>(() =>
    loadEditorInterface()
  );
  const [qualityMode, setQualityMode] = useState<QualityMode>(() =>
    inferQualityMode(opts.appState)
  );
  const [shareBusy, setShareBusy] = useState(false);
  const [shortsSetupOpen, setShortsSetupOpen] = useState(false);
  const [shortsDurationSec, setShortsDurationSec] = useState(SHORTS_DURATION_SEC);
  const [shortsGenerating, setShortsGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() =>
    shouldShowOnboarding(opts.isViewer)
  );
  const [hasSaved, setHasSaved] = useState(hasStoredScene);
  const [showResultFirst, setShowResultFirst] = useState(false);
  const [sceneGraphMeta, setSceneGraphMeta] = useState<
    Record<string, { parentId?: string | null; groupId?: string | null; locked?: boolean }>
  >({});
  const [sceneGraphGroups, setSceneGraphGroups] = useState<SceneGraphState['groups']>([]);

  const beautifiedRef = useRef(false);
  const assetAppliedRef = useRef(new Set<string>());

  const sceneGraph: SceneGraphState = useMemo(
    () => ({
      ...buildSceneGraphFromObjects(
        opts.appState.objects.map((o) => ({
          id: o.id,
          name: o.name,
          type: o.type,
          visible: o.visible,
        })),
        sceneGraphMeta
      ),
      groups: sceneGraphGroups,
    }),
    [opts.appState.objects, sceneGraphMeta, sceneGraphGroups]
  );

  const toastTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const showToast = useCallback((msg: string, ms = 3000) => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, ms);
  }, []);

  const handleUiModeChange = useCallback((mode: StudioUiMode) => {
    setUiMode(mode);
    saveUiMode(mode);
  }, []);

  const handleEditorInterfaceChange = useCallback((id: EditorInterfaceId) => {
    setEditorInterface(id);
    saveEditorInterface(id);
  }, []);

  const handleQualityModeChange = useCallback((next: QualityMode) => {
    setQualityMode(next);
    const patch = qualityModeToPatch(next, optsRef.current.isViewer);
    optsRef.current.setAppState((prev) => ({
      ...prev,
      characterQuality: patch.characterQuality,
      physicsMode: patch.physicsMode,
      rtxModeEnabled: patch.rtxModeEnabled,
      visualFx: { ...prev.visualFx, ...patch.visualFxPatch },
    }));
  }, []);

  const makeTemplateBridge = useCallback((): TemplateEngineBridge => {
    return {
      getModelCount: () => optsRef.current.appState.models.length,
      setViewportFormat: (f) => optsRef.current.onViewportFormatChange(f),
      setQualityMode: (m) => handleQualityModeChange(m),
      patchVisualFx: (patch) => {
        optsRef.current.setAppState((prev) => ({
          ...prev,
          visualFx: { ...prev.visualFx, ...patch },
        }));
      },
      applyMotionTemplate: (id) => optsRef.current.applyTemplate(id),
      applyCameraTemplate: (id) => optsRef.current.applyTemplate(id),
      setTimeline: (maxFrames, currentFrame, isPlaying) => {
        optsRef.current.setAppState((prev) => ({
          ...prev,
          maxFrames,
          currentFrame,
          isPlaying,
        }));
      },
      setPhysicsMode: (mode) => {
        optsRef.current.setAppState((prev) => ({ ...prev, physicsMode: mode }));
      },
      loadDemo: (id) => optsRef.current.loadDemo(id),
    };
  }, [handleQualityModeChange]);

  const makeCameraBridge = useCallback(
    () => ({
      getModelCount: () => optsRef.current.appState.models.length,
      getHasCameraVmd: () => Boolean(optsRef.current.appState.hasCameraVmd),
      applyCameraTemplate: (id: string) => optsRef.current.applyTemplate(id),
      setCameraMode: (mode: CameraMode) => optsRef.current.setCameraMode(mode),
      patchCameraStudio: (patch: Record<string, unknown>) => {
        optsRef.current.setAppState((prev) => ({
          ...prev,
          cameraStudio: { ...prev.cameraStudio, ...patch },
        }));
      },
    }),
    []
  );

  const makeShortsBridge = useCallback((): ShortsPipelineBridge => {
    return {
      ...makeTemplateBridge(),
      flyToCamera: (snapshot) => optsRef.current.flyToCamera(snapshot),
      getFraming: () => resolveCameraFramingFromModels(optsRef.current.appState.models),
      getManualCameraLock: () =>
        Boolean(optsRef.current.appState.cameraStudio.manualCameraLock),
      preserveCharacterMotion: () => {
        optsRef.current.setAppState((prev) => ({
          ...prev,
          cameraMode: 'free',
          cameraKeyframes: [],
          models: prev.models.map((m) => {
            if (!m.hasVmdAnimation) return m;
            return {
              ...m,
              vmdPlaybackEnabled: true,
              activeTemplateId: null,
            };
          }),
        }));
      },
      prepareShortCamera: () => {
        optsRef.current.setCameraMode('free');
        optsRef.current.setAppState((prev) => ({
          ...prev,
          cameraMode: 'free',
          cameraKeyframes: [],
        }));
      },
      setCameraMode: (mode) => optsRef.current.setCameraMode(mode),
      patchCameraStudio: (patch) => {
        optsRef.current.setAppState((prev) => ({
          ...prev,
          cameraStudio: { ...prev.cameraStudio, ...patch },
        }));
      },
    };
  }, [makeTemplateBridge]);

  const frameShortCamera = useCallback(() => {
    const framing = resolveCameraFramingFromModels(optsRef.current.appState.models);
    optsRef.current.flyToCamera(buildShortCameraSnapshot(framing));
    optsRef.current.setAppState((prev) => ({
      ...prev,
      cameraStudio: {
        ...prev.cameraStudio,
        autoFocus: true,
        manualCameraLock: false,
      },
    }));
    showToast('Camera reframed for characters', 2500);
  }, [showToast]);

  const toggleManualCameraLock = useCallback(() => {
    optsRef.current.setAppState((prev) => {
      const nextLock = !prev.cameraStudio.manualCameraLock;
      showToast(
        nextLock
          ? 'Manual camera — drag to position (orbit)'
          : 'Auto framing on — camera follows models',
        3000
      );
      return {
        ...prev,
        cameraStudio: {
          ...prev.cameraStudio,
          manualCameraLock: nextLock,
          autoFocus: !nextLock,
        },
      };
    });
  }, [showToast]);

  const handleApplySceneTemplate = useCallback(
    async (templateId: string, durationSec = DEFAULT_TEMPLATE_DURATION_SEC) => {
      const ok = await templateEngine.apply(templateId, makeTemplateBridge(), durationSec);
      if (ok) {
        const tpl = templateManager.getTemplate(templateId) ?? templateEngine.get(templateId);
        const label = tpl && 'label' in tpl ? tpl.label : tpl && 'name' in tpl ? tpl.name : templateId;
        showToast(`Applied ${label}`);
        setShowResultFirst(false);
      }
    },
    [makeTemplateBridge, showToast]
  );

  const handleApplyCameraPreset = useCallback((presetKey: CameraPresetKey) => {
    cameraPresetManager.apply(presetKey, {
      applyCameraTemplate: (id) => optsRef.current.applyTemplate(id),
      getModelCount: () => optsRef.current.appState.models.length,
    });
  }, []);

  const handleApplyCameraMode = useCallback((mode: ProductCameraMode) => {
    cameraController.applyMode(mode, makeCameraBridge());
  }, [makeCameraBridge]);

  const runAutoBeautify = useCallback(() => {
    if (beautifiedRef.current || optsRef.current.isViewer) return;
    beautifiedRef.current = true;
    const count = optsRef.current.appState.models.length;
    if (count === 0) return;

    const patch = buildAutoBeautifyPatch(
      count,
      Boolean(optsRef.current.appState.hasCameraVmd)
    );
    optsRef.current.setAppState((prev) => ({
      ...prev,
      visualFx: patch.visualFx,
      characterQuality: patch.characterQuality,
      cameraMode: patch.cameraMode,
      cameraStudio: { ...prev.cameraStudio, ...patch.cameraStudio },
    }));
    window.setTimeout(() => {
      cameraController.applyMode(patch.suggestedCameraMode, makeCameraBridge());
    }, 0);
  }, [makeCameraBridge]);

  const applyAssetOptimizations = useCallback(
    (modelId: string, report: ModelAnalysisReport, modelFileName?: string) => {
      if (assetAppliedRef.current.has(modelId)) return;
      assetAppliedRef.current.add(modelId);
      if (modelFileName) assetPipeline.cacheModelKey(modelFileName, report);

      const patch = assetPipeline.buildAutoPatch(report, optsRef.current.appState);
      if (!patch) return;

      optsRef.current.setAppState((prev) => ({
        ...prev,
        characterQuality: patch.characterQuality ?? prev.characterQuality,
        rtxModeEnabled: patch.rtxModeEnabled ?? prev.rtxModeEnabled,
        physicsMode: patch.physicsMode ?? prev.physicsMode,
        mmdLite: patch.mmdLite ? { ...prev.mmdLite, ...patch.mmdLite } : prev.mmdLite,
      }));
      const hints = assetPipeline.analyze(report);
      if (hints.message) showToast(hints.message, 4000);
    },
    [showToast]
  );

  const finishSceneRestore = useCallback(
    (scene: AnimaStageScene, viewerSafe: boolean) => {
      setQualityMode(viewerSafe ? 'performance' : scene.settings.quality);
      const camTpl = getCameraTemplateForScene(scene);
      if (camTpl) optsRef.current.applyTemplate(camTpl);
      if (viewerSafe) optsRef.current.setPlaying(true);
    },
    []
  );

  const applyScene = useCallback(
    (scene: AnimaStageScene, viewerSafe = false) => {
      sceneManager.restore(scene, { viewerSafe });
      finishSceneRestore(scene, viewerSafe);
    },
    [sceneManager, finishSceneRestore]
  );

  const restoreSceneWithDemo = useCallback(
    async (scene: AnimaStageScene, viewerSafe = false) => {
      if (scene.sourceDemoId && optsRef.current.appState.models.length === 0) {
        await optsRef.current.loadDemo(scene.sourceDemoId);
      }
      sceneManager.restore(scene, { viewerSafe });
      finishSceneRestore(scene, viewerSafe);
    },
    [sceneManager, finishSceneRestore]
  );

  const handleSaveProject = useCallback(() => {
    sceneManager.saveToFile();
    setHasSaved(true);
    showToast('Project saved as .animastage');
  }, [sceneManager, showToast]);

  const handleLoadProject = useCallback(() => {
    const saved = sceneManager.loadLocal();
    if (!saved) return;
    applyScene(saved);
    showToast('Project restored');
  }, [sceneManager, applyScene, showToast]);

  const handleLoadProjectFile = useCallback(
    (raw: string) => {
      try {
        const scene = sceneManager.parseFile(raw);
        if (scene.sourceDemoId && optsRef.current.appState.models.length === 0) {
          void restoreSceneWithDemo(scene);
        } else {
          applyScene(scene);
        }
        showToast(`Loaded ${scene.name}`);
      } catch {
        showToast('Invalid project file');
      }
    },
    [sceneManager, applyScene, restoreSceneWithDemo, showToast]
  );

  const handleShareScene = useCallback(async () => {
    setShareBusy(true);
    try {
      const scene = sceneManager.saveLocal();
      const link = await createShareLink(scene);
      await copyShareLinkToClipboard(link);
      showToast('Viewer link copied to clipboard', 4000);
    } catch {
      showToast('Share failed — try Save instead', 4000);
    } finally {
      setShareBusy(false);
    }
  }, [sceneManager, showToast]);

  const setModelActiveVmdIndex = useCallback((modelId: string, index: number) => {
    optsRef.current.setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) => {
        if (m.id !== modelId) return m;
        const max = Math.max(0, (m.vmdBlobUrls?.length ?? 0) - 1);
        const next = Math.min(Math.max(0, index), max);
        return {
          ...m,
          activeVmdIndex: next,
          vmdPlaybackEnabled: true,
          hasVmdAnimation: (m.vmdBlobUrls?.length ?? 0) > 0,
        };
      }),
    }));
  }, []);

  const appendModelVmdFiles = useCallback(
    async (modelId: string, fileList: FileList) => {
      const files = Array.from(fileList).filter((f) =>
        f.name.toLowerCase().endsWith('.vmd')
      );
      if (files.length === 0) {
        showToast('Select a .vmd motion file', 3000);
        return;
      }
      const result = await processVmdFiles(files);
      if ('error' in result) {
        showToast(result.error, 4000);
        return;
      }
      optsRef.current.setAppState((prev) => ({
        ...prev,
        models: prev.models.map((m) => {
          if (m.id !== modelId) return m;
          const prevUrls = m.vmdBlobUrls ?? [];
          const prevNames = m.vmdFileNames ?? [];
          const nextIndex = prevUrls.length;
          return {
            ...m,
            fileMap: { ...m.fileMap, ...result.fileMap },
            vmdBlobUrls: [...prevUrls, ...result.vmdBlobUrls],
            vmdFileNames: [...prevNames, ...result.vmdFileNames],
            activeVmdIndex: nextIndex,
            hasVmdAnimation: true,
            vmdPlaybackEnabled: true,
          };
        }),
        ...(result.hasCameraVmd
          ? {
              cameraVmdBlobUrl: result.cameraVmdBlobUrl ?? prev.cameraVmdBlobUrl,
              cameraVmdFileName: result.cameraVmdFileName ?? prev.cameraVmdFileName,
              hasCameraVmd: true,
            }
          : {}),
      }));
      showToast(`Added ${result.vmdFileNames.length} motion(s)`, 2500);
    },
    [showToast]
  );

  const openShortsSetup = useCallback(() => {
    setShortsSetupOpen(true);
  }, []);

  const closeShortsSetup = useCallback(() => {
    if (!shortsGenerating) setShortsSetupOpen(false);
  }, [shortsGenerating]);

  const handleCreateShort = useCallback(
    async (durationSec = shortsDurationSec) => {
      const sec = clampShortsDuration(durationSec);
      setShortsGenerating(true);
      try {
        const count = optsRef.current.appState.models.length;
        await shortsGenerator.generate(makeShortsBridge(), count, sec);
        setShortsDurationSec(sec);
        setShowResultFirst(false);
        setShortsSetupOpen(false);
        optsRef.current.onShortGenerated?.();
        const framing = resolveFramingFromModelCount(count);
        const dur = formatShortsDurationLabel(sec);
        showToast(
          framing === 'duo'
            ? `Short ready — duo · VMD · ${dur}`
            : `Short ready — solo · VMD · ${dur}`,
          4000
        );
      } finally {
        setShortsGenerating(false);
      }
    },
    [makeShortsBridge, showToast, shortsDurationSec]
  );

  const confirmCreateShort = useCallback(() => {
    void handleCreateShort(shortsDurationSec);
  }, [handleCreateShort, shortsDurationSec]);

  const handleForkToEditor = useCallback((scene: AnimaStageScene) => {
    navigateToEditorFork(scene);
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    dismissOnboardingFlag();
  }, []);

  const dismissResultFirst = useCallback(() => {
    setShowResultFirst(false);
    try {
      localStorage.setItem('as_result_first_dismissed', '1');
    } catch {
      /* ignore */
    }
  }, []);

  const showResultFirstBar = useCallback(() => {
    try {
      if (localStorage.getItem('as_result_first_dismissed') === '1') return;
    } catch {
      /* ignore */
    }
    setShowResultFirst(true);
  }, []);

  const handleSceneGraphToggleVisibility = useCallback((objectId: string) => {
    optsRef.current.setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) =>
        m.id === objectId ? { ...m, visible: !m.visible } : m
      ),
      objects: prev.objects.map((o) =>
        o.id === objectId ? { ...o, visible: !o.visible } : o
      ),
    }));
  }, []);

  const handleSceneGraphToggleLock = useCallback((objectId: string) => {
    setSceneGraphMeta((meta) => ({
      ...meta,
      [objectId]: { ...meta[objectId], locked: !meta[objectId]?.locked },
    }));
  }, []);

  const handleSceneGraphCreateGroup = useCallback(() => {
    setSceneGraphGroups((groups) => {
      const id = `grp_${Date.now()}`;
      return [...groups, { id, name: `Group ${groups.length + 1}`, collapsed: false }];
    });
  }, []);

  const lockedObjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, meta] of Object.entries(sceneGraphMeta)) {
      if (meta.locked) ids.add(id);
    }
    return ids;
  }, [sceneGraphMeta]);

  return {
    sceneManager,
    uiMode,
    editorInterface,
    qualityMode,
    shareBusy,
    toast,
    showToast,
    showOnboarding,
    showResultFirst,
    hasSaved,
    sceneGraph,
    lockedObjectIds,
    handleUiModeChange,
    handleEditorInterfaceChange,
    handleQualityModeChange,
    handleSaveProject,
    handleLoadProject,
    handleLoadProjectFile,
    handleShareScene,
    handleCreateShort,
    openShortsSetup,
    closeShortsSetup,
    confirmCreateShort,
    shortsSetupOpen,
    shortsDurationSec,
    setShortsDurationSec: (sec: number) => setShortsDurationSec(clampShortsDuration(sec)),
    shortsGenerating,
    setModelActiveVmdIndex,
    appendModelVmdFiles,
    handleApplySceneTemplate,
    handleApplyCameraPreset,
    handleApplyCameraMode,
    applyScene,
    restoreSceneWithDemo,
    dismissOnboarding,
    dismissResultFirst,
    showResultFirstBar,
    runAutoBeautify,
    applyAssetOptimizations,
      handleForkToEditor,
      frameShortCamera,
    toggleManualCameraLock,
    manualCameraLock: Boolean(
      opts.appState.cameraStudio.manualCameraLock
    ),
    makeShortsBridge,
      handleSceneGraphToggleVisibility,
    handleSceneGraphToggleLock,
    handleSceneGraphCreateGroup,
    templateEngine,
    cameraController,
  };
}
