import React, { useEffect, useState } from 'react';
import { 
  FolderOpen, 
  Settings, 
  Award, 
  Play, 
  Trash2, 
  Grid,
  Sparkles,
  HelpCircle,
  Video,
  Database,
  Camera as CameraIcon,
  Clapperboard,
  Layers,
  Cpu,
  Music2,
  Film,
  X,
  Menu,
} from 'lucide-react';
import {
  CharacterQuality,
  PhysicsMode,
  RtxSettings,
  TemplateApplyMode,
  ViewportFormat,
  VisualFxSettings,
  MmdLiteConfig,
  CameraSnapshot,
  PathTracerSettings,
} from '../types';
import FxSettingsPanel from './FxSettingsPanel';
import type { useVisualStyles } from '../stylePacks/useVisualStyles';
import type { VcsApi } from '../product/vcs';
import type { AppState } from '../types';
import type { SceneComposerState } from '../sceneComposer';
import type { SmartVideoMetadata, SmartMetadataLocale, SocialPlatformId } from '../smartMetadata/types';
import { ANIMATION_TEMPLATES, TEMPLATE_CATEGORY_LABELS, DANCE_PICKER_CATEGORIES } from '../templates/animationTemplates';

type VisualStylesApi = ReturnType<typeof useVisualStyles>;

interface TopMenuProps {
  physicsMode: PhysicsMode;
  setPhysicsMode: (mode: PhysicsMode) => void;
  onLoadModel: (preset: 'kizuna' | 'miku' | 'custom') => void;
  onClearScene: () => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  showBones: boolean;
  setShowBones: (show: boolean) => void;
  showCameraHelper: boolean;
  setShowCameraHelper: (show: boolean) => void;
  showPhysicsBodies: boolean;
  setShowPhysicsBodies: (show: boolean) => void;
  onAddSampleKeyframes: () => void;
  onApplyTemplate: (templateId: string, mode?: TemplateApplyMode) => void;
  visualFx: VisualFxSettings;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  rtxModeEnabled: boolean;
  onSetRtxModeEnabled: (enabled: boolean) => void;
  characterQuality: CharacterQuality;
  onCharacterQualityChange: (quality: CharacterQuality) => void;
  rtxSettings: RtxSettings;
  onPatchRtxSettings: (patch: Partial<RtxSettings>) => void;
  viewportFormat?: ViewportFormat;
  selectedModelHasVmd?: boolean;
  vmdPlaybackEnabled?: boolean;
  onToggleVmdPlayback?: () => void;
  mmdLite?: MmdLiteConfig;
  onPatchMmdLite?: (patch: Partial<MmdLiteConfig>) => void;
  captureCamera?: () => CameraSnapshot | null;
  onFlyToBookmark?: (snapshot: CameraSnapshot) => void;
  onRestartPhysics?: () => void;
  onFixPhysics?: () => void;
  videoRecordBusy?: boolean;
  videoRecordMode?: 'idle' | 'offline' | 'live';
  exportDurationSec?: number;
  maxExportDurationSec?: number;
  onExportDurationSecChange?: (sec: number) => void;
  onRenderMp4?: () => void;
  onLiveRecord?: () => void;
  onCinemaRender?: () => void;
  videoMetadata?: SmartVideoMetadata | null;
  showVideoInformation?: boolean;
  onRegenerateMetadata?: () => void;
  onMetadataLocaleChange?: (locale: SmartMetadataLocale) => void;
  onMetadataPlatformChange?: (platform: SocialPlatformId) => void;
  onMetadataTitleSelect?: (index: number) => void;
  onMetadataCopyFeedback?: (message: string) => void;
  onExportVmd?: () => void;
  onNewClip?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSimplifyTrack?: () => void;
  onClearTrack?: () => void;
  onTimeStretch125?: () => void;
  onTimeStretch080?: () => void;
  isMobile?: boolean;
  mobileNavOpen?: boolean;
  onMobileNavOpenChange?: (open: boolean) => void;
  openMenuId?: string | null;
  onOpenMenuIdChange?: (id: string | null) => void;
  onTryDemo?: () => void;
  pathTracerLabEnabled?: boolean;
  pathTracer?: PathTracerSettings;
  onSetPathTracerLabEnabled?: (enabled: boolean) => void;
  onPatchPathTracer?: (patch: Partial<PathTracerSettings>) => void;
  onOpenSmartStudio?: () => void;
  onEnterSmartStudioMode?: (mode: 'showcase' | 'photo' | 'video') => void;
  onOpenCineStudio?: () => void;
  onOpenReferenceCameraStudio?: () => void;
  visualStyles?: VisualStylesApi;
  vcs?: VcsApi;
  appState?: AppState;
  onPatchSceneComposer?: (patch: Partial<SceneComposerState>) => void;
  onReplaceSceneComposer?: (next: SceneComposerState) => void;
}

export default function TopMenu({
  physicsMode,
  setPhysicsMode,
  onLoadModel,
  onClearScene,
  showGrid,
  setShowGrid,
  showBones,
  setShowBones,
  showCameraHelper,
  setShowCameraHelper,
  showPhysicsBodies,
  setShowPhysicsBodies,
  onAddSampleKeyframes,
  onApplyTemplate,
  visualFx,
  onSetVisualFx,
  rtxModeEnabled,
  onSetRtxModeEnabled,
  characterQuality,
  onCharacterQualityChange,
  rtxSettings,
  onPatchRtxSettings,
  viewportFormat = '16:9',
  selectedModelHasVmd = false,
  vmdPlaybackEnabled = true,
  onToggleVmdPlayback,
  mmdLite,
  onPatchMmdLite,
  captureCamera,
  onFlyToBookmark,
  onRestartPhysics,
  onFixPhysics,
  videoRecordBusy,
  videoRecordMode,
  exportDurationSec,
  maxExportDurationSec,
  onExportDurationSecChange,
  onRenderMp4,
  onLiveRecord,
  onCinemaRender,
  videoMetadata,
  showVideoInformation,
  onRegenerateMetadata,
  onMetadataLocaleChange,
  onMetadataPlatformChange,
  onMetadataTitleSelect,
  onMetadataCopyFeedback,
  onExportVmd,
  onNewClip,
  onUndo,
  onRedo,
  onSimplifyTrack,
  onClearTrack,
  onTimeStretch125,
  onTimeStretch080,
  isMobile = false,
  mobileNavOpen = false,
  onMobileNavOpenChange,
  openMenuId = null,
  onOpenMenuIdChange,
  onTryDemo,
  pathTracerLabEnabled,
  pathTracer,
  onSetPathTracerLabEnabled,
  onPatchPathTracer,
  onOpenSmartStudio,
  onEnterSmartStudioMode,
  onOpenCineStudio,
  onOpenReferenceCameraStudio,
  visualStyles,
  vcs,
  appState,
  onPatchSceneComposer,
  onReplaceSceneComposer,
}: TopMenuProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const closeMenu = () => {
    setActiveMenu(null);
    onOpenMenuIdChange?.(null);
  };

  useEffect(() => {
    if (openMenuId === 'fx') setActiveMenu('fx');
    if (openMenuId === null) {
      setActiveMenu((m) => (m === 'fx' ? null : m));
    }
  }, [openMenuId]);

  const toggleMenu = (menu: string) => {
    const next = activeMenu === menu ? null : menu;
    setActiveMenu(next);
    onOpenMenuIdChange?.(next);
  };

  const closeMobileNav = () => onMobileNavOpenChange?.(false);

  const handleMenuClick = (action: () => void) => {
    action();
    closeMenu();
  };

  const menuItems = [
    {
      id: 'file',
      label: 'File',
      items: [
        {
          label: 'Load Miku Preset (.pmx)',
          icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
          action: () => onLoadModel('miku')
        },
        {
          label: 'Load Kizuna Preset (.pmx)',
          icon: <Sparkles className="w-4 h-4 text-pink-400" />,
          action: () => onLoadModel('kizuna')
        },
        {
          label: 'Import Custom Model...',
          icon: <FolderOpen className="w-4 h-4 text-sky-400" />,
          action: () => onLoadModel('custom')
        },
        {
          type: 'separator'
        },
        {
          label: 'New Clip (clear timeline)',
          icon: <Film className="w-4 h-4 text-violet-400" />,
          action: () => onNewClip?.(),
        },
        {
          label: 'Export VMD…',
          icon: <Film className="w-4 h-4 text-[#39c5bb]" />,
          action: () => onExportVmd?.(),
        },
        {
          type: 'separator'
        },
        {
          label: 'Clear Workspace',
          icon: <Trash2 className="w-4 h-4 text-red-400" />,
          action: onClearScene
        }
      ]
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        {
          label: 'Undo (Ctrl+Z)',
          icon: <Play className="w-4 h-4 text-zinc-400 rotate-180" />,
          action: () => onUndo?.(),
        },
        {
          label: 'Redo (Ctrl+Y)',
          icon: <Play className="w-4 h-4 text-zinc-400" />,
          action: () => onRedo?.(),
        },
        { type: 'separator' },
        {
          label: 'Simplify track',
          icon: <Play className="w-4 h-4 text-cyan-400" />,
          action: () => onSimplifyTrack?.(),
        },
        {
          label: 'Clear track',
          icon: <Trash2 className="w-4 h-4 text-red-400" />,
          action: () => onClearTrack?.(),
        },
        {
          label: 'Time stretch ×1.25',
          action: () => onTimeStretch125?.(),
        },
        {
          label: 'Time stretch ×0.8',
          action: () => onTimeStretch080?.(),
        },
        { type: 'separator' },
        {
          label: 'Quick: Wave Arms (Character)',
          icon: <Play className="w-4 h-4 text-amber-400" />,
          action: onAddSampleKeyframes
        },
      ]
    },
    {
      id: 'dance',
      label: 'Dance',
      items: [
        ...DANCE_PICKER_CATEGORIES.flatMap((cat) => [
          {
            type: 'header' as const,
            label: TEMPLATE_CATEGORY_LABELS[cat],
          },
          ...ANIMATION_TEMPLATES.filter((t) => t.category === cat).map((tpl) => ({
            label: tpl.name,
            icon:
              cat === 'dance' ? (
                <Music2 className="w-4 h-4 text-[#39c5bb]" />
              ) : cat === 'camera' ? (
                <CameraIcon className="w-4 h-4 text-sky-400" />
              ) : cat === 'emote' ? (
                <Sparkles className="w-4 h-4 text-[#e879ff]" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400" />
              ),
            action: () => onApplyTemplate(tpl.id, 'merge'),
          })),
        ]),
      ],
    },
    {
      id: 'motion',
      label: 'Motion',
      items: [
        {
          label: vmdPlaybackEnabled ? 'Disable Imported VMD' : 'Enable Imported VMD',
          icon: <Film className={`w-4 h-4 ${vmdPlaybackEnabled ? 'text-[#39c5bb]' : 'text-zinc-500'}`} />,
          action: () => onToggleVmdPlayback?.(),
        },
      ],
    },
    {
      id: 'templates',
      label: 'Templates',
      items: [
        {
          type: 'header' as const,
          label: TEMPLATE_CATEGORY_LABELS.character,
        },
        ...ANIMATION_TEMPLATES.filter((t) => t.category === 'character').map((tpl) => ({
          label: tpl.name,
          icon: <Sparkles className="w-4 h-4 text-[#e879ff]" />,
          action: () => onApplyTemplate(tpl.id, 'merge'),
        })),
      ],
    },
    {
      id: 'physics',
      label: 'Physics',
      items: [
        {
          label: 'On Anytime (Real-time)',
          icon: <Cpu className={`w-4 h-4 ${physicsMode === 'anytime' ? 'text-emerald-400' : ''}`} />,
          action: () => setPhysicsMode('anytime')
        },
        {
          label: 'Only on Timeline Playback',
          icon: <Cpu className={`w-4 h-4 ${physicsMode === 'playtime' ? 'text-blue-400' : ''}`} />,
          action: () => setPhysicsMode('playtime')
        },
        {
          label: 'Disable Physics (Off)',
          icon: <Cpu className={`w-4 h-4 ${physicsMode === 'off' ? 'text-gray-400' : ''}`} />,
          action: () => setPhysicsMode('off')
        }
      ]
    },
    {
      id: 'view',
      label: 'Viewport / View',
      items: [
        {
          label: showGrid ? 'Hide Grid Platform' : 'Show Grid Platform',
          icon: <Grid className={`w-4 h-4 ${showGrid ? 'text-emerald-400' : ''}`} />,
          action: () => setShowGrid(!showGrid)
        },
        {
          label: showBones ? 'Hide Bone Nodes' : 'Show Bone Nodes',
          icon: <Layers className={`w-4 h-4 ${showBones ? 'text-emerald-400' : ''}`} />,
          action: () => setShowBones(!showBones)
        },
        {
          label: showCameraHelper ? 'Hide Camera Guide' : 'Show Camera Guide',
          icon: <CameraIcon className={`w-4 h-4 ${showCameraHelper ? 'text-emerald-400' : ''}`} />,
          action: () => setShowCameraHelper(!showCameraHelper)
        },
        ...(onOpenCineStudio
          ? [
              {
                label: 'Cine Studio',
                icon: <Clapperboard className="w-4 h-4 text-cyan-400" />,
                action: () => onOpenCineStudio(),
              },
            ]
          : []),
        ...(onOpenReferenceCameraStudio
          ? [
              {
                label: 'Reference Camera Studio',
                icon: <CameraIcon className="w-4 h-4 text-pink-400" />,
                action: () => onOpenReferenceCameraStudio(),
              },
            ]
          : []),
        {
          label: showPhysicsBodies ? 'Hide Physics Hitboxes' : 'Show Physics Hitboxes',
          icon: <Cpu className={`w-4 h-4 ${showPhysicsBodies ? 'text-emerald-400' : ''}`} />,
          action: () => setShowPhysicsBodies(!showPhysicsBodies)
        },
      ]
    },
    {
      id: 'fx',
      label: 'FX',
      panel: true,
    },
  ];

  const renderMenuPanel = (menu: (typeof menuItems)[number]) => {
    if ('panel' in menu && menu.panel) {
      return (
        <div className="mt-2 w-full max-h-[min(70dvh,520px)] overflow-y-auto bg-[#1a1d24] border border-[#2c3245] rounded-md shadow-lg">
          <FxSettingsPanel
            visualFx={visualFx}
            mmdLite={mmdLite}
            rtxModeEnabled={rtxModeEnabled}
            rtxSettings={rtxSettings}
            characterQuality={characterQuality}
            viewportFormat={viewportFormat}
            onSetVisualFx={onSetVisualFx}
            onPatchMmdLite={onPatchMmdLite}
            onSetRtxModeEnabled={onSetRtxModeEnabled}
            onPatchRtxSettings={onPatchRtxSettings}
            onCharacterQualityChange={onCharacterQualityChange}
            captureCamera={captureCamera}
            onFlyToBookmark={onFlyToBookmark}
            onRestartPhysics={onRestartPhysics}
            onFixPhysics={onFixPhysics}
            videoRecordBusy={videoRecordBusy}
            videoRecordMode={videoRecordMode}
            exportDurationSec={exportDurationSec}
            maxExportDurationSec={maxExportDurationSec}
            onExportDurationSecChange={onExportDurationSecChange}
            onRenderMp4={onRenderMp4}
            onLiveRecord={onLiveRecord}
            onCinemaRender={onCinemaRender}
            videoMetadata={videoMetadata}
            showVideoInformation={showVideoInformation}
            onRegenerateMetadata={onRegenerateMetadata}
            onMetadataLocaleChange={onMetadataLocaleChange}
            onMetadataPlatformChange={onMetadataPlatformChange}
            onMetadataTitleSelect={onMetadataTitleSelect}
            onMetadataCopyFeedback={onMetadataCopyFeedback}
            pathTracerLabEnabled={pathTracerLabEnabled}
            pathTracer={pathTracer}
            onSetPathTracerLabEnabled={onSetPathTracerLabEnabled}
            onPatchPathTracer={onPatchPathTracer}
            onOpenSmartStudio={onOpenSmartStudio}
            onEnterSmartStudioMode={onEnterSmartStudioMode}
            onOpenCineStudio={onOpenCineStudio}
            onOpenReferenceCameraStudio={onOpenReferenceCameraStudio}
            visualStyles={visualStyles}
            vcs={vcs}
            appState={appState}
            onPatchSceneComposer={onPatchSceneComposer}
            onReplaceSceneComposer={onReplaceSceneComposer}
          />
        </div>
      );
    }
    return (
      <div className="mt-2 w-full max-h-[min(60dvh,480px)] overflow-y-auto bg-[#1a1d24] border border-[#2c3245] rounded-md p-1.5">
        {menu.items!.map((item, index) => {
          if ('type' in item && item.type === 'separator') {
            return <div key={index} className="h-px bg-[#2a2e38] my-1" />;
          }
          if ('type' in item && item.type === 'header') {
            const headerItem = item as { label: string };
            return (
              <div
                key={index}
                className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase text-[#e879ff] tracking-wide"
              >
                {headerItem.label}
              </div>
            );
          }
          const regularItem = item as { label: string; icon: React.ReactNode; action: () => void };
          return (
            <button
              key={index}
              onClick={() => handleMenuClick(regularItem.action)}
              className="w-full flex items-center gap-2 px-3 py-3 text-sm text-zinc-300 hover:text-white hover:bg-[#20242e] text-left font-semibold cursor-pointer rounded-sm"
            >
              {regularItem.icon}
              <span>{regularItem.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <header
      className={`bg-[#16181d] border-b border-[#22252c] flex items-center justify-between select-none text-zinc-100 font-sans shadow-md shrink-0 pt-[env(safe-area-inset-top)] ${
        isMobile
          ? 'h-10 min-h-[40px] px-2 studio-mobile-header'
          : 'h-11 md:h-11 min-h-[44px] px-3 md:px-4'
      }`}
      id="mmd-top-menu"
    >
      {/* Brand Logo and Menu Column */}
      <div className="flex items-center space-x-2 md:space-x-6 min-w-0">
        {isMobile && onMobileNavOpenChange ? (
          <button
            type="button"
            onClick={() => onMobileNavOpenChange(!mobileNavOpen)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-zinc-300 active:text-[#39c5bb] active:bg-[#252a35] cursor-pointer shrink-0"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        ) : null}
        <div className="flex items-center space-x-2 min-w-0">
          <div className="bg-teal-950/85 p-1.5 border border-teal-500/35 rounded shadow-sm shrink-0">
            <Video className="w-3.5 h-3.5 text-[#39c5bb]" />
          </div>
          <span className="font-sans font-extrabold text-[10px] md:text-xs tracking-wider text-zinc-150 flex items-center gap-1 uppercase truncate">
            AnimaStage <span className="text-[#39c5bb]">Lite</span>
            <span className="hidden sm:inline text-[9px] bg-[#1a1d24] text-zinc-500 px-1.5 py-0.5 rounded font-mono font-medium border border-[#2c3240] ml-1">
              WebMMD
            </span>
          </span>
        </div>
 
        {/* Desktop dropdowns */}
        <div className="topmenu-desktop-menus hidden md:flex items-center space-x-1">
          {menuItems.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                id={`menuBtn-${menu.id}`}
                onClick={() => toggleMenu(menu.id)}
                className={`px-3 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                  activeMenu === menu.id 
                    ? 'bg-[#222630] text-[#39c5bb] border border-teal-500/20 shadow-inner' 
                    : 'text-zinc-300 hover:bg-[#1e212a] hover:text-[#39c5bb]'
                } ${menu.id === 'fx' && rtxModeEnabled ? 'text-[#76b900]' : ''}`}
              >
                {menu.label}
                {menu.id === 'fx' && rtxModeEnabled && (
                  <span className="ml-1 text-[8px] text-[#76b900]">●</span>
                )}
              </button>
              
              {activeMenu === menu.id && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setActiveMenu(null)}
                  />
                  {'panel' in menu && menu.panel ? (
                    <div className="absolute left-0 mt-1.5 w-72 max-h-[80dvh] overflow-y-auto bg-[#1a1d24] border border-[#2c3245] shadow-[0_10px_25px_rgba(0,0,0,0.5)] z-50 rounded-md">
                      <div className="px-2 py-2 border-b border-zinc-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#76b900] uppercase tracking-wide">
                          FX & RTX
                        </span>
                        {rtxModeEnabled && (
                          <span className="text-[8px] font-mono text-cyan-400">RTX ON</span>
                        )}
                      </div>
                      <FxSettingsPanel
                        visualFx={visualFx}
                        mmdLite={mmdLite}
                        rtxModeEnabled={rtxModeEnabled}
                        rtxSettings={rtxSettings}
                        characterQuality={characterQuality}
                        viewportFormat={viewportFormat}
                        onSetVisualFx={onSetVisualFx}
                        onPatchMmdLite={onPatchMmdLite}
                        onSetRtxModeEnabled={onSetRtxModeEnabled}
                        onPatchRtxSettings={onPatchRtxSettings}
                        onCharacterQualityChange={onCharacterQualityChange}
                        captureCamera={captureCamera}
                        onFlyToBookmark={onFlyToBookmark}
                        onRestartPhysics={onRestartPhysics}
            onFixPhysics={onFixPhysics}
                        videoRecordBusy={videoRecordBusy}
                        videoRecordMode={videoRecordMode}
                        exportDurationSec={exportDurationSec}
                        maxExportDurationSec={maxExportDurationSec}
                        onExportDurationSecChange={onExportDurationSecChange}
                        onRenderMp4={onRenderMp4}
                        onLiveRecord={onLiveRecord}
                        onCinemaRender={onCinemaRender}
                        videoMetadata={videoMetadata}
                        showVideoInformation={showVideoInformation}
                        onRegenerateMetadata={onRegenerateMetadata}
                        onMetadataLocaleChange={onMetadataLocaleChange}
                        onMetadataPlatformChange={onMetadataPlatformChange}
                        onMetadataTitleSelect={onMetadataTitleSelect}
                        onMetadataCopyFeedback={onMetadataCopyFeedback}
                        pathTracerLabEnabled={pathTracerLabEnabled}
                        pathTracer={pathTracer}
                        onSetPathTracerLabEnabled={onSetPathTracerLabEnabled}
                        onPatchPathTracer={onPatchPathTracer}
                        onOpenSmartStudio={onOpenSmartStudio}
                        onEnterSmartStudioMode={onEnterSmartStudioMode}
                        onOpenCineStudio={onOpenCineStudio}
            onOpenReferenceCameraStudio={onOpenReferenceCameraStudio}
                        visualStyles={visualStyles}
                        vcs={vcs}
                        appState={appState}
                        onPatchSceneComposer={onPatchSceneComposer}
                        onReplaceSceneComposer={onReplaceSceneComposer}
                      />
                    </div>
                  ) : (
                  <div className="absolute left-0 mt-1.5 w-60 max-h-[70dvh] overflow-y-auto bg-[#1a1d24] border border-[#2c3245] shadow-[0_10px_25px_rgba(0,0,0,0.5)] p-1.5 z-50 rounded-md animate-in fade-in duration-75">
                    {menu.items!.map((item, index) => {
                      if ('type' in item && item.type === 'separator') {
                        return <div key={index} className="h-px bg-[#2a2e38] my-1" />;
                      }
                      if ('type' in item && item.type === 'header') {
                        const headerItem = item as { label: string };
                        return (
                          <div
                            key={index}
                            className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase text-[#e879ff] tracking-wide"
                          >
                            {headerItem.label}
                          </div>
                        );
                      }
                      
                      const regularItem = item as { label: string; icon: React.ReactNode; action: () => void };
                      return (
                        <button
                          key={index}
                          onClick={() => handleMenuClick(regularItem.action)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#20242e] hover:border-l-2 hover:border-[#39c5bb] transition-all text-left font-semibold cursor-pointer rounded-sm group"
                        >
                          <span className="flex items-center space-x-2">
                            <span className="group-hover:brightness-125">{regularItem.icon}</span>
                            <span>{regularItem.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: active menu sheet (FX or picked section) */}
      {isMobile && activeMenu && !mobileNavOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60 md:hidden" onClick={closeMenu} />
          <div className="fixed inset-x-0 top-11 bottom-[calc(52px+env(safe-area-inset-bottom))] z-[61] md:hidden overflow-y-auto p-3 bg-[#121418]/98">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase text-[#39c5bb]">
                {menuItems.find((m) => m.id === activeMenu)?.label}
              </span>
              <button
                type="button"
                onClick={closeMenu}
                className="p-2 text-zinc-400 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {menuItems
              .filter((m) => m.id === activeMenu)
              .map((m) => (
                <div key={m.id}>{renderMenuPanel(m)}</div>
              ))}
          </div>
        </>
      )}

      {/* Mobile: main nav grid */}
      {isMobile && mobileNavOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/70 md:hidden" onClick={closeMobileNav} />
          <div className="fixed inset-x-0 top-11 bottom-[calc(52px+env(safe-area-inset-bottom))] z-[61] md:hidden overflow-y-auto p-4 bg-[#121418]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-zinc-200">Studio menu</span>
              <button type="button" onClick={closeMobileNav} className="p-2 cursor-pointer" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {menuItems.map((menu) => (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => {
                    setActiveMenu(menu.id);
                    closeMobileNav();
                  }}
                  className={`py-4 px-3 rounded-lg border text-sm font-bold cursor-pointer ${
                    menu.id === 'fx' && rtxModeEnabled
                      ? 'border-[#76b900]/40 bg-[#1a2e1a] text-[#76b900]'
                      : 'border-[#2c3240] bg-[#1a1d24] text-zinc-200 active:bg-[#252a35]'
                  }`}
                >
                  {menu.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
 
      {/* Right Tools Info / Status Bar */}
      <div className="flex items-center space-x-2 md:space-x-4 shrink-0 topmenu-mobile-actions">
        {isMobile && onTryDemo ? (
          <button
            type="button"
            onClick={onTryDemo}
            className="min-h-[44px] px-3 py-1.5 rounded-md border border-[#39c5bb]/40 bg-[#39c5bb]/15 text-[#39c5bb] text-[10px] font-bold uppercase cursor-pointer"
          >
            Try Demo
          </button>
        ) : null}
        {isMobile && onRenderMp4 ? (
          <button
            type="button"
            onClick={onRenderMp4}
            className="min-h-[44px] px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 text-[10px] font-bold uppercase cursor-pointer"
          >
            Export
          </button>
        ) : null}
        <div className="hidden lg:flex items-center space-x-2.5 text-[11px] font-mono text-zinc-400">
          <span className="flex items-center gap-1.5 font-bold text-[#39c5bb]">
            <Cpu className="w-3.5 h-3.5 text-[#39c5bb]" /> WebGL Engine
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-400">Physics:</span> 
          <span className={`px-2 py-0.5 text-[9px] uppercase font-mono font-bold border rounded-sm ${
            physicsMode === 'anytime' ? 'bg-[#1b4332] text-[#4ea86d] border-[#2d6a4f]' :
            physicsMode === 'playtime' ? 'bg-[#3d191c] text-[#df1846] border-[#5a181c]' :
            'bg-zinc-800 text-zinc-400 border-zinc-700'
          }`}>
            {physicsMode}
          </span>
        </div>
 
        <button 
          onClick={() => alert('WebMMD Studio Help:\n1. Load Preset Model representing PMX under File\n2. Manipulate mouth/eyes/brow sliders in bottom boxes\n3. Select bones inside Viewport or bone list to rotate\n4. Push register keyframe buttons to record poses\n5. Press Play to animate!')}
          className="p-1.5 rounded border border-[#2c3240] bg-[#1a1d24] hover:bg-[#242935] hover:border-[#39c5bb]/30 text-zinc-400 hover:text-[#39c5bb] transition-all"
          title="App help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
