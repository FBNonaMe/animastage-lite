import * as THREE from 'three';
import { getAliasesForPoseId } from '../umce/boneDictionary';

/** @deprecated Use UMCE boneDictionary — kept for timeline / gizmo compat. */
export const POSE_BONE_ALIASES: Record<string, string[]> = {
  head: getAliasesForPoseId('head'),
  neck: getAliasesForPoseId('neck'),
  spine: getAliasesForPoseId('spine'),
  waist: getAliasesForPoseId('waist'),
  arm_L: getAliasesForPoseId('arm_L'),
  arm_R: getAliasesForPoseId('arm_R'),
};

export const SIMPLIFIED_BONE_IDS = [
  'head',
  'neck',
  'spine',
  'waist',
  'arm_L',
  'arm_R',
] as const;

export type SimplifiedBoneId = (typeof SIMPLIFIED_BONE_IDS)[number];

export function findBoneByAlias(
  skeleton: THREE.Skeleton,
  boneId: string
): THREE.Bone | null {
  if (!boneId) return null;

  const direct = skeleton.bones.find(
    (b) => b.name === boneId || b.name.toLowerCase() === boneId.toLowerCase()
  );
  if (direct) return direct;

  const aliases = POSE_BONE_ALIASES[boneId];
  if (aliases) {
    for (const alias of aliases) {
      const found = skeleton.bones.find(
        (b) =>
          b.name === alias ||
          b.name.toLowerCase() === alias.toLowerCase() ||
          b.name.includes(alias)
      );
      if (found) return found;
    }
  }

  return (
    skeleton.bones.find(
      (b) =>
        b.name.toLowerCase().includes(boneId.toLowerCase()) ||
        boneId.toLowerCase().includes(b.name.toLowerCase())
    ) ?? null
  );
}
