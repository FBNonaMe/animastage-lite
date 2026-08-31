import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../components/UI/cn';
import type { ProSnapLevel } from './types';
import { PRO_SNAP_VH } from './types';
import { useSheetDrag } from '../adaptiveMobile/useSheetDrag';

export interface ProSnapBottomSheetProps {
  open: boolean;
  title: string;
  snapLevel: ProSnapLevel;
  onSnapChange: (level: ProSnapLevel) => void;
  onClose: () => void;
  children: ReactNode;
  /**
   * timeline — fills snap height (tracks + ruler use remaining space)
   * content — height fits children (no empty void below short panels)
   */
  sheetMode?: 'timeline' | 'content';
}

const SNAP_ORDER: ProSnapLevel[] = [1, 2, 3];

export default function ProSnapBottomSheet({
  open,
  title,
  snapLevel,
  onSnapChange,
  onClose,
  children,
  sheetMode = 'content',
}: ProSnapBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open || snapLevel === 0) setDragOffset(0);
  }, [open, snapLevel]);

  const onDragOffset = useCallback((dy: number) => {
    // Rubber-band: allow slight overscroll feel
    setDragOffset(Math.max(-48, Math.min(120, dy)));
  }, []);

  const { onTouchStart, onTouchMove, onTouchEnd } = useSheetDrag({
    snapLevel,
    onSnapChange: (lvl) => onSnapChange(lvl as ProSnapLevel),
    onClose,
    onDragOffset,
  });

  const maxVh = open && snapLevel > 0 ? PRO_SNAP_VH[snapLevel] : 0;
  const isTimeline = sheetMode === 'timeline';
  const dragging = dragOffset !== 0;

  return (
    <>
      <div
        className={cn(
          'pro-sheet-backdrop fixed inset-0 z-[52] transition-opacity duration-250',
          open && snapLevel > 0 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden={!open || snapLevel === 0}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'pro-sheet fixed inset-x-0 bottom-0 z-[53] flex flex-col rounded-t-2xl',
          'transition-[transform,max-height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          open && snapLevel > 0 ? 'pro-sheet--open' : 'pro-sheet--closed',
          isTimeline ? 'pro-sheet--timeline' : 'pro-sheet--content',
          dragging && 'pro-sheet--dragging'
        )}
        style={{
          ...(maxVh > 0
            ? isTimeline
              ? {
                  height: `min(${maxVh}dvh, var(--am-sheet-cap, ${maxVh}dvh))`,
                  maxHeight: `var(--am-sheet-cap, ${maxVh}dvh)`,
                  // Leave room for CapCut bottom rail (CSS also pins bottom via --am-dock-h).
                  paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
                }
              : {
                  height: 'auto',
                  maxHeight: `min(${maxVh}dvh, var(--am-sheet-cap, calc(100dvh - var(--am-chrome-reserve, 4.5rem) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))))`,
                  paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
                }
            : { height: '0', maxHeight: '0' }),
          ['--pro-sheet-max' as string]: maxVh > 0 ? `${maxVh}dvh` : '0',
          transform:
            open && snapLevel > 0
              ? `translate3d(0, ${dragOffset}px, 0)`
              : undefined,
        }}
      >
        <div
          className="pro-sheet__handle shrink-0 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="pro-sheet__grab" />
          <div className="pro-sheet__header">
            <span className="pro-sheet__title">{title}</span>
            <div className="pro-sheet__snaps">
              {SNAP_ORDER.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={cn('pro-sheet__snap-dot', snapLevel === lvl && 'pro-sheet__snap-dot--on')}
                  onClick={() => onSnapChange(lvl)}
                  aria-label={`${PRO_SNAP_VH[lvl]}% height`}
                />
              ))}
            </div>
            <button type="button" className="pro-sheet__close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div
          className={cn(
            isTimeline
              ? 'pro-sheet__body pro-sheet__body--timeline flex-1 min-h-0 flex flex-col overflow-hidden'
              : 'pro-sheet__body pro-sheet__body--content shrink-0 overflow-y-auto overscroll-contain max-h-[var(--pro-sheet-max)]'
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
