import type { MotionOptimizerFlags, AnimationLibraryAsset } from './types';
import { DEFAULT_OPTIMIZER_FLAGS } from './defaults';
import type { TimelineKeyframe } from '../types';

/**
 * One-click motion optimizer — cleans timeline keyframes when present.
 * VMD blob streams keep optimizer flags for playback-time soft fixes.
 */
export function optimizeKeyframes(
  keys: TimelineKeyframe[],
  flags: MotionOptimizerFlags = DEFAULT_OPTIMIZER_FLAGS
): TimelineKeyframe[] {
  let out = [...keys].sort((a, b) => a.frame - b.frame || a.track.localeCompare(b.track));

  if (flags.removeDuplicateKeys) {
    const seen = new Set<string>();
    out = out.filter((k) => {
      const id = `${k.track}@${k.frame}@${JSON.stringify(k.value)}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  if (flags.denoise || flags.fixHandJitter) {
    out = smoothTracks(out, flags.fixHandJitter ? 0.35 : 0.2);
  }

  if (flags.smoothCurves) {
    out = smoothTracks(out, 0.45);
  }

  if (flags.reduceKeys) {
    out = reduceKeys(out, 0.02);
  }

  if (flags.fixBrokenCurves) {
    out = out.filter((k) => Number.isFinite(k.frame) && k.value != null);
  }

  return out;
}

function smoothTracks(keys: TimelineKeyframe[], alpha: number): TimelineKeyframe[] {
  const byTrack = new Map<string, TimelineKeyframe[]>();
  for (const k of keys) {
    const list = byTrack.get(k.track) ?? [];
    list.push(k);
    byTrack.set(k.track, list);
  }
  const result: TimelineKeyframe[] = [];
  for (const [, list] of byTrack) {
    list.sort((a, b) => a.frame - b.frame);
    for (let i = 0; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i]!;
      const next = list[i + 1];
      if (
        typeof cur.value === 'number' &&
        prev &&
        next &&
        typeof prev.value === 'number' &&
        typeof next.value === 'number'
      ) {
        const blended = prev.value * (alpha * 0.5) + cur.value * (1 - alpha) + next.value * (alpha * 0.5);
        result.push({ ...cur, value: blended });
      } else {
        result.push(cur);
      }
    }
  }
  return result.sort((a, b) => a.frame - b.frame);
}

function reduceKeys(keys: TimelineKeyframe[], epsilon: number): TimelineKeyframe[] {
  const byTrack = new Map<string, TimelineKeyframe[]>();
  for (const k of keys) {
    const list = byTrack.get(k.track) ?? [];
    list.push(k);
    byTrack.set(k.track, list);
  }
  const result: TimelineKeyframe[] = [];
  for (const [, list] of byTrack) {
    list.sort((a, b) => a.frame - b.frame);
    if (list.length === 0) continue;
    result.push(list[0]!);
    let last = list[0]!;
    for (let i = 1; i < list.length - 1; i++) {
      const k = list[i]!;
      if (typeof k.value === 'number' && typeof last.value === 'number') {
        if (Math.abs(k.value - last.value) < epsilon) continue;
      }
      result.push(k);
      last = k;
    }
    if (list.length > 1) result.push(list[list.length - 1]!);
  }
  return result.sort((a, b) => a.frame - b.frame);
}

export function applyOptimizerToAsset(
  asset: AnimationLibraryAsset,
  flags: MotionOptimizerFlags = DEFAULT_OPTIMIZER_FLAGS
): AnimationLibraryAsset {
  const keyframes = asset.keyframes?.length
    ? optimizeKeyframes(asset.keyframes, flags)
    : asset.keyframes;
  return {
    ...asset,
    keyframes,
    optimized: { ...flags },
    updatedAt: Date.now(),
    tags: asset.tags.includes('optimized') ? asset.tags : [...asset.tags, 'optimized'],
  };
}
