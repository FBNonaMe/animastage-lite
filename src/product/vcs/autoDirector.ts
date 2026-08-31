import type { CameraKeyframe, ViewportFormat } from '../../types';
import type { CharacterProfile, VcsDirectorMode, VcsDirectorVariation } from './types';
import { PROFESSIONAL_MODE_POOL } from './camera/directorModes';
import { generateVcsCameraPath } from './camera/pathGenerator';

function pseudoRand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function scoreVariation(
  keyframes: CameraKeyframe[],
  motionIntensity: number
): { score: number; stars: 1 | 2 | 3 | 4 | 5; notes: string[] } {
  const notes: string[] = [];
  let score = 0.5;

  if (keyframes.length >= 4) {
    score += 0.15;
    notes.push('Smooth multi-key path');
  }
  if (keyframes.length >= 2) {
    const fovRange =
      Math.max(...keyframes.map((k) => k.fov)) - Math.min(...keyframes.map((k) => k.fov));
    if (fovRange > 1 && fovRange < 12) {
      score += 0.1;
      notes.push('Natural FOV variation');
    }
  }

  const hasTargets = keyframes.some((k) => k.target);
  if (hasTargets) {
    score += 0.12;
    notes.push('Target-aware framing');
  }

  if (motionIntensity > 0.6) {
    score += 0.08;
    notes.push('Matches high-energy motion');
  }

  score = Math.min(0.98, score + pseudoRand(keyframes.length * 7) * 0.15);
  const stars = (
    score >= 0.9 ? 5 : score >= 0.78 ? 4 : score >= 0.62 ? 3 : score >= 0.45 ? 2 : 1
  ) as 1 | 2 | 3 | 4 | 5;

  return { score, stars, notes };
}

export function generateAutoDirectorVariations(
  count: 5 | 10 | 20 | 50,
  opts: {
    maxFrames: number;
    modelCount: number;
    viewportFormat: ViewportFormat;
    profile?: CharacterProfile | null;
    motionIntensity?: number;
    seed?: number;
  }
): VcsDirectorVariation[] {
  const seed = opts.seed ?? Date.now();
  const pool = [...PROFESSIONAL_MODE_POOL];
  const out: VcsDirectorVariation[] = [];

  for (let i = 0; i < count; i++) {
    const mode = pool[i % pool.length]! as VcsDirectorMode;
    const motion =
      opts.motionIntensity ?? 0.35 + pseudoRand(seed + i * 13) * 0.55;
    const keyframes = generateVcsCameraPath({
      mode,
      maxFrames: opts.maxFrames,
      modelCount: opts.modelCount,
      viewportFormat: opts.viewportFormat,
      profile: opts.profile,
      motionSpeed: motion,
    });
    const { score, stars, notes } = scoreVariation(keyframes, motion);
    out.push({
      id: `vcs_var_${i}`,
      label: `Take ${i + 1}`,
      mode,
      score,
      stars,
      keyframes,
      notes,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

export function pickBestVariation(variations: VcsDirectorVariation[]): VcsDirectorVariation | null {
  if (variations.length === 0) return null;
  return [...variations].sort((a, b) => b.score - a.score)[0] ?? null;
}
