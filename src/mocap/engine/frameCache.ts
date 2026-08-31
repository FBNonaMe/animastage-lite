/**
 * Frame cache — reuse reconstructed sequences when scrubbing / retargeting character.
 * Detection is NOT re-run when only character or mapping changes.
 */
import type { WhamPipelineResult, WhamPoseSequence } from '../wham/types';

export interface MocapCacheEntry {
  key: string;
  fileFingerprint: string;
  engine: string;
  quality: string;
  sequence: WhamPoseSequence;
  result: WhamPipelineResult;
  createdAt: number;
}

const cache = new Map<string, MocapCacheEntry>();
const MAX_ENTRIES = 6;

export function mocapFileFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function buildMocapCacheKey(
  fingerprint: string,
  engine: string,
  quality: string
): string {
  return `${fingerprint}::${engine}::${quality}`;
}

export function getMocapCache(key: string): MocapCacheEntry | null {
  return cache.get(key) ?? null;
}

export function setMocapCache(entry: MocapCacheEntry): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt
    )[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(entry.key, entry);
}

export function clearMocapCache(): void {
  cache.clear();
}

/** Retarget / character change: reuse sequence, only re-bake keys externally. */
export function getCachedSequence(
  fingerprint: string,
  engine: string,
  quality: string
): WhamPoseSequence | null {
  const hit = getMocapCache(buildMocapCacheKey(fingerprint, engine, quality));
  return hit?.sequence ?? null;
}
