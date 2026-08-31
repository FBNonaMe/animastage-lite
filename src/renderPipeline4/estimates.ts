import type { ViewportFormat } from '../types';
import type { Rp4BitrateModeId, Rp4CodecId, RenderPipeline4State } from './types';
import {
  resolveRp4ExportSize,
  resolveRp4Fps,
  resolveRp4QualityBudgets,
} from './presets';
import type { Rp4ExportPreview } from './types';

function bitrateMbpsForMode(
  mode: Rp4BitrateModeId,
  width: number,
  height: number,
  fps: number,
  manualMbps: number
): number {
  const pixels = width * height;
  const base =
    pixels >= 7680 * 4320
      ? 110
      : pixels >= 3840 * 2160
        ? 52
        : pixels >= 2560 * 1440
          ? 36
          : pixels >= 1920 * 1080
            ? 28
            : 16;
  const fpsScale = fps >= 90 ? 1.55 : fps >= 60 ? 1.3 : fps >= 50 ? 1.15 : 1;
  const scaled = base * fpsScale;
  switch (mode) {
    case 'low':
      return Math.max(4, Math.round(scaled * 0.45));
    case 'medium':
      return Math.max(6, Math.round(scaled * 0.7));
    case 'high':
      return Math.round(scaled);
    case 'very_high':
      return Math.min(140, Math.round(scaled * 1.45));
    case 'lossless':
      return Math.min(200, Math.round(scaled * 2.2));
    case 'manual':
      return Math.max(1, Math.min(250, manualMbps));
    case 'automatic':
    default:
      return Math.round(scaled * 0.95);
  }
}

export function resolveRp4BitrateMbps(
  state: RenderPipeline4State,
  format: ViewportFormat = '16:9'
): number {
  const { width, height } = resolveRp4ExportSize(state, format);
  const fps = resolveRp4Fps(state);
  return bitrateMbpsForMode(
    state.bitrate.mode,
    width,
    height,
    fps,
    state.bitrate.manualMbps
  );
}

function codecSizeFactor(codec: Rp4CodecId): number {
  switch (codec) {
    case 'mp4_h265':
      return 0.65;
    case 'webm_vp9':
      return 0.7;
    case 'av1':
      return 0.55;
    case 'gif':
      return 2.4;
    case 'png_sequence':
      return 8;
    case 'exr_sequence':
      return 16;
    case 'mp4_h264':
    default:
      return 1;
  }
}

/**
 * Pre-render estimates for the professional export window.
 */
export function estimateRp4Export(
  state: RenderPipeline4State,
  durationSec: number,
  format: ViewportFormat = '16:9'
): Rp4ExportPreview {
  const { width, height } = resolveRp4ExportSize(state, format);
  const fps = resolveRp4Fps(state);
  const duration = Math.max(0.1, durationSec);
  // Timeline is MMD 30 FPS — encode count scales with export FPS.
  const timelineFrames = Math.max(1, Math.ceil(duration * 30));
  const frameCount = Math.max(1, Math.round((timelineFrames / 30) * fps));
  const bitrateMbps = resolveRp4BitrateMbps(state, format);
  const budgets = resolveRp4QualityBudgets(state);

  const compressedMb =
    ((bitrateMbps * 1_000_000) / 8 / 1_000_000) * duration * codecSizeFactor(state.codec);
  const estimatedFileSizeMb = Math.max(0.1, Math.round(compressedMb * 10) / 10);

  const pixelCost = (width * height) / (1920 * 1080);
  const qualityCost =
    0.55 +
    budgets.supersample * 0.35 +
    budgets.settleFrames * 0.08 +
    budgets.ssaoQuality * 0.15 +
    budgets.ssrQuality * 0.12;
  const secPerFrame = Math.max(0.02, 0.035 * pixelCost * qualityCost);
  const estimatedRenderTimeSec = Math.round(frameCount * secPerFrame);

  const estimatedGpuUsagePct = Math.min(
    99,
    Math.round(35 + pixelCost * 18 + budgets.supersample * 12 + budgets.volumetricSamples * 0.4)
  );
  const estimatedMemoryMb = Math.round(
    280 + pixelCost * 220 * budgets.supersample + frameCount * 0.002
  );

  return {
    width,
    height,
    fps,
    durationSec: duration,
    frameCount,
    estimatedFileSizeMb,
    estimatedRenderTimeSec,
    estimatedGpuUsagePct,
    estimatedMemoryMb,
    codec: state.codec,
    quality: state.quality,
  };
}

export function formatEstimateDuration(sec: number): string {
  if (sec < 60) return `~${Math.max(1, Math.round(sec))}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `~${m}m ${s}s`;
}
