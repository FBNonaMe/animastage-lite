/**
 * Cinema Render Mode — offline, quality-first export for AAA anime cinematic videos.
 * Viewport stays fast; Cinema Render may be slow — image quality is the priority.
 */
import type { AppState, ViewportFormat } from '../types';
import { prepareCinematicExportQuality, type ExportQualitySnapshot } from './exportQuality';
import { DEFAULT_CINEMATIC_RENDER } from './defaults';
import { DEFAULT_ASRP } from '../asrp/defaults';
import { DEFAULT_REFLECTION_SYSTEM } from '../reflections/defaults';
import { resolveAsrpFrame } from '../asrp/v2/resolveFrame';

export type CinemaOutputPresetId =
  | '1080p'
  | '1440p'
  | '4k'
  | '8k'
  | 'portrait_1080'
  | 'portrait_4k'
  | 'square_1080';

export type CinemaSupersampleScale = 1 | 1.5 | 2 | 3;

export type CinemaCodecId = 'h264' | 'h265' | 'av1';

export type CinemaBitrateTier = 'high' | 'visually_lossless' | 'lossless';

export interface CinemaRenderSettings {
  /** Master — Cinema Render uses offline frame-by-frame only. */
  enabled: boolean;
  outputPreset: CinemaOutputPresetId;
  supersample: CinemaSupersampleScale;
  /** Extra RAF settles per frame so pose/physics never lag capture. */
  settleFrames: number;
  bitrateTier: CinemaBitrateTier;
  codec: CinemaCodecId;
  /** Lock 30 FPS timeline timing (never skip / never dup). */
  lockTimelineFps: boolean;
  /** Disable handheld / shake for smooth cinematic camera. */
  smoothCamera: boolean;
  /** Unlock full post stack even on 9:16 during export. */
  fullPostFx: boolean;
  /** Max DPR lock while capturing. */
  maxDpr: number;
}

export const DEFAULT_CINEMA_RENDER: CinemaRenderSettings = {
  enabled: true,
  outputPreset: '1080p',
  supersample: 2,
  settleFrames: 6,
  bitrateTier: 'visually_lossless',
  codec: 'h264',
  lockTimelineFps: true,
  smoothCamera: true,
  fullPostFx: true,
  maxDpr: 2.5,
};

export interface CinemaOutputSpec {
  id: CinemaOutputPresetId;
  label: string;
  width: number;
  height: number;
  viewportFormat: ViewportFormat;
  fps: number;
}

export const CINEMA_OUTPUT_PRESETS: CinemaOutputSpec[] = [
  {
    id: '1080p',
    label: '1080p Landscape',
    width: 1920,
    height: 1080,
    viewportFormat: '16:9',
    fps: 30,
  },
  {
    id: '1440p',
    label: '1440p Landscape',
    width: 2560,
    height: 1440,
    viewportFormat: '16:9',
    fps: 30,
  },
  {
    id: '4k',
    label: '4K Landscape',
    width: 3840,
    height: 2160,
    viewportFormat: '16:9',
    fps: 30,
  },
  {
    id: '8k',
    label: '8K Landscape',
    width: 7680,
    height: 4320,
    viewportFormat: '16:9',
    fps: 30,
  },
  {
    id: 'portrait_1080',
    label: '1080p Portrait',
    width: 1080,
    height: 1920,
    viewportFormat: '9:16',
    fps: 30,
  },
  {
    id: 'portrait_4k',
    label: '4K Portrait',
    width: 2160,
    height: 3840,
    viewportFormat: '9:16',
    fps: 30,
  },
  {
    id: 'square_1080',
    label: '1080 Square',
    width: 1080,
    height: 1080,
    viewportFormat: '16:9',
    fps: 30,
  },
];

export function getCinemaOutputPreset(id: CinemaOutputPresetId): CinemaOutputSpec {
  return CINEMA_OUTPUT_PRESETS.find((p) => p.id === id) ?? CINEMA_OUTPUT_PRESETS[0];
}

export function cinemaBitrateMbps(
  tier: CinemaBitrateTier,
  width: number,
  height: number,
  fps: number
): number {
  const pixels = width * height;
  const base =
    pixels >= 7680 * 4320
      ? 120
      : pixels >= 3840 * 2160
        ? 55
        : pixels >= 2560 * 1440
          ? 40
          : pixels >= 1920 * 1080
            ? 32
            : 24;
  const fpsScale = fps >= 60 ? 1.35 : 1;
  if (tier === 'lossless') return Math.min(180, Math.round(base * 2.2 * fpsScale));
  if (tier === 'visually_lossless') return Math.min(120, Math.round(base * 1.55 * fpsScale));
  return Math.min(80, Math.round(base * fpsScale));
}

export interface CinemaRenderPrepareResult extends ExportQualitySnapshot {
  videoOpts: {
    fps: number;
    bitrateMbps: number;
    targetWidth: number;
    targetHeight: number;
    viewportFormat: ViewportFormat;
    settleFrames: number;
    supersample: number;
    cinemaMode: true;
    frameAccumulation?: number;
  };
}

/**
 * Max-quality offline patch — driven by ASRP V2 resolveAsrpFrame (single quality path).
 */
export function prepareCinemaRender(
  appState: AppState,
  settings: CinemaRenderSettings = appState.cinemaRender ?? DEFAULT_CINEMA_RENDER
): CinemaRenderPrepareResult {
  const output = getCinemaOutputPreset(settings.outputPreset);
  const frame = resolveAsrpFrame(appState, output.viewportFormat, {
    cinema: true,
    exporting: true,
  });

  const base = prepareCinematicExportQuality(
    {
      ...appState,
      cinematicRender: {
        ...(appState.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
        autoExportQuality: true,
      },
    },
    output.viewportFormat
  );

  const restore: Partial<AppState> = {
    ...base.restore,
    cinemaRender: appState.cinemaRender ? { ...appState.cinemaRender } : undefined,
    cinematicRender: appState.cinematicRender
      ? { ...appState.cinematicRender }
      : undefined,
    cinematic: appState.cinematic ? { ...appState.cinematic } : undefined,
    vcs: appState.vcs ? { ...appState.vcs } : undefined,
  };

  const patch: Partial<AppState> = {
    ...base.patch,
    // Keep mesh/material path stable — uhd4k mid-export remounts and can drop the character.
    characterQuality:
      appState.characterQuality === 'standard' ? 'hd' : appState.characterQuality,
    rtxModeEnabled: true,
    rtxSettings: {
      ...(base.patch.rtxSettings ?? appState.rtxSettings),
      aoQuality: 'ultra',
      halfResAo: false,
      aoIntensity: Math.max(appState.rtxSettings.aoIntensity, 3.2),
      rtxBloomStrength: Math.max(appState.rtxSettings.rtxBloomStrength, 0.22),
    },
    visualFx: {
      ...(base.patch.visualFx ?? appState.visualFx),
      ...frame.visualFxOverrides,
      colorGrade: (frame.visualFxOverrides.colorGrade as AppState['visualFx']['colorGrade']) ??
        (appState.visualFx.colorGrade === 'neutral' ? 'cinematic' : appState.visualFx.colorGrade),
      bloomEnabled: appState.visualFx.bloomEnabled !== false,
      bloomIntensity: Math.min(
        0.4,
        Math.max(
          frame.budgets.bloomIntensity,
          appState.visualFx.bloomIntensity ?? 0.28
        )
      ),
      ssaoEnabled: true,
      ssaoHalfRes: false,
      smaaEnabled: true,
      materialDetailing: true,
      postFxStackEnabled: true,
      floorReflection: Math.max(appState.visualFx.floorReflection ?? 0.78, 0.88),
      environmentIntensity: Math.min(
        1.05,
        Math.max(appState.visualFx.environmentIntensity ?? 0.75, 0.82)
      ),
      vignetteEnabled: true,
      renderMode: 'asrp',
      godRaysEnabled: false,
      // Forced DOF during Cinema made the character disappear (wrong focus plane).
      dofEnabled: Boolean(appState.visualFx.dofEnabled),
    },
    reflectionSystem: {
      ...(appState.reflectionSystem ?? DEFAULT_REFLECTION_SYSTEM),
      ...(base.patch.reflectionSystem ?? {}),
      ...frame.reflectionOverrides,
      enabled: true,
      boxProjection: true,
      contactHardening: true,
      resolution: frame.budgets.reflectionResolution,
      refreshRate: 0,
      exportBoost: true,
    },
    asrp: {
      ...(appState.asrp ?? DEFAULT_ASRP),
      ...(base.patch.asrp ?? {}),
      ...frame.asrpOverrides,
      enabled: true,
      pipeline: 'rtx_lite',
      quality: 'export',
      samples: frame.budgets.pomSamples,
      exportBoost: true,
      animePreserve: true,
    },
    cinemaRender: { ...settings, enabled: true },
  };

  if (settings.smoothCamera) {
    if (appState.cinematic) {
      patch.cinematic = { ...appState.cinematic, handheld: false, enabled: true };
    }
    if (appState.vcs) {
      patch.vcs = { ...appState.vcs, handheld: false };
    }
  }

  const bitrateMbps = cinemaBitrateMbps(
    settings.bitrateTier,
    output.width,
    output.height,
    output.fps
  );

  return {
    restore,
    patch,
    applied: true,
    videoOpts: {
      fps: settings.lockTimelineFps ? 30 : output.fps,
      bitrateMbps,
      targetWidth: output.width,
      targetHeight: output.height,
      viewportFormat: output.viewportFormat,
      settleFrames: Math.max(3, settings.settleFrames),
      supersample: settings.supersample,
      cinemaMode: true,
      frameAccumulation: frame.budgets.frameAccumulation,
    },
  };
}
