import type * as THREE from 'three';
import { getActivePhysicsCount } from '../scene/scenePhysicsRegistry';

/** Above this — do not allocate a Bullet world (WASM OOM risk). */
export const PHYSICS_RIGID_BODY_HARD_CAP = 64;

/** Soft cap when another character already simulates physics. */
export const PHYSICS_RIGID_BODY_SOFT_CAP = 40;

/** Only one full MMDPhysics world at a time — each world duplicates all bodies in WASM. */
export const MAX_SIMULTANEOUS_PHYSICS_WORLDS = 1;

type MmdRigidMeta = { rigidBodies?: unknown[]; constraints?: unknown[] };

export function readMeshMmdMeta(mesh: THREE.SkinnedMesh): MmdRigidMeta | undefined {
  return mesh.geometry?.userData?.MMD as MmdRigidMeta | undefined;
}

export function countMeshRigidBodies(mesh: THREE.SkinnedMesh): number {
  return readMeshMmdMeta(mesh)?.rigidBodies?.length ?? 0;
}

export function countMeshConstraints(mesh: THREE.SkinnedMesh): number {
  return readMeshMmdMeta(mesh)?.constraints?.length ?? 0;
}

export interface PhysicsEligibility {
  allowed: boolean;
  reason: string;
  rigidBodyCount: number;
  constraintCount: number;
}

export function evaluatePhysicsEligibility(
  mesh: THREE.SkinnedMesh,
  opts?: { activePhysicsWorlds?: number }
): PhysicsEligibility {
  const rigidBodyCount = countMeshRigidBodies(mesh);
  const constraintCount = countMeshConstraints(mesh);
  const activeWorlds = opts?.activePhysicsWorlds ?? getActivePhysicsCount();

  if (rigidBodyCount === 0) {
    return { allowed: false, reason: 'no_rigid_bodies', rigidBodyCount, constraintCount };
  }

  if (rigidBodyCount > PHYSICS_RIGID_BODY_HARD_CAP) {
    return {
      allowed: false,
      reason: `too_many_bodies_${rigidBodyCount}`,
      rigidBodyCount,
      constraintCount,
    };
  }

  if (activeWorlds >= MAX_SIMULTANEOUS_PHYSICS_WORLDS) {
    return {
      allowed: false,
      reason: 'scene_physics_world_cap',
      rigidBodyCount,
      constraintCount,
    };
  }

  if (rigidBodyCount > PHYSICS_RIGID_BODY_SOFT_CAP && activeWorlds >= 1) {
    return {
      allowed: false,
      reason: 'heavy_model_multi_character',
      rigidBodyCount,
      constraintCount,
    };
  }

  return { allowed: true, reason: 'ok', rigidBodyCount, constraintCount };
}

export function isAmmoOomError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return /out of memory|\bOOM\b|Aborted\(|Aborted\b|wasm.*oom|unreachable|RuntimeError/i.test(
    msg
  );
}
