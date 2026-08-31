/**
 * Keyframe generation + reduction + Bezier curve tagging.
 */
import type { TimelineKeyframe, TimelineTrackId } from '../../types';
import { motionSpecToTimelineKeyframes } from '../../ai/motionSpecToTimeline';
import type { MotionSpec } from '../../ai/motionSpec';

function createId(): string {
  return `wham_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Tag keys as Bezier with soft ease — avoid linear / mechanical feel. */
export function applyBezierCurves(keys: TimelineKeyframe[]): TimelineKeyframe[] {
  return keys.map((k) => ({
    ...k,
    interpolation: 'bezier' as const,
    easeIn: k.easeIn ?? 0.42,
    easeOut: k.easeOut ?? 0.42,
  }));
}

/**
 * Reduce redundant keys per track when value change is below tolerance.
 * Always keeps first/last and local extrema.
 */
export function optimizeKeyframes(
  keys: TimelineKeyframe[],
  tolDeg: number
): TimelineKeyframe[] {
  const byTrack = new Map<TimelineTrackId, TimelineKeyframe[]>();
  for (const k of keys) {
    const list = byTrack.get(k.track) ?? [];
    list.push(k);
    byTrack.set(k.track, list);
  }

  const out: TimelineKeyframe[] = [];
  for (const [, list] of byTrack) {
    list.sort((a, b) => a.frame - b.frame);
    if (list.length <= 2) {
      out.push(...list);
      continue;
    }
    out.push(list[0]!);
    for (let i = 1; i < list.length - 1; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      const next = list[i + 1]!;
      const dPrev = Math.abs(cur.value - prev.value);
      const dNext = Math.abs(next.value - cur.value);
      const extremum =
        (cur.value - prev.value) * (next.value - cur.value) < 0 &&
        Math.max(dPrev, dNext) > tolDeg * 0.5;
      if (dPrev >= tolDeg || dNext >= tolDeg || extremum) {
        out.push(cur);
      }
    }
    out.push(list[list.length - 1]!);
  }

  return out
    .map((k) => ({ ...k, id: k.id || createId() }))
    .sort((a, b) => a.frame - b.frame || a.track.localeCompare(b.track));
}

export function generateTimelineKeysFromSpec(
  spec: MotionSpec,
  maxFrames: number,
  keyReduceTol: number
): TimelineKeyframe[] {
  const raw = motionSpecToTimelineKeyframes(spec, maxFrames);
  const curved = applyBezierCurves(raw);
  return optimizeKeyframes(curved, keyReduceTol);
}
