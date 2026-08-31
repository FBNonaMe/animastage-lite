import { Monitor, Smartphone } from 'lucide-react';
import { cn } from '../../components/UI/cn';
import type { ViewportFormat } from '../../types';
import { MOBILE_ASPECT_CHOICES } from '../../utils/viewportFormatPreference';

export interface MobileAspectToggleProps {
  format: ViewportFormat;
  onChange: (format: ViewportFormat) => void;
  className?: string;
  /** denser for sheet headers */
  compact?: boolean;
}

/** Phone control: pick export / framing aspect (9:16 vs 16:9). */
export default function MobileAspectToggle({
  format,
  onChange,
  className,
  compact = false,
}: MobileAspectToggleProps) {
  return (
    <div
      className={cn(
        'am-aspect-toggle inline-flex items-stretch rounded-xl border border-zinc-700 bg-[#0c0f14] overflow-hidden',
        className
      )}
      role="group"
      aria-label="Video aspect ratio"
    >
      {MOBILE_ASPECT_CHOICES.map((id) => {
        const active = format === id;
        const portrait = id === '9:16';
        const Icon = portrait ? Smartphone : Monitor;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'flex items-center justify-center gap-1.5 font-bold transition-colors cursor-pointer',
              compact ? 'min-h-[36px] px-3 text-[10px]' : 'min-h-[40px] px-3.5 text-[11px]',
              active
                ? portrait
                  ? 'bg-pink-500/20 text-pink-200'
                  : 'bg-cyan-500/20 text-cyan-200'
                : 'text-zinc-500 active:bg-zinc-800'
            )}
            aria-pressed={active}
          >
            <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} aria-hidden />
            {id}
          </button>
        );
      })}
    </div>
  );
}
