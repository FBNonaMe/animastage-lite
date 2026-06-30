import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Video } from 'lucide-react';
import TopMenu from './components/TopMenu';
import Sidebar from './components/Sidebar';
import Viewport from './components/Viewport';
import { BoneTransformUpdate, type MMDModelApi } from './components/MMDModelWrapper';
import {
  AppState,
  MMDModel,
  BoneState,
  MorphState,
  CameraSnapshot,
  ViewportFormat,
  SceneBackgroundSettings,
  PhysicsMode,
  DEFAULT_MMD_LITE_CONFIG,
  MmdLiteConfig,
} from './types';
import { revokeFileMapUrls, type ProcessedMMDFiles } from './utils/mmdFiles';
import {
  canAddSceneCharacter,
  getNextSpawnPosition,
  MAX_SCENE_CHARACTERS,
  patchStateForMultiCharacterLoad,
} from './scene';
import { fixScenePhysics, clearPhysicsInstabilityHint, warnDuplicateModelImport } from './physics/physicsStabilitySystem';
import { playheadRef, MMD_FPS, setPlayheadFrame } from './utils/playhead';
import { createEmptyKeyframes } from './components/TimelineLogic';
import { createEmptyCameraKeyframes } from './components/CameraLogic';
import { CINEMATIC_VERTICAL_FX, DEFAULT_VISUAL_FX } from './templates/animationTemplates';
import { DEFAULT_CAMERA_STUDIO } from './camera/cameraStudioDefaults';
import { portraitRecommendedQuality } from './utils/characterQuality';
import { DEFAULT_RTX_SETTINGS } from './utils/rtxSettings';
import type { CharacterQuality, RtxSettings } from './types';
import { useTimeline } from './hooks/useTimeline';
import { useVideoRecorder } from './hooks/useVideoRecorder';
import { videoSaveLocationHint } from './native/saveBlob';
import RecordingHud from './components/RecordingHud';
import EditorTimelineShell from './components/editor/EditorTimelineShell';
import { useClipEditor } from './hooks/useClipEditor';
import { useEditorDocument } from './hooks/useEditorDocument';
import { useEditorKeyboard } from './hooks/useEditorKeyboard';
import type { AnimationLayerDef, TimelineKeyframe, TimelineTrackId } from './types';
import type { PoseSnapshotV1 } from './pose/poseTypes';
import { createPoseId } from './pose/poseTypes';
import {
  applyPoseSnapshotToMesh,
  capturePoseFromModel,
  collectDynamicBoneNames,
  poseBonesToModelBones,
} from './pose/poseApply';
import { addCustomPose } from './pose/poseStorage';
import { mergeTimelineKeyframes } from './components/TimelineLogic';
import { useCollab } from './hooks/useCollab';
import type { CollabClipPayload } from './collab/collabSync';
import { useStudioLayout } from './hooks/useStudioLayout';
import type { MobilePanelTab } from './hooks/useStudioLayout';
import FxSettingsPanel from './components/FxSettingsPanel';
import DesktopLayout from './layout/DesktopLayout';
import ProMobileShell from './layout/proMobile/ProMobileShell';
import type { ProMobileTab } from './layout/proMobile/types';
import { getMobileSafeStatePatch } from './config/mobileSafeMode';
import {
  enableMobileRuntimeCaps,
  disableMobileRuntimeCaps,
} from './perf/mobileRuntimeCaps';
import DemoGalleryOverlay from './components/gallery/DemoGalleryOverlay';
import { applyInstantDemoState } from './demos/applyInstantDemo';
import { buildInstantDemoModel } from './demos/buildDemoModel';
import { FEATURED_DEMO_ID, getDemoScene } from './demos/demoCatalog';
import { loadDemoPack } from './demos/loadDemoScene';
import type { InstantDemoScene } from './demos/types';
import StudioFlowBar from './components/flow/StudioFlowBar';
import { useProductLayer } from './product/hooks/useProductLayer';
import {
  ResultFirstBar,
  shouldAutoLoadDemo,
  markResultFirstDone,
} from './product/onboarding';
import TemplatePicker from './product/ui/TemplatePicker';
import { shouldShowTimeline, isBeginnerMode } from './product/ui/beginnerMode';
import { consumeForkScene, hasForkParam } from './product/share/fork';
import ViewerForkBar from './product/ux/ViewerForkBar';
import ProductShortsFlow, { type ProductShortsFlowHandle } from './product/ux/ProductShortsFlow';
import ShortsSetupDialog from './product/ux/ShortsSetupDialog';
import type { AnimaStageScene } from './product/scene/types';
import { isNativeApp } from './utils/platform';
import { nativeStudioStatePatch } from './native/nativeStudioBootstrap';

export interface AppProps {
  mode?: 'editor' | 'viewer';
  initialProject?: AnimaStageScene | null;
}

// Standard Bones preset
const DEFAULT_BONES: BoneState[] = [
  { id: 'head', name: 'Head Rig', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'neck', name: 'Neck Rig', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'spine', name: 'Upper Body', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'waist', name: 'Hips / Waist', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'arm_L', name: 'Left Shoulder', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'arm_R', name: 'Right Shoulder', rotationX: 0, rotationY: 0, rotationZ: 0 },
];

// Standard Morphs preset
const DEFAULT_MORPHS: MorphState = {
  eyes: 0,
  mouth: 0.1,
  brow: 0,
};

export default function App({ mode = 'editor', initialProject = null }: AppProps) {
  const isViewer = mode === 'viewer';

  useEffect(() => {
    document.title = isViewer
      ? 'AnimaStage Viewer — Watch MMD Scene'
      : 'MMD Studio — Edit PMX & VMD Online | AnimaStage Lite';
    return () => {
      document.title = 'MMD Online — Run PMX & VMD in Browser | AnimaStage Lite';
    };
  }, [isViewer]);

  // App primary state
  const [appState, setAppState] = useState<AppState>(() => ({
    objects: [
      { id: 'camera_main', name: 'Main Camera [Orbit]', type: 'camera', visible: true },
      { id: 'light_directional', name: 'Directional Light [Sun]', type: 'light', visible: true },
    ],
    models: [],
    selectedObjectId: null,
    selectedBoneId: null,
    currentFrame: 0,
    maxFrames: 120,
    isPlaying: false,
    physicsMode: 'anytime',
    mmdLite: { ...DEFAULT_MMD_LITE_CONFIG },
    playSpeed: 30, // 30 Frames Per Second
    timelineActiveTrack: null,
    cameraMode: 'free',
    cameraKeyframes: createEmptyCameraKeyframes(),
    cameraOrbitAnchor: [0, 10, 0],
    cameraVmdBlobUrl: null,
    cameraVmdFileName: null,
    hasCameraVmd: false,
    visualFx: { ...DEFAULT_VISUAL_FX },
    sceneBackground: { imageUrl: null, opacity: 1 },
    characterQuality: 'hd',
    rtxModeEnabled: false,
    rtxSettings: { ...DEFAULT_RTX_SETTINGS },
    renderTier: 'lite',
    cameraStudio: { ...DEFAULT_CAMERA_STUDIO },
    sceneHdr: { blobUrl: null, fileName: null, intensity: 1, showBackground: false },
    ...(isNativeApp() ? nativeStudioStatePatch() : {}),
  }));

  const captureCameraRef = useRef<(() => CameraSnapshot | null) | null>(null);
  const flyToCameraRef = useRef<((snapshot: CameraSnapshot) => void) | null>(null);
  const modelApiRef = useRef<MMDModelApi | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const invalidateSceneRef = useRef<(() => void) | null>(null);
  const appStateRef = useRef(appState);
  appStateRef.current = appState;
  const loadDemoSceneRef = useRef<(demoId: string) => Promise<void>>(async () => {});
  const [highlightMaterial, setHighlightMaterial] = useState<string | null>(null);
  const clipEditor = useClipEditor();

  // UI responsive styling state
  const layout = useStudioLayout();
  const isMobileLayout = layout.isMobileLayout;
  const isMobile = layout.isCompactStudio;
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showTimelinePanel, setShowTimelinePanel] = useState(true);
  const prevMobileLayoutRef = useRef(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobilePanelTab, setMobilePanelTab] = useState<MobilePanelTab>('scene');
  const mobileSafeAppliedRef = useRef(false);
  const [openTopMenuId, setOpenTopMenuId] = useState<string | null>(null);
  const maxExportDurationSec = Math.max(1, Math.floor(appState.maxFrames / MMD_FPS));
  const [exportDurationSec, setExportDurationSec] = useState(() =>
    Math.min(30, Math.max(1, Math.floor(120 / MMD_FPS)))
  );
  const [analyzingModel, setAnalyzingModel] = useState(false);

  // Viewport setup states (passed to TopMenu & Viewport)
  const [showGrid, setShowGrid] = useState(true);
  const [showBones, setShowBones] = useState(true);
  const [showCameraHelper, setShowCameraHelper] = useState(false);
  const [showPhysicsBodies, setShowPhysicsBodies] = useState(false);
  const [viewportFormat, setViewportFormat] = useState<ViewportFormat>('16:9');
  const pre916VisualFxRef = useRef(appState.visualFx);
  const pre916QualityRef = useRef<CharacterQuality>(appState.characterQuality);
  const pre916RtxRef = useRef({
    enabled: appState.rtxModeEnabled,
    settings: appState.rtxSettings,
  });

  const [demoHint, setDemoHint] = useState(false);
  const [showDemoGallery, setShowDemoGallery] = useState(false);
  const [demoLoadingId, setDemoLoadingId] = useState<string | null>(null);
  const [activeDemoId, setActiveDemoId] = useState<string | null>(null);
  const demoBootRef = useRef(false);
  const projectBootRef = useRef(false);
  const clearSceneRef = useRef<() => void>(() => {});
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const restoreSceneRef = useRef<(scene: AnimaStageScene, viewerSafe: boolean) => Promise<void>>(
    async () => {}
  );
  const dismissOnboardingRef = useRef<() => void>(() => {});
  const loadProjectFileRef = useRef<(raw: string) => void>(() => {});
  const setPlayingRef = useRef<(playing: boolean) => void>(() => {});
  const showResultFirstRef = useRef<() => void>(() => {});
  const applyTemplateRef = useRef<(id: string) => void>(() => {});
  const runAutoBeautifyRef = useRef<() => void>(() => {});
  const applyAssetOptimizationsRef = useRef<
    (modelId: string, report: import('./analyzer/types').ModelAnalysisReport, fileName?: string) => void
  >(() => {});
  const assetAnalysisSigRef = useRef('');
  const beautifyModelsCountRef = useRef(0);
  const resultFirstShownRef = useRef(false);
  const shortsFlowRef = useRef<ProductShortsFlowHandle | null>(null);
  const handleShareSceneRef = useRef<() => void | Promise<void>>(async () => {});

  useEffect(() => {
    if (!isViewer) return;
    setShowLeftSidebar(false);
    setShowTimelinePanel(false);
    setShowGrid(false);
    setShowBones(false);
  }, [isViewer]);

  useEffect(() => {
    if (layout.isCompactStudio) {
      setShowLeftSidebar(false);
      setShowTimelinePanel(false);
      return;
    }
    if (isViewer) return;
    setShowLeftSidebar(true);
    setShowTimelinePanel(true);
    setMobileNavOpen(false);
    setOpenTopMenuId(null);
  }, [layout.isCompactStudio, isViewer]);

  const handleViewportFormatChange = useCallback(
    (format: ViewportFormat) => {
      if (format === viewportFormat) return;
      const s = appStateRef.current;
      if (format === '9:16') {
        pre916VisualFxRef.current = s.visualFx;
        pre916QualityRef.current = s.characterQuality;
        pre916RtxRef.current = {
          enabled: s.rtxModeEnabled,
          settings: s.rtxSettings,
        };
        setAppState((prev) => ({
          ...prev,
          visualFx: {
            ...prev.visualFx,
            ...CINEMATIC_VERTICAL_FX,
            bloomEnabled: false,
            dofEnabled: false,
          },
          characterQuality: portraitRecommendedQuality(prev.characterQuality),
          rtxModeEnabled: false,
        }));
      } else {
        setAppState((prev) => ({
          ...prev,
          visualFx: { ...pre916VisualFxRef.current },
          characterQuality: pre916QualityRef.current,
          rtxModeEnabled: pre916RtxRef.current.enabled,
          rtxSettings: pre916RtxRef.current.settings,
        }));
      }
      setViewportFormat(format);
    },
    [viewportFormat]
  );

  const handleSceneHdr = (patch: Partial<import('./types').SceneHdrSettings>) => {
    setAppState((s) => {
      const prev = s.sceneHdr.blobUrl;
      if (patch.blobUrl === null && prev?.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return {
        ...s,
        sceneHdr: { ...s.sceneHdr, ...patch },
      };
    });
  };

  const handleHdrFileDrop = useCallback((blobUrl: string, fileName: string) => {
    setAppState((s) => {
      if (s.sceneHdr.blobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(s.sceneHdr.blobUrl);
      }
      return {
        ...s,
        sceneHdr: {
          blobUrl,
          fileName,
          intensity: s.sceneHdr.intensity,
          showBackground: s.sceneHdr.showBackground,
        },
      };
    });
  }, []);

  const handlePatchMmdLite = (patch: Partial<MmdLiteConfig>) => {
    setAppState((s) => ({
      ...s,
      mmdLite: { ...s.mmdLite, ...patch },
    }));
  };

  const handlePatchRtxSettings = (patch: Partial<RtxSettings>) => {
    setAppState((s) => ({
      ...s,
      rtxSettings: { ...s.rtxSettings, ...patch },
    }));
  };

  const {
    setCurrentFrame: handleSetCurrentFrame,
    setMaxFrames: handleSetMaxFrames,
    setIsPlaying: handleSetIsPlaying,
    handleRegisterKeyframe,
    handleDeleteKeyframe,
    handleAddSampleKeyframes,
    handleApplyTemplate,
    handleClearAllKeyframes,
    setTimelineActiveTrack,
    setCameraMode,
    setVisualFx,
  } = useTimeline({ appState, setAppState, captureCameraRef });
  setPlayingRef.current = handleSetIsPlaying;

  const product = useProductLayer({
    isViewer,
    appState,
    setAppState,
    viewportFormat,
    onViewportFormatChange: handleViewportFormatChange,
    activeDemoId,
    onClearScene: () => clearSceneRef.current(),
    loadDemo: (id) => loadDemoSceneRef.current(id),
    applyTemplate: handleApplyTemplate,
    setPlaying: handleSetIsPlaying,
    setCameraMode,
    flyToCamera: (snapshot) => flyToCameraRef.current?.(snapshot),
    onShortGenerated: () => shortsFlowRef.current?.enterPreview(),
  });
  handleShareSceneRef.current = () => product.handleShareScene();
  restoreSceneRef.current = product.restoreSceneWithDemo;
  dismissOnboardingRef.current = product.dismissOnboarding;
  loadProjectFileRef.current = product.handleLoadProjectFile;
  showResultFirstRef.current = product.showResultFirstBar;
  applyTemplateRef.current = (id) => void product.handleApplySceneTemplate(id);
  runAutoBeautifyRef.current = product.runAutoBeautify;
  applyAssetOptimizationsRef.current = product.applyAssetOptimizations;

  useEffect(() => {
    if (isMobileLayout && !prevMobileLayoutRef.current) {
      setShowLeftSidebar(false);
      setShowTimelinePanel(false);
    }
    if (!isMobileLayout && prevMobileLayoutRef.current) {
      setShowLeftSidebar(true);
      setShowTimelinePanel(true);
    }
    prevMobileLayoutRef.current = isMobileLayout;
  }, [isMobileLayout]);

  useEffect(() => {
    if (!layout.applyMobileSafeMode) {
      mobileSafeAppliedRef.current = false;
      disableMobileRuntimeCaps();
      return;
    }
    enableMobileRuntimeCaps();
    if (mobileSafeAppliedRef.current) return;
    mobileSafeAppliedRef.current = true;
    setAppState((prev) => ({ ...prev, ...getMobileSafeStatePatch(prev) }));
    product.handleQualityModeChange('performance');
  }, [layout.applyMobileSafeMode, product]);

  useEffect(() => {
    if (isViewer || appState.models.length === 0) return;
    dismissOnboardingRef.current();
  }, [appState.models.length, isViewer]);

  const editor = useEditorDocument(appState, setAppState, clipEditor, {
    setCurrentFrame: handleSetCurrentFrame,
    setIsPlaying: handleSetIsPlaying,
    setTimelineActiveTrack,
    handleDeleteKeyframe,
  });

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const dirty = appStateRef.current.models.some((m) => m.clipDirty);
      if (!dirty) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEditorKeyboard({
    enabled: !isViewer,
    maxFrames: appState.maxFrames,
    onPlayPause: () => handleSetIsPlaying(!appState.isPlaying),
    onStepFrame: editor.stepFrame,
    onJumpStart: () => handleSetCurrentFrame(0),
    onJumpEnd: () => handleSetCurrentFrame(appState.maxFrames),
    onUndo: editor.handleUndo,
    onRedo: editor.handleRedo,
    onCopy: editor.handleCopy,
    onPaste: editor.handlePaste,
    onMirrorPaste: editor.handleMirrorPaste,
    onDeleteKey: editor.handleDeleteAtPlayhead,
  });

  useEffect(() => {
    setExportDurationSec((d) => Math.min(maxExportDurationSec, Math.max(1, d)));
  }, [maxExportDurationSec]);

  const videoRecorder = useVideoRecorder({
    getCanvas: () => glCanvasRef.current,
    invalidateScene: () => invalidateSceneRef.current?.(),
    maxFrames: appState.maxFrames,
    exportDurationSec,
    viewportFormat,
    setCurrentFrame: handleSetCurrentFrame,
    setIsPlaying: handleSetIsPlaying,
  });

  const videoProgressPhaseRef = useRef(videoRecorder.progress.phase);
  useEffect(() => {
    const phase = videoRecorder.progress.phase;
    const prev = videoProgressPhaseRef.current;
    videoProgressPhaseRef.current = phase;
    if (prev !== 'done' && phase === 'done') {
      const msg = videoRecorder.progress.message?.trim();
      product.showToast(msg && msg.length > 10 ? msg : videoSaveLocationHint(), 6000);
    }
  }, [videoRecorder.progress.phase, product.showToast]);

  const handleRenderMp4 = useCallback(() => {
    if (videoRecorder.busy && videoRecorder.mode === 'offline') {
      videoRecorder.cancel();
    } else {
      void videoRecorder.startOffline();
    }
  }, [videoRecorder]);

  const handleLiveRecord = useCallback(() => {
    if (videoRecorder.mode === 'live') {
      videoRecorder.stopLive();
    } else {
      videoRecorder.startLive();
    }
  }, [videoRecorder]);

  const handleRemoteCollabClip = useCallback(
    (payload: CollabClipPayload) => {
      setAppState((prev) => ({
        ...prev,
        maxFrames: Math.max(prev.maxFrames, payload.maxFrames),
        currentFrame: payload.currentFrame,
        isPlaying: payload.isPlaying,
        models: prev.models.map((m) =>
          m.id === payload.modelId
            ? { ...m, keyframes: payload.keyframes, clipDirty: true, vmdPlaybackEnabled: false }
            : m
        ),
      }));
      setPlayheadFrame(payload.currentFrame);
    },
    []
  );

  const handleRemoteCollabTransport = useCallback(
    (frame: number, playing: boolean) => {
      setPlayheadFrame(frame);
      setAppState((prev) => ({ ...prev, currentFrame: frame, isPlaying: playing }));
    },
    []
  );

  const collab = useCollab(handleRemoteCollabClip, handleRemoteCollabTransport);
  const collabBroadcastClip = collab.broadcastClip;
  const collabBroadcastTransport = collab.broadcastTransport;

  const selectedModelId = appState.selectedObjectId;
  const selectedModelKeyframes =
    appState.models.find((m) => m.id === selectedModelId)?.keyframes ?? null;
  const selectedKeyframeCount = selectedModelKeyframes?.length ?? 0;

  const handleApplyKeyframes = useCallback(
    (incoming: TimelineKeyframe[], mode: 'merge' | 'replace') => {
      const id = appState.selectedObjectId;
      if (!id) return;
      setAppState((prev) => ({
        ...prev,
        models: prev.models.map((m) => {
          if (m.id !== id) return m;
          const keyframes =
            mode === 'merge' ? mergeTimelineKeyframes(m.keyframes, incoming) : incoming;
          return {
            ...m,
            keyframes,
            clipDirty: true,
            vmdPlaybackEnabled: false,
          };
        }),
      }));
    },
    [appState.selectedObjectId, setAppState]
  );

  const handleUpdateAnimLayers = useCallback(
    (layers: AnimationLayerDef[]) => {
      const id = appState.selectedObjectId;
      if (!id) return;
      setAppState((prev) => ({
        ...prev,
        models: prev.models.map((m) =>
          m.id === id ? { ...m, animLayers: layers, clipDirty: true } : m
        ),
      }));
    },
    [appState.selectedObjectId, setAppState]
  );

  const handleToggleGroupSolo = useCallback(
    (groupId: string) => {
      const id = appState.selectedObjectId;
      if (!id) return;
      setAppState((prev) => ({
        ...prev,
        models: prev.models.map((m) => {
          if (m.id !== id || !m.boneGroups) return m;
          return {
            ...m,
            boneGroups: m.boneGroups.map((g) => ({
              ...g,
              solo: g.id === groupId ? !g.solo : false,
            })),
          };
        }),
      }));
    },
    [appState.selectedObjectId, setAppState]
  );

  const handleToggleGroupMute = useCallback(
    (groupId: string) => {
      const id = appState.selectedObjectId;
      if (!id) return;
      setAppState((prev) => ({
        ...prev,
        models: prev.models.map((m) => {
          if (m.id !== id || !m.boneGroups) return m;
          return {
            ...m,
            boneGroups: m.boneGroups.map((g) =>
              g.id === groupId ? { ...g, muted: !g.muted } : g
            ),
          };
        }),
      }));
    },
    [appState.selectedObjectId, setAppState]
  );

  useEffect(() => {
    if (!collab.connected || !selectedModelId || selectedKeyframeCount === 0) return;

    const timer = window.setTimeout(() => {
      const state = appStateRef.current;
      const model = state.models.find((m) => m.id === selectedModelId);
      if (!model) return;
      collabBroadcastClip({
        modelId: model.id,
        keyframes: model.keyframes,
        maxFrames: state.maxFrames,
        currentFrame: Math.floor(playheadRef.current),
        isPlaying: state.isPlaying,
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    collab.connected,
    selectedModelId,
    selectedKeyframeCount,
    appState.maxFrames,
    collabBroadcastClip,
  ]);

  useEffect(() => {
    if (!collab.connected || !appState.isPlaying) return;
    const timer = window.setInterval(() => {
      collabBroadcastTransport(Math.floor(playheadRef.current), true);
    }, 500);
    return () => clearInterval(timer);
  }, [collab.connected, appState.isPlaying, collabBroadcastTransport]);

  // Load standard models
  const handleLoadModel = (preset: 'miku' | 'kizuna' | 'custom') => {
    let name = 'Hatsune Miku (Append)';
    if (preset === 'kizuna') name = 'Kizuna AI (Official)';
    if (preset === 'custom') name = 'Custom Model Rig (.pmx)';

    const newId = `model_${Date.now()}`;
    const newModel: MMDModel = {
      id: newId,
      name,
      type: preset === 'custom' ? 'custom' : preset,
      visible: true,
      morphs: { ...DEFAULT_MORPHS },
      bones: JSON.parse(JSON.stringify(DEFAULT_BONES)),
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      keyframes: createEmptyKeyframes(),
    };

    setAppState(prev => ({
      ...prev,
      models: [...prev.models, newModel],
      selectedObjectId: newId,
      selectedBoneId: 'head',
      objects: [...prev.objects, { id: newId, name, type: 'model', visible: true }]
    }));
  };

  const revokeAllModelBlobs = useCallback(() => {
    for (const m of appStateRef.current.models) {
      if (m.fileMap) revokeFileMapUrls(m.fileMap);
    }
  }, []);

  // Custom uploads (folder / zip / drop) — supports multiple .pmx/.pmd in one bundle.
  const handleFixPhysics = useCallback(() => {
    clearPhysicsInstabilityHint();
    fixScenePhysics();
  }, []);

  const handleLoadCustomModel = useCallback(
    (payload: ProcessedMMDFiles | ProcessedMMDFiles[]) => {
      const items = Array.isArray(payload) ? payload : [payload];
      if (items.length === 0) return;

      setPlayheadFrame(0);

      setAppState((prev) => {
        const multiPatch = patchStateForMultiCharacterLoad(prev);
        const added: MMDModel[] = [];
        const addedObjects: AppState['objects'] = [];
        let cameraVmdBlobUrl: string | null = prev.cameraVmdBlobUrl;
        let cameraVmdFileName: string | null = prev.cameraVmdFileName;
        let hasCameraVmd: boolean = prev.hasCameraVmd;

        for (let i = 0; i < items.length; i++) {
          if (!canAddSceneCharacter(prev.models.length + added.length)) break;

          const data = items[i]!;
          const fingerprint =
            data.contentFingerprint ??
            `${(data.modelFileName ?? data.name).toLowerCase()}:${data.modelByteSize ?? 0}`;
          const isDuplicate = [...prev.models, ...added].some(
            (m) => m.contentFingerprint && m.contentFingerprint === fingerprint
          );
          if (isDuplicate) {
            warnDuplicateModelImport(data.name);
            window.alert('Duplicate model detected. Physics may be unstable.');
          }

          const spawn = getNextSpawnPosition([...prev.models, ...added]);
          const newId = `model_${Date.now()}_${i}`;
          const hasVmd = (data.vmdBlobUrls?.length ?? 0) > 0;
          const modelHasCameraVmd = data.hasCameraVmd ?? false;

          added.push({
            id: newId,
            name: data.name,
            type: 'custom',
            visible: true,
            morphs: { ...DEFAULT_MORPHS },
            bones: JSON.parse(JSON.stringify(DEFAULT_BONES)),
            positionX: spawn.x,
            positionY: spawn.y,
            positionZ: spawn.z,
            keyframes: createEmptyKeyframes(),
            blobUrl: data.blobUrl,
            modelFileName: data.modelFileName,
            contentFingerprint: fingerprint,
            customManager: data.manager,
            fileMap: data.fileMap,
            vmdBlobUrls: data.vmdBlobUrls,
            vmdFileNames: data.vmdFileNames,
            hasVmdAnimation: hasVmd,
            vmdPlaybackEnabled: hasVmd ? true : undefined,
            activeVmdIndex: 0,
          });

          addedObjects.push({ id: newId, name: data.name, type: 'model', visible: true });

          if (modelHasCameraVmd) {
            cameraVmdBlobUrl = data.cameraVmdBlobUrl ?? null;
            cameraVmdFileName = data.cameraVmdFileName ?? null;
            hasCameraVmd = true;
          }
        }

        if (added.length === 0) {
          window.alert(`Maximum ${MAX_SCENE_CHARACTERS} characters in the scene.`);
          return prev;
        }

        const last = added[added.length - 1]!;

        return {
          ...prev,
          ...multiPatch,
          models: [...prev.models, ...added],
          selectedObjectId: last.id,
          selectedBoneId: 'head',
          isPlaying: false,
          currentFrame: 0,
          cameraVmdBlobUrl,
          cameraVmdFileName,
          hasCameraVmd,
          objects: [...prev.objects, ...addedObjects],
        };
      });
      setActiveDemoId(null);
    },
    []
  );

  const handleLoadDemoScene = useCallback(
    async (demoId: string) => {
      const demo = getDemoScene(demoId);
      if (!demo) return;

      setDemoLoadingId(demoId);
      setDemoHint(false);
      revokeAllModelBlobs();

      try {
        if (demo.kind === 'pack') {
          const result = await loadDemoPack(demo.manifestUrl);
          if ('error' in result) {
            console.warn('[Demo Gallery]', result.error);
            if (demo.fallbackInstantId) {
              await loadDemoSceneRef.current(demo.fallbackInstantId);
            }
            return;
          }
          setPlayheadFrame(0);
          setAppState((prev) => ({
            ...prev,
            models: [],
            selectedObjectId: null,
            selectedBoneId: null,
            objects: prev.objects.filter((o) => o.type !== 'model'),
            isPlaying: false,
            currentFrame: 0,
          }));
          handleLoadCustomModel(result);
          setActiveDemoId(demoId);
          setShowDemoGallery(false);
          return;
        }

        const instant = demo as InstantDemoScene;
        if (instant.viewportFormat && instant.viewportFormat !== viewportFormat) {
          handleViewportFormatChange(instant.viewportFormat);
        }

        const modelId = `model_${Date.now()}`;
        const newModel = buildInstantDemoModel(instant, modelId);

        setAppState((prev) => {
          const nonModelObjects = prev.objects.filter((o) => o.type !== 'model');
          return applyInstantDemoState(prev, instant, modelId, newModel, nonModelObjects);
        });

        setActiveDemoId(demoId);
        setShowDemoGallery(false);
        if (isMobileLayout) setShowLeftSidebar(false);
      } finally {
        setDemoLoadingId(null);
      }
    },
    [revokeAllModelBlobs, handleLoadCustomModel, viewportFormat, handleViewportFormatChange, isMobileLayout]
  );

  loadDemoSceneRef.current = handleLoadDemoScene;

  useEffect(() => {
    if (!initialProject || projectBootRef.current) return;
    projectBootRef.current = true;
    void restoreSceneRef.current(initialProject, isViewer);
  }, [initialProject, isViewer]);

  useEffect(() => {
    if (isViewer || initialProject) return;
    if (!hasForkParam(window.location.search)) return;
    if (projectBootRef.current) return;
    const forked = consumeForkScene();
    if (!forked) return;
    projectBootRef.current = true;
    demoBootRef.current = true;
    void restoreSceneRef.current(forked, false).then(() => {
      setPlayingRef.current(true);
      showResultFirstRef.current();
    });
  }, [isViewer, initialProject]);

  const modelAnalysisSig = React.useMemo(
    () =>
      appState.models
        .map((m) => `${m.id}:${m.modelAnalysis?.analyzedAt ?? 0}`)
        .join('|'),
    [appState.models]
  );

  useEffect(() => {
    if (isViewer || appState.models.length === 0) return;
    if (beautifyModelsCountRef.current === appState.models.length) return;
    beautifyModelsCountRef.current = appState.models.length;
    const timer = window.setTimeout(() => runAutoBeautifyRef.current(), 150);
    return () => window.clearTimeout(timer);
  }, [appState.models.length, isViewer]);

  useEffect(() => {
    if (isViewer || !modelAnalysisSig) return;
    if (modelAnalysisSig === assetAnalysisSigRef.current) return;
    assetAnalysisSigRef.current = modelAnalysisSig;
    for (const m of appStateRef.current.models) {
      if (m.modelAnalysis) {
        applyAssetOptimizationsRef.current(m.id, m.modelAnalysis, m.modelFileName);
      }
    }
  }, [modelAnalysisSig, isViewer]);

  useEffect(() => {
    if (demoBootRef.current || isViewer || initialProject) return;

    const params = new URLSearchParams(window.location.search);
    const demoParam = params.get('demo');

    if (demoParam) {
      demoBootRef.current = true;
      if (demoParam === 'gallery') {
        setShowDemoGallery(true);
        return;
      }
      const id = demoParam === '1' ? FEATURED_DEMO_ID : demoParam;
      if (!getDemoScene(id)) return;
      setDemoHint(true);
      void loadDemoSceneRef.current(id);
      return;
    }

    if (!shouldAutoLoadDemo(isViewer)) return;

    demoBootRef.current = true;
    markResultFirstDone();
    dismissOnboardingRef.current();
    void loadDemoSceneRef.current(FEATURED_DEMO_ID).then(() => setPlayingRef.current(true));
  }, [isViewer, initialProject]);

  useEffect(() => {
    if (isViewer || resultFirstShownRef.current) return;
    if (appState.models.length > 0 && appState.isPlaying) {
      resultFirstShownRef.current = true;
      showResultFirstRef.current();
    }
  }, [appState.models.length, appState.isPlaying, isViewer]);

  const handleModelAnimationLoaded = (modelId: string, frameCount: number) => {
    setPlayheadFrame(0);
    setAppState((prev) => {
      const model = prev.models.find((m) => m.id === modelId);
      if (!model?.hasVmdAnimation || model.vmdPlaybackEnabled === false) return prev;

      const maxFrames = Math.max(10, frameCount);
      const vmdReadyCount = prev.models.filter(
        (m) =>
          m.visible &&
          m.hasVmdAnimation &&
          m.vmdPlaybackEnabled !== false &&
          (m.vmdBlobUrls?.length ?? 0) > 0
      ).length;

      return {
        ...prev,
        maxFrames: Math.max(prev.maxFrames, maxFrames),
        currentFrame: 0,
        // Duo: start playback when any character gets motion (not only the selected one).
        isPlaying: vmdReadyCount >= 1 ? true : prev.isPlaying,
      };
    });
  };

  const handleSetVmdPlaybackEnabled = (modelId: string, enabled: boolean) => {
    setPlayheadFrame(0);
    setAppState((prev) => {
      const model = prev.models.find((m) => m.id === modelId);
      if (!model?.hasVmdAnimation) return prev;

      const models = prev.models.map((m) =>
        m.id === modelId ? { ...m, vmdPlaybackEnabled: enabled, ...(enabled ? { activeTemplateId: null } : {}) } : m
      );

      if (prev.selectedObjectId !== modelId) {
        return { ...prev, models };
      }

      const hasTimeline = model.keyframes.length > 0;
      return {
        ...prev,
        models,
        currentFrame: 0,
        isPlaying: enabled ? true : hasTimeline ? prev.isPlaying : false,
      };
    });
  };

  // Clear scene back to empty voids
  const handleClearScene = () => {
    setAppState(prev => {
      prev.models.forEach(m => {
        if (m.fileMap) revokeFileMapUrls(m.fileMap);
      });
      return {
        ...prev,
        models: [],
        selectedObjectId: null,
        selectedBoneId: null,
        objects: prev.objects.filter(obj => obj.type !== 'model')
      };
    });
    setActiveDemoId(null);
  };
  clearSceneRef.current = handleClearScene;

  const onProjectFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => loadProjectFileRef.current(String(reader.result));
      reader.readAsText(file);
    },
    []
  );

  // Toggle visible rules
  const handleToggleVisibility = (id: string, type: 'model' | 'other') => {
    if (type === 'model') {
      setAppState(prev => ({
        ...prev,
        models: prev.models.map(m => m.id === id ? { ...m, visible: !m.visible } : m)
      }));
    } else {
      setAppState(prev => ({
        ...prev,
        objects: prev.objects.map(o => o.id === id ? { ...o, visible: !o.visible } : o)
      }));
    }
  };

  // Delete model
  const handleDeleteModel = (id: string) => {
    setAppState(prev => {
      const modelToRemove = prev.models.find(m => m.id === id);
      if (modelToRemove?.fileMap) {
        revokeFileMapUrls(modelToRemove.fileMap);
      }
      const remainingModels = prev.models.filter(m => m.id !== id);
      return {
        ...prev,
        models: remainingModels,
        selectedObjectId: prev.selectedObjectId === id ? (remainingModels[0]?.id || null) : prev.selectedObjectId,
        objects: prev.objects.filter(obj => obj.id !== id)
      };
    });
  };

  // Modify active facial morph sliders
  const applyPoseToMeshInstant = (pose: PoseSnapshotV1, morphs: typeof DEFAULT_MORPHS) => {
    const mesh = modelApiRef.current?.getMesh();
    if (!mesh) return;
    const merged: PoseSnapshotV1 = {
      ...pose,
      morphs: {
        eyes: morphs.eyes,
        mouth: morphs.mouth,
        brow: morphs.brow,
      },
    };
    applyPoseSnapshotToMesh(mesh, merged, {
      skipBoneNames: collectDynamicBoneNames(mesh),
    });
    modelApiRef.current?.syncSkeleton();
  };

  const handleApplyPose = (pose: PoseSnapshotV1) => {
    const modelId = appState.selectedObjectId;
    if (!modelId) return;
    setAppState((prev) => ({
      ...prev,
      isPlaying: false,
      models: prev.models.map((m) => {
        if (m.id !== modelId) return m;
        return {
          ...m,
          morphs: { ...pose.morphs },
          bones: poseBonesToModelBones(pose.bones, m.bones),
          poseHold: pose,
          activePoseId: pose.id,
          vmdPlaybackEnabled: false,
        };
      }),
    }));
    const model = appState.models.find((m) => m.id === modelId);
    if (model) {
      requestAnimationFrame(() => applyPoseToMeshInstant(pose, pose.morphs));
    }
  };

  const handleCapturePose = () => {
    const modelId = appState.selectedObjectId;
    const model = appState.models.find((m) => m.id === modelId);
    if (!model) return;
    const mesh = modelApiRef.current?.getMesh();
    const captured = capturePoseFromModel(model, mesh, 'My pose');
    captured.id = createPoseId();
    addCustomPose(captured);
    handleApplyPose(captured);
  };

  const handleReanalyzeModel = () => {
    const modelId = appState.selectedObjectId;
    const model = appState.models.find((m) => m.id === modelId);
    if (!modelId || !model) return;
    setAnalyzingModel(true);
    const mesh = modelApiRef.current?.getMesh() ?? null;
    void editor
      .runModelAnalysis(modelId, mesh, {
        fileMap: model.fileMap,
        modelFileName: model.modelFileName,
        force: true,
      })
      .finally(() => setAnalyzingModel(false));
  };

  const handleClearPoseHold = () => {
    const modelId = appState.selectedObjectId;
    if (!modelId) return;
    setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) =>
        m.id === modelId ? { ...m, poseHold: null, activePoseId: null } : m
      ),
    }));
  };

  const handleModifyMorphs = (modelId: string, morphName: 'eyes' | 'mouth' | 'brow', value: number) => {
    setAppState(prev => ({
      ...prev,
      models: prev.models.map(m => {
        if (m.id === modelId) {
          return {
            ...m,
            morphs: {
              ...m.morphs,
              [morphName]: value
            }
          };
        }
        return m;
      })
    }));
  };

  // Modify active skeletal bone rotations
  const handleModifyBone = (
    modelId: string, 
    boneId: string, 
    axes: 'rotationX' | 'rotationY' | 'rotationZ', 
    value: number
  ) => {
    setAppState(prev => ({
      ...prev,
      models: prev.models.map(m => {
        if (m.id === modelId) {
          return {
            ...m,
            bones: m.bones.map(b => b.id === boneId ? { ...b, [axes]: value } : b)
          };
        }
        return m;
      })
    }));
  };

  const handleBoneTransform = (
    modelId: string,
    boneId: string,
    update: BoneTransformUpdate
  ) => {
    setAppState(prev => ({
      ...prev,
      models: prev.models.map(m => {
        if (m.id !== modelId) return m;

        const existingBone = m.bones.find((b) => b.id === boneId);
        if (existingBone) {
          return {
            ...m,
            bones: m.bones.map((b) =>
              b.id === boneId
                ? {
                    ...b,
                    rotationX: update.rotationX ?? b.rotationX,
                    rotationY: update.rotationY ?? b.rotationY,
                    rotationZ: update.rotationZ ?? b.rotationZ,
                  }
                : b
            ),
          };
        }

        return {
          ...m,
          bones: [
            ...m.bones,
            {
              id: boneId,
              name: boneId,
              rotationX: update.rotationX ?? 0,
              rotationY: update.rotationY ?? 0,
              rotationZ: update.rotationZ ?? 0,
            },
          ],
        };
      }),
      selectedBoneId: boneId,
    }));
  };

  const handleModelMove = (modelId: string, x: number, y: number, z: number) => {
    setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) =>
        m.id === modelId ? { ...m, positionX: x, positionY: y, positionZ: z } : m
      ),
    }));
  };

  const handleModifyModelPosition = (
    modelId: string,
    axis: 'positionX' | 'positionY' | 'positionZ',
    value: number
  ) => {
    setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) =>
        m.id === modelId ? { ...m, [axis]: value } : m
      ),
    }));
  };

  const handlePatchSceneBackground = (patch: Partial<SceneBackgroundSettings>) => {
    setAppState((prev) => {
      const prevUrl = prev.sceneBackground.imageUrl;
      if (
        patch.imageUrl &&
        prevUrl &&
        prevUrl !== patch.imageUrl &&
        prevUrl.startsWith('blob:')
      ) {
        URL.revokeObjectURL(prevUrl);
      }
      return {
        ...prev,
        sceneBackground: { ...prev.sceneBackground, ...patch },
      };
    });
  };

  const handleClearSceneBackground = () => {
    setAppState((prev) => {
      const url = prev.sceneBackground.imageUrl;
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      return {
        ...prev,
        sceneBackground: { imageUrl: null, opacity: 1 },
      };
    });
  };

  const studioSidebar = (opts: {
    mobile: boolean;
    embedded?: boolean;
    proMobileSheet?: boolean;
    tab?: MobilePanelTab;
  }) => (
    <Sidebar
      beginnerMode={isBeginnerMode(product.uiMode)}
      isMobile={opts.mobile}
      embedded={opts.embedded}
      proMobileSheet={opts.proMobileSheet}
      mobileTab={opts.tab ?? mobilePanelTab}
      onClose={() => setShowLeftSidebar(false)}
      onMobileTabChange={setMobilePanelTab}
      onSetCameraMode={setCameraMode}
      onToggleManualCameraLock={() => product.toggleManualCameraLock()}
      appState={appState}
      sceneGraph={product.sceneGraph}
      lockedObjectIds={product.lockedObjectIds}
      onSceneGraphToggleVisibility={product.handleSceneGraphToggleVisibility}
      onSceneGraphToggleLock={product.handleSceneGraphToggleLock}
      onSceneGraphCreateGroup={product.handleSceneGraphCreateGroup}
      onSelectModel={(id) => {
        if (product.lockedObjectIds.has(id)) return;
        setAppState((prev) => ({ ...prev, selectedObjectId: id }));
      }}
      onSelectBone={(id) => setAppState((prev) => ({ ...prev, selectedBoneId: id }))}
      onToggleVisibility={handleToggleVisibility}
      onDeleteModel={handleDeleteModel}
      onModifyMorphs={handleModifyMorphs}
      onModifyBone={handleModifyBone}
      onModifyModelPosition={handleModifyModelPosition}
      onRegisterKeyframe={handleRegisterKeyframe}
      onLoadModel={handleLoadModel}
      onLoadCustomModel={handleLoadCustomModel}
      setPhysicsMode={(mode) => setAppState((prev) => ({ ...prev, physicsMode: mode }))}
      onSetVmdPlaybackEnabled={handleSetVmdPlaybackEnabled}
      onPatchMmdLite={handlePatchMmdLite}
      highlightMaterial={highlightMaterial}
      onSelectMaterial={setHighlightMaterial}
      onSelectPmxBone={editor.handleSelectPmxBone}
      collabConnected={collab.connected}
      collabRoom={collab.roomId}
      collabPeers={collab.peers}
      collabStatus={collab.status}
      onCollabJoin={collab.join}
      onCollabLeave={collab.leave}
      onApplyKeyframes={handleApplyKeyframes}
      onUpdateAnimLayers={handleUpdateAnimLayers}
      onToggleGroupSolo={handleToggleGroupSolo}
      onToggleGroupMute={handleToggleGroupMute}
      maxFrames={appState.maxFrames}
      onApplyPose={handleApplyPose}
      onCapturePose={handleCapturePose}
      onClearPoseHold={handleClearPoseHold}
      onReanalyzeModel={handleReanalyzeModel}
      analyzingModel={analyzingModel}
      onLoadDemo={(id) => void handleLoadDemoScene(id)}
      demoLoadingId={demoLoadingId}
      activeDemoId={activeDemoId}
      onOpenDemoGallery={() => setShowDemoGallery(true)}
    />
  );

  const proFxPanel = (
    <FxSettingsPanel
      visualFx={appState.visualFx}
      mmdLite={appState.mmdLite}
      rtxModeEnabled={appState.rtxModeEnabled}
      rtxSettings={appState.rtxSettings}
      characterQuality={appState.characterQuality}
      viewportFormat={viewportFormat}
      onSetVisualFx={setVisualFx}
      onPatchMmdLite={handlePatchMmdLite}
      onSetRtxModeEnabled={(enabled) => setAppState((s) => ({ ...s, rtxModeEnabled: enabled }))}
      onPatchRtxSettings={handlePatchRtxSettings}
      onCharacterQualityChange={(characterQuality) =>
        setAppState((s) => ({ ...s, characterQuality }))
      }
      captureCamera={() => captureCameraRef.current?.() ?? null}
      onFlyToBookmark={(snapshot) => {
        setCameraMode('free');
        flyToCameraRef.current?.(snapshot);
      }}
      onRestartPhysics={() => modelApiRef.current?.restartPhysics()}
      onFixPhysics={handleFixPhysics}
      videoRecordBusy={videoRecorder.busy}
      videoRecordMode={videoRecorder.mode}
      exportDurationSec={exportDurationSec}
      maxExportDurationSec={maxExportDurationSec}
      onExportDurationSecChange={setExportDurationSec}
      onRenderMp4={handleRenderMp4}
      onLiveRecord={handleLiveRecord}
    />
  );

  const proSceneTitle =
    appState.models.find((m) => m.id === appState.selectedObjectId)?.name ??
    appState.models[0]?.name ??
    (activeDemoId ? 'Demo scene' : 'AnimaStage Lite');

  const editorTimelineShell = (
    <EditorTimelineShell
      embeddedInSheet={layout.isMobileLayout}
      appState={appState}
      setCurrentFrame={handleSetCurrentFrame}
      setMaxFrames={handleSetMaxFrames}
      setIsPlaying={handleSetIsPlaying}
      onRegisterKeyframe={handleRegisterKeyframe}
      onDeleteKeyframe={handleDeleteKeyframe}
      onSelectTrack={setTimelineActiveTrack}
      onApplyTemplate={handleApplyTemplate}
      onClearAllKeyframes={handleClearAllKeyframes}
      onMoveKeyframe={editor.handleMoveKeyframe}
      onPatchKeyframe={editor.handlePatchKeyframe}
      activeTrack={
        appState.timelineActiveTrack && appState.timelineActiveTrack !== 'camera'
          ? (appState.timelineActiveTrack as TimelineTrackId)
          : null
      }
    />
  );

  const viewportColumn = (
    <div className="studio-viewport-column flex-1 flex flex-col overflow-hidden relative min-h-0 min-w-0">
      <Viewport
        appState={appState}
        mmdLite={appState.mmdLite}
        viewportFormat={viewportFormat}
        onViewportFormatChange={handleViewportFormatChange}
        onSetIsPlaying={handleSetIsPlaying}
        onSetCurrentFrame={handleSetCurrentFrame}
        onApplyAnimationTemplate={handleApplyTemplate}
        sceneBackground={appState.sceneBackground}
        onPatchSceneBackground={handlePatchSceneBackground}
        onClearSceneBackground={handleClearSceneBackground}
        showGrid={showGrid}
        showBones={showBones}
        showCameraHelper={showCameraHelper}
        showPhysicsBodies={showPhysicsBodies}
        onSelectBone={(id) => setAppState((prev) => ({ ...prev, selectedBoneId: id }))}
        onBoneTransform={handleBoneTransform}
        onModelMove={handleModelMove}
        onLoadCustomModel={isViewer ? undefined : handleLoadCustomModel}
        onModelAnimationLoaded={handleModelAnimationLoaded}
        captureCameraRef={captureCameraRef}
        flyToCameraRef={flyToCameraRef}
        modelApiRef={modelApiRef}
        sceneHdr={appState.sceneHdr}
        onHdrFileDrop={handleHdrFileDrop}
        onSetCameraMode={setCameraMode}
        onPatchCameraStudio={(patch) =>
          setAppState((prev) => ({
            ...prev,
            cameraStudio: { ...prev.cameraStudio, ...patch },
          }))
        }
        isRecordingVideo={videoRecorder.isRecording}
        onRecordingTick={videoRecorder.tickLiveRecord}
        onGlCanvasReady={(canvas) => {
          glCanvasRef.current = canvas;
        }}
        onInvalidateReady={(fn) => {
          invalidateSceneRef.current = fn;
        }}
        highlightMaterialName={highlightMaterial}
        onPmxMetadataLoaded={editor.handlePmxMetadata}
        onTryDemo={
          isViewer
            ? undefined
            : () => {
                product.dismissOnboarding();
                void handleLoadDemoScene(FEATURED_DEMO_ID);
              }
        }
      />
      {!isViewer && !layout.isMobileLayout ? (
        <ResultFirstBar
          visible={product.showResultFirst && appState.models.length > 0}
          onEdit={() => {
            product.dismissResultFirst();
            product.handleUiModeChange('pro');
            setShowLeftSidebar(true);
          }}
          onGenerateShort={product.openShortsSetup}
          onDismiss={product.dismissResultFirst}
        />
      ) : null}
      {!isViewer && (
        <ShortsSetupDialog
          open={product.shortsSetupOpen}
          models={appState.models.map((m) => ({
            id: m.id,
            name: m.name,
            vmdFileNames: m.vmdFileNames ?? [],
            activeVmdIndex: m.activeVmdIndex ?? 0,
          }))}
          durationSec={product.shortsDurationSec}
          busy={product.shortsGenerating}
          onDurationChange={product.setShortsDurationSec}
          onSelectVmd={product.setModelActiveVmdIndex}
          onAddVmdFiles={(modelId, files) => {
            void product.appendModelVmdFiles(modelId, files);
          }}
          onGenerate={product.confirmCreateShort}
          onClose={product.closeShortsSetup}
        />
      )}
      {!isViewer && (
        <ProductShortsFlow
          ref={shortsFlowRef}
          durationSec={product.shortsDurationSec}
          manualCameraLock={product.manualCameraLock}
          onShare={() => handleShareSceneRef.current()}
          onExportVideo={handleRenderMp4}
          onAutoFrame={product.frameShortCamera}
          onToggleManualCamera={product.toggleManualCameraLock}
        />
      )}
      {isViewer && initialProject && (
        <ViewerForkBar onEditThis={() => product.handleForkToEditor(initialProject)} />
      )}
      <RecordingHud
        visible={videoRecorder.isRecording}
        progress={videoRecorder.progress}
        mode={videoRecorder.mode}
        onCancel={videoRecorder.cancel}
      />
      {!layout.isMobileLayout &&
        !isViewer &&
        shouldShowTimeline(product.uiMode, showTimelinePanel) &&
        editorTimelineShell}
      {!layout.isMobileLayout && !isViewer && (
        <button
          type="button"
          onClick={() => setShowTimelinePanel(!showTimelinePanel)}
          className="absolute bottom-4 right-4 bg-[#1a1d24] border border-[#2c3240] py-1.5 px-3 text-xs font-bold text-zinc-300 hover:text-[#39c5bb] hover:border-[#39c5bb]/40 active:bg-[#121418] z-20 flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
        >
          <Video className="w-3.5 h-3.5" />
          {showTimelinePanel ? 'Hide Timeline' : 'Show Timeline'}
        </button>
      )}
    </div>
  );

  return (
    <div
      className={`app-shell w-screen font-sans cursor-default text-[var(--color-text-main)] ${
        layout.isMobileLayout ? 'studio-mobile-column studio-pro-mobile' : ''
      } ${layout.isMobileLandscape ? 'studio-mobile-landscape' : ''}`}
      style={{ background: 'var(--color-bg)' }}
      id="mmd-workspace-main"
    >
      <input
        ref={projectFileInputRef}
        type="file"
        accept=".animastage,.json,application/json"
        className="hidden"
        onChange={onProjectFileSelected}
      />
      {product.toast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg bg-zinc-900/95 border border-cyan-500/30 text-xs font-semibold text-cyan-100 shadow-lg pointer-events-none">
          {product.toast}
        </div>
      )}
      {!isViewer && isBeginnerMode(product.uiMode) && !layout.isMobileLayout && (
        <TemplatePicker
          beginnerMode
          onApplyTemplate={(id) => applyTemplateRef.current(id)}
        />
      )}
      {!isViewer && demoHint && (
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-cyan-950/90 border-b border-cyan-500/30 text-xs sm:text-sm text-cyan-100/90 z-50">
          <p>
            <span className="font-semibold text-cyan-300">Demo scene loaded.</span>{' '}
            Open <strong className="text-white">Scene → Demo Gallery</strong> for more, or drop your own{' '}
            <strong className="text-white">PMX</strong> + <strong className="text-white">VMD</strong>.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowDemoGallery(true)}
              className="text-xs font-bold text-cyan-300 hover:text-white cursor-pointer px-2 py-1"
            >
              More demos
            </button>
            <button
              type="button"
              onClick={() => setDemoHint(false)}
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {!isViewer && !layout.isMobileLayout && (
        <StudioFlowBar
          compact={false}
          uiMode={product.uiMode}
          onUiModeChange={product.handleUiModeChange}
          onSaveProject={product.handleSaveProject}
          onLoadProject={product.handleLoadProject}
          onLoadProjectFile={() => projectFileInputRef.current?.click()}
          onShareScene={() => void product.handleShareScene()}
          onCreateShort={product.openShortsSetup}
          onTryDemo={() => {
            product.dismissOnboarding();
            void handleLoadDemoScene(FEATURED_DEMO_ID);
          }}
          onExportMp4={handleRenderMp4}
          hasSavedProject={product.hasSaved}
          qualityMode={product.qualityMode}
          onQualityModeChange={product.handleQualityModeChange}
          shareBusy={product.shareBusy}
        />
      )}
      {!isViewer && (
      <DemoGalleryOverlay
        open={showDemoGallery}
        onClose={() => setShowDemoGallery(false)}
        onLoadDemo={(id) => void handleLoadDemoScene(id)}
        loadingDemoId={demoLoadingId}
        activeDemoId={activeDemoId}
      />
      )}
      {!isViewer && !isBeginnerMode(product.uiMode) && !layout.isMobileLayout && (
      <TopMenu 
        physicsMode={appState.physicsMode}
        setPhysicsMode={(mode) => setAppState(prev => ({ ...prev, physicsMode: mode }))}
        onLoadModel={handleLoadModel}
        onClearScene={handleClearScene}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showBones={showBones}
        setShowBones={setShowBones}
        showCameraHelper={showCameraHelper}
        setShowCameraHelper={setShowCameraHelper}
        showPhysicsBodies={showPhysicsBodies}
        setShowPhysicsBodies={setShowPhysicsBodies}
        onAddSampleKeyframes={handleAddSampleKeyframes}
        onApplyTemplate={handleApplyTemplate}
        visualFx={appState.visualFx}
        onSetVisualFx={setVisualFx}
        rtxModeEnabled={appState.rtxModeEnabled}
        onSetRtxModeEnabled={(rtxModeEnabled) =>
          setAppState((s) => ({ ...s, rtxModeEnabled }))
        }
        characterQuality={appState.characterQuality}
        onCharacterQualityChange={(characterQuality) =>
          setAppState((s) => ({ ...s, characterQuality }))
        }
        rtxSettings={appState.rtxSettings}
        onPatchRtxSettings={handlePatchRtxSettings}
        mmdLite={appState.mmdLite}
        onPatchMmdLite={handlePatchMmdLite}
        captureCamera={() => captureCameraRef.current?.() ?? null}
        onFlyToBookmark={(snapshot) => {
          setCameraMode('free');
          flyToCameraRef.current?.(snapshot);
        }}
        onRestartPhysics={() => modelApiRef.current?.restartPhysics()}
      onFixPhysics={handleFixPhysics}
        videoRecordBusy={videoRecorder.busy}
        videoRecordMode={videoRecorder.mode}
        exportDurationSec={exportDurationSec}
        maxExportDurationSec={maxExportDurationSec}
        onExportDurationSecChange={setExportDurationSec}
        onRenderMp4={handleRenderMp4}
        onLiveRecord={handleLiveRecord}
        onExportVmd={editor.handleExportVmd}
        onNewClip={editor.handleNewClip}
        onUndo={editor.handleUndo}
        onRedo={editor.handleRedo}
        onSimplifyTrack={editor.handleSimplifyTrack}
        onClearTrack={editor.handleClearTrack}
        onTimeStretch125={() => editor.handleTimeStretch(1.25)}
        onTimeStretch080={() => editor.handleTimeStretch(0.8)}
        viewportFormat={viewportFormat}
        selectedModelHasVmd={Boolean(
          appState.models.find((m) => m.id === appState.selectedObjectId)?.hasVmdAnimation
        )}
        vmdPlaybackEnabled={
          appState.models.find((m) => m.id === appState.selectedObjectId)?.vmdPlaybackEnabled !== false
        }
        onToggleVmdPlayback={() => {
          const id = appState.selectedObjectId;
          if (!id) return;
          const model = appState.models.find((m) => m.id === id);
          if (!model?.hasVmdAnimation) return;
          const currentlyOn = model.vmdPlaybackEnabled !== false;
          handleSetVmdPlaybackEnabled(id, !currentlyOn);
        }}
        isMobile={isMobileLayout}
        mobileNavOpen={mobileNavOpen}
        onMobileNavOpenChange={setMobileNavOpen}
        openMenuId={openTopMenuId}
        onOpenMenuIdChange={setOpenTopMenuId}
        onTryDemo={() => {
          product.dismissOnboarding();
          void handleLoadDemoScene(FEATURED_DEMO_ID);
        }}
      />
      )}

      {isViewer && initialProject && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#0a0b0e] border-b border-zinc-800/80">
          <div>
            <p className="text-sm font-bold text-zinc-100">{initialProject.name}</p>
            <p className="text-[10px] text-zinc-500">Viewer · autoplay · read-only</p>
          </div>
          <button
            type="button"
            onClick={() => product.handleForkToEditor(initialProject)}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 px-3 py-1.5 rounded border border-cyan-500/30 cursor-pointer"
          >
            Edit this
          </button>
        </div>
      )}

      {/* 2. Middle section — MobileLayout (≤768px) vs DesktopLayout (≥769px) */}
      <div className="app-shell__main relative">
        {!isViewer && layout.isMobileLayout ? (
          <ProMobileShell
            sceneTitle={proSceneTitle}
            viewport={viewportColumn}
            hasModel={appState.models.length > 0}
            isPlaying={appState.isPlaying}
            manualOrbit={
              appState.cameraMode === 'free' || appState.cameraStudio.manualCameraLock
            }
            onTogglePlay={() => handleSetIsPlaying(!appState.isPlaying)}
            onToggleOrbit={() => {
              if (appState.cameraMode === 'mmd') {
                product.toggleManualCameraLock();
              } else {
                setCameraMode('mmd');
              }
            }}
            onResetView={() => {
              setCameraMode('free');
              flyToCameraRef.current?.({
                position: [0, 14, 28],
                rotation: [0, 0, 0],
                fov: 45,
                target: appState.cameraOrbitAnchor ?? [0, 10, 0],
              });
            }}
            onShare={() => void product.handleShareScene()}
            onExport={() =>
              product.showToast(
                'Export: open the FX tab at the bottom → set length → MP4 HQ or Live. On Android, Live is more reliable.',
                5500
              )
            }
            shareBusy={product.shareBusy}
            onTryDemo={() => {
              product.dismissOnboarding();
              void handleLoadDemoScene(FEATURED_DEMO_ID);
            }}
            onSave={product.handleSaveProject}
            onOpenProject={() => projectFileInputRef.current?.click()}
            onClearScene={handleClearScene}
            mobilePanelTab={mobilePanelTab}
            onMobilePanelTabChange={setMobilePanelTab}
            optimizedHint={layout.applyMobileSafeMode}
            uiMode={product.uiMode}
            onUiModeChange={product.handleUiModeChange}
            qualityMode={product.qualityMode}
            onQualityModeChange={product.handleQualityModeChange}
            onApplyTemplate={(id) => applyTemplateRef.current(id)}
            timeline={!isBeginnerMode(product.uiMode) ? editorTimelineShell : undefined}
            renderPanel={(tab: ProMobileTab) =>
              tab === 'fx' ? (
                <div className="px-1 pb-4">{proFxPanel}</div>
              ) : (
                studioSidebar({
                  mobile: true,
                  embedded: true,
                  proMobileSheet: true,
                  tab,
                })
              )
            }
          />
        ) : !isViewer ? (
          <DesktopLayout
            showLeftSidebar={showLeftSidebar}
            onToggleLeftSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
            sidebar={showLeftSidebar ? studioSidebar({ mobile: isMobile && layout.isMobileLandscape }) : null}
            viewportColumn={viewportColumn}
          />
        ) : (
          viewportColumn
        )}
      </div>

    </div>
  );
}
