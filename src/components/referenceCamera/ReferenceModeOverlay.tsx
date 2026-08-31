import { useEffect, useRef } from 'react';
import type { ReferenceCameraState } from '../../referenceCamera';

interface ReferenceModeOverlayProps {
  rcs: ReferenceCameraState;
  currentFrame: number;
  playSpeed: number;
  isPlaying: boolean;
  /** Zoom / pan for reference view (CSS). */
  zoom?: number;
  panX?: number;
  panY?: number;
}

/**
 * Reference video guide — never composited into export capture (pointer-events + z below capture chrome).
 * Syncs to timeline playhead when syncFrames is on.
 */
export default function ReferenceModeOverlay({
  rcs,
  currentFrame,
  playSpeed,
  isPlaying,
  zoom = 1,
  panX = 0,
  panY = 0,
}: ReferenceModeOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ref = rcs.reference;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !ref || !rcs.syncFrames) return;
    const t = currentFrame / Math.max(1, playSpeed);
    if (Math.abs(v.currentTime - t) > 0.08) {
      try {
        v.currentTime = Math.min(t, ref.durationSec || t);
      } catch {
        /* seeking may fail mid-load */
      }
    }
  }, [currentFrame, playSpeed, ref, rcs.syncFrames]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying && rcs.syncFrames) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying, rcs.syncFrames]);

  if (!ref || rcs.viewMode === 'hidden') return null;

  const transform = `translate(${panX}%, ${panY}%) scale(${zoom})`;

  if (rcs.viewMode === 'side_by_side') {
    return (
      <div
        className="absolute top-2 right-2 z-[16] w-[min(280px,38vw)] rounded-lg overflow-hidden border border-zinc-700/80 shadow-xl bg-black/80 pointer-events-auto"
        data-reference-guide="1"
      >
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-900/90">
          Reference · guide only
        </div>
        <video
          ref={videoRef}
          src={ref.blobUrl}
          muted
          playsInline
          loop
          className="w-full h-auto max-h-[40vh] object-contain origin-center"
          style={{ transform }}
        />
        <p className="px-2 py-1 text-[8px] text-zinc-600 truncate">{ref.fileName}</p>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-[13] pointer-events-none flex items-center justify-center overflow-hidden"
      data-reference-guide="1"
      aria-hidden
    >
      <video
        ref={videoRef}
        src={ref.blobUrl}
        muted
        playsInline
        loop
        className="max-w-full max-h-full object-contain origin-center"
        style={{
          opacity: rcs.overlayOpacity,
          transform,
          mixBlendMode: 'normal',
        }}
      />
    </div>
  );
}
