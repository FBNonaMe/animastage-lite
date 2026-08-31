import type { AnimationLibraryState } from './types';
import { createDefaultAnimationLibrary } from './defaults';
import { loadLibraryMeta, mergePersistedMeta, saveLibraryMeta } from './storage';

export function initAnimationLibrary(): AnimationLibraryState {
  const base = createDefaultAnimationLibrary();
  return mergePersistedMeta(base, loadLibraryMeta());
}

export function patchAnimationLibrary(
  prev: AnimationLibraryState,
  patch: Partial<AnimationLibraryState>
): AnimationLibraryState {
  const next = { ...prev, ...patch, version: 1 as const };
  saveLibraryMeta(next);
  return next;
}
