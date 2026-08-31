import * as THREE from 'three';
import type { UmceBoneRecord, UmceModelContext } from '../umce/types';
import type { ApisBoneMetrics } from './types';

function boneWorldLength(mesh: THREE.SkinnedMesh, boneIndex: number): number {
  const bones = mesh.skeleton?.bones;
  if (!bones?.[boneIndex]) return 0;
  const bone = bones[boneIndex]!;
  mesh.updateMatrixWorld(true);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  bone.getWorldPosition(a);
  let maxChild = 0;
  for (const child of bone.children) {
    if ((child as THREE.Bone).isBone) {
      child.getWorldPosition(b);
      maxChild = Math.max(maxChild, a.distanceTo(b));
    }
  }
  if (maxChild > 0) return maxChild;
  return Math.max(0.01, bone.position.length());
}

function computeBoneInfluence(mesh: THREE.SkinnedMesh): Map<number, number> {
  const influence = new Map<number, number>();
  const skinIndex = mesh.geometry.getAttribute('skinIndex');
  const skinWeight = mesh.geometry.getAttribute('skinWeight');
  if (!skinIndex || !skinWeight) return influence;

  for (let i = 0; i < skinIndex.count; i++) {
    for (let j = 0; j < 4; j++) {
      const bi = skinIndex.getComponent(i, j);
      const w = skinWeight.getComponent(i, j);
      if (w > 0.0001) {
        influence.set(bi, (influence.get(bi) ?? 0) + w);
      }
    }
  }
  return influence;
}

function childCount(bones: UmceBoneRecord[], index: number): number {
  return bones.filter((b) => b.parentIndex === index).length;
}

function boneDepth(bones: UmceBoneRecord[], index: number): number {
  let depth = 0;
  let cur = index;
  const seen = new Set<number>();
  while (cur >= 0 && !seen.has(cur)) {
    seen.add(cur);
    depth++;
    cur = bones[cur]?.parentIndex ?? -1;
  }
  return depth;
}

export function analyzeSkeletonMetrics(
  mesh: THREE.SkinnedMesh,
  ctx: UmceModelContext
): ApisBoneMetrics[] {
  const influence = computeBoneInfluence(mesh);
  const physicsBoneSet = new Set(ctx.rigidBodies.map((r) => r.boneIndex).filter((i) => i >= 0));

  return ctx.bones.map((bone) => ({
    index: bone.index,
    name: bone.name,
    parentIndex: bone.parentIndex,
    length: boneWorldLength(mesh, bone.index) || Math.max(0.01, Math.hypot(...bone.position)),
    depth: boneDepth(ctx.bones, bone.index),
    childCount: childCount(ctx.bones, bone.index),
    influenceWeight: influence.get(bone.index) ?? 0,
    hasPhysicsBody: physicsBoneSet.has(bone.index),
    isIk: bone.isIk,
    isGrant: bone.isGrant,
    isHelper: bone.isHelper,
    isPhysicsOnly: bone.isPhysicsOnly,
  }));
}

export function medianBoneLength(metrics: ApisBoneMetrics[]): number {
  const lengths = metrics.map((m) => m.length).filter((l) => l > 0).sort((a, b) => a - b);
  if (lengths.length === 0) return 1;
  const mid = Math.floor(lengths.length / 2);
  return lengths.length % 2 ? lengths[mid]! : (lengths[mid - 1]! + lengths[mid]!) / 2;
}
