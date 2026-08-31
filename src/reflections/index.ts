export type {
  ReflectionSystemSettings,
  ReflectionBoxVolume,
  ReflectionSceneKind,
  ReflectionQualityTier,
  ReflectionProbeState,
  ReflectionQualityProfile,
} from './types';

export {
  sceneKindFromPreset,
  defaultBoxForScene,
} from './types';

export { DEFAULT_REFLECTION_SYSTEM } from './defaults';
export {
  detectReflectionQualityTier,
  getReflectionQualityProfile,
} from './quality';
export {
  detectReflectionSceneKind,
  resolveReflectionBox,
  boxToMinMax,
} from './sceneDetect';
export {
  patchMaterialBoxProjection,
  applyBoxReflectionsToObject,
  syncBoxReflectionUniforms,
  classifyReflectiveMaterial,
} from './materialPatch';
export { ReflectionProbeCache, buildProbeFingerprint } from './probeCache';
export { default as ReflectionSystem } from './ReflectionSystem';
