import type { AnimationLibraryState, MotionOptimizerFlags } from './types';
import { buildReadyMadeAssets } from './readyMade';

export const DEFAULT_OPTIMIZER_FLAGS: MotionOptimizerFlags = {
  fixFootSliding: true,
  fixHandJitter: true,
  fixBrokenCurves: true,
  removeDuplicateKeys: true,
  denoise: true,
  fixRootInstability: true,
  smoothCurves: false,
  reduceKeys: false,
  bakeMotion: false,
};

export function createDefaultAnimationLibrary(): AnimationLibraryState {
  return {
    version: 1,
    assets: buildReadyMadeAssets(),
    packs: [],
    mappingPresets: [],
    assignments: [],
    selectedAssetId: null,
    previewPlaying: false,
    previewSpeed: 1,
    previewLoop: true,
    previewFrame: 0,
  };
}
