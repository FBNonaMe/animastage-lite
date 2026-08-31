/**
 * One-click post tools on reconstructed / timeline motion.
 */
import type { TimelineKeyframe } from '../../types';
import type { WhamPoseSequence, WhamPostToolId } from './types';
import { stabilizeHands } from './handStabilize';
import { stabilizeLegs } from './legStabilize';
import { recoverRootMotion } from './rootMotion';
import { refineMotionSequence } from './refine';
import { applyTemporalConsistency } from './temporalSmooth';
import { applyBezierCurves, optimizeKeyframes } from './keyframeGen';

export function applyPostToolToSequence(
  sequence: WhamPoseSequence,
  tool: WhamPostToolId
): WhamPoseSequence {
  switch (tool) {
    case 'smooth':
      return applyTemporalConsistency(sequence, 0.2);
    case 'reduce_jitter':
      return refineMotionSequence(sequence, 0.7);
    case 'clean_hands':
      return stabilizeHands(sequence, 3);
    case 'clean_feet':
      return stabilizeLegs(sequence, 3);
    case 'fix_root':
      return recoverRootMotion(sequence, 0.7);
    case 'improve_dance': {
      let s = stabilizeHands(sequence, 2);
      s = stabilizeLegs(s, 2);
      s = refineMotionSequence(s, 0.55);
      return recoverRootMotion(s, 0.55);
    }
    case 'optimize_keys':
    case 'recalc_curves':
      return sequence;
    default:
      return sequence;
  }
}

function smoothAllTracks(keys: TimelineKeyframe[]): TimelineKeyframe[] {
  const byTrack = new Map<string, TimelineKeyframe[]>();
  for (const k of keys) {
    const list = byTrack.get(k.track) ?? [];
    list.push(k);
    byTrack.set(k.track, list);
  }
  const out: TimelineKeyframe[] = [];
  for (const [, list] of byTrack) {
    list.sort((a, b) => a.frame - b.frame);
    if (list.length < 3) {
      out.push(...list);
      continue;
    }
    out.push(list[0]!);
    for (let i = 1; i < list.length - 1; i++) {
      const a = list[i - 1]!;
      const b = list[i]!;
      const c = list[i + 1]!;
      out.push({ ...b, value: (a.value + b.value * 2 + c.value) / 4 });
    }
    out.push(list[list.length - 1]!);
  }
  return out.sort((a, b) => a.frame - b.frame || a.track.localeCompare(b.track));
}

function softFilterTracks(keys: TimelineKeyframe[], prefixes: string[]): TimelineKeyframe[] {
  const match = (t: string) => prefixes.some((p) => t.startsWith(p));
  const targeted = keys.filter((k) => match(k.track));
  const rest = keys.filter((k) => !match(k.track));
  return [...rest, ...smoothAllTracks(targeted)].sort(
    (a, b) => a.frame - b.frame || a.track.localeCompare(b.track)
  );
}

export function applyPostToolToKeyframes(
  keys: TimelineKeyframe[],
  tool: WhamPostToolId
): TimelineKeyframe[] {
  switch (tool) {
    case 'smooth':
    case 'reduce_jitter':
    case 'improve_dance':
      return applyBezierCurves(smoothAllTracks(keys));
    case 'optimize_keys':
      return optimizeKeyframes(keys, 2.5);
    case 'recalc_curves':
      return applyBezierCurves(keys);
    case 'clean_hands':
      return softFilterTracks(keys, ['bone_l_arm', 'bone_r_arm']);
    case 'clean_feet':
    case 'fix_root':
      return softFilterTracks(keys, ['bone_waist', 'bone_spine']);
    default:
      return keys;
  }
}

export const WHAM_POST_TOOLS: { id: WhamPostToolId; label: string }[] = [
  { id: 'smooth', label: 'Smooth Motion' },
  { id: 'reduce_jitter', label: 'Reduce Jitter' },
  { id: 'clean_hands', label: 'Clean Hands' },
  { id: 'clean_feet', label: 'Clean Feet' },
  { id: 'fix_root', label: 'Fix Root Motion' },
  { id: 'improve_dance', label: 'Improve Dance' },
  { id: 'optimize_keys', label: 'Optimize Keys' },
  { id: 'recalc_curves', label: 'Recalculate Curves' },
];
