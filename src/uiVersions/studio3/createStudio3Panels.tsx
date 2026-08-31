/**
 * Builds real UI 3.0 dock panels from shared App handlers (no stubs / no Sidebar dump).
 */
import type { ReactNode } from 'react';
import type {
  AppState,
  CharacterQuality,
  MmdLiteConfig,
  PhysicsMode,
  SceneBackgroundSettings,
  VisualFxSettings,
  AnimationLayerDef,
  TimelineKeyframe,
  ViewportFormat,
  WeatherPresetId,
} from '../../types';
import type { SceneComposerState } from '../../sceneComposer';
import type { ProcessedMMDFiles, ProcessedVmdFiles } from '../../utils/mmdFiles';
import type { PoseSnapshotV1 } from '../../pose/poseTypes';
import type { SceneGraphState } from '../../product/ux/sceneGraph';
import type { QualityMode } from '../../product/scene/types';
import type { SmartStudioMode } from '../../smartStudio/types';
import type { CollabMode } from '../../collab/collabSync';
import type { CameraOrbitPresetId } from '../../types';
import type { StyleGalleryRuntimeState, PmxMaterialInfo } from '../../types';

import LoadSection from '../../components/sidebar/LoadSection';
import SceneSection from '../../components/sidebar/SceneSection';
import ControlsSection from '../../components/sidebar/ControlsSection';
import SceneComposerPanel from '../../components/sceneComposer/SceneComposerPanel';
import CameraStudioPanel from '../../components/CameraStudioPanel';
import LightingStudioPanel from '../../components/lighting/LightingStudioPanel';
import EnvironmentStudioPanel from '../../components/environment/EnvironmentStudioPanel';
import MaterialInspectorPanel from '../../components/stylePacks/MaterialInspectorPanel';
import { DEFAULT_DYNAMIC_SKY } from '../../dynamicSky';
import MaterialsPanel from '../../components/editor/MaterialsPanel';
import AdvancedStudioPanel from '../../components/editor/AdvancedStudioPanel';
import { Button, Panel } from '../../components/UI';
import PhysicsStudioDock from './PhysicsStudioDock';
import PerformanceStudioDock from './PerformanceStudioDock';
import SmartStudioDock from './SmartStudioDock';
import CinematicRenderDock from './CinematicRenderDock';
import PhotoStudioPanel from '../../components/photoStudio/PhotoStudioPanel';
import EnvironmentBuilderPanel from '../../components/environmentBuilder/EnvironmentBuilderPanel';
import AshfallCityPanel from '../../components/ashfallCity/AshfallCityPanel';
import RenderPipeline3Panel from '../../components/renderPipeline3/RenderPipeline3Panel';
import RenderPipeline4Panel from '../../components/renderPipeline4/RenderPipeline4Panel';
import AnimationLibraryPanel from '../../components/animationLibrary/AnimationLibraryPanel';
import ShotComposerPanel from '../../components/shotComposer/ShotComposerPanel';
import SceneStudioPanel from '../../components/sceneStudio/SceneStudioPanel';
import AiSceneDirectorPanel from '../../components/aiSceneDirector/AiSceneDirectorPanel';
import SceneDirectorWorkflowPanel from '../../components/sceneDirector/SceneDirectorWorkflowPanel';
import type { SceneDirectorState } from '../../sceneDirector/types';
import type { Studio3PanelId } from './workspaceLayout';
import type { CharacterOrientMode, ShotComposerState } from '../../shotComposer';
import {
  DEFAULT_SCENE_STUDIO,
  type SceneMoodPresetId,
  type SceneStudioState,
} from '../../sceneStudio';
import type { RenderPipeline2ApplyResult } from '../../renderPipeline2/apply';
import type { RenderPipeline2State } from '../../renderPipeline2/types';
import type { RenderPipeline3ApplyResult } from '../../renderPipeline3/apply';
import type { RenderPipeline3State } from '../../renderPipeline3/types';
import type { AnimationLibraryState } from '../../animationLibrary/types';
import type { AshfallApplyResult, AshfallCityState } from '../../ashfallCity';
import type {
  CinematicQualityPresetId,
  CinematicRenderStyleId,
  CinematicSunTimeId,
} from '../../cinematicRender';

export interface Studio3PanelSources {
  appState: AppState;
  sceneGraph: SceneGraphState;
  lockedObjectIds: Set<string>;
  highlightMaterial: string | null;
  analyzingModel: boolean;
  beginnerMode: boolean;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  showBones: boolean;
  setShowBones: (v: boolean) => void;
  showPhysicsBodies: boolean;
  setShowPhysicsBodies: (v: boolean) => void;
  demoLoadingId: string | null;
  activeDemoId: string | null;
  attachVmdTargetModelId: string | null;
  collabConnected: boolean;
  collabRoom: string;
  collabPeers: number;
  collabStatus: string;
  fxPanel: ReactNode;
  pmxMaterials: PmxMaterialInfo[];
  styleGallery: StyleGalleryRuntimeState;

  onSelectModel: (id: string | null) => void;
  onSelectBone: (id: string | null) => void;
  onToggleVisibility: (id: string, type: 'model' | 'other') => void;
  onDeleteModel: (id: string) => void;
  onSceneGraphToggleVisibility: (objectId: string) => void;
  onSceneGraphToggleLock: (objectId: string) => void;
  onSceneGraphCreateGroup: () => void;
  onLoadModel: (preset: 'miku' | 'kizuna' | 'custom') => void;
  onLoadCustomModel: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  onAttachVmd?: (modelId: string, vmd: ProcessedVmdFiles) => void;
  onInstallStylePack?: (files: File[]) => void | Promise<void>;
  onLoadDemo: (demoId: string) => void;
  onOpenDemoGallery: () => void;
  onModifyMorphs: (modelId: string, morphName: 'eyes' | 'mouth' | 'brow', value: number) => void;
  onModifyBone: (
    modelId: string,
    boneId: string,
    axes: 'rotationX' | 'rotationY' | 'rotationZ',
    value: number
  ) => void;
  onModifyModelPosition: (
    modelId: string,
    axis: 'positionX' | 'positionY' | 'positionZ',
    value: number
  ) => void;
  onRegisterKeyframe: (modelId: string) => void;
  onSetVmdPlaybackEnabled: (modelId: string, enabled: boolean) => void;
  onApplyPose?: (pose: PoseSnapshotV1) => void;
  onCapturePose?: () => void;
  onClearPoseHold?: () => void;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onPatchSceneComposer: (patch: Partial<SceneComposerState>) => void;
  onReplaceSceneComposer: (next: SceneComposerState) => void;
  onPatchDynamicSky: (patch: Partial<import('../../dynamicSky').DynamicSkyState>) => void;
  onApplyEnvironment: (args: {
    dynamicSky: import('../../dynamicSky').DynamicSkyState;
    sceneComposer: Partial<SceneComposerState> & {
      lights?: Partial<SceneComposerState['lights']>;
    };
    visualFx: Partial<VisualFxSettings>;
  }) => void;
  onPatchSceneStudio?: (patch: Partial<SceneStudioState>) => void;
  onPatchSceneDirector?: (patch: Partial<SceneDirectorState>) => void;
  onRenameModel?: (id: string, name: string) => void;
  onDuplicateModel?: (id: string) => void;
  onApplySceneMood?: (id: SceneMoodPresetId) => void;
  onSmartScene?: (options: import('../../sceneStudio').SmartSceneOptions) => void;
  onApplyAiSceneDirector?: (result: {
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
  }) => void;
  onToast?: (message: string, ms?: number) => void;
  onPatchSceneBackground?: (patch: Partial<SceneBackgroundSettings>) => void;
  onImportBackgroundModel?: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  onSetModelWorldScale?: (modelId: string, scale: number) => void;
  onModelRotate?: (modelId: string, x: number, y: number, z: number) => void;
  onImportHdr?: (file: File) => void;
  onApplyRenderPipeline2?: (
    result: RenderPipeline2ApplyResult,
    next: RenderPipeline2State
  ) => void;
  onPatchRenderPipeline2?: (patch: Partial<RenderPipeline2State>) => void;
  onApplyRenderPipeline3?: (
    result: RenderPipeline3ApplyResult,
    next: RenderPipeline3State
  ) => void;
  onPatchRenderPipeline3?: (patch: Partial<RenderPipeline3State>) => void;
  exportDurationSec?: number;
  maxExportDurationSec?: number;
  onExportDurationSecChange?: (sec: number) => void;
  videoExportBusy?: boolean;
  viewportFormat?: ViewportFormat;
  onPatchRenderPipeline4?: (patch: Partial<import('../../renderPipeline4/types').RenderPipeline4State>) => void;
  onStartRp4Export?: () => void;
  onPatchAnimationLibrary?: (next: AnimationLibraryState) => void;
  onAssignLibraryVmd?: (
    modelId: string,
    vmd: ProcessedVmdFiles,
    assetId: string,
    override?: {
      speed?: number;
      loop?: boolean;
      playbackOffset?: number;
      boneRemap?: Record<string, string>;
    }
  ) => void;
  onAssignLibraryTemplate?: (modelId: string, templateId: string) => void;
  onAssignLibraryKeyframes?: (modelId: string, keyframes: TimelineKeyframe[]) => void;
  onSetModelBoneRemap?: (modelId: string, remap: Record<string, string>) => void;
  onSetModelMotionSpeed?: (modelId: string, speed: number) => void;
  onApplyAshfallResult?: (result: AshfallApplyResult) => void;
  onPatchAshfallCity?: (patch: Partial<AshfallCityState>) => void;
  onFlyToCamera?: (snapshot: import('../../types').CameraSnapshot) => void;
  getViewportCanvas?: () => HTMLCanvasElement | null;
  captureViewportFrame?: () => string | null;
  invalidateViewport?: () => void;
  onPatchCameraStudio: (patch: Partial<AppState['cameraStudio']>) => void;
  onApplyCameraPreset: (presetId: CameraOrbitPresetId) => void;
  onSetCameraMode: (mode: AppState['cameraMode']) => void;
  onOpenCineStudio: () => void;
  onOpenReferenceCameraStudio?: () => void;
  shotComposer?: ShotComposerState;
  onPatchShotComposer?: (patch: Partial<ShotComposerState>) => void;
  onShotPlaceCharacter?: () => void;
  onShotPlaceCamera?: () => void;
  onShotCreate?: () => void;
  onShotAutoFrame?: () => void;
  onShotSave?: () => void;
  onShotApply?: (id: string) => void;
  onShotDelete?: (id: string) => void;
  onShotSetAspect?: (aspect: ViewportFormat) => void;
  onShotOrient?: (mode: CharacterOrientMode) => void;
  onSetPhysicsMode: (mode: PhysicsMode) => void;
  onPatchMmdLite: (patch: Partial<MmdLiteConfig>) => void;
  onRestartPhysics?: () => void;
  onFixPhysics?: () => void;
  onSelectMaterial: (name: string | null) => void;
  onPatchStyleGallery: (patch: Partial<StyleGalleryRuntimeState>) => void;
  onApplyKeyframes: (keyframes: TimelineKeyframe[], mode: 'merge' | 'replace') => void;
  onUpdateAnimLayers: (layers: AnimationLayerDef[]) => void;
  onToggleGroupSolo: (groupId: string) => void;
  onToggleGroupMute: (groupId: string) => void;
  onSaveMocapToLibrary?: (payload: {
    name: string;
    keyframes: TimelineKeyframe[];
    durationSec: number;
    fps: number;
    tags: string[];
    author: string;
  }) => void;
  onCollabJoin: (room: string, mode: CollabMode) => void;
  onCollabLeave: () => void;
  onOpenSmartPicker: () => void;
  onEnterSmartMode: (mode: SmartStudioMode) => void;
  onOpenOneClick?: () => void;
  onCharacterQualityChange: (q: CharacterQuality) => void;
  onSetRtxModeEnabled: (enabled: boolean) => void;
  onApplyCinematicQuality: (id: CinematicQualityPresetId) => void;
  onApplyCinematicSun: (id: CinematicSunTimeId) => void;
  onApplyCinematicWeather: (id: WeatherPresetId) => void;
  onApplyCinematicStyle: (id: CinematicRenderStyleId) => void;
  onPatchCinematicRender: (
    patch: Partial<NonNullable<AppState['cinematicRender']>>,
    rebuild?: boolean
  ) => void;
  onReapplyCinematicRender: () => void;
  onPatchReflectionSystem: (
    patch: Partial<NonNullable<AppState['reflectionSystem']>>
  ) => void;
  onPatchAsrp: (
    patch: Partial<{
      enabled: boolean;
      pipeline: 'classic' | 'asrp' | 'rtx_lite';
      depthStrength: number;
      silhouetteWidth: number;
      quality: 'simplified' | 'balanced' | 'ultra' | 'export' | 'auto';
      samples: number | 'auto';
      distanceFade: number;
      heightScale: number;
      normalBlend: number;
      parallaxScale: number;
      shadowInfluence: number;
      reflectionInfluence: number;
      autoHeightApprox: boolean;
      animePreserve: boolean;
      exportBoost: boolean;
    }>
  ) => void;
  onCinemaRender?: () => void;
  onPatchCinemaRender?: (
    patch: Partial<NonNullable<AppState['cinemaRender']>>
  ) => void;
  onApplyAsrpVisualStyle?: (id: import('../../asrp').AsrpVisualStyleId) => void;
  onAutoCinematicDirector?: () => void;
}

export function createStudio3Panels(
  p: Studio3PanelSources
): Partial<Record<Studio3PanelId, ReactNode>> {
  const selectedModel =
    p.appState.models.find((m) => m.id === p.appState.selectedObjectId) ??
    p.appState.models[0];
  const selectedBone = selectedModel?.bones.find((b) => b.id === p.appState.selectedBoneId);
  const vmdActive = selectedModel?.vmdPlaybackEnabled !== false;

  const cameraExtras = (
    <div className="p-2 space-y-2 border-t border-[#1e2430]">
      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Camera mode</p>
        <div className="grid grid-cols-2 gap-1">
          <Button
            type="button"
            size="sm"
            variant={p.appState.cameraMode === 'free' ? 'primary' : 'secondary'}
            className="w-full"
            onClick={() => p.onSetCameraMode('free')}
          >
            Free orbit
          </Button>
          <Button
            type="button"
            size="sm"
            variant={p.appState.cameraMode === 'mmd' ? 'primary' : 'secondary'}
            className="w-full"
            onClick={() => p.onSetCameraMode('mmd')}
          >
            MMD camera
          </Button>
        </div>
        <Button type="button" size="sm" variant="secondary" className="w-full" onClick={p.onOpenCineStudio}>
          Open Cinematography Studio
        </Button>
        {p.onOpenReferenceCameraStudio ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={p.onOpenReferenceCameraStudio}
          >
            Reference Camera Studio
          </Button>
        ) : null}
      </Panel>
    </div>
  );

  return {
    world: (
      <SceneStudioPanel
        state={p.appState.sceneStudio ?? DEFAULT_SCENE_STUDIO}
        dynamicSky={p.appState.dynamicSky ?? DEFAULT_DYNAMIC_SKY}
        maxFrames={p.appState.maxFrames}
        onPatch={p.onPatchSceneStudio ?? (() => undefined)}
        onApplyMood={p.onApplySceneMood ?? (() => undefined)}
        onPatchDynamicSky={p.onPatchDynamicSky}
        onSmartScene={p.onSmartScene}
      />
    ),
    director: (
      <AiSceneDirectorPanel
        appState={p.appState}
        onApplyResult={p.onApplyAiSceneDirector ?? (() => undefined)}
        onToast={p.onToast}
      />
    ),
    workflow: (
      <SceneDirectorWorkflowPanel
        appState={p.appState}
        lockedObjectIds={p.lockedObjectIds}
        onPatchDirector={p.onPatchSceneDirector ?? (() => undefined)}
        onSelectModel={p.onSelectModel}
        onRenameModel={p.onRenameModel ?? (() => undefined)}
        onDuplicateModel={p.onDuplicateModel ?? (() => undefined)}
        onToggleVisibility={p.onToggleVisibility}
        onToggleLock={p.onSceneGraphToggleLock}
        onDeleteModel={p.onDeleteModel}
        onAttachVmd={p.onAttachVmd}
        onPatchSceneStudio={p.onPatchSceneStudio}
      />
    ),
    renderpipe: (
      <div className="space-y-3">
        <RenderPipeline4Panel
          appState={p.appState}
          exportDurationSec={p.exportDurationSec ?? 30}
          maxDurationSec={p.maxExportDurationSec ?? 120}
          busy={p.videoExportBusy}
          viewportFormat={p.viewportFormat ?? '16:9'}
          onPatch={p.onPatchRenderPipeline4 ?? (() => undefined)}
          onStartExport={p.onStartRp4Export ?? (() => undefined)}
          onExportDurationSecChange={p.onExportDurationSecChange}
        />
        <details className="rounded border border-zinc-800 bg-zinc-950/40">
          <summary className="cursor-pointer px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            Render Pipeline 3.0 (legacy)
          </summary>
          <RenderPipeline3Panel
            appState={p.appState}
            onApply={p.onApplyRenderPipeline3 ?? (() => undefined)}
            onPatchPipeline={p.onPatchRenderPipeline3 ?? (() => undefined)}
          />
        </details>
      </div>
    ),
    animlib: (
      <AnimationLibraryPanel
        appState={p.appState}
        onPatchLibrary={p.onPatchAnimationLibrary ?? (() => undefined)}
        onAssignVmd={p.onAssignLibraryVmd ?? (() => undefined)}
        onAssignTemplate={p.onAssignLibraryTemplate ?? (() => undefined)}
        onAssignKeyframes={p.onAssignLibraryKeyframes ?? (() => undefined)}
        onSetModelBoneRemap={p.onSetModelBoneRemap}
        onSetModelMotionSpeed={p.onSetModelMotionSpeed}
      />
    ),
    envbuild: (
      <EnvironmentBuilderPanel
        appState={p.appState}
        onImportBackgroundModel={p.onImportBackgroundModel}
        onLoadCustomModel={p.onLoadCustomModel}
        onImportHdr={p.onImportHdr}
        onSetVisualFx={p.onSetVisualFx}
        onPatchDynamicSky={p.onPatchDynamicSky}
        onPatchSceneComposer={p.onPatchSceneComposer}
        onApplyCameraPreset={p.onApplyCameraPreset}
        onPatchCameraStudio={p.onPatchCameraStudio}
        onModifyModelPosition={p.onModifyModelPosition}
        onModelRotate={p.onModelRotate}
        onSetModelWorldScale={p.onSetModelWorldScale}
      />
    ),
    ashfall: (
      <AshfallCityPanel
        appState={p.appState}
        onApplyResult={p.onApplyAshfallResult ?? (() => undefined)}
        onPatchAshfall={p.onPatchAshfallCity ?? (() => undefined)}
        onFlyToCamera={p.onFlyToCamera}
      />
    ),
    photo: (
      <PhotoStudioPanel
        appState={p.appState}
        onSetVisualFx={p.onSetVisualFx}
        onPatchDynamicSky={p.onPatchDynamicSky}
        onPatchSceneComposer={p.onPatchSceneComposer}
        onPatchCameraStudio={p.onPatchCameraStudio}
        onApplyPose={p.onApplyPose}
        onModifyMorphs={p.onModifyMorphs}
        getViewportCanvas={p.getViewportCanvas}
        invalidateViewport={p.invalidateViewport}
      />
    ),
    assets: (
      <LoadSection
        onLoadModel={p.onLoadModel}
        onLoadCustomModel={p.onLoadCustomModel}
        attachVmdTargetModelId={p.attachVmdTargetModelId}
        onAttachVmd={p.onAttachVmd}
        onInstallStylePack={p.onInstallStylePack}
        onLoadDemo={p.onLoadDemo}
        onOpenDemoGallery={p.onOpenDemoGallery}
        demoLoadingId={p.demoLoadingId}
        activeDemoId={p.activeDemoId}
      />
    ),
    scene: (
      <SceneSection
        appState={p.appState}
        sceneGraph={p.sceneGraph}
        onSelectModel={p.onSelectModel}
        onToggleVisibility={p.onToggleVisibility}
        onDeleteModel={p.onDeleteModel}
        onSceneGraphToggleVisibility={p.onSceneGraphToggleVisibility}
        onSceneGraphToggleLock={p.onSceneGraphToggleLock}
        onSceneGraphCreateGroup={p.onSceneGraphCreateGroup}
        onLoadDemo={p.onLoadDemo}
        onLoadModel={p.onLoadModel}
      />
    ),
    camera: (
      <div>
        <CameraStudioPanel
          appState={p.appState}
          onPatchCameraStudio={p.onPatchCameraStudio}
          onApplyCameraPreset={p.onApplyCameraPreset}
          onSetVisualFx={p.onSetVisualFx}
        />
        {cameraExtras}
      </div>
    ),
    shots:
      p.shotComposer && p.onPatchShotComposer ? (
        <ShotComposerPanel
          appState={p.appState}
          shotComposer={p.shotComposer}
          onPatch={p.onPatchShotComposer}
          onPlaceCharacterMode={p.onShotPlaceCharacter ?? (() => undefined)}
          onPlaceCameraMode={p.onShotPlaceCamera ?? (() => undefined)}
          onCreateShot={p.onShotCreate ?? (() => undefined)}
          onAutoFrame={p.onShotAutoFrame ?? (() => undefined)}
          onSaveShot={p.onShotSave ?? (() => undefined)}
          onApplyShot={p.onShotApply ?? (() => undefined)}
          onDeleteShot={p.onShotDelete ?? (() => undefined)}
          onSetAspect={p.onShotSetAspect ?? (() => undefined)}
          onOrient={p.onShotOrient ?? (() => undefined)}
          viewportFormat={p.viewportFormat ?? '16:9'}
        />
      ) : (
        <div className="p-3 text-[11px] text-zinc-500">Shot Composer unavailable</div>
      ),
    lighting: (
      <>
        <EnvironmentStudioPanel
          dynamicSky={p.appState.dynamicSky ?? DEFAULT_DYNAMIC_SKY}
          onPatchDynamicSky={p.onPatchDynamicSky}
          onApplyEnvironment={p.onApplyEnvironment}
        />
        <div className="border-t border-[#1e2430]">
          <LightingStudioPanel
            appState={p.appState}
            onSetVisualFx={p.onSetVisualFx}
            onPatchComposer={p.onPatchSceneComposer}
            onReplaceComposer={p.onReplaceSceneComposer}
            onPatchSceneStudio={p.onPatchSceneStudio}
          />
        </div>
        <div className="p-2 border-t border-[#1e2430]">
          <p className="text-[10px] font-bold text-zinc-400 mb-2 px-1">Scene Composer</p>
          <SceneComposerPanel
            appState={p.appState}
            onSetVisualFx={p.onSetVisualFx}
            onPatchComposer={p.onPatchSceneComposer}
            onReplaceComposer={p.onReplaceSceneComposer}
            onPatchSceneBackground={p.onPatchSceneBackground}
            onImportBackgroundModel={p.onImportBackgroundModel}
            getViewportCanvas={p.getViewportCanvas}
            captureViewportFrame={p.captureViewportFrame}
            invalidateViewport={p.invalidateViewport}
          />
        </div>
      </>
    ),
    cinematic: (
      <CinematicRenderDock
        appState={p.appState}
        onApplyQuality={p.onApplyCinematicQuality}
        onApplySun={p.onApplyCinematicSun}
        onApplyWeather={p.onApplyCinematicWeather}
        onApplyStyle={p.onApplyCinematicStyle}
        onPatchCinematic={p.onPatchCinematicRender}
        onReapply={p.onReapplyCinematicRender}
        onPatchReflections={p.onPatchReflectionSystem}
        onPatchAsrp={p.onPatchAsrp}
        onQualityModeChange={p.onQualityModeChange}
        onCinemaRender={p.onCinemaRender}
        onPatchCinema={p.onPatchCinemaRender}
        onApplyAsrpVisualStyle={p.onApplyAsrpVisualStyle}
        onAutoCinematicDirector={p.onAutoCinematicDirector}
      />
    ),
    material: (
      <div className="p-2 space-y-2">
        <MaterialInspectorPanel
          materials={p.pmxMaterials}
          styleGallery={p.styleGallery}
          selectedMaterial={p.highlightMaterial}
          onSelectMaterial={p.onSelectMaterial}
          onPatchStyleGallery={p.onPatchStyleGallery}
        />
        <Panel className="!p-2">
          <p className="text-[10px] font-bold text-zinc-400 mb-1">Materials</p>
          <MaterialsPanel
            materials={p.pmxMaterials}
            selectedMaterial={p.highlightMaterial}
            onSelectMaterial={p.onSelectMaterial}
          />
        </Panel>
      </div>
    ),
    physics: (
      <PhysicsStudioDock
        physicsMode={p.appState.physicsMode}
        mmdLite={p.appState.mmdLite}
        showPhysicsBodies={p.showPhysicsBodies}
        onSetPhysicsMode={p.onSetPhysicsMode}
        onPatchMmdLite={p.onPatchMmdLite}
        onSetShowPhysicsBodies={p.setShowPhysicsBodies}
        onRestartPhysics={p.onRestartPhysics}
        onFixPhysics={p.onFixPhysics}
      />
    ),
    fx: p.fxPanel,
    ai: (
      <div className="p-2">
        <AdvancedStudioPanel
          selectedModel={selectedModel}
          maxFrames={p.appState.maxFrames}
          collabConnected={p.collabConnected}
          collabRoom={p.collabRoom}
          collabPeers={p.collabPeers}
          collabStatus={p.collabStatus}
          onCollabJoin={p.onCollabJoin}
          onCollabLeave={p.onCollabLeave}
          onApplyKeyframes={p.onApplyKeyframes}
          onUpdateLayers={p.onUpdateAnimLayers}
          onToggleGroupSolo={p.onToggleGroupSolo}
          onToggleGroupMute={p.onToggleGroupMute}
          onSaveMocapToLibrary={p.onSaveMocapToLibrary}
        />
      </div>
    ),
    smart: (
      <SmartStudioDock
        hasModel={p.appState.models.length > 0}
        onOpenSmartPicker={p.onOpenSmartPicker}
        onEnterSmartMode={p.onEnterSmartMode}
        onOpenOneClick={p.onOpenOneClick}
        onOpenCineStudio={p.onOpenCineStudio}
        onOpenReferenceCameraStudio={p.onOpenReferenceCameraStudio}
        onOpenDemoGallery={p.onOpenDemoGallery}
      />
    ),
    performance: (
      <PerformanceStudioDock
        qualityMode={p.qualityMode}
        onQualityModeChange={p.onQualityModeChange}
        characterQuality={p.appState.characterQuality}
        onCharacterQualityChange={p.onCharacterQualityChange}
        rtxModeEnabled={p.appState.rtxModeEnabled}
        onSetRtxModeEnabled={p.onSetRtxModeEnabled}
        showGrid={p.showGrid}
        onShowGrid={p.setShowGrid}
        showBones={p.showBones}
        onShowBones={p.setShowBones}
        showPhysicsBodies={p.showPhysicsBodies}
        onShowPhysicsBodies={p.setShowPhysicsBodies}
      />
    ),
    inspector: (
      <ControlsSection
        appState={p.appState}
        selectedModel={selectedModel}
        selectedBone={selectedBone}
        vmdActive={Boolean(selectedModel?.hasVmdAnimation && vmdActive)}
        onSelectBone={p.onSelectBone}
        onModifyMorphs={p.onModifyMorphs}
        onModifyBone={p.onModifyBone}
        onModifyModelPosition={p.onModifyModelPosition}
        onRegisterKeyframe={p.onRegisterKeyframe}
        onSetVmdPlaybackEnabled={p.onSetVmdPlaybackEnabled}
        onApplyPose={p.onApplyPose}
        onCapturePose={p.onCapturePose}
        onClearPoseHold={p.onClearPoseHold}
      />
    ),
  };
}
