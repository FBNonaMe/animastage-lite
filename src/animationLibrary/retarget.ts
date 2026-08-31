import type {
  CompatibilityStatus,
  RetargetMappingPreset,
  RetargetSlotId,
  SkeletonTypeId,
} from './types';
import { RETARGET_SLOTS } from './types';
import type { CharacterModelFormat, MMDModel } from '../types';

export function inferSkeletonFromModel(model: MMDModel): SkeletonTypeId {
  const fmt = model.modelFormat ?? 'mmd';
  if (fmt === 'mmd' || model.type === 'pmx' || model.type === 'pmd') return 'mmd';
  if (fmt === 'fbx') return 'fbx';
  if (fmt === 'gltf') {
    const name = (model.modelFileName ?? model.name).toLowerCase();
    if (name.endsWith('.vrm') || name.includes('vrm')) return 'vrm';
    return 'gltf';
  }
  return 'humanoid';
}

export function estimateAssetCompatibility(
  assetSkeleton: SkeletonTypeId,
  targetSkeleton: SkeletonTypeId
): CompatibilityStatus {
  if (assetSkeleton === 'universal' || assetSkeleton === targetSkeleton) return 'compatible';
  if (assetSkeleton === 'mmd' && targetSkeleton === 'mmd') return 'compatible';
  if (
    (assetSkeleton === 'mixamo' || assetSkeleton === 'humanoid' || assetSkeleton === 'vrm') &&
    (targetSkeleton === 'mmd' ||
      targetSkeleton === 'vrm' ||
      targetSkeleton === 'fbx' ||
      targetSkeleton === 'gltf' ||
      targetSkeleton === 'humanoid')
  ) {
    return 'retarget';
  }
  if (assetSkeleton === 'unknown') return 'manual';
  return 'retarget';
}

export function createEmptySlotMap(): Partial<Record<RetargetSlotId, string>> {
  const map: Partial<Record<RetargetSlotId, string>> = {};
  for (const slot of RETARGET_SLOTS) map[slot.id] = '';
  return map;
}

/** Default MMD-oriented slot → typical Japanese bone names. */
export function defaultMmdSlotMap(): Partial<Record<RetargetSlotId, string>> {
  return {
    hips: '下半身',
    spine: '上半身',
    chest: '上半身2',
    neck: '首',
    head: '頭',
    left_shoulder: '左肩',
    right_shoulder: '右肩',
    left_upper_arm: '左腕',
    right_upper_arm: '右腕',
    left_lower_arm: '左ひじ',
    right_lower_arm: '右ひじ',
    left_hand: '左手首',
    right_hand: '右手首',
    left_upper_leg: '左足',
    right_upper_leg: '右足',
    left_lower_leg: '左ひざ',
    right_lower_leg: '右ひざ',
    left_foot: '左足首',
    right_foot: '右足首',
    left_toe: '左つま先',
    right_toe: '右つま先',
  };
}

export function createMappingPreset(
  name: string,
  source: SkeletonTypeId,
  target: SkeletonTypeId,
  slotMap?: Partial<Record<RetargetSlotId, string>>
): RetargetMappingPreset {
  return {
    id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    sourceSkeleton: source,
    targetSkeleton: target,
    slotMap: slotMap ?? defaultMmdSlotMap(),
    createdAt: Date.now(),
  };
}

export function formatLabelForModel(fmt?: CharacterModelFormat): string {
  switch (fmt) {
    case 'fbx':
      return 'FBX';
    case 'gltf':
      return 'GLTF/VRM';
    case 'obj':
      return 'OBJ';
    default:
      return 'PMX/PMD';
  }
}

/** Suggest opening Retarget Editor when compatibility is incomplete. */
export function shouldOpenRetargetEditor(status: CompatibilityStatus): boolean {
  return status === 'manual' || status === 'retarget';
}
