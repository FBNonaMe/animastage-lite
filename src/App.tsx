import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Video } from 'lucide-react';
import TopMenu from './components/TopMenu';
import Sidebar from './components/Sidebar';
import Viewport from './components/Viewport';
import { BoneTransformUpdate, type MMDModelApi } from './components/MMDModelWrapper';
import ModelImportDialog from './components/importSettings/ModelImportDialog';
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
  DEFAULT_STYLE_GALLERY,
  DEFAULT_PATH_TRACER_SETTINGS,
} from './types';
import {
  collectRetainedBlobBases,
  revokeBlobUrl,
  revokeFileMapUrls,
  mergeVmdIntoModel,
  type ProcessedMMDFiles,
  type ProcessedVmdFiles,
} from './utils/mmdFiles';
import {
  canAddSceneCharacter,
  getSpawnPositionForImport,
  MAX_SCENE_CHARACTERS,
  patchStateForMultiCharacterLoad,
  resolveVmdAttachTargetModelId,
} from './scene';
import {
  pickPreferredSelectModelId,
  sceneHasStage,
} from './utils/assetModelKind';
import { fixScenePhysics, clearPhysicsInstabilityHint, warnDuplicateModelImport } from './physics/physicsStabilitySystem';
import { playheadRef, MMD_FPS, setPlayheadFrame } from './utils/playhead';
import { createEmptyKeyframes } from './components/TimelineLogic';
import { createEmptyCameraKeyframes } from './components/CameraLogic';
import { CINEMATIC_VERTICAL_FX, DEFAULT_VISUAL_FX } from './templates/animationTemplates';
import { DEFAULT_CAMERA_STUDIO } from './camera/cameraStudioDefaults';
import { DEFAULT_REFERENCE_CAMERA } from './referenceCamera';
import ReferenceCameraStudioPanel from './components/referenceCamera/ReferenceCameraStudioPanel';
import type { ReferenceCameraState } from './referenceCamera';
import { portraitRecommendedQuality } from './utils/characterQuality';
import { DEFAULT_RTX_SETTINGS } from './utils/rtxSettings';
import type { CharacterQuality, RtxSettings } from './types';
import { useTimeline } from './hooks/useTimeline';
import { useVisualStyles } from './stylePacks/useVisualStyles';
import { useVideoRecorder } from './hooks/useVideoRecorder';
import { videoSaveLocationHint } from './native/saveBlob';
import RecordingHud from './components/RecordingHud';
import EditorTimelineShell from './components/editor/EditorTimelineShell';
import { useClipEditor } from './hooks/useClipEditor';
import { useGlobalUndo } from './hooks/useGlobalUndo';
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
import { useAdaptiveStudio } from './hooks/useAdaptiveStudio';
import type { MobilePanelTab } from './hooks/useStudioLayout';
import FxSettingsPanel from './components/FxSettingsPanel';
import { useSmartVideoMetadata } from './hooks/useSmartVideoMetadata';
import type { SmartVideoMetadata } from './smartMetadata/types';
import DesktopLayout from './layout/DesktopLayout';
import ProMobileShell from './layout/proMobile/ProMobileShell';
import type { ProMobileTab } from './layout/proMobile/types';
import StudioUi3Shell from './uiVersions/studio3/StudioUi3Shell';
import { createStudio3Panels, type Studio3PanelSources } from './uiVersions/studio3/createStudio3Panels';
import { workspaceToStudioPanel } from './layout/adaptiveMobile';
import {
  defaultViewportFormat,
  persistViewportFormat,
} from './utils/viewportFormatPreference';
import {
  InterfaceSelectionScreen,
  MigrationTips,
  UiComparisonPanel,
  hasChosenEditorInterface,
} from './uiVersions';
import { getCameraStudioPreset } from './camera/cameraStudioPresets';
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
import {
  SmartStudioDialog,
  SmartStudioOverlay,
  useSmartStudio,
  type SmartStudioBridge,
} from './smartStudio';
import { parseStudioEntry } from './flow/storage';
import { processImportedAssets } from './utils/assetImport';
import {
  useOneClickCreator,
  OneClickCreatorWizard,
} from './product/oneClick';
import {
  DEFAULT_CINEMATIC_ENGINE,
  useCinematicEngine,
} from './product/cinematic';
import { DEFAULT_VCS_STATE, useVcs } from './product/vcs';
import CinematographyStudioOverlay from './components/cinematic/CinematographyStudioOverlay';
import type { AnimaStageScene } from './product/scene/types';
import { isNativeApp } from './utils/platform';
import { nativeStudioStatePatch } from './native/nativeStudioBootstrap';
import { DEFAULT_SCENE_COMPOSER, normalizeSceneComposerLights } from './sceneComposer';
import type { SceneComposerState } from './sceneComposer';
import {
  DEFAULT_DYNAMIC_SKY,
  buildDynamicSkyPatches,
  resolveDynamicSkyLook,
  type DynamicSkyState,
} from './dynamicSky';
import { buildDirectCameraSnapshot } from './camera/directCamera';
import {
  DEFAULT_CINEMATIC_RENDER,
  applyCinematicQuality,
  applyCinematicSunTime,
  applyCinematicWeather,
  applyCinematicRenderStyle,
  patchCinematicRenderState,
  reapplyCinematicRender,
  prepareLiveRecordingQuality,
  liveRecordingBitrateMbps,
  liveRecordingMaxDpr,
  DEFAULT_CINEMA_RENDER,
} from './cinematicRender';
import {
  DEFAULT_ASRP,
  pipelineToRenderFlags,
  applyAsrpVisualStyle,
  applyAutoCinematicDirector,
  type AsrpPipelineId,
  type AsrpVisualStyleId,
} from './asrp';
import { DEFAULT_REFLECTION_SYSTEM } from './reflections';
import { DEFAULT_RENDER_PIPELINE_2 } from './renderPipeline2/defaults';
import {
  mergeRenderPipeline2,
  type RenderPipeline2ApplyResult,
} from './renderPipeline2/apply';
import type { RenderPipeline2State } from './renderPipeline2/types';
import { DEFAULT_RENDER_PIPELINE_3 } from './renderPipeline3/defaults';
import { mergeRenderPipeline3 } from './renderPipeline3/merge';
import type { RenderPipeline3ApplyResult } from './renderPipeline3/apply';
import type { RenderPipeline3State } from './renderPipeline3/types';
import { initAnimationLibrary } from './animationLibrary';
import { planAssignAnimation } from './animationLibrary/assign';
import type { AnimationLibraryState } from './animationLibrary/types';
import {
  DEFAULT_ASHFALL_CITY,
  type AshfallApplyResult,
  type AshfallCityState,
} from './ashfallCity';
import {
  DEFAULT_RENDER_PIPELINE_4,
  type RenderPipeline4State,
} from './renderPipeline4';
import {
  DEFAULT_MODEL_IMPORT_SETTINGS,
  buildCharacterImportStatePatch,
  buildStageImportStatePatch,
  loadModelImportSettings,
  settingsForSilentImport,
  type ModelImportSettings,
} from './importSettings';
import { useShotComposer } from './shotComposer/useShotComposer';
import {
  DEFAULT_SCENE_STUDIO,
  buildSceneMoodPatch,
  buildSmartScenePlan,
  type SceneMoodPresetId,
  type SmartSceneOptions,
} from './sceneStudio';
import {
  DEFAULT_SCENE_DIRECTOR,
  useSceneMusicSync,
  type SceneDirectorState,
} from './sceneDirector';
import { useCinemaExportSession } from './hooks/useCinemaExportSession';
import { releaseModelBlobAssets } from './stability/releaseModelAssets';
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
    physicsMode: isNativeApp() ? 'playtime' : 'anytime',
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
    referenceCamera: { ...DEFAULT_REFERENCE_CAMERA },
    sceneHdr: { blobUrl: null, fileName: null, intensity: 1, showBackground: false },
    sceneComposer: { ...DEFAULT_SCENE_COMPOSER },
    dynamicSky: { ...DEFAULT_DYNAMIC_SKY },
    styleGallery: { ...DEFAULT_STYLE_GALLERY },
    renderPipeline2: { ...DEFAULT_RENDER_PIPELINE_2 },
    renderPipeline3: { ...DEFAULT_RENDER_PIPELINE_3 },
    animationLibrary: initAnimationLibrary(),
    cinematic: { ...DEFAULT_CINEMATIC_ENGINE },
    cinematicRender: { ...DEFAULT_CINEMATIC_RENDER },
    cinemaRender: { ...DEFAULT_CINEMA_RENDER },
    reflectionSystem: { ...DEFAULT_REFLECTION_SYSTEM },
    asrp: { ...DEFAULT_ASRP },
    vcs: { ...DEFAULT_VCS_STATE },
    ashfallCity: { ...DEFAULT_ASHFALL_CITY },
    renderPipeline4: { ...DEFAULT_RENDER_PIPELINE_4 },
    modelImportSettings: loadModelImportSettings(),
    sceneStudio: { ...DEFAULT_SCENE_STUDIO },
    sceneDirector: { ...DEFAULT_SCENE_DIRECTOR },
    pathTracerLabEnabled: false,
    pathTracer: { ...DEFAULT_PATH_TRACER_SETTINGS },
    ...(isNativeApp() ? nativeStudioStatePatch() : {}),
  }));

  useSceneMusicSync(appState);

  const captureCameraRef = useRef<(() => CameraSnapshot | null) | null>(null);
  const flyToCameraRef = useRef<((snapshot: CameraSnapshot) => void) | null>(null);
  const modelApiRef = useRef<MMDModelApi | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureFrameRef = useRef<(() => string | null) | null>(null);
  const invalidateSceneRef = useRef<(() => void) | null>(null);
  const appStateRef = useRef(appState);
  appStateRef.current = appState;
  const cineExportRestoreRef = useRef<Partial<AppState> | null>(null);
  const loadDemoSceneRef = useRef<(demoId: string) => Promise<void>>(async () => {});
  const loadCustomModelRef = useRef<
    (payload: ProcessedMMDFiles | ProcessedMMDFiles[], settings?: ModelImportSettings) => void
  >(
    ((_payload: ProcessedMMDFiles | ProcessedMMDFiles[], _settings?: ModelImportSettings) => {
      /* assigned after handleLoadCustomModel */
    }) as (
      payload: ProcessedMMDFiles | ProcessedMMDFiles[],
      settings?: ModelImportSettings
    ) => void
  );
  const [highlightMaterial, setHighlightMaterial] = useState<string | null>(null);
  const clipEditor = useClipEditor();
  const globalUndo = useGlobalUndo();

  // UI responsive styling state
  const layout = useStudioLayout();
  const adaptive = useAdaptiveStudio();
  const [ifacePickerOpen, setIfacePickerOpen] = useState(
    () => !isViewer && !hasChosenEditorInterface()
  );
  const [uiCompareOpen, setUiCompareOpen] = useState(false);
  const isMobileLayout = layout.isMobileLayout;
  const isMobile = layout.isCompactStudio;
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [cineStudioOpen, setCineStudioOpen] = useState(false);
  const [refCamStudioOpen, setRefCamStudioOpen] = useState(false);
  const [showTimelinePanel, setShowTimelinePanel] = useState(true);
  const prevMobileLayoutRef = useRef(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobilePanelTab, setMobilePanelTab] = useState<MobilePanelTab>('scene');
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate'>('rotate');
  const mobileSafeAppliedRef = useRef(false);
  const [openTopMenuId, setOpenTopMenuId] = useState<string | null>(null);
  const maxExportDurationSec = Math.max(1, Math.floor(appState.maxFrames / MMD_FPS));
  const [exportDurationSec, setExportDurationSec] = useState(() =>
    Math.min(30, Math.max(1, Math.floor(120 / MMD_FPS)))
  );
  const [analyzingModel, setAnalyzingModel] = useState(false);
  const [pendingModelImport, setPendingModelImport] = useState<
    ProcessedMMDFiles | ProcessedMMDFiles[] | null
  >(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Viewport setup states (passed to TopMenu & Viewport)
  const [showGrid, setShowGrid] = useState(true);
  const [showBones, setShowBones] = useState(true);
  const [showCameraHelper, setShowCameraHelper] = useState(false);
  const [showPhysicsBodies, setShowPhysicsBodies] = useState(false);
  const [viewportFormat, setViewportFormat] = useState<ViewportFormat>(() =>
    defaultViewportFormat()
  );
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
    // Phone shell only (≤768). Tablets keep docked timeline/sidebar chrome.
    if (layout.isMobileLayout) {
      setShowLeftSidebar(false);
      setShowTimelinePanel(false);
      return;
    }
    if (isViewer) return;
    setShowLeftSidebar(true);
    setShowTimelinePanel(true);
    setMobileNavOpen(false);
    setOpenTopMenuId(null);
  }, [layout.isMobileLayout, isViewer]);

  const handleViewportFormatChange = useCallback(
    (format: ViewportFormat) => {
      if (format === viewportFormat) return;
      persistViewportFormat(format);
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

  const handleLutFileDrop = useCallback((blobUrl: string, fileName: string) => {
    setAppState((s) => {
      if (s.visualFx.customLutUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(s.visualFx.customLutUrl);
      }
      return {
        ...s,
        visualFx: {
          ...s.visualFx,
          customLutUrl: blobUrl,
          customLutName: fileName,
          customLutEnabled: true,
          customLutIntensity: s.visualFx.customLutIntensity ?? 1,
        },
      };
    });
  }, []);

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

  const handleSetPathTracerLabEnabled = (enabled: boolean) => {
    setAppState((s) => ({ ...s, pathTracerLabEnabled: enabled }));
  };

  const handlePatchPathTracer = (patch: Partial<import('./types').PathTracerSettings>) => {
    setAppState((s) => ({
      ...s,
      pathTracer: { ...(s.pathTracer ?? DEFAULT_PATH_TRACER_SETTINGS), ...patch },
    }));
  };

  const {
    setCurrentFrame: handleSetCurrentFrame,
    setMaxFrames: handleSetMaxFrames,
    setIsPlaying: handleSetIsPlaying,
    handleRegisterKeyframe,
    handleRegisterCameraKeyframe,
    handleDeleteKeyframe,
    handleAddSampleKeyframes,
    handleApplyTemplate,
    handleClearAllKeyframes,
    setTimelineActiveTrack,
    setCameraMode,
    setVisualFx,
    replaceVisualFx,
  } = useTimeline({
    appState,
    setAppState,
    captureCameraRef,
    recordGlobalUndo: () => globalUndo.record(appStateRef.current),
  });
  setPlayingRef.current = handleSetIsPlaying;

  const handleEnterDirectCameraMode = useCallback(() => {
    setCameraMode('free');
    setTimelineActiveTrack(null);
    setAppState((prev) => ({
      ...prev,
      isPlaying: false,
      cameraStudio: {
        ...prev.cameraStudio,
        autoFocus: false,
        manualCameraLock: true,
        directPlacement: true,
      },
    }));
    flyToCameraRef.current?.(buildDirectCameraSnapshot(viewportFormat));
    invalidateSceneRef.current?.();
  }, [setCameraMode, setTimelineActiveTrack, viewportFormat]);

  const visualStyles = useVisualStyles({
    visualFx: appState.visualFx,
    characterQuality: appState.characterQuality,
    sceneComposer: appState.sceneComposer,
    replaceVisualFx,
    setCharacterQuality: (characterQuality) =>
      setAppState((s) => ({ ...s, characterQuality })),
    onGalleryApplied: (result) => {
      setAppState((prev) => ({
        ...prev,
        characterQuality:
          result.characterQuality ??
          (result.visualFx.materialDetailing !== false && prev.characterQuality === 'standard'
            ? 'hd'
            : prev.characterQuality),
        sceneBackground:
          prev.sceneBackground.imageUrl != null
            ? { ...prev.sceneBackground, imageUrl: null }
            : prev.sceneBackground,
        sceneComposer: result.composerPatch
          ? {
              ...prev.sceneComposer,
              ...result.composerPatch,
              bgMode: result.composerPatch.bgMode ?? 'scene',
              lights: result.composerPatch.lights
                ? { ...prev.sceneComposer.lights, ...result.composerPatch.lights }
                : prev.sceneComposer.lights,
              effectLevels: result.composerPatch.effectLevels
                ? { ...prev.sceneComposer.effectLevels, ...result.composerPatch.effectLevels }
                : prev.sceneComposer.effectLevels,
            }
          : prev.sceneComposer,
        styleGallery: {
          ...prev.styleGallery,
          autoLuminousLevel: result.autoLuminous ?? prev.styleGallery.autoLuminousLevel,
        },
      }));
    },
  });

  const persistExportMetadata = useCallback((metadata: SmartVideoMetadata) => {
    setAppState((s) => ({ ...s, exportMetadata: metadata }));
  }, []);

  const smartVideoMetadata = useSmartVideoMetadata({
    appState,
    viewportFormat,
    exportDurationSec,
    activeStyleId: visualStyles.activeStyleId,
    installedStylePacks: visualStyles.installed,
    onPersist: persistExportMetadata,
  });

  useEffect(() => {
    if (appState.exportMetadata) {
      smartVideoMetadata.setVisible(true);
    }
  }, [appState.exportMetadata, smartVideoMetadata.setVisible]);

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

  const shotComposerApi = useShotComposer({
    appState,
    setAppState,
    viewportFormat,
    onViewportFormatChange: handleViewportFormatChange,
    flyToCamera: (snapshot) => flyToCameraRef.current?.(snapshot),
    captureCamera: () => captureCameraRef.current?.() ?? null,
    showToast: (msg, ms) => product.showToast(msg, ms ?? 2000),
  });

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
    // getMobileSafeStatePatch already applies performance quality fields — do not also
    // call product.handleQualityModeChange (product identity changes every render).
    setAppState((prev) => ({ ...prev, ...getMobileSafeStatePatch(prev) }));
  }, [layout.applyMobileSafeMode]);

  useEffect(() => {
    if (isViewer || appState.models.length === 0) return;
    dismissOnboardingRef.current();
  }, [appState.models.length, isViewer]);

  const editor = useEditorDocument(appState, setAppState, clipEditor, globalUndo, {
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

  const {
    handleRenderMp4,
    handleCinemaRender,
    handlePatchRenderPipeline4,
    handleRp4ProfessionalExport,
  } = useCinemaExportSession({
    appStateRef,
    setAppState,
    viewportFormat,
    setViewportFormat: handleViewportFormatChange,
    exportDurationSec,
    videoRecorder,
    prepareMetadata: (mode) =>
      smartVideoMetadata.prepareForExport(mode as 'mp4_hq'),
    restoreRef: cineExportRestoreRef,
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

  useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<{ message?: string; durationMs?: number }>).detail;
      const msg = detail?.message?.trim();
      if (!msg) return;
      product.showToast(msg, detail?.durationMs ?? 5000);
    };
    window.addEventListener('animastage:toast', onToast);
    return () => window.removeEventListener('animastage:toast', onToast);
  }, [product.showToast]);

  /** Restore viewport quality after live recording ends. */
  const liveModeRef = useRef(videoRecorder.mode);
  useEffect(() => {
    const prev = liveModeRef.current;
    liveModeRef.current = videoRecorder.mode;
    if (prev === 'live' && videoRecorder.mode === 'idle') {
      const restore = cineExportRestoreRef.current;
      cineExportRestoreRef.current = null;
      if (restore) {
        setAppState((s) => ({
          ...s,
          visualFx: restore.visualFx ?? s.visualFx,
          sceneComposer: restore.sceneComposer ?? s.sceneComposer,
          characterQuality: restore.characterQuality ?? s.characterQuality,
          rtxModeEnabled: restore.rtxModeEnabled ?? s.rtxModeEnabled,
          rtxSettings: restore.rtxSettings ?? s.rtxSettings,
          reflectionSystem: restore.reflectionSystem ?? s.reflectionSystem,
          asrp: restore.asrp ?? s.asrp,
          renderPipeline2: restore.renderPipeline2 ?? s.renderPipeline2,
          renderPipeline3: restore.renderPipeline3 ?? s.renderPipeline3,
        }));
      }
    }
  }, [videoRecorder.mode]);

  const handleApplyCinematicQuality = useCallback(
    (id: import('./cinematicRender').CinematicQualityPresetId) => {
      setAppState((prev) => ({ ...prev, ...applyCinematicQuality(prev, id) }));
    },
    []
  );

  const handleApplyCinematicSun = useCallback(
    (id: import('./cinematicRender').CinematicSunTimeId) => {
      setAppState((prev) => ({ ...prev, ...applyCinematicSunTime(prev, id) }));
    },
    []
  );

  const handleApplyCinematicWeather = useCallback(
    (id: import('./types').WeatherPresetId) => {
      setAppState((prev) => ({ ...prev, ...applyCinematicWeather(prev, id) }));
    },
    []
  );

  const handleApplyCinematicStyle = useCallback(
    (id: import('./cinematicRender').CinematicRenderStyleId) => {
      setAppState((prev) => ({ ...prev, ...applyCinematicRenderStyle(prev, id) }));
    },
    []
  );

  const handlePatchCinematicRender = useCallback(
    (patch: Partial<NonNullable<AppState['cinematicRender']>>, rebuild = true) => {
      setAppState((prev) => ({ ...prev, ...patchCinematicRenderState(prev, patch, rebuild) }));
    },
    []
  );

  const handleReapplyCinematicRender = useCallback(() => {
    setAppState((prev) => ({ ...prev, ...reapplyCinematicRender(prev) }));
  }, []);

  const handlePatchReflectionSystem = useCallback(
    (patch: Partial<NonNullable<AppState['reflectionSystem']>>) => {
      setAppState((prev) => ({
        ...prev,
        reflectionSystem: {
          ...(prev.reflectionSystem ?? DEFAULT_REFLECTION_SYSTEM),
          ...patch,
        },
      }));
    },
    []
  );

  const handlePatchAsrp = useCallback(
    (patch: Partial<NonNullable<AppState['asrp']>>) => {
      setAppState((prev) => {
        const nextAsrp = { ...(prev.asrp ?? DEFAULT_ASRP), ...patch };
        const flags =
          patch.pipeline != null
            ? pipelineToRenderFlags(patch.pipeline as AsrpPipelineId)
            : null;
        return {
          ...prev,
          asrp: nextAsrp,
          ...(flags
            ? {
                rtxModeEnabled: flags.rtxModeEnabled,
                visualFx: {
                  ...prev.visualFx,
                  renderMode: flags.renderMode,
                  materialDetailing: flags.renderMode !== 'mmd_fidelity',
                },
              }
            : {}),
        };
      });
    },
    []
  );

  const handlePatchRenderPipeline2 = useCallback((patch: Partial<RenderPipeline2State>) => {
    setAppState((prev) => ({
      ...prev,
      renderPipeline2: mergeRenderPipeline2(
        prev.renderPipeline2 ?? DEFAULT_RENDER_PIPELINE_2,
        patch
      ),
    }));
  }, []);

  const handleApplyRenderPipeline2 = useCallback(
    (result: RenderPipeline2ApplyResult, next: RenderPipeline2State) => {
      setAppState((prev) => ({
        ...prev,
        renderPipeline2: next,
        visualFx: { ...prev.visualFx, ...result.visualFx },
        asrp: { ...(prev.asrp ?? DEFAULT_ASRP), ...result.asrp },
        sceneComposer: {
          ...prev.sceneComposer,
          ...result.sceneComposer,
          lights: {
            ...prev.sceneComposer.lights,
            ...result.sceneComposer.lights,
          },
        },
        rtxModeEnabled: result.rtxModeEnabled ?? prev.rtxModeEnabled,
        characterQuality: result.characterQuality ?? prev.characterQuality,
        dynamicSky: prev.dynamicSky
          ? { ...prev.dynamicSky, ...result.dynamicSky }
          : prev.dynamicSky,
        cinemaRender: {
          ...(prev.cinemaRender ?? DEFAULT_CINEMA_RENDER),
          ...result.cinemaRender,
        },
        cinematicRender: {
          ...(prev.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
          ...result.cinematicRender,
        },
        reflectionSystem: {
          ...(prev.reflectionSystem ?? DEFAULT_REFLECTION_SYSTEM),
          ...result.reflectionSystem,
        },
      }));
    },
    []
  );

  const handlePatchRenderPipeline3 = useCallback((patch: Partial<RenderPipeline3State>) => {
    setAppState((prev) => ({
      ...prev,
      renderPipeline3: mergeRenderPipeline3(
        prev.renderPipeline3 ?? DEFAULT_RENDER_PIPELINE_3,
        patch
      ),
    }));
  }, []);

  const handleApplyRenderPipeline3 = useCallback(
    (result: RenderPipeline3ApplyResult, next: RenderPipeline3State) => {
      setAppState((prev) => ({
        ...prev,
        renderPipeline3: next,
        renderPipeline2: result.renderPipeline2,
        visualFx: { ...prev.visualFx, ...result.visualFx },
        asrp: { ...(prev.asrp ?? DEFAULT_ASRP), ...result.asrp },
        sceneComposer: {
          ...prev.sceneComposer,
          ...result.sceneComposer,
          lights: {
            ...prev.sceneComposer.lights,
            ...result.sceneComposer.lights,
          },
        },
        rtxModeEnabled: result.rtxModeEnabled ?? prev.rtxModeEnabled,
        characterQuality: result.characterQuality ?? prev.characterQuality,
        dynamicSky: prev.dynamicSky
          ? { ...prev.dynamicSky, ...result.dynamicSky }
          : prev.dynamicSky,
        cinemaRender: {
          ...(prev.cinemaRender ?? DEFAULT_CINEMA_RENDER),
          ...result.cinemaRender,
        },
        cinematicRender: {
          ...(prev.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
          ...result.cinematicRender,
        },
        reflectionSystem: {
          ...(prev.reflectionSystem ?? DEFAULT_REFLECTION_SYSTEM),
          ...result.reflectionSystem,
        },
      }));
    },
    []
  );

  const handlePatchCinemaRender = useCallback(
    (patch: Partial<NonNullable<AppState['cinemaRender']>>) => {
      setAppState((prev) => ({
        ...prev,
        cinemaRender: {
          ...(prev.cinemaRender ?? DEFAULT_CINEMA_RENDER),
          ...patch,
        },
      }));
    },
    []
  );

  const handleApplyAsrpVisualStyle = useCallback((id: AsrpVisualStyleId) => {
    setAppState((prev) => ({ ...prev, ...applyAsrpVisualStyle(prev, id) }));
  }, []);

  const handleAutoCinematicDirector = useCallback(() => {
    setAppState((prev) => applyAutoCinematicDirector(prev, viewportFormat, 10));
  }, [viewportFormat]);

  const handleLiveRecord = useCallback(() => {
    if (videoRecorder.mode === 'live') {
      videoRecorder.stopLive();
    } else {
      smartVideoMetadata.prepareForExport('live');
      // LIVE must stay realtime — never apply Cinema / MP4 HQ quality bump.
      const liveQ = prepareLiveRecordingQuality(appStateRef.current, viewportFormat);
      if (liveQ.applied) {
        cineExportRestoreRef.current = liveQ.restore;
        setAppState((prev) => ({ ...prev, ...liveQ.patch }));
      }
      videoRecorder.startLive({
        bitrateMbps: liveRecordingBitrateMbps(viewportFormat, isNativeApp()),
        maxDpr: liveRecordingMaxDpr(viewportFormat),
      });
    }
  }, [videoRecorder, smartVideoMetadata, viewportFormat]);

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
      const lastFrame = incoming.reduce((max, k) => Math.max(max, k.frame), 0);
      setAppState((prev) => ({
        ...prev,
        maxFrames: Math.max(prev.maxFrames, lastFrame + 1, 30),
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
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
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
      revokeBlobUrl(m.blobUrl);
      for (const url of m.vmdBlobUrls ?? []) revokeBlobUrl(url);
      if (m.fileMap) revokeFileMapUrls(m.fileMap);
    }
  }, []);

  // Custom uploads (folder / zip / drop) — supports multiple .pmx/.pmd in one bundle.
  const handleFixPhysics = useCallback(() => {
    clearPhysicsInstabilityHint();
    fixScenePhysics();
  }, []);

  const [smartStudioPickerOpen, setSmartStudioPickerOpen] = useState(false);
  const smartStudioBridge = useMemo<SmartStudioBridge>(
    () => ({
      setAppState,
      getAppState: () => appStateRef.current,
      flyToCamera: (snapshot) => flyToCameraRef.current?.(snapshot),
      applyCameraMode: (mode) => product.handleApplyCameraMode(mode),
      applyTemplate: (templateId, mode) => handleApplyTemplate(templateId, mode),
      fixPhysics: () => handleFixPhysics(),
      getCanvas: () => glCanvasRef.current,
      startVideoRecord: () => {
        void videoRecorder.startOffline();
      },
      setViewportFormat: handleViewportFormatChange,
      invalidateScene: () => invalidateSceneRef.current?.(),
      setModelActiveVmdIndex: product.setModelActiveVmdIndex,
    }),
    [
      product.handleApplyCameraMode,
      product.setModelActiveVmdIndex,
      handleApplyTemplate,
      handleFixPhysics,
      handleViewportFormatChange,
      videoRecorder,
    ]
  );
  const smartStudio = useSmartStudio(smartStudioBridge);

  const oneClickBridge = useMemo(
    () => ({
      getAppState: () => appStateRef.current,
      setAppState,
      loadDemo: (id: string) => loadDemoSceneRef.current(id),
      loadCustomModel: (files: FileList | File[]) => {
        void (async () => {
          const list = Array.from(files);
          const result = await processImportedAssets(list);
          if ('error' in result) {
            product.showToast(result.error, 4000);
            return;
          }
          if (result.kind === 'characters') {
            // Silent one-click: never apply stale env/fog/camera flags from localStorage.
            loadCustomModelRef.current(
              result.models.length === 1 ? result.models[0]! : result.models,
              settingsForSilentImport(appStateRef.current.modelImportSettings)
            );
          }
        })();
      },
      applyTemplate: (
        templateId: string,
        mode?: 'merge' | 'replace',
        options?: { useTemplateCamera?: boolean; preserveCameraKeyframes?: boolean }
      ) => handleApplyTemplate(templateId, mode, options),
      applyStyle: (styleId: string) => visualStyles.selectStyle(styleId),
      fixPhysics: () => handleFixPhysics(),
      flyToCamera: (snapshot: CameraSnapshot) => flyToCameraRef.current?.(snapshot),
      setViewportFormat: handleViewportFormatChange,
      setQualityMode: (mode: import('./product/scene/types').QualityMode) =>
        product.handleQualityModeChange(mode),
      setPlaying: (playing: boolean) => handleSetIsPlaying(playing),
      enterCameraEdit: () => {
        setCameraMode('mmd');
        setTimelineActiveTrack('camera');
        setAppState((prev) => ({
          ...prev,
          isPlaying: false,
          cameraStudio: {
            ...prev.cameraStudio,
            manualCameraLock: false,
            autoFocus: false,
          },
        }));
      },
      registerCameraKeyframe: () => handleRegisterCameraKeyframe(),
      setExportDurationSec,
      prepareMetadata: (mode: import('./smartMetadata/types').ExportFormatId) =>
        smartVideoMetadata.prepareForExport(mode),
      startExport: () => {
        smartVideoMetadata.prepareForExport('mp4_hq');
        void videoRecorder.startOffline();
      },
      captureFrame: () => captureFrameRef.current?.() ?? null,
      setCurrentFrame: handleSetCurrentFrame,
      invalidateScene: () => invalidateSceneRef.current?.(),
      makeShortsBridge: () => product.makeShortsBridge(),
    }),
    [
      handleApplyTemplate,
      handleFixPhysics,
      handleRegisterCameraKeyframe,
      handleSetCurrentFrame,
      handleSetIsPlaying,
      handleViewportFormatChange,
      product,
      setCameraMode,
      setTimelineActiveTrack,
      smartVideoMetadata,
      visualStyles.selectStyle,
      videoRecorder,
    ]
  );

  const oneClickCreator = useOneClickCreator(oneClickBridge);

  const cinematicBridge = useMemo(
    () => ({
      getAppState: () => appStateRef.current,
      setAppState,
      setViewportFormat: handleViewportFormatChange,
      setQualityMode: (mode: import('./product/scene/types').QualityMode) =>
        product.handleQualityModeChange(mode),
      invalidateScene: () => invalidateSceneRef.current?.(),
    }),
    [handleViewportFormatChange, product]
  );
  const cinematicEngine = useCinematicEngine(cinematicBridge);

  const vcsBridge = useMemo(
    () => ({
      getAppState: () => appStateRef.current,
      setAppState,
      getViewportFormat: () => viewportFormat,
      invalidateScene: () => invalidateSceneRef.current?.(),
    }),
    [viewportFormat]
  );
  const vcs = useVcs(vcsBridge);

  const creatorBootRef = useRef(false);
  const oneClickEnterRef = useRef(oneClickCreator.enter);
  oneClickEnterRef.current = oneClickCreator.enter;

  useEffect(() => {
    if (isViewer || creatorBootRef.current) return;
    const { flow } = parseStudioEntry(window.location.search);
    if (flow !== 'creator') return;
    creatorBootRef.current = true;
    demoBootRef.current = true;
    dismissOnboardingRef.current();
    oneClickEnterRef.current();
  }, [isViewer]);

  const exportDoneRef = useRef(false);
  const oneClickExportCompleteRef = useRef(oneClickCreator.onExportComplete);
  oneClickExportCompleteRef.current = oneClickCreator.onExportComplete;
  useEffect(() => {
    if (!oneClickCreator.state.active || !oneClickCreator.state.exporting) {
      exportDoneRef.current = false;
      return;
    }
    const phase = videoRecorder.progress.phase;
    if (phase === 'done' && !exportDoneRef.current) {
      exportDoneRef.current = true;
      const msg = videoRecorder.progress.message ?? '';
      const match = msg.match(/([\w.-]+\.mp4)/i);
      oneClickExportCompleteRef.current(match?.[1] ?? 'mmd-render.mp4');
    }
    if (phase === 'error' || phase === 'cancelled') {
      exportDoneRef.current = false;
    }
  }, [
    oneClickCreator.state.active,
    oneClickCreator.state.exporting,
    videoRecorder.progress.phase,
    videoRecorder.progress.message,
  ]);

  useEffect(() => {
    if (!smartStudio.state.hideEditorChrome) return;
    setShowLeftSidebar(false);
    setShowTimelinePanel(false);
  }, [smartStudio.state.hideEditorChrome]);

  useEffect(() => {
    if (!oneClickCreator.state.active) return;
    setShowLeftSidebar(false);
    setShowTimelinePanel(false);
  }, [oneClickCreator.state.active]);

  const vmdAttachTargetModelId = useMemo(
    () => resolveVmdAttachTargetModelId(appState.selectedObjectId, appState.models),
    [appState.selectedObjectId, appState.models]
  );

  const handleLoadCustomModel = useCallback(
    (
      payload: ProcessedMMDFiles | ProcessedMMDFiles[],
      importSettings?: ModelImportSettings
    ) => {
      const items = Array.isArray(payload) ? payload : [payload];
      if (items.length === 0) return;

      const settings =
        importSettings ??
        appStateRef.current.modelImportSettings ??
        DEFAULT_MODEL_IMPORT_SETTINGS;

      setPlayheadFrame(0);

      setAppState((prev) => {
        const multiPatch = patchStateForMultiCharacterLoad(prev);
        const added: MMDModel[] = [];
        const addedObjects: AppState['objects'] = [];
        let cameraVmdBlobUrl: string | null = prev.cameraVmdBlobUrl ?? null;
        let cameraVmdFileName: string | null = prev.cameraVmdFileName ?? null;
        let hasCameraVmd: boolean = prev.hasCameraVmd ?? false;

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

          const spawn = getSpawnPositionForImport([...prev.models, ...added], items, i);
          const newId = `model_${Date.now()}_${i}`;
          const hasVmd = (data.vmdBlobUrls?.length ?? 0) > 0;
          const modelHasCameraVmd = data.hasCameraVmd ?? false;
          const isGeneric = data.modelFormat && data.modelFormat !== 'mmd';

          // Cameras from asset only when opted in.
          if (modelHasCameraVmd && settings.importCameras) {
            cameraVmdBlobUrl = data.cameraVmdBlobUrl ?? null;
            cameraVmdFileName = data.cameraVmdFileName ?? null;
            hasCameraVmd = true;
          }

          added.push({
            id: newId,
            name: data.name,
            type: 'custom',
            modelFormat: data.modelFormat ?? 'mmd',
            assetKind: data.assetKind ?? (isGeneric ? 'character' : undefined),
            visible: true,
            morphs: { ...DEFAULT_MORPHS },
            bones: JSON.parse(JSON.stringify(DEFAULT_BONES)),
            positionX: spawn.x,
            positionY: spawn.y,
            positionZ: spawn.z,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            keyframes: createEmptyKeyframes(),
            blobUrl: data.blobUrl,
            modelFileName: data.modelFileName,
            contentFingerprint: fingerprint,
            customManager: data.manager,
            fileMap: data.fileMap,
            vmdBlobUrls: settings.importAnimations ? data.vmdBlobUrls : [],
            vmdFileNames: settings.importAnimations ? data.vmdFileNames : [],
            hasVmdAnimation: settings.importAnimations ? hasVmd : false,
            vmdPlaybackEnabled: settings.importAnimations && hasVmd ? true : undefined,
            activeVmdIndex: 0,
          });

          addedObjects.push({ id: newId, name: data.name, type: 'model', visible: true });
        }

        if (added.length === 0) {
          window.alert(`Maximum ${MAX_SCENE_CHARACTERS} characters in the scene.`);
          return prev;
        }

        const allModels = [...prev.models, ...added];
        const preferredId = pickPreferredSelectModelId(allModels) ?? added[added.length - 1]!.id;
        const envPatch = buildCharacterImportStatePatch(prev, settings);

        return {
          ...prev,
          ...multiPatch,
          ...envPatch,
          models: allModels,
          selectedObjectId: preferredId,
          selectedBoneId: added.find((m) => m.id === preferredId)?.assetKind === 'stage' ? null : 'head',
          isPlaying: false,
          currentFrame: 0,
          cameraVmdBlobUrl,
          cameraVmdFileName,
          hasCameraVmd,
          objects: [...prev.objects, ...addedObjects],
          modelImportSettings: settings,
          // RP4: character import never mutates fog / bloom / sky / weather / lighting / FX.
          visualFx: envPatch.visualFx
            ? { ...prev.visualFx, ...envPatch.visualFx }
            : prev.visualFx,
          sceneComposer: envPatch.sceneComposer
            ? {
                ...prev.sceneComposer,
                ...envPatch.sceneComposer,
                lights: {
                  ...prev.sceneComposer.lights,
                  ...(envPatch.sceneComposer.lights ?? {}),
                },
              }
            : prev.sceneComposer,
        };
      });
      setActiveDemoId(null);
    },
    []
  );
  loadCustomModelRef.current = handleLoadCustomModel;

  const requestLoadCustomModel = useCallback(
    (payload: ProcessedMMDFiles | ProcessedMMDFiles[]) => {
      setPendingModelImport(payload);
      setImportDialogOpen(true);
    },
    []
  );
  /** Import FBX/PMX/GLB/OBJ as scene background (stage) — not counted as a character slot. */
  const handleImportBackgroundModel = useCallback(
    (payload: ProcessedMMDFiles | ProcessedMMDFiles[]) => {
      const items = (Array.isArray(payload) ? payload : [payload]).map((d) => ({
        ...d,
        assetKind: 'stage' as const,
      }));
      if (items.length === 0) return;

      setPlayheadFrame(0);

      setAppState((prev) => {
        const keptModels: MMDModel[] = [];
        const stagesToRevoke: MMDModel[] = [];
        for (const m of prev.models) {
          if (m.assetKind === 'stage') {
            stagesToRevoke.push(m);
            continue;
          }
          keptModels.push(m);
        }
        const retain = collectRetainedBlobBases(keptModels);
        for (const m of stagesToRevoke) {
          revokeBlobUrl(m.blobUrl, retain);
          for (const url of m.vmdBlobUrls ?? []) revokeBlobUrl(url, retain);
          if (m.fileMap) revokeFileMapUrls(m.fileMap, retain);
        }

        const keptObjectIds = new Set(keptModels.map((m) => m.id));
        const keptObjects = prev.objects.filter((o) => keptObjectIds.has(o.id));

        const added: MMDModel[] = [];
        const addedObjects: AppState['objects'] = [];

        for (let i = 0; i < items.length; i++) {
          const data = items[i]!;
          const newId = `bg_${Date.now()}_${i}`;
          added.push({
            id: newId,
            name: data.name,
            type: 'custom',
            modelFormat: data.modelFormat ?? 'mmd',
            assetKind: 'stage',
            visible: true,
            morphs: { ...DEFAULT_MORPHS },
            bones: JSON.parse(JSON.stringify(DEFAULT_BONES)),
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            worldScale: 1,
            keyframes: createEmptyKeyframes(),
            blobUrl: data.blobUrl,
            modelFileName: data.modelFileName,
            contentFingerprint: data.contentFingerprint,
            customManager: data.manager,
            fileMap: data.fileMap,
            vmdBlobUrls: data.vmdBlobUrls,
            vmdFileNames: data.vmdFileNames,
            hasVmdAnimation: false,
            activeVmdIndex: 0,
          });
          addedObjects.push({ id: newId, name: data.name, type: 'model', visible: true });
        }

        const allModels = [...keptModels, ...added];
        const preferredId = pickPreferredSelectModelId(allModels);
        const settings =
          prev.modelImportSettings ?? DEFAULT_MODEL_IMPORT_SETTINGS;
        const envPatch = buildStageImportStatePatch(prev, settings);

        return {
          ...prev,
          ...envPatch,
          models: allModels,
          objects: [...keptObjects, ...addedObjects],
          selectedObjectId: preferredId,
          selectedBoneId:
            allModels.find((m) => m.id === preferredId)?.assetKind === 'character' ? 'head' : null,
          isPlaying: false,
          currentFrame: 0,
          // RP4: stage import must not rewrite fog / bloom / exposure / weather.
          visualFx: envPatch.visualFx
            ? { ...prev.visualFx, ...envPatch.visualFx }
            : prev.visualFx,
          sceneComposer: envPatch.sceneComposer
            ? {
                ...prev.sceneComposer,
                ...envPatch.sceneComposer,
                lights: {
                  ...prev.sceneComposer.lights,
                  ...(envPatch.sceneComposer.lights ?? {}),
                },
              }
            : {
                ...prev.sceneComposer,
                presetPreviewSource: 'model',
                bgMode: 'scene',
              },
        };
      });
      setActiveDemoId(null);
    },
    []
  );

  const handleAttachVmd = useCallback((modelId: string, vmd: ProcessedVmdFiles) => {
    if (!vmd.vmdBlobUrls.length) {
      product.showToast('No .vmd motion found in the import', 3000);
      return;
    }

    const targetModel = appStateRef.current.models.find((m) => m.id === modelId);
    if (!targetModel) {
      product.showToast('Load a character first, then import the motion', 3500);
      return;
    }
    if ((targetModel.assetKind ?? 'character') !== 'character') {
      product.showToast(
        `"${targetModel.name}" is a ${targetModel.assetKind} — select a character before importing motion`,
        4000
      );
      return;
    }
    product.showToast(`Motion attached to ${targetModel.name} — press Play`, 3000);

    setPlayheadFrame(0);
    setAppState((prev) => {
      const target = prev.models.find((m) => m.id === modelId);
      if (!target) return prev;

      const merged = mergeVmdIntoModel(target, vmd);
      const lastFrameHint = Math.max(prev.maxFrames, 30);
      // Camera VMD only when user opted in via Import Dialog (importCameras).
      const allowCameraVmd =
        Boolean(vmd.hasCameraVmd) &&
        Boolean(prev.modelImportSettings?.importCameras);

      return {
        ...prev,
        models: prev.models.map((m) => (m.id === modelId ? merged : m)),
        selectedObjectId: modelId,
        // Don't play during VMD hot-swap — physics settles first (avoids "mush").
        isPlaying: false,
        currentFrame: 0,
        maxFrames: lastFrameHint,
        cameraVmdBlobUrl: allowCameraVmd
          ? (vmd.cameraVmdBlobUrl ?? prev.cameraVmdBlobUrl)
          : prev.cameraVmdBlobUrl,
        cameraVmdFileName: allowCameraVmd
          ? (vmd.cameraVmdFileName ?? prev.cameraVmdFileName)
          : prev.cameraVmdFileName,
        hasCameraVmd: allowCameraVmd ? true : prev.hasCameraVmd,
      };
    });

    window.setTimeout(() => {
      try {
        modelApiRef.current?.restartPhysics();
      } catch {
        /* ignore */
      }
      // Stay paused at frame 0 (T-pose until Play) — do not auto-start VMD.
      setPlayheadFrame(0);
      setAppState((prev) => ({ ...prev, isPlaying: false, currentFrame: 0 }));
    }, 450);
  }, [setAppState, product.showToast]);

  const handlePatchAnimationLibrary = useCallback((next: AnimationLibraryState) => {
    setAppState((prev) => ({
      ...prev,
      animationLibrary: next,
    }));
  }, []);

  const handleApplyAshfallResult = useCallback((result: AshfallApplyResult) => {
    setAppState((prev) => ({ ...prev, ...result.patch }));
    if (result.cameraSnapshot) {
      flyToCameraRef.current?.(result.cameraSnapshot);
    }
    if (result.message) {
      try {
        window.dispatchEvent(
          new CustomEvent('animastage:toast', {
            detail: { message: result.message, durationMs: 3200 },
          })
        );
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handlePatchAshfallCity = useCallback((patch: Partial<AshfallCityState>) => {
    setAppState((prev) => ({
      ...prev,
      ashfallCity: {
        ...(prev.ashfallCity ?? DEFAULT_ASHFALL_CITY),
        ...patch,
      },
    }));
  }, []);

  const handleAssignLibraryVmd = useCallback(
    (
      modelId: string,
      vmd: ProcessedVmdFiles,
      assetId: string,
      override?: {
        speed?: number;
        loop?: boolean;
        playbackOffset?: number;
        boneRemap?: Record<string, string>;
      }
    ) => {
      if (!vmd.vmdBlobUrls.length) return;

      setPlayheadFrame(0);
      setAppState((prev) => {
        const target = prev.models.find((m) => m.id === modelId);
        if (!target) return prev;

        const merged: MMDModel = mergeVmdIntoModel(target, vmd);
        const lastFrameHint = Math.max(prev.maxFrames, 30);
        const allowCameraVmd =
          Boolean(vmd.hasCameraVmd) &&
          Boolean(prev.modelImportSettings?.importCameras);

        return {
          ...prev,
          models: prev.models.map((m) =>
            m.id === modelId
              ? {
                  ...merged,
                  libraryAssetId: assetId,
                  motionSpeed: override?.speed ?? 1,
                  motionLoop: override?.loop ?? true,
                  motionOffsetFrames: override?.playbackOffset ?? 0,
                  ...(override?.boneRemap
                    ? { vmdBoneRemap: override.boneRemap }
                    : {}),
                }
              : m
          ),
          selectedObjectId: modelId,
          isPlaying: false,
          currentFrame: 0,
          maxFrames: lastFrameHint,
          cameraVmdBlobUrl: allowCameraVmd
            ? (vmd.cameraVmdBlobUrl ?? prev.cameraVmdBlobUrl)
            : prev.cameraVmdBlobUrl,
          cameraVmdFileName: allowCameraVmd
            ? (vmd.cameraVmdFileName ?? prev.cameraVmdFileName)
            : prev.cameraVmdFileName,
          hasCameraVmd: allowCameraVmd ? true : prev.hasCameraVmd,
        };
      });

      window.setTimeout(() => {
        try {
          modelApiRef.current?.restartPhysics();
        } catch {
          /* ignore */
        }
        setPlayheadFrame(0);
        setAppState((prev) => ({ ...prev, isPlaying: false, currentFrame: 0 }));
      }, 450);
    },
    []
  );

  const handleAssignLibraryTemplate = useCallback(
    (modelId: string, templateId: string) => {
      setAppState((prev) => ({ ...prev, selectedObjectId: modelId }));
      queueMicrotask(() => {
        handleApplyTemplate(templateId, 'replace');
        setAppState((prev) => ({ ...prev, isPlaying: true }));
      });
    },
    [handleApplyTemplate]
  );

  const handleAssignLibraryKeyframes = useCallback(
    (modelId: string, keyframes: TimelineKeyframe[]) => {
      const lastFrame = keyframes.reduce((max, k) => Math.max(max, k.frame), 0);
      setAppState((prev) => {
        const assetId =
          prev.animationLibrary?.assignments.find((a) => a.modelId === modelId)?.assetId ??
          prev.animationLibrary?.selectedAssetId ??
          null;
        const assignment = prev.animationLibrary?.assignments.find(
          (a) => a.modelId === modelId && a.assetId === assetId
        );
        return {
          ...prev,
          selectedObjectId: modelId,
          maxFrames: Math.max(prev.maxFrames, lastFrame + 1, 30),
          isPlaying: false,
          currentFrame: 0,
          models: prev.models.map((m) =>
            m.id === modelId
              ? {
                  ...m,
                  keyframes,
                  clipDirty: true,
                  vmdPlaybackEnabled: false,
                  activeTemplateId: null,
                  libraryAssetId: assetId,
                  motionSpeed: assignment?.speed ?? m.motionSpeed ?? 1,
                  motionLoop: assignment?.loop ?? m.motionLoop ?? true,
                  motionOffsetFrames: assignment?.playbackOffset ?? 0,
                }
              : m
          ),
        };
      });
      setPlayheadFrame(0);
      window.setTimeout(() => {
        try {
          modelApiRef.current?.restartPhysics();
        } catch {
          /* ignore */
        }
        setAppState((prev) => ({ ...prev, isPlaying: false, currentFrame: 0 }));
      }, 350);
    },
    []
  );

  const handleSetModelBoneRemap = useCallback(
    (modelId: string, remap: Record<string, string>) => {
      setAppState((prev) => ({
        ...prev,
        models: prev.models.map((m) =>
          m.id === modelId ? { ...m, vmdBoneRemap: remap } : m
        ),
      }));
    },
    []
  );

  const handleSetModelMotionSpeed = useCallback((modelId: string, speed: number) => {
    const clamped = Math.max(0.05, Math.min(4, speed));
    setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) =>
        m.id === modelId ? { ...m, motionSpeed: clamped } : m
      ),
    }));
  }, []);

  const handleSaveMocapToLibrary = useCallback(
    (payload: {
      name: string;
      keyframes: TimelineKeyframe[];
      durationSec: number;
      fps: number;
      tags: string[];
      author: string;
    }) => {
      setAppState((prev) => {
        const lib = prev.animationLibrary;
        if (!lib) return prev;
        const id = `mocap_${Date.now().toString(36)}`;
        const asset = {
          id,
          name: payload.name,
          format: 'asmotion' as const,
          durationSec: payload.durationSec,
          fps: payload.fps,
          skeletonType: 'humanoid' as const,
          loop: false,
          tags: payload.tags,
          author: payload.author,
          compatibility: 'compatible' as const,
          thumbnail: '🎬',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          keyframes: payload.keyframes,
          sourceFileNames: [`${payload.name}.asmd.json`],
        };
        return {
          ...prev,
          animationLibrary: {
            ...lib,
            assets: [asset, ...lib.assets],
            selectedAssetId: id,
          },
        };
      });
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
          handleLoadCustomModel(
            result,
            settingsForSilentImport(appStateRef.current.modelImportSettings)
          );
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
      if (!model) return prev;

      const vmdMotion =
        model.hasVmdAnimation &&
        model.vmdPlaybackEnabled !== false &&
        (model.vmdBlobUrls?.length ?? 0) > 0;
      const embeddedMotion =
        model.modelFormat && model.modelFormat !== 'mmd';

      if (!vmdMotion && !embeddedMotion) return prev;

      const maxFrames = Math.max(10, frameCount);

      return {
        ...prev,
        models: prev.models.map((m) =>
          m.id === modelId
            ? { ...m, hasEmbeddedAnimation: embeddedMotion ? true : m.hasEmbeddedAnimation }
            : m
        ),
        maxFrames: Math.max(prev.maxFrames, maxFrames),
        currentFrame: 0,
        // Never auto-play on load / remount — user presses Play.
        isPlaying: false,
      };
    });
  };

  const handleSetVmdPlaybackEnabled = (modelId: string, enabled: boolean) => {
    setPlayheadFrame(0);
    setAppState((prev) => {
      const model = prev.models.find((m) => m.id === modelId);
      if (!model?.hasVmdAnimation) return prev;

      const models = prev.models.map((m) =>
        m.id === modelId
          ? { ...m, vmdPlaybackEnabled: enabled, ...(enabled ? { activeTemplateId: null } : {}) }
          : m
      );

      if (prev.selectedObjectId !== modelId) {
        return { ...prev, models };
      }

      return {
        ...prev,
        models,
        currentFrame: 0,
        // Enabling VMD must not auto-start playback.
        isPlaying: enabled ? false : prev.isPlaying,
      };
    });
  };

  // Clear scene back to empty voids
  const handleClearScene = () => {
    setAppState(prev => {
      prev.models.forEach((m) => {
        revokeBlobUrl(m.blobUrl);
        for (const url of m.vmdBlobUrls ?? []) revokeBlobUrl(url);
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
      const remainingModels = prev.models.filter(m => m.id !== id);
      if (modelToRemove) {
        releaseModelBlobAssets(modelToRemove, remainingModels);
      }
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

  const handleModelRotate = (modelId: string, x: number, y: number, z: number) => {
    setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) =>
        m.id === modelId ? { ...m, rotationX: x, rotationY: y, rotationZ: z } : m
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

  const handleSetModelWorldScale = useCallback((modelId: string, scale: number) => {
    setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) =>
        m.id === modelId ? { ...m, worldScale: scale } : m
      ),
    }));
  }, []);

  const handlePatchStyleGallery = useCallback(
    (patch: Partial<import('./types').StyleGalleryRuntimeState>) => {
      setAppState((prev) => ({
        ...prev,
        styleGallery: { ...prev.styleGallery, ...patch },
      }));
    },
    [],
  );

  const handlePatchSceneComposer = useCallback((patch: Partial<SceneComposerState>) => {
    setAppState((prev) => ({
      ...prev,
      sceneComposer: {
        ...prev.sceneComposer,
        ...patch,
        lights: normalizeSceneComposerLights({
          ...prev.sceneComposer.lights,
          ...(patch.lights ?? {}),
        }),
        effectLevels: patch.effectLevels
          ? { ...prev.sceneComposer.effectLevels, ...patch.effectLevels }
          : prev.sceneComposer.effectLevels,
      },
    }));
  }, []);

  const handleReplaceSceneComposer = useCallback((next: SceneComposerState) => {
    setAppState((prev) => ({
      ...prev,
      sceneComposer: {
        ...next,
        lights: normalizeSceneComposerLights(next.lights),
        effectLevels: {
          ...DEFAULT_SCENE_COMPOSER.effectLevels,
          ...next.effectLevels,
        },
      },
    }));
  }, []);

  const handlePatchDynamicSky = useCallback((patch: Partial<DynamicSkyState>) => {
    setAppState((prev) => ({
      ...prev,
      dynamicSky: { ...(prev.dynamicSky ?? DEFAULT_DYNAMIC_SKY), ...patch },
    }));
  }, []);

  const handleApplyEnvironment = useCallback(
    (args: {
      dynamicSky: DynamicSkyState;
      sceneComposer: Partial<SceneComposerState> & {
        lights?: Partial<SceneComposerState['lights']>;
      };
      visualFx: Partial<import('./types').VisualFxSettings>;
    }) => {
      setAppState((prev) => ({
        ...prev,
        dynamicSky: args.dynamicSky,
        sceneComposer: {
          ...prev.sceneComposer,
          ...args.sceneComposer,
          lights: normalizeSceneComposerLights({
            ...prev.sceneComposer.lights,
            ...(args.sceneComposer.lights ?? {}),
          }),
        },
        visualFx: { ...prev.visualFx, ...args.visualFx },
      }));
    },
    []
  );

  const handlePatchSceneStudio = useCallback(
    (patch: Partial<NonNullable<AppState['sceneStudio']>>) => {
      globalUndo.record(appStateRef.current);
      setAppState((prev) => ({
        ...prev,
        sceneStudio: {
          ...DEFAULT_SCENE_STUDIO,
          ...(prev.sceneStudio ?? {}),
          ...patch,
        },
      }));
    },
    [globalUndo]
  );

  const handlePatchSceneDirector = useCallback((patch: Partial<SceneDirectorState>) => {
    globalUndo.record(appStateRef.current);
    setAppState((prev) => ({
      ...prev,
      sceneDirector: {
        ...DEFAULT_SCENE_DIRECTOR,
        ...(prev.sceneDirector ?? {}),
        ...patch,
        music: patch.music
          ? { ...DEFAULT_SCENE_DIRECTOR.music, ...(prev.sceneDirector?.music ?? {}), ...patch.music }
          : (prev.sceneDirector?.music ?? DEFAULT_SCENE_DIRECTOR.music),
      },
    }));
  }, [globalUndo]);

  const handleRenameModel = useCallback((id: string, name: string) => {
    setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) => (m.id === id ? { ...m, name } : m)),
    }));
  }, []);

  const handleDuplicateModel = useCallback((id: string) => {
    setAppState((prev) => {
      const source = prev.models.find((m) => m.id === id);
      if (!source) return prev;
      const newId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `model_${Date.now()}`;
      const copy: typeof source = {
        ...source,
        id: newId,
        name: `${source.name} Copy`,
        positionX: source.positionX + 1.5,
        keyframes: JSON.parse(JSON.stringify(source.keyframes)) as typeof source.keyframes,
        bones: JSON.parse(JSON.stringify(source.bones)) as typeof source.bones,
        morphs: { ...source.morphs },
      };
      return {
        ...prev,
        models: [...prev.models, copy],
        selectedObjectId: newId,
      };
    });
  }, []);

  const handleSceneFxRuntimeError = useCallback((instanceId: string, message: string) => {
    setAppState((prev) => {
      if (!prev.sceneStudio) return prev;
      return {
        ...prev,
        sceneStudio: {
          ...prev.sceneStudio,
          fxStack: prev.sceneStudio.fxStack.map((fx) =>
            fx.id === instanceId
              ? {
                  ...fx,
                  enabled: false,
                  runtimeError: {
                    message,
                    at: Date.now(),
                    atFrame: prev.currentFrame,
                  },
                }
              : fx
          ),
        },
      };
    });
  }, []);

  const handleApplySceneMood = useCallback((id: SceneMoodPresetId) => {
    setAppState((prev) => {
      const patch = buildSceneMoodPatch(id, {
        sceneStudio: prev.sceneStudio,
        dynamicSky: prev.dynamicSky,
        sceneComposer: prev.sceneComposer,
        visualFx: prev.visualFx,
      });
      return {
        ...prev,
        sceneStudio: patch.sceneStudio,
        dynamicSky: patch.dynamicSky,
        sceneComposer: patch.sceneComposer,
        visualFx: patch.visualFx,
      };
    });
  }, []);

  const handleSmartScene = useCallback(
    (options: SmartSceneOptions) => {
      const current = appStateRef.current;
      const plan = buildSmartScenePlan(
        options,
        {
          sceneStudio: current.sceneStudio,
          dynamicSky: current.dynamicSky,
          sceneComposer: current.sceneComposer,
          visualFx: current.visualFx,
        },
        {
          hasCharacter: current.models.some(
            (m) => m.visible && (m.assetKind ?? 'character') === 'character'
          ),
          hasStage: sceneHasStage(current.models),
        }
      );

      setAppState((prev) => ({
        ...prev,
        sceneStudio: plan.patch.sceneStudio,
        dynamicSky: plan.patch.dynamicSky,
        sceneComposer: plan.patch.sceneComposer,
        visualFx: plan.patch.visualFx,
      }));

      if (plan.patch.viewportFormat) {
        handleViewportFormatChange(plan.patch.viewportFormat);
      }
      if (plan.shot) {
        shotComposerApi.patchShotComposer({
          shotPreset: plan.shot.shotPreset,
          aspect: plan.shot.aspect,
        });
        shotComposerApi.onAutoFrame();
      }
      product.showToast(`Smart Scene: ${plan.notes.join(' · ')}`, 3200);
    },
    [
      handleViewportFormatChange,
      product.showToast,
      shotComposerApi.patchShotComposer,
      shotComposerApi.onAutoFrame,
    ]
  );

  const handleApplyAiSceneDirector = useCallback(
    (result: {
      appState: AppState;
      shot: {
        shotPreset: string;
        aspect: ViewportFormat;
        autoFrame: boolean;
        placeMode: boolean;
        placement: string;
      } | null;
      animationAssetId: string | null;
      characterId: string | null;
      messages: string[];
    }) => {
      setAppState(result.appState);

      if (result.shot?.aspect) {
        handleViewportFormatChange(result.shot.aspect);
      }
      if (result.shot) {
        shotComposerApi.patchShotComposer({
          shotPreset: result.shot.shotPreset as import('./shotComposer/types').ShotPresetId,
          aspect: result.shot.aspect,
        });
        if (result.shot.autoFrame) {
          shotComposerApi.onAutoFrame();
        } else if (result.shot.placeMode) {
          shotComposerApi.onPlaceCharacterMode();
        }
      }

      if (result.animationAssetId && result.characterId) {
        const model = result.appState.models.find((m) => m.id === result.characterId);
        const asset = result.appState.animationLibrary?.assets.find(
          (a) => a.id === result.animationAssetId
        );
        if (model && asset) {
          const plan = planAssignAnimation(asset, model);
          if (plan.mode === 'vmd' && plan.vmd) {
            handleAssignLibraryVmd(plan.modelId, plan.vmd, asset.id, {
              speed: plan.override.speed,
              loop: plan.override.loop,
              playbackOffset: plan.override.playbackOffset,
              boneRemap: plan.override.boneRemap,
            });
          } else if (plan.mode === 'template' && plan.templateId) {
            handleAssignLibraryTemplate(plan.modelId, plan.templateId);
          } else if (plan.mode === 'keyframes' && plan.keyframes) {
            handleAssignLibraryKeyframes(plan.modelId, plan.keyframes);
          }
        }
      }
    },
    [
      handleAssignLibraryKeyframes,
      handleAssignLibraryTemplate,
      handleAssignLibraryVmd,
      handleViewportFormatChange,
      shotComposerApi.onAutoFrame,
      shotComposerApi.onPlaceCharacterMode,
      shotComposerApi.patchShotComposer,
    ]
  );

  const handleDynamicSkyTick = useCallback((nextHours: number) => {
    setAppState((prev) => {
      const ds = { ...(prev.dynamicSky ?? DEFAULT_DYNAMIC_SKY), timeHours: nextHours, presetId: null };
      if (!ds.enabled) return { ...prev, dynamicSky: ds };
      const look = resolveDynamicSkyLook(ds);
      const patches = buildDynamicSkyPatches(look);
      return {
        ...prev,
        dynamicSky: ds,
        sceneComposer: {
          ...prev.sceneComposer,
          ...patches.sceneComposer,
          lights: { ...prev.sceneComposer.lights, ...patches.sceneComposer.lights },
        },
        visualFx: { ...prev.visualFx, ...patches.visualFx },
      };
    });
  }, []);

  // Apply default Time-of-Day look once so Environment Studio matches the viewport.
  useEffect(() => {
    const ds = appState.dynamicSky ?? DEFAULT_DYNAMIC_SKY;
    if (!ds.enabled) return;
    const look = resolveDynamicSkyLook(ds);
    const patches = buildDynamicSkyPatches(look);
    setAppState((prev) => ({
      ...prev,
      sceneComposer: {
        ...prev.sceneComposer,
        ...patches.sceneComposer,
        lights: { ...prev.sceneComposer.lights, ...patches.sceneComposer.lights },
      },
      visualFx: { ...prev.visualFx, ...patches.visualFx },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot only
  }, []);

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
      onEnterDirectCameraMode={handleEnterDirectCameraMode}
      onOpenCineStudio={() => setCineStudioOpen(true)}
      onOpenReferenceCameraStudio={() => {
        setRefCamStudioOpen(true);
        setAppState((prev) => ({
          ...prev,
          referenceCamera: {
            ...(prev.referenceCamera ?? DEFAULT_REFERENCE_CAMERA),
            studioOpen: true,
          },
        }));
      }}
      appState={appState}
      sceneGraph={product.sceneGraph}
      lockedObjectIds={product.lockedObjectIds}
      onSceneGraphToggleVisibility={product.handleSceneGraphToggleVisibility}
      onSceneGraphToggleLock={product.handleSceneGraphToggleLock}
      onSceneGraphCreateGroup={product.handleSceneGraphCreateGroup}
      onSelectModel={(id) => {
        if (!id || product.lockedObjectIds.has(id)) return;
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
      onLoadCustomModel={requestLoadCustomModel}
      attachVmdTargetModelId={vmdAttachTargetModelId}
      onAttachVmd={handleAttachVmd}
      onInstallStylePack={visualStyles.installImport}
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
      onSetVisualFx={setVisualFx}
      onPatchSceneComposer={handlePatchSceneComposer}
      onReplaceSceneComposer={handleReplaceSceneComposer}
      onPatchSceneBackground={handlePatchSceneBackground}
      onImportBackgroundModel={handleImportBackgroundModel}
      getViewportCanvas={() => glCanvasRef.current}
      captureViewportFrame={() => captureFrameRef.current?.() ?? null}
      invalidateViewport={() => invalidateSceneRef.current?.()}
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
      onCinemaRender={handleCinemaRender}
      onLiveRecord={handleLiveRecord}
      videoMetadata={smartVideoMetadata.metadata}
      showVideoInformation={smartVideoMetadata.visible}
      onRegenerateMetadata={smartVideoMetadata.regenerate}
      onMetadataLocaleChange={smartVideoMetadata.setLocale}
      onMetadataPlatformChange={smartVideoMetadata.setPlatform}
      onMetadataTitleSelect={smartVideoMetadata.selectTitle}
      onMetadataCopyFeedback={(msg) => product.showToast(msg, 2000)}
      onOpenSmartStudio={() => setSmartStudioPickerOpen(true)}
      onEnterSmartStudioMode={(mode) => {
        void smartStudio.enter(mode);
      }}
      onOpenCineStudio={() => setCineStudioOpen(true)}
      onOpenReferenceCameraStudio={() => {
        setRefCamStudioOpen(true);
        setAppState((prev) => ({
          ...prev,
          referenceCamera: {
            ...(prev.referenceCamera ?? DEFAULT_REFERENCE_CAMERA),
            studioOpen: true,
          },
        }));
      }}
      visualStyles={visualStyles}
      styleGallery={appState.styleGallery}
      onPatchStyleGallery={handlePatchStyleGallery}
      pmxMaterials={
        appState.models.find((m) => m.id === appState.selectedObjectId)?.pmxMaterials ??
        appState.models[0]?.pmxMaterials ??
        []
      }
      highlightMaterial={highlightMaterial}
      onSelectMaterial={setHighlightMaterial}
      cinematicEngine={cinematicEngine}
      vcs={vcs}
      appState={appState}
      onPatchSceneComposer={handlePatchSceneComposer}
      onReplaceSceneComposer={handleReplaceSceneComposer}
      onPatchSceneStudio={handlePatchSceneStudio}
    />
  );

  const proSceneTitle =
    appState.models.find((m) => m.id === appState.selectedObjectId)?.name ??
    appState.models[0]?.name ??
    (activeDemoId ? 'Demo scene' : 'AnimaStage Lite');

  const studio3Panels = useMemo(
    () =>
      createStudio3Panels({
        appState,
        sceneGraph: product.sceneGraph,
        lockedObjectIds: product.lockedObjectIds,
        highlightMaterial,
        analyzingModel,
        beginnerMode: isBeginnerMode(product.uiMode),
        qualityMode: product.qualityMode,
        onQualityModeChange: product.handleQualityModeChange,
        showGrid,
        setShowGrid,
        showBones,
        setShowBones,
        showPhysicsBodies,
        setShowPhysicsBodies,
        demoLoadingId,
        activeDemoId,
        attachVmdTargetModelId: vmdAttachTargetModelId,
        collabConnected: collab.connected,
        collabRoom: collab.roomId,
        collabPeers: collab.peers,
        collabStatus: collab.status,
        fxPanel: proFxPanel,
        pmxMaterials:
          appState.models.find((m) => m.id === appState.selectedObjectId)?.pmxMaterials ??
          appState.models[0]?.pmxMaterials ??
          [],
        styleGallery: appState.styleGallery,
        onSelectModel: (id) => {
          if (id && product.lockedObjectIds.has(id)) return;
          setAppState((prev) => ({ ...prev, selectedObjectId: id }));
        },
        onSelectBone: (id) => setAppState((prev) => ({ ...prev, selectedBoneId: id })),
        onToggleVisibility: handleToggleVisibility,
        onDeleteModel: handleDeleteModel,
        onSceneGraphToggleVisibility: product.handleSceneGraphToggleVisibility,
        onSceneGraphToggleLock: product.handleSceneGraphToggleLock,
        onSceneGraphCreateGroup: product.handleSceneGraphCreateGroup,
        onLoadModel: handleLoadModel,
        onLoadCustomModel: requestLoadCustomModel,
        onAttachVmd: handleAttachVmd,
        onInstallStylePack: visualStyles.installImport,
        onLoadDemo: (id) => void handleLoadDemoScene(id),
        onOpenDemoGallery: () => setShowDemoGallery(true),
        onModifyMorphs: handleModifyMorphs,
        onModifyBone: handleModifyBone,
        onModifyModelPosition: handleModifyModelPosition,
        onRegisterKeyframe: handleRegisterKeyframe,
        onSetVmdPlaybackEnabled: handleSetVmdPlaybackEnabled,
        onApplyPose: handleApplyPose,
        onCapturePose: handleCapturePose,
        onClearPoseHold: handleClearPoseHold,
        onSetVisualFx: setVisualFx,
        onPatchSceneComposer: handlePatchSceneComposer,
        onReplaceSceneComposer: handleReplaceSceneComposer,
        onPatchDynamicSky: handlePatchDynamicSky,
        onApplyEnvironment: handleApplyEnvironment,
        onPatchSceneStudio: handlePatchSceneStudio,
        onPatchSceneDirector: handlePatchSceneDirector,
        onRenameModel: handleRenameModel,
        onDuplicateModel: handleDuplicateModel,
        onApplySceneMood: handleApplySceneMood,
        onSmartScene: handleSmartScene,
        onApplyAiSceneDirector: handleApplyAiSceneDirector,
        onToast: (msg, ms) => product.showToast(msg, ms ?? 2500),
        onPatchSceneBackground: handlePatchSceneBackground,
        onImportBackgroundModel: handleImportBackgroundModel,
        onSetModelWorldScale: handleSetModelWorldScale,
        onModelRotate: handleModelRotate,
        onApplyRenderPipeline2: handleApplyRenderPipeline2,
        onPatchRenderPipeline2: handlePatchRenderPipeline2,
        onApplyRenderPipeline3: handleApplyRenderPipeline3,
        onPatchRenderPipeline3: handlePatchRenderPipeline3,
        exportDurationSec,
        maxExportDurationSec: maxExportDurationSec,
        onExportDurationSecChange: setExportDurationSec,
        videoExportBusy: videoRecorder.busy,
        viewportFormat,
        onPatchRenderPipeline4: handlePatchRenderPipeline4,
        onStartRp4Export: handleRp4ProfessionalExport,
        onPatchAnimationLibrary: handlePatchAnimationLibrary,
        onAssignLibraryVmd: handleAssignLibraryVmd,
        onAssignLibraryTemplate: handleAssignLibraryTemplate,
        onAssignLibraryKeyframes: handleAssignLibraryKeyframes,
        onSetModelBoneRemap: handleSetModelBoneRemap,
        onSetModelMotionSpeed: handleSetModelMotionSpeed,
        onSaveMocapToLibrary: handleSaveMocapToLibrary,
        onApplyAshfallResult: handleApplyAshfallResult,
        onPatchAshfallCity: handlePatchAshfallCity,
        onFlyToCamera: (snapshot) => flyToCameraRef.current?.(snapshot),
        onImportHdr: (file: File) => {
          const url = URL.createObjectURL(file);
          handleHdrFileDrop(url, file.name);
        },
        getViewportCanvas: () => glCanvasRef.current,
        captureViewportFrame: () => captureFrameRef.current?.() ?? null,
        invalidateViewport: () => invalidateSceneRef.current?.(),
        onPatchCameraStudio: (patch) =>
          setAppState((prev) => ({
            ...prev,
            cameraStudio: { ...prev.cameraStudio, ...patch },
          })),
        onApplyCameraPreset: (presetId) => {
          const def = getCameraStudioPreset(presetId);
          setAppState((prev) => ({
            ...prev,
            cameraStudio: {
              ...prev.cameraStudio,
              orbitPreset: presetId,
              ...(def?.focusTarget ? { focusTarget: def.focusTarget } : {}),
            },
          }));
          if (def?.bloom) setVisualFx(def.bloom);
        },
        onSetCameraMode: setCameraMode,
        onOpenCineStudio: () => setCineStudioOpen(true),
        onOpenReferenceCameraStudio: () => {
          setRefCamStudioOpen(true);
          setAppState((prev) => ({
            ...prev,
            referenceCamera: {
              ...(prev.referenceCamera ?? DEFAULT_REFERENCE_CAMERA),
              studioOpen: true,
            },
          }));
        },
        shotComposer: shotComposerApi.shotComposer,
        onPatchShotComposer: shotComposerApi.patchShotComposer,
        onShotPlaceCharacter: shotComposerApi.onPlaceCharacterMode,
        onShotPlaceCamera: shotComposerApi.onPlaceCameraMode,
        onShotCreate: shotComposerApi.onCreateShot,
        onShotAutoFrame: shotComposerApi.onAutoFrame,
        onShotSave: shotComposerApi.onSaveShot,
        onShotApply: shotComposerApi.onApplyShot,
        onShotDelete: shotComposerApi.onDeleteShot,
        onShotSetAspect: shotComposerApi.onSetAspect,
        onShotOrient: shotComposerApi.onOrient,
        onSetPhysicsMode: (mode) => setAppState((prev) => ({ ...prev, physicsMode: mode })),
        onPatchMmdLite: handlePatchMmdLite,
        onRestartPhysics: () => modelApiRef.current?.restartPhysics(),
        onFixPhysics: handleFixPhysics,
        onSelectMaterial: setHighlightMaterial,
        onPatchStyleGallery: handlePatchStyleGallery,
        onApplyKeyframes: handleApplyKeyframes,
        onUpdateAnimLayers: handleUpdateAnimLayers,
        onToggleGroupSolo: handleToggleGroupSolo,
        onToggleGroupMute: handleToggleGroupMute,
        onCollabJoin: collab.join,
        onCollabLeave: collab.leave,
        onOpenSmartPicker: () => setSmartStudioPickerOpen(true),
        onEnterSmartMode: (mode) => void smartStudio.enter(mode),
        onOpenOneClick: () => {
          product.dismissOnboarding();
          oneClickCreator.enter();
        },
        onCharacterQualityChange: (characterQuality) =>
          setAppState((s) => ({ ...s, characterQuality })),
        onSetRtxModeEnabled: (enabled) =>
          setAppState((s) => ({ ...s, rtxModeEnabled: enabled })),
        onApplyCinematicQuality: handleApplyCinematicQuality,
        onApplyCinematicSun: handleApplyCinematicSun,
        onApplyCinematicWeather: handleApplyCinematicWeather,
        onApplyCinematicStyle: handleApplyCinematicStyle,
        onPatchCinematicRender: handlePatchCinematicRender,
        onReapplyCinematicRender: handleReapplyCinematicRender,
        onPatchReflectionSystem: handlePatchReflectionSystem,
        onPatchAsrp: handlePatchAsrp,
        onCinemaRender: handleCinemaRender,
        onPatchCinemaRender: handlePatchCinemaRender,
        onApplyAsrpVisualStyle: handleApplyAsrpVisualStyle,
        onAutoCinematicDirector: handleAutoCinematicDirector,
      } satisfies Studio3PanelSources),
    [
      appState,
      product.sceneGraph,
      product.lockedObjectIds,
      product.uiMode,
      product.qualityMode,
      product.handleQualityModeChange,
      product.handleSceneGraphToggleVisibility,
      product.handleSceneGraphToggleLock,
      product.handleSceneGraphCreateGroup,
      product.dismissOnboarding,
      highlightMaterial,
      analyzingModel,
      showGrid,
      showBones,
      showPhysicsBodies,
      demoLoadingId,
      activeDemoId,
      vmdAttachTargetModelId,
      collab.connected,
      collab.roomId,
      collab.peers,
      collab.status,
      collab.join,
      collab.leave,
      proFxPanel,
      visualStyles.installImport,
      smartStudio.enter,
      oneClickCreator.enter,
      handleApplyCinematicQuality,
      handleApplyCinematicSun,
      handleApplyCinematicWeather,
      handleApplyCinematicStyle,
      handlePatchCinematicRender,
      handleReapplyCinematicRender,
      handlePatchReflectionSystem,
      handlePatchAsrp,
      handleCinemaRender,
      handlePatchCinemaRender,
      handlePatchRenderPipeline4,
      handleRp4ProfessionalExport,
      exportDurationSec,
      videoRecorder.busy,
      viewportFormat,
      handleApplyAsrpVisualStyle,
      handleAutoCinematicDirector,
      handlePatchDynamicSky,
      handleApplyEnvironment,
      handlePatchSceneStudio,
      handlePatchSceneDirector,
      handleRenameModel,
      handleDuplicateModel,
      handleApplySceneMood,
      handleSmartScene,
      handleApplyAiSceneDirector,
      shotComposerApi.shotComposer,
      shotComposerApi.patchShotComposer,
      shotComposerApi.onPlaceCharacterMode,
      shotComposerApi.onPlaceCameraMode,
      shotComposerApi.onCreateShot,
      shotComposerApi.onAutoFrame,
      shotComposerApi.onSaveShot,
      shotComposerApi.onApplyShot,
      shotComposerApi.onDeleteShot,
      shotComposerApi.onSetAspect,
      shotComposerApi.onOrient,
    ]
  );

  const editorTimelineShell = (
    <EditorTimelineShell
      embeddedInSheet={layout.isMobileLayout}
      fillHost={product.editorInterface === 'ui3'}
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
      onSetVmdPlaybackEnabled={handleSetVmdPlaybackEnabled}
      onPatchSceneStudio={handlePatchSceneStudio}
      onPatchSceneDirector={handlePatchSceneDirector}
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
        transformMode={transformMode}
        onTransformModeChange={setTransformMode}
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
        onModelRotate={handleModelRotate}
        onLoadCustomModel={isViewer ? undefined : requestLoadCustomModel}
        onAttachVmd={isViewer ? undefined : handleAttachVmd}
        attachVmdTargetModelId={vmdAttachTargetModelId}
        onModelAnimationLoaded={handleModelAnimationLoaded}
        onSceneFxRuntimeError={handleSceneFxRuntimeError}
        captureCameraRef={captureCameraRef}
        flyToCameraRef={flyToCameraRef}
        modelApiRef={modelApiRef}
        sceneHdr={appState.sceneHdr}
        onHdrFileDrop={handleHdrFileDrop}
        onLutFileDrop={handleLutFileDrop}
        onSetCameraMode={setCameraMode}
        onEnterDirectCameraMode={handleEnterDirectCameraMode}
        onDynamicSkyTick={handleDynamicSkyTick}
        onSmartViewportPatch={(patch) => setAppState((prev) => ({ ...prev, ...patch }))}
        shotComposer={{
          mode: shotComposerApi.shotComposer.mode,
          floorYOverride: shotComposerApi.shotComposer.floorYOverride,
          characterHeight: shotComposerApi.characterHeight,
          ghostHit: shotComposerApi.shotComposer.ghostHit,
          stageModel:
            [...appState.models].reverse().find((m) => m.assetKind === 'stage') ?? null,
          onGhostHit: shotComposerApi.onGhostHit,
          onConfirmPlace: shotComposerApi.onConfirmPlace,
          onCancel: shotComposerApi.onCancelPlace,
          onEnvAnalyzed: shotComposerApi.onEnvAnalyzed,
        }}
        shotGuides={shotComposerApi.shotComposer.guides}
        cineStudioPanel={
          <CinematographyStudioOverlay
            open={cineStudioOpen}
            onClose={() => setCineStudioOpen(false)}
            appState={appState}
            vcs={vcs}
            cinematicEngine={cinematicEngine}
            onSetVisualFx={setVisualFx}
            onPatchSceneComposer={handlePatchSceneComposer}
            onReplaceSceneComposer={handleReplaceSceneComposer}
            onPatchSceneStudio={handlePatchSceneStudio}
            onEnterDirectCameraMode={handleEnterDirectCameraMode}
            onRegisterCameraKeyframe={handleRegisterCameraKeyframe}
            onPatchCameraStudio={(patch) =>
              setAppState((prev) => ({
                ...prev,
                cameraStudio: { ...prev.cameraStudio, ...patch },
              }))
            }
            onSetRtxModeEnabled={(enabled) =>
              setAppState((s) => ({ ...s, rtxModeEnabled: enabled }))
            }
            onOpenReferenceCameraStudio={() => {
              setCineStudioOpen(false);
              setRefCamStudioOpen(true);
              setAppState((prev) => ({
                ...prev,
                referenceCamera: {
                  ...(prev.referenceCamera ?? DEFAULT_REFERENCE_CAMERA),
                  studioOpen: true,
                },
              }));
            }}
          />
        }
        referenceCameraStudioPanel={
          refCamStudioOpen ? (
            <div className="absolute top-0 right-0 bottom-0 z-40 w-[min(360px,100%)] shadow-2xl pointer-events-auto">
              <ReferenceCameraStudioPanel
                appState={appState}
                rcs={appState.referenceCamera ?? DEFAULT_REFERENCE_CAMERA}
                viewportFormat={viewportFormat}
                onPatchRcs={(patch: Partial<ReferenceCameraState>) =>
                  setAppState((prev) => ({
                    ...prev,
                    referenceCamera: {
                      ...(prev.referenceCamera ?? DEFAULT_REFERENCE_CAMERA),
                      ...patch,
                    },
                  }))
                }
                onSetCameraKeyframes={(keyframes) => {
                  globalUndo.record(appStateRef.current);
                  setAppState((prev) => ({
                    ...prev,
                    cameraMode: 'mmd',
                    timelineActiveTrack: 'camera',
                    cameraKeyframes: keyframes,
                  }));
                }}
                onRegisterCameraKeyframe={handleRegisterCameraKeyframe}
                onSetCurrentFrame={handleSetCurrentFrame}
                onSetCameraMode={setCameraMode}
                onViewportFormatChange={handleViewportFormatChange}
                onClose={() => {
                  setRefCamStudioOpen(false);
                  setAppState((prev) => ({
                    ...prev,
                    referenceCamera: {
                      ...(prev.referenceCamera ?? DEFAULT_REFERENCE_CAMERA),
                      studioOpen: false,
                    },
                  }));
                }}
              />
            </div>
          ) : null
        }
        onSelectTimelineTrack={setTimelineActiveTrack}
        onRegisterCameraKeyframe={handleRegisterCameraKeyframe}
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
        onCaptureFrameReady={(capture) => {
          captureFrameRef.current = capture;
        }}
        onInvalidateReady={(fn) => {
          invalidateSceneRef.current = fn;
        }}
        highlightMaterialName={highlightMaterial}
        onPmxMetadataLoaded={editor.handlePmxMetadata}
        onApisReportUpdate={editor.handleApisReportUpdate}
        onTryDemo={
          isViewer
            ? undefined
            : () => {
                product.dismissOnboarding();
                void handleLoadDemoScene(FEATURED_DEMO_ID);
              }
        }
        onCreateFirstVideo={
          isViewer
            ? undefined
            : () => {
                product.dismissOnboarding();
                oneClickCreator.enter();
              }
        }
      />
      {!isViewer && !layout.isMobileLayout && !smartStudio.state.active ? (
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
        <OneClickCreatorWizard
          api={oneClickCreator}
          metadata={smartVideoMetadata.metadata}
          onMetadataRegenerate={smartVideoMetadata.regenerate}
          onMetadataSelectTitle={smartVideoMetadata.selectTitle}
          onMetadataSetPlatform={smartVideoMetadata.setPlatform}
          onMetadataLocaleChange={smartVideoMetadata.setLocale}
          exportProgress={videoRecorder.progress}
          onSaveProject={product.handleSaveProject}
          isPlaying={appState.isPlaying}
          currentFrame={appState.currentFrame}
          maxFrames={appState.maxFrames}
          cameraKeyCount={appState.cameraKeyframes.length}
        />
      )}
      {!isViewer && (
        <SmartStudioDialog
          open={smartStudioPickerOpen && !smartStudio.state.active}
          hasModel={appState.models.length > 0}
          onClose={() => setSmartStudioPickerOpen(false)}
          onSelect={(mode) => {
            setSmartStudioPickerOpen(false);
            void smartStudio.enter(mode);
          }}
        />
      )}
      {!isViewer && smartStudio.state.active ? (
        <SmartStudioOverlay
          api={smartStudio}
          vmdOptions={(
            appState.models.find((m) => m.id === appState.selectedObjectId) ??
            appState.models[0]
          )?.vmdFileNames?.map((label, index) => ({
            modelId:
              (appState.models.find((m) => m.id === appState.selectedObjectId) ??
                appState.models[0])!.id,
            index,
            label: label.replace(/\.vmd$/i, '') || `Motion ${index + 1}`,
          })) ?? []}
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
      <ModelImportDialog
        open={importDialogOpen}
        fileLabel={
          pendingModelImport
            ? (Array.isArray(pendingModelImport)
                ? pendingModelImport[0]?.name
                : pendingModelImport.name) ?? 'model'
            : undefined
        }
        onCancel={() => {
          setImportDialogOpen(false);
          setPendingModelImport(null);
        }}
        onConfirm={(settings: ModelImportSettings) => {
          const payload = pendingModelImport;
          setImportDialogOpen(false);
          setPendingModelImport(null);
          if (payload) handleLoadCustomModel(payload, settings);
        }}
      />
      {!layout.isMobileLayout &&
        !isViewer &&
        !smartStudio.state.active &&
        product.editorInterface !== 'ui3' &&
        shouldShowTimeline(product.uiMode, showTimelinePanel) &&
        editorTimelineShell}
      {!layout.isMobileLayout &&
        !isViewer &&
        !smartStudio.state.active &&
        !oneClickCreator.state.active &&
        product.editorInterface !== 'ui3' && (
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
      className={`app-shell studio-adaptive-root studio-safe-area w-screen font-sans cursor-default text-[var(--color-text-main)] ${
        layout.isMobileLayout
          ? product.editorInterface === 'ui3'
            ? 'studio-mobile-column'
            : 'studio-mobile-column studio-pro-mobile'
          : ''
      } ${layout.isMobileLandscape ? 'studio-mobile-landscape' : ''}`}
      style={{ background: 'var(--color-bg)' }}
      id="mmd-workspace-main"
      data-studio-layout={adaptive.layoutId}
      data-studio-touch={adaptive.isTouchPrimary ? '1' : '0'}
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
      {!isViewer && !layout.isMobileLayout && product.editorInterface !== 'ui3' && (
        <StudioFlowBar
          compact={false}
          uiMode={product.uiMode}
          onUiModeChange={product.handleUiModeChange}
          editorInterface={product.editorInterface}
          onEditorInterfaceChange={product.handleEditorInterfaceChange}
          onOpenUiComparison={() => setUiCompareOpen(true)}
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
      {!isViewer &&
        !isBeginnerMode(product.uiMode) &&
        !layout.isMobileLayout &&
        product.editorInterface !== 'ui3' && (
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
        pathTracerLabEnabled={appState.pathTracerLabEnabled}
        pathTracer={appState.pathTracer ?? DEFAULT_PATH_TRACER_SETTINGS}
        onSetPathTracerLabEnabled={handleSetPathTracerLabEnabled}
        onPatchPathTracer={handlePatchPathTracer}
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
        onCinemaRender={handleCinemaRender}
        onLiveRecord={handleLiveRecord}
        videoMetadata={smartVideoMetadata.metadata}
        showVideoInformation={smartVideoMetadata.visible}
        onRegenerateMetadata={smartVideoMetadata.regenerate}
        onMetadataLocaleChange={smartVideoMetadata.setLocale}
        onMetadataPlatformChange={smartVideoMetadata.setPlatform}
        onMetadataTitleSelect={smartVideoMetadata.selectTitle}
        onMetadataCopyFeedback={(msg) => product.showToast(msg, 2000)}
        onOpenSmartStudio={() => {
          setOpenTopMenuId(null);
          setSmartStudioPickerOpen(true);
        }}
        onEnterSmartStudioMode={(mode) => {
          setOpenTopMenuId(null);
          void smartStudio.enter(mode);
        }}
        onOpenCineStudio={() => {
          setOpenTopMenuId(null);
          setCineStudioOpen(true);
        }}
        onOpenReferenceCameraStudio={() => {
          setOpenTopMenuId(null);
          setRefCamStudioOpen(true);
          setAppState((prev) => ({
            ...prev,
            referenceCamera: {
              ...(prev.referenceCamera ?? DEFAULT_REFERENCE_CAMERA),
              studioOpen: true,
            },
          }));
        }}
        vcs={vcs}
        appState={appState}
        onPatchSceneComposer={handlePatchSceneComposer}
        onReplaceSceneComposer={handleReplaceSceneComposer}
        visualStyles={visualStyles}
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

      {/* 2. Middle — UI 3.0 (all sizes) · Pro Mobile (UI 1.0 ≤768) · Desktop classic */}
      <div className="app-shell__main relative">
        {!isViewer && layout.isMobileLayout && product.editorInterface !== 'ui3' ? (
          <ProMobileShell
            sceneTitle={proSceneTitle}
            viewport={viewportColumn}
            hasModel={appState.models.length > 0}
            isPlaying={Boolean(appState.isPlaying)}
            manualOrbit={
              appState.cameraMode === 'free' || Boolean(appState.cameraStudio.manualCameraLock)
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
            editorInterface={product.editorInterface}
            onEditorInterfaceChange={product.handleEditorInterfaceChange}
            qualityMode={product.qualityMode}
            onQualityModeChange={product.handleQualityModeChange}
            onApplyTemplate={(id) => applyTemplateRef.current(id)}
            timeline={editorTimelineShell}
            selectedObjectId={appState.selectedObjectId}
            selectedBoneId={appState.selectedBoneId}
            highlightMaterial={highlightMaterial}
            cameraMode={appState.cameraMode}
            cameraDirectPlacement={appState.cameraStudio.directPlacement !== false}
            models={appState.models.map((m) => ({
              id: m.id,
              name: m.name,
              assetKind: m.assetKind,
            }))}
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            onUndo={editor.handleUndo}
            onRedo={editor.handleRedo}
            onSetCameraMode={setCameraMode}
            onEnterDirectCameraMode={handleEnterDirectCameraMode}
            viewportFormat={viewportFormat}
            onViewportFormatChange={handleViewportFormatChange}
            renderWorkspaceTool={(tool) => {
              const panelKey = workspaceToStudioPanel(tool);
              if (panelKey === 'timeline') {
                return editorTimelineShell;
              }
              if (panelKey && studio3Panels[panelKey]) {
                return (
                  <div className="px-1 pb-4 min-h-0 am-sheet-scroll">
                    {studio3Panels[panelKey]}
                  </div>
                );
              }
              if (tool === 'fx') {
                return <div className="px-1 pb-4 am-sheet-scroll">{proFxPanel}</div>;
              }
              const tab =
                tool === 'assets' || tool === 'scene' || tool === 'photo'
                  ? 'scene'
                  : tool === 'camera'
                    ? 'camera'
                    : tool === 'timeline' ||
                        tool === 'animation' ||
                        tool === 'inspector' ||
                        tool === 'mocap'
                      ? 'control'
                      : 'fx';
              return studioSidebar({
                mobile: true,
                embedded: true,
                proMobileSheet: true,
                tab,
              });
            }}
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
        ) : !isViewer && product.editorInterface === 'ui3' ? (
          <StudioUi3Shell
            sceneTitle={proSceneTitle}
            panels={studio3Panels}
            viewport={viewportColumn}
            timeline={editorTimelineShell}
            isPlaying={appState.isPlaying}
            onTogglePlay={() => handleSetIsPlaying(!appState.isPlaying)}
            selectedObjectId={appState.selectedObjectId}
            selectedBoneId={appState.selectedBoneId}
            highlightMaterial={highlightMaterial}
            cameraMode={appState.cameraMode}
            cameraDirectPlacement={appState.cameraStudio.directPlacement !== false}
            models={appState.models.map((m) => ({
              id: m.id,
              name: m.name,
              assetKind: m.assetKind,
            }))}
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            onUndo={editor.handleUndo}
            onRedo={editor.handleRedo}
            onSetCameraMode={setCameraMode}
            onEnterDirectCameraMode={handleEnterDirectCameraMode}
            viewportFormat={viewportFormat}
            onViewportFormatChange={handleViewportFormatChange}
            menubar={
              !isBeginnerMode(product.uiMode) ? (
                <TopMenu
                  physicsMode={appState.physicsMode}
                  setPhysicsMode={(mode) => setAppState((prev) => ({ ...prev, physicsMode: mode }))}
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
                  onCinemaRender={handleCinemaRender}
                  onLiveRecord={handleLiveRecord}
                  videoMetadata={smartVideoMetadata.metadata}
                  showVideoInformation={smartVideoMetadata.visible}
                  onRegenerateMetadata={smartVideoMetadata.regenerate}
                  onMetadataLocaleChange={smartVideoMetadata.setLocale}
                  onMetadataPlatformChange={smartVideoMetadata.setPlatform}
                  onMetadataTitleSelect={smartVideoMetadata.selectTitle}
                  onMetadataCopyFeedback={(msg) => product.showToast(msg, 2000)}
                  onOpenSmartStudio={() => {
                    setOpenTopMenuId(null);
                    setSmartStudioPickerOpen(true);
                  }}
                  onEnterSmartStudioMode={(mode) => {
                    setOpenTopMenuId(null);
                    void smartStudio.enter(mode);
                  }}
                  onOpenCineStudio={() => {
                    setOpenTopMenuId(null);
                    setCineStudioOpen(true);
                  }}
                  onOpenReferenceCameraStudio={() => {
                    setOpenTopMenuId(null);
                    setRefCamStudioOpen(true);
                    setAppState((prev) => ({
                      ...prev,
                      referenceCamera: {
                        ...(prev.referenceCamera ?? DEFAULT_REFERENCE_CAMERA),
                        studioOpen: true,
                      },
                    }));
                  }}
                  vcs={vcs}
                  appState={appState}
                  onPatchSceneComposer={handlePatchSceneComposer}
                  onReplaceSceneComposer={handleReplaceSceneComposer}
                  visualStyles={visualStyles}
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
                    appState.models.find((m) => m.id === appState.selectedObjectId)
                      ?.vmdPlaybackEnabled !== false
                  }
                  onToggleVmdPlayback={() => {
                    const id = appState.selectedObjectId;
                    if (!id) return;
                    const model = appState.models.find((m) => m.id === id);
                    if (!model?.hasVmdAnimation) return;
                    const currentlyOn = model.vmdPlaybackEnabled !== false;
                    handleSetVmdPlaybackEnabled(id, !currentlyOn);
                  }}
                  isMobile={layout.isMobileLayout}
                  mobileNavOpen={mobileNavOpen}
                  onMobileNavOpenChange={setMobileNavOpen}
                  openMenuId={openTopMenuId}
                  onOpenMenuIdChange={setOpenTopMenuId}
                  onTryDemo={() => {
                    product.dismissOnboarding();
                    void handleLoadDemoScene(FEATURED_DEMO_ID);
                  }}
                />
              ) : undefined
            }
            editorInterface={product.editorInterface}
            onEditorInterfaceChange={product.handleEditorInterfaceChange}
            uiMode={product.uiMode}
            onUiModeChange={product.handleUiModeChange}
            qualityMode={product.qualityMode}
            onQualityModeChange={product.handleQualityModeChange}
            onSaveProject={product.handleSaveProject}
            onLoadProject={product.handleLoadProject}
            onLoadProjectFile={() => projectFileInputRef.current?.click()}
            onShareScene={() => void product.handleShareScene()}
            onCreateShort={product.openShortsSetup}
            onExportMp4={handleRenderMp4}
            hasSavedProject={product.hasSaved}
            shareBusy={product.shareBusy}
            hasModel={appState.models.length > 0}
            onLoadDemo={() => {
              product.dismissOnboarding();
              void handleLoadDemoScene(FEATURED_DEMO_ID);
            }}
            onOpenOneClick={() => {
              product.dismissOnboarding();
              oneClickCreator.enter();
            }}
            onOpenUiComparison={() => setUiCompareOpen(true)}
          />
        ) : !isViewer ? (
          <DesktopLayout
            showLeftSidebar={showLeftSidebar}
            onToggleLeftSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
            sidebar={
              showLeftSidebar && !smartStudio.state.active && !oneClickCreator.state.active
                ? studioSidebar({ mobile: isMobile && layout.isMobileLandscape })
                : null
            }
            viewportColumn={viewportColumn}
          />
        ) : (
          viewportColumn
        )}
      </div>

      {!isViewer && ifacePickerOpen ? (
        <InterfaceSelectionScreen
          onSelect={(id) => {
            product.handleEditorInterfaceChange(id);
            setIfacePickerOpen(false);
          }}
        />
      ) : null}

      {!isViewer && uiCompareOpen ? (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 p-4 studio-safe-area">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-xl border border-zinc-800 bg-[#0c0f14] shadow-2xl">
            <UiComparisonPanel
              current={product.editorInterface}
              onSelect={(id) => {
                product.handleEditorInterfaceChange(id);
                setUiCompareOpen(false);
              }}
              onClose={() => setUiCompareOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {!isViewer && !ifacePickerOpen ? (
        <MigrationTips
          editorInterface={product.editorInterface}
          onOpenComparison={() => setUiCompareOpen(true)}
          onSwitchToUi3={() => product.handleEditorInterfaceChange('ui3')}
        />
      ) : null}

    </div>
  );
}
