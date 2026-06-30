export {
  MAX_SCENE_CHARACTERS,
  canAddSceneCharacter,
  getSpawnPositionForIndex,
  getNextSpawnPosition,
  countVisibleModels,
} from './sceneModelLayout';
export {
  shouldDeferPhysicsForModel,
  shouldUseLiteRenderForModel,
  shouldSimulatePhysicsForModel,
  shouldCastShadowForModel,
  resolveModelCharacterQuality,
  isMultiCharacterScene,
} from './multiModelPolicy';
export { registerCharacterRoot, resolveHeadTargetForCamera, resolveDuoHeadTargetForCamera, getRegisteredCharacterCount, computeDuoFovBoost } from './characterHeadRegistry';
export { patchStateForMultiCharacterLoad, syncMultiCharacterScenePerf } from './multiCharacterPerf';
export {
  resolveCameraFramingFromModels,
  getStageTargetTuple,
  getStageTargetVector,
} from './cameraFraming';
