import { useState } from 'react';
import { 
  FolderOpen,
  Layers, 
  Sliders,
  Wrench,
  Camera,
  Clapperboard,
} from 'lucide-react';
import type { AppState, MmdLiteConfig, PhysicsMode, SceneBackgroundSettings, VisualFxSettings } from '../types';
import type { MobilePanelTab } from '../hooks/useStudioLayout';
import type { ProcessedMMDFiles, ProcessedVmdFiles } from '../utils/mmdFiles';
import type { PoseSnapshotV1 } from '../pose/poseTypes';
import type { AnimationLayerDef, TimelineKeyframe } from '../types';
import type { SceneGraphState } from '../product/ux/sceneGraph';
import { Button, CollapsibleSection } from './UI';
import LoadSection from './sidebar/LoadSection';
import SceneSection from './sidebar/SceneSection';
import ControlsSection from './sidebar/ControlsSection';
import AdvancedSection from './sidebar/AdvancedSection';
import ComposerSection from './sidebar/ComposerSection';
import MobileCameraTab from './mobile/MobileCameraTab';

interface SidebarProps {
  appState: AppState;
  onSelectModel: (id: string | null) => void;
  onSelectBone: (id: string | null) => void;
  onToggleVisibility: (id: string, type: 'model' | 'other') => void;
  onDeleteModel: (id: string) => void;
  onModifyMorphs: (modelId: string, morphName: 'eyes' | 'mouth' | 'brow', value: number) => void;
  onModifyBone: (modelId: string, boneId: string, axes: 'rotationX' | 'rotationY' | 'rotationZ', value: number) => void;
  onModifyModelPosition: (modelId: string, axis: 'positionX' | 'positionY' | 'positionZ', value: number) => void;
  onRegisterKeyframe: (modelId: string) => void;
  onLoadModel: (preset: 'miku' | 'kizuna' | 'custom') => void;
  onLoadCustomModel: (data: ProcessedMMDFiles) => void;
  attachVmdTargetModelId?: string | null;
  onAttachVmd?: (modelId: string, vmd: ProcessedVmdFiles) => void;
  onInstallStylePack?: (files: File[]) => void | Promise<void>;
  setPhysicsMode: (mode: PhysicsMode) => void;
  onSetVmdPlaybackEnabled: (modelId: string, enabled: boolean) => void;
  onPatchMmdLite: (patch: Partial<MmdLiteConfig>) => void;
  highlightMaterial?: string | null;
  onSelectMaterial?: (name: string | null) => void;
  onSelectPmxBone?: (boneName: string) => void;
  collabConnected?: boolean;
  collabRoom?: string;
  collabPeers?: number;
  onCollabJoin?: (room: string, mode: import('../collab/collabSync').CollabMode) => void;
  collabStatus?: string;
  onCollabLeave?: () => void;
  onApplyKeyframes?: (keyframes: TimelineKeyframe[], mode: 'merge' | 'replace') => void;
  onUpdateAnimLayers?: (layers: AnimationLayerDef[]) => void;
  onToggleGroupSolo?: (groupId: string) => void;
  onToggleGroupMute?: (groupId: string) => void;
  maxFrames?: number;
  isMobile?: boolean;
  embedded?: boolean;
  onClose?: () => void;
  onApplyPose?: (pose: PoseSnapshotV1) => void;
  onCapturePose?: () => void;
  onClearPoseHold?: () => void;
  onReanalyzeModel?: () => void;
  analyzingModel?: boolean;
  onLoadDemo?: (demoId: string) => void;
  demoLoadingId?: string | null;
  activeDemoId?: string | null;
  onOpenDemoGallery?: () => void;
  beginnerMode?: boolean;
  sceneGraph?: SceneGraphState;
  lockedObjectIds?: Set<string>;
  onSceneGraphToggleVisibility?: (objectId: string) => void;
  onSceneGraphToggleLock?: (objectId: string) => void;
  onSceneGraphCreateGroup?: () => void;
  onSetCameraMode?: (mode: AppState['cameraMode']) => void;
  onToggleManualCameraLock?: () => void;
  onEnterDirectCameraMode?: () => void;
  onOpenCineStudio?: () => void;
  onOpenReferenceCameraStudio?: () => void;
  mobileTab?: MobilePanelTab;
  onMobileTabChange?: (tab: MobilePanelTab) => void;
  /** Pro Mobile bottom sheet — no tabs/header chrome */
  proMobileSheet?: boolean;
  onSetVisualFx?: (patch: Partial<VisualFxSettings>) => void;
  onPatchSceneComposer?: (patch: Partial<import('../sceneComposer').SceneComposerState>) => void;
  onReplaceSceneComposer?: (next: import('../sceneComposer').SceneComposerState) => void;
  onPatchSceneBackground?: (patch: Partial<SceneBackgroundSettings>) => void;
  onImportBackgroundModel?: (data: import('../utils/mmdFiles').ProcessedMMDFiles | import('../utils/mmdFiles').ProcessedMMDFiles[]) => void;
  getViewportCanvas?: () => HTMLCanvasElement | null;
  captureViewportFrame?: () => string | null;
  invalidateViewport?: () => void;
}

export default function Sidebar({
  appState,
  onSelectModel,
  onSelectBone,
  onToggleVisibility,
  onDeleteModel,
  onModifyMorphs,
  onModifyBone,
  onModifyModelPosition,
  onRegisterKeyframe,
  onLoadModel,
  onLoadCustomModel,
  attachVmdTargetModelId = null,
  onAttachVmd,
  onInstallStylePack,
  setPhysicsMode,
  onSetVmdPlaybackEnabled,
  onPatchMmdLite,
  highlightMaterial = null,
  onSelectMaterial,
  onSelectPmxBone,
  collabConnected = false,
  collabRoom = '',
  collabPeers = 0,
  collabStatus = '',
  onCollabJoin,
  onCollabLeave,
  onApplyKeyframes,
  onUpdateAnimLayers,
  onToggleGroupSolo,
  onToggleGroupMute,
  maxFrames = 120,
  isMobile = false,
  embedded = false,
  onClose,
  onApplyPose,
  onCapturePose,
  onClearPoseHold,
  onReanalyzeModel,
  analyzingModel = false,
  onLoadDemo,
  demoLoadingId = null,
  activeDemoId = null,
  onOpenDemoGallery,
  beginnerMode = false,
  sceneGraph,
  onSceneGraphToggleVisibility,
  onSceneGraphToggleLock,
  onSceneGraphCreateGroup,
  onSetCameraMode,
  onToggleManualCameraLock,
  onEnterDirectCameraMode,
  onOpenCineStudio,
  onOpenReferenceCameraStudio,
  mobileTab: mobileTabProp,
  onMobileTabChange,
  proMobileSheet = false,
  onSetVisualFx,
  onPatchSceneComposer,
  onReplaceSceneComposer,
  onPatchSceneBackground,
  onImportBackgroundModel,
  getViewportCanvas,
  captureViewportFrame,
  invalidateViewport,
}: SidebarProps) {
  const [internalTab, setInternalTab] = useState<MobilePanelTab>('scene');
  const mobileTab = mobileTabProp ?? internalTab;
  const setMobileTab = (t: MobilePanelTab) => {
    setInternalTab(t);
    onMobileTabChange?.(t);
  };
  const lite = appState.mmdLite;
  const selectedModel = appState.models.find((m) => m.id === appState.selectedObjectId);
  const selectedBone = selectedModel?.bones.find((b) => b.id === appState.selectedBoneId);
  const vmdActive =
    selectedModel?.hasVmdAnimation && selectedModel.vmdPlaybackEnabled !== false;

  return (
    <aside
      className={`studio-sidebar select-none font-sans ${
        proMobileSheet
          ? 'pro-mobile-sheet-content relative h-full w-full'
          : isMobile && !embedded
            ? 'fixed inset-y-0 left-0 z-50 w-[min(100vw,18rem)] max-w-full shadow-2xl pt-[env(safe-area-inset-top)]'
            : 'relative h-full w-full'
      }`}
      id="mmd-sidebar"
    >
      {isMobile && onClose && !proMobileSheet ? (
        <div
          className="flex items-center justify-between border-b border-[var(--color-border)] md:hidden"
          style={{ padding: 'var(--space-sm) var(--space-md)' }}
        >
          <span className="text-[var(--font-size-base)] font-semibold text-[var(--color-text-main)]">
            Editor
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close panel">
            Close
          </Button>
      </div>
      ) : null}

      <div className="studio-sidebar__scroll">
        {isMobile && !proMobileSheet ? (
          <div className="mobile-panel-tabs" role="tablist">
            {(
              [
                ['scene', 'Objects', Layers],
                ['composer', 'Scene', Clapperboard],
                ['control', 'Control', Sliders],
                ['camera', 'Camera', Camera],
              ] as const
            ).map(([id, label, Icon]) => (
                  <button
                key={id}
                    type="button"
                role="tab"
                aria-selected={mobileTab === id}
                className={`mobile-panel-tabs__btn ${mobileTab === id ? 'mobile-panel-tabs__btn--active' : ''}`}
                onClick={() => setMobileTab(id)}
              >
                <span className="flex flex-col items-center gap-0.5">
                  <Icon className="w-4 h-4" />
                  {label}
                </span>
                  </button>
            ))}
          </div>
        ) : null}

        {(!isMobile || mobileTab === 'scene') && (
          <>
        <CollapsibleSection title="Load" defaultOpen icon={<FolderOpen className="w-4 h-4" />}>
          <LoadSection
            onLoadModel={onLoadModel}
            onLoadCustomModel={onLoadCustomModel}
            attachVmdTargetModelId={attachVmdTargetModelId}
            onAttachVmd={onAttachVmd}
            onInstallStylePack={onInstallStylePack}
            onLoadDemo={onLoadDemo}
            onOpenDemoGallery={onOpenDemoGallery}
            demoLoadingId={demoLoadingId}
            activeDemoId={activeDemoId}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Scene Graph" defaultOpen icon={<Layers className="w-4 h-4" />}>
          <SceneSection
            appState={appState}
            sceneGraph={sceneGraph}
            onSelectModel={onSelectModel}
            onToggleVisibility={onToggleVisibility}
            onDeleteModel={onDeleteModel}
            onSceneGraphToggleVisibility={onSceneGraphToggleVisibility}
            onSceneGraphToggleLock={onSceneGraphToggleLock}
            onSceneGraphCreateGroup={onSceneGraphCreateGroup}
            onLoadDemo={onLoadDemo}
            onLoadModel={onLoadModel}
          />
        </CollapsibleSection>

        {!isMobile && (onOpenCineStudio || onOpenReferenceCameraStudio) ? (
          <CollapsibleSection title="Cinematography" defaultOpen icon={<Clapperboard className="w-4 h-4" />}>
            <div className="space-y-2 px-1">
              <p className="text-[9px] text-zinc-500 leading-relaxed m-0">
                Cine Studio (VCS) and Reference Camera Studio — directing tools, not on the viewport chrome.
              </p>
              <div className="flex items-center gap-2 text-[9px]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    appState.vcs?.enabled ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`}
                />
                <span className="text-zinc-400">
                  VCS {appState.vcs?.enabled ? 'активен' : 'выключен'}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {onOpenCineStudio ? (
                  <Button type="button" variant="primary" className="w-full text-[10px]" onClick={onOpenCineStudio}>
                    <Clapperboard className="w-3.5 h-3.5" />
                    Открыть Cine Studio
                  </Button>
                ) : null}
                {onOpenReferenceCameraStudio ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-[10px]"
                    onClick={onOpenReferenceCameraStudio}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Reference Camera Studio
                  </Button>
                ) : null}
                {onEnterDirectCameraMode ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-[10px]"
                    onClick={onEnterDirectCameraMode}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Move Cam + Gizmo
                  </Button>
                ) : null}
              </div>
            </div>
          </CollapsibleSection>
        ) : null}
          </>
        )}

        {onSetVisualFx &&
        onPatchSceneComposer &&
        onReplaceSceneComposer &&
        (!isMobile || mobileTab === 'composer' || (proMobileSheet && mobileTab === 'scene')) ? (
          <ComposerSection
            appState={appState}
            onSetVisualFx={onSetVisualFx}
            onPatchComposer={onPatchSceneComposer}
            onReplaceComposer={onReplaceSceneComposer}
            onPatchSceneBackground={onPatchSceneBackground}
            onImportBackgroundModel={onImportBackgroundModel}
            getViewportCanvas={getViewportCanvas}
            captureViewportFrame={captureViewportFrame}
            invalidateViewport={invalidateViewport}
          />
        ) : null}

        {isMobile && mobileTab === 'camera' && onSetCameraMode && onToggleManualCameraLock ? (
          <MobileCameraTab
            appState={appState}
            onSetCameraMode={onSetCameraMode}
            onToggleManualLock={onToggleManualCameraLock}
            onEnterDirectCameraMode={onEnterDirectCameraMode}
            onOpenCineStudio={onOpenCineStudio}
            onOpenReferenceCameraStudio={onOpenReferenceCameraStudio}
          />
        ) : null}

        {(!isMobile || mobileTab === 'control') && (
          <>
        <CollapsibleSection
          title="Controls"
          defaultOpen={Boolean(selectedModel)}
          icon={<Sliders className="w-4 h-4" />}
        >
          <ControlsSection
            appState={appState}
            selectedModel={selectedModel}
            selectedBone={selectedBone}
            vmdActive={Boolean(vmdActive)}
            onSelectBone={onSelectBone}
            onModifyMorphs={onModifyMorphs}
            onModifyBone={onModifyBone}
            onModifyModelPosition={onModifyModelPosition}
            onRegisterKeyframe={onRegisterKeyframe}
            onSetVmdPlaybackEnabled={onSetVmdPlaybackEnabled}
            onApplyPose={onApplyPose}
            onCapturePose={onCapturePose}
            onClearPoseHold={onClearPoseHold}
          />
        </CollapsibleSection>

        {!beginnerMode ? (
        <CollapsibleSection title="Advanced" defaultOpen={false} icon={<Wrench className="w-4 h-4" />}>
          <AdvancedSection
            appState={appState}
            selectedModel={selectedModel}
            lite={lite}
            beginnerMode={beginnerMode}
            maxFrames={maxFrames}
            highlightMaterial={highlightMaterial}
            analyzingModel={analyzingModel}
            collabConnected={collabConnected}
            collabRoom={collabRoom}
            collabPeers={collabPeers}
            collabStatus={collabStatus}
            onCollabJoin={onCollabJoin}
            onCollabLeave={onCollabLeave}
            setPhysicsMode={setPhysicsMode}
            onPatchMmdLite={onPatchMmdLite}
            onApplyKeyframes={onApplyKeyframes}
            onUpdateAnimLayers={onUpdateAnimLayers}
            onToggleGroupSolo={onToggleGroupSolo}
            onToggleGroupMute={onToggleGroupMute}
            onReanalyzeModel={onReanalyzeModel}
            onSelectPmxBone={onSelectPmxBone}
            onSelectMaterial={onSelectMaterial}
          />
        </CollapsibleSection>
        ) : null}
          </>
        )}
      </div>

      {selectedModel ? (
        <div
          className="border-t border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between gap-[var(--space-sm)]"
          style={{ padding: 'var(--space-md)' }}
        >
          <div className="min-w-0">
            <p className="text-[var(--font-size-base)] font-semibold text-[var(--color-text-main)] truncate m-0">
              {selectedModel.name}
            </p>
            <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] m-0">
              {selectedModel.keyframes.length} keyframes
            </p>
          </div>
          <Button type="button" variant="primary" size="sm" onClick={() => onRegisterKeyframe(selectedModel.id)}>
            Keyframe
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
