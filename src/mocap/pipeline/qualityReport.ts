/**
 * Motion quality report after Video → Motion processing.
 */
import type { WhamJointId, WhamPipelineResult, WhamPoseSequence } from '../wham/types';
import { WHAM_JOINT_IDS } from '../wham/types';
import { extractFootContacts } from './footLock';

export interface MocapQualityReport {
  trackingQuality: 'excellent' | 'good' | 'fair' | 'poor';
  averageConfidence: number;
  droppedFrames: number;
  correctedFrames: number;
  footSlidingScore: number;
  boneErrors: number;
  missingFrames: number;
  processingTimeMs: number;
  jointConfidence: Partial<Record<WhamJointId, number>>;
  suggestions: string[];
}

function avgConfidence(sequence: WhamPoseSequence): number {
  let s = 0;
  let n = 0;
  for (const f of sequence.frames) {
    for (const id of WHAM_JOINT_IDS) {
      const c = f.joints[id]?.confidence;
      if (c != null) {
        s += c;
        n += 1;
      }
    }
  }
  return n ? s / n : 0;
}

function countLowConfidenceFrames(sequence: WhamPoseSequence, thr = 0.3): number {
  let count = 0;
  for (const f of sequence.frames) {
    let low = 0;
    let total = 0;
    for (const id of WHAM_JOINT_IDS) {
      const j = f.joints[id];
      if (!j) continue;
      total += 1;
      if (j.confidence < thr) low += 1;
    }
    if (total && low / total > 0.45) count += 1;
  }
  return count;
}

function footSlideScore(sequence: WhamPoseSequence): number {
  const contacts = extractFootContacts(sequence, 0.05);
  if (!contacts.length) return 0;
  let slides = 0;
  for (let i = 1; i < sequence.frames.length; i++) {
    const c = contacts[i - 1];
    if (!c) continue;
    const prev = sequence.frames[i - 1]!;
    const cur = sequence.frames[i]!;
    for (const id of ['leftFoot', 'rightFoot'] as const) {
      const locked = id === 'leftFoot' ? c.left : c.right;
      if (!locked) continue;
      const a = prev.joints[id]?.position;
      const b = cur.joints[id]?.position;
      if (!a || !b) continue;
      const d = Math.hypot(b[0]! - a[0]!, b[2]! - a[2]!);
      if (d > 0.012) slides += 1;
    }
  }
  return Math.min(1, slides / Math.max(1, contacts.length));
}

export function buildMocapQualityReport(
  result: WhamPipelineResult,
  extras?: {
    processingTimeMs?: number;
    correctedFrames?: number;
    boneErrors?: number;
  }
): MocapQualityReport {
  const averageConfidence = avgConfidence(result.sequence);
  const droppedFrames = countLowConfidenceFrames(result.sequence);
  const footSlidingScore = footSlideScore(result.sequence);
  const missingFrames = Math.max(
    0,
    Math.round(result.meta.duration * result.meta.sampleFps) - result.meta.frameCount
  );
  const correctedFrames = extras?.correctedFrames ?? 0;
  const boneErrors = extras?.boneErrors ?? 0;
  const processingTimeMs = extras?.processingTimeMs ?? 0;

  let trackingQuality: MocapQualityReport['trackingQuality'] = 'good';
  if (averageConfidence >= 0.82 && footSlidingScore < 0.12 && droppedFrames < 3) {
    trackingQuality = 'excellent';
  } else if (averageConfidence < 0.45 || droppedFrames > result.meta.frameCount * 0.25) {
    trackingQuality = 'poor';
  } else if (averageConfidence < 0.62 || footSlidingScore > 0.35) {
    trackingQuality = 'fair';
  }

  const suggestions: string[] = [];
  if (averageConfidence < 0.6) {
    suggestions.push('Improve lighting / framing — average confidence is low.');
  }
  if (footSlidingScore > 0.25) {
    suggestions.push('Run Auto Clean or increase Foot Lock strength.');
  }
  if (droppedFrames > 5) {
    suggestions.push('Hold Last Pose filled gaps — re-shoot if motion looks sticky.');
  }
  if (result.source === 'wham-local') {
    suggestions.push('Optional WHAM server can improve world-grounded root motion.');
  }
  if (!suggestions.length) {
    suggestions.push('Motion looks solid — bake to timeline and export when ready.');
  }

  return {
    trackingQuality,
    averageConfidence,
    droppedFrames,
    correctedFrames,
    footSlidingScore,
    boneErrors,
    missingFrames,
    processingTimeMs,
    jointConfidence: result.jointConfidence,
    suggestions,
  };
}
