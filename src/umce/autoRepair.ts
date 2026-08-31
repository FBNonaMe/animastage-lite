import type {
  CanonicalBoneId,
  CanonicalBoneMatch,
  PhysicsAnalysisResult,
  RigAnalysisResult,
  UmceBoneRecord,
  UmceRepairAction,
} from './types';

export function planAutoRepairs(
  bones: UmceBoneRecord[],
  canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>>,
  rig: RigAnalysisResult,
  physics: PhysicsAnalysisResult
): UmceRepairAction[] {
  const repairs: UmceRepairAction[] = [];

  for (const missing of rig.missingCanonical) {
    const substitute = findNearestCandidate(missing, bones, canonicalMap);
    if (substitute) {
      repairs.push({
        id: `bone_sub_${missing}`,
        kind: 'bone_substitute',
        description: `Substitute ${missing} → ${substitute.name} (nearest candidate)`,
        applied: false,
      });
    }
  }

  for (const broken of physics.brokenConstraints) {
    repairs.push({
      id: `constraint_skip_${broken}`,
      kind: 'constraint_skip',
      description: `Skip broken constraint: ${broken}`,
      applied: false,
    });
  }

  for (const missing of physics.missingRigidBodies) {
    repairs.push({
      id: `placeholder_body_${missing}`,
      kind: 'placeholder_body',
      description: `Placeholder rigid body for unattached: ${missing}`,
      applied: false,
    });
  }

  return repairs;
}

function findNearestCandidate(
  canonicalId: CanonicalBoneId,
  bones: UmceBoneRecord[],
  canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>>
): UmceBoneRecord | null {
  const isLeft = canonicalId.startsWith('left_');
  const isRight = canonicalId.startsWith('right_');
  const isArm = canonicalId.includes('arm') || canonicalId.includes('hand') || canonicalId.includes('elbow');
  const isLeg = canonicalId.includes('leg') || canonicalId.includes('knee') || canonicalId.includes('foot');

  const unmapped = bones.filter((b) => {
    const mapped = Object.values(canonicalMap).some((m) => m?.boneIndex === b.index);
    return !mapped && !b.isHelper;
  });

  let pool = unmapped;
  if (isLeft) pool = pool.filter((b) => b.position[0] > 0);
  if (isRight) pool = pool.filter((b) => b.position[0] < 0);
  if (isArm) pool = pool.filter((b) => b.position[1] > 0);
  if (isLeg) pool = pool.filter((b) => b.position[1] < 10);

  return pool.sort((a, b) => (b.deformWeight ?? 0) - (a.deformWeight ?? 0))[0] ?? null;
}

export function applyCanonicalSubstitutes(
  canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>>,
  repairs: UmceRepairAction[],
  bones: UmceBoneRecord[]
): Partial<Record<CanonicalBoneId, CanonicalBoneMatch>> {
  const next = { ...canonicalMap };
  for (const repair of repairs) {
    if (repair.kind !== 'bone_substitute' || repair.applied) continue;
    const missing = repair.id.replace('bone_sub_', '') as CanonicalBoneId;
    const boneName = repair.description.split('→')[1]?.trim().split(' ')[0];
    const bone = bones.find((b) => b.name === boneName);
    if (!bone || next[missing]) continue;
    next[missing] = {
      canonicalId: missing,
      boneIndex: bone.index,
      boneName: bone.name,
      confidence: 45,
      source: 'fallback',
    };
    repair.applied = true;
  }
  return next;
}
