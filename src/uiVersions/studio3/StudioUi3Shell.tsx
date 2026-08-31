/**
 * UI 3.0 Studio shell — dockable workspace hosting REAL feature panels.
 * No classic Sidebar dump, no placeholder stubs.
 * Mobile adaptive: CapCut-style top bar + tool rail + snap sheets.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Crosshair,
  Download,
  FolderOpen,
  Gauge,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Save,
  Search,
  Share2,
  Smartphone,
  Upload,
  Video,
  Wand2,
} from 'lucide-react';
import type { StudioUiMode } from '../../flow/types';
import type { QualityMode } from '../../product/scene/types';
import type { EditorInterfaceId } from '../types';
import UiVersionSwitcher from '../UiVersionSwitcher';
import { useAdaptiveStudio } from '../../hooks/useAdaptiveStudio';
import ProSnapBottomSheet from '../../layout/proMobile/ProSnapBottomSheet';
import type { ProSnapLevel } from '../../layout/proMobile/types';
import {
  MobileToolRail,
  MobileViewportChrome,
  MobileMoreSheet,
  MobileCameraModeBar,
  MobileAspectToggle,
  workspaceToStudioPanel,
  workspaceToolTitle,
  isTimelineWorkspaceTool,
  prefersTallSheet,
  type MobileTransformMode,
  type MobileWorkspaceTool,
} from '../../layout/adaptiveMobile';
import {
  DEFAULT_STUDIO3_LAYOUT,
  exportStudio3LayoutJson,
  importStudio3LayoutJson,
  loadStudio3Layout,
  normalizeStudio3Layout,
  saveStudio3Layout,
  type Studio3PanelId,
  type Studio3WorkspaceLayout,
} from './workspaceLayout';
import { STUDIO_PANEL_EVENT, STUDIO_EDITOR_TAB_EVENT } from '../../sceneDirector/panelNavigation';
import {
  STUDIO3_TOOLS,
  findStudio3Tool,
  studio3ToolsByGroup,
} from './studio3Tools';

export interface StudioUi3ShellProps {
  /** Real feature panels keyed by dock id — required for a complete UI 3.0. */
  panels: Partial<Record<Studio3PanelId, ReactNode>>;
  viewport: ReactNode;
  timeline?: ReactNode;
  /** Full TopMenu (File / Edit / Dance / FX / …) — same actions as UI 1.0. */
  menubar?: ReactNode;
  editorInterface: EditorInterfaceId;
  onEditorInterfaceChange: (id: EditorInterfaceId) => void;
  uiMode: StudioUiMode;
  onUiModeChange: (mode: StudioUiMode) => void;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onLoadProjectFile: () => void;
  onShareScene: () => void;
  onCreateShort: () => void;
  onExportMp4?: () => void;
  hasSavedProject: boolean;
  shareBusy?: boolean;
  sceneTitle?: string;
  hasModel?: boolean;
  onLoadDemo?: () => void;
  onOpenOneClick?: () => void;
  onOpenUiComparison?: () => void;
  /** Adaptive Mobile Framework */
  isPlaying?: boolean;
  onTogglePlay?: () => void;
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

const RIGHT_TOOLS: { id: Studio3PanelId; label: string }[] = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'fx', label: 'FX' },
  { id: 'ai', label: 'AI' },
];

function openLeftPanel(
  updateLayout: (patch: Partial<Studio3WorkspaceLayout>) => void,
  layout: Studio3WorkspaceLayout,
  id: Studio3PanelId
) {
  updateLayout({
    leftPanel: id,
    showLeft: layout.leftPanel === id ? !layout.showLeft : true,
  });
}

function PanelChrome({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="studio3-panel">
      <div className="shrink-0 flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-[#1e2430] bg-[#12161e]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">
          {title}
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            Hide
          </button>
        ) : null}
      </div>
      <div className="studio3-panel__body">{children}</div>
    </div>
  );
}

function resolvePanel(
  panels: Partial<Record<Studio3PanelId, ReactNode>>,
  id: Studio3PanelId,
  title: string
): ReactNode {
  const node = panels[id];
  if (node) return node;
  return (
    <div className="p-3 text-[11px] text-amber-300/90">
      Missing panel: {title}. This should be wired from App.
    </div>
  );
}

export default function StudioUi3Shell({
  panels,
  viewport,
  timeline,
  menubar,
  editorInterface,
  onEditorInterfaceChange,
  uiMode,
  onUiModeChange,
  qualityMode,
  onQualityModeChange,
  onSaveProject,
  onLoadProject,
  onLoadProjectFile,
  onShareScene,
  onCreateShort,
  onExportMp4,
  hasSavedProject,
  shareBusy = false,
  sceneTitle = 'Untitled',
  hasModel = true,
  onLoadDemo,
  onOpenOneClick,
  onOpenUiComparison,
  isPlaying = false,
  onTogglePlay,
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
}: StudioUi3ShellProps) {
  const adaptive = useAdaptiveStudio();
  const mobileAdaptive =
    adaptive.panelChrome === 'sheet' ||
    adaptive.panelChrome === 'drawer' ||
    adaptive.useBottomNav;
  const [layout, setLayout] = useState<Studio3WorkspaceLayout>(() => loadStudio3Layout());
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [mobileTool, setMobileTool] = useState<MobileWorkspaceTool | null>(null);
  const [mobileSnap, setMobileSnap] = useState<ProSnapLevel>(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const viewportHostRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didPrioritizeRef = useRef<string | null>(null);

  const updateLayout = useCallback((patch: Partial<Studio3WorkspaceLayout>) => {
    setLayout((prev) => {
      let changed = false;
      for (const key of Object.keys(patch) as (keyof Studio3WorkspaceLayout)[]) {
        if (patch[key] !== prev[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;
      const next = normalizeStudio3Layout({ ...prev, ...patch });
      if (
        next.leftWidth === prev.leftWidth &&
        next.rightWidth === prev.rightWidth &&
        next.bottomHeight === prev.bottomHeight &&
        next.leftPanel === prev.leftPanel &&
        next.rightPanel === prev.rightPanel &&
        next.showLeft === prev.showLeft &&
        next.showRight === prev.showRight &&
        next.showBottom === prev.showBottom &&
        next.showPerf === prev.showPerf &&
        next.name === prev.name
      ) {
        return prev;
      }
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => saveStudio3Layout(next), 200);
      return next;
    });
  }, []);

  // Prioritize viewport on compact layouts — collapse secondary docks once per layout id.
  useEffect(() => {
    if (!adaptive.prioritizeViewport) return;
    if (didPrioritizeRef.current === adaptive.layoutId) return;
    didPrioritizeRef.current = adaptive.layoutId;
    updateLayout({
      showRight: false,
      showBottom: adaptive.timelineMode !== 'floating',
    });
  }, [adaptive.layoutId, adaptive.prioritizeViewport, adaptive.timelineMode, updateLayout]);

  useEffect(() => {
    const ping = () => window.dispatchEvent(new Event('resize'));
    const a = requestAnimationFrame(() => {
      ping();
      requestAnimationFrame(ping);
    });
    const t = window.setTimeout(ping, 120);
    return () => {
      cancelAnimationFrame(a);
      window.clearTimeout(t);
    };
  }, [
    layout.showLeft,
    layout.showRight,
    layout.showBottom,
    layout.leftWidth,
    layout.rightWidth,
    layout.bottomHeight,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const leftTitle =
    findStudio3Tool(layout.leftPanel)?.label ??
    RIGHT_TOOLS.find((t) => t.id === layout.leftPanel)?.label ??
    'Panel';
  const rightTitle =
    RIGHT_TOOLS.find((t) => t.id === layout.rightPanel)?.label ?? 'Inspector';

  const toolGroups = useMemo(() => studio3ToolsByGroup(), []);

  const openTool = useCallback(
    (id: Studio3PanelId) => {
      updateLayout({ leftPanel: id, showLeft: true });
      setCommandOpen(false);
    },
    [updateLayout]
  );

  useEffect(() => {
    const onPanelRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ id: Studio3PanelId }>).detail;
      if (detail?.id) openTool(detail.id);
    };
    window.addEventListener(STUDIO_PANEL_EVENT, onPanelRequest);
    return () => window.removeEventListener(STUDIO_PANEL_EVENT, onPanelRequest);
  }, [openTool]);

  useEffect(() => {
    const onEditorTab = () => {
      updateLayout({ showBottom: true });
    };
    window.addEventListener(STUDIO_EDITOR_TAB_EVENT, onEditorTab);
    return () => window.removeEventListener(STUDIO_EDITOR_TAB_EVENT, onEditorTab);
  }, [updateLayout]);

  const leftBody = useMemo(
    () => resolvePanel(panels, layout.leftPanel, leftTitle),
    [panels, layout.leftPanel, leftTitle]
  );
  const rightBody = useMemo(
    () => resolvePanel(panels, layout.rightPanel, rightTitle),
    [panels, layout.rightPanel, rightTitle]
  );

  const commands = useMemo(
    () => [
      {
        id: 'ui1',
        label: 'Switch to UI 1.0 (Default)',
        run: () => onEditorInterfaceChange('ui1'),
      },
      {
        id: 'oneclick',
        label: 'One Click Creator',
        run: () => onOpenOneClick?.(),
      },
      {
        id: 'save',
        label: 'Save project',
        run: () => onSaveProject(),
      },
      {
        id: 'open',
        label: 'Open project file',
        run: () => onLoadProjectFile(),
      },
      {
        id: 'short',
        label: 'Generate Short',
        run: () => onCreateShort(),
      },
      {
        id: 'toggle-left',
        label: 'Toggle left dock',
        run: () => updateLayout({ showLeft: !layout.showLeft }),
      },
      {
        id: 'toggle-right',
        label: 'Toggle right dock',
        run: () => updateLayout({ showRight: !layout.showRight }),
      },
      {
        id: 'toggle-timeline',
        label: 'Toggle Director Timeline',
        run: () => updateLayout({ showBottom: !layout.showBottom }),
      },
      {
        id: 'reset-ws',
        label: 'Reset workspace layout',
        run: () => {
          const next = { ...DEFAULT_STUDIO3_LAYOUT };
          setLayout(next);
          saveStudio3Layout(next);
        },
      },
      ...STUDIO3_TOOLS.map((t) => ({
        id: `left-${t.id}`,
        label: `Open ${t.label}`,
        keywords: t.keywords?.join(' ') ?? '',
        run: () => openTool(t.id),
      })),
    ],
    [
      onEditorInterfaceChange,
      onOpenOneClick,
      onSaveProject,
      onLoadProjectFile,
      onCreateShort,
      updateLayout,
      layout.showLeft,
      layout.showRight,
      layout.showBottom,
      openTool,
    ]
  );

  const filteredCommands = commands.filter((c) => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = `${c.label} ${(c as { keywords?: string }).keywords ?? ''}`.toLowerCase();
    return hay.includes(q);
  });

  const handleExportWorkspace = () => {
    const blob = new Blob([exportStudio3LayoutJson(layout)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layout.name.replace(/\s+/g, '_') || 'workspace'}.asworkspace.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportWorkspaceFile = async (file: File) => {
    try {
      const text = await file.text();
      const next = importStudio3LayoutJson(text);
      setLayout(next);
      saveStudio3Layout(next);
    } catch {
      /* ignore */
    }
  };

  const closeMobileSheet = useCallback(() => {
    setMobileTool(null);
    setMobileSnap(0);
  }, []);

  const openMobileTool = useCallback(
    (tool: MobileWorkspaceTool) => {
      if (tool === 'more') {
        closeMobileSheet();
        setMoreOpen(true);
        return;
      }
      if (mobileTool === tool && mobileSnap > 0) {
        closeMobileSheet();
        return;
      }
      setMoreOpen(false);
      setMobileTool(tool);
      setMobileSnap(prefersTallSheet(tool) ? 3 : 2);
      if (mobileAdaptive) {
        updateLayout({ showLeft: false, showRight: false, showBottom: false });
      }
    },
    [mobileTool, mobileSnap, closeMobileSheet, mobileAdaptive, updateLayout]
  );

  const mobileSheetPanel = (() => {
    if (!mobileTool || mobileTool === 'more') return null;
    const mapped = workspaceToStudioPanel(mobileTool);
    if (!mapped) return null;
    if (mapped === 'timeline') {
      if (!timeline) {
        return (
          <div className="px-4 py-6 text-[12px] text-zinc-400">
            Timeline is hidden in Beginner mode. Switch to Pro in Settings to edit keys.
          </div>
        );
      }
      return (
        <div className="pro-sheet-panel pro-control-sheet flex flex-col flex-1 min-h-0 h-full overflow-hidden">
          <div className="pro-control-sheet__timeline flex-1 min-h-0 flex flex-col overflow-hidden">
            {timeline}
          </div>
        </div>
      );
    }
    const title =
      findStudio3Tool(mapped as Studio3PanelId)?.label ??
      (mapped === 'inspector' ? 'Inspector' : workspaceToolTitle(mobileTool));
    return (
      <div className="pro-sheet-panel">
        <PanelChrome title={title} onClose={closeMobileSheet}>
          {resolvePanel(panels, mapped, title)}
        </PanelChrome>
      </div>
    );
  })();

  return (
    <div
      className={`studio3-shell studio-adaptive-root${
        mobileAdaptive ? ' studio3-shell--mobile-adaptive' : ''
      }`}
      data-studio-layout={adaptive.layoutId}
      data-panel-chrome={adaptive.panelChrome}
      data-toolbar={adaptive.toolbarMode}
    >
      <header
        className={`studio3-shell__header shrink-0 flex flex-wrap items-center gap-1.5 px-2.5 py-1 border-b border-[#1e2430] bg-[#0c0f14]${
          mobileAdaptive ? ' studio3-header-mobile' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <LayoutTemplate className="w-4 h-4 text-violet-300 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-zinc-100 truncate leading-tight">
              {mobileAdaptive ? sceneTitle : 'UI 3.0 Studio'}
            </p>
            {!mobileAdaptive ? (
              <p className="text-[9px] text-zinc-500 truncate">{sceneTitle}</p>
            ) : null}
          </div>
        </div>

        {!mobileAdaptive ? (
        <UiVersionSwitcher
          value={editorInterface}
          onChange={onEditorInterfaceChange}
          variant={adaptive.toolbarMode === 'compact' ? 'segmented' : 'select'}
        />
        ) : null}
        {!mobileAdaptive && onOpenUiComparison ? (
          <button
            type="button"
            onClick={onOpenUiComparison}
            className="px-2 py-1 text-[9px] font-bold rounded border border-[#2a3140] text-zinc-400 cursor-pointer"
            title="Compare UI 1.0 and UI 3.0"
          >
            Compare
          </button>
        ) : null}

        {!mobileAdaptive ? (
        <>
        <div
          className="ds-segmented rounded border border-[#2a3140] p-0.5 bg-[#12161e]"
          role="group"
          aria-label="Editor mode"
        >
          {(['beginner', 'pro'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onUiModeChange(mode)}
              className={`px-2 py-1 text-[9px] font-bold uppercase cursor-pointer rounded ${
                uiMode === mode ? 'bg-violet-500/25 text-violet-100' : 'text-zinc-500'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Gauge className="w-3.5 h-3.5 text-zinc-500" aria-hidden />
          {(['performance', 'balanced', 'quality'] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQualityModeChange(q)}
              className={`px-1.5 py-1 text-[8px] font-bold uppercase cursor-pointer rounded border ${
                qualityMode === q
                  ? 'border-cyan-500/40 text-cyan-200 bg-cyan-500/10'
                  : 'border-transparent text-zinc-500'
              }`}
            >
              {q === 'performance' ? 'Perf' : q === 'balanced' ? 'Bal' : 'Qual'}
            </button>
          ))}
        </div>
        </>
        ) : null}

        <div className="studio3-shell__ws-actions flex items-center gap-1 ml-auto flex-wrap">
          {mobileAdaptive ? null : (
          <button
            type="button"
            title="Find tools (Ctrl+K)"
            onClick={() => setCommandOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded border border-cyan-500/25 text-cyan-200/90 bg-cyan-500/5 cursor-pointer"
          >
            <Search className="w-3 h-3" />
            <span className="studio3-ws-label">Find</span>
            <kbd className="studio3-ws-label text-[8px] text-zinc-500 border border-[#2a3140] rounded px-0.5">⌘K</kbd>
          </button>
          )}
          <button
            type="button"
            onClick={onSaveProject}
            className="studio3-mobile-keep inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded border border-[#2a3140] text-zinc-300 cursor-pointer"
            aria-label="Save"
          >
            <Save className="w-3 h-3" />
            <span className="studio3-ws-label">Save</span>
          </button>
          {!mobileAdaptive ? (
          <button
            type="button"
            onClick={onLoadProjectFile}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded border border-[#2a3140] text-zinc-300 cursor-pointer"
          >
            <FolderOpen className="w-3 h-3" />
            <span className="studio3-ws-label">Open</span>
          </button>
          ) : null}
          {!mobileAdaptive ? (
          <button
            type="button"
            onClick={onLoadProject}
            disabled={!hasSavedProject}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded border border-[#2a3140] text-zinc-300 cursor-pointer disabled:opacity-40"
          >
            <span className="studio3-ws-label">Restore</span>
          </button>
          ) : null}
          <button
            type="button"
            onClick={onShareScene}
            disabled={shareBusy}
            className="studio3-mobile-keep inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded border border-pink-500/30 text-pink-200 cursor-pointer disabled:opacity-40"
            aria-label="Share"
          >
            <Share2 className="w-3 h-3" />
            <span className="studio3-ws-label">{shareBusy ? '…' : 'Share'}</span>
          </button>
          {!mobileAdaptive && onExportMp4 ? (
            <button
              type="button"
              onClick={onExportMp4}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded border border-[#2a3140] text-zinc-300 cursor-pointer"
            >
              <Video className="w-3 h-3" />
              <span className="studio3-ws-label">Export</span>
            </button>
          ) : null}
          {!mobileAdaptive ? (
          <button
            type="button"
            onClick={onCreateShort}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded border border-cyan-500/40 bg-cyan-500/15 text-cyan-100 cursor-pointer"
          >
            <Smartphone className="w-3 h-3" />
            Short
          </button>
          ) : null}
          {!mobileAdaptive && onOpenOneClick ? (
            <button
              type="button"
              onClick={onOpenOneClick}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded border border-violet-500/40 text-violet-200 cursor-pointer"
            >
              <Wand2 className="w-3 h-3" />
              <span className="studio3-ws-label">One Click</span>
            </button>
          ) : null}
          {!mobileAdaptive ? (
          <>
          <button
            type="button"
            title="Save workspace layout"
            onClick={() => saveStudio3Layout(layout)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded border border-[#2a3140] text-zinc-500 cursor-pointer"
          >
            <Save className="w-3 h-3" />
            <span className="studio3-ws-label">WS</span>
          </button>
          <button
            type="button"
            title="Export workspace"
            onClick={handleExportWorkspace}
            className="p-1.5 text-zinc-500 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Import workspace"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-zinc-500 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportWorkspaceFile(f);
              e.target.value = '';
            }}
          />
          </>
          ) : null}
        </div>
      </header>

      {menubar && !mobileAdaptive ? (
        <div className="studio3-menubar shrink-0 border-b border-[#1e2430]">{menubar}</div>
      ) : null}

      {!mobileAdaptive ? (
      <div className="studio3-shell__tabs shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 border-b border-[#1e2430] bg-[#0a0d12] overflow-x-auto">
        <button
          type="button"
          title="Toggle left dock"
          onClick={() => updateLayout({ showLeft: !layout.showLeft })}
          className={`p-1 rounded cursor-pointer ${layout.showLeft ? 'text-cyan-300 bg-cyan-500/10' : 'text-zinc-500'}`}
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Toggle right dock"
          onClick={() => updateLayout({ showRight: !layout.showRight })}
          className={`p-1 rounded cursor-pointer ${layout.showRight ? 'text-cyan-300 bg-cyan-500/10' : 'text-zinc-500'}`}
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Toggle Director Timeline"
          onClick={() => updateLayout({ showBottom: !layout.showBottom })}
          className={`p-1 rounded cursor-pointer ${layout.showBottom ? 'text-cyan-300 bg-cyan-500/10' : 'text-zinc-500'}`}
        >
          <PanelBottom className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-3.5 bg-[#1e2430] mx-0.5 shrink-0" />
        {toolGroups.map(({ group, tools }, gi) => (
          <div key={group} className="contents">
            {gi > 0 ? (
              <div
                className="w-px h-3 self-center bg-[#2a3140] mx-0.5 shrink-0"
                aria-hidden
              />
            ) : null}
            {tools.map((tool) => {
              const Icon = tool.icon;
              const active = layout.showLeft && layout.leftPanel === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  title={tool.label}
                  onClick={() => openTool(tool.id)}
                  className={`studio3-tab-btn inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold whitespace-nowrap cursor-pointer border ${
                    active
                      ? 'border-cyan-500/45 bg-cyan-500/12 text-cyan-100'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span className="studio3-tab-label">{tool.short}</span>
                </button>
              );
            })}
          </div>
        ))}

        <button
          type="button"
          title="Find any tool (Ctrl+K)"
          onClick={() => setCommandOpen(true)}
          className="ml-auto shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-[#2a3140] cursor-pointer"
        >
          <Search className="w-3 h-3" />
          <span className="studio3-tab-label">Find</span>
        </button>
      </div>
      ) : null}

      <div className="studio3-shell__main">
        <aside className="studio3-rail">
          {toolGroups.map(({ group, tools }, gi) => (
            <div key={group} className="contents">
              {gi > 0 ? (
                <div className="w-3.5 h-px bg-[#2a3140] my-0.5 shrink-0" aria-hidden />
              ) : null}
              {tools.map((tool) => {
                const Icon = tool.icon;
                const active = layout.leftPanel === tool.id && layout.showLeft;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    title={tool.label}
                    onClick={() => openLeftPanel(updateLayout, layout, tool.id)}
                    className={`p-1 rounded cursor-pointer ${
                      active ? 'text-cyan-200 bg-cyan-500/20' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            title="Maximize viewport"
            onClick={() =>
              updateLayout({ showLeft: false, showRight: false, showBottom: false })
            }
            className="p-1.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Restore docks"
            onClick={() =>
              updateLayout({ showLeft: true, showRight: true, showBottom: true })
            }
            className="p-1.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </aside>

        {layout.showLeft ? (
          <>
            {(adaptive.panelChrome === 'drawer' || adaptive.panelChrome === 'sheet') && (
              <button
                type="button"
                className="studio3-drawer-backdrop"
                aria-label="Close panel"
                onClick={() => updateLayout({ showLeft: false })}
              />
            )}
          <div
            className="studio3-dock studio3-dock--left shrink-0"
            style={{ width: layout.leftWidth }}
          >
            <div className="studio3-dock__body">
              <PanelChrome title={leftTitle} onClose={() => updateLayout({ showLeft: false })}>
                {leftBody}
              </PanelChrome>
            </div>
            {adaptive.panelChrome === 'docked' || adaptive.panelChrome === 'collapsible' ? (
            <input
              aria-label="Resize left dock"
              type="range"
              min={200}
              max={360}
              value={layout.leftWidth}
              onChange={(e) => updateLayout({ leftWidth: Number(e.target.value) })}
              className="w-full h-1 accent-violet-400 shrink-0"
            />
            ) : null}
          </div>
          </>
        ) : null}

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div
            ref={viewportHostRef}
            className="studio3-viewport-host am-viewport-priority am-home-stage"
          >
            <div className="studio3-viewport-fill">{viewport}</div>
            {mobileAdaptive &&
            onViewportFormatChange &&
            !moreOpen &&
            !(mobileTool && mobileSnap > 0) ? (
              <div className="am-aspect-chip absolute top-2 right-2 z-20 pointer-events-auto">
                <MobileAspectToggle
                  format={viewportFormat}
                  onChange={onViewportFormatChange}
                  compact
                />
              </div>
            ) : null}
            {mobileAdaptive ? (
              <MobileViewportChrome
                enabled={!moreOpen && !(mobileTool && mobileSnap > 0)}
                stageRef={viewportHostRef}
                selectedObjectId={selectedObjectId}
                selectedBoneId={selectedBoneId}
                highlightMaterial={highlightMaterial}
                cameraMode={cameraMode}
                directPlacement={cameraDirectPlacement}
                models={models}
                isPlaying={Boolean(isPlaying)}
                transformMode={transformMode ?? 'rotate'}
                onTransformMode={(m) => onTransformModeChange?.(m)}
                onUndo={() => onUndo?.()}
                onRedo={() => onRedo?.()}
                onTogglePlay={() => onTogglePlay?.()}
                onOpenCamera={() => openMobileTool('camera')}
                onOpenRender={() => openMobileTool('render')}
                onOpenWorkspaceTool={openMobileTool}
                onSetCameraMode={onSetCameraMode}
                onEnterDirectCameraMode={onEnterDirectCameraMode}
              />
            ) : null}
            {!hasModel ? (
              <div className="studio3-empty-hint">
                <div className="studio3-empty-hint__card">
                  <p className="text-[12px] font-bold text-zinc-100 mb-1">Scene is empty</p>
                  <p className="text-[10px] text-zinc-400 leading-relaxed mb-3">
                    Load a demo or open Assets (ZIP / PMX / VMD / GLB).
                  </p>
                  <div className="flex gap-2 justify-center">
                    {onLoadDemo ? (
                      <button
                        type="button"
                        onClick={onLoadDemo}
                        className="px-3 py-1.5 text-[10px] font-bold rounded border border-cyan-500/40 text-cyan-200 cursor-pointer"
                      >
                        Load demo
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (mobileAdaptive) openMobileTool('assets');
                        else openTool('assets');
                      }}
                      className="px-3 py-1.5 text-[10px] font-bold rounded border border-cyan-500/40 text-cyan-200 cursor-pointer"
                    >
                      Open Assets
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {layout.showBottom && timeline && !mobileAdaptive && layout.leftPanel !== 'photo' ? (
            adaptive.timelineMode === 'floating' || adaptive.panelChrome === 'sheet' ? (
              <div className="studio3-sheet" style={{ height: Math.min(layout.bottomHeight, 260) }}>
                <div className="studio3-sheet__handle" aria-hidden />
                <div className="studio3-sheet__body">
                  <div className="h-full min-h-0 relative">
                    <button
                      type="button"
                      onClick={() => updateLayout({ showBottom: false })}
                      className="absolute top-1 right-1 z-10 text-[9px] text-zinc-500 hover:text-zinc-300 cursor-pointer px-1.5 py-0.5 rounded bg-[#0c0f14]/80 border border-[#1e2430]"
                    >
                      Hide
                    </button>
                    <div className="h-full min-h-0">{timeline}</div>
                  </div>
                </div>
              </div>
            ) : (
            <div
              className="studio3-dock studio3-timeline-host shrink-0 border-t border-[#1e2430] bg-[#0c0f14]"
              style={{ height: layout.bottomHeight }}
            >
              <div className="studio3-dock__body relative h-full min-h-0">
                <button
                  type="button"
                  title="Hide timeline"
                  onClick={() => updateLayout({ showBottom: false })}
                  className="absolute top-1 right-1 z-10 text-[9px] text-zinc-500 hover:text-zinc-300 cursor-pointer px-1.5 py-0.5 rounded bg-[#0c0f14]/80 border border-[#1e2430]"
                >
                  Hide
                </button>
                <div className="h-full min-h-0">{timeline}</div>
              </div>
              <input
                aria-label="Resize timeline"
                type="range"
                min={140}
                max={260}
                value={layout.bottomHeight}
                onChange={(e) => updateLayout({ bottomHeight: Number(e.target.value) })}
                className="w-full h-1 accent-violet-400 shrink-0"
              />
            </div>
            )
          ) : null}
        </div>

        {layout.showRight ? (
          <div
            className="studio3-dock studio3-dock--right shrink-0 border-l border-[#1e2430]"
            style={{ width: layout.rightWidth }}
          >
            <div className="flex gap-1 px-1 py-1 border-b border-[#1e2430] bg-[#0c0f14] shrink-0">
              {RIGHT_TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => updateLayout({ rightPanel: t.id })}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded cursor-pointer ${
                    layout.rightPanel === t.id
                      ? 'bg-violet-500/20 text-violet-100'
                      : 'text-zinc-500'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="studio3-dock__body">
              <PanelChrome title={rightTitle} onClose={() => updateLayout({ showRight: false })}>
                {rightBody}
              </PanelChrome>
            </div>
            <input
              aria-label="Resize right dock"
              type="range"
              min={220}
              max={380}
              value={layout.rightWidth}
              onChange={(e) => updateLayout({ rightWidth: Number(e.target.value) })}
              className="w-full h-1 accent-violet-400 shrink-0"
            />
          </div>
        ) : null}
      </div>

      {mobileAdaptive && mobileTool && mobileTool !== 'more' && mobileSnap > 0 ? (
        <ProSnapBottomSheet
          open
          title={
            isTimelineWorkspaceTool(mobileTool)
              ? 'Timeline'
              : (() => {
                  const mapped = workspaceToStudioPanel(mobileTool);
                  if (!mapped || mapped === 'timeline') return workspaceToolTitle(mobileTool);
                  return (
                    findStudio3Tool(mapped)?.label ??
                    (mapped === 'inspector' ? 'Inspector' : workspaceToolTitle(mobileTool))
                  );
                })()
          }
          snapLevel={mobileSnap}
          sheetMode={isTimelineWorkspaceTool(mobileTool) ? 'timeline' : 'content'}
          onSnapChange={(lvl) => {
            if (lvl === 0) closeMobileSheet();
            else setMobileSnap(lvl);
          }}
          onClose={closeMobileSheet}
        >
          {mobileTool === 'camera' && onSetCameraMode ? (
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
                cameraMode={cameraMode ?? 'mmd'}
                directPlacement={cameraDirectPlacement}
                onSetCameraMode={onSetCameraMode}
                onEnterDirectCameraMode={onEnterDirectCameraMode}
              />
            </div>
          ) : null}
          {mobileSheetPanel}
        </ProSnapBottomSheet>
      ) : null}

      {mobileAdaptive ? (
        <>
          <MobileMoreSheet
            open={moreOpen}
            active={mobileTool}
            onClose={() => setMoreOpen(false)}
            onSelect={(tool) => {
              setMoreOpen(false);
              openMobileTool(tool);
            }}
          />
          <div className="studio3-mobile-nav">
            <MobileToolRail
              active={mobileTool}
              onSelect={openMobileTool}
              isPlaying={isPlaying}
              onPlay={onTogglePlay}
            />
          </div>
        </>
      ) : null}

      <footer className="shrink-0 flex items-center gap-3 px-3 py-0.5 border-t border-[#1e2430] bg-[#0c0f14] text-[9px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <Crosshair className="w-3 h-3" /> All tools on the bar · groups · Ctrl+K to search
        </span>
        <span className="ml-auto">Ctrl+K</span>
      </footer>

      {commandOpen ? (
        <div
          className="fixed inset-0 z-[120] bg-black/60 flex items-start justify-center pt-[12vh] px-4"
          onClick={() => setCommandOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-[#2a3140] bg-[#12161e] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2430]">
              <Search className="w-4 h-4 text-cyan-300" />
              <input
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Find panel or action… (mocap, physics, lut, assets)"
                className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              <kbd className="text-[9px] text-zinc-600 border border-[#2a3140] rounded px-1">Esc</kbd>
            </div>
            <ul className="max-h-72 overflow-auto py-1">
              {filteredCommands.length === 0 ? (
                <li className="px-3 py-3 text-[11px] text-zinc-500">No matches</li>
              ) : null}
              {filteredCommands.map((cmd) => (
                <li key={cmd.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-[12px] text-zinc-300 hover:bg-cyan-500/15 hover:text-cyan-100 cursor-pointer"
                    onClick={() => {
                      cmd.run();
                      setCommandOpen(false);
                      setCommandQuery('');
                    }}
                  >
                    {cmd.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
