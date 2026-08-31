import type { CanonicalBoneId } from './types';

/** Humanoid canonical bone set — language-agnostic internal IDs. */
export const CANONICAL_BONE_IDS: readonly CanonicalBoneId[] = [
  'root',
  'center',
  'hips',
  'waist',
  'spine',
  'chest',
  'neck',
  'head',
  'left_shoulder',
  'left_arm',
  'left_elbow',
  'left_wrist',
  'left_hand',
  'right_shoulder',
  'right_arm',
  'right_elbow',
  'right_wrist',
  'right_hand',
  'left_leg',
  'left_knee',
  'left_ankle',
  'left_foot',
  'left_toe',
  'right_leg',
  'right_knee',
  'right_ankle',
  'right_foot',
  'right_toe',
] as const;

/** Minimum canonical bones for a usable humanoid rig. */
export const CORE_CANONICAL_BONES: readonly CanonicalBoneId[] = [
  'center',
  'head',
  'left_arm',
  'right_arm',
  'left_leg',
  'right_leg',
];

export function isCanonicalBoneId(id: string): id is CanonicalBoneId {
  return (CANONICAL_BONE_IDS as readonly string[]).includes(id);
}

export function canonicalLabel(id: CanonicalBoneId): string {
  return id.replace(/_/g, ' ');
}
