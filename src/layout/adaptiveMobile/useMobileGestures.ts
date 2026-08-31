import { useCallback, useEffect, useRef } from 'react';

export interface MobileGestureHandlers {
  onThreeFingerUndo?: () => void;
  onThreeFingerRedo?: () => void;
  onDoubleTap?: (x: number, y: number) => void;
  onLongPress?: (x: number, y: number) => void;
}

const LONG_MS = 480;
const DOUBLE_MS = 280;

/**
 * Viewport gesture layer: double-tap, long-press, three-finger undo/redo.
 * Attach to the viewport stage container (not the canvas alone).
 */
export function useMobileGestures(
  targetRef: React.RefObject<HTMLElement | null>,
  handlers: MobileGestureHandlers,
  enabled = true
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const lastTap = useRef(0);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchCount = useRef(0);

  const clearLong = useCallback(() => {
    if (longTimer.current) {
      clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = targetRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      touchCount.current = e.touches.length;
      clearLong();

      if (e.touches.length === 1) {
        const t = e.touches[0]!;
        longTimer.current = setTimeout(() => {
          handlersRef.current.onLongPress?.(t.clientX, t.clientY);
        }, LONG_MS);
      }

      if (e.touches.length === 3) {
        // Three-finger: wait for end to decide undo vs redo by vertical delta
        (el as HTMLElement & { __g3y?: number }).__g3y = e.touches[0]?.clientY ?? 0;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) clearLong();
    };

    const onEnd = (e: TouchEvent) => {
      clearLong();
      const now = performance.now();

      if (touchCount.current === 3 && e.changedTouches[0]) {
        const startY =
          (el as HTMLElement & { __g3y?: number }).__g3y ??
          e.changedTouches[0].clientY;
        const dy = e.changedTouches[0].clientY - startY;
        if (dy > 24) handlersRef.current.onThreeFingerRedo?.();
        else handlersRef.current.onThreeFingerUndo?.();
        touchCount.current = 0;
        return;
      }

      if (touchCount.current === 1 && e.changedTouches[0]) {
        const t = e.changedTouches[0];
        if (now - lastTap.current < DOUBLE_MS) {
          handlersRef.current.onDoubleTap?.(t.clientX, t.clientY);
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
      touchCount.current = e.touches.length;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', clearLong, { passive: true });

    return () => {
      clearLong();
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', clearLong);
    };
  }, [enabled, targetRef, clearLong]);
}
