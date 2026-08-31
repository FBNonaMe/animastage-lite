export type {
  CanonicalBoneId,
  CanonicalBoneMatch,
  MotionCompatResult,
  PhysicsAnalysisResult,
  RigAnalysisResult,
  UmceBoneIdentity,
  UmceDetectionSource,
  UmcePipelineOptions,
  UmceReport,
  UmceRepairAction,
} from './types';

export {
  CANONICAL_BONE_IDS,
  CORE_CANONICAL_BONES,
  canonicalLabel,
  isCanonicalBoneId,
} from './canonicalBones';

export {
  BONE_ALIAS_REGISTRY,
  detectRigFormatHint,
  getAliasesForPoseId,
  lookupCanonicalByName,
  normalizeBoneName,
  POSE_ID_TO_CANONICAL,
} from './boneDictionary';

export { extractUmceContextFromMesh, extractUmceContextFromParsed } from './modelContext';
export { runUniversalScanner, buildBoneIdentities, computeDeformWeights } from './universalScanner';
export { analyzeRig } from './rigAnalyzer';
export { analyzePhysics } from './physicsAnalyzer';
export { buildMotionCompatibilityMap, extractVmdBoneNames } from './motionMapper';
export { runUmcePipeline } from './pipeline';
export { applyUmceMeshRepairs } from './applyRepairs';
export { loadUmceVmdAnimation, buildUmceAnimationClip } from './loadUmceVmd';
export { parseVmdBuffer, applyVmdBoneRemap } from './vmdLoader';
export { setUmceConsoleEnabled, umceLog, umceLogBoneDetected } from './logger';
