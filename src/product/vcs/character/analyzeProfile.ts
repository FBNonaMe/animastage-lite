import * as THREE from 'three';
import type { PmxBoneInfo } from '../../../types';
import type { CharacterProfile } from '../types';

const DEFAULT_HEIGHT = 16;
const HEAD_LIFT = 12.5;
const CHEST_LIFT = 9;
const EYE_LIFT = 13.2;

function findBonePosition(
  bones: PmxBoneInfo[],
  patterns: RegExp[],
  yDefault: number
): [number, number, number] {
  const bone = bones.find((b) => patterns.some((p) => p.test(b.name)));
  const depth = bone?.depth ?? 5;
  const y = yDefault - depth * 0.15;
  return [0, y, 0];
}

function estimateFromBones(bones: PmxBoneInfo[]): {
  height: number;
  head: [number, number, number];
  feet: [number, number, number];
} {
  const headBone = bones.find((b) => /頭|head|首/i.test(b.name));
  const footBone = bones.find((b) => /足首|foot|toe|つま先/i.test(b.name));

  const headY = headBone ? HEAD_LIFT + (10 - headBone.depth) * 0.2 : HEAD_LIFT;
  const footY = footBone ? -0.2 + footBone.depth * 0.05 : 0;
  const height = Math.max(12, headY - footY + 2);

  return {
    height,
    head: [0, headY, 0],
    feet: [0, footY, 0],
  };
}

function estimateHairExtent(bones: PmxBoneInfo[]): number {
  const hairBones = bones.filter((b) => /髪|hair|ponytail|twintail/i.test(b.name));
  if (hairBones.length === 0) return 0.8;
  return Math.min(3.5, 0.8 + hairBones.length * 0.35);
}

function estimateAccessoryRadius(bones: PmxBoneInfo[]): number {
  const acc = bones.filter((b) =>
    /accessory|acc|リボン|wing|weapon|sword|staff|hat/i.test(b.name)
  );
  return acc.length > 0 ? 1.2 + acc.length * 0.15 : 0.5;
}

/** Build character profile from PMX metadata (+ optional skinned mesh bounds). */
export function analyzeCharacterProfile(
  modelId: string,
  bones: PmxBoneInfo[],
  mesh?: THREE.SkinnedMesh | null
): CharacterProfile {
  const { height, head, feet } = estimateFromBones(bones);
  const hairExtent = estimateHairExtent(bones);
  const accessoryRadius = estimateAccessoryRadius(bones);
  const physicsBodies = bones.filter((b) => /skirt|hair|ribbon|physics|物理/i.test(b.name)).length;

  let size: [number, number, number] = [4.5, height, 4.5];
  let center: [number, number, number] = [0, height * 0.45, 0];

  if (mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    if (!box.isEmpty()) {
      const s = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      size = [Math.max(3, s.x), Math.max(10, s.y), Math.max(3, s.z)];
      center = [c.x, c.y, c.z];
      head[0] = c.x;
      head[1] = box.max.y - size[1] * 0.08;
      head[2] = c.z;
      feet[1] = box.min.y;
    }
  }

  const halfW = size[0] * 0.55 + accessoryRadius;
  const halfH = size[1] * 0.55 + hairExtent * 0.5;
  const halfD = size[2] * 0.55 + accessoryRadius;
  const collisionRadius = Math.max(halfW, halfH, halfD);
  const safeCameraRadius = collisionRadius * 1.35 + 2.5;

  const chest = findBonePosition(bones, [/胸|chest|spine|上半身/i], CHEST_LIFT);
  const eyes = [head[0], head[1] + 0.15, head[2]] as [number, number, number];
  const face = [head[0], head[1] - 0.25, head[2] + 0.15] as [number, number, number];

  return {
    modelId,
    boundingBox: {
      min: [center[0] - halfW, feet[1], center[2] - halfD],
      max: [center[0] + halfW, head[1] + hairExtent, center[2] + halfD],
      size,
    },
    skeletonHeight: size[1],
    centerOfMass: [center[0], center[1] * 0.85, center[2]],
    headPosition: head,
    facePosition: face,
    eyePosition: eyes,
    chestPosition: chest,
    feetPosition: feet,
    hairExtent,
    accessoryRadius,
    collisionRadius,
    safeCameraRadius,
    physicsBodyCount: physicsBodies,
    analyzedAt: Date.now(),
  };
}

export function mergeCharacterProfiles(
  profiles: CharacterProfile[]
): CharacterProfile | null {
  if (profiles.length === 0) return null;
  if (profiles.length === 1) return profiles[0]!;

  const height = Math.max(...profiles.map((p) => p.skeletonHeight));
  const safeR = Math.max(...profiles.map((p) => p.safeCameraRadius));
  const colR = Math.max(...profiles.map((p) => p.collisionRadius));

  const com: [number, number, number] = [0, 0, 0];
  for (const p of profiles) {
    com[0] += p.centerOfMass[0];
    com[1] += p.centerOfMass[1];
    com[2] += p.centerOfMass[2];
  }
  com[0] /= profiles.length;
  com[1] /= profiles.length;
  com[2] /= profiles.length;

  return {
    ...profiles[0]!,
    skeletonHeight: height,
    safeCameraRadius: safeR,
    collisionRadius: colR,
    centerOfMass: com,
  };
}
