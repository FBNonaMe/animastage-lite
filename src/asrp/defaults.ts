import type { AsrpSettings } from './types';

export const DEFAULT_ASRP: AsrpSettings = {
  enabled: true,
  pipeline: 'asrp',
  depthStrength: 1,
  silhouetteWidth: 1,
  quality: 'auto',
  samples: 'auto',
  distanceFade: 1,
  heightScale: 1,
  normalBlend: 1,
  parallaxScale: 1,
  shadowInfluence: 0.65,
  reflectionInfluence: 1,
  autoHeightApprox: true,
  animePreserve: true,
  exportBoost: true,
};
