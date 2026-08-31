import type { PhysicsAnalysisResult, UmceModelContext } from './types';

const MMD_BODY_KINEMATIC = 0;
const MMD_BODY_DYNAMIC = 1;

export function analyzePhysics(ctx: UmceModelContext): PhysicsAnalysisResult {
  const { rigidBodies, constraints, bones } = ctx;
  const warnings: string[] = [];
  const missingRigidBodies: string[] = [];
  const brokenConstraints: string[] = [];
  const duplicateBodies: string[] = [];
  const inactiveBodies: string[] = [];

  const boneIndexCounts = new Map<number, number>();
  for (const body of rigidBodies) {
    if (body.boneIndex < 0) {
      missingRigidBodies.push(body.name ?? `body_${body.index}`);
      continue;
    }
    const count = (boneIndexCounts.get(body.boneIndex) ?? 0) + 1;
    boneIndexCounts.set(body.boneIndex, count);
    if (count > 1) {
      const boneName = bones[body.boneIndex]?.name ?? `bone_${body.boneIndex}`;
      duplicateBodies.push(`${body.name ?? body.index} → ${boneName}`);
    }
    if (body.type === MMD_BODY_KINEMATIC && (body.mass ?? 0) > 100) {
      inactiveBodies.push(body.name ?? `body_${body.index}`);
    }
  }

  for (let i = 0; i < constraints.length; i++) {
    const c = constraints[i] as {
      rigidBodyIndex1?: number;
      rigidBodyIndex2?: number;
      name?: string;
    };
    const a = c.rigidBodyIndex1 ?? -1;
    const b = c.rigidBodyIndex2 ?? -1;
    if (a < 0 || b < 0 || a >= rigidBodies.length || b >= rigidBodies.length) {
      brokenConstraints.push(c.name ?? `constraint_${i}`);
    }
  }

  const dynamicCount = rigidBodies.filter((r) => r.type === MMD_BODY_DYNAMIC || r.type === 2).length;
  const kinematicCount = rigidBodies.filter((r) => r.type === MMD_BODY_KINEMATIC).length;

  if (rigidBodies.length > 200) {
    warnings.push(`Heavy physics: ${rigidBodies.length} rigid bodies`);
  }
  if (brokenConstraints.length > 0) {
    warnings.push(`${brokenConstraints.length} broken constraint(s)`);
  }

  return {
    rigidBodyCount: rigidBodies.length,
    constraintCount: constraints.length,
    dynamicCount,
    kinematicCount,
    missingRigidBodies,
    brokenConstraints,
    duplicateBodies,
    inactiveBodies,
    warnings,
  };
}
