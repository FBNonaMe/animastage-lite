import { useCallback, useRef, useState, type CSSProperties } from 'react';
import {
  Camera,
  GripVertical,
  Move,
  Pause,
  Play,
  Redo2,
  RotateCw,
  Undo2,
  Video,
  Wrench,
} from 'lucide-react';
import { cn } from '../../components/UI/cn';
import type { MobileToolboxActionId, MobileTransformMode } from './types';
import MobileDropdownMenu from './MobileDropdownMenu';

export interface MobileFloatingToolboxProps {
  isPlaying: boolean;
  transformMode: MobileTransformMode;
  onAction: (id: MobileToolboxActionId) => void;
  className?: string;
  bottomOffset?: string;
}

const STORAGE_KEY = 'as_mobile_toolbox_pos';

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { x: number; y: number };
    if (typeof p.x === 'number' && typeof p.y === 'number') return p;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Compact floating control — dropdown menu instead of a tall icon column.
 */
export default function MobileFloatingToolbox({
  isPlaying,
  transformMode,
  onAction,
  className,
  bottomOffset = 'calc(var(--am-chrome-reserve, 5.5rem) + 0.5rem)',
}: MobileFloatingToolboxProps) {
  const saved = loadPos();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(saved);
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(
    null
  );
  const moved = useRef(false);

  const onHandleStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
      drag.current = {
        ox: e.clientX,
        oy: e.clientY,
        sx: pos?.x ?? rect.left,
        sy: pos?.y ?? rect.top,
      };
      moved.current = false;
    },
    [pos]
  );

  const onHandleMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.ox;
    const dy = e.clientY - drag.current.oy;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true;
    const x = Math.max(
      8,
      Math.min(window.innerWidth - 120, drag.current.sx + dx)
    );
    const y = Math.max(
      48,
      Math.min(window.innerHeight - 80, drag.current.sy + dy)
    );
    setPos({ x, y });
  }, []);

  const onHandleEnd = useCallback(() => {
    if (pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    }
    drag.current = null;
  }, [pos]);

  const style: CSSProperties = pos
    ? { left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : { right: 12, bottom: bottomOffset };

  const transformLabel = transformMode === 'translate' ? 'Move' : 'Rotate';

  return (
    <div
      className={cn('am-toolbox am-toolbox--menu', className)}
      style={style}
      role="toolbar"
      aria-label="Quick tools"
    >
      <button
        type="button"
        className="am-toolbox__drag"
        aria-label="Drag toolbox"
        onPointerDown={onHandleStart}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleEnd}
        onPointerCancel={onHandleEnd}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <MobileDropdownMenu
        label="Tools"
        icon={<Wrench className="w-4 h-4" />}
        align="end"
        compact
        items={[
          {
            id: 'move',
            label: 'Move bone / model',
            icon: <Move className="w-4 h-4" />,
            active: transformMode === 'translate',
          },
          {
            id: 'rotate',
            label: 'Rotate',
            icon: <RotateCw className="w-4 h-4" />,
            active: transformMode === 'rotate',
          },
          {
            id: 'camera',
            label: 'Camera studio',
            icon: <Camera className="w-4 h-4" />,
          },
          {
            id: 'undo',
            label: 'Undo',
            icon: <Undo2 className="w-4 h-4" />,
          },
          {
            id: 'redo',
            label: 'Redo',
            icon: <Redo2 className="w-4 h-4" />,
          },
          {
            id: isPlaying ? 'pause' : 'play',
            label: isPlaying ? 'Pause' : 'Play',
            icon: isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            ),
          },
          {
            id: 'render',
            label: 'Render / Export',
            icon: <Video className="w-4 h-4" />,
          },
        ]}
        onSelect={(id) => {
          if (moved.current) return;
          onAction(id as MobileToolboxActionId);
        }}
      />
      <span className="am-toolbox__hint">{transformLabel}</span>
    </div>
  );
}
