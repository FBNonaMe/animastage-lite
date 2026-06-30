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
} from 'lucide-react';
import * as THREE from 'three';
import { OutlineEffect } from 'three-stdlib';
import { AppState, CameraSnapshot, VisualFxSettings } from '../types';
import MMDModelWrapper, { BoneTransformUpdate } from './MMDModelWrapper';
import MMDCameraController from './MMDCameraController';
import ScenePostProcessing from './ScenePostProcessing';
import ViewportCanvasShell from './ViewportCanvasShell';
import PortraitCameraFraming from './PortraitCameraFraming';
import MmdWeatherPrecip from './MmdWeatherPrecip';
import GodRaySun from './GodRaySun';
import SceneHdrEnvironment from './SceneHdrEnvironment';
import AspectFormatToggle from './AspectFormatToggle';
import AnimationTemplateSelector from './AnimationTemplateSelector';
import SceneBackgroundPicker from './SceneBackgroundPicker';
import CameraSceneBackground from './CameraSceneBackground';
import type { CharacterQuality, SceneBackgroundSettings, TemplateApplyMode } from '../types';
import {
  getCharacterQualityGpu,
  isPortraitFormat,
  shouldUseCharacterOutline,
} from '../utils/characterQuality';
import { resolveEffectiveCanvasDpr } from '../perf/controller/effectiveDpr';
import WebGLContextGuard from './WebGLContextGuard';
import RecordingBridge from './RecordingBridge';
import { isRecordingCapture } from '../video/recordingCapture';
import { resolveRtxSettings } from '../utils/rtxSettings';
import { getFilesAsync } from '../utils/mmdFiles';
import { processImportedAssets } from '../utils/assetImport';
import type { ProcessedMMDFiles } from '../utils/mmdFiles';
import ViewportPerfMonitor, { type ViewportPerfSnapshot } from './ViewportPerfMonitor';
import PerformanceOverlay from '../product/ui/PerformanceOverlay';
import { DEBUG_UI } from '../config/debugUi';
import ViewportEmptyState from './viewport/ViewportEmptyState';
import { useStudioLayout } from '../hooks/useStudioLayout';
import { AdaptiveDprSync } from './perf/AdaptiveDprSync';
import { PerfFrameBegin, PerfFrameEnd } from './perf/PerfFrameSync';
import { MultiCharacterPhysicsCap } from './perf/MultiCharacterPhysicsCap';
import MultiCharacterPerfSync from './perf/MultiCharacterPerfSync';
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
import StageAutoFollow from '../product/camera/StageAutoFollow';
import { isHdrFile } from '../utils/hdrEnvironment';
import LetterboxOverlay from './LetterboxOverlay';
import { useAutoDismiss } from '../hooks/useAutoDismiss';

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
}: {
  visualFx: VisualFxSettings;
  viewportFormat: ViewportFormat;
  rtxModeEnabled: boolean;
}) {
  const { gl } = useThree();
  useEffect(() => {
    const base = visualFx.toneExposure ?? 0.95;
    const cinematic = visualFx.bloomEnabled || visualFx.dofEnabled || rtxModeEnabled;
    const vertical = viewportFormat === '9:16';
    const grade = vertical ? 0.9 : 1;
    gl.toneMappingExposure = base * grade * (cinematic ? 0.98 : 1);
  }, [
    gl,
    visualFx.bloomEnabled,
    visualFx.dofEnabled,
    visualFx.toneExposure,
    viewportFormat,
    rtxModeEnabled,
  ]);
  return null;
}

interface SceneContentProps {
  appState: AppState;
  mmdLite: MmdLiteConfig;
  sceneHdr: SceneHdrSettings;
  viewportFormat: ViewportFormat;
  characterQuality: CharacterQuality;
  onWebGlContextLost: () => void;
  onWebGlContextRestored: () => void;
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
  onPerfStats?: (stats: ViewportPerfSnapshot) => void;
}

function SceneContent({
  appState,
  mmdLite,
  sceneHdr,
  viewportFormat,
  characterQuality,
  onWebGlContextLost,
  onWebGlContextRestored,
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
  onPerfStats,
}: SceneContentProps) {
  const captureChrome = isRecordingVideo || isRecordingCapture();
  const activeModel = appState.models.find((m) => m.id === appState.selectedObjectId);
  const cameraFraming: CameraFramingMode = resolveCameraFramingFromModels(appState.models);
  const modelOffset = {
    x: activeModel?.positionX ?? 0,
    y: activeModel?.positionY ?? 0,
    z: activeModel?.positionZ ?? 0,
  };
  const hasCustomBg = Boolean(appState.sceneBackground.imageUrl);
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
  const renderAdapt = getPerfRenderAdaptation();
  const templateMotion = isTemplateMotionActive(appState);
  const visibleModelCount = countVisibleModels(appState.models);
  const multiCharacterScene = visibleModelCount >= 2;
  const shadowMapSize = multiCharacterScene
    ? Math.min(1024, qualityGpu.shadowMapSize)
    : qualityGpu.shadowMapSize;
  const cinematicBg =
    hasCustomBg ||
    appState.visualFx.bloomEnabled ||
    appState.visualFx.dofEnabled ||
    appState.rtxModeEnabled ||
    vertical;

  return (
    <>
      <WebGLContextGuard
        onContextLost={onWebGlContextLost}
        onContextRestored={onWebGlContextRestored}
      />
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

      <color attach="background" args={[hasCustomBg ? '#000000' : cinematicBg ? '#0a0c12' : '#e8ecf4']} />

      <CameraSceneBackground background={appState.sceneBackground} />

      <PortraitCameraFraming
        format={viewportFormat}
        cameraMode={appState.cameraMode}
        cameraFraming={cameraFraming}
        modelOffset={modelOffset}
        autoFocusEnabled={
          appState.cameraMode === 'free' &&
          appState.cameraStudio.autoFocus !== false &&
          !appState.cameraStudio.manualCameraLock
        }
      />

      {useOutline && !appState.visualFx.bloomEnabled && !vertical && <MMDOutlineEffect />}
      <BloomToneBoost
        visualFx={appState.visualFx}
        viewportFormat={viewportFormat}
        rtxModeEnabled={appState.rtxModeEnabled}
      />
      <SceneHdrEnvironment
        hdrBlobUrl={sceneHdr.blobUrl}
        intensity={sceneHdr.intensity}
        showAsBackground={sceneHdr.showBackground}
      />

      <GodRaySun ref={godRaySunRef} enabled={postFx.godRaysEnabled === true && !vertical} />

      <ScenePostProcessing
        visualFx={postFx}
        modelOffset={modelOffset}
        viewportFormat={viewportFormat}
        rtxModeEnabled={appState.rtxModeEnabled}
        rtxSettings={rtxResolved}
        pauseRtx={appState.isPlaying}
        godRaySunRef={godRaySunRef}
      />

      <ambientLight
        intensity={
          vertical
            ? appState.rtxModeEnabled
              ? 0.72
              : 0.82
            : 1.2
        }
        color="#ffffff"
      />

      <directionalLight
        castShadow={!hasCustomBg && !vertical && renderAdapt.enableShadows}
        position={[10, 20, 10]}
        intensity={
          vertical
            ? appState.rtxModeEnabled
              ? 1.35
              : 1.5
            : appState.visualFx.bloomEnabled
              ? 2.2
              : 2.1
        }
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

      <directionalLight position={[-8, 12, -6]} intensity={vertical ? 0.75 : 1.2} color="#c8d8ff" />
      <hemisphereLight intensity={vertical ? 0.4 : 0.6} color="#e8f0ff" groundColor="#404050" />

      {!hasCustomBg && !vertical && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.35} color="#000000" />
        </mesh>
      )}

      {showGrid && (
        <gridHelper args={[30, 30, '#6f42c1', '#222']} position={[0, 0.01, 0]} />
      )}

      <MmdWeatherPrecip visualFx={appState.visualFx} />

      <group>
        {appState.models.map((model) => {
            const isActive = model.id === appState.selectedObjectId;
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
              model.visible
            );
            const castShadow = shouldCastShadowForModel(
              model.id,
              appState.selectedObjectId,
              appState.models
            );

            return (
              <MMDModelWrapper
                key={model.id}
                sceneModelId={model.id}
                modelVisible={model.visible}
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
                customManager={model.customManager}
                fileMap={model.fileMap}
                vmdBlobUrls={model.vmdBlobUrls}
                activeVmdIndex={model.activeVmdIndex ?? 0}
                hasVmdAnimation={model.hasVmdAnimation}
                vmdPlaybackEnabled={model.vmdPlaybackEnabled !== false}
                activeTemplateId={model.activeTemplateId}
                currentFrame={appState.currentFrame}
                playSpeed={appState.playSpeed}
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
                showBonePickers={showBones && isActive}
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
              />
            );
          })}

        {showCameraHelper && (
          <mesh position={[0, 14, -6]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.8, 0.8, 1.2]} />
            <meshBasicMaterial color="#ec4899" wireframe />
          </mesh>
        )}
      </group>

      <MMDCameraController
        cameraMode={appState.cameraMode}
        cameraFraming={cameraFraming}
        followModelId={appState.selectedObjectId}
        autoFocus={appState.cameraStudio.autoFocus !== false}
        manualCameraLock={Boolean(appState.cameraStudio.manualCameraLock)}
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
      />

      <StageAutoFollow
        enabled={
          appState.cameraMode === 'free' &&
          appState.cameraStudio.autoFocus !== false &&
          !appState.cameraStudio.manualCameraLock
        }
        cameraMode={appState.cameraMode}
        framing={cameraFraming}
        followModelId={appState.selectedObjectId}
      />
    </>
  );
}

export type TransformMode = 'translate' | 'rotate';

interface ViewportProps {
  appState: AppState;
  mmdLite: MmdLiteConfig;
  sceneHdr?: SceneHdrSettings;
  onHdrFileDrop?: (blobUrl: string, fileName: string) => void;
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
  onLoadCustomModel?: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  captureCameraRef?: React.MutableRefObject<(() => CameraSnapshot | null) | null>;
  flyToCameraRef?: React.MutableRefObject<((snapshot: CameraSnapshot) => void) | null>;
  modelApiRef?: React.MutableRefObject<import('./MMDModelWrapper').MMDModelApi | null>;
  onSetCameraMode?: (mode: AppState['cameraMode']) => void;
  onPatchCameraStudio?: (patch: Partial<AppState['cameraStudio']>) => void;
  onModelAnimationLoaded?: (modelId: string, frameCount: number) => void;
  onApplyAnimationTemplate?: (templateId: string, mode?: TemplateApplyMode) => void;
  onSetIsPlaying?: (playing: boolean) => void;
  sceneBackground?: SceneBackgroundSettings;
  onPatchSceneBackground?: (patch: Partial<SceneBackgroundSettings>) => void;
  onClearSceneBackground?: () => void;
  isRecordingVideo?: boolean;
  onRecordingTick?: () => void;
  onGlCanvasReady?: (canvas: HTMLCanvasElement) => void;
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
  /** Empty viewport — load featured demo. */
  onTryDemo?: () => void;
}

export default function Viewport({
  appState,
  mmdLite,
  sceneHdr = { blobUrl: null, intensity: 1, showBackground: false },
  onHdrFileDrop,
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
  onLoadCustomModel,
  captureCameraRef,
  flyToCameraRef,
  modelApiRef,
  onSetCameraMode,
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
  onInvalidateReady,
  highlightMaterialName = null,
  onPmxMetadataLoaded,
  onTryDemo,
}: ViewportProps) {
  const characterQuality = appState.characterQuality;
  const captureChrome = isRecordingVideo || isRecordingCapture();
  const [canvasKey, setCanvasKey] = useState(0);
  const portraitLite = isPortraitFormat(viewportFormat);

  const handleWebGlContextLost = useCallback(() => {
    console.warn('[Viewport] WebGL context lost — remounting canvas (lite 9:16)');
    setCanvasKey((k) => k + 1);
  }, []);

  const handleWebGlContextRestored = useCallback(() => {
    console.info('[Viewport] WebGL context restored');
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
          alert('Load a .pmx/.pmd model first, then drop .vmd motion files.');
          setLoadingMsg('');
          return;
        }

        if (result.hdrFiles[0] && onHdrFileDrop) {
          const hdr = result.hdrFiles[0];
          onHdrFileDrop(URL.createObjectURL(hdr), hdr.name);
        }

        if (result.skippedFormats.length > 0) {
          console.warn(
            '[Import] Skipped non-MMD meshes (use .pmx/.pmd for characters):',
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
    [onLoadCustomModel, onHdrFileDrop]
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
      <div className="absolute top-2 left-2 md:top-4 md:left-4 z-10 pointer-events-none select-none font-sans px-2 py-1.5 md:px-3.5 md:py-2.5 bg-[#121418]/85 text-zinc-150 border border-zinc-800 rounded-md shadow-lg backdrop-blur-md flex items-center gap-2 md:gap-3 max-w-[calc(100%-5rem)]">
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

      <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10 font-mono text-[8px] md:text-[9px] flex items-center gap-1 md:gap-2 pointer-events-auto select-none flex-wrap justify-end max-w-[min(100%,calc(100%-6rem))]">
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
            onSelect={(templateId) => onApplyAnimationTemplate(templateId, 'replace')}
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
            onClick={() => onSetCameraMode?.('free')}
            className={`px-1.5 py-0.5 md:px-2.5 md:py-1 flex items-center gap-0.5 md:gap-1 font-bold uppercase tracking-wide transition-colors cursor-pointer ${
              appState.cameraMode === 'free'
                ? 'bg-[#39c5bb]/20 text-[#39c5bb]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Free orbit camera (Blender-style)"
          >
            <CameraIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span className="hidden sm:inline">Free</span>
          </button>
          <button
            type="button"
            onClick={() => onSetCameraMode?.('mmd')}
            className={`px-1.5 py-0.5 md:px-2.5 md:py-1 flex items-center gap-0.5 md:gap-1 font-bold uppercase tracking-wide transition-colors cursor-pointer border-l border-zinc-800 ${
              appState.cameraMode === 'mmd'
                ? 'bg-[#e879ff]/20 text-[#e879ff]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="MMD director camera (VMD or keyframes)"
          >
            <FilmIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span className="hidden sm:inline">MMD</span>
          </button>
          {appState.cameraMode === 'mmd' && onPatchCameraStudio && (
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
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={
                appState.cameraStudio.manualCameraLock
                  ? 'Manual orbit on — click to follow character again'
                  : 'Place camera yourself (orbit)'
              }
            >
              {appState.cameraStudio.manualCameraLock ? (
                <Lock className="w-2.5 h-2.5 md:w-3 md:h-3" />
              ) : (
                <Unlock className="w-2.5 h-2.5 md:w-3 md:h-3" />
              )}
              <span className="hidden sm:inline text-[9px]">Manual</span>
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

      {showManualMmdCameraHint && (
        <div className="absolute top-16 right-4 z-10 max-w-xs bg-amber-950/80 border border-amber-500/40 text-amber-100 text-[10px] font-bold px-3 py-2 rounded-md shadow-lg pointer-events-none">
          Manual MMD camera — drag to orbit. Turn off Manual in Camera Studio to fly with templates.
        </div>
      )}
      {showMmdTemplateHint && (
          <div className="absolute top-16 right-4 z-10 hidden md:block max-w-xs bg-[#e879ff]/15 border border-[#e879ff]/40 text-[#f0d0ff] text-[10px] font-bold px-3 py-2 rounded-md shadow-lg pointer-events-none">
            MMD camera: apply a dance / emote template or enable Manual in Camera Studio. Or use{' '}
            <span className="text-white">Free</span> to orbit.
          </div>
        )}

      {activeModel && appState.selectedBoneId && !captureChrome && (
        <div className="absolute top-20 max-md:top-auto max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 md:gap-1 bg-[#121418]/90 border border-zinc-800 rounded-lg p-0.5 md:p-1 shadow-lg backdrop-blur-md pointer-events-auto">
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

      {activeModel && !appState.selectedBoneId && !captureChrome && (
        <div className="absolute top-20 max-md:top-auto max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-20 hidden sm:block max-w-[90vw] bg-[#121418]/90 border border-[#9d27ff]/40 rounded-lg px-3 py-1.5 md:px-4 md:py-2 shadow-lg backdrop-blur-md pointer-events-none">
          <span className="text-[10px] font-bold uppercase text-[#e879ff] tracking-wider">
            Root Marker — drag purple ring or axis arrows to move model
          </span>
        </div>
      )}

      <LetterboxOverlay enabled={appState.visualFx.letterbox239 === true} />

      <div className="studio-viewport-stage flex-1 min-h-0 flex flex-col w-full">
      <ViewportCanvasShell format={viewportFormat}>
      <Canvas
        key={canvasKey}
        frameloop={appState.isPlaying || isRecordingVideo ? 'always' : 'demand'}
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
          onGlCanvasReady?.(gl.domElement);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.enabled = !portraitLite;
          if (!portraitLite) {
            gl.shadowMap.type = THREE.PCFShadowMap;
          }
          gl.setPixelRatio(
            portraitLite ? 1 : Math.min(window.devicePixelRatio || 1, 2)
          );
        }}
        camera={{ position: [0, 14, 28], fov: 45, near: 0.1, far: 2000 }}
        className="w-full h-full block"
        dpr={
          portraitLite
            ? 1
            : resolveEffectiveCanvasDpr(characterQuality, viewportFormat)
        }
      >
        <SceneContent
          appState={appState}
          mmdLite={mmdLite}
          sceneHdr={sceneHdr}
          viewportFormat={viewportFormat}
          characterQuality={characterQuality}
          onWebGlContextLost={handleWebGlContextLost}
          onWebGlContextRestored={handleWebGlContextRestored}
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
          onPerfStats={setPerfStats}
        />
      </Canvas>
      </ViewportCanvasShell>
      </div>

      {isHovering && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#39c5bb]/10 backdrop-blur-sm border-4 border-dashed border-[#39c5bb] pointer-events-none">
          <div className="bg-[#121418]/95 px-8 py-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-[#39c5bb]/30">
            <Upload className="w-12 h-12 text-[#39c5bb] animate-bounce" />
            <span className="text-xl font-bold text-zinc-100">Drop MMD Files Here</span>
            <p className="text-sm text-zinc-400 text-center max-w-sm">
              .pmx/.pmd model, optional .vmd motions, and all textures at once
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
        <ViewportEmptyState onTryDemo={onTryDemo} onDismiss={dismissEmptyHint} />
      ) : null}

      <PerformanceOverlay
        fps={perfStats.fps}
        frameMs={perfStats.frameMs}
        autoScale={perfStats.autoScale}
      />

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
