import type { CameraKeyframe } from '../types';
import { analyzeReferenceVideo } from '../product/cinematic/reference/analyzer';
import {
  applyCameraTemplate,
  getBuiltinTemplate,
  matchTemplatesToReference,
  tweakTemplateForReference,
} from './templates';
import { smoothCameraKeyframes } from './smoothCamera';

/**
 * Auto Match — pick closest cinematic template + tweak to reference style.
 */
export async function autoMatchCameraFromReference(
  file: File,
  durationFrames: number,
  subjectY = 10,
  viewportFormat: import('../types').ViewportFormat = '16:9',
): Promise<{ keyframes: CameraKeyframe[]; recommendedId: string; notes: string }> {
  const analysis = await analyzeReferenceVideo(file);
  const matches = matchTemplatesToReference(analysis, 3);
  const bestId = matches[0]?.templateId ?? 'character_showcase';
  const base = getBuiltinTemplate(bestId);
  if (!base) {
    return {
      keyframes: [],
      recommendedId: bestId,
      notes: 'No template match.',
    };
  }

  const tweaked = tweakTemplateForReference(base, analysis);
  const applied = applyCameraTemplate(tweaked, {
    focus: [0, subjectY, 0],
    characterHeight: Math.max(12, subjectY * 1.55),
    durationFrames: Math.max(90, durationFrames),
    viewportFormat,
  });

  return {
    keyframes: smoothCameraKeyframes(applied.keyframes),
    recommendedId: bestId,
    notes: `${matches[0]?.reason ?? 'Style match'} · ${applied.notes}`,
  };
}
