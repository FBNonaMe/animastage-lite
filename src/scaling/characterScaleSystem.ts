/**
 * Stable Character Scaling — visual size changes without disturbing Bullet simulation.
 *
 * Animation, keyframes, timeline, and physics run in canonical (1×) model space.
 * Visual scale is applied only through the skinning bind matrix and display transforms.
 */
import * as THREE from 'three';
import type { MMDPhysics } from 'three-stdlib';

export const CHARACTER_SCALE_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const CHARACTER_SCALE_MIN = 0.25;
export const CHARACTER_SCALE_MAX = 2;

const RUNTIME_KEY = 'characterScaleRuntime';

export interface CharacterScaleRuntime {
  /** User-facing visual scale — physics stays at canonical 1×. */
  visualScale: number;
}

const _bindPos = new THREE.Vector3();
const _bindQuat = new THREE.Quaternion();
const _bindScl = new THREE.Vector3();
const _anchor = new THREE.Vector3();
const _canonical = new THREE.Vector3();
const _visualBind = new THREE.Matrix4();
const _physicsDebugInv = new THREE.Matrix4();
const _physicsDebugPos = new THREE.Vector3();
const _physicsDebugBodyQuat = new THREE.Quaternion();

export function clampCharacterScale(scale: number): number {
  return Math.max(CHARACTER_SCALE_MIN, Math.min(CHARACTER_SCALE_MAX, scale));
}

/** @deprecated Use clampCharacterScale */
export function clampUniformScale(scale: number): number {
  return clampCharacterScale(scale);
}

export function getCharacterVisualScale(mesh: THREE.SkinnedMesh): number {
  return (mesh.userData[RUNTIME_KEY] as CharacterScaleRuntime | undefined)?.visualScale ?? 1;
}

export function setCharacterVisualScaleRuntime(mesh: THREE.SkinnedMesh, visualScale: number): void {
  mesh.userData[RUNTIME_KEY] = { visualScale: clampCharacterScale(visualScale) };
}

/** Feet / root anchor in world space (mesh local origin). */
export function getCharacterScaleAnchor(
  mesh: THREE.SkinnedMesh,
  target = _anchor
): THREE.Vector3 {
  mesh.updateMatrixWorld(true);
  return mesh.localToWorld(target.set(0, 0, 0));
}

/** Map canonical world position → visually scaled world position. */
export function canonicalToVisualWorld(
  mesh: THREE.SkinnedMesh,
  canonicalWorld: THREE.Vector3,
  visualScale: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const anchor = getCharacterScaleAnchor(mesh);
  return out.copy(canonicalWorld).sub(anchor).multiplyScalar(visualScale).add(anchor);
}

/** Bind matrix encodes visual scale — mesh.scale and root.scale stay 1 for stable Bullet. */
export function buildVisualBindMatrix(mesh: THREE.SkinnedMesh, visualScale: number): THREE.Matrix4 {
  mesh.updateMatrixWorld(true);
  mesh.matrixWorld.decompose(_bindPos, _bindQuat, _bindScl);
  return _visualBind.compose(
    _bindPos,
    _bindQuat,
    new THREE.Vector3(visualScale, visualScale, visualScale)
  );
}

/**
 * Apply visual character scale — instant, no physics restart.
 * Skeleton pose / animation data remain in canonical space.
 */
export function applyStableCharacterVisualScale(
  mesh: THREE.SkinnedMesh,
  root: THREE.Object3D | null | undefined,
  visualScale: number
): number {
  const s = clampCharacterScale(visualScale);

  if (root) {
    root.scale.set(1, 1, 1);
  }
  mesh.scale.set(1, 1, 1);

  setCharacterVisualScaleRuntime(mesh, s);
  mesh.bind(mesh.skeleton, buildVisualBindMatrix(mesh, s));
  mesh.skeleton.update();
  mesh.skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));

  return s;
}

/** Bone world position for gizmos / pickers / camera (visual space). */
export function getVisualBoneWorldPosition(
  mesh: THREE.SkinnedMesh,
  bone: THREE.Bone,
  target = _canonical
): THREE.Vector3 {
  const s = getCharacterVisualScale(mesh);
  mesh.skeleton.update();
  bone.updateMatrixWorld(true);
  bone.getWorldPosition(target);
  if (Math.abs(s - 1) < 1e-4) return target;
  return canonicalToVisualWorld(mesh, target, s, target);
}

/** Canonical bone world position — used internally by physics / IK. */
export function getCanonicalBoneWorldPosition(
  mesh: THREE.SkinnedMesh,
  bone: THREE.Bone,
  target = _canonical
): THREE.Vector3 {
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();
  bone.updateMatrixWorld(true);
  return bone.getWorldPosition(target);
}

/**
 * Physics compensation metadata — simulation stays canonical; gravity/offsets unchanged.
 * Stored on mesh for debug tooling; Bullet bodies are never recreated here.
 */
export function applyPhysicsScaleCompensation(
  mesh: THREE.SkinnedMesh,
  _physics: MMDPhysics | undefined,
  visualScale: number
): void {
  mesh.userData.physicsScaleCompensation = {
    visualScale: clampCharacterScale(visualScale),
    /** Canonical simulation — identical behaviour at any visual size. */
    simulationScale: 1,
    gravityFactor: 1,
    offsetFactor: 1,
    ikDistanceFactor: 1,
  };
}

type PhysicsDebugHelper = THREE.Object3D & {
  root?: THREE.SkinnedMesh;
  physics?: MMDPhysics;
};

/**
 * Debug hitboxes drawn in visual space while Bullet simulates in canonical space.
 */
export function patchPhysicsDebugHelperForVisualScale(
  debugRoot: THREE.Object3D,
  mesh: THREE.SkinnedMesh
): void {
  const helper = debugRoot as PhysicsDebugHelper;
  if (!helper.physics?.bodies?.length) return;
  if (helper.userData.visualScalePatchApplied) return;
  helper.userData.visualScalePatchApplied = true;

  const orig = debugRoot.updateMatrixWorld.bind(debugRoot);
  debugRoot.updateMatrixWorld = (force?: boolean) => {
    if (!debugRoot.visible) {
      orig(force);
      return;
    }

    const visualScale = getCharacterVisualScale(mesh);
    const anchor = getCharacterScaleAnchor(mesh);
    _physicsDebugInv.copy(mesh.matrixWorld).invert();

    const bodies = helper.physics!.bodies;
    for (let i = 0, il = bodies.length; i < il; i++) {
      const rb = bodies[i]?.body;
      const child = debugRoot.children[i];
      if (!rb || !child) continue;

      const tr = rb.getCenterOfMassTransform();
      const origin = tr.getOrigin();
      const rotation = tr.getRotation();

      _physicsDebugPos.set(origin.x(), origin.y(), origin.z());
      canonicalToVisualWorld(mesh, _physicsDebugPos, visualScale, _physicsDebugPos);
      _physicsDebugPos.applyMatrix4(_physicsDebugInv);
      child.position.copy(_physicsDebugPos);

      _physicsDebugBodyQuat.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
      child.quaternion.setFromRotationMatrix(_physicsDebugInv).multiply(_physicsDebugBodyQuat);
      child.scale.setScalar(visualScale);
    }

    debugRoot.matrix.copy(mesh.matrixWorld);
    orig(force);
  };
}

/** Visual bounds for camera framing (scaled). */
export function getCharacterVisualBounds(
  mesh: THREE.SkinnedMesh,
  visualScale: number
): THREE.Box3 {
  const box = new THREE.Box3().setFromObject(mesh);
  if (box.isEmpty() || Math.abs(visualScale - 1) < 1e-4) return box;

  const anchor = getCharacterScaleAnchor(mesh);
  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
  ];
  const out = new THREE.Box3();
  for (const c of corners) {
    canonicalToVisualWorld(mesh, c, visualScale, c);
    out.expandByPoint(c);
  }
  void anchor;
  return out;
}
