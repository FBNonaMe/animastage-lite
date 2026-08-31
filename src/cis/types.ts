import type { ModelAnalysisReport } from '../analyzer/types';
import type { ApisReport, ApisPhysicsProfile } from '../apis/types';
import type { UmceReport } from '../umce/types';
import type { CharacterModelFormat } from '../types';

export type CisPipelineStatus =
  | 'pending'
  | 'validating'
  | 'analyzing'
  | 'optimizing'
  | 'ready'
  | 'cached'
  | 'failed';

export type CisDiagnosticStatus = 'ok' | 'warning' | 'error' | 'skipped';

export type CisPerformanceTier = 'performance' | 'balanced' | 'quality' | 'ultra';

export type CisSourceFormat =
  | 'pmx'
  | 'pmd'
  | 'vrm'
  | 'gltf'
  | 'fbx'
  | 'obj'
  | 'usd'
  | 'unknown';

/** Canonical skeleton region map. */
export type CisSkeletonRegion =
  | 'root'
  | 'center'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'shoulder_l'
  | 'shoulder_r'
  | 'arm_l'
  | 'arm_r'
  | 'hand_l'
  | 'hand_r'
  | 'finger'
  | 'leg_l'
  | 'leg_r'
  | 'foot_l'
  | 'foot_r'
  | 'ik'
  | 'helper'
  | 'hidden'
  | 'physics'
  | 'morph'
  | 'unknown';

export interface CisBoneEntry {
  name: string;
  parentName: string | null;
  depth: number;
  region: CisSkeletonRegion;
  length: number;
  isIk: boolean;
  isHelper: boolean;
  isPhysics: boolean;
  isHidden: boolean;
}

export interface CisSkeletonMap {
  bones: CisBoneEntry[];
  boneCount: number;
  ikChainCount: number;
  helperBoneCount: number;
  physicsBoneCount: number;
  symmetryScore: number;
  hierarchyDepth: number;
  regions: Partial<Record<CisSkeletonRegion, string[]>>;
}

export interface CisMeshStats {
  vertexCount: number;
  triangleCount: number;
  submeshCount: number;
  materialCount: number;
  uvSetCount: number;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  meshDensity: number;
  transparentMaterialCount: number;
  doubleSidedMaterialCount: number;
  alphaMaterialCount: number;
}

export interface CisMorphCategory {
  id: string;
  label: string;
  morphNames: string[];
  detected: boolean;
}

export interface CisMorphProfile {
  totalMorphs: number;
  categories: CisMorphCategory[];
  customMorphs: string[];
  hasFacialExpressions: boolean;
  hasLipSync: boolean;
  hasEyeTracking: boolean;
}

export interface CisMaterialEntry {
  name: string;
  kind: 'toon' | 'pbr' | 'transparent' | 'emissive' | 'outline' | 'unknown';
  hasNormalMap: boolean;
  hasEmissiveMap: boolean;
  metallic: number | null;
  roughness: number | null;
  textureResolution: number | null;
  missingTexture: boolean;
  duplicatedTexture: boolean;
  unused: boolean;
}

export interface CisMaterialProfile {
  materials: CisMaterialEntry[];
  missingTextureCount: number;
  largeTextureCount: number;
  duplicateTextureCount: number;
  unusedMaterialCount: number;
}

export interface CisPhysicsChainSummary {
  kind: string;
  label: string;
  count: number;
  stable: boolean;
}

export interface CisPhysicsProfile {
  rigidBodyCount: number;
  constraintCount: number;
  dynamicBodyCount: number;
  chains: CisPhysicsChainSummary[];
  stability: 'stable' | 'fair' | 'unstable';
  physicsCost: 'low' | 'medium' | 'high';
  apisProfile: ApisPhysicsProfile | null;
}

export interface CisDiagnosticRow {
  id: string;
  label: string;
  status: CisDiagnosticStatus;
  detail?: string;
}

export interface CisDiagnostics {
  rows: CisDiagnosticRow[];
  warningCount: number;
  errorCount: number;
}

export interface CisCapability {
  id: string;
  label: string;
  supported: boolean;
}

export interface CisHealthBreakdown {
  overall: number;
  physics: number;
  skeleton: number;
  morphs: number;
  materials: number;
  textures: number;
  animation: number;
  performance: number;
  compatibility: number;
}

export interface CisPerformanceEstimate {
  cpuCost: 'low' | 'medium' | 'high';
  gpuCost: 'low' | 'medium' | 'high';
  memoryMb: number;
  textureMemoryMb: number;
  physicsCost: 'low' | 'medium' | 'high';
  animationCost: 'low' | 'medium' | 'high';
  expectedFps: number;
  recommendedTier: CisPerformanceTier;
}

export interface CisCompatibilityReport {
  sourceFormat: CisSourceFormat;
  pmxVersion: string | null;
  pmdVersion: boolean;
  vrmReady: boolean;
  gltfReady: boolean;
  missingData: string[];
  brokenReferences: string[];
  unsupportedFeatures: string[];
}

export interface CisAutoRepairPatch {
  id: string;
  category: string;
  description: string;
  applied: boolean;
}

export interface CisFingerprint {
  modelHash: string;
  skeletonHash: string;
  physicsHash: string;
  materialHash: string;
  morphHash: string;
  textureHash: string;
  combined: string;
}

/** Full Character Intelligence Profile — consumed by all engine subsystems. */
export interface CharacterIntelligenceProfile {
  version: 1;
  analyzedAt: number;
  modelFileName?: string;
  modelFormat: CharacterModelFormat;
  sourceFormat: CisSourceFormat;
  fingerprint: CisFingerprint;
  skeleton: CisSkeletonMap;
  mesh: CisMeshStats;
  morphs: CisMorphProfile;
  materials: CisMaterialProfile;
  physics: CisPhysicsProfile;
  diagnostics: CisDiagnostics;
  capabilities: CisCapability[];
  health: CisHealthBreakdown;
  performance: CisPerformanceEstimate;
  compatibility: CisCompatibilityReport;
  repairs: CisAutoRepairPatch[];
  /** Linked subsystem reports (no re-scan needed). */
  modelAnalysis: ModelAnalysisReport | null;
  umceReport: UmceReport | null;
  apisReport: ApisReport | null;
}

export interface CisUserSummary {
  imported: boolean;
  healthPercent: number;
  physicsLabel: string;
  performanceLabel: string;
  visualQualityLabel: string;
  ready: boolean;
  headline: string;
}

export interface CisReport {
  status: CisPipelineStatus;
  profile: CharacterIntelligenceProfile | null;
  userSummary: CisUserSummary;
  error?: string;
}

export interface CisPipelineOptions {
  modelId?: string;
  modelFileName?: string;
  modelFormat?: CharacterModelFormat;
  contentFingerprint?: string;
  fileMap?: Record<string, string>;
  pmxBuffer?: ArrayBuffer | null;
  pmxByteSize?: number;
  applyRepairs?: boolean;
}
