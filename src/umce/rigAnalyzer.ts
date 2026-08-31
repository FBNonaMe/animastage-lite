import { CORE_CANONICAL_BONES } from './canonicalBones';
import { detectRigFormatHint } from './boneDictionary';
import type {
  CanonicalBoneId,
  CanonicalBoneMatch,
  RigAnalysisResult,
  RigFormatHint,
  UmceBoneRecord,
  UmceModelContext,
} from './types';

export function analyzeRig(
  ctx: UmceModelContext,
  bones: UmceBoneRecord[],
  canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>>
): RigAnalysisResult {
  const boneNames = bones.map((b) => b.name);
  const formatHint: RigFormatHint = detectRigFormatHint(boneNames);

  const mappedCanonical = new Set(Object.keys(canonicalMap) as CanonicalBoneId[]);
  const missingCanonical = CORE_CANONICAL_BONES.filter((id) => !mappedCanonical.has(id));

  const mappedIndices = new Set(
    Object.values(canonicalMap).map((m) => m?.boneIndex).filter((i) => i !== undefined)
  );

  const extraBones = bones
    .filter((b) => !mappedIndices.has(b.index) && !b.isHelper && !b.isTwist)
    .map((b) => b.name)
    .slice(0, 32);

  return {
    formatHint,
    missingCanonical,
    extraBones,
    twistBones: bones.filter((b) => b.isTwist).map((b) => b.name),
    helperBones: bones.filter((b) => b.isHelper).map((b) => b.name),
    hiddenBones: bones.filter((b) => (b.flag ?? 0) & 0x8).map((b) => b.name),
    physicsOnlyBones: bones
      .filter((b) => b.isPhysicsOnly || ((b.deformWeight ?? 0) < 0.001 && b.isIk === false))
      .map((b) => b.name)
      .slice(0, 24),
    ikOnlyBones: bones.filter((b) => b.isIk && (b.deformWeight ?? 1) < 0.01).map((b) => b.name),
  };
}
