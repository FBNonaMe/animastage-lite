export { initJoltPhysics, isJoltInitialized, getJolt } from './joltLoader';
export type { JoltModule } from './joltLoader';
export {
  LAYER_STATIC,
  LAYER_KINEMATIC,
  LAYER_DYNAMIC,
  NUM_OBJECT_LAYERS,
} from './joltCollisionLayers';
export { MMDPhysicsJolt, setupMeshJoltPhysics } from './mmdPhysicsJolt';
export {
  fixScenePhysics,
  softResetModelPhysics,
  setModelPhysicsHidden,
  applyStabilitySafetyLayer,
  detectPhysicsInstability,
  shouldSuggestFixPhysics,
  clearPhysicsInstabilityHint,
  computeModelContentHash,
  warnDuplicateModelImport,
  applyDuplicateCollisionIsolation,
} from './physicsStabilitySystem';
export type { FixScenePhysicsResult } from './physicsStabilitySystem';
export {
  registerPhysicsModel,
  unregisterPhysicsModel,
  updatePhysicsModelVisibility,
  getAllPhysicsModels,
  allocateCollisionGroupBit,
} from './physicsStabilityRegistry';
export type { PhysicsModelRegistration } from './physicsStabilityRegistry';
export { JoltPhysicsFrameSync } from './JoltPhysicsFrameSync';
export {
  PhysicsWorker,
  disposePhysicsWorker,
  getPhysicsWorker,
} from '../engine/PhysicsWorker';
export { isSharedPhysicsAvailable } from '../engine/physicsSharedLayout';
export { safeJoltDestroy, JoltDisposableStack } from './joltWasmSafe';
export { validateMmdConstraintDef } from './mmdConstraintValidation';
export type { MMDRigidBodyDef, MMDConstraintDef, MMDPhysicsBundle } from './mmdTypes';
