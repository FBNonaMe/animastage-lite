import type { AppState } from '../../types';
import { buildAutoScene } from '../../sceneComposer/autoScene';
import type { SceneVariation } from './types';
import { VISUAL_STYLE_CARDS } from './visualStyleCards';

export interface SceneScoreInput {
  faceVisibility: number;
  composition: number;
  lighting: number;
  contrast: number;
  noClipping: number;
  framing: number;
  performance: number;
}

export function scoreSceneVariation(input: SceneScoreInput): { score: number; stars: 1 | 2 | 3 | 4 | 5 } {
  const weights = [0.2, 0.15, 0.15, 0.1, 0.15, 0.15, 0.1];
  const values = [
    input.faceVisibility,
    input.composition,
    input.lighting,
    input.contrast,
    input.noClipping,
    input.framing,
    input.performance,
  ];
  const score = values.reduce((sum, v, i) => sum + v * weights[i]!, 0);
  const stars = (
    score >= 0.92 ? 5 : score >= 0.8 ? 4 : score >= 0.65 ? 3 : score >= 0.5 ? 2 : 1
  ) as 1 | 2 | 3 | 4 | 5;
  return { score, stars };
}

const CAMERA_PRESETS = ['orbit', 'showcase', 'dance', 'portrait'] as const;

function pseudoRand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function generateSceneVariations(
  count: 5 | 10 | 20 | 50,
  baseStyleId: string,
  seed = Date.now()
): SceneVariation[] {
  const styles = VISUAL_STYLE_CARDS.map((c) => c.id);
  const out: SceneVariation[] = [];

  for (let i = 0; i < count; i++) {
    const r = (n: number) => pseudoRand(seed + i * 17 + n);
    const cameraPreset = CAMERA_PRESETS[Math.floor(r(1) * CAMERA_PRESETS.length)]!;
    const styleId = i === 0 ? baseStyleId : styles[Math.floor(r(2) * styles.length)]!;

    const input: SceneScoreInput = {
      faceVisibility: 0.55 + r(3) * 0.45,
      composition: 0.5 + r(4) * 0.5,
      lighting: 0.45 + r(5) * 0.55,
      contrast: 0.5 + r(6) * 0.5,
      noClipping: 0.6 + r(7) * 0.4,
      framing: 0.55 + r(8) * 0.45,
      performance: 0.5 + r(9) * 0.5,
    };

    const { score, stars } = scoreSceneVariation(input);
    const notes: string[] = [];
    if (input.faceVisibility > 0.85) notes.push('Great face visibility');
    if (input.lighting > 0.8) notes.push('Strong lighting');
    if (input.framing > 0.8) notes.push('Good framing');
    if (input.performance > 0.75) notes.push('Smooth performance');

    out.push({
      id: `var_${i}`,
      label: `Variation ${i + 1}`,
      cameraPreset,
      styleId,
      score,
      stars,
      notes,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

export function pickBestVariation(variations: SceneVariation[]): SceneVariation | null {
  return variations[0] ?? null;
}

export function buildAutoScenePatch(state: AppState) {
  return buildAutoScene(state);
}
