import { useCallback, useRef, useState } from 'react';
import { MMD_FPS, playheadRef, setPlayheadFrame } from '../utils/playhead';
import type { ViewportFormat } from '../types';
import {
  abortVideoRender,
  renderOfflineMp4,
  startLiveRecord,
  type LiveRecordHandle,
  type VideoRecordOptions,
  type VideoRecordProgress,
} from '../video/mmdVideoRecorder';
import { beginRecordingCapture, endRecordingCapture, isRecordingCapture } from '../video/recordingCapture';
import { isNativeApp } from '../utils/platform';

export interface UseVideoRecorderOptions {
  getCanvas: () => HTMLCanvasElement | null;
  invalidateScene?: () => void;
  maxFrames: number;
  exportDurationSec: number;
  viewportFormat: ViewportFormat;
  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;
  loopIn?: number;
  loopOut?: number;
}

export function useVideoRecorder({
  getCanvas,
  invalidateScene,
  maxFrames,
  exportDurationSec,
  viewportFormat,
  setCurrentFrame,
  setIsPlaying,
  loopIn,
  loopOut,
}: UseVideoRecorderOptions) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'idle' | 'offline' | 'live'>('idle');
  const [progress, setProgress] = useState<VideoRecordProgress>({
    phase: 'idle',
    progress: 0,
    message: '',
  });

  const liveRef = useRef<LiveRecordHandle | null>(null);
  const liveEndFrameRef = useRef(0);
  const liveStartFrameRef = useRef(0);
  const savedPlayingRef = useRef(false);

  const buildOpts = useCallback(
    (partial?: Partial<VideoRecordOptions>): VideoRecordOptions => ({
      fps: MMD_FPS,
      bitrateMbps: isNativeApp()
        ? viewportFormat === '9:16'
          ? 12
          : 16
        : viewportFormat === '9:16'
          ? 28
          : 40,
      range: 'full',
      maxFrames,
      exportDurationSec,
      loopIn,
      loopOut,
      viewportFormat,
      ...partial,
    }),
    [maxFrames, exportDurationSec, viewportFormat, loopIn, loopOut]
  );

  const advanceFrame = useCallback(
    async (frame: number) => {
      setPlayheadFrame(frame);
      setCurrentFrame(frame);
      invalidateScene?.();
      // Flush several frames so VMD scrub + skeleton + shadows land before encode.
      // Offline HQ keeps isPlaying=false; pose is driven only by playhead seeks.
      await new Promise<void>((r) => {
        requestAnimationFrame(() => {
          invalidateScene?.();
          requestAnimationFrame(() => {
            invalidateScene?.();
            requestAnimationFrame(() => {
              invalidateScene?.();
              requestAnimationFrame(() => r());
            });
          });
        });
      });
    },
    [invalidateScene, setCurrentFrame]
  );

  const stopLive = useCallback(() => {
    liveRef.current?.stop();
    liveRef.current = null;
    setMode('idle');
    setBusy(false);
    setIsPlaying(savedPlayingRef.current);
    setProgress({ phase: 'idle', progress: 0, message: '' });
  }, [setIsPlaying]);

  const runOffline = useCallback(
    async (partial?: Partial<VideoRecordOptions>) => {
      const canvas = getCanvas();
      if (!canvas || busy) {
        if (busy) abortVideoRender();
        return;
      }

      setBusy(true);
      setMode('offline');
      savedPlayingRef.current = false;
      setIsPlaying(false);
      // Capture begin is owned by renderOfflineMp4 (has final export dimensions).
      // Pre-arm interactive flags only for settle frames before encoder starts.
      beginRecordingCapture({
        cinemaMode: Boolean(partial?.cinemaMode),
        settleFrames: partial?.settleFrames,
        supersample: partial?.supersample,
        targetWidth: partial?.targetWidth,
        targetHeight: partial?.targetHeight,
        maxDpr: partial?.cinemaMode ? 2.5 : 2,
      });

      try {
        // Let React apply cinema quality before first frame — keep mesh stable (no uhd remount).
        await new Promise<void>((r) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() =>
                      requestAnimationFrame(() =>
                        requestAnimationFrame(() => r())
                      )
                    )
                  )
                )
              )
            )
          );
        });

        // Scrub to start so the first encoded frame has VMD pose applied.
        await advanceFrame(0);
        await renderOfflineMp4(canvas, advanceFrame, buildOpts(partial), (p) =>
          setProgress(p)
        );
      } finally {
        // Always restore GL size / cinema flags — early codec failures used to leave
        // capture armed so the next export washed out or dropped the character.
        endRecordingCapture();
        setBusy(false);
        setMode('idle');
        const endFrame = Math.max(0, maxFrames - 1);
        setPlayheadFrame(endFrame);
        setCurrentFrame(endFrame);
        invalidateScene?.();
      }
    },
    [
      getCanvas,
      busy,
      advanceFrame,
      buildOpts,
      maxFrames,
      setCurrentFrame,
      setIsPlaying,
      invalidateScene,
    ]
  );

  const startOffline = useCallback(async () => {
    await runOffline();
  }, [runOffline]);

  /** Cinema Render — offline only, supersample, max settle, never skip frames. */
  const startCinemaOffline = useCallback(
    async (partial?: Partial<VideoRecordOptions>) => {
      await runOffline({
        cinemaMode: true,
        settleFrames: partial?.settleFrames ?? 6,
        supersample: partial?.supersample ?? 2,
        bitrateMbps: partial?.bitrateMbps ?? 48,
        ...partial,
      });
    },
    [runOffline]
  );

  const startLive = useCallback(
    (partial?: Partial<VideoRecordOptions> & { maxDpr?: number }) => {
      const canvas = getCanvas();
      if (!canvas || busy) return;

      const { start, end } = (() => {
        const max = Math.max(1, maxFrames);
        if (loopOut != null && loopIn != null && loopOut > loopIn) {
          return { start: Math.floor(loopIn), end: Math.min(max, Math.ceil(loopOut)) };
        }
        const durEnd = Math.min(max, Math.max(1, Math.ceil(exportDurationSec * MMD_FPS)));
        return { start: 0, end: durEnd };
      })();

      liveStartFrameRef.current = start;
      liveEndFrameRef.current = end;

      savedPlayingRef.current = true;
      setBusy(true);
      setMode('live');

      const liveMaxDpr =
        partial?.maxDpr ??
        (viewportFormat === '9:16' || viewportFormat === '4:5' ? 1 : 1.25);
      const liveBitrate =
        partial?.bitrateMbps ??
        (viewportFormat === '9:16' || viewportFormat === '4:5' ? 10 : 14);

      void (async () => {
        // Arm capture + play immediately so VMD uses delta playback (not frozen scrub).
        beginRecordingCapture({
          interactive: true,
          maxDpr: liveMaxDpr,
        });
        setPlayheadFrame(start);
        setCurrentFrame(start);
        setIsPlaying(true);
        invalidateScene?.();
        await new Promise<void>((r) => {
          requestAnimationFrame(() => requestAnimationFrame(() => r()));
        });

        const handle = startLiveRecord(
          canvas,
          buildOpts({ bitrateMbps: liveBitrate, ...partial }),
          (_blob, _ext, saved) => {
            liveRef.current = null;
            setMode('idle');
            setBusy(false);
            setIsPlaying(savedPlayingRef.current);
            setProgress({
              phase: 'done',
              progress: 1,
              message: saved?.message ?? 'Live recording finished — check share menu to save',
            });
            setTimeout(() => setProgress({ phase: 'idle', progress: 0, message: '' }), 5000);
          },
          { maxDpr: liveMaxDpr }
        );

        if (!handle) {
          endRecordingCapture();
          setBusy(false);
          setMode('idle');
          setIsPlaying(savedPlayingRef.current);
          setProgress({
            phase: 'error',
            progress: 0,
            message: 'MediaRecorder is not supported',
          });
          return;
        }

        liveRef.current = handle;
        setProgress({ phase: 'render', progress: 0, message: 'Live recording…' });
      })();
    },
    [
      getCanvas,
      busy,
      maxFrames,
      exportDurationSec,
      loopIn,
      loopOut,
      buildOpts,
      viewportFormat,
      setIsPlaying,
      setCurrentFrame,
      invalidateScene,
    ]
  );

  /** Call each frame while live recording — stops at end frame. */
  const tickLiveRecord = useCallback(() => {
    if (mode !== 'live' || !liveRef.current) return;
    const end = liveEndFrameRef.current;
    const start = liveStartFrameRef.current;
    const t = playheadRef.current;
    const pct = (t - start) / Math.max(end - start, 1);
    setProgress({
      phase: 'render',
      progress: Math.min(1, pct),
      message: `Recording frame ${Math.round(t - start)} / ${Math.round(end - start)} (~${((t - start) / MMD_FPS).toFixed(1)}s)`,
    });
    if (t >= end - 0.05) {
      stopLive();
    }
  }, [mode, stopLive]);

  const cancel = useCallback(() => {
    if (mode === 'offline') abortVideoRender();
    else if (mode === 'live') stopLive();
  }, [mode, stopLive]);

  return {
    busy,
    mode,
    progress,
    isRecording: busy || isRecordingCapture(),
    startOffline,
    startCinemaOffline,
    startLive,
    stopLive,
    cancel,
    tickLiveRecord,
  };
}
