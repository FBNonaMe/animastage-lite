import type { ReflectionSystemSettings } from './types';

/** New projects: SSR / probe reflections off until the user enables them (RP4). */
export const DEFAULT_REFLECTION_SYSTEM: ReflectionSystemSettings = {
  enabled: false,
  boxProjection: true,
  contactHardening: true,
  resolution: 'auto',
  refreshRate: 2.5,
  intensity: 1,
  roughnessInfluence: 1,
  boxVolume: null,
  characterReflections: true,
  environmentReflections: true,
  exportBoost: true,
};
