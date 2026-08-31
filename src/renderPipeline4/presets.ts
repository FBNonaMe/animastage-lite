import type { ViewportFormat } from '../types';
import { viewportAspect } from '../utils/viewportFormat';
import type {
  Rp4AntiAliasingId,
  Rp4BitrateModeId,
  Rp4CodecId,
  Rp4FpsPresetId,
  Rp4QualityBudgets,
  Rp4QualityPresetId,
  Rp4ResolutionPresetId,
  RenderPipeline4State,
} from './types';

export const RP4_RESOLUTION_PRESETS: Record<
  Exclude<Rp4ResolutionPresetId, 'custom'>,
  { label: string; width: number; height: number }
> = {
  '720p': { label: '720p (1280×720)', width: 1280, height: 720 },
  '1080p': { label: '1080p (1920×1080)', width: 1920, height: 1080 },
  '2k': { label: '2K (2560×1440)', width: 2560, height: 1440 },
  '4k': { label: '4K UHD (3840×2160)', width: 3840, height: 2160 },
  '8k': { label: '8K UHD (7680×4320)', width: 7680, height: 4320 },
};

export const RP4_FPS_PRESETS: Record<
  Exclude<Rp4FpsPresetId, 'custom'>,
  { label: string; fps: number }
> = {
  '24': { label: '24 FPS (Cinema)', fps: 24 },
  '25': { label: '25 FPS', fps: 25 },
  '30': { label: '30 FPS', fps: 30 },
  '50': { label: '50 FPS', fps: 50 },
  '60': { label: '60 FPS', fps: 60 },
  '90': { label: '90 FPS', fps: 90 },
  '120': { label: '120 FPS', fps: 120 },
};

export const RP4_QUALITY_LABELS: Record<Rp4QualityPresetId, string> = {
  draft: 'Draft',
  preview: 'Preview',
  standard: 'Standard',
  high: 'High',
  ultra: 'Ultra',
  cinematic: 'Cinematic',
  master: 'Master',
};

export const RP4_AA_LABELS: Record<Rp4AntiAliasingId, string> = {
  fxaa: 'FXAA',
  smaa: 'SMAA',
  msaa: 'MSAA',
  taa: 'TAA',
  disabled: 'Disabled',
};

export const RP4_CODEC_LABELS: Record<Rp4CodecId, string> = {
  mp4_h264: 'MP4 (H.264)',
  mp4_h265: 'MP4 (H.265)',
  webm_vp9: 'WebM VP9',
  av1: 'AV1 (future)',
  gif: 'GIF',
  png_sequence: 'PNG Sequence',
  exr_sequence: 'EXR Sequence (future)',
};

export const RP4_BITRATE_LABELS: Record<Rp4BitrateModeId, string> = {
  automatic: 'Automatic',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very High',
  lossless: 'Lossless',
  manual: 'Manual',
};

export const RP4_QUALITY_BUDGETS: Record<Rp4QualityPresetId, Rp4QualityBudgets> = {
  draft: {
    shadowResolution: 512,
    reflectionQuality: 0.25,
    bloomQuality: 0.2,
    dofQuality: 0.15,
    antiAliasing: 'disabled',
    textureResolutionScale: 0.5,
    volumetricSamples: 4,
    ssrQuality: 0.2,
    ssaoQuality: 0.25,
    supersample: 1,
    settleFrames: 1,
  },
  preview: {
    shadowResolution: 1024,
    reflectionQuality: 0.4,
    bloomQuality: 0.35,
    dofQuality: 0.3,
    antiAliasing: 'fxaa',
    textureResolutionScale: 0.75,
    volumetricSamples: 8,
    ssrQuality: 0.35,
    ssaoQuality: 0.4,
    supersample: 1,
    settleFrames: 2,
  },
  standard: {
    shadowResolution: 2048,
    reflectionQuality: 0.55,
    bloomQuality: 0.5,
    dofQuality: 0.45,
    antiAliasing: 'smaa',
    textureResolutionScale: 1,
    volumetricSamples: 12,
    ssrQuality: 0.5,
    ssaoQuality: 0.55,
    supersample: 1,
    settleFrames: 3,
  },
  high: {
    shadowResolution: 2048,
    reflectionQuality: 0.7,
    bloomQuality: 0.65,
    dofQuality: 0.6,
    antiAliasing: 'smaa',
    textureResolutionScale: 1,
    volumetricSamples: 16,
    ssrQuality: 0.7,
    ssaoQuality: 0.7,
    supersample: 1.5,
    settleFrames: 4,
  },
  ultra: {
    shadowResolution: 4096,
    reflectionQuality: 0.85,
    bloomQuality: 0.8,
    dofQuality: 0.75,
    antiAliasing: 'taa',
    textureResolutionScale: 1,
    volumetricSamples: 24,
    ssrQuality: 0.85,
    ssaoQuality: 0.85,
    supersample: 2,
    settleFrames: 5,
  },
  cinematic: {
    shadowResolution: 4096,
    reflectionQuality: 0.95,
    bloomQuality: 0.9,
    dofQuality: 0.9,
    antiAliasing: 'taa',
    textureResolutionScale: 1,
    volumetricSamples: 32,
    ssrQuality: 0.95,
    ssaoQuality: 0.95,
    supersample: 2,
    settleFrames: 6,
  },
  master: {
    shadowResolution: 8192,
    reflectionQuality: 1,
    bloomQuality: 1,
    dofQuality: 1,
    antiAliasing: 'msaa',
    textureResolutionScale: 1,
    volumetricSamples: 48,
    ssrQuality: 1,
    ssaoQuality: 1,
    supersample: 3,
    settleFrames: 8,
  },
};

export function resolveRp4Resolution(state: RenderPipeline4State): {
  width: number;
  height: number;
} {
  if (state.resolution.preset === 'custom') {
    return {
      width: Math.max(64, Math.round(state.resolution.width / 2) * 2),
      height: Math.max(64, Math.round(state.resolution.height / 2) * 2),
    };
  }
  const p = RP4_RESOLUTION_PRESETS[state.resolution.preset];
  return { width: p.width, height: p.height };
}

/**
 * Remap landscape RP4 presets (720p–8K) onto the active viewport aspect.
 * 9:16 + 4K → 2160×3840 (not 3840×2160).
 */
export function fitRp4ResolutionToFormat(
  width: number,
  height: number,
  format: ViewportFormat = '16:9'
): { width: number; height: number } {
  const even = (n: number) => Math.max(64, Math.round(n / 2) * 2);
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const aspect = viewportAspect(format);

  if (format === '9:16') {
    return { width: even(shortEdge), height: even(longEdge) };
  }
  if (format === '4:5') {
    const h = even(longEdge);
    return { width: even(h * aspect), height: h };
  }
  if (format === '1:1') {
    const s = even(shortEdge);
    return { width: s, height: s };
  }
  if (format === '21:9') {
    const w = even(longEdge);
    return { width: w, height: even(w / aspect) };
  }
  // 16:9 landscape
  return { width: even(longEdge), height: even(shortEdge) };
}

export function resolveRp4ExportSize(
  state: RenderPipeline4State,
  format: ViewportFormat = '16:9'
): { width: number; height: number } {
  const base = resolveRp4Resolution(state);
  if (state.resolution.preset === 'custom') {
    // Custom: still honor aspect if user typed landscape while viewport is portrait.
    const customAspect = base.width / Math.max(1, base.height);
    const targetAspect = viewportAspect(format);
    if (
      (targetAspect < 1 && customAspect > 1) ||
      (targetAspect > 1 && customAspect < 1)
    ) {
      return fitRp4ResolutionToFormat(base.width, base.height, format);
    }
    return base;
  }
  return fitRp4ResolutionToFormat(base.width, base.height, format);
}

export function resolveRp4Fps(state: RenderPipeline4State): number {
  if (state.fps.preset === 'custom') {
    return Math.max(1, Math.min(240, Math.round(state.fps.fps)));
  }
  return RP4_FPS_PRESETS[state.fps.preset].fps;
}

export function resolveRp4QualityBudgets(
  state: RenderPipeline4State
): Rp4QualityBudgets {
  const base = RP4_QUALITY_BUDGETS[state.quality];
  return {
    ...base,
    antiAliasing:
      state.antiAliasing !== base.antiAliasing ? state.antiAliasing : base.antiAliasing,
  };
}
