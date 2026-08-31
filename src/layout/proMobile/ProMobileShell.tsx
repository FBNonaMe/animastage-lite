import { useCallback, useRef, useState, type ReactNode } from 'react';
import ProMobileTopBar from './ProMobileTopBar';
import ProMobileOnboarding from './ProMobileOnboarding';
import ProMobileMenuSheet from './ProMobileMenuSheet';
import ProSnapBottomSheet from './ProSnapBottomSheet';
import ProMobileControlPanel from './ProMobileControlPanel';
import type { ProMobileTab, ProSnapLevel } from './types';
import type { MobilePanelTab } from '../../hooks/useStudioLayout';
import type { StudioUiMode } from '../../flow/types';
import type { QualityMode } from '../../product/scene/types';
import type { EditorInterfaceId } from '../../uiVersions';
import {
  MobileToolRail,
  MobileViewportChrome,
  MobileMoreSheet,
  MobileCameraModeBar,
  MobileAspectToggle,
  workspaceToolTitle,
  workspaceToStudioPanel,
  isTimelineWorkspaceTool,
  prefersTallSheet,
  type MobileTransformMode,
  type MobileWorkspaceTool,
} from '../adaptiveMobile';

const TAB_TITLES: Record<ProMobileTab, string> = {
  scene: 'Scene & Load',
  control: 'Timeline',
  camera: 'Camera',
  fx: 'FX & Quality',
};

function workspaceToProTab(tool: MobileWorkspaceTool): ProMobileTab {
  switch (tool) {
    case 'assets':
    case 'scene':
    case 'photo':
      return 'scene';
    case 'camera':
      return 'camera';
    case 'fx':
    case 'render':
    case 'lighting':
    case 'cinematic':
    case 'envbuild':
    case 'ashfall':
      return 'fx';
    case 'animation':
    case 'timeline':
    case 'inspector':
    case 'mocap':
      return 'control';
    case 'materials':
    case 'physics':
    case 'ai':
    case 'smart':
    case 'performance':
    case 'more':
    default:
      return 'fx';
  }
}

export interface ProMobileShellProps {
  sceneTitle: string;
  viewport: ReactNode;
  hasModel: boolean;
  isPlaying: boolean;
  manualOrbit: boolean;
  onTogglePlay: () => void;
  onToggleOrbit: () => void;
  onResetView: () => void;
  onShare: () => void;
  onExport: () => void;
  shareBusy?: boolean;
  onTryDemo: () => void;
  onSave: () => void;
  onOpenProject: () => void;
  onClearScene: () => void;
  mobilePanelTab: MobilePanelTab;
  onMobilePanelTabChange: (tab: MobilePanelTab) => void;
  renderPanel: (tab: ProMobileTab) => ReactNode;
  /** Optional richer panel for CapCut-style workspace tools. */
  renderWorkspaceTool?: (tool: MobileWorkspaceTool) => ReactNode;
  timeline?: ReactNode;
  optimizedHint?: boolean;
  uiMode: StudioUiMode;
  onUiModeChange: (mode: StudioUiMode) => void;
  editorInterface: EditorInterfaceId;
  onEditorInterfaceChange: (id: EditorInterfaceId) => void;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  onApplyTemplate: (templateId: string) => void;
  /** Adaptive Mobile Framework — selection + transform chrome */
  selectedObjectId?: string | null;
  selectedBoneId?: string | null;
  highlightMaterial?: string | null;
  cameraMode?: string;
  cameraDirectPlacement?: boolean;
  models?: Array<{ id: string; name: string; assetKind?: string | null }>;
  transformMode?: MobileTransformMode;
  onTransformModeChange?: (mode: MobileTransformMode) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSetCameraMode?: (mode: 'free' | 'mmd') => void;
  onEnterDirectCameraMode?: () => void;
  viewportFormat?: import('../../types').ViewportFormat;
  onViewportFormatChange?: (format: import('../../types').ViewportFormat) => void;
}

export default function ProMobileShell({
  sceneTitle,
  viewport,
  hasModel,
  isPlaying,
  manualOrbit: _manualOrbit,
  onTogglePlay,
  onToggleOrbit: _onToggleOrbit,
  onResetView: _onResetView,
  onShare,
  onExport,
  shareBusy,
  onTryDemo,
  onSave,
  onOpenProject,
  onClearScene,
  mobilePanelTab: _mobilePanelTab,
  onMobilePanelTabChange,
  renderPanel,
  renderWorkspaceTool,
  timeline,
  optimizedHint,
  uiMode,
  onUiModeChange,
  editorInterface,
  onEditorInterfaceChange,
  qualityMode,
  onQualityModeChange,
  onApplyTemplate,
  selectedObjectId = null,
  selectedBoneId = null,
  highlightMaterial = null,
  cameraMode = 'mmd',
  cameraDirectPlacement = true,
  models = [],
  transformMode = 'rotate',
  onTransformModeChange,
  onUndo,
  onRedo,
  onSetCameraMode,
  onEnterDirectCameraMode,
  viewportFormat = '16:9',
  onViewportFormatChange,
}: ProMobileShellProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ProMobileTab | null>(null);
  const [workspaceTool, setWorkspaceTool] = useState<MobileWorkspaceTool | null>(null);
  const [snapLevel, setSnapLevel] = useState<ProSnapLevel>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSnap, setMenuSnap] = useState<ProSnapLevel>(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const closeSheet = useCallback(() => {
    setActiveTab(null);
    setWorkspaceTool(null);
    setSnapLevel(0);
  }, []);

  const openTab = useCallback(
    (tab: ProMobileTab) => {
      if (activeTab === tab && !workspaceTool && snapLevel > 0) {
        closeSheet();
        return;
      }
      setMoreOpen(false);
      setWorkspaceTool(null);
      setActiveTab(tab);
      setSnapLevel(tab === 'control' ? 3 : 2);
      onMobilePanelTabChange(tab);
    },
    [activeTab, workspaceTool, snapLevel, closeSheet, onMobilePanelTabChange]
  );

  const openWorkspaceTool = useCallback(
    (tool: MobileWorkspaceTool) => {
      if (tool === 'more') {
        // More sits above sheets — close any open sheet first to avoid stacking fights.
        closeSheet();
        setMoreOpen(true);
        return;
      }
      if (workspaceTool === tool && snapLevel > 0) {
        closeSheet();
        return;
      }
      setMoreOpen(false);
      const proTab = workspaceToProTab(tool);
      setWorkspaceTool(tool);
      setActiveTab(proTab);
      setSnapLevel(prefersTallSheet(tool) ? 3 : 2);
      onMobilePanelTabChange(proTab);
    },
    [workspaceTool, snapLevel, closeSheet, onMobilePanelTabChange]
  );

  /** Top-bar video icon — open FX export panel instead of starting MP4 HQ (OOM on Android WebView). */
  const handleTopExport = useCallback(() => {
    openWorkspaceTool('render');
    onExport();
  }, [openWorkspaceTool, onExport]);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
    setMenuSnap(2);
    closeSheet();
  }, [closeSheet]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuSnap(0);
  }, []);

  const sheetOpen =
    snapLevel > 0 &&
    workspaceTool !== 'more' &&
    (workspaceTool !== null || activeTab !== null);
  const sheetTitle = workspaceTool
    ? workspaceToolTitle(workspaceTool)
    : activeTab
      ? TAB_TITLES[activeTab]
      : '';
  const isTimelineSheet =
    isTimelineWorkspaceTool(workspaceTool) ||
    (activeTab === 'control' && (workspaceTool === null || isTimelineWorkspaceTool(workspaceTool)));

  return (
    <div className="pro-mobile-shell flex-1 flex flex-col min-h-0 w-full relative">
      <div className="pro-mobile-chrome shrink-0">
        <ProMobileTopBar
          title={sceneTitle}
          onMenu={openMenu}
          onShare={onShare}
          onExport={handleTopExport}
          shareBusy={shareBusy}
        />
      </div>

      <div
        ref={stageRef}
        className="pro-viewport-stage am-viewport-priority am-home-stage flex-1 min-h-0 relative flex flex-col"
      >
        {viewport}
        {!sheetOpen && !moreOpen && onViewportFormatChange ? (
          <div className="am-aspect-chip absolute top-2 right-2 z-20 pointer-events-auto">
            <MobileAspectToggle
              format={viewportFormat}
              onChange={onViewportFormatChange}
              compact
            />
          </div>
        ) : null}
        <ProMobileOnboarding visible={!hasModel} onTryDemo={onTryDemo} />
        <MobileViewportChrome
          enabled={!sheetOpen && !moreOpen && !menuOpen}
          stageRef={stageRef}
          selectedObjectId={selectedObjectId}
          selectedBoneId={selectedBoneId}
          highlightMaterial={highlightMaterial}
          cameraMode={cameraMode}
          directPlacement={cameraDirectPlacement}
          models={models}
          isPlaying={isPlaying}
          transformMode={transformMode}
          onTransformMode={(m) => onTransformModeChange?.(m)}
          onUndo={() => onUndo?.()}
          onRedo={() => onRedo?.()}
          onTogglePlay={onTogglePlay}
          onOpenCamera={() => openWorkspaceTool('camera')}
          onOpenRender={() => openWorkspaceTool('render')}
          onOpenWorkspaceTool={openWorkspaceTool}
          onSetCameraMode={onSetCameraMode}
          onEnterDirectCameraMode={onEnterDirectCameraMode}
        />
      </div>

      {sheetOpen ? (
        <ProSnapBottomSheet
          open={sheetOpen}
          title={sheetTitle}
          snapLevel={snapLevel}
          sheetMode={isTimelineSheet ? 'timeline' : 'content'}
          onSnapChange={(lvl) => {
            if (lvl === 0) closeSheet();
            else setSnapLevel(lvl);
          }}
          onClose={closeSheet}
        >
          {workspaceTool === 'camera' && onSetCameraMode ? (
            <div className="am-sheet-camera-modes px-3 pt-2 pb-2 space-y-2">
              {onViewportFormatChange ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Aspect
                  </span>
                  <MobileAspectToggle
                    format={viewportFormat}
                    onChange={onViewportFormatChange}
                    compact
                  />
                </div>
              ) : null}
              <MobileCameraModeBar
                cameraMode={cameraMode}
                directPlacement={cameraDirectPlacement}
                onSetCameraMode={onSetCameraMode}
                onEnterDirectCameraMode={onEnterDirectCameraMode}
              />
            </div>
          ) : null}
          {isTimelineSheet && timeline ? (
            <ProMobileControlPanel timeline={timeline} />
          ) : workspaceTool && renderWorkspaceTool ? (
            <div className="pro-sheet-panel">{renderWorkspaceTool(workspaceTool)}</div>
          ) : activeTab ? (
            <div className="pro-sheet-panel">{renderPanel(activeTab)}</div>
          ) : null}
        </ProSnapBottomSheet>
      ) : null}

      <MobileMoreSheet
        open={moreOpen}
        active={workspaceTool}
        onClose={() => setMoreOpen(false)}
        onSelect={(tool) => {
          setMoreOpen(false);
          openWorkspaceTool(tool);
        }}
      />

      <ProMobileMenuSheet
        open={menuOpen}
        snapLevel={menuSnap}
        onSnapChange={(lvl) => {
          if (lvl === 0) closeMenu();
          else setMenuSnap(lvl);
        }}
        onClose={closeMenu}
        onTryDemo={onTryDemo}
        onSave={onSave}
        onOpenProject={onOpenProject}
        onClearScene={onClearScene}
        onOpenFxTab={() => openTab('fx')}
        uiMode={uiMode}
        onUiModeChange={onUiModeChange}
        editorInterface={editorInterface}
        onEditorInterfaceChange={onEditorInterfaceChange}
        qualityMode={qualityMode}
        onQualityModeChange={onQualityModeChange}
        optimizedHint={optimizedHint}
        onApplyTemplate={onApplyTemplate}
      />

      <MobileToolRail
        active={workspaceTool}
        onSelect={openWorkspaceTool}
        isPlaying={isPlaying}
        onPlay={onTogglePlay}
      />
    </div>
  );
}
