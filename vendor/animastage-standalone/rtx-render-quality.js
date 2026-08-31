"use strict";

export const RTX_QUALITY_PRESETS = Object.freeze({
  preview: Object.freeze({
    id: "preview", label: "RTX Preview", spp: 16, bounces: 2,
    denoiseBackend: "guided-classic", denoiseStrength: 0.9,
    detailPreservation: 0.55, sharpen: 0.08, adaptive: false,
    adaptiveResolution: true, varianceThreshold: 0.08,
  }),
  balanced: Object.freeze({
    id: "balanced", label: "RTX Balanced", spp: 256, bounces: 4,
    denoiseBackend: "guided-classic", denoiseStrength: 0.48,
    detailPreservation: 0.82, sharpen: 0.12, adaptive: false,
    adaptiveResolution: true, varianceThreshold: 0.045,
  }),
  clean: Object.freeze({
    id: "clean", label: "RTX Clean", spp: 512, bounces: 6,
    denoiseBackend: "oidn-auto", denoiseStrength: 0.34,
    detailPreservation: 0.9, sharpen: 0.12, adaptive: false,
    adaptiveResolution: false, varianceThreshold: 0.03,
  }),
  neon: Object.freeze({
    id: "neon", label: "RTX Neon Scene", spp: 768, bounces: 5,
    denoiseBackend: "oidn-auto", denoiseStrength: 0.4,
    detailPreservation: 0.86, sharpen: 0.1, adaptive: false,
    adaptiveResolution: false, varianceThreshold: 0.035,
    indirectDiffuseClamp: 10, indirectSpecularClamp: 6,
    causticClamp: 3, roughnessFloor: 0.05,
  }),
  anime: Object.freeze({
    id: "anime", label: "RTX Anime Detail", spp: 512, bounces: 4,
    denoiseBackend: "guided-classic", denoiseStrength: 0.3,
    detailPreservation: 0.98, sharpen: 0.18, adaptive: false,
    adaptiveResolution: false, varianceThreshold: 0.035,
    normalSensitivity: 64, depthSensitivity: 1.35, albedoSensitivity: 14,
  }),
  maximum: Object.freeze({
    id: "maximum", label: "RTX Maximum Quality", spp: 1024, bounces: 8,
    denoiseBackend: "oidn-auto", denoiseStrength: 0.25,
    detailPreservation: 0.96, sharpen: 0.12, adaptive: false,
    adaptiveResolution: false, varianceThreshold: 0.018,
  }),
});

export function cloneQualityPreset(id) {
  const preset = RTX_QUALITY_PRESETS[id];
  if (!preset) throw new Error(`Unknown RTX quality preset: ${id}`);
  return { ...preset };
}

export function varianceFromMoments(mean, meanSquare) {
  const m = Number(mean) || 0;
  const m2 = Number(meanSquare) || 0;
  return Math.max(0, m2 - m * m);
}

export function relativeStandardError({ mean, variance, samples }) {
  const n = Math.max(1, Number(samples) || 1);
  const v = Math.max(0, Number(variance) || 0);
  return Math.sqrt(v / n) / Math.max(Math.abs(Number(mean) || 0), 0.05);
}

export function isAdaptivePixelConverged({
  mean,
  variance,
  samples,
  minSamples = 24,
  threshold = 0.04,
}) {
  if ((Number(samples) || 0) < minSamples) return false;
  return relativeStandardError({ mean, variance, samples }) <= threshold;
}

export function computeAdaptiveDenoiseStrength({
  samples = 1,
  variance = null,
  indirectVariance = 0,
  specularVariance = 0,
  userBaseStrength = 0.6,
  sceneBrightness = 1,
  fireflyRate = 0,
} = {}) {
  const spp = Math.max(1, Number(samples) || 1);
  const samplePressure = Math.min(1, Math.sqrt(48 / spp));
  const hasVariance = Number.isFinite(variance);
  const noise = hasVariance
    ? Math.min(1, Math.sqrt(Math.max(0, variance)) * 2.2)
    : samplePressure;
  const indirect = Math.min(1, Math.sqrt(Math.max(0, indirectVariance)) * 1.5);
  const specular = Math.min(1, Math.sqrt(Math.max(0, specularVariance)) * 1.1);
  const darkPenalty = Math.max(0, 0.35 - Math.max(0, sceneBrightness)) * 0.5;
  const fireflies = Math.min(1, Math.max(0, fireflyRate)) * 0.2;
  const demand = Math.max(samplePressure * 0.55, noise, indirect, specular);
  return Math.min(
    0.96,
    Math.max(0, (Number(userBaseStrength) || 0) * (0.18 + 0.82 * demand) + darkPenalty + fireflies),
  );
}

export function softLuminanceClamp(rgb, limit, kneeRatio = 0.75) {
  const c = [
    Math.max(0, Number(rgb?.[0]) || 0),
    Math.max(0, Number(rgb?.[1]) || 0),
    Math.max(0, Number(rgb?.[2]) || 0),
  ];
  const maxLum = Math.max(1e-6, Number(limit) || 0);
  const lum = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  const knee = maxLum * Math.min(0.95, Math.max(0.1, kneeRatio));
  if (lum <= knee) return c;
  const shoulder = Math.max(1e-6, maxLum - knee);
  const mapped = knee + shoulder * (1 - Math.exp(-(lum - knee) / shoulder));
  const scale = mapped / Math.max(lum, 1e-8);
  return c.map((value) => value * scale);
}

export function estimateRtxVramBytes(width, height, options = {}) {
  const pixels = Math.max(1, width | 0) * Math.max(1, height | 0);
  const rgba16f = pixels * 8;
  const accumulation = rgba16f * 4 * 2;
  const denoisePingPong = options.denoise === false ? 0 : rgba16f * 2;
  const readback = options.oidnGuides ? pixels * 4 : 0;
  return {
    beautyAndAovs: rgba16f * 4,
    accumulation,
    denoisePingPong,
    oidnGuideReadback: readback,
    total: accumulation + denoisePingPong + readback,
  };
}

export function migrateRenderSettings(input = {}) {
  if ((input.renderSettingsVersion || 0) >= 2) return structuredClone(input);
  const oldRtx = input.rtx || input.render || input;
  return {
    ...structuredClone(input),
    renderSettingsVersion: 2,
    lens: {
      enabled: !!(oldRtx.dofOn ?? oldRtx.dofEnabled),
      focusDistance: Number(oldRtx.focusDistance ?? oldRtx.focus ?? 5),
      apertureRadiusWorld: Number(oldRtx.aperture ?? oldRtx.lensAperture ?? 0),
      bladeCount: Number(oldRtx.blades ?? oldRtx.bladeCount ?? 6),
      bladeRotation: Number(oldRtx.bladeRotation ?? 0),
    },
    denoise: {
      backend: oldRtx.oidn ? "oidn-auto" : "guided-classic",
      baseStrength: Number(oldRtx.finalDenoise ?? oldRtx.denoiseStrength ?? 0.6),
      preserveDetails: 0.75,
      sharpen: 0.1,
    },
    sampling: {
      nee: true,
      mis: true,
      emissiveImportance: true,
      environmentImportance: true,
      adaptive: false,
    },
  };
}
