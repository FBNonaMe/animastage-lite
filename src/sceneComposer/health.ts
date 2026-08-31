import type { AppState } from '../types';
import type { SceneHealthReport } from './types';
import { DEFAULT_SCENE_COMPOSER } from './defaults';

export function computeSceneHealth(state: AppState): SceneHealthReport {
  const fx = state.visualFx;
  const composer = state.sceneComposer ?? DEFAULT_SCENE_COMPOSER;
  const tri =
    state.models.reduce(
      (n, m) => n + (m.cisReport?.profile?.mesh.triangleCount ?? m.modelAnalysis?.stats.triangleCount ?? 0),
      0
    ) || 0;

  const heavyFx =
    fx.bloomEnabled && (fx.bloomIntensity ?? 0) > 0.5 && fx.ssaoEnabled && fx.particlesEnabled;

  let performance = 'Excellent';
  if (tri > 800_000 || heavyFx) performance = 'Good';
  if (tri > 1_200_000) performance = 'Fair';

  const lighting =
    composer.lights.sunEnabled && fx.lightPreset ? 'Optimized' : 'Basic';

  const environment = fx.scenePreset ? 'Ready' : 'Default';

  const weather =
    fx.weatherPreset && fx.weatherPreset !== 'clear'
      ? 'Enabled'
      : fx.particlesEnabled
        ? 'Particles'
        : 'Clear';

  let visualQuality = 'High';
  if (state.characterQuality === 'standard') visualQuality = 'Balanced';
  if (performance === 'Fair') visualQuality = 'Efficient';

  const overallPercent =
    performance === 'Excellent'
      ? 96
      : performance === 'Good'
        ? 84
        : 72;

  return {
    lighting,
    performance,
    environment,
    weather,
    visualQuality,
    overallPercent,
  };
}
