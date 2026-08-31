/**
 * MP4 export — WebCodecs + mp4-muxer (mmd_rtx renderOfflineMp4) with MediaRecorder fallback.
 */
import { MMD_FPS } from '../utils/playhead';
import { isNativeApp } from '../utils/platform';
import {
  SHORTS_EXPORT_HEIGHT,
  SHORTS_EXPORT_WIDTH,
  VIEWPORT_916_HEIGHT,
  VIEWPORT_916_WIDTH,
} from '../utils/viewportFormat';
import type { ViewportFormat } from '../types';
import { saveBlob } from '../native/saveBlob';
import { beginRecordingCapture, endRecordingCapture, applyCinemaInternalResolution } from './recordingCapture';

export type VideoRecordRange = 'full' | 'timeline';

export interface VideoRecordOptions {
  fps?: number;
  bitrateMbps?: number;
  range?: VideoRecordRange;
  viewportFormat?: ViewportFormat;
  maxFrames: number;
  /** Cap export length (seconds); clamped to timeline length */
  exportDurationSec?: number;
  loopIn?: number;
  loopOut?: number;
  /** Cinema Render — exact output size (downsampled from supersampled canvas). */
  targetWidth?: number;
  targetHeight?: number;
  /** Internal render scale: 1 | 1.5 | 2 | 3 then downsample to target. */
  supersample?: number;
  /** Extra RAF settles per frame (physics / pose / shadows). */
  settleFrames?: number;
  /** Offline quality-first mode — never skip frames, max bitrate path. */
  cinemaMode?: boolean;
  /** Preferred codec family; falls back to H.264. */
  codecPreference?: 'h264' | 'h265' | 'av1';
  /** Sub-sample accumulation before encode (Cinema AA when supersample is low). */
  frameAccumulation?: number;
}

export interface VideoRecordProgress {
  phase: 'idle' | 'render' | 'finalize' | 'done' | 'cancelled' | 'error';
  progress: number;
  message: string;
}

export type FrameAdvanceCallback = (frame: number) => void | Promise<void>;

/** Recreate encoder before Chrome reclaims it (~60s without encode calls). */
const ENCODER_IDLE_RECYCLE_MS = 45_000;

function timestampName(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function resolveFrameRange(
  opts: VideoRecordOptions
): { start: number; end: number; encodeCount: number; timelineFps: number } {
  const max = Math.max(1, opts.maxFrames);
  const timelineFps = MMD_FPS;
  const exportFps = Math.max(1, Math.min(120, opts.fps ?? MMD_FPS));
  let timelineStart = 0;
  let timelineEnd = max;
  if (opts.range === 'timeline' && opts.loopOut != null && opts.loopIn != null && opts.loopOut > opts.loopIn) {
    timelineStart = Math.max(0, Math.floor(opts.loopIn));
    timelineEnd = Math.min(max, Math.ceil(opts.loopOut));
  } else if (opts.exportDurationSec != null && opts.exportDurationSec > 0) {
    // Duration is wall-clock timeline time at MMD 30 FPS — not exportFps.
    timelineEnd = Math.min(max, Math.max(1, Math.ceil(opts.exportDurationSec * timelineFps)));
  }
  const durationSec = Math.max(1 / timelineFps, (timelineEnd - timelineStart) / timelineFps);
  // Encode denser than timeline when export FPS > 30 (smoother motion).
  const encodeCount = Math.max(1, Math.round(durationSec * exportFps));
  return {
    start: timelineStart,
    end: timelineEnd,
    encodeCount,
    timelineFps,
  };
}

function evenDim(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

function exportDimensions(
  canvas: HTMLCanvasElement,
  format: ViewportFormat,
  opts?: Pick<VideoRecordOptions, 'targetWidth' | 'targetHeight' | 'cinemaMode'>
): { width: number; height: number } {
  let width: number;
  let height: number;
  if (opts?.targetWidth && opts?.targetHeight) {
    width = evenDim(opts.targetWidth);
    height = evenDim(opts.targetHeight);
  } else if (format === '9:16') {
    width = SHORTS_EXPORT_WIDTH;
    height = SHORTS_EXPORT_HEIGHT;
  } else if (format === '1:1') {
    width = 1080;
    height = 1080;
  } else if (format === '4:5') {
    width = 1080;
    height = 1350;
  } else if (format === '21:9') {
    width = 2560;
    height = 1080;
  } else {
    width = canvas.width;
    height = canvas.height;
  }
  if (isNativeApp() && !opts?.cinemaMode) {
    const maxEdge = format === '9:16' || format === '4:5' ? 1280 : 960;
    const edge = Math.max(width, height);
    if (edge > maxEdge) {
      const scale = maxEdge / edge;
      width = evenDim(width * scale);
      height = evenDim(height * scale);
    }
  }
  return { width, height };
}

async function pickVideoCodec(
  w: number,
  h: number,
  bitrate: number,
  fps: number,
  preference: 'h264' | 'h265' | 'av1' = 'h264'
): Promise<{
  codec: string;
  muxCodec: 'avc' | 'hevc' | 'av1';
  hardwareAcceleration: NonNullable<VideoEncoderConfig['hardwareAcceleration']>;
} | null> {
  if (typeof VideoEncoder === 'undefined') return null;

  // Higher levels first — Level 4.0 (avc1.640028) rejects 4K / tall 9:16.
  const h264 = [
    'avc1.640034', // High 5.2
    'avc1.640033', // High 5.1 (4K / 2160×3840)
    'avc1.640032', // High 5.0
    'avc1.64002A', // High 4.2
    'avc1.640028', // High 4.0
    'avc1.4d4028', // Main 4.0
    'avc1.42E01E', // Baseline 3.0
  ];
  const h265 = ['hvc1.1.6.L153.B0', 'hvc1.1.6.L123.B0', 'hev1.1.6.L153.B0', 'hev1.1.6.L123.B0'];
  const av1 = ['av01.0.08M.08', 'av01.0.04M.08'];
  type HwAccel = NonNullable<VideoEncoderConfig['hardwareAcceleration']>;
  type Picked = {
    codec: string;
    muxCodec: 'avc' | 'hevc' | 'av1';
    hardwareAcceleration: HwAccel;
  };

  const tryList = async (
    candidates: string[],
    muxCodec: 'avc' | 'hevc' | 'av1',
    hw: HwAccel
  ): Promise<Picked | null> => {
    for (const codec of candidates) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width: w,
          height: h,
          bitrate,
          framerate: fps,
          hardwareAcceleration: hw,
        });
        if (support.supported) return { codec, muxCodec, hardwareAcceleration: hw };
      } catch {
        /* try next */
      }
    }
    return null;
  };

  const tryPref = async (preferenceInner: 'h264' | 'h265' | 'av1'): Promise<Picked | null> => {
    for (const hw of ['prefer-hardware', 'prefer-software', 'no-preference'] as const) {
      if (preferenceInner === 'av1') {
        const av1Hit = await tryList(av1, 'av1', hw);
        if (av1Hit) return av1Hit;
      }
      if (preferenceInner === 'h265' || preferenceInner === 'av1') {
        const hevcHit = await tryList(h265, 'hevc', hw);
        if (hevcHit) return hevcHit;
      }
      const h264Hit = await tryList(h264, 'avc', hw);
      if (h264Hit) return h264Hit;
    }
    return null;
  };

  const preferred = await tryPref(preference);
  if (preferred) return preferred;
  if (preference !== 'h264') return tryPref('h264');
  return null;
}

function pickRecorderMime(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return '';
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let c = 0;
    const tick = () => {
      c += 1;
      if (c >= n) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function captureVideoFrame(
  canvas: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  timestamp: number
): VideoFrame {
  if (canvas.width === targetW && canvas.height === targetH) {
    return new VideoFrame(canvas, { timestamp });
  }
  const oc = new OffscreenCanvas(targetW, targetH);
  const ctx = oc.getContext('2d');
  if (!ctx) {
    return new VideoFrame(canvas, { timestamp });
  }
  ctx.drawImage(canvas, 0, 0, targetW, targetH);
  return new VideoFrame(oc, { timestamp });
}

/**
 * Cinema frame accumulation — average N sub-samples into an OffscreenCanvas
 * for cheaper AA when supersample < 2.
 */
async function captureAccumulatedFrame(
  canvas: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  timestamp: number,
  samples: number
): Promise<VideoFrame> {
  const n = Math.max(1, Math.min(4, Math.floor(samples)));
  if (n <= 1) return captureVideoFrame(canvas, targetW, targetH, timestamp);

  const oc = new OffscreenCanvas(targetW, targetH);
  const ctx = oc.getContext('2d', { alpha: false });
  if (!ctx) return captureVideoFrame(canvas, targetW, targetH, timestamp);

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, targetW, targetH);
  for (let s = 0; s < n; s++) {
    if (s > 0) await waitFrames(1);
    ctx.globalAlpha = 1 / (s + 1);
    ctx.globalCompositeOperation = s === 0 ? 'copy' : 'source-over';
    // Running average: draw with weight 1/(s+1) over previous average
    if (s === 0) {
      ctx.globalAlpha = 1;
      ctx.drawImage(canvas, 0, 0, targetW, targetH);
    } else {
      ctx.globalAlpha = 1 / (s + 1);
      ctx.drawImage(canvas, 0, 0, targetW, targetH);
    }
  }
  ctx.globalAlpha = 1;
  return new VideoFrame(oc, { timestamp });
}

function isCodecReclaimedError(e: unknown): boolean {
  if (!(e instanceof DOMException)) {
    if (e instanceof Error) {
      return /reclaimed|inactivity|QuotaExceeded/i.test(e.message);
    }
    return false;
  }
  return (
    e.name === 'QuotaExceededError' ||
    /reclaimed|inactivity/i.test(e.message)
  );
}

async function drainEncoder(encoder: VideoEncoder, maxSpins = 12_000): Promise<void> {
  if (encoder.state === 'closed') return;
  let spins = 0;
  while (encoder.encodeQueueSize > 0 && spins < maxSpins) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    spins += 1;
  }
}

type MuxerLike = import('mp4-muxer').Muxer<import('mp4-muxer').ArrayBufferTarget>;

interface EncoderBundle {
  encoder: VideoEncoder;
  lastEncodeAt: number;
  fatalError: Error | null;
}

function createEncoderBundle(
  muxer: MuxerLike,
  config: VideoEncoderConfig
): EncoderBundle {
  const bundle: EncoderBundle = {
    encoder: null as unknown as VideoEncoder,
    lastEncodeAt: Date.now(),
    fatalError: null,
  };
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      bundle.fatalError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure(config);
  bundle.encoder = encoder;
  return bundle;
}

function closeEncoderSafe(encoder: VideoEncoder | undefined): void {
  if (!encoder || encoder.state === 'closed') return;
  try {
    encoder.close();
  } catch {
    /* ignore */
  }
}

async function flushEncoderSafe(encoder: VideoEncoder): Promise<void> {
  if (encoder.state === 'closed') return;
  try {
    await encoder.flush();
  } catch {
    /* ignore — may already be closed after reclaim */
  }
}

async function recycleEncoder(
  bundle: EncoderBundle,
  muxer: MuxerLike,
  config: VideoEncoderConfig
): Promise<EncoderBundle> {
  await drainEncoder(bundle.encoder);
  await flushEncoderSafe(bundle.encoder);
  closeEncoderSafe(bundle.encoder);
  return createEncoderBundle(muxer, config);
}

function encoderNeedsRecycle(bundle: EncoderBundle): boolean {
  if (bundle.encoder.state === 'closed') return true;
  if (bundle.fatalError) return true;
  return Date.now() - bundle.lastEncodeAt > ENCODER_IDLE_RECYCLE_MS;
}

/**
 * Encode one frame; always closes VideoFrame. Recreates encoder if codec was reclaimed.
 */
async function encodeCapturedFrame(
  bundle: EncoderBundle,
  muxer: MuxerLike,
  config: VideoEncoderConfig,
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  timestamp: number,
  requestKeyFrame: boolean,
  accumulation = 1
): Promise<{ bundle: EncoderBundle; keyFrame: boolean }> {
  let keyFrame = requestKeyFrame;
  let active = bundle;

  if (encoderNeedsRecycle(active)) {
    active = await recycleEncoder(active, muxer, config);
    keyFrame = true;
  }

  let vf: VideoFrame | null = null;
  try {
    vf = await captureAccumulatedFrame(canvas, w, h, timestamp, accumulation);

    const runEncode = () => {
      if (active.encoder.state === 'closed') {
        throw new DOMException('VideoEncoder closed', 'InvalidStateError');
      }
      if (active.fatalError) {
        throw active.fatalError;
      }
      active.encoder.encode(vf!, { keyFrame });
    };

    try {
      runEncode();
    } catch (e) {
      if (!isCodecReclaimedError(e)) throw e;
      active = await recycleEncoder(active, muxer, config);
      keyFrame = true;
      runEncode();
    }

    await drainEncoder(active.encoder);
    active.lastEncodeAt = Date.now();
    active.fatalError = null;
    return { bundle: active, keyFrame: false };
  } finally {
    try {
      vf?.close();
    } catch {
      /* ignore */
    }
  }
}

let abortFlag = false;

export function abortVideoRender(): void {
  abortFlag = true;
}

export function isVideoRenderAborted(): boolean {
  return abortFlag;
}

/**
 * Offline frame-by-frame MP4 (HQ) — one WebCodecs encode per timeline frame.
 * Cinema Mode: ignore viewport FPS, never skip/dup frames, supersample then downsample.
 */
export async function renderOfflineMp4(
  canvas: HTMLCanvasElement,
  onAdvanceFrame: FrameAdvanceCallback,
  opts: VideoRecordOptions,
  onProgress?: (p: VideoRecordProgress) => void
): Promise<boolean> {
  abortFlag = false;
  const cinema = Boolean(opts.cinemaMode);
  const fps = Math.max(1, Math.min(120, opts.fps ?? MMD_FPS));
  const maxBitrate = cinema ? 180_000_000 : 80_000_000;
  const bitrate = Math.max(
    cinema ? 16_000_000 : 8_000_000,
    Math.min(maxBitrate, (opts.bitrateMbps ?? (cinema ? 48 : 35)) * 1_000_000)
  );
  const { start, end, encodeCount, timelineFps } = resolveFrameRange(opts);
  const totalFrames = encodeCount;
  const format = opts.viewportFormat ?? '16:9';
  const { width: w, height: h } = exportDimensions(canvas, format, opts);
  const settleFrames = Math.max(1, opts.settleFrames ?? (cinema ? 6 : 1));
  const supersample = Math.max(1, opts.supersample ?? 1);
  const accumulation =
    cinema && (opts.supersample ?? 1) < 2
      ? Math.max(1, opts.frameAccumulation ?? 2)
      : cinema
        ? Math.max(1, opts.frameAccumulation ?? 1)
        : 1;

  let picked = await pickVideoCodec(
    w,
    h,
    bitrate,
    fps,
    opts.codecPreference ?? 'h264'
  );
  // mp4-muxer path requires AVC — fall back to H.264 if HEVC/AV1 was selected.
  if (!picked || picked.muxCodec !== 'avc') {
    picked = await pickVideoCodec(w, h, bitrate, fps, 'h264');
  }
  if (!picked) {
    onProgress?.({
      phase: 'error',
      progress: 0,
      message: 'WebCodecs H.264 unavailable — use Live record (Chrome/Edge).',
    });
    return false;
  }

  let Muxer: typeof import('mp4-muxer').Muxer;
  let ArrayBufferTarget: typeof import('mp4-muxer').ArrayBufferTarget;
  try {
    const mod = await import('mp4-muxer');
    Muxer = mod.Muxer;
    ArrayBufferTarget = mod.ArrayBufferTarget;
  } catch {
    onProgress?.({ phase: 'error', progress: 0, message: 'mp4-muxer failed to load.' });
    return false;
  }

  beginRecordingCapture({
    cinemaMode: cinema,
    settleFrames,
    maxDpr: cinema ? Math.min(3, Math.max(2, supersample)) : 2,
    targetWidth: w,
    targetHeight: h,
    supersample: cinema ? supersample : 1,
  });

  // Let React apply cinema quality + lock internal GL size before first frame.
  await waitFrames(cinema ? 4 : 2);
  applyCinemaInternalResolution();
  await waitFrames(cinema ? 2 : 1);

  const label = cinema ? 'Cinema' : 'HQ';
  onProgress?.({
    phase: 'render',
    progress: 0,
    message: `${label} 0 / ${totalFrames} · ${w}×${h}${supersample > 1 ? ` · ${supersample}× SS` : ''}`,
  });

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: w, height: h },
    fastStart: 'in-memory',
  });

  const encoderConfig: VideoEncoderConfig = {
    codec: picked.codec,
    width: w,
    height: h,
    bitrate: isNativeApp() && !cinema ? Math.min(bitrate, 12_000_000) : bitrate,
    framerate: fps,
    latencyMode: 'quality',
    hardwareAcceleration: isNativeApp()
      ? 'prefer-software'
      : picked.hardwareAcceleration,
  };

  let bundle: EncoderBundle;
  try {
    bundle = createEncoderBundle(muxer, encoderConfig);
  } catch (e) {
    endRecordingCapture();
    onProgress?.({
      phase: 'error',
      progress: 0,
      message: `Encoder: ${(e as Error).message}`,
    });
    return false;
  }

  let needKeyFrame = true;

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (abortFlag) break;
      // Map encode index → timeline frame (60/90/120 FPS export of 30 FPS motion).
      const tSec = i / fps;
      const timelineFrame =
        start + Math.min(Math.max(0, end - start - 1e-4), tSec * timelineFps);
      await onAdvanceFrame(timelineFrame);
      // Cinema: settle every frame so pose/physics/shadows never lag capture.
      await waitFrames(settleFrames);
      if (cinema) applyCinemaInternalResolution();

      const timestamp = Math.round(i * (1_000_000 / fps));
      const keyFrameRequest = needKeyFrame || i === 0 || i % (fps * 2) === 0;
      const result = await encodeCapturedFrame(
        bundle,
        muxer,
        encoderConfig,
        canvas,
        w,
        h,
        timestamp,
        keyFrameRequest,
        accumulation
      );
      bundle = result.bundle;
      needKeyFrame = result.keyFrame;

      const pct = (i + 1) / totalFrames;
      if (i % 2 === 0 || i === totalFrames - 1) {
        onProgress?.({
          phase: 'render',
          progress: pct,
          message: `${label} ${i + 1} / ${totalFrames} (${Math.round(pct * 100)}%) · ${fps} FPS`,
        });
      }
    }

    if (!abortFlag) {
      onProgress?.({ phase: 'finalize', progress: 0.98, message: 'Muxing MP4…' });
      await drainEncoder(bundle.encoder);
      await flushEncoderSafe(bundle.encoder);
      closeEncoderSafe(bundle.encoder);
      muxer.finalize();
      const buffer = muxer.target.buffer;
      const mp4Name = cinema
        ? `animastage-cinema-${timestampName()}.mp4`
        : `mmd-render-${timestampName()}.mp4`;
      const saved = await saveBlob(new Blob([buffer], { type: 'video/mp4' }), mp4Name);
      onProgress?.({
        phase: 'done',
        progress: 1,
        message: saved.ok
          ? `${saved.message} (${totalFrames} fr @ ${fps} FPS · ${w}×${h})`
          : saved.message,
      });
    } else {
      await drainEncoder(bundle.encoder);
      closeEncoderSafe(bundle.encoder);
      onProgress?.({ phase: 'cancelled', progress: 0, message: 'Cancelled' });
    }
  } catch (e) {
    closeEncoderSafe(bundle.encoder);
    const msg = isCodecReclaimedError(e)
      ? 'Export stopped — video codec was reclaimed. Keep the tab focused and try again, or use a shorter duration.'
      : (e as Error).message;
    onProgress?.({ phase: 'error', progress: 0, message: msg });
    endRecordingCapture();
    return false;
  } finally {
    endRecordingCapture();
  }

  return !abortFlag;
}

export interface LiveRecordHandle {
  stop: () => void;
  mime: string;
}

/**
 * Real-time capture via canvas.captureStream + MediaRecorder (mmd_rtx startLiveRecord).
 */
export function startLiveRecord(
  canvas: HTMLCanvasElement,
  opts: VideoRecordOptions,
  onStop?: (blob: Blob, ext: string, saved?: import('../native/saveBlob').SaveBlobResult) => void,
  captureOpts?: { maxDpr?: number }
): LiveRecordHandle | null {
  const mime = pickRecorderMime();
  if (!mime || typeof MediaRecorder === 'undefined') {
    return null;
  }

  const fps = Math.max(1, Math.min(60, opts.fps ?? MMD_FPS));
  // LIVE bitrate stays moderate — high Mbps + RP3 = dropped frames.
  const bitrate = Math.max(4_000_000, (opts.bitrateMbps ?? 12) * 1_000_000);
  const stream = canvas.captureStream(fps);

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  } catch {
    try {
      recorder = new MediaRecorder(stream, { videoBitsPerSecond: bitrate });
    } catch {
      return null;
    }
  }

  const chunks: Blob[] = [];
  const finalMime = recorder.mimeType || mime;
  const ext = finalMime.includes('mp4') ? 'mp4' : 'webm';

  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };
  recorder.onstop = () => {
    endRecordingCapture();
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: finalMime });
    const fileName = `mmd-record-${timestampName()}.${ext}`;
    void saveBlob(blob, fileName).then((saved) => {
      onStop?.(blob, ext, saved);
    });
  };

  beginRecordingCapture({
    interactive: true,
    maxDpr: captureOpts?.maxDpr ?? 1.25,
  });
  recorder.start(250);

  return {
    mime: finalMime,
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop();
    },
  };
}

export function getPreviewExportSize(format: ViewportFormat): { width: number; height: number } {
  switch (format) {
    case '9:16':
      return { width: VIEWPORT_916_WIDTH, height: VIEWPORT_916_HEIGHT };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    case '21:9':
      return { width: 2560, height: 1080 };
    case '16:9':
    default:
      return { width: 1920, height: 1080 };
  }
}
