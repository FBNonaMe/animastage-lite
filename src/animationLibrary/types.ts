/**
 * Universal Custom Animation Library — standalone motion assets + per-character assign.
 */
import type { TimelineKeyframe } from '../types';
import type { CanonicalBoneId } from '../umce/types';

export type AnimationFormatId =
  | 'vmd'
  | 'bvh'
  | 'fbx'
  | 'gltf'
  | 'json'
  | 'asmotion'
  | 'template'
  | 'pack';

export type SkeletonTypeId =
  | 'mmd'
  | 'vrm'
  | 'mixamo'
  | 'humanoid'
  | 'fbx'
  | 'gltf'
  | 'universal'
  | 'unknown';

export type CompatibilityStatus = 'compatible' | 'retarget' | 'manual' | 'unsupported';

export type RetargetSlotId =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_upper_arm'
  | 'right_upper_arm'
  | 'left_lower_arm'
  | 'right_lower_arm'
  | 'left_hand'
  | 'right_hand'
  | 'left_upper_leg'
  | 'right_upper_leg'
  | 'left_lower_leg'
  | 'right_lower_leg'
  | 'left_foot'
  | 'right_foot'
  | 'left_toe'
  | 'right_toe';

export const RETARGET_SLOTS: Array<{ id: RetargetSlotId; label: string; canonical: CanonicalBoneId }> = [
  { id: 'hips', label: 'Hips', canonical: 'hips' },
  { id: 'spine', label: 'Spine', canonical: 'spine' },
  { id: 'chest', label: 'Chest', canonical: 'chest' },
  { id: 'neck', label: 'Neck', canonical: 'neck' },
  { id: 'head', label: 'Head', canonical: 'head' },
  { id: 'left_shoulder', label: 'L Shoulder', canonical: 'left_shoulder' },
  { id: 'right_shoulder', label: 'R Shoulder', canonical: 'right_shoulder' },
  { id: 'left_upper_arm', label: 'L Upper Arm', canonical: 'left_arm' },
  { id: 'right_upper_arm', label: 'R Upper Arm', canonical: 'right_arm' },
  { id: 'left_lower_arm', label: 'L Lower Arm', canonical: 'left_elbow' },
  { id: 'right_lower_arm', label: 'R Lower Arm', canonical: 'right_elbow' },
  { id: 'left_hand', label: 'L Hand', canonical: 'left_wrist' },
  { id: 'right_hand', label: 'R Hand', canonical: 'right_wrist' },
  { id: 'left_upper_leg', label: 'L Upper Leg', canonical: 'left_leg' },
  { id: 'right_upper_leg', label: 'R Upper Leg', canonical: 'right_leg' },
  { id: 'left_lower_leg', label: 'L Lower Leg', canonical: 'left_knee' },
  { id: 'right_lower_leg', label: 'R Lower Leg', canonical: 'right_knee' },
  { id: 'left_foot', label: 'L Foot', canonical: 'left_ankle' },
  { id: 'right_foot', label: 'R Foot', canonical: 'right_ankle' },
  { id: 'left_toe', label: 'L Toe', canonical: 'left_toe' },
  { id: 'right_toe', label: 'R Toe', canonical: 'right_toe' },
];

export interface RetargetMappingPreset {
  id: string;
  name: string;
  sourceSkeleton: SkeletonTypeId;
  targetSkeleton: SkeletonTypeId;
  /** Slot → source bone name (motion) then remapped at assign time via UMCE. */
  slotMap: Partial<Record<RetargetSlotId, string>>;
  createdAt: number;
}

export interface MotionOptimizerFlags {
  fixFootSliding: boolean;
  fixHandJitter: boolean;
  fixBrokenCurves: boolean;
  removeDuplicateKeys: boolean;
  denoise: boolean;
  fixRootInstability: boolean;
  smoothCurves: boolean;
  reduceKeys: boolean;
  bakeMotion: boolean;
}

export interface CharacterMotionOverride {
  modelId: string;
  assetId: string;
  playbackOffset: number;
  speed: number;
  loop: boolean;
  rootMotion: boolean;
  rootMotionScale: number;
  mappingPresetId: string | null;
  /** Optional bone remap override for this character. */
  boneRemap?: Record<string, string>;
}

export interface AnimationLibraryAsset {
  id: string;
  name: string;
  format: AnimationFormatId;
  durationSec: number;
  fps: number;
  skeletonType: SkeletonTypeId;
  loop: boolean;
  tags: string[];
  author: string;
  compatibility: CompatibilityStatus;
  /** Emoji / short mark for card thumbnail when no image. */
  thumbnail: string;
  previewImageUrl?: string | null;
  createdAt: number;
  updatedAt: number;
  packId?: string | null;
  /** Built-in template id (procedural). */
  templateId?: string | null;
  /** Runtime blob URLs for VMD (session). */
  vmdBlobUrls?: string[];
  vmdFileNames?: string[];
  fileMap?: Record<string, string>;
  cameraVmdBlobUrl?: string | null;
  cameraVmdFileName?: string | null;
  hasCameraVmd?: boolean;
  /** Timeline keyframes for JSON / asmotion. */
  keyframes?: TimelineKeyframe[];
  /** Original file name(s) for display. */
  sourceFileNames?: string[];
  /** Opaque payload for BVH/FBX/GLTF until converters land. */
  rawBlobUrl?: string | null;
  optimized?: MotionOptimizerFlags;
  mappingPresetId?: string | null;
  favorite?: boolean;
}

export interface AnimationPack {
  id: string;
  name: string;
  author: string;
  tags: string[];
  previewImageUrl?: string | null;
  assetIds: string[];
  createdAt: number;
}

export interface AnimationLibraryState {
  version: 1;
  assets: AnimationLibraryAsset[];
  packs: AnimationPack[];
  mappingPresets: RetargetMappingPreset[];
  assignments: CharacterMotionOverride[];
  selectedAssetId: string | null;
  previewPlaying: boolean;
  previewSpeed: number;
  previewLoop: boolean;
  previewFrame: number;
}

/** Native AnimaStage motion document (.asmotion). */
export interface AsMotionDocument {
  version: 1;
  kind: 'animastage.motion';
  name: string;
  fps: number;
  durationSec: number;
  loop: boolean;
  skeletonType: SkeletonTypeId;
  tags: string[];
  author: string;
  thumbnail?: string;
  previewImageDataUrl?: string | null;
  boneKeys: TimelineKeyframe[];
  morphKeys?: TimelineKeyframe[];
  cameraKeys?: TimelineKeyframe[];
  mapping?: Partial<Record<RetargetSlotId, string>>;
  metadata?: Record<string, string | number | boolean>;
}
