import { useCallback, useRef, type TouchEvent } from 'react';
import type { MobileSnapLevel } from './types';

const SNAP_ORDER: MobileSnapLevel[] = [1, 2, 3];

/**
 * Live drag + velocity snap for CapCut-style bottom sheets.
 * Attach handlers to the sheet handle (touch-none).
 */
export function useSheetDrag(opts: {
  snapLevel: MobileSnapLevel;
  onSnapChange: (level: MobileSnapLevel) => void;
  onClose: () => void;
  /** Live pixel offset while dragging (positive = down). */
  onDragOffset?: (dy: number) => void;
}) {
  const { snapLevel, onSnapChange, onClose, onDragOffset } = opts;
  const startY = useRef(0);
  const startSnap = useRef<MobileSnapLevel>(2);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const dragging = useRef(false);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      startY.current = y;
      lastY.current = y;
      lastT.current = performance.now();
      velocity.current = 0;
      startSnap.current = snapLevel > 0 ? snapLevel : 2;
      dragging.current = true;
      onDragOffset?.(0);
    },
    [snapLevel, onDragOffset]
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!dragging.current) return;
      const y = e.touches[0]?.clientY ?? lastY.current;
      const now = performance.now();
      const dt = Math.max(1, now - lastT.current);
      velocity.current = ((y - lastY.current) / dt) * 1000;
      lastY.current = y;
      lastT.current = now;
      const dy = y - startY.current;
      onDragOffset?.(dy);
    },
    [onDragOffset]
  );

  const onTouchEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const dy = lastY.current - startY.current;
    const v = velocity.current;
    onDragOffset?.(0);

    const idx = SNAP_ORDER.indexOf(startSnap.current);
    const flingDown = v > 700 || dy > 56;
    const flingUp = v < -700 || dy < -56;

    if (flingDown) {
      if (idx <= 0) onClose();
      else onSnapChange(SNAP_ORDER[idx - 1]!);
      return;
    }
    if (flingUp) {
      if (idx >= SNAP_ORDER.length - 1) onSnapChange(3);
      else onSnapChange(SNAP_ORDER[idx + 1]!);
    }
  }, [onClose, onSnapChange, onDragOffset]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
