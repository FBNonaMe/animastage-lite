import { Pause, Play } from 'lucide-react';
import { cn } from '../../components/UI/cn';
import {
  MOBILE_PRIMARY_RAIL,
  MOBILE_WORKSPACE_TOOLS,
  type MobileWorkspaceTool,
} from './types';
import { MOBILE_TOOL_ICONS } from './MobileMoreSheet';

export interface MobileToolRailProps {
  active: MobileWorkspaceTool | null;
  onSelect: (tool: MobileWorkspaceTool) => void;
  tools?: MobileWorkspaceTool[];
  className?: string;
  /** CapCut-style center play */
  isPlaying?: boolean;
  onPlay?: () => void;
}

/** Bottom dock: tools + optional center play — main phone chrome. */
export default function MobileToolRail({
  active,
  onSelect,
  tools = MOBILE_PRIMARY_RAIL,
  className,
  isPlaying,
  onPlay,
}: MobileToolRailProps) {
  const items = MOBILE_WORKSPACE_TOOLS.filter((t) => tools.includes(t.id));
  const mid = Math.ceil(items.length / 2);
  const left = onPlay ? items.slice(0, Math.min(4, mid)) : items;
  const right = onPlay ? items.slice(Math.min(4, mid)) : [];

  return (
    <nav
      className={cn('am-home-dock', className)}
      aria-label="Studio tools"
    >
      <div className="am-home-dock__scroll">
        {(onPlay ? left : items).map(({ id, label }) => {
          const Icon = MOBILE_TOOL_ICONS[id];
          return (
            <button
              key={id}
              type="button"
              className={cn(
                'am-home-dock__item',
                active === id && 'am-home-dock__item--active'
              )}
              aria-pressed={active === id}
              onClick={() => onSelect(id)}
            >
              <Icon className="am-home-dock__icon" aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}

        {onPlay ? (
          <button
            type="button"
            className="am-home-dock__play"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={onPlay}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7" />
            ) : (
              <Play className="w-7 h-7 fill-current" />
            )}
          </button>
        ) : null}

        {onPlay
          ? right.map(({ id, label }) => {
              const Icon = MOBILE_TOOL_ICONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'am-home-dock__item',
                    active === id && 'am-home-dock__item--active'
                  )}
                  aria-pressed={active === id}
                  onClick={() => onSelect(id)}
                >
                  <Icon className="am-home-dock__icon" aria-hidden />
                  <span>{label}</span>
                </button>
              );
            })
          : null}
      </div>
    </nav>
  );
}
