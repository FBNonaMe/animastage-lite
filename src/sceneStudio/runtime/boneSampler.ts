/**
 * Character rig sampling for character-reactive Scene FX.
 * Read-only: never mutates bones, skeletons, physics or animation state.
 */
import * as THREE from 'three';
import { lookupCanonicalByName } from '../../umce/boneDictionary';

export type FxBoneId =
  | 'head'
  | 'neck'
  | 'spine'
  | 'waist'
  | 'left_hand'
  | 'right_hand'
  | 'left_wrist'
  | 'right_wrist'
  | 'left_foot'
  | 'right_foot'
  | 'left_arm'
  | 'right_arm';

export const FX_BONE_CHOICES: { id: FxBoneId; label: string }[] = [
  { id: 'right_hand', label: 'Right hand' },
  { id: 'left_hand', label: 'Left hand' },
  { id: 'right_wrist', label: 'Right wrist' },
  { id: 'left_wrist', label: 'Left wrist' },
  { id: 'head', label: 'Head' },
  { id: 'spine', label: 'Spine' },
  { id: 'waist', label: 'Hips' },
  { id: 'right_foot', label: 'Right foot' },
  { id: 'left_foot', label: 'Left foot' },
];

export interface CharacterRig {
  mesh: THREE.SkinnedMesh;
  bones: Map<string, THREE.Bone>;
  center: THREE.Vector3;
  radius: number;
  floorY: number;
  height: number;
}

const _box = new THREE.Box3();
const _sphere = new THREE.Sphere();

function buildBoneMap(skeleton: THREE.Skeleton): Map<string, THREE.Bone> {
  const map = new Map<string, THREE.Bone>();
  for (const bone of skeleton.bones) {
    const hit = lookupCanonicalByName(bone.name);
    if (!hit) continue;
    const existing = map.get(hit.canonicalId);
    if (!existing) map.set(hit.canonicalId, bone);
  }
  return map;
}

/**
 * Pick the skinned character closest to `nearPosition` (falls back to the first rig).
 * Bone maps are cached on the mesh so repeated frames stay cheap.
 */
export function findCharacterRig(
  scene: THREE.Scene,
  nearPosition?: THREE.Vector3 | null
): CharacterRig | null {
  let best: THREE.SkinnedMesh | null = null;
  let bestDist = Infinity;

  scene.traverse((obj) => {
    const skinned = obj as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh || !skinned.skeleton) return;
    if (!nearPosition) {
      if (!best) best = skinned;
      return;
    }
    skinned.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3().setFromMatrixPosition(skinned.matrixWorld);
    const dist = pos.distanceToSquared(nearPosition);
    if (dist < bestDist) {
      bestDist = dist;
      best = skinned;
    }
  });

  const mesh = best as THREE.SkinnedMesh | null;
  if (!mesh) return null;

  const cacheKey = '__sceneFxBoneMap';
  let bones = mesh.userData[cacheKey] as Map<string, THREE.Bone> | undefined;
  const boneCount = mesh.skeleton.bones.length;
  if (!bones || mesh.userData.__sceneFxBoneCount !== boneCount) {
    bones = buildBoneMap(mesh.skeleton);
    mesh.userData[cacheKey] = bones;
    mesh.userData.__sceneFxBoneCount = boneCount;
  }

  _box.setFromObject(mesh);
  if (_box.isEmpty()) return null;
  _box.getBoundingSphere(_sphere);

  return {
    mesh,
    bones,
    center: _sphere.center.clone(),
    radius: _sphere.radius,
    floorY: _box.min.y,
    height: Math.max(0.001, _box.max.y - _box.min.y),
  };
}

/** Cheap per-frame refresh of the rig bounds (geometry boxes stay cached). */
export function refreshRigBounds(rig: CharacterRig): void {
  _box.setFromObject(rig.mesh);
  if (_box.isEmpty()) return;
  _box.getBoundingSphere(_sphere);
  rig.center.copy(_sphere.center);
  rig.radius = _sphere.radius;
  rig.floorY = _box.min.y;
  rig.height = Math.max(0.001, _box.max.y - _box.min.y);
}

export function boneWorldPosition(
  rig: CharacterRig,
  boneId: string,
  out = new THREE.Vector3()
): THREE.Vector3 | null {
  const bone = rig.bones.get(boneId);
  if (!bone) return null;
  bone.updateWorldMatrix(true, false);
  return out.setFromMatrixPosition(bone.matrixWorld);
}

export interface BoneTrailSample {
  points: THREE.Vector3[];
  velocity: THREE.Vector3;
}

/** Fixed-length recent path of one bone, used for ribbon trails and reactive FX. */
export class BoneTrailTracker {
  private readonly points: THREE.Vector3[] = [];
  private readonly previous = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private started = false;

  constructor(private readonly length = 48) {}

  reset(): void {
    this.points.length = 0;
    this.started = false;
    this.velocity.set(0, 0, 0);
  }

  push(position: THREE.Vector3, delta: number): void {
    if (this.started && delta > 0) {
      this.velocity.copy(position).sub(this.previous).divideScalar(delta);
    }
    this.previous.copy(position);
    this.started = true;

    this.points.push(position.clone());
    while (this.points.length > this.length) this.points.shift();
  }

  sample(): BoneTrailSample {
    return { points: this.points, velocity: this.velocity };
  }

  get ready(): boolean {
    return this.points.length >= 2;
  }
}
