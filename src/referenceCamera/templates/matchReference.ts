/**
 * Recommend closest built-in template from reference analysis style.
 */
import type { ReferenceCameraAnalysis } from '../../product/cinematic/types';
import { BUILTIN_CAMERA_TEMPLATES } from './builtinCatalog';
import type { CameraTemplateDef, TemplateMatchResult } from './types';

const MODE_TAG_BIAS: Record<string, string[]> = {
  orbit: ['orbit', '360', 'showcase'],
  hero: ['hero', 'entrance', 'low'],
  dance: ['dance', 'energy', 'performance', 'fast'],
  showcase: ['showcase', 'orbit', 'slow'],
  drone: ['drone', 'aerial', 'crane'],
  close_up: ['close', 'face', 'ecu', 'dof'],
  tracking: ['track', 'follow'],
  over_shoulder: ['ots', 'dialogue'],
  face: ['face', 'close', 'dialogue'],
  dynamic: ['action', 'dynamic', 'combat', 'fast'],
};

export function matchTemplatesToReference(
  analysis: ReferenceCameraAnalysis,
  limit = 5
): TemplateMatchResult[] {
  const tags = new Set<string>(MODE_TAG_BIAS[analysis.suggestedMode] ?? ['showcase']);
  const avgFov = analysis.avgFov || 42;
  const energy =
    analysis.motionCurve.reduce((a, b) => a + b, 0) /
    Math.max(1, analysis.motionCurve.length);

  if (energy > 0.65) {
    tags.add('fast');
    tags.add('energy');
  } else if (energy < 0.4) {
    tags.add('slow');
    tags.add('soft');
  }
  if (avgFov < 34) {
    tags.add('close');
    tags.add('face');
  } else if (avgFov > 46) {
    tags.add('wide');
    tags.add('full');
  }

  const scored = BUILTIN_CAMERA_TEMPLATES.map((tpl) => {
    let score = 0;
    for (const tag of tpl.styleTags) {
      if (tags.has(tag)) score += 3;
    }
    // FOV proximity
    score += Math.max(0, 4 - Math.abs(tpl.baseFov - avgFov) / 4);
    // Speed vs energy
    score += 2 - Math.abs(tpl.speed - (0.7 + energy * 0.8));
    return {
      templateId: tpl.id,
      score,
      reason: describeMatch(tpl, analysis, energy),
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

function describeMatch(
  tpl: CameraTemplateDef,
  analysis: ReferenceCameraAnalysis,
  energy: number
): string {
  return `Matches ${analysis.suggestedMode} mood · energy ${(energy * 100).toFixed(0)}% · FOV~${Math.round(analysis.avgFov)} → ${tpl.label}`;
}

/**
 * Adapt a matched template toward reference distance / pace hints.
 */
export function tweakTemplateForReference(
  tpl: CameraTemplateDef,
  analysis: ReferenceCameraAnalysis
): CameraTemplateDef {
  const energy =
    analysis.motionCurve.reduce((a, b) => a + b, 0) /
    Math.max(1, analysis.motionCurve.length);
  const avgFov = analysis.avgFov || tpl.baseFov;
  return {
    ...tpl,
    baseFov: (tpl.baseFov * 0.55 + avgFov * 0.45),
    endFov: tpl.endFov != null ? tpl.endFov * 0.6 + avgFov * 0.4 : tpl.endFov,
    speed: Math.max(0.55, Math.min(1.55, tpl.speed * (0.75 + energy * 0.5))),
    radiusMul: Math.max(0.55, Math.min(1.6, tpl.radiusMul * (1.15 - energy * 0.3))),
    durationScale: Math.max(0.65, Math.min(1.35, tpl.durationScale * (1.1 - energy * 0.2))),
  };
}
