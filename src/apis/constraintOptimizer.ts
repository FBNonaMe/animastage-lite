import type { UmceReport } from '../umce/types';
import type { ApisCollisionPlan } from './types';

export function planConstraintRepairs(umceReport: UmceReport): string[] {
  const repairs: string[] = [];
  for (const name of umceReport.physics.brokenConstraints) {
    repairs.push(`skip:${name}`);
  }
  for (const dup of umceReport.physics.duplicateBodies) {
    repairs.push(`dedupe:${dup}`);
  }
  return repairs;
}

export function buildCollisionPlan(
  umceReport: UmceReport,
  chainBodyIndices: number[]
): ApisCollisionPlan {
  const bodyMasks: Record<number, number> = {};
  const isolatedPairs: Array<[number, number]> = [];
  const torsoGroupBits: number[] = [0];
  const accessoryGroupBits = new Set<number>();

  const accessorySet = new Set(chainBodyIndices);
  for (let i = 0; i < umceReport.physics.rigidBodyCount; i++) {
    if (accessorySet.has(i)) {
      accessoryGroupBits.add(i % 16);
    }
  }

  // Hair/skirt chains should not collide with torso group 0 when possible
  for (const bodyIdx of chainBodyIndices) {
    bodyMasks[bodyIdx] = ~(1 << 0);
  }

  return {
    bodyMasks,
    isolatedPairs,
    torsoGroupBits,
    accessoryGroupBits: [...accessoryGroupBits],
  };
}
