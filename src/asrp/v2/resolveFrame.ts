/**
 * ASRP V2 frame resolver — single path for viewport vs Cinema quality.
 */
import type { AppState, ViewportFormat } from '../../types';
import { isPortraitFormat } from '../../utils/characterQuality';
import { DEFAULT_ASRP } from '../defaults';
import { renderFlagsToPipeline } from '../pipelineMap';
import { isMobileRuntimeCapsActive } from '../../perf/mobileRuntimeCaps';
import { getPerfGovernorFxGate } from '../../perf/controller/perfGovernor';
import { isCinemaRenderCapture } from '../../video/recordingCapture';
import {
  aliasLegacyStyleId,
  getAsrpVisualStyle,
} from './visualStyles';
import type { AsrpQualityTier } from '../types';
import type {
  AsrpFrameBudgets,
  AsrpFrameState,
  AsrpReflectionBudget,
  AsrpShadowTier,
  AsrpVisualStyleId,
  ResolveAsrpFrameOptions,
} from './types';

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function bumpShadow(tier: AsrpShadowTier, steps: number): AsrpShadowTier {
  const order: AsrpShadowTier[] = ['off', 'low', 'medium', 'high', 'ultra'];
  const i = Math.max(0, Math.min(order.length - 1, order.indexOf(tier) + steps));
  return order[i];
}

export function resolveAsrpFrame(
  appState: AppState,
  viewportFormat: ViewportFormat = '16:9',
  opts: ResolveAsrpFrameOptions = {}
): AsrpFrameState {
  const cinema =
    opts.cinema === true ||
    isCinemaRenderCapture() ||
    Boolean(opts.exporting && appState.cinemaRender?.enabled);
  const exporting = Boolean(opts.exporting || cinema);
  const mobile = isMobileRuntimeCapsActive();
  const portrait = isPortraitFormat(viewportFormat);
  const portraitLite = opts.portraitLite ?? (portrait && !cinema);

  const asrp = appState.asrp ?? DEFAULT_ASRP;
  const pipeline =
    asrp.pipeline ||
    renderFlagsToPipeline(appState.visualFx.renderMode, appState.rtxModeEnabled);

  const styleId: AsrpVisualStyleId =
    opts.styleId ??
    aliasLegacyStyleId(
      appState.cinematicRender?.renderStyle ??
        appState.sceneComposer?.visualStyle ??
        appState.visualFx.colorGrade
    );
  const style = getAsrpVisualStyle(styleId);

  let qualityTier: AsrpQualityTier =
    asrp.quality === 'auto'
      ? cinema
        ? 'export'
        : mobile
          ? 'simplified'
          : appState.rtxModeEnabled
            ? 'ultra'
            : 'balanced'
      : asrp.quality === 'export'
        ? 'export'
        : (asrp.quality as AsrpQualityTier);

  if (cinema) qualityTier = 'export';
  if (mobile && !cinema) qualityTier = qualityTier === 'export' ? 'balanced' : 'simplified';

  const gate = getPerfGovernorFxGate();
  let shadowTier: AsrpShadowTier =
    pipeline === 'classic' ? 'medium' : qualityTier === 'export' ? 'ultra' : 'high';
  if (mobile && !cinema) shadowTier = 'low';
  if (portraitLite) shadowTier = 'off';
  if (gate.shadowScale < 0.75) shadowTier = bumpShadow(shadowTier, -1);
  if (gate.shadowScale < 0.5) shadowTier = bumpShadow(shadowTier, -1);

  const softShadows =
    !portraitLite &&
    (appState.cinematicRender?.softShadows !== false) &&
    style.softShadows;
  const contactShadows =
    !portraitLite &&
    (appState.cinematicRender?.contactShadows !== false) &&
    shadowTier !== 'off';

  const reflectionBudget: AsrpReflectionBudget =
    portraitLite
      ? 'off'
      : mobile && !cinema
        ? 'low'
        : pipeline === 'classic'
          ? 'low'
          : qualityTier === 'export'
            ? 'ultra'
            : 'high';

  const reflectionResolution =
    reflectionBudget === 'ultra'
      ? 512
      : reflectionBudget === 'high'
        ? 256
        : reflectionBudget === 'low'
          ? 64
          : 0;
  const reflectionRefreshRate = cinema ? 0 : mobile ? 4 : 2.5;

  let postBudget: AsrpFrameBudgets['postBudget'] = cinema
    ? 'cinema_max'
    : portraitLite
      ? 'minimal'
      : qualityTier === 'ultra' || qualityTier === 'export'
        ? 'cinematic'
        : 'balanced';
  if (mobile && !cinema && postBudget === 'cinematic') postBudget = 'balanced';

  const ssao =
    !portraitLite &&
    (style.ssao || cinema || appState.visualFx.ssaoEnabled === true) &&
    postBudget !== 'minimal' &&
    gate.allowSsao !== false &&
    gate.shadowScale > 0.4;
  const bloom =
    postBudget !== 'minimal' &&
    (cinema || style.bloomIntensity > 0 || appState.visualFx.bloomEnabled === true);
  // Cinema used to floor bloom at 0.42 and blow out 9:16 frames.
  const bloomIntensity = cinema
    ? Math.min(
        0.38,
        Math.max(style.bloomIntensity, appState.visualFx.bloomIntensity ?? 0.28)
      )
    : style.bloomIntensity;

  const advancedOk = cinema || qualityTier === 'export' || qualityTier === 'ultra';
  const ssr = advancedOk && !mobile && reflectionBudget !== 'off' && reflectionBudget !== 'low';
  const temporalAa = advancedOk || cinema;
  // Only apply ASRP height-fog when the user opted in — cinema used to force style fog
  // and wash out / hide the character (especially on 9:16 export).
  const userVolumetrics =
    appState.cinematicRender?.volumetricFog === true ||
    appState.sceneComposer?.fogEnabled === true;
  const volumetricFog =
    portraitLite || !userVolumetrics
      ? 0
      : style.fogDensity * (cinema ? 1.1 : 1);
  const lightShafts =
    portraitLite || appState.cinematicRender?.lightShafts !== true
      ? 0
      : style.lightShafts * (cinema ? 1.15 : mobile ? 0.5 : 1);
  const pcssSoftness = softShadows ? (cinema ? 1 : 0.65) : 0;

  const materialShading =
    pipeline === 'classic' ? 'classic_toon' : style.materialShading;
  const animeShadingStrength =
    pipeline === 'classic' ? 1 : style.animeShadingStrength;

  const pomEnabled = pipeline !== 'classic' && asrp.enabled !== false;
  const pomSamples =
    typeof asrp.samples === 'number'
      ? asrp.samples
      : cinema
        ? 64
        : mobile
          ? 12
          : qualityTier === 'ultra'
            ? 40
            : 24;

  const budgets: AsrpFrameBudgets = {
    shadowTier,
    softShadows,
    contactShadows,
    reflectionBudget,
    reflectionResolution,
    reflectionRefreshRate,
    postBudget,
    ssao,
    ssaoHalfRes: !cinema && (mobile || appState.visualFx.ssaoHalfRes !== false),
    smaa: appState.visualFx.smaaEnabled !== false,
    bloom,
    bloomIntensity,
    dof: appState.visualFx.dofEnabled === true,
    vignette: appState.visualFx.vignetteEnabled !== false,
    chromatic: (appState.visualFx.chromaticAberration ?? 0) > 0.0001 || cinema,
    colorGrade: true,
    godRays: false,
    ssr,
    temporalAa,
    volumetricFog,
    lightShafts,
    pcssSoftness,
    pomEnabled,
    pomSamples,
    materialShading,
    animeShadingStrength,
    dprCap: cinema ? Math.max(2, appState.cinemaRender?.maxDpr ?? 2.5) : mobile ? 1.25 : 2,
    multisampling: cinema ? 4 : 0,
    motionBlur: cinema && (appState.cinemaRender?.enabled !== false),
    motionBlurStrength: cinema ? 0.35 : 0,
    frameAccumulation: cinema
      ? Math.max(1, Math.min(4, Math.round(2 / Math.max(1, appState.cinemaRender?.supersample ?? 2))))
      : 1,
  };

  return {
    pipeline,
    qualityTier,
    styleId,
    cinema,
    exporting,
    mobile,
    portraitLite,
    budgets,
    visualFxOverrides: {
      bloomEnabled: bloom,
      bloomIntensity,
      ssaoEnabled: ssao,
      ssaoHalfRes: budgets.ssaoHalfRes,
      smaaEnabled: budgets.smaa,
      dofEnabled: budgets.dof,
      vignetteEnabled: budgets.vignette,
      chromaticAberration: budgets.chromatic
        ? Math.max(appState.visualFx.chromaticAberration ?? 0, cinema ? 0.0005 : 0)
        : 0,
      godRaysEnabled: false,
      postFxStackEnabled: postBudget !== 'minimal' || budgets.smaa,
      colorGrade: style.colorGrade,
    },
    reflectionOverrides: {
      enabled: reflectionBudget !== 'off',
      intensity: clamp(
        (appState.reflectionSystem?.intensity ?? 1) * style.reflectionIntensity,
        0.2,
        2
      ),
      resolution: reflectionResolution,
      refreshRate: reflectionRefreshRate,
      exportBoost: cinema,
    },
    asrpOverrides: {
      enabled: pomEnabled,
      pipeline,
      quality: qualityTier as AsrpQualityTier | 'auto',
      samples: pomSamples,
      exportBoost: cinema,
    },
  };
}

/** Apply frame visualFx overrides onto a VisualFx-like object for post tuning. */
export function mergeVisualFxFromFrame(
  visualFx: AppState['visualFx'],
  frame: AsrpFrameState
): AppState['visualFx'] {
  return {
    ...visualFx,
    ...frame.visualFxOverrides,
    colorGrade: (frame.visualFxOverrides.colorGrade as AppState['visualFx']['colorGrade']) ??
      visualFx.colorGrade,
  };
}
