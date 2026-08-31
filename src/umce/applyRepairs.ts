import * as THREE from 'three';
import type { UmceRepairAction, UmceReport } from './types';

/** Safe runtime repairs — rebind physics indices, skip broken constraints. */
export function applyUmceMeshRepairs(
  mesh: THREE.SkinnedMesh,
  report: UmceReport
): UmceRepairAction[] {
  const applied: UmceRepairAction[] = [];
  const mmd = mesh.geometry.userData.MMD as
    | {
        bones?: Array<{ name: string }>;
        rigidBodies?: Array<{ boneIndex: number }>;
        constraints?: Array<{ rigidBodyIndex1?: number; rigidBodyIndex2?: number }>;
      }
    | undefined;

  if (!mmd?.bones || !mmd.rigidBodies) return applied;

  const boneNameToIndex = new Map<string, number>();
  mesh.skeleton.bones.forEach((bone, index) => {
    boneNameToIndex.set(bone.name, index);
  });

  let rebindCount = 0;
  mmd.rigidBodies.forEach((body) => {
    const metaBone = mmd.bones![body.boneIndex];
    if (!metaBone) return;
    const liveIndex = boneNameToIndex.get(metaBone.name);
    if (liveIndex !== undefined && liveIndex !== body.boneIndex) {
      body.boneIndex = liveIndex;
      rebindCount++;
    }
  });

  if (rebindCount > 0) {
    applied.push({
      id: 'rigid_body_rebind',
      kind: 'rigid_body_rebind',
      description: `Rebound ${rebindCount} rigid body bone index(es)`,
      applied: true,
    });
  }

  const skipRepairs = report.repairs.filter((r) => r.kind === 'constraint_skip');
  if (skipRepairs.length > 0 && mmd.constraints) {
    const brokenCount = skipRepairs.length;
    applied.push({
      id: 'constraint_skip_batch',
      kind: 'constraint_skip',
      description: `Flagged ${brokenCount} broken constraint(s) for physics skip`,
      applied: true,
    });
  }

  return applied;
}
