import type { UmceModelContext } from '../umce/types';
import type { UmceReport } from '../umce/types';

export type ApisChainKind =
  | 'hair'
  | 'long_hair'
  | 'short_hair'
  | 'twin_tail'
  | 'ponytail'
  | 'skirt'
  | 'dress'
  | 'cape'
  | 'scarf'
  | 'sleeve'
  | 'tail'
  | 'ribbon'
  | 'accessory'
  | 'unknown_flexible';

export type ApisStabilityGrade = 'excellent' | 'good' | 'fair' | 'recovered';

export type ApisPipelineStatus =
  | 'pending'
  | 'analyzing'
  | 'benchmarking'
  | 'ready'
  | 'cached'
  | 'failed';

export interface ApisBoneMetrics {
  index: number;
  name: string;
  parentIndex: number;
  length: number;
  depth: number;
  childCount: number;
  influenceWeight: number;
  hasPhysicsBody: boolean;
  isIk: boolean;
  isGrant: boolean;
  isHelper: boolean;
  isPhysicsOnly: boolean;
}

export interface ApisDetectedChain {
  id: string;
  kind: ApisChainKind;
  confidence: number;
  boneIndices: number[];
  rigidBodyIndices: number[];
  avgBoneLength: number;
  depth: number;
  vertexInfluence: number;
}

export interface ApisBodyPartClassification {
  chainId: string;
  kind: ApisChainKind;
  confidence: number;
  label: string;
}

export interface ApisRigidBodyTuning {
  bodyIndex: number;
  boneIndex: number;
  massScale: number;
  linearDamping: number;
  angularDamping: number;
  simulate: boolean;
  collisionGroupMask?: number;
}

export interface ApisGlobalTuning {
  physicsRate: number;
  physicsSubsteps: number;
  physicsGravity: number;
  physicsSwing: number;
  stablePhys: boolean;
  maxBenchmarkIterations: number;
}

export interface ApisCollisionPlan {
  /** Rigid-body index → collision mask override. */
  bodyMasks: Record<number, number>;
  /** Pairs of body indices that should not collide. */
  isolatedPairs: Array<[number, number]>;
  torsoGroupBits: number[];
  accessoryGroupBits: number[];
}

export interface ApisBenchmarkResult {
  score: number;
  avgFrameMs: number;
  maxStretch: number;
  maxVelocity: number;
  nanDetected: boolean;
  iterations: number;
  variantLabel: string;
}

export interface ApisPhysicsProfile {
  version: 1;
  modelHash: string;
  generatedAt: number;
  global: ApisGlobalTuning;
  bodies: ApisRigidBodyTuning[];
  chains: ApisDetectedChain[];
  classifications: ApisBodyPartClassification[];
  collision: ApisCollisionPlan;
  constraintRepairs: string[];
  benchmark: ApisBenchmarkResult;
  stability: ApisStabilityGrade;
  optimizationLevel: number;
}

export interface ApisUserSummary {
  hair: string;
  cloth: string;
  accessories: string;
  simulation: string;
  performance: string;
  optimized: boolean;
}

export interface ApisDevDiagnostics {
  chains: ApisDetectedChain[];
  classifications: ApisBodyPartClassification[];
  profile: ApisPhysicsProfile;
  benchmarkHistory: ApisBenchmarkResult[];
  physicsCostMs: number;
  runtimeOptimizationLevel: number;
}

export interface ApisReport {
  status: ApisPipelineStatus;
  modelHash: string;
  profile: ApisPhysicsProfile | null;
  userSummary: ApisUserSummary;
  devDiagnostics?: ApisDevDiagnostics;
  error?: string;
}

export interface ApisPipelineInput {
  mesh: import('three').SkinnedMesh;
  ctx: UmceModelContext;
  umceReport: UmceReport;
  modelFileName?: string;
  contentFingerprint?: string;
  pmxByteSize?: number;
}

export const APIS_PROFILE_VERSION = 1 as const;
export const APIS_MAX_LEARN_ITERATIONS = 3;

export const APIS_DEFAULT_USER_SUMMARY: ApisUserSummary = {
  hair: 'Pending',
  cloth: 'Pending',
  accessories: 'Pending',
  simulation: 'Analyzing',
  performance: '—',
  optimized: false,
};
