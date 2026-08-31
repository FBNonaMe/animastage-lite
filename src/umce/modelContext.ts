import * as THREE from 'three';
import type { ParsedPmxSummary } from '../analyzer/parsePmx';
import type {
  UmceBoneRecord,
  UmceGrantRecord,
  UmceIkRecord,
  UmceModelContext,
  UmceRigidBodyRecord,
} from './types';

interface MmdBoneData {
  name?: string;
  englishName?: string;
  parentIndex?: number;
  position?: number[];
  flag?: number;
  grant?: {
    parentIndex?: number;
    ratio?: number;
    affectRotation?: boolean;
    affectPosition?: boolean;
  };
}

interface MmdUserData {
  format?: string;
  bones?: MmdBoneData[];
  iks?: Array<{ target?: number; effector?: number; links?: Array<{ index?: number }> }>;
  grants?: UmceGrantRecord[];
  rigidBodies?: Array<{
    name?: string;
    boneIndex?: number;
    type?: number;
    position?: number[];
    rotation?: number[];
    mass?: number;
    damping?: number;
    collisionGroup?: number;
    collisionMask?: number;
  }>;
  constraints?: unknown[];
}

function meshTriangleCount(mesh: THREE.SkinnedMesh): number {
  const index = mesh.geometry.getIndex();
  const pos = mesh.geometry.getAttribute('position');
  if (index) return Math.floor(index.count / 3);
  return pos ? Math.floor(pos.count / 3) : 0;
}

function bonesFromMmd(mmdBones: MmdBoneData[]): UmceBoneRecord[] {
  return mmdBones.map((b, index) => ({
    index,
    name: b.name ?? `bone_${index}`,
    englishName: b.englishName,
    parentIndex: b.parentIndex ?? -1,
    position: (b.position?.length === 3 ? b.position : [0, 0, 0]) as [number, number, number],
    flag: b.flag,
    isGrant: Boolean(b.grant),
    isIk: false,
    isTwist: /捩|twist/i.test(b.name ?? ''),
    isHelper: /補助|helper|dummy|dum/i.test(`${b.name ?? ''}${b.englishName ?? ''}`),
    isPhysicsOnly: false,
  }));
}

function bonesFromSkeleton(mesh: THREE.SkinnedMesh): UmceBoneRecord[] {
  const bones = mesh.skeleton?.bones ?? [];
  const nameToIndex = new Map(bones.map((b, i) => [b.name, i]));

  return bones.map((bone, index) => {
    const parentBone =
      bone.parent && bone.parent.type === 'Bone' ? (bone.parent as THREE.Bone) : null;
    const parentIndex = parentBone ? (nameToIndex.get(parentBone.name) ?? -1) : -1;
    const pos = bone.position.toArray() as [number, number, number];
    return {
      index,
      name: bone.name,
      parentIndex,
      position: pos,
      isTwist: /捩|twist/i.test(bone.name),
      isHelper: /補助|helper|dummy|dum/i.test(bone.name),
      isGrant: false,
      isIk: false,
      isPhysicsOnly: false,
    };
  });
}

function parseIks(mmd: MmdUserData, boneCount: number): UmceIkRecord[] {
  const iks = mmd.iks ?? [];
  const ikBoneIndices = new Set<number>();
  const result: UmceIkRecord[] = [];

  for (const ik of iks) {
    const target = ik.target ?? -1;
    const effector = ik.effector ?? -1;
    const links = (ik.links ?? []).map((l) => l.index ?? -1).filter((i) => i >= 0);
    links.forEach((i) => ikBoneIndices.add(i));
    if (target >= 0) ikBoneIndices.add(target);
    if (effector >= 0) ikBoneIndices.add(effector);
    result.push({ target, effector, links });
  }

  return result;
}

export function extractUmceContextFromMesh(
  mesh: THREE.SkinnedMesh,
  modelFileName?: string
): UmceModelContext {
  const mmd = mesh.geometry.userData.MMD as MmdUserData | undefined;
  const pos = mesh.geometry.getAttribute('position');
  const vertexCount = pos?.count ?? 0;

  let bones: UmceBoneRecord[];
  if (mmd?.bones?.length) {
    bones = bonesFromMmd(mmd.bones);
  } else {
    bones = bonesFromSkeleton(mesh);
  }

  const iks = mmd ? parseIks(mmd, bones.length) : [];
  const ikIndices = new Set<number>();
  for (const ik of iks) {
    ikIndices.add(ik.target);
    ikIndices.add(ik.effector);
    ik.links.forEach((i) => ikIndices.add(i));
  }
  bones = bones.map((b) => ({
    ...b,
    isIk: ikIndices.has(b.index),
  }));

  const grants: UmceGrantRecord[] =
    mmd?.grants ??
    (mmd?.bones ?? [])
      .map((b, i) => {
        if (!b.grant) return null;
        return {
          boneIndex: i,
          parentIndex: b.grant.parentIndex ?? -1,
          ratio: b.grant.ratio ?? 1,
          affectRotation: b.grant.affectRotation ?? false,
          affectPosition: b.grant.affectPosition ?? false,
        };
      })
      .filter(Boolean) as UmceGrantRecord[];

  bones = bones.map((b, i) => ({
    ...b,
    isGrant: grants.some((g) => g.boneIndex === i),
  }));

  const rigidBodies: UmceRigidBodyRecord[] = (mmd?.rigidBodies ?? []).map((r, index) => ({
    index,
    name: r.name,
    boneIndex: r.boneIndex ?? -1,
    type: r.type ?? 0,
    position: r.position,
    rotation: r.rotation,
    mass: r.mass,
    damping: r.damping,
    collisionGroup: r.collisionGroup,
    collisionMask: r.collisionMask,
  }));

  const physicsBoneIndices = new Set(
    rigidBodies.map((r) => r.boneIndex).filter((i) => i >= 0)
  );
  bones = bones.map((b) => ({
    ...b,
    isPhysicsOnly: physicsBoneIndices.has(b.index) && b.deformWeight === 0,
  }));

  const morphDict = mesh.morphTargetDictionary;
  const morphCount = morphDict ? Object.keys(morphDict).length : 0;

  return {
    format: mmd?.format === 'pmd' ? 'pmd' : mmd?.format === 'pmx' ? 'pmx' : 'unknown',
    bones,
    morphCount,
    rigidBodies,
    constraints: mmd?.constraints ?? [],
    iks,
    grants,
    vertexCount,
    triangleCount: meshTriangleCount(mesh),
    modelFileName,
  };
}

export function extractUmceContextFromParsed(
  parsed: ParsedPmxSummary,
  modelFileName?: string
): UmceModelContext {
  const bones: UmceBoneRecord[] = parsed.bones.map((b, index) => ({
    index,
    name: b.name,
    englishName: b.englishName,
    parentIndex: b.parentIndex ?? -1,
    position: (b.position?.length === 3 ? b.position : [0, 0, 0]) as [number, number, number],
    isTwist: /捩|twist/i.test(b.name),
    isHelper: /補助|helper|dummy/i.test(b.name),
    isGrant: false,
    isIk: false,
    isPhysicsOnly: false,
  }));

  return {
    format: parsed.format,
    bones,
    morphCount: parsed.morphs.length,
    rigidBodies: parsed.rigidBodies.map((r, index) => ({
      index,
      name: r.name,
      boneIndex: r.boneIndex ?? -1,
      type: r.type,
    })),
    constraints: parsed.constraints,
    iks: parsed.iks ?? [],
    grants: [],
    vertexCount: parsed.vertexCount,
    modelFileName,
  };
}
