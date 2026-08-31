/** Persist saved shots (local). */
import type { ShotAnchor, ShotComposerState } from './types';
import { DEFAULT_SHOT_COMPOSER } from './types';

const KEY = 'as_shot_composer_v1';

export function loadShotComposerState(): ShotComposerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SHOT_COMPOSER };
    const parsed = JSON.parse(raw) as Partial<ShotComposerState>;
    return {
      ...DEFAULT_SHOT_COMPOSER,
      ...parsed,
      version: 1,
      mode: 'idle',
      ghostHit: null,
      savedShots: Array.isArray(parsed.savedShots) ? parsed.savedShots.slice(0, 40) : [],
    };
  } catch {
    return { ...DEFAULT_SHOT_COMPOSER };
  }
}

export function saveShotComposerPersisted(state: ShotComposerState): void {
  try {
    const slim: Partial<ShotComposerState> = {
      version: 1,
      aspect: state.aspect,
      shotPreset: state.shotPreset,
      cameraPreset: state.cameraPreset,
      scaleMode: state.scaleMode,
      customHeight: state.customHeight,
      orientMode: state.orientMode,
      framingFocus: state.framingFocus,
      guides: state.guides,
      savedShots: state.savedShots.slice(0, 40),
      activeShotId: state.activeShotId,
      transitionEase: state.transitionEase,
      transitionMs: state.transitionMs,
      floorYOverride: state.floorYOverride,
      keepUpright: state.keepUpright,
    };
    localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* ignore */
  }
}

export function nextShotName(existing: ShotAnchor[]): string {
  const n = existing.length + 1;
  return `Shot ${String(n).padStart(2, '0')}`;
}
