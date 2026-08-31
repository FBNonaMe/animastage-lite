import type { AppState } from '../../../types';
import type { VisualQualityReport } from '../types';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Pre-export visual quality heuristics — no GPU readback required. */
export function analyzeVisualQuality(appState: AppState): VisualQualityReport {
  const fx = appState.visualFx;
  const keyCount = appState.cameraKeyframes.length;
  const hasMotion = appState.models.some((m) => m.keyframes?.length || m.hasVmdAnimation);

  const lighting = clamp01(
    (fx.environmentIntensity ?? 0.7) * 0.4 +
      (fx.bloomEnabled ? (fx.bloomIntensity ?? 0) * 0.8 : 0.15) +
      (fx.ssaoEnabled ? 0.15 : 0) +
      (appState.sceneComposer?.exposure != null ? 0.2 : 0.1)
  );

  const composition = clamp01(
    (keyCount >= 3 ? 0.85 : keyCount >= 1 ? 0.65 : 0.35) +
      (appState.cinematic?.compositionEnabled ? 0.1 : 0)
  );

  const camera = clamp01(
    (keyCount >= 2 ? 0.9 : keyCount === 1 ? 0.55 : 0.25) +
      (appState.cameraMode === 'mmd' ? 0.1 : 0)
  );

  const visibility = clamp01(appState.models.filter((m) => m.visible).length > 0 ? 0.9 : 0.1);

  const contrast = clamp01(
    0.5 + (appState.sceneComposer?.contrast ?? 0) * 0.3 + (fx.vignetteEnabled ? 0.1 : 0)
  );

  const exposure = clamp01(1 - Math.abs((fx.toneExposure ?? 0.9) - 0.88) * 2);

  const weights = [0.2, 0.18, 0.22, 0.15, 0.12, 0.13];
  const score = clamp01(
    lighting * weights[0]! +
      composition * weights[1]! +
      camera * weights[2]! +
      visibility * weights[3]! +
      contrast * weights[4]! +
      exposure * weights[5]!
  );

  const stars = (
    score >= 0.9 ? 5 : score >= 0.78 ? 4 : score >= 0.62 ? 3 : score >= 0.45 ? 2 : 1
  ) as VisualQualityReport['stars'];

  const suggestions: string[] = [];
  if (keyCount < 2) suggestions.push('Add 2–4 camera keyframes for smoother cinematic motion.');
  if (!fx.bloomEnabled) suggestions.push('Enable soft bloom for anime-style glow.');
  if (!hasMotion) suggestions.push('Apply a motion template before export.');
  if ((fx.toneExposure ?? 1) > 1.05) suggestions.push('Lower exposure slightly to avoid blown highlights.');
  if (score < 0.6) suggestions.push('Try a cinematic lighting preset (Anime Soft or Golden Hour).');

  return {
    score,
    stars,
    lighting,
    composition,
    camera,
    visibility,
    contrast,
    exposure,
    depth: clamp01(fx.dofEnabled ? 0.75 : 0.45),
    suggestions,
  };
}
