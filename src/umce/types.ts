/** Universal Model Compatibility Engine — shared types. */

export type UmceDetectionSource =
  | 'name_jp'
  | 'name_en'
  | 'alias'
  | 'pattern'
  | 'hierarchy'
  | 'skin_weight'
  | 'ik'
  | 'grant'
  | 'physics'
  | 'geometry'
  | 'fallback';

export type CanonicalBoneId =
  | 'root'
  | 'center'
  | 'hips'
  | 'waist'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'left_shoulder'
  | 'left_arm'
  | 'left_elbow'
  | 'left_wrist'
  | 'left_hand'
  | 'right_shoulder'
  | 'right_arm'
  | 'right_elbow'
  | 'right_wrist'
  | 'right_hand'
  | 'left_leg'
  | 'left_knee'
  | 'left_ankle'
  | 'left_foot'
  | 'left_toe'
  | 'right_leg'
  | 'right_knee'
  | 'right_ankle'
  | 'right_foot'
  | 'right_toe';

export type RigFormatHint = 'mmd' | 'mixamo' | 'vrm' | 'valvebiped' | 'unknown';

export interface UmceBoneRecord {
  index: number;
  name: string;
  englishName?: string;
  parentIndex: number;
  position: [number, number, number];
  flag?: number;
  isIk?: boolean;
  isGrant?: boolean;
  isPhysicsOnly?: boolean;
  isTwist?: boolean;
  isHelper?: boolean;
  deformWeight?: number;
}

export interface UmceModelContext {
  format: 'pmx' | 'pmd' | 'unknown';
  bones: UmceBoneRecord[];
  morphCount: number;
  rigidBodies: UmceRigidBodyRecord[];
  constraints: unknown[];
  iks: UmceIkRecord[];
  grants: UmceGrantRecord[];
  vertexCount: number;
  triangleCount?: number;
  modelFileName?: string;
}

export interface UmceRigidBodyRecord {
  index: number;
  name?: string;
  boneIndex: number;
  type: number;
  position?: number[];
  rotation?: number[];
  mass?: number;
  damping?: number;
  collisionGroup?: number;
  collisionMask?: number;
}

export interface UmceIkRecord {
  name?: string;
  target: number;
  effector: number;
  links: number[];
}

export interface UmceGrantRecord {
  boneIndex: number;
  parentIndex: number;
  ratio: number;
  affectRotation: boolean;
  affectPosition: boolean;
}

export interface CanonicalBoneMatch {
  canonicalId: CanonicalBoneId;
  boneIndex: number;
  boneName: string;
  confidence: number;
  source: UmceDetectionSource;
}

export interface UmceBoneIdentity {
  index: number;
  name: string;
  internalId: string;
  canonicalId: CanonicalBoneId | null;
  confidence: number;
  source: UmceDetectionSource;
}

export interface RigAnalysisResult {
  formatHint: RigFormatHint;
  missingCanonical: CanonicalBoneId[];
  extraBones: string[];
  twistBones: string[];
  helperBones: string[];
  hiddenBones: string[];
  physicsOnlyBones: string[];
  ikOnlyBones: string[];
}

export interface PhysicsAnalysisResult {
  rigidBodyCount: number;
  constraintCount: number;
  dynamicCount: number;
  kinematicCount: number;
  missingRigidBodies: string[];
  brokenConstraints: string[];
  duplicateBodies: string[];
  inactiveBodies: string[];
  warnings: string[];
}

export interface MotionCompatResult {
  vmdBoneCount: number;
  mappedCount: number;
  unmappedBones: string[];
  remapTable: Record<string, string>;
  compatibilityPercent: number;
}

export interface UmceRepairAction {
  id: string;
  kind: 'bone_substitute' | 'rigid_body_rebind' | 'constraint_skip' | 'placeholder_body';
  description: string;
  applied: boolean;
}

export interface UmceReport {
  analyzedAt: number;
  modelFileName?: string;
  compatibilityPercent: number;
  fallbackMode: boolean;
  formatHint: RigFormatHint;
  canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>>;
  boneIdentities: UmceBoneIdentity[];
  rig: RigAnalysisResult;
  physics: PhysicsAnalysisResult;
  motion?: MotionCompatResult;
  repairs: UmceRepairAction[];
  warnings: string[];
  stats: {
    boneCount: number;
    morphCount: number;
    ikChains: number;
    rigidBodies: number;
    constraints: number;
    mappedCanonical: number;
  };
}

export interface UmcePipelineOptions {
  modelFileName?: string;
  vmdBoneNames?: string[];
  logToConsole?: boolean;
  applyRepairs?: boolean;
}

export interface VmdMotionData {
  motions: Array<{ boneName: string; frameNum: number; position: number[]; rotation: number[]; interpolation: number[] }>;
  metadata?: { motionCount?: number };
}
