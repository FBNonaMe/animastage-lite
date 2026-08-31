import { Save, FolderOpen, Share2, Smartphone, Gauge, Sparkles, Play, Video } from 'lucide-react';
import type { StudioUiMode } from '../../flow/types';
import type { QualityMode } from '../../product/scene/types';
import type { EditorInterfaceId } from '../../uiVersions';
import UiVersionSwitcher from '../../uiVersions/UiVersionSwitcher';
import { DEBUG_UI } from '../../config/debugUi';
import { Button, cn } from '../UI';

interface StudioFlowBarProps {
  compact?: boolean;
  uiMode: StudioUiMode;
  onUiModeChange: (mode: StudioUiMode) => void;
  editorInterface: EditorInterfaceId;
  onEditorInterfaceChange: (id: EditorInterfaceId) => void;
  onOpenUiComparison?: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onLoadProjectFile: () => void;
  onShareScene: () => void;
  onCreateShort: () => void;
  onTryDemo?: () => void;
  onExportMp4?: () => void;
  hasSavedProject: boolean;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  shareBusy?: boolean;
  readOnly?: boolean;
}

const QUALITY_OPTIONS: { id: QualityMode; label: string; tip: string }[] = [
  {
    id: 'performance',
    label: 'Performance',
    tip: 'Lowest GPU load — best for heavy models or recording Shorts',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    tip: 'Default editing — bloom on, physics on play',
  },
  {
    id: 'quality',
    label: 'Quality',
    tip: 'Full physics + HD — may drop FPS on large scenes',
  },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  options: { id: T; label: string; tip?: string }[];
  value: T;
  onChange: (id: T) => void;
  'aria-label'?: string;
}) {
  return (
    <div className="ds-segmented rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-0.5 bg-[var(--color-panel)]" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <div key={opt.id} className="ds-segmented__item">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            active={value === opt.id}
            title={opt.tip}
            className="w-full uppercase tracking-wide"
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function StudioFlowBar({
  compact = false,
  uiMode,
  onUiModeChange,
  editorInterface,
  onEditorInterfaceChange,
  onOpenUiComparison,
  onSaveProject,
  onLoadProject,
  onLoadProjectFile,
  onShareScene,
  onCreateShort,
  onTryDemo,
  onExportMp4,
  hasSavedProject,
  qualityMode,
  onQualityModeChange,
  shareBusy = false,
  readOnly = false,
}: StudioFlowBarProps) {
  if (readOnly) return null;

  if (compact) {
    return (
      <div className="studio-flow-bar--compact shrink-0 flex items-center justify-between gap-[var(--space-sm)] bg-[var(--color-bg)] border-b border-[var(--color-border)]">
        <span className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-secondary)] truncate">
          AnimaStage Lite
        </span>
        <div className="flex items-center gap-[var(--space-sm)] shrink-0">
          {onTryDemo ? (
            <Button type="button" variant="secondary" size="sm" onClick={onTryDemo}>
              <Play className="w-3.5 h-3.5" />
              Demo
            </Button>
          ) : null}
          {onExportMp4 ? (
            <Button type="button" variant="ghost" size="sm" onClick={onExportMp4}>
              <Video className="w-3.5 h-3.5" />
              Export
            </Button>
          ) : null}
          <Button type="button" variant="primary" size="sm" onClick={onCreateShort}>
            <Smartphone className="w-3.5 h-3.5" />
            Short
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 flex flex-wrap items-center justify-between gap-[var(--space-md)] px-[var(--space-lg)] py-[var(--space-sm)] bg-[var(--color-bg)] border-b border-[var(--color-border)]"
      style={{ fontSize: 'var(--font-size-base)' }}
    >
      <div className="flex flex-wrap items-center gap-[var(--space-md)]">
        <Segmented
          aria-label="Editor mode"
          options={[
            { id: 'beginner' as const, label: 'Beginner' },
            { id: 'pro' as const, label: 'Pro' },
          ]}
          value={uiMode}
          onChange={onUiModeChange}
        />

        <UiVersionSwitcher
          value={editorInterface}
          onChange={onEditorInterfaceChange}
          variant="select"
        />
        {onOpenUiComparison ? (
          <Button type="button" variant="ghost" size="sm" onClick={onOpenUiComparison} title="Compare UI 1.0 and UI 3.0">
            Compare
          </Button>
        ) : null}

        <div className="flex items-center gap-[var(--space-sm)]">
          <Gauge className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" aria-hidden />
          <Segmented
            aria-label="Quality mode"
            options={QUALITY_OPTIONS}
            value={qualityMode}
            onChange={onQualityModeChange}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
        <Button type="button" variant="ghost" size="sm" onClick={onSaveProject} title="Download .animastage project file">
          <Save className="w-3.5 h-3.5" />
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onLoadProjectFile} title="Load .animastage from disk">
          <FolderOpen className="w-3.5 h-3.5" />
          Open
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLoadProject}
          disabled={!hasSavedProject}
          title="Restore last autosaved project"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Restore
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onShareScene}
          disabled={shareBusy}
          title="Copy viewer link"
          className="text-pink-300/90 hover:text-pink-200"
        >
          <Share2 className="w-3.5 h-3.5" />
          {shareBusy ? 'Sharing…' : 'Share'}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onCreateShort}
          title="9:16 vertical export"
        >
          <Smartphone className="w-3.5 h-3.5" />
          Generate Short
        </Button>

        {DEBUG_UI && (
          <span className={cn('hidden lg:inline-flex items-center gap-1 text-[var(--color-text-muted)] ml-1')}>
            <Sparkles className="w-3 h-3" />
            {uiMode === 'beginner' ? 'Pose · Play · Export' : 'Timeline · Curves · Full tools'}
          </span>
        )}
      </div>
    </div>
  );
}
