import type { VisualFxSettings } from '../types';
import type { EffectLevel, SceneComposerEffectLevels } from './types';

function levelValue(
  level: EffectLevel,
  map: { off: number; low: number; medium: number; high: number; auto: number }
): number {
  return map[level] ?? map.auto;
}

export function effectLevelsToVisualFx(
  levels: SceneComposerEffectLevels,
  base: VisualFxSettings
): Partial<VisualFxSettings> {
  const bloomOn = levels.bloom !== 'off';
  const bloomIntensity = levelValue(levels.bloom, {
    off: 0,
    low: 0.22,
    medium: 0.42,
    high: 0.62,
    auto: base.bloomIntensity ?? 0.42,
  });

  const ssaoOn = levels.ao !== 'off';
  const ssaoIntensity = levelValue(levels.ao, {
    off: 0,
    low: 0.6,
    medium: 1.05,
    high: 1.4,
    auto: base.ssaoIntensity ?? 1.05,
  });

  const dofOn = levels.dof !== 'off';

  return {
    bloomEnabled: bloomOn && bloomIntensity > 0.05,
    bloomIntensity,
    bloomThreshold: levels.glow === 'high' ? 0.38 : levels.glow === 'low' ? 0.72 : 0.55,
    ssaoEnabled: ssaoOn && ssaoIntensity > 0.1,
    ssaoIntensity,
    dofEnabled: dofOn,
    dofBokehScale: levelValue(levels.dof, {
      off: 0,
      low: 1.2,
      medium: 2.2,
      high: 3.2,
      auto: 2.4,
    }),
    floorReflection: levelValue(levels.reflection, {
      off: 0.2,
      low: 0.45,
      medium: 0.72,
      high: 0.88,
      auto: base.floorReflection ?? 0.72,
    }),
    materialDetailing: levels.rim !== 'off',
    materialSmoothing:
      levels.outline === 'high' ? 0.35 : levels.outline === 'medium' ? 0.5 : 0.62,
  };
}

export function visualFxToEffectLevels(fx: VisualFxSettings): SceneComposerEffectLevels {
  const bloom: EffectLevel = !fx.bloomEnabled
    ? 'off'
    : fx.bloomIntensity >= 0.55
      ? 'high'
      : fx.bloomIntensity >= 0.35
        ? 'medium'
        : 'low';

  const ao: EffectLevel = !fx.ssaoEnabled
    ? 'off'
    : (fx.ssaoIntensity ?? 1) >= 1.2
      ? 'high'
      : (fx.ssaoIntensity ?? 1) >= 0.85
        ? 'medium'
        : 'low';

  return {
    bloom,
    glow: bloom,
    outline: fx.materialSmoothing != null && fx.materialSmoothing < 0.45 ? 'high' : 'off',
    rim: fx.materialDetailing === false ? 'off' : 'medium',
    dof: fx.dofEnabled ? 'medium' : 'off',
    ao,
    sss: 'off',
    reflection:
      fx.floorReflection >= 0.8 ? 'high' : fx.floorReflection >= 0.55 ? 'medium' : 'low',
  };
}
