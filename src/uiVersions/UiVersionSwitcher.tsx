import {
  EDITOR_INTERFACE_REGISTRY,
  type EditorInterfaceId,
} from './types';
import { Button, cn } from '../components/UI';

interface UiVersionSwitcherProps {
  value: EditorInterfaceId;
  onChange: (id: EditorInterfaceId) => void;
  /** compact = toolbar dropdown style */
  variant?: 'segmented' | 'select' | 'menu';
  className?: string;
}

/** Settings → Appearance → Editor Interface (and toolbar). */
export default function UiVersionSwitcher({
  value,
  onChange,
  variant = 'select',
  className,
}: UiVersionSwitcherProps) {
  if (variant === 'segmented') {
    return (
      <div
        className={cn(
          'ds-segmented rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-0.5 bg-[var(--color-panel)]',
          className
        )}
        role="group"
        aria-label="Editor Interface"
      >
        {EDITOR_INTERFACE_REGISTRY.map((opt) => (
          <div key={opt.id} className="ds-segmented__item">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              active={value === opt.id}
              title={opt.description}
              className="w-full uppercase tracking-wide whitespace-nowrap"
              onClick={() => onChange(opt.id)}
            >
              {opt.shortLabel}
            </Button>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'menu') {
    return (
      <div className={cn('flex flex-col gap-1', className)} role="group" aria-label="Editor Interface">
        {EDITOR_INTERFACE_REGISTRY.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.description}
            onClick={() => onChange(opt.id)}
            className={cn(
              'text-left px-2 py-1.5 rounded text-[11px] font-semibold cursor-pointer border',
              value === opt.id
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                : 'border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <label className={cn('flex flex-col gap-1 min-w-[9.5rem]', className)}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
        Editor Interface
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as EditorInterfaceId)}
        className="text-[11px] font-semibold bg-[var(--color-panel)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-2 py-1.5 text-[var(--color-text-main)] cursor-pointer"
        aria-label="Editor Interface"
        title="Settings → Appearance → Editor Interface"
      >
        {EDITOR_INTERFACE_REGISTRY.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
