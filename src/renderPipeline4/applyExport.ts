import type { AppState, ViewportFormat, VisualFxSettings } from '../types';
import type { CinemaCodecId, CinemaOutputPresetId, CinemaRenderSettings } from '../cinematicRender/cinemaMode';
import { DEFAULT_CINEMA_RENDER, prepareCinemaRender } from '../cinematicRender/cinemaMode';
import { DEFAULT_CINEMATIC_RENDER } from '../cinematicRender/defaults';
import type { VideoRecordOptions } from '../video/mmdVideoRecorder';
import { DEFAULT_RENDER_PIPELINE_4 } from './defaults';
import { resolveRp4BitrateMbps } from './estimates';
import {
  resolveRp4ExportSize,
  resolveRp4Fps,
  resolveRp4QualityBudgets,
} from './presets';
import type { RenderPipeline4State, Rp4CodecId, Rp4QualityPresetId } from './types';

export function mergeRenderPipeline4(
  base: RenderPipeline4State | undefined,
  patch: Partial<RenderPipeline4State>
): RenderPipeline4State {
  const b = base ?? DEFAULT_RENDER_PIPELINE_4;
  return {
    ...b,
    ...patch,
    version: 4,
    resolution: { ...b.resolution, ...(patch.resolution ?? {}) },
    fps: { ...b.fps, ...(patch.fps ?? {}) },
    bitrate: { ...b.bitrate, ...(patch.bitrate ?? {}) },
    audio: { ...b.audio, ...(patch.audio ?? {}) },
    smartRender: { ...b.smartRender, ...(patch.smartRender ?? {}) },
    passes: patch.passes ?? b.passes,
  };
}

function mapCodec(codec: Rp4CodecId): CinemaCodecId {
  if (codec === 'mp4_h265') return 'h265';
  if (codec === 'av1') return 'av1';
  return 'h264';
}

function mapAaToVisualFx(
  aa: RenderPipeline4State['antiAliasing'],
  fx: VisualFxSettings
): Partial<VisualFxSettings> {
  switch (aa) {
    case 'disabled':
      return { smaaEnabled: false };
    case 'fxaa':
    case 'smaa':
      return { smaaEnabled: true };
    case 'taa':
    case 'msaa':
      return { smaaEnabled: true };
    default:
      return { smaaEnabled: fx.smaaEnabled };
  }
}

function characterQualityForRp4(
  quality: Rp4QualityPresetId,
  current: AppState['characterQuality']
): AppState['characterQuality'] {
  if (quality === 'master' || quality === 'cinematic') {
    return current === 'standard' ? 'hd' : current;
  }
  if (quality === 'ultra' || quality === 'high') {
    return current === 'standard' ? 'hd' : current === 'uhd4k' ? 'hd' : current;
  }
  // draft / preview / standard — never bump to uhd (avoids remount mid-export)
  return current === 'uhd4k' ? 'hd' : current === 'standard' ? 'hd' : current;
}

function cinemaOutputPresetForExport(
  width: number,
  height: number,
  format: ViewportFormat
): CinemaOutputPresetId {
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  if (format === '1:1') return 'square_1080';
  if (format === '9:16' || height > width) {
    if (longEdge >= 3500 || shortEdge >= 2000) return 'portrait_4k';
    return 'portrait_1080';
  }
  if (height >= 4320 || longEdge >= 7000) return '8k';
  if (height >= 2160 || longEdge >= 3500) return '4k';
  if (height >= 1440) return '1440p';
  return '1080p';
}

export interface Rp4ExportPrepareResult {
  restore: Partial<AppState>;
  patch: Partial<AppState>;
  videoOpts: Partial<VideoRecordOptions> & {
    fps: number;
    bitrateMbps: number;
    targetWidth: number;
    targetHeight: number;
    settleFrames: number;
    supersample: number;
    cinemaMode: true;
    codecPreference: CinemaCodecId;
  };
  /** Codecs that need a non-MP4 path (UI guidance). */
  containerNote: string | null;
  supported: boolean;
}

/**
 * Build offline export patch from RP4 settings.
 * Export quality is always full budgets — viewport smart scale is ignored.
 * Resolution follows the active viewport aspect (9:16 → portrait pixels).
 */
export function prepareRenderPipeline4Export(
  appState: AppState,
  durationSec: number,
  rp4: RenderPipeline4State = appState.renderPipeline4 ?? DEFAULT_RENDER_PIPELINE_4,
  viewportFormat: ViewportFormat = '16:9'
): Rp4ExportPrepareResult {
  const { width, height } = resolveRp4ExportSize(rp4, viewportFormat);
  const fps = resolveRp4Fps(rp4);
  const budgets = resolveRp4QualityBudgets(rp4);
  // Cap supersample on low res to avoid GPU stalls that drop the mesh.
  const supersample =
    width * height <= 1280 * 720
      ? (Math.min(budgets.supersample, 1.5) as 1 | 1.5 | 2 | 3)
      : budgets.supersample;
  const bitrateMbps = resolveRp4BitrateMbps(rp4, viewportFormat);

  const unsupported =
    rp4.codec === 'av1' ||
    rp4.codec === 'exr_sequence' ||
    rp4.codec === 'gif' ||
    rp4.codec === 'webm_vp9' ||
    rp4.codec === 'png_sequence';

  const cinemaPatch: CinemaRenderSettings = {
    ...(appState.cinemaRender ?? DEFAULT_CINEMA_RENDER),
    enabled: true,
    supersample,
    settleFrames: Math.min(budgets.settleFrames, 4),
    codec: mapCodec(rp4.codec),
    bitrateTier:
      rp4.bitrate.mode === 'lossless'
        ? 'lossless'
        : rp4.bitrate.mode === 'very_high' || rp4.bitrate.mode === 'high'
          ? 'visually_lossless'
          : 'high',
    // Honor RP4 FPS (do not force 30).
    lockTimelineFps: false,
    fullPostFx: true,
    outputPreset: cinemaOutputPresetForExport(width, height, viewportFormat),
  };

  // Cap supersample on tall/portrait exports — huge FBOs drop the mesh / WebGL context.
  const pixels = width * height;
  const safeSupersample =
    viewportFormat === '9:16' || viewportFormat === '4:5' || height > width
      ? pixels >= 1440 * 2560
        ? (Math.min(supersample, 1) as 1 | 1.5 | 2 | 3)
        : pixels >= 1080 * 1920
          ? (Math.min(supersample, 1.5) as 1 | 1.5 | 2 | 3)
          : supersample
      : pixels >= 3840 * 2160
        ? (Math.min(supersample, 1.5) as 1 | 1.5 | 2 | 3)
        : supersample;
  cinemaPatch.supersample = safeSupersample;

  const cinema = prepareCinemaRender(
    { ...appState, cinemaRender: cinemaPatch },
    cinemaPatch
  );

  const aaFx = mapAaToVisualFx(budgets.antiAliasing, appState.visualFx);
  const ssaoOn = budgets.ssaoQuality > 0.2;
  const bloomOn =
    budgets.bloomQuality > 0.25 &&
    (appState.visualFx.bloomEnabled === true ||
      rp4.quality === 'ultra' ||
      rp4.quality === 'cinematic' ||
      rp4.quality === 'master');

  const patch: Partial<AppState> = {
    ...cinema.patch,
    characterQuality: characterQualityForRp4(rp4.quality, appState.characterQuality),
    // Keep user fog/volumetrics off unless they already enabled them.
    cinematicRender: {
      ...(appState.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
      volumetricFog: Boolean(appState.cinematicRender?.volumetricFog),
      lightShafts: Boolean(appState.cinematicRender?.lightShafts),
      autoExportQuality: true,
    },
    visualFx: {
      ...(cinema.patch.visualFx ?? appState.visualFx),
      ...aaFx,
      ssaoEnabled: ssaoOn,
      ssaoHalfRes: budgets.ssaoQuality < 0.6,
      bloomEnabled: bloomOn,
      bloomIntensity: Math.min(
        0.36,
        Math.max(appState.visualFx.bloomIntensity ?? 0.25, budgets.bloomQuality * 0.28)
      ),
      // Keep character visible — never auto-enable DOF for RP4 export.
      dofEnabled: false,
      godRaysEnabled: false,
      environmentIntensity: Math.min(
        0.95,
        cinema.patch.visualFx?.environmentIntensity ??
          appState.visualFx.environmentIntensity ??
          0.8
      ),
    },
    sceneComposer: {
      ...(cinema.patch.sceneComposer ?? appState.sceneComposer),
      // Preserve project fog — never force fog on for export.
      fogEnabled: appState.sceneComposer.fogEnabled,
      fogDensity: appState.sceneComposer.fogDensity,
      fogColor: appState.sceneComposer.fogColor,
      lights: {
        ...(cinema.patch.sceneComposer?.lights ?? appState.sceneComposer.lights),
        sunShadows: true,
        sunEnabled: true,
        sunIntensity: Math.max(
          cinema.patch.sceneComposer?.lights?.sunIntensity ??
            appState.sceneComposer.lights.sunIntensity,
          1.05
        ),
      },
    },
    reflectionSystem: {
      ...(cinema.patch.reflectionSystem ?? appState.reflectionSystem),
      enabled: budgets.ssrQuality > 0.15,
      exportBoost: true,
      refreshRate: 0,
      resolution:
        budgets.ssrQuality >= 0.85
          ? 512
          : budgets.ssrQuality >= 0.55
            ? 256
            : 128,
    },
    renderPipeline4: { ...rp4 },
    cinemaRender: cinemaPatch,
  };

  let containerNote: string | null = null;
  if (rp4.codec === 'png_sequence') {
    containerNote = 'PNG Sequence export uses frame dump path — MP4 encode skipped.';
  } else if (rp4.codec === 'exr_sequence' || rp4.codec === 'av1') {
    containerNote = 'Selected codec is reserved for a future release — export falls back to H.264.';
  } else if (rp4.codec === 'gif' || rp4.codec === 'webm_vp9') {
    containerNote = 'GIF / WebM use Live recorder fallback when WebCodecs MP4 is unavailable.';
  }

  void durationSec;

  return {
    restore: {
      ...cinema.restore,
      renderPipeline4: appState.renderPipeline4
        ? { ...appState.renderPipeline4 }
        : undefined,
    },
    patch,
    videoOpts: {
      fps,
      bitrateMbps,
      // Always use aspect-fitted RP4 size — not cinema landscape defaults.
      targetWidth: width,
      targetHeight: height,
      settleFrames: Math.min(budgets.settleFrames, 4),
      supersample: safeSupersample,
      cinemaMode: true,
      codecPreference: mapCodec(unsupported ? 'mp4_h264' : rp4.codec),
      frameAccumulation: 1,
      viewportFormat,
    },
    containerNote,
    supported: !unsupported || rp4.codec === 'png_sequence',
  };
}
