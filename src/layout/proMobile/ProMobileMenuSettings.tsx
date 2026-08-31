import { Gauge } from 'lucide-react';
import type { StudioUiMode } from '../../flow/types';
import type { QualityMode } from '../../product/scene/types';
import type { EditorInterfaceId } from '../../uiVersions';
import UiVersionSwitcher from '../../uiVersions/UiVersionSwitcher';
import { Button } from '../../components/UI';

const QUALITY_OPTIONS: { id: QualityMode; label: string; short: string; tip: string }[] = [
  { id: 'performance', label: 'Performance', short: 'Perf', tip: 'Lowest GPU load' },
  { id: 'balanced', label: 'Balanced', short: 'Bal', tip: 'Default editing' },
  { id: 'quality', label: 'Quality', short: 'Qual', tip: 'Full physics + HD' },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  compact,
}: {
  options: { id: T; label: string; short?: string; tip?: string }[];
  value: T;
  onChange: (id: T) => void;
  'aria-label'?: string;
  compact?: boolean;
}) {
  return (
    <div
      className="ds-segmented rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-0.5 bg-[var(--color-panel)] w-full"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <div key={opt.id} className="ds-segmented__item">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            active={value === opt.id}
            title={opt.tip}
            className={`w-full uppercase tracking-wide whitespace-nowrap ${compact ? 'text-[10px]' : ''}`}
            onClick={() => onChange(opt.id)}
          >
            {compact && opt.short ? opt.short : opt.label}
          </Button>
        </div>
      ))}
    </div>
  );
}

export interface ProMobileMenuSettingsProps {
  uiMode: StudioUiMode;
  onUiModeChange: (mode: StudioUiMode) => void;
  editorInterface: EditorInterfaceId;
  onEditorInterfaceChange: (id: EditorInterfaceId) => void;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  optimizedHint?: boolean;
}

export default function ProMobileMenuSettings({
  uiMode,
  onUiModeChange,
  editorInterface,
  onEditorInterfaceChange,
  qualityMode,
  onQualityModeChange,
  optimizedHint,
}: ProMobileMenuSettingsProps) {
  return (
    <div className="pro-mobile-menu-settings">
      <div className="pro-mobile-menu-settings__block">
        <p className="pro-mobile-menu-settings__label">Editor mode</p>
        <Segmented
          compact
          aria-label="Editor mode"
          options={[
            { id: 'beginner' as const, label: 'Beginner' },
            { id: 'pro' as const, label: 'Pro' },
          ]}
          value={uiMode}
          onChange={onUiModeChange}
        />
      </div>
      <div className="pro-mobile-menu-settings__block">
        <p className="pro-mobile-menu-settings__label">Appearance · Editor Interface</p>
        <UiVersionSwitcher
          value={editorInterface}
          onChange={onEditorInterfaceChange}
          variant="menu"
        />
      </div>
      <div className="pro-mobile-menu-settings__block">
        <p className="pro-mobile-menu-settings__label">
          <Gauge className="inline w-3.5 h-3.5 mr-1 opacity-70" aria-hidden />
          Quality
        </p>
        <Segmented
          compact
          aria-label="Quality mode"
          options={QUALITY_OPTIONS.map((o) => ({
            id: o.id,
            label: o.label,
            short: o.short,
            tip: o.tip,
          }))}
          value={qualityMode}
          onChange={onQualityModeChange}
        />
      </div>
      {optimizedHint ? (
        <p className="pro-optimized-badge--inline" aria-live="polite">
          Optimized for your device
        </p>
      ) : null}
    </div>
  );
}
