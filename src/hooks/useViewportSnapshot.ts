import { useEffect, useState } from 'react';
import { captureViewportSnapshot } from '../utils/viewportSnapshot';

export interface UseViewportSnapshotOptions {
  /** Preferred — re-renders WebGL frame before capture */
  captureFrame?: () => string | null;
  getCanvas?: () => HTMLCanvasElement | null;
  invalidateScene?: () => void;
  enabled?: boolean;
  refreshKey?: string | number;
}

/** Captures a downscaled viewport JPEG for preset thumbnails. */
export function useViewportSnapshot({
  captureFrame,
  getCanvas,
  invalidateScene,
  enabled = true,
  refreshKey = 0,
}: UseViewportSnapshotOptions): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      return;
    }
    if (!captureFrame && !getCanvas) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    const capture = () => {
      invalidateScene?.();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          const next = captureFrame?.() ?? captureViewportSnapshot(getCanvas?.() ?? null);
          if (next) setUrl(next);
        });
      });
    };

    const t = window.setTimeout(capture, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [captureFrame, getCanvas, invalidateScene, enabled, refreshKey]);

  return url;
}
