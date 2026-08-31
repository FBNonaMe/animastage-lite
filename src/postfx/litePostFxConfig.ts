import type { ViewportFormat, VisualFxSettings } from '../types';
import type { RtxSettings } from '../utils/rtxSettings';
import { isPortraitFormat } from '../utils/characterQuality';
import { isCinemaRenderCapture } from '../video/recordingCapture';

export interface LitePostFxTuning {
  enableComposer: boolean;
  ssao: boolean;
  smaa: boolean;
  godRays: boolean;
  bloom: boolean;
  dof: boolean;
  vignette: boolean;
  chromatic: boolean;
  colorGrade: boolean;
  ssaoIntensity: number;
  ssaoRadius: number;
  ssaoResolutionScale: number;
  godRaysSamples: number;
  godRaysDensity: number;
  godRaysDecay: number;
  bloomIntensityMul: number;
  multisampling: number;
}

export function getLitePostFxTuning(
  visualFx: VisualFxSettings,
  viewportFormat: ViewportFormat,
  rtxModeEnabled: boolean,
  pauseRtx: boolean
): LitePostFxTuning {
  const portrait = isPortraitFormat(viewportFormat);
  const rtxLive = rtxModeEnabled && !pauseRtx;
  const master = visualFx.postFxStackEnabled !== false;
  const colorGradeActive = visualFx.colorGrade != null && visualFx.colorGrade !== 'neutral';
  const cinema = isCinemaRenderCapture();
  const cinematic =
    master &&
    (visualFx.ssaoEnabled === true ||
      visualFx.smaaEnabled !== false ||
      visualFx.bloomEnabled === true ||
      visualFx.dofEnabled === true ||
      visualFx.vignetteEnabled === true ||
      colorGradeActive ||
      rtxLive ||
      cinema);

  // Cinema Render unlocks the full post stack even on 9:16 — quality over speed.
  if (portrait && !cinema) {
    return {
      enableComposer: master && (visualFx.smaaEnabled !== false || visualFx.vignetteEnabled === true),
      ssao: false,
      smaa: visualFx.smaaEnabled !== false,
      godRays: false,
      bloom: false,
      dof: false,
      vignette: visualFx.vignetteEnabled === true,
      chromatic: false,
      colorGrade: colorGradeActive,
      ssaoIntensity: 0,
      ssaoRadius: 0.28,
      ssaoResolutionScale: 0.5,
      godRaysSamples: 0,
      godRaysDensity: 0,
      godRaysDecay: 0,
      bloomIntensityMul: 0.5,
      multisampling: 0,
    };
  }

  return {
    enableComposer: cinematic,
    ssao: (visualFx.ssaoEnabled === true || cinema) && master,
    smaa: visualFx.smaaEnabled !== false,
    godRays: visualFx.godRaysEnabled === true && master,
    bloom: visualFx.bloomEnabled === true || rtxLive || cinema,
    dof: visualFx.dofEnabled === true,
    vignette: visualFx.vignetteEnabled !== false,
    chromatic: (visualFx.chromaticAberration ?? 0) > 0.0001,
    colorGrade: colorGradeActive || cinema,
    ssaoIntensity: visualFx.ssaoIntensity ?? (rtxLive || cinema ? 1.8 : 1.1),
    ssaoRadius: visualFx.ssaoRadius ?? 0.32,
    ssaoResolutionScale: cinema ? 1 : visualFx.ssaoHalfRes !== false ? 0.5 : 1,
    godRaysSamples: visualFx.godRaysSamples ?? 24,
    godRaysDensity: visualFx.godRaysDensity ?? 0.65,
    godRaysDecay: visualFx.godRaysDecay ?? 0.94,
    bloomIntensityMul: rtxLive ? 0.42 : cinema ? 0.85 : 1,
    multisampling: cinema ? 4 : 0,
  };
}

export function resolveBloomParams(
  visualFx: VisualFxSettings,
  tuning: LitePostFxTuning,
  rtxSettings?: RtxSettings,
  rtxLive?: boolean
): { intensity: number; threshold: number; radius: number } {
  const rtxBloom = rtxSettings?.rtxBloomStrength ?? 0.14;
  const intensity =
    (rtxLive
      ? Math.min(rtxBloom, visualFx.bloomIntensity * tuning.bloomIntensityMul)
      : visualFx.bloomIntensity) * tuning.bloomIntensityMul;
  const threshold = rtxLive
    ? Math.max(0.88, visualFx.bloomThreshold)
    : Math.max(0.38, visualFx.bloomThreshold ?? 0.48);
  return {
    intensity,
    threshold,
    radius: visualFx.bloomRadius ?? 0.35,
  };
}
