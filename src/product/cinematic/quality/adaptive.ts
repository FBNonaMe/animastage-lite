import type { AppState, VisualFxSettings } from '../../../types';
import type { EffectQualityLevel } from '../types';

const LEVEL_SCALE: Record<EffectQualityLevel, number> = {
  off: 0,
  low: 0.45,
  medium: 0.72,
  high: 1,
  auto: 0.85,
};

export function resolveEffectQualityLevel(
  level: EffectQualityLevel,
  fps?: number
): Exclude<EffectQualityLevel, 'auto'> {
  if (level !== 'auto') return level;
  if (fps == null) return 'medium';
  if (fps >= 55) return 'high';
  if (fps >= 40) return 'medium';
  if (fps >= 28) return 'low';
  return 'off';
}

/** Scale post-FX intensity for adaptive quality without disabling stack. */
export function applyEffectQualityBudget(
  visualFx: VisualFxSettings,
  level: EffectQualityLevel,
  fps?: number
): VisualFxSettings {
  const resolved = resolveEffectQualityLevel(level, fps);
  const scale = LEVEL_SCALE[resolved];

  if (resolved === 'off') {
    return {
      ...visualFx,
      bloomEnabled: false,
      dofEnabled: false,
      godRaysEnabled: false,
      ssaoEnabled: false,
      chromaticAberration: 0,
      particlesEnabled: false,
    };
  }

  return {
    ...visualFx,
    bloomEnabled: visualFx.bloomEnabled && scale > 0.2,
    bloomIntensity: (visualFx.bloomIntensity ?? 0.3) * scale,
    dofEnabled: visualFx.dofEnabled && scale >= 0.7,
    ssaoEnabled: visualFx.ssaoEnabled && scale >= 0.45,
    ssaoIntensity: (visualFx.ssaoIntensity ?? 0.8) * scale,
    godRaysEnabled: visualFx.godRaysEnabled && scale >= 0.85,
    chromaticAberration: (visualFx.chromaticAberration ?? 0) * scale,
    vignetteIntensity: (visualFx.vignetteIntensity ?? 0.2) * Math.min(1, scale + 0.15),
    particleIntensity: (visualFx.particleIntensity ?? 0.5) * scale,
    materialDetailing: visualFx.materialDetailing && scale >= 0.55,
  };
}

export function suggestQualityModeFromFps(fps: number): import('../scene/types').QualityMode {
  if (fps >= 50) return 'quality';
  if (fps >= 32) return 'balanced';
  return 'performance';
}
