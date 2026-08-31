import type { AshfallCityState } from './types';

export const ASHFALL_CITY_NAME = 'Ashfall City';
export const ASHFALL_CITY_TAGLINE =
  'Abandoned fictional metropolis — exclusive AnimaStage signature environment';

export const DEFAULT_ASHFALL_CITY: AshfallCityState = {
  enabled: false,
  /** Clean — never auto-select Fog (RP4 / recording must not enable fog by default). */
  variantId: 'clean',
  quality: 'standard',
  ambientFx: true,
  windStrength: 0.55,
  showLandmarks: true,
  activeCameraSpotId: null,
  activePhotoSpotId: null,
};

/** Spawn / auto character placement on enable. */
export const ASHFALL_SPAWN_POSITION: [number, number, number] = [0, 0, 4];
