import type { VqBudget, VqFogQuality, VqQualityPreset, VqResolveContext } from './types';

const PRESET_RANK: Record<VqQualityPreset, number> = {
  preview: 0,
  fast: 1,
  balanced: 2,
  high: 3,
  ultra: 4,
  cinematic: 5,
  photo: 6,
};

function clampPreset(
  preset: VqQualityPreset,
  ctx: VqResolveContext
): VqQualityPreset {
  if (ctx.photoMode || ctx.captureBoost) return 'photo';
  if (ctx.mobile || ctx.portraitLite) {
    if (PRESET_RANK[preset] > PRESET_RANK.balanced) return 'balanced';
  }
  if (ctx.renderTier === 'lite' && PRESET_RANK[preset] > PRESET_RANK.high) {
    return 'high';
  }
  return preset;
}

function fogFor(preset: VqQualityPreset, mobile: boolean): VqFogQuality {
  if (preset === 'preview') return 'off';
  if (preset === 'fast') return 'low';
  if (preset === 'balanced') return mobile ? 'low' : 'medium';
  if (preset === 'high') return mobile ? 'medium' : 'high';
  if (preset === 'ultra') return 'ultra';
  return 'cinematic';
}

function inferPreset(ctx: VqResolveContext): VqQualityPreset {
  if (ctx.preferredPreset) return ctx.preferredPreset;
  if (ctx.photoMode || ctx.captureBoost) return 'photo';
  if (ctx.mobile || ctx.portraitLite) return 'fast';
  if (ctx.renderTier === 'pro') return 'high';
  return 'balanced';
}

/** Legacy-ish budget approximating pre-VQ2 behaviour for A/B. */
function legacyBudget(ctx: VqResolveContext): VqBudget {
  return {
    preset: 'balanced',
    legacyCompare: true,
    dprScale: 1,
    shadowMapSize: ctx.baseShadowMapSize,
    softShadows: !ctx.portraitLite,
    contactShadows: !ctx.mobile,
    contactShadowResolution: ctx.mobile ? 256 : 512,
    csm: false,
    csmCascades: 2,
    ao: !ctx.portraitLite,
    aoHalfRes: true,
    bloom: !ctx.portraitLite,
    bloomIntensityCap: 1,
    dof: !ctx.portraitLite && !ctx.mobile,
    smaa: true,
    reflections: !ctx.mobile,
    godRays: false,
    fogQuality: 'low',
    fogNoise: false,
    heightFog: false,
    particleScale: 1,
    weatherLayers: 1,
    wetness: false,
    exposureClamp: 1.35,
  };
}

export function resolveVqBudget(ctx: VqResolveContext): VqBudget {
  if (ctx.legacyCompare) return legacyBudget(ctx);

  const preset = clampPreset(inferPreset(ctx), ctx);
  const mobile = ctx.mobile;
  const portrait = ctx.portraitLite;
  const photo = preset === 'photo' || preset === 'cinematic';
  const highPlus = PRESET_RANK[preset] >= PRESET_RANK.high;

  const shadowLadder: Record<VqQualityPreset, number> = {
    preview: 512,
    fast: 1024,
    balanced: 1024,
    high: 2048,
    ultra: 2048,
    cinematic: 2048,
    photo: 4096,
  };

  const contactRes: Record<VqQualityPreset, number> = {
    preview: 128,
    fast: 256,
    balanced: 512,
    high: 1024,
    ultra: 1024,
    cinematic: 1024,
    photo: 1024,
  };

  const particleScale: Record<VqQualityPreset, number> = {
    preview: 0.35,
    fast: 0.55,
    balanced: 0.85,
    high: 1,
    ultra: 1.25,
    cinematic: 1.35,
    photo: 1.5,
  };

  const layers: Record<VqQualityPreset, 1 | 2 | 3> = {
    preview: 1,
    fast: 1,
    balanced: 2,
    high: 3,
    ultra: 3,
    cinematic: 3,
    photo: 3,
  };

  const mapSize = Math.min(
    shadowLadder[preset],
    Math.max(512, ctx.baseShadowMapSize * (photo ? 2 : highPlus ? 1.25 : 1))
  );

  return {
    preset,
    legacyCompare: false,
    dprScale: photo ? 1 : preset === 'preview' ? 0.75 : 1,
    shadowMapSize: Math.floor(mapSize),
    softShadows: !portrait && preset !== 'preview',
    contactShadows: !portrait && preset !== 'preview',
    contactShadowResolution: contactRes[preset],
    csm: highPlus && !mobile && !portrait,
    csmCascades: preset === 'photo' || preset === 'cinematic' ? 3 : 2,
    ao: !portrait && preset !== 'preview' && preset !== 'fast',
    aoHalfRes: !photo && (mobile || preset === 'balanced'),
    bloom: !portrait && preset !== 'preview',
    bloomIntensityCap: photo ? 0.85 : highPlus ? 0.75 : 0.55,
    dof: !portrait && (highPlus || photo),
    smaa: true,
    reflections: !mobile || highPlus,
    godRays: highPlus && !mobile && !portrait,
    fogQuality: fogFor(preset, mobile),
    fogNoise: highPlus && !mobile,
    heightFog: preset !== 'preview' && preset !== 'fast',
    particleScale: particleScale[preset] * (mobile ? 0.55 : 1),
    weatherLayers: mobile ? Math.min(2, layers[preset]) as 1 | 2 | 3 : layers[preset],
    wetness: preset !== 'preview',
    exposureClamp: photo ? 1.15 : 1.25,
  };
}

export const VQ_PRESET_LABELS: Record<VqQualityPreset, string> = {
  preview: 'Preview',
  fast: 'Fast',
  balanced: 'Balanced',
  high: 'High',
  ultra: 'Ultra',
  cinematic: 'Cinematic',
  photo: 'Photo',
};
