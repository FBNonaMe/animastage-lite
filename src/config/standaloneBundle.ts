/**
 * Paths to the vendored AnimaStage Standalone reference bundle.
 * Served at runtime via Vite (`/vendor/animastage-standalone/...`).
 */
export const STANDALONE_BUNDLE_ROOT = '/vendor/animastage-standalone';

export const STANDALONE_PATHS = {
  effectsLibrary: `${STANDALONE_BUNDLE_ROOT}/assets/effects-library`,
  effectsCatalog: `${STANDALONE_BUNDLE_ROOT}/assets/effects-library/catalog`,
  effectsReadme: `${STANDALONE_BUNDLE_ROOT}/assets/effects-library/README.md`,
  animeNpr: `${STANDALONE_BUNDLE_ROOT}/anime-npr`,
  effectsPlatform: `${STANDALONE_BUNDLE_ROOT}/animestage-next`,
  smartPose: `${STANDALONE_BUNDLE_ROOT}/smart-pose`,
  oidn: `${STANDALONE_BUNDLE_ROOT}/vendor/oidn`,
  mmdRtxHtml: `${STANDALONE_BUNDLE_ROOT}/mmd_rtx.html`,
} as const;

/** Standalone-only modules not yet present in `src/`. */
export const STANDALONE_ONLY_MODULES = [
  'anime-npr (GPL Star Rail NPR)',
  'animestage-next effects platform',
  'assets/effects-library (Ray-MMD + MME archives)',
  'smart-pose',
  'offline-render HQ path',
  'oidn denoise WASM',
  'rtx-engine / weather-system / mocap-system (legacy JS)',
] as const;
