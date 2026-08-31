import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
} from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  Upload,
  Loader2,
  Move,
  RotateCw,
  Camera as CameraIcon,
  Film as FilmIcon,
  Lock,
  Unlock,
  Key,
} from 'lucide-react';
import * as THREE from 'three';
import { OutlineEffect } from 'three-stdlib';
import { AppState, CameraSnapshot, VisualFxSettings } from '../types';
import { getColorGrade } from '../visualFx/visualFxPresets';
import MMDModelWrapper, { BoneTransformUpdate } from './MMDModelWrapper';
import FbxModelWrapper from './FbxModelWrapper';
import CameraDirectGizmo from './camera/CameraDirectGizmo';
import CameraPathVisualization from './referenceCamera/CameraPathVisualization';
import CompositionGuidesOverlay from './referenceCamera/CompositionGuidesOverlay';
import ReferenceModeOverlay from './referenceCamera/ReferenceModeOverlay';
import ShotComposerViewportLayer from './shotComposer/ShotComposerViewportLayer';
import ShotComposerGuidesOverlay from './shotComposer/ShotComposerGuidesOverlay';
import type { CompositionGuideId, PlacementHit, ShotComposerMode } from '../shotComposer';
import type { MMDModel } from '../types';
import { DEFAULT_REFERENCE_CAMERA } from '../referenceCamera';
import MMDCameraController from './MMDCameraController';
import ScenePostProcessing from './ScenePostProcessing';
import ViewportCanvasShell from './ViewportCanvasShell';
import ViewportWebGlBoundary from './ViewportWebGlBoundary';
import PortraitCameraFraming from './PortraitCameraFraming';
import MmdWeatherPrecip from './MmdWeatherPrecip';
import SceneParticles from './SceneParticles';
import SceneFxRuntimeLayer from './sceneStudio/SceneFxRuntimeLayer';
import { resolveSceneFxTarget } from '../sceneStudio/runtime/sceneFxTarget';
import { weatherKindFromEffectId } from '../sceneStudio/runtime/weatherFx';
import { isMobileRuntime } from '../utils/platform';
import GodRaySun from './GodRaySun';
import SceneHdrEnvironment from './SceneHdrEnvironment';
import SceneEnvironment from './SceneEnvironment';
import AshfallCityEnvironment from './ashfallCity/AshfallCityEnvironment';
import DynamicSkyBridge from './DynamicSkyBridge';
import SmartRenderBridge from './renderPipeline4/SmartRenderBridge';
import { DEFAULT_DYNAMIC_SKY, resolveDynamicSkyLook } from '../dynamicSky';
import { DEFAULT_ASHFALL_CITY } from '../ashfallCity';
import { AsrpSystem, resolveAsrpFrame, mergeVisualFxFromFrame } from '../asrp';
import { ReflectionSystem, DEFAULT_REFLECTION_SYSTEM } from '../reflections';
import AspectFormatToggle from './AspectFormatToggle';
import AnimationTemplateSelector from './AnimationTemplateSelector';
import { templateHasCamera } from '../templates/animationTemplates';
import { mergeCharacterProfiles } from '../product/vcs/character/analyzeProfile';
import SceneBackgroundPicker from './SceneBackgroundPicker';
import CameraSceneBackground from './CameraSceneBackground';
import type { CharacterQuality, SceneBackgroundSettings, TemplateApplyMode, TemplateApplyOptions } from '../types';
import {
  getCharacterQualityGpu,
  isPortraitFormat,
  shouldUseCharacterOutline,
} from '../utils/characterQuality';
import { resolveEffectiveCanvasDpr } from '../perf/controller/effectiveDpr';
import WebGLRendererLifecycle from './WebGLRendererLifecycle';
import {
  getGraphicsEpoch,
  isGpuSuspended,
  isWebGlContextBlocked,
  markWebGlContextCreationFailed,
  recordWebGlContextCreated,
  subscribeGraphicsSystem,
} from '../render/graphicsSystemStore';
import { setWebGlContextLostListener } from '../render/webglLifecycleStore';
import RecordingBridge from './RecordingBridge';
import { isRecordingCapture, isCinemaRenderCapture, isInteractiveRecordingCapture, isOfflineExportCapture, setCaptureRenderer, clearCaptureRenderer, recordingCaptureState } from '../video/recordingCapture';
import { resolveRtxSettings } from '../utils/rtxSettings';
import { getFilesAsync } from '../utils/mmdFiles';
import { processImportedAssets } from '../utils/assetImport';
import { detectLutFileKind } from '../utils/lutParser';
import type { ProcessedMMDFiles, ProcessedVmdFiles } from '../utils/mmdFiles';
import ViewportPerfMonitor, { type ViewportPerfSnapshot } from './ViewportPerfMonitor';
import PerformanceOverlay from '../product/ui/PerformanceOverlay';
import { DEBUG_UI } from '../config/debugUi';
import ViewportEmptyState from './viewport/ViewportEmptyState';
import { useStudioLayout } from '../hooks/useStudioLayout';
import { AdaptiveDprSync } from './perf/AdaptiveDprSync';
import { PerfFrameBegin, PerfFrameEnd } from './perf/PerfFrameSync';
import { MultiCharacterPhysicsCap } from './perf/MultiCharacterPhysicsCap';
import MultiCharacterPerfSync from './perf/MultiCharacterPerfSync';
import SceneFrameInvalidate from './perf/SceneFrameInvalidate';
import { resolveNeedsContinuousRender } from '../perf/controller/viewportFrameloop';
import { getEffectiveVisualFx } from '../perf/effectiveVisualFx';
import { getPerfRenderAdaptation } from '../perf/controller/renderAdaptation';
import { isTemplateMotionActive } from '../perf/scenePerfPolicy';
import { getDefaultLiveValues } from './TimelineLogic';
import type { CameraFramingMode, MmdLiteConfig, SceneHdrSettings, ViewportFormat } from '../types';
import { resolveCameraFramingFromModels } from '../scene/cameraFraming';
import {
  resolveModelCharacterQuality,
  shouldCastShadowForModel,
  shouldSimulatePhysicsForModel,
  shouldUseLiteRenderForModel,
} from '../scene/multiModelPolicy';
import { countVisibleModels } from '../scene/sceneModelLayout';
import { sceneHasStage, isGenericImportedModel } from '../utils/assetModelKind';
import StageAutoFollow from '../product/camera/StageAutoFollow';
import { isHdrFile } from '../utils/hdrEnvironment';
import LetterboxOverlay from './LetterboxOverlay';
import { useAutoDismiss } from '../hooks/useAutoDismiss';
import CisImportReadyCard from './cis/CisImportReadyCard';
import ViewportSnapshotBridge from './sceneComposer/ViewportSnapshotBridge';
import CascadedShadowLighting from '../render/heavyMesh/CascadedShadowLighting';
import { AtmosphereFogBridge, WetSurfaceOverlay } from '../atmosphere';
import {
  resolveVqBudget,
  reportVqRuntime,
  useVqStore,
  VqDebugHud,
} from '../visualQuality';
import { isMobileRuntimeCapsActive } from '../perf/mobileRuntimeCaps';
import AnimeNprBridge from '../render/animeNpr/AnimeNprBridge';
import PathTracerBridge from '../pathTracer/PathTracerBridge';

function MMDOutlineEffect() {
  const { gl, scene, camera, size } = useThree();

  const effect = useMemo(() => new OutlineEffect(gl), [gl]);
  const nativeRenderRef = useRef<(scene: THREE.Object3D, camera: THREE.Camera) => void | null>(null);

  useLayoutEffect(() => {
    nativeRenderRef.current = gl.render.bind(gl);
  }, [gl]);

  useEffect(() => {
    effect.setSize(size.width, size.height);
  }, [effect, size.width, size.height]);

  useEffect(() => {
    const previousRender = gl.render.bind(gl);
    gl.render = () => undefined;
    return () => {
      gl.render = previousRender;
    };
  }, [gl]);

  useFrame(() => {
    const nativeRender = nativeRenderRef.current;
    if (!nativeRender) return;

    if (!effect.enabled) {
      nativeRender(scene, camera);
      return;
    }

    const prevAutoClear = gl.autoClear;
    gl.autoClear = effect.autoClear;
    nativeRender(scene, camera);
    gl.autoClear = prevAutoClear;

    const previousRender = gl.render;
    gl.render = (s, c) => nativeRender(s, c as THREE.Camera);
    try {
      effect.renderOutline(scene, camera);
    } finally {
      gl.render = previousRender;
    }
  }, 1);

  return null;
}

function BloomToneBoost({
  visualFx,
  viewportFormat,
  rtxModeEnabled,
  exposureClamp = 1.25,
}: {
  visualFx: VisualFxSettings;
  viewportFormat: ViewportFormat;
  rtxModeEnabled: boolean;
  exposureClamp?: number;
}) {
  const { gl } = useThree();
  useEffect(() => {
    const grade = getColorGrade(visualFx.colorGrade ?? 'neutral');
    const base = visualFx.toneExposure ?? 0.95;
    const cinematic =
      visualFx.bloomEnabled ||
      visualFx.dofEnabled ||
      rtxModeEnabled ||
      visualFx.colorGrade !== 'neutral';
    const vertical = viewportFormat === '9:16';
    const portraitDim = vertical ? 0.9 : 1;
    const gradeExposure =
      1 +
      grade.brightness +
      grade.contrast * 0.12 +
      (visualFx.gradeExposure ?? 0) * 0.08;
    const fidelityMul = visualFx.renderMode === 'mmd_fidelity' ? 0.92 : 1;
    const exposure =
      base * portraitDim * gradeExposure * (cinematic ? 0.98 : 1) * fidelityMul;
    gl.toneMappingExposure = Math.min(exposure, exposureClamp);
  }, [
    gl,
    visualFx.bloomEnabled,
    visualFx.dofEnabled,
    visualFx.toneExposure,
    visualFx.colorGrade,
    visualFx.gradeExposure,
    visualFx.renderMode,
    viewportFormat,
    rtxModeEnabled,
    exposureClamp,
  ]);
  return null;
}

interface SceneContentProps {
  appState: AppState;
  mmdLite: MmdLiteConfig;
  sceneHdr: SceneHdrSettings;
  viewportFormat: ViewportFormat;
  characterQuality: CharacterQuality;
  showGrid: boolean;
  showBones: boolean;
  showCameraHelper: boolean;
  showPhysicsBodies: boolean;
  transformMode: 'translate' | 'rotate';
  gizmoDraggingRef: React.MutableRefObject<boolean>;
  rootGizmoDraggingRef: React.MutableRefObject<boolean>;
  onSelectBone: (id: string | null) => void;
  onSelectRoot: () => void;
  onBoneTransform: (boneId: string, update: BoneTransformUpdate) => void;
  onModelMove: (x: number, y: number, z: number) => void;
  onModelRotate: (x: number, y: number, z: number) => void;
  onCaptureCameraReady: (capture: () => CameraSnapshot | null) => void;
  onFlyToCameraReady?: (fly: (snapshot: CameraSnapshot) => void) => void;
  onModelReady?: (api: import('./MMDModelWrapper').MMDModelApi | null) => void;
  onModelAnimationLoaded?: (modelId: string, frameCount: number) => void;
  onSetCurrentFrame?: (frame: number) => void;
  isRecordingVideo?: boolean;
  onRecordingTick?: () => void;
  onInvalidateReady?: (invalidate: () => void) => void;
  highlightMaterialName?: string | null;
  onPmxMetadataLoaded?: (
    modelId: string,
    meta: {
      bones: import('../types').PmxBoneInfo[];
      morphs: import('../types').PmxMorphInfo[];
      materials: import('../types').PmxMaterialInfo[];
    },
    mesh: import('three').SkinnedMesh
  ) => void;
  onApisReportUpdate?: (modelId: string, patch: Partial<import('../apis').ApisReport>) => void;
  onPerfStats?: (stats: ViewportPerfSnapshot) => void;
  onCaptureFrameReady?: (capture: () => string | null) => void;
  onDynamicSkyTick?: (nextHours: number) => void;
  onSmartViewportPatch?: (patch: Partial<AppState>) => void;
  onSceneFxRuntimeError?: (instanceId: string, message: string) => void;
  shotComposer?: {
    mode: ShotComposerMode;
    floorYOverride: number | null;
    characterHeight: number;
    ghostHit: PlacementHit | null;
    stageModel: MMDModel | null;
    onGhostHit: (hit: PlacementHit | null) => void;
    onConfirmPlace: (hit: PlacementHit) => void;
    onCancel: () => void;
    onEnvAnalyzed?: (stageId: string) => void;
  };
  canvasHostRef?: React.RefObject<HTMLDivElement | null>;
  pathTracerCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
  sceneBusy?: boolean;
  modelSettleUntil?: number;
}

function SoftShadowMapSync({ soft }: { soft: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.shadowMap.type = soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    gl.shadowMap.needsUpdate = true;
  }, [gl, soft]);
  useFrame(() => {
    // PCSS-like softness cue from ASRP V2 budgets (radius via shadow bias pad).
    const pcss = Number(scene.userData.asrpV2Pcss ?? 0);
    if (pcss > 0.5 && soft) {
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
    }
  });
  return null;
}

/** Registers GL for Cinema supersample lock; keeps internal res stable during export. */
function CinemaCaptureBridge() {
  const { gl } = useThree();
  useEffect(() => {
    setCaptureRenderer(gl as unknown);
    return () => clearCaptureRenderer();
  }, [gl]);
  useFrame(() => {
    if (!isCinemaRenderCapture()) return;
    const tw = recordingCaptureState.targetWidth;
    const th = recordingCaptureState.targetHeight;
    const ss = Math.max(1, recordingCaptureState.supersample);
    if (tw < 2 || th < 2) return;
    const w = Math.max(2, Math.round((tw * ss) / 2) * 2);
    const h = Math.max(2, Math.round((th * ss) / 2) * 2);
    if (gl.domElement.width !== w || gl.domElement.height !== h) {
      gl.setPixelRatio(1);
      gl.setSize(w, h, false);
    }
  });
  return null;
}

function SceneContent({
  appState,
  mmdLite,
  sceneHdr,
  viewportFormat,
  characterQuality,
  showGrid,
  showBones,
  showCameraHelper,
  showPhysicsBodies,
  transformMode,
  gizmoDraggingRef,
  rootGizmoDraggingRef,
  onSelectBone,
  onSelectRoot,
  onBoneTransform,
  onModelMove,
  onModelRotate,
  onCaptureCameraReady,
  onFlyToCameraReady,
  onModelReady,
  onModelAnimationLoaded,
  onSetCurrentFrame,
  isRecordingVideo = false,
  onRecordingTick,
  onInvalidateReady,
  highlightMaterialName = null,
  onPmxMetadataLoaded,
  onApisReportUpdate,
  onPerfStats,
  onCaptureFrameReady,
  onDynamicSkyTick,
  onSmartViewportPatch,
  onSceneFxRuntimeError,
  shotComposer,
  canvasHostRef,
  pathTracerCanvasRef,
  sceneBusy = false,
  modelSettleUntil = 0,
}: SceneContentProps) {
  const captureChrome = isRecordingVideo || isRecordingCapture();
  const activeModel = appState.models.find((m) => m.id === appState.selectedObjectId);
  const castSoloId = appState.sceneDirector?.castSoloId ?? null;
  const cameraFraming: CameraFramingMode = resolveCameraFramingFromModels(appState.models);
  const modelOffset = {
    x: activeModel?.positionX ?? 0,
    y: activeModel?.positionY ?? 0,
    z: activeModel?.positionZ ?? 0,
  };
  const sceneFxTarget = useMemo(
    () => resolveSceneFxTarget(appState.models, appState.selectedObjectId),
    [appState.models, appState.selectedObjectId]
  );
  const sceneFxWeatherActive = useMemo(
    () =>
      (appState.sceneStudio?.fxStack ?? []).some(
        (fx) => fx.enabled && weatherKindFromEffectId(fx.effectId) !== null
      ),
    [appState.sceneStudio?.fxStack]
  );
  const hasCustomBg = Boolean(appState.sceneBackground.imageUrl);
  const dynamicSky = appState.dynamicSky ?? DEFAULT_DYNAMIC_SKY;
  const skyLook =
    dynamicSky.enabled && !hasCustomBg ? resolveDynamicSkyLook(dynamicSky) : null;
  const vertical = viewportFormat === '9:16';
  const qualityGpu = getCharacterQualityGpu(characterQuality, viewportFormat);
  const useOutline =
    shouldUseCharacterOutline(characterQuality, viewportFormat) &&
    !vertical;
  const rtxResolved = resolveRtxSettings(appState.rtxSettings, viewportFormat);
  const godRaySunRef = useRef<THREE.Mesh>(null);
  const postFx = useMemo(
    () => getEffectiveVisualFx(appState.visualFx, appState, viewportFormat),
    [appState, viewportFormat]
  );
  const vqStore = useVqStore();
  const mmdFidelity = postFx.renderMode === 'mmd_fidelity';
  const renderAdapt = getPerfRenderAdaptation();
  const templateMotion = isTemplateMotionActive(appState);
  const cameraTrackEditing =
    appState.cameraMode === 'mmd' &&
    !appState.isPlaying &&
    !appState.hasCameraVmd &&
    appState.timelineActiveTrack === 'camera';
  const visibleModelCount = countVisibleModels(appState.models);
  const multiCharacterScene = visibleModelCount >= 2;
  const hasImportedStage = sceneHasStage(appState.models);
  const baseShadowMapSize = multiCharacterScene
    ? Math.min(1024, qualityGpu.shadowMapSize)
    : qualityGpu.shadowMapSize;
  const cineRender = appState.cinematicRender;
  const cinemaCapture = isCinemaRenderCapture();
  const vqBudget = useMemo(
    () =>
      resolveVqBudget({
        mobile: isMobileRuntime() || isMobileRuntimeCapsActive(),
        portraitLite: vertical && !cinemaCapture,
        captureBoost: cinemaCapture || isOfflineExportCapture(),
        photoMode: vqStore.photoMode,
        renderTier: appState.renderTier ?? 'lite',
        baseShadowMapSize,
        legacyCompare: vqStore.legacyCompare,
        preferredPreset: vqStore.preferredPreset,
      }),
    [
      vertical,
      cinemaCapture,
      vqStore.photoMode,
      vqStore.legacyCompare,
      vqStore.preferredPreset,
      appState.renderTier,
      baseShadowMapSize,
    ]
  );

  useEffect(() => {
    const passes = [
      vqBudget.ao ? 'AO' : null,
      vqBudget.bloom ? 'Bloom' : null,
      vqBudget.dof ? 'DOF' : null,
      'Grade',
      vqBudget.smaa ? 'SMAA' : null,
    ].filter(Boolean) as string[];
    reportVqRuntime({
      budget: vqBudget,
      activePasses: passes,
    });
  }, [vqBudget]);

  // LIVE must not unlock export-quality probes / ASRP — that tanks FPS with RP2/3.
  const exportQualityBoost = cinemaCapture || (isRecordingVideo && !isInteractiveRecordingCapture());
  const asrpFrame = useMemo(
    () =>
      resolveAsrpFrame(appState, viewportFormat, {
        exporting: exportQualityBoost,
        cinema: cinemaCapture,
        portraitLite: vertical && !cinemaCapture,
      }),
    [appState, viewportFormat, exportQualityBoost, cinemaCapture, vertical]
  );
  const postFxResolved = useMemo(() => {
    const merged = mergeVisualFxFromFrame(postFx, asrpFrame);
    // Apply VQ gates without mutating user settings permanently.
    return {
      ...merged,
      ssaoEnabled:
        vqBudget.ao &&
        (merged.ssaoEnabled === true ||
          vqBudget.preset === 'photo' ||
          vqBudget.preset === 'cinematic' ||
          vqBudget.preset === 'ultra' ||
          vqBudget.preset === 'high'),
      ssaoHalfRes: vqBudget.aoHalfRes ? true : merged.ssaoHalfRes,
      bloomEnabled: vqBudget.bloom ? merged.bloomEnabled : false,
      bloomIntensity: Math.min(
        merged.bloomIntensity,
        vqBudget.bloomIntensityCap
      ),
      dofEnabled: vqBudget.dof ? merged.dofEnabled : false,
      smaaEnabled: vqBudget.smaa ? merged.smaaEnabled !== false : merged.smaaEnabled,
      godRaysEnabled: vqBudget.godRays ? merged.godRaysEnabled === true : false,
      floorReflection: vqBudget.reflections
        ? merged.floorReflection
        : Math.min(merged.floorReflection, 0.2),
    };
  }, [postFx, asrpFrame, vqBudget]);
  const cineShadowBoost =
    cineRender?.enabled &&
    (cineRender.qualityPreset === 'cinematic' ||
      cineRender.qualityPreset === 'ultra' ||
      cineRender.qualityPreset === 'rtx_lite')
      ? 1.5
      : 1;
  // Shadow resolution shrinks before any render-scale reduction (character-quality-first).
  const shadowMapSize = Math.max(
    512,
    Math.floor(
      Math.min(vqBudget.shadowMapSize, baseShadowMapSize * (vqBudget.preset === 'photo' ? 2 : 1.25)) *
        renderAdapt.shadowMapScale *
        cineShadowBoost *
        (asrpFrame.budgets.shadowTier === 'ultra'
          ? 1.25
          : asrpFrame.budgets.shadowTier === 'low'
            ? 0.5
            : 1)
    )
  );
  const softShadows =
    vqBudget.softShadows &&
    asrpFrame.budgets.softShadows &&
    asrpFrame.budgets.shadowTier !== 'off';
  const rp3 = appState.renderPipeline3;
  const rp2 = appState.renderPipeline2;
  const contactSrc = rp3?.enabled ? rp3.contactShadows : rp2?.contactShadows;
  const contactShadows =
    vqBudget.contactShadows &&
    asrpFrame.budgets.contactShadows &&
    asrpFrame.budgets.shadowTier !== 'off' &&
    (contactSrc ? contactSrc.enabled !== false : true);
  const contactShadowTuning =
    contactSrc && contactSrc.enabled
      ? {
          opacity: contactSrc.opacity,
          scale: contactSrc.scale,
          blur: contactSrc.blur,
          far: contactSrc.far,
        }
      : undefined;
  const atmosphereFogActive =
    vqBudget.fogQuality !== 'off' &&
    (Boolean(appState.sceneComposer?.fogEnabled) ||
      Boolean(skyLook?.fogEnabled) ||
      postFxResolved.weatherPreset === 'fog' ||
      postFxResolved.weatherPreset === 'snow');
  const vcsProfile = useMemo(
    () => mergeCharacterProfiles(Object.values(appState.vcs?.characterProfiles ?? {})),
    [appState.vcs?.characterProfiles]
  );
  const vcsActive = Boolean(appState.vcs?.enabled);
  const vcsHandheld = Boolean(
    (vcsActive && appState.vcs?.handheld) ||
      (appState.cinematic?.enabled && appState.cinematic.handheld)
  );
  const vcsCollision = Boolean(
    (vcsActive && appState.vcs?.safeCamera !== false) ||
      (appState.cinematic?.enabled && appState.cinematic?.collisionAvoidance !== false)
  );

  return (
    <>
      <WebGLRendererLifecycle onContextRestored={() => {}} />
      <SoftShadowMapSync soft={softShadows} />
      <CinemaCaptureBridge />
      <ViewportSnapshotBridge onReady={onCaptureFrameReady ?? undefined} />
      <PerfFrameBegin />
      <PerfFrameEnd />
      <MultiCharacterPhysicsCap />
      <MultiCharacterPerfSync
        models={appState.models}
        selectedObjectId={appState.selectedObjectId}
      />
      <AdaptiveDprSync
        characterQuality={characterQuality}
        viewportFormat={viewportFormat}
        portraitLite={vertical}
        rtxEnabled={appState.rtxModeEnabled}
        templateMotion={templateMotion}
        liveRecordingCap={
          isInteractiveRecordingCapture() ? recordingCaptureState.maxDpr : undefined
        }
      />
      {onPerfStats && (
        <ViewportPerfMonitor
          onUpdate={onPerfStats}
          isRecordingVideo={isRecordingVideo}
        />
      )}
      <RecordingBridge
        recordingActive={isRecordingVideo}
        onTick={onRecordingTick}
        onInvalidateReady={onInvalidateReady}
      />

      {!hasCustomBg ? null : <color attach="background" args={['#000000']} />}

      <PortraitCameraFraming
        format={viewportFormat}
        cameraMode={appState.cameraMode}
        cameraFraming={cameraFraming}
        modelOffset={modelOffset}
        autoFocusEnabled={
          appState.cameraMode === 'free' &&
          appState.cameraStudio.autoFocus !== false &&
          !appState.cameraStudio.manualCameraLock &&
          !appState.cameraStudio.directPlacement
        }
        directPlacement={appState.cameraStudio.directPlacement !== false}
      />

      {useOutline && (mmdFidelity || !postFxResolved.bloomEnabled) && !vertical && <MMDOutlineEffect />}
      <BloomToneBoost
        visualFx={postFxResolved}
        viewportFormat={viewportFormat}
        rtxModeEnabled={appState.rtxModeEnabled}
        exposureClamp={vqBudget.exposureClamp}
      />
      <SceneHdrEnvironment
        hdrBlobUrl={sceneHdr.blobUrl}
        intensity={sceneHdr.intensity}
        showAsBackground={sceneHdr.showBackground}
      />

      <GodRaySun ref={godRaySunRef} enabled={Boolean(vqBudget.godRays && postFxResolved.godRaysEnabled)} />

      <ScenePostProcessing
        visualFx={postFxResolved}
        modelOffset={modelOffset}
        viewportFormat={viewportFormat}
        rtxModeEnabled={appState.rtxModeEnabled || asrpFrame.pipeline === 'rtx_lite'}
        rtxSettings={rtxResolved}
        pauseRtx={appState.isPlaying && !cinemaCapture}
        godRaySunRef={godRaySunRef}
        renderPipeline2={
          rp3?.enabled && rp2?.enabled
            ? rp2
            : rp2?.enabled
              ? rp2
              : null
        }
      />

      {atmosphereFogActive ? (
        <AtmosphereFogBridge
          enabled
          density={
            appState.sceneComposer?.fogEnabled
              ? appState.sceneComposer.fogDensity
              : Math.max(
                  skyLook?.fogDensity ?? 0.35,
                  postFxResolved.weatherPreset === 'fog' ? 0.55 : 0.3
                )
          }
          color={
            appState.sceneComposer?.fogColor ??
            skyLook?.fogColor ??
            skyLook?.colors.horizon ??
            '#c8d0e0'
          }
          quality={vqBudget.fogQuality}
          heightFog={vqBudget.heightFog}
        />
      ) : null}

      <WetSurfaceOverlay
        enabled={vqBudget.wetness}
        wetness={postFxResolved.wetness ?? 0}
        snowGround={postFxResolved.snowGround ?? 0}
      />

      <CascadedShadowLighting
        enabled={vqBudget.csm && softShadows && !vertical}
        shadowMapSize={shadowMapSize}
        cascades={vqBudget.csmCascades}
        lightIntensity={2.0}
      />

      {!hasCustomBg ? (
        <SceneEnvironment
          visualFx={postFxResolved}
          ultraPhoto={
            characterQuality !== 'standard' ||
            postFxResolved.bloomEnabled ||
            postFxResolved.materialDetailing !== false ||
            postFxResolved.ssaoEnabled === true ||
            appState.rtxModeEnabled ||
            asrpFrame.cinema
          }
          rtxActive={appState.rtxModeEnabled || asrpFrame.pipeline === 'rtx_lite'}
          shadowMapSize={shadowMapSize}
          renderTier={appState.renderTier}
          hideBuiltinFloor={
            hasImportedStage || Boolean(appState.ashfallCity?.enabled)
          }
          sceneComposer={appState.sceneComposer}
          softShadows={softShadows}
          contactShadows={contactShadows}
          contactShadowResolution={vqBudget.contactShadowResolution}
          contactShadowTuning={contactShadowTuning}
          atmosphereFogOwned={atmosphereFogActive}
          skyDomeActive={Boolean(skyLook && dynamicSky.showSkyDome)}
          skyBackground={skyLook?.colors.horizon}
          autoCharacterLights={appState.sceneStudio?.autoCharacterLights ?? false}
          characterPosition={sceneFxTarget.position}
          csmActive={vqBudget.csm && softShadows && !vertical}
        />
      ) : (
        <>
          <CameraSceneBackground background={appState.sceneBackground} />
          <ambientLight
            intensity={vertical ? (appState.rtxModeEnabled ? 0.72 : 0.82) : 1.2}
            color="#ffffff"
          />
          <directionalLight
            castShadow={!vertical && renderAdapt.enableShadows}
            position={[10, 20, 10]}
            intensity={vertical ? (appState.rtxModeEnabled ? 1.35 : 1.5) : 2.1}
            color="#fff8f0"
            shadow-mapSize={[shadowMapSize, shadowMapSize]}
            shadow-camera-near={0.5}
            shadow-camera-far={120}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
          />
          <directionalLight
            position={[-8, 12, -6]}
            intensity={vertical ? 0.75 : 1.2}
            color="#c8d8ff"
          />
          <hemisphereLight
            intensity={vertical ? 0.4 : 0.6}
            color="#e8f0ff"
            groundColor="#404050"
          />
          {!vertical && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
              <planeGeometry args={[60, 60]} />
              <shadowMaterial opacity={0.35} color="#000000" />
            </mesh>
          )}
        </>
      )}

      {(appState.ashfallCity ?? DEFAULT_ASHFALL_CITY).enabled ? (
        <AshfallCityEnvironment
          key={`ashfall-${(appState.ashfallCity ?? DEFAULT_ASHFALL_CITY).quality}`}
          state={appState.ashfallCity ?? DEFAULT_ASHFALL_CITY}
        />
      ) : null}

      {!hasCustomBg && dynamicSky.enabled ? (
        <DynamicSkyBridge dynamicSky={dynamicSky} onTickTime={onDynamicSkyTick} />
      ) : null}

      {onSmartViewportPatch ? (
        <SmartRenderBridge
          appState={appState}
          onApplyViewportPatch={onSmartViewportPatch}
        />
      ) : null}

      {showGrid && !hasImportedStage && !(appState.ashfallCity?.enabled) && (
        <gridHelper args={[30, 30, '#6f42c1', '#222']} position={[0, 0.01, 0]} />
      )}

      {/* Scene FX 2.0 owns precipitation when active — avoids double rain layers. */}
      {sceneFxWeatherActive ? null : <MmdWeatherPrecip visualFx={postFxResolved} />}
      <SceneParticles
        visualFx={postFxResolved}
        active={
          postFxResolved.particlesEnabled !== false &&
          postFxResolved.particlePreset !== 'none' &&
          !(
            sceneFxWeatherActive &&
            (postFxResolved.particlePreset === 'snow' || postFxResolved.particlePreset === 'dust')
          )
        }
      />
      {appState.sceneStudio?.fxStack?.length ? (
        <SceneFxRuntimeLayer
          sceneStudio={appState.sceneStudio}
          currentFrame={appState.currentFrame}
          maxFrames={appState.maxFrames}
          mobile={isMobileRuntime()}
          worldScale={sceneFxTarget.worldScale}
          characterPosition={sceneFxTarget.position}
          particleScale={vqBudget.particleScale}
          depthLayers={vqBudget.weatherLayers}
          onEffectRuntimeError={onSceneFxRuntimeError}
          forceWebGpu={appState.sceneDirector?.rezeEngineEnabled === true}
        />
      ) : null}
      <ReflectionSystem
        appState={{
          ...appState,
          reflectionSystem: {
            ...(appState.reflectionSystem ?? DEFAULT_REFLECTION_SYSTEM),
            ...asrpFrame.reflectionOverrides,
            resolution:
              asrpFrame.reflectionOverrides.resolution ??
              appState.reflectionSystem?.resolution ??
              'auto',
          },
        }}
        exporting={exportQualityBoost}
        skipCharactersInProbe
      />
      <AsrpSystem
        appState={appState}
        exporting={exportQualityBoost}
        viewportFormat={viewportFormat}
        cinema={cinemaCapture}
        skipVolumetricFog={atmosphereFogActive}
      />

      <group>
        {appState.models.map((model) => {
            const isActive = model.id === appState.selectedObjectId;
            const modelVisible = castSoloId ? model.id === castSoloId : model.visible;
            const boneState = model.bones.find((b) => b.id === appState.selectedBoneId);
            const boneRot = isActive && boneState
              ? {
                  x: boneState.rotationX,
                  y: boneState.rotationY,
                  z: boneState.rotationZ,
                }
              : { x: 0, y: 0, z: 0 };
            const modelCharacterQuality = resolveModelCharacterQuality(
              characterQuality,
              model.id,
              appState.selectedObjectId,
              appState.models
            );
            const liteRender = shouldUseLiteRenderForModel(
              model.id,
              appState.selectedObjectId,
              appState.models
            );
            const physicsSimulation = shouldSimulatePhysicsForModel(
              model.id,
              appState.selectedObjectId,
              appState.models,
              appState.isPlaying,
              modelVisible
            );
            const castShadow = shouldCastShadowForModel(
              model.id,
              appState.selectedObjectId,
              appState.models
            );

            return isGenericImportedModel(model) ? (
              <FbxModelWrapper
                key={model.id}
                sceneModelId={model.id}
                modelVisible={modelVisible}
                modelFormat={model.modelFormat}
                modelFileName={model.modelFileName}
                url={model.blobUrl!}
                isPlaying={appState.isPlaying}
                castShadow={castShadow}
                modelPosition={{
                  x: model.positionX,
                  y: model.positionY,
                  z: model.positionZ,
                }}
                modelRotation={{
                  x: model.rotationX ?? 0,
                  y: model.rotationY ?? 0,
                  z: model.rotationZ ?? 0,
                }}
                customManager={model.customManager}
                fileMap={model.fileMap}
                vmdBlobUrls={model.vmdBlobUrls}
                vmdBoneRemap={model.vmdBoneRemap ?? model.umceReport?.motion?.remapTable}
                hasVmdAnimation={
                  Boolean(model.hasVmdAnimation) || (model.vmdBlobUrls?.length ?? 0) > 0
                }
                vmdPlaybackEnabled={model.vmdPlaybackEnabled !== false}
                activeVmdIndex={model.activeVmdIndex ?? 0}
                activeTemplateId={model.activeTemplateId}
                timelineKeyframes={model.keyframes}
                timelineLive={getDefaultLiveValues(model.bones, model.morphs)}
                currentFrame={appState.currentFrame}
                playSpeed={appState.playSpeed * (model.motionSpeed ?? 1)}
                rootGizmoDraggingRef={isActive ? rootGizmoDraggingRef : undefined}
                transformMode={transformMode}
                rootManipulatorActive={
                  isActive && !appState.selectedBoneId && !captureChrome
                }
                onSelectRoot={isActive ? onSelectRoot : undefined}
                onModelMove={isActive ? onModelMove : undefined}
                onModelRotate={isActive ? onModelRotate : undefined}
                onModelReady={
                  model.id === appState.selectedObjectId ? onModelReady : undefined
                }
                hideStagingChrome={captureChrome}
                onPmxMetadata={
                  isActive && onPmxMetadataLoaded
                    ? (meta, skMesh) => onPmxMetadataLoaded(model.id, meta, skMesh)
                    : undefined
                }
                characterQuality={modelCharacterQuality}
                viewportFormat={viewportFormat}
                materialDetailing={
                  model.assetKind !== 'stage' &&
                  !liteRender &&
                  appState.visualFx.materialDetailing !== false
                }
                materialSmoothing={appState.visualFx.materialSmoothing ?? 0.55}
                environmentIntensity={postFx.environmentIntensity ?? 0.72}
                assetKind={model.assetKind}
                worldScale={model.worldScale ?? 1}
                onAnimationLoaded={
                  onModelAnimationLoaded
                    ? (frameCount) => onModelAnimationLoaded(model.id, frameCount)
                    : undefined
                }
              />
            ) : (
              <MMDModelWrapper
                key={model.id}
                sceneModelId={model.id}
                modelVisible={modelVisible}
                contentFingerprint={model.contentFingerprint}
                url={
                  model.blobUrl ||
                  (model.type === 'custom'
                    ? 'models/custom_rig.pmx'
                    : `models/${model.type}.pmx`)
                }
                isPlaying={appState.isPlaying}
                physicsMode={appState.physicsMode}
                physicsSimulation={physicsSimulation}
                castShadow={castShadow}
                displayBodies={showPhysicsBodies && isActive}
                morphs={{
                  eyesBlink: model.morphs.eyes,
                  mouthOpen: model.morphs.mouth,
                  browSad: model.morphs.brow,
                }}
                selectedBone={isActive ? appState.selectedBoneId || '' : ''}
                boneRotation={boneRot}
                modelPosition={{
                  x: model.positionX,
                  y: model.positionY,
                  z: model.positionZ,
                }}
                modelRotation={{
                  x: model.rotationX ?? 0,
                  y: model.rotationY ?? 0,
                  z: model.rotationZ ?? 0,
                }}
                customManager={model.customManager}
                fileMap={model.fileMap}
                vmdBlobUrls={model.vmdBlobUrls}
                vmdBoneRemap={model.vmdBoneRemap ?? model.umceReport?.motion?.remapTable}
                activeVmdIndex={model.activeVmdIndex ?? 0}
                hasVmdAnimation={
                  Boolean(model.hasVmdAnimation) || (model.vmdBlobUrls?.length ?? 0) > 0
                }
                vmdPlaybackEnabled={model.vmdPlaybackEnabled !== false}
                activeTemplateId={model.activeTemplateId}
                currentFrame={appState.currentFrame}
                playSpeed={appState.playSpeed * (model.motionSpeed ?? 1)}
                timelineKeyframes={model.keyframes}
                animLayers={model.animLayers}
                boneGroups={model.boneGroups}
                timelineLive={getDefaultLiveValues(model.bones, model.morphs)}
                poseHold={model.poseHold ?? null}
                gizmoDraggingRef={isActive ? gizmoDraggingRef : undefined}
                rootGizmoDraggingRef={isActive ? rootGizmoDraggingRef : undefined}
                transformMode={transformMode}
                rootManipulatorActive={
                  isActive && !appState.selectedBoneId && !captureChrome
                }
                onSelectBone={isActive ? (id) => onSelectBone(id) : undefined}
                onSelectRoot={isActive ? onSelectRoot : undefined}
                onBoneTransform={isActive ? onBoneTransform : undefined}
                onModelMove={isActive ? onModelMove : undefined}
                onModelRotate={isActive ? onModelRotate : undefined}
                showBonePickers={showBones && isActive && !isGenericImportedModel(model)}
                onAnimationLoaded={
                  onModelAnimationLoaded
                    ? (frameCount) => onModelAnimationLoaded(model.id, frameCount)
                    : undefined
                }
                characterQuality={modelCharacterQuality}
                viewportFormat={viewportFormat}
                mmdLite={mmdLite}
                materialDetailing={
                  !liteRender && appState.visualFx.materialDetailing !== false
                }
                materialSmoothing={appState.visualFx.materialSmoothing ?? 0.55}
                autoLuminousLevel={appState.styleGallery?.autoLuminousLevel ?? 'auto'}
                hiddenMaterialNames={appState.styleGallery?.hiddenMaterials ?? []}
                soloMaterialName={appState.styleGallery?.soloMaterial ?? null}
                renderMode={postFx.renderMode ?? 'pbr_cinematic'}
                onModelReady={
                  model.id === appState.selectedObjectId ? onModelReady : undefined
                }
                hideStagingChrome={captureChrome}
                highlightMaterialName={
                  isActive ? highlightMaterialName : null
                }
                onPmxMetadata={
                  isActive && onPmxMetadataLoaded
                    ? (meta, skMesh) => onPmxMetadataLoaded(model.id, meta, skMesh)
                    : undefined
                }
                apisProfile={model.apisReport?.profile ?? null}
                onApisReportUpdate={
                  onApisReportUpdate
                    ? (patch) => onApisReportUpdate(model.id, patch)
                    : undefined
                }
              />
            );
          })}

        {showCameraHelper && (
          <mesh position={[0, 14, -6]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.8, 0.8, 1.2]} />
            <meshBasicMaterial color="#ec4899" wireframe />
          </mesh>
        )}
        {appState.vcs?.showSafeVolumeGizmo && vcsProfile ? (
          <mesh position={vcsProfile.centerOfMass}>
            <sphereGeometry
              args={[vcsProfile.safeCameraRadius, 24, 16]}
            />
            <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.35} />
          </mesh>
        ) : null}
      </group>

      <MMDCameraController
        cameraMode={appState.cameraMode}
        cameraFraming={cameraFraming}
        followModelId={appState.selectedObjectId}
        autoFocus={appState.cameraStudio.autoFocus !== false}
        manualCameraLock={Boolean(appState.cameraStudio.manualCameraLock)}
        cameraTrackEditing={cameraTrackEditing}
        focusTarget={appState.cameraStudio.focusTarget}
        cameraOrbitAnchor={appState.cameraOrbitAnchor ?? [0, 10, 0]}
        currentFrame={appState.currentFrame}
        isPlaying={appState.isPlaying}
        playSpeed={appState.playSpeed}
        cameraKeyframes={appState.cameraKeyframes}
        cameraVmdBlobUrl={appState.cameraVmdBlobUrl}
        hasCameraVmd={appState.hasCameraVmd}
        onCaptureReady={onCaptureCameraReady}
        onFlyToReady={onFlyToCameraReady}
        cinematicHandheld={vcsHandheld}
        cinematicCollision={vcsCollision}
        vcsSafeCamera={vcsActive && appState.vcs?.safeCamera !== false}
        vcsProfile={vcsProfile}
        cinematicEvalOpts={(() => {
          const rcs = appState.referenceCamera ?? DEFAULT_REFERENCE_CAMERA;
          return {
            constraints: rcs.constraints,
            framing: rcs.framingMode,
            minDistance: rcs.minDistance,
            maxDistance: rcs.maxDistance,
            viewportFormat: rcs.portraitKeepInFrame ? viewportFormat : undefined,
            subject: (appState.cameraOrbitAnchor ?? [0, 10, 0]) as [number, number, number],
            subjectHeight: 16,
            stabilizeMotion: rcs.stabilizeMotion,
          };
        })()}
      />

      <CameraDirectGizmo
        enabled={
          appState.cameraMode === 'free' &&
          appState.cameraStudio.directPlacement !== false &&
          // Hide in offline HQ frames; keep during Live so the user can drag.
          !(isRecordingCapture() && !recordingCaptureState.interactive)
        }
      />

      {!captureChrome && (appState.referenceCamera ?? DEFAULT_REFERENCE_CAMERA).showPath !== false && (
        <CameraPathVisualization
          keyframes={appState.cameraKeyframes}
          currentFrame={appState.currentFrame}
          showPath={(appState.referenceCamera ?? DEFAULT_REFERENCE_CAMERA).showPath}
          showFrustum={(appState.referenceCamera ?? DEFAULT_REFERENCE_CAMERA).showFrustum}
          showGhosts={(appState.referenceCamera ?? DEFAULT_REFERENCE_CAMERA).showGhosts}
        />
      )}

      <StageAutoFollow
        enabled={
          appState.cameraMode === 'free' &&
          appState.cameraStudio.autoFocus !== false &&
          !appState.cameraStudio.manualCameraLock
        }
        cameraMode={appState.cameraMode}
        framing={cameraFraming}
        followModelId={appState.selectedObjectId}
        viewportFormat={viewportFormat}
      />

      {shotComposer ? (
        <ShotComposerViewportLayer
          mode={shotComposer.mode}
          stageModel={shotComposer.stageModel}
          floorYOverride={shotComposer.floorYOverride}
          characterHeight={shotComposer.characterHeight}
          ghostHit={shotComposer.ghostHit}
          onGhostHit={shotComposer.onGhostHit}
          onConfirmPlace={shotComposer.onConfirmPlace}
          onCancel={shotComposer.onCancel}
          onEnvAnalyzed={shotComposer.onEnvAnalyzed}
        />
      ) : null}

      <AnimeNprBridge appState={appState} />

      {canvasHostRef ? (
        <PathTracerBridge
          appState={appState}
          containerRef={canvasHostRef}
          pathTracerCanvasRef={pathTracerCanvasRef}
          sceneBusy={sceneBusy}
          modelSettleUntil={modelSettleUntil}
        />
      ) : null}
    </>
  );
}

export type TransformMode = 'translate' | 'rotate';

interface ViewportProps {
  appState: AppState;
  mmdLite: MmdLiteConfig;
  sceneHdr?: SceneHdrSettings;
  onHdrFileDrop?: (blobUrl: string, fileName: string) => void;
  onLutFileDrop?: (blobUrl: string, fileName: string) => void;
  viewportFormat?: ViewportFormat;
  onViewportFormatChange?: (format: ViewportFormat) => void;
  onSetCurrentFrame?: (frame: number) => void;
  showGrid: boolean;
  showBones: boolean;
  showCameraHelper: boolean;
  showPhysicsBodies: boolean;
  transformMode?: TransformMode;
  onTransformModeChange?: (mode: TransformMode) => void;
  onSelectBone: (id: string | null) => void;
  onSelectRoot?: () => void;
  onBoneTransform?: (modelId: string, boneId: string, update: BoneTransformUpdate) => void;
  onModelMove?: (modelId: string, x: number, y: number, z: number) => void;
  onModelRotate?: (modelId: string, x: number, y: number, z: number) => void;
  onLoadCustomModel?: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  onAttachVmd?: (modelId: string, vmd: ProcessedVmdFiles) => void;
  attachVmdTargetModelId?: string | null;
  captureCameraRef?: React.MutableRefObject<(() => CameraSnapshot | null) | null>;
  flyToCameraRef?: React.MutableRefObject<((snapshot: CameraSnapshot) => void) | null>;
  modelApiRef?: React.MutableRefObject<import('./MMDModelWrapper').MMDModelApi | null>;
  onSetCameraMode?: (mode: AppState['cameraMode']) => void;
  onEnterDirectCameraMode?: () => void;
  cineStudioPanel?: React.ReactNode;
  referenceCameraStudioPanel?: React.ReactNode;
  onSelectTimelineTrack?: (track: AppState['timelineActiveTrack']) => void;
  onRegisterCameraKeyframe?: () => void;
  onPatchCameraStudio?: (patch: Partial<AppState['cameraStudio']>) => void;
  onModelAnimationLoaded?: (modelId: string, frameCount: number) => void;
  onApplyAnimationTemplate?: (
    templateId: string,
    mode?: TemplateApplyMode,
    options?: TemplateApplyOptions
  ) => void;
  onSetIsPlaying?: (playing: boolean) => void;
  sceneBackground?: SceneBackgroundSettings;
  onPatchSceneBackground?: (patch: Partial<SceneBackgroundSettings>) => void;
  onClearSceneBackground?: () => void;
  isRecordingVideo?: boolean;
  onRecordingTick?: () => void;
  onGlCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onCaptureFrameReady?: (capture: () => string | null) => void;
  onInvalidateReady?: (invalidate: () => void) => void;
  highlightMaterialName?: string | null;
  onPmxMetadataLoaded?: (
    modelId: string,
    meta: {
      bones: import('../types').PmxBoneInfo[];
      morphs: import('../types').PmxMorphInfo[];
      materials: import('../types').PmxMaterialInfo[];
    },
    mesh: import('three').SkinnedMesh
  ) => void;
  onApisReportUpdate?: (modelId: string, patch: Partial<import('../apis').ApisReport>) => void;
  /** Empty viewport — load featured demo. */
  onTryDemo?: () => void;
  /** Guided first-video wizard. */
  onCreateFirstVideo?: () => void;
  /** Advance dynamic sky clock (hours 0–24). */
  onDynamicSkyTick?: (nextHours: number) => void;
  /** RP4 Smart Render — viewport-only quality patch (never during export). */
  onSmartViewportPatch?: (patch: Partial<AppState>) => void;
  onSceneFxRuntimeError?: (instanceId: string, message: string) => void;
  shotComposer?: SceneContentProps['shotComposer'];
  shotGuides?: CompositionGuideId[];
}

export default function Viewport({
  appState,
  mmdLite,
  sceneHdr = { blobUrl: null, intensity: 1, showBackground: false },
  onHdrFileDrop,
  onLutFileDrop,
  viewportFormat = '16:9',
  onViewportFormatChange,
  showGrid,
  showBones,
  showCameraHelper,
  showPhysicsBodies,
  transformMode: transformModeProp,
  onTransformModeChange,
  onSelectBone,
  onSelectRoot,
  onBoneTransform,
  onModelMove,
  onModelRotate,
  onLoadCustomModel,
  onAttachVmd,
  attachVmdTargetModelId = null,
  captureCameraRef,
  flyToCameraRef,
  modelApiRef,
  onSetCameraMode,
  onEnterDirectCameraMode,
  cineStudioPanel,
  referenceCameraStudioPanel,
  onSelectTimelineTrack,
  onRegisterCameraKeyframe,
  onPatchCameraStudio,
  onModelAnimationLoaded,
  onApplyAnimationTemplate,
  onSetIsPlaying,
  onSetCurrentFrame,
  sceneBackground = { imageUrl: null, opacity: 1 },
  onPatchSceneBackground,
  onClearSceneBackground,
  isRecordingVideo = false,
  onRecordingTick,
  onGlCanvasReady,
  onCaptureFrameReady,
  onInvalidateReady,
  highlightMaterialName = null,
  onPmxMetadataLoaded,
  onApisReportUpdate,
  onTryDemo,
  onCreateFirstVideo,
  onDynamicSkyTick,
  onSmartViewportPatch,
  onSceneFxRuntimeError,
  shotComposer,
  shotGuides,
}: ViewportProps) {
  const characterQuality = appState.characterQuality;
  const captureChrome = isRecordingVideo || isRecordingCapture();
  const cinemaCapture = isCinemaRenderCapture();
  // Cinema Render unlocks full quality even on portrait — no lite path during export.
  const portraitLite = isPortraitFormat(viewportFormat) && !cinemaCapture;
  const [graphicsEpoch, setGraphicsEpoch] = useState(() => getGraphicsEpoch());
  const [gpuSuspended, setGpuSuspended] = useState(() => isGpuSuspended());
  const [gpuBlocked, setGpuBlocked] = useState(() => isWebGlContextBlocked());
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const pathTracerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasHostReady, setCanvasHostReady] = useState(false);

  useLayoutEffect(() => {
    setCanvasHostReady(Boolean(canvasHostRef.current));
  }, [graphicsEpoch, gpuSuspended, gpuBlocked]);

  useEffect(() => {
    return subscribeGraphicsSystem(() => {
      setGraphicsEpoch(getGraphicsEpoch());
      setGpuSuspended(isGpuSuspended());
      setGpuBlocked(isWebGlContextBlocked());
    });
  }, []);

  useEffect(() => {
    setWebGlContextLostListener(() => {
      setGpuSuspended(true);
    });
    return () => setWebGlContextLostListener(null);
  }, []);

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const msg = String(
        (event.reason as Error | undefined)?.message ?? event.reason ?? ''
      );
      if (/webgl context/i.test(msg) || /creating webgl/i.test(msg)) {
        markWebGlContextCreationFailed();
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  const [isHovering, setIsHovering] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [perfStats, setPerfStats] = useState<ViewportPerfSnapshot>({
    fps: '—',
    frameMs: '—',
    cpuMs: '—',
    gpuMs: '—',
    perfLevel: '—',
    status: '—',
    tris: '0',
    autoScale: '100%',
  });
  const [internalTransformMode, setInternalTransformMode] = useState<TransformMode>('rotate');
  const gizmoDraggingRef = useRef(false);
  const rootGizmoDraggingRef = useRef(false);

  const transformMode = transformModeProp ?? internalTransformMode;
  const setTransformMode = onTransformModeChange ?? setInternalTransformMode;

  const cameraTrackEditing =
    appState.cameraMode === 'mmd' &&
    !appState.isPlaying &&
    !appState.hasCameraVmd &&
    appState.timelineActiveTrack === 'camera';

  const manualMmdCameraHintKey =
    appState.cameraMode === 'mmd' && appState.cameraStudio.manualCameraLock
      ? 'manual-mmd-camera'
      : null;
  const mmdTemplateHintKey =
    appState.cameraMode === 'mmd' &&
    !appState.cameraStudio.manualCameraLock &&
    !appState.hasCameraVmd &&
    appState.cameraKeyframes.length === 0
      ? 'mmd-template-hint'
      : null;
  const showManualMmdCameraHint = useAutoDismiss(manualMmdCameraHintKey);
  const showMmdTemplateHint = useAutoDismiss(mmdTemplateHintKey);

  const activeModel = appState.models.find((m) => m.id === appState.selectedObjectId);
  const manualTemplateCameraHintKey =
    appState.cameraMode === 'mmd' &&
    cameraTrackEditing &&
    appState.cameraKeyframes.length === 0 &&
    activeModel?.activeTemplateId &&
    templateHasCamera(activeModel.activeTemplateId)
      ? 'manual-template-camera'
      : null;
  const cameraEditHintKey = cameraTrackEditing ? 'mmd-camera-edit' : null;
  const showCameraEditHint = useAutoDismiss(cameraEditHintKey);
  const showManualTemplateCameraHint = useAutoDismiss(manualTemplateCameraHintKey);

  const cameraDirectHintKey =
    appState.cameraMode === 'free' &&
    appState.cameraStudio.directPlacement !== false &&
    !captureChrome
      ? 'camera-direct-gizmo'
      : null;
  const showCameraDirectHint = useAutoDismiss(cameraDirectHintKey, 4000);
  const [cameraDirectHintDismissed, setCameraDirectHintDismissed] = useState(false);
  useEffect(() => {
    if (!cameraDirectHintKey) setCameraDirectHintDismissed(false);
  }, [cameraDirectHintKey]);
  const cameraDirectHintVisible =
    showCameraDirectHint && !cameraDirectHintDismissed && Boolean(cameraDirectHintKey);

  const rootMarkerHintKey =
    activeModel && !appState.selectedBoneId && !captureChrome
      ? `root-marker-${activeModel.id}`
      : null;
  const showRootMarkerHint = useAutoDismiss(rootMarkerHintKey, 3500);

  const enterMmdCameraEdit = useCallback(() => {
    onSetCameraMode?.('mmd');
    if (!appState.hasCameraVmd) {
      onSelectTimelineTrack?.('camera');
      onPatchCameraStudio?.({ manualCameraLock: false, autoFocus: false });
    }
  }, [appState.hasCameraVmd, onSetCameraMode, onSelectTimelineTrack, onPatchCameraStudio]);
  const cisReadyKey =
    activeModel?.cisReport &&
    (activeModel.cisReport.status === 'ready' || activeModel.cisReport.status === 'cached')
      ? `cis-${activeModel.id}-${activeModel.cisReport.profile?.fingerprint.combined ?? 'ready'}`
      : null;
  const showCisReadyCard = useAutoDismiss(cisReadyKey);
  const [cisCardDismissed, setCisCardDismissed] = useState<string | null>(null);
  const visibleModels = appState.models.filter((m) => m.visible);
  const stagingLabel =
    activeModel?.name ??
    (visibleModels.length === 1
      ? `${visibleModels[0].name} (click model in Scene to edit)`
      : visibleModels.length > 1
        ? `${visibleModels.length} models loaded`
        : null);
  const { isProMobile } = useStudioLayout();
  const hasModel = appState.models.length > 0;
  const [emptyHintDismissed, setEmptyHintDismissed] = useState(
    () =>
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('animastage-empty-hint-dismissed') === '1'
  );
  const dismissEmptyHint = useCallback(() => {
    try {
      sessionStorage.setItem('animastage-empty-hint-dismissed', '1');
    } catch {
      /* ignore */
    }
    setEmptyHintDismissed(true);
  }, []);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsHovering(false);
      if (!e.dataTransfer || !onLoadCustomModel) return;

      setLoadingMsg('Processing files...');
      try {
        const files = await getFilesAsync(e.dataTransfer);
        if (files.length === 0) {
          setLoadingMsg('');
          return;
        }

        if (files.length === 1 && onLutFileDrop) {
          const lutOnly = files[0]!;
          if (detectLutFileKind(lutOnly.name)) {
            onLutFileDrop(URL.createObjectURL(lutOnly), lutOnly.name);
            setLoadingMsg('');
            return;
          }
        }

        const result = await processImportedAssets(files, (msg) => setLoadingMsg(msg));
        if ('error' in result) {
          alert(result.error);
          setLoadingMsg('');
          return;
        }

        if (result.kind === 'hdr_only') {
          if (onHdrFileDrop && result.hdrFiles[0]) {
            const hdr = result.hdrFiles[0];
            onHdrFileDrop(URL.createObjectURL(hdr), hdr.name);
          }
          setLoadingMsg('');
          return;
        }

        if (result.kind === 'vmd_only') {
          if (!onAttachVmd) {
            alert('Motion import is not available in this view.');
            setLoadingMsg('');
            return;
          }
          if (!attachVmdTargetModelId) {
            alert('Motion-only ZIP (.vmd). Load a .pmx/.pmd model first, then drop the ZIP again.');
            setLoadingMsg('');
            return;
          }
          onAttachVmd(attachVmdTargetModelId, result.vmd);
          setLoadingMsg('');
          return;
        }

        if (result.kind === 'style_pack') {
          alert(
            'This is a shader / style pack. Open FX → Visual Style → import folder or ZIP.'
          );
          setLoadingMsg('');
          return;
        }

        if (result.hdrFiles[0] && onHdrFileDrop) {
          const hdr = result.hdrFiles[0];
          onHdrFileDrop(URL.createObjectURL(hdr), hdr.name);
        }

        if (result.skippedFormats.length > 0) {
          console.warn(
            '[Import] Skipped non-character meshes (use .pmx/.pmd/.fbx for characters):',
            result.skippedFormats.join(', ')
          );
        }

        setLoadingMsg(
          result.models.length > 1
            ? `Loading ${result.models.length} characters…`
            : 'Loading model…'
        );
        onLoadCustomModel(result.models);
        setLoadingMsg('');
      } catch (err) {
        console.error('Error reading dropped files', err);
        setLoadingMsg('');
      }
    },
    [onLoadCustomModel, onHdrFileDrop, onLutFileDrop, onAttachVmd, attachVmdTargetModelId]
  );

  const handleBoneTransform = useCallback(
    (boneId: string, update: BoneTransformUpdate) => {
      if (!activeModel?.id) return;

      const matchedBone = activeModel.bones.find(
        (b) =>
          b.id === boneId ||
          b.id.toLowerCase() === boneId.toLowerCase() ||
          b.name === boneId
      );
      const resolvedBoneId = matchedBone?.id ?? boneId;

      onBoneTransform?.(activeModel.id, resolvedBoneId, update);
    },
    [activeModel, onBoneTransform]
  );

  const handleModelMove = useCallback(
    (x: number, y: number, z: number) => {
      if (!activeModel?.id) return;
      onModelMove?.(activeModel.id, x, y, z);
    },
    [activeModel, onModelMove]
  );

  const handleModelRotate = useCallback(
    (x: number, y: number, z: number) => {
      if (!activeModel?.id) return;
      onModelRotate?.(activeModel.id, x, y, z);
    },
    [activeModel, onModelRotate]
  );

  const handleSelectRoot = useCallback(() => {
    onSelectRoot?.();
    onSelectBone(null);
  }, [onSelectRoot, onSelectBone]);

  const handleCaptureCameraReady = useCallback(
    (capture: () => CameraSnapshot | null) => {
      if (captureCameraRef) {
        captureCameraRef.current = capture;
      }
    },
    [captureCameraRef]
  );

  const handleFlyToCameraReady = useCallback(
    (fly: (snapshot: CameraSnapshot) => void) => {
      if (flyToCameraRef) {
        flyToCameraRef.current = fly;
      }
    },
    [flyToCameraRef]
  );

  const handleModelReady = useCallback(
    (api: import('./MMDModelWrapper').MMDModelApi | null) => {
      if (modelApiRef) {
        modelApiRef.current = api;
      }
    },
    [modelApiRef]
  );

  return (
    <div
      className="flex-1 min-h-0 h-full bg-[#0d0e11] relative flex flex-col items-stretch overflow-hidden"
      id="mmd-viewport"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="vp-desktop-chrome absolute top-2 left-2 md:top-4 md:left-4 z-10 pointer-events-none select-none font-sans px-2 py-1.5 md:px-3.5 md:py-2.5 bg-[#121418]/85 text-zinc-150 border border-zinc-800 rounded-md shadow-lg backdrop-blur-md flex items-center gap-2 md:gap-3 max-w-[calc(100%-5rem)]">
        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#ff3385] rounded-full animate-pulse shadow-[0_0_8px_#ff3385] shrink-0" />
        <div className="min-w-0 truncate">
          <span className="hidden md:block text-[9px] uppercase font-mono tracking-widest text-zinc-500 font-extrabold">
            3D Viewport
          </span>
          <span className="text-[10px] md:text-xs text-[#39c5bb] font-bold truncate block">
            {stagingLabel ? `${stagingLabel}` : 'Scene'}
          </span>
        </div>
      </div>

      <div className="vp-desktop-chrome absolute top-2 right-2 md:top-4 md:right-4 z-10 font-mono text-[8px] md:text-[9px] flex items-center gap-1 md:gap-2 pointer-events-auto select-none flex-wrap justify-end max-w-[min(100%,calc(100%-6rem))]">
        {onPatchSceneBackground && onClearSceneBackground && (
          <SceneBackgroundPicker
            background={sceneBackground}
            onChange={onPatchSceneBackground}
            onClear={onClearSceneBackground}
          />
        )}
        {activeModel && onApplyAnimationTemplate && (
          <AnimationTemplateSelector
            activeTemplateId={activeModel.activeTemplateId}
            onSelect={(templateId, mode, options) =>
              onApplyAnimationTemplate(templateId, mode ?? 'replace', options)
            }
          />
        )}
        {onViewportFormatChange && (
          <AspectFormatToggle
            format={viewportFormat}
            onChange={onViewportFormatChange}
          />
        )}
        <div className="flex items-center bg-[#121418]/85 border border-zinc-800 rounded-md overflow-hidden shadow-md backdrop-blur-sm">
          <button
            type="button"
            onClick={() => onEnterDirectCameraMode?.() ?? onSetCameraMode?.('free')}
            className={`px-1.5 py-0.5 md:px-2.5 md:py-1 flex items-center gap-0.5 md:gap-1 font-bold uppercase tracking-wide transition-colors cursor-pointer ${
              appState.cameraMode === 'free' && appState.cameraStudio.directPlacement !== false
                ? 'bg-[#39c5bb]/20 text-[#39c5bb]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Ручная камера — перетаскивай голубой маркер как персонажа, ЛКМ орбита, колесо зум"
          >
            <Move className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span className="hidden sm:inline">Move Cam</span>
          </button>
          <button
            type="button"
            onClick={() => onSetCameraMode?.('free')}
            className={`hidden sm:flex px-2 py-1 items-center gap-1 font-bold uppercase tracking-wide transition-colors cursor-pointer border-l border-zinc-800 text-[9px] ${
              appState.cameraMode === 'free'
                ? 'text-zinc-500'
                : 'text-zinc-600 hover:text-zinc-400'
            }`}
            title="Free orbit only"
          >
            Orbit
          </button>
          <button
            type="button"
            onClick={enterMmdCameraEdit}
            className={`px-1.5 py-0.5 md:px-2.5 md:py-1 flex items-center gap-0.5 md:gap-1 font-bold uppercase tracking-wide transition-colors cursor-pointer border-l border-zinc-800 ${
              appState.cameraMode === 'mmd'
                ? 'bg-[#e879ff]/20 text-[#e879ff]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="MMD camera — keyframe path or VMD track"
          >
            <FilmIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span className="hidden sm:inline">MMD</span>
          </button>
          {appState.cameraMode === 'mmd' && !appState.hasCameraVmd && onSelectTimelineTrack && (
            <button
              type="button"
              onClick={enterMmdCameraEdit}
              className={`px-1.5 py-0.5 md:px-2 border-l border-zinc-800 flex items-center gap-0.5 font-bold uppercase tracking-wide cursor-pointer text-[9px] ${
                cameraTrackEditing
                  ? 'text-violet-200 bg-violet-950/50'
                  : 'text-zinc-500 hover:text-violet-300'
              }`}
              title="Edit camera path — orbit on each frame and save keys"
            >
              <CameraIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
          {cameraTrackEditing && onRegisterCameraKeyframe && !appState.isPlaying && (
            <button
              type="button"
              onClick={onRegisterCameraKeyframe}
              className="px-1.5 py-0.5 md:px-2 border-l border-zinc-800 flex items-center gap-0.5 font-bold uppercase tracking-wide cursor-pointer text-teal-300 bg-teal-950/30 text-[9px]"
              title={`Save camera position at frame ${appState.currentFrame}`}
            >
              <Key className="w-2.5 h-2.5 md:w-3 md:h-3" />
              <span className="hidden sm:inline">Key</span>
            </button>
          )}
          {appState.cameraMode === 'mmd' && onPatchCameraStudio && appState.isPlaying && (
            <button
              type="button"
              onClick={() => {
                const next = !appState.cameraStudio.manualCameraLock;
                onPatchCameraStudio({
                  manualCameraLock: next,
                  autoFocus: next ? false : true,
                });
              }}
              className={`px-1.5 py-0.5 md:px-2 border-l border-zinc-800 flex items-center gap-0.5 font-bold uppercase tracking-wide cursor-pointer ${
                appState.cameraStudio.manualCameraLock
                  ? 'text-amber-300 bg-amber-950/40'
                  : 'text-zinc-500 hover:text-amber-300'
              }`}
              title="Lock manual orbit during MMD playback"
            >
              {appState.cameraStudio.manualCameraLock ? (
                <Unlock className="w-2.5 h-2.5 md:w-3 md:h-3" />
              ) : (
                <Lock className="w-2.5 h-2.5 md:w-3 md:h-3" />
              )}
              <span className="hidden sm:inline">Manual</span>
            </button>
          )}
        </div>
        {appState.isPlaying && (
          <span className="hidden sm:flex bg-red-950/80 border border-red-500/50 text-[#ff4444] font-extrabold px-2 py-0.5 md:px-2.5 md:py-1 uppercase tracking-widest items-center gap-1.5 rounded-md backdrop-blur-sm shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            PLAYING
          </span>
        )}
        <span className="bg-[#121418]/85 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 md:px-3 md:py-1 font-bold rounded-md backdrop-blur-sm shadow-md">
          <span className="hidden sm:inline">Frame: </span>
          <span className="text-[#39c5bb] font-bold">{appState.currentFrame}</span>
        </span>
      </div>

      {appState.visualFx.bloomEnabled && (
        <div className="absolute top-16 left-4 z-10 hidden md:block bg-[#e879ff]/15 border border-[#e879ff]/40 text-[#f0d0ff] text-[10px] font-bold px-3 py-1.5 rounded-md shadow-lg pointer-events-none">
          Bloom FX active
        </div>
      )}

      {showCisReadyCard &&
      cisReadyKey &&
      cisCardDismissed !== cisReadyKey &&
      activeModel?.cisReport?.userSummary &&
      !captureChrome ? (
        <div className="absolute bottom-24 left-4 z-20 pointer-events-auto">
          <CisImportReadyCard
            summary={activeModel.cisReport.userSummary}
            onDismiss={() => setCisCardDismissed(cisReadyKey)}
          />
        </div>
      ) : null}

      {showCameraEditHint && (
        <div className="vp-desktop-hint absolute top-28 right-4 z-10 max-w-xs bg-violet-950/85 border border-violet-500/40 text-violet-100 text-[10px] font-bold px-3 py-2 rounded-md shadow-lg pointer-events-none">
          MMD camera edit — drag to orbit, press <span className="text-white">Key</span> to save this
          frame. Scrub timeline and repeat to build your camera path.
        </div>
      )}
      {showManualTemplateCameraHint && (
        <div className="vp-desktop-hint absolute top-28 right-4 z-10 max-w-xs bg-amber-950/85 border border-amber-500/40 text-amber-100 text-[10px] font-bold px-3 py-2 rounded-md shadow-lg pointer-events-none">
          Motion only — use <span className="text-white">Edit</span> + <span className="text-white">Key</span>{' '}
          to place camera keyframes on the MMD path.
        </div>
      )}
      {showManualMmdCameraHint && (
        <div className="vp-desktop-hint absolute top-16 right-4 z-10 max-w-xs bg-amber-950/80 border border-amber-500/40 text-amber-100 text-[10px] font-bold px-3 py-2 rounded-md shadow-lg pointer-events-none">
          Manual orbit during playback — turn off Manual to follow saved camera keys.
        </div>
      )}
      {showMmdTemplateHint && (
        <div className="vp-desktop-hint absolute top-16 right-4 z-10 hidden md:block max-w-xs bg-[#e879ff]/15 border border-[#e879ff]/40 text-[#f0d0ff] text-[10px] font-bold px-3 py-2 rounded-md shadow-lg pointer-events-none">
          MMD camera: click <span className="text-white">Edit</span> to place your own path, or apply a
          combo template with template camera.
        </div>
      )}

      {activeModel && !captureChrome && (
        <div className="vp-bone-hud absolute top-20 max-md:top-auto max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 md:gap-1 bg-[#121418]/90 border border-zinc-800 rounded-lg p-0.5 md:p-1 shadow-lg backdrop-blur-md pointer-events-auto">
          <button
            type="button"
            onClick={() => setTransformMode('translate')}
            className={`flex items-center gap-1 px-2 py-1 md:gap-1.5 md:px-3 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer ${
              transformMode === 'translate'
                ? 'bg-[#39c5bb]/20 text-[#39c5bb] border border-[#39c5bb]/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            Move
          </button>
          <button
            type="button"
            onClick={() => setTransformMode('rotate')}
            className={`flex items-center gap-1 px-2 py-1 md:gap-1.5 md:px-3 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer ${
              transformMode === 'rotate'
                ? 'bg-[#39c5bb]/20 text-[#39c5bb] border border-[#39c5bb]/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            Rotate
          </button>
        </div>
      )}

      {showRootMarkerHint && activeModel && !appState.selectedBoneId && !captureChrome && (
        <div className="vp-desktop-hint absolute top-32 max-md:top-auto max-md:bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-20 hidden sm:block max-w-[90vw] bg-[#121418]/90 border border-[#9d27ff]/40 rounded-lg px-3 py-1.5 md:px-4 md:py-2 shadow-lg backdrop-blur-md pointer-events-none">
          <span className="text-[10px] font-bold uppercase text-[#e879ff] tracking-wider">
            {transformMode === 'rotate'
              ? 'Root — drag rings to turn the character toward the camera / scene'
              : 'Root Marker — drag purple ring or axis arrows to move model'}
          </span>
        </div>
      )}

      {cameraDirectHintVisible && (
        <div className="vp-desktop-hint absolute top-20 max-md:top-auto max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-20 max-w-[92vw] bg-[#121418]/90 border border-cyan-500/40 rounded-lg px-3 py-1.5 md:px-4 md:py-2 shadow-lg backdrop-blur-md flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-cyan-300 tracking-wider text-center block">
            Camera — cyan diamond = move cam · pink sphere = look-at · LMB orbit · wheel zoom
          </span>
          <button
            type="button"
            aria-label="Dismiss camera hint"
            onClick={() => setCameraDirectHintDismissed(true)}
            className="shrink-0 text-cyan-400/80 hover:text-cyan-200 text-[12px] leading-none px-1 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      <LetterboxOverlay enabled={appState.visualFx.letterbox239 === true} />

      {!captureChrome && (
        <>
          <CompositionGuidesOverlay
            guide={(appState.referenceCamera ?? DEFAULT_REFERENCE_CAMERA).compositionGuide}
          />
          <ReferenceModeOverlay
            rcs={appState.referenceCamera ?? DEFAULT_REFERENCE_CAMERA}
            currentFrame={appState.currentFrame}
            playSpeed={appState.playSpeed}
            isPlaying={appState.isPlaying}
          />
          {shotGuides && shotGuides.length > 0 ? (
            <ShotComposerGuidesOverlay guides={shotGuides} aspectLabel={viewportFormat} />
          ) : null}
        </>
      )}

      <div className="studio-viewport-stage flex-1 min-h-0 flex flex-col w-full">
      <ViewportCanvasShell format={viewportFormat}>
      <div ref={canvasHostRef} className="w-full h-full min-h-0">
      {!gpuSuspended && !gpuBlocked && canvasHostReady ? (
      <ViewportWebGlBoundary resetKey={graphicsEpoch}>
      <Canvas
        key={graphicsEpoch}
        eventSource={canvasHostRef as React.RefObject<HTMLElement>}
        frameloop={
          resolveNeedsContinuousRender({
            isPlaying: appState.isPlaying,
            isRecordingVideo,
            physicsMode: appState.physicsMode,
            visibleModelCount: countVisibleModels(appState.models),
          })
            ? 'always'
            : 'demand'
        }
        shadows={portraitLite ? false : { type: THREE.PCFShadowMap }}
        gl={{
          antialias: !portraitLite,
          logarithmicDepthBuffer: !portraitLite,
          powerPreference: portraitLite ? 'default' : 'high-performance',
          alpha: false,
          stencil: false,
          depth: true,
          // preserveDrawingBuffer increases memory pressure and can cause context loss during 1080×1920 capture.
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl }) => {
          recordWebGlContextCreated();
          onGlCanvasReady?.(gl.domElement);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.enabled = !portraitLite || isCinemaRenderCapture();
          if (!portraitLite || isCinemaRenderCapture()) {
            gl.shadowMap.type =
              appState.cinematicRender?.softShadows === false
                ? THREE.PCFShadowMap
                : THREE.PCFSoftShadowMap;
          }
          gl.setPixelRatio(
            portraitLite && !isCinemaRenderCapture()
              ? 1
              : Math.min(window.devicePixelRatio || 1, 2)
          );
          setCaptureRenderer(gl as unknown);
        }}
        camera={{ position: [0, 12, 36], fov: 42, near: 0.1, far: 2000 }}
        className="w-full h-full block"
        dpr={
          cinemaCapture
            ? Math.max(2, recordingCaptureState.maxDpr)
            : isInteractiveRecordingCapture()
              ? (() => {
                  const spec = resolveEffectiveCanvasDpr(characterQuality, viewportFormat);
                  const base = typeof spec === 'number' ? spec : spec[1];
                  return Math.min(
                    portraitLite ? 1 : base,
                    recordingCaptureState.maxDpr || 1
                  );
                })()
            : portraitLite
              ? 1
              : resolveEffectiveCanvasDpr(characterQuality, viewportFormat)
        }
      >
        <SceneFrameInvalidate
          demandMode={
            !resolveNeedsContinuousRender({
              isPlaying: appState.isPlaying,
              isRecordingVideo,
              physicsMode: appState.physicsMode,
              visibleModelCount: countVisibleModels(appState.models),
            })
          }
          currentFrame={appState.currentFrame}
          isPlaying={appState.isPlaying}
          cameraMode={appState.cameraMode}
          modelCount={appState.models.length}
          visualFxRevision={appState.visualFx}
        />
        <SceneContent
          appState={appState}
          mmdLite={mmdLite}
          sceneHdr={sceneHdr}
          viewportFormat={viewportFormat}
          characterQuality={characterQuality}
          showGrid={showGrid && !captureChrome}
          showBones={showBones && !captureChrome}
          showCameraHelper={showCameraHelper}
          showPhysicsBodies={showPhysicsBodies}
          transformMode={transformMode}
          gizmoDraggingRef={gizmoDraggingRef}
          rootGizmoDraggingRef={rootGizmoDraggingRef}
          onSelectBone={onSelectBone}
          onSelectRoot={handleSelectRoot}
          onBoneTransform={handleBoneTransform}
          onModelMove={handleModelMove}
          onModelRotate={handleModelRotate}
          onCaptureCameraReady={handleCaptureCameraReady}
          onFlyToCameraReady={handleFlyToCameraReady}
          onModelReady={handleModelReady}
          onModelAnimationLoaded={onModelAnimationLoaded}
          onSetCurrentFrame={onSetCurrentFrame}
          isRecordingVideo={isRecordingVideo}
          onRecordingTick={onRecordingTick}
          onInvalidateReady={onInvalidateReady}
          highlightMaterialName={highlightMaterialName}
          onPmxMetadataLoaded={onPmxMetadataLoaded}
          onApisReportUpdate={onApisReportUpdate}
          onPerfStats={setPerfStats}
          onCaptureFrameReady={onCaptureFrameReady}
          onDynamicSkyTick={onDynamicSkyTick}
          onSmartViewportPatch={onSmartViewportPatch}
          onSceneFxRuntimeError={onSceneFxRuntimeError}
          shotComposer={shotComposer}
          canvasHostRef={canvasHostRef}
          pathTracerCanvasRef={pathTracerCanvasRef}
          sceneBusy={false}
          modelSettleUntil={0}
        />
      </Canvas>
      </ViewportWebGlBoundary>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#0d0e11] text-center px-6">
          <div className="max-w-sm">
            <p className="text-sm font-semibold text-zinc-200">
              {gpuBlocked ? 'WebGL blocked by the browser' : 'Recovering graphics…'}
            </p>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              {gpuBlocked
                ? 'Too many GPU resets were attempted. Refresh this page (F5) to restore the 3D viewport.'
                : 'Freeing GPU memory and restarting the renderer. This takes about a second.'}
            </p>
          </div>
        </div>
      )}
      </div>
      </ViewportCanvasShell>
      </div>

      {cineStudioPanel}
      {referenceCameraStudioPanel}

      {isHovering && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#39c5bb]/10 backdrop-blur-sm border-4 border-dashed border-[#39c5bb] pointer-events-none">
          <div className="bg-[#121418]/95 px-8 py-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-[#39c5bb]/30">
            <Upload className="w-12 h-12 text-[#39c5bb] animate-bounce" />
            <span className="text-xl font-bold text-zinc-100">Drop MMD Files Here</span>
            <p className="text-sm text-zinc-400 text-center max-w-sm">
              .pmx/.pmd/.fbx/.glb/.vrm model + textures in one folder/ZIP (Sketchfab bundle)
            </p>
          </div>
        </div>
      )}

      {loadingMsg && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-gray-900/80 backdrop-blur-md rounded-full px-6 py-3 shadow-lg flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#39c5bb] animate-spin" />
          <span className="text-sm font-medium text-white">{loadingMsg}</span>
        </div>
      )}

      {!isProMobile && !hasModel && !loadingMsg && !isHovering && !emptyHintDismissed ? (
        <ViewportEmptyState
          onTryDemo={onTryDemo}
          onCreateFirstVideo={onCreateFirstVideo}
          onDismiss={dismissEmptyHint}
        />
      ) : null}

      <PerformanceOverlay
        fps={perfStats.fps}
        frameMs={perfStats.frameMs}
        autoScale={perfStats.autoScale}
      />
      <VqDebugHud />

      <div
        className={`absolute z-10 pointer-events-none select-none ds-perf-hud ds-perf-hud--viewport ${
          isProMobile ? 'ds-perf-hud--pro-mobile' : 'bottom-4 right-4'
        } ${
          perfStats.perfLevel === 'Lagging'
            ? 'ds-perf-hud--lagging'
            : perfStats.perfLevel === 'Okay'
              ? 'ds-perf-hud--okay'
              : ''
        }`}
      >
        <div className="ds-perf-hud__row ds-perf-hud__row--primary">
          {isProMobile ? (
            <>
              <span className="ds-perf-hud__value">{perfStats.fps}</span> fps
              <span className="opacity-60 mx-1">·</span>
              <span className="ds-perf-hud__value">{perfStats.frameMs}</span> ms
            </>
          ) : (
            <>
              Frame <span className="ds-perf-hud__value">{perfStats.frameMs}</span> ms
            </>
          )}
        </div>
        {!isProMobile ? (
        <div className="ds-perf-hud__row">
          FPS <span className="ds-perf-hud__value">{perfStats.fps}</span>
          {' · '}
          {perfStats.perfLevel}
        </div>
        ) : null}
        {!isProMobile ? (
        <>
        <div className="ds-perf-hud__row">
          CPU <span className="ds-perf-hud__value">{perfStats.cpuMs}</span> ms
          {' · '}
          GPU <span className="ds-perf-hud__value">{perfStats.gpuMs}</span> ms
        </div>
        <div className="ds-perf-hud__row">
          Status <span className="ds-perf-hud__value">{perfStats.status}</span>
        </div>
        </>
        ) : null}
        {DEBUG_UI && !isProMobile && (
          <div className="ds-perf-hud__row ds-perf-hud__row--debug">
            Tris <span className="ds-perf-hud__value">{perfStats.tris}</span>
            {' · '}
            Auto <span className="ds-perf-hud__value">{perfStats.autoScale}</span>
          </div>
        )}
      </div>

      {DEBUG_UI && (
      <div className="absolute bottom-4 left-4 z-10 font-mono text-[9px] text-[#39c5bb]/90 bg-[#121418]/85 border border-zinc-800 py-1.5 px-3 pointer-events-none select-none shadow-md rounded-md backdrop-blur-sm max-w-[min(100%,calc(100%-8rem))]">
        <span>
          {activeModel && !appState.selectedBoneId ? (
            <>
              ROOT:{' '}
              <span className="text-[#e879ff] font-bold">
                X {activeModel.positionX.toFixed(2)} Y {activeModel.positionY.toFixed(2)} Z{' '}
                {activeModel.positionZ.toFixed(2)}
              </span>
            </>
          ) : (
            <>
              GIZMO:{' '}
              <span className="text-[#4ade80] font-bold">{transformMode.toUpperCase()}</span>
            </>
          )}
          {' | '}
          PHYSICS:{' '}
          <span className="text-[#4ade80] font-bold">{appState.physicsMode.toUpperCase()}</span>
          {viewportFormat === '9:16' && (
            <>
              {' | '}
              <span className="text-[#ff6ba8] font-bold">9:16</span>
            </>
          )}
        </span>
      </div>
      )}
    </div>
  );
}
