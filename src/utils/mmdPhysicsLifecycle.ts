/**
 * Bullet dispose / mesh physics restart — from mmd-character-motion.js
 */
import * as THREE from 'three';
import type { MMDAnimationHelper, MMDPhysics } from 'three-stdlib';
import {
  applyIkFixOnly,
  applyPhysicsLiveSettings,
  configureArmPhysicsForAnimation,
  getAnimHelperObjects,
  getPhysicsAddParams,
  isAmmoPhysicsBroken,
  markAmmoPhysicsBroken,
} from './mmdCharacterPhysics';
import { countMeshRigidBodies, isAmmoOomError } from '../physics/physicsEligibility';
import { clearAnimMixerState, resetMeshBindPose } from './mmdMotionLite';

type AmmoLib = {
  destroy: (obj: unknown) => void;
};

function getAmmo(): AmmoLib | null {
  const A = globalThis.Ammo as AmmoLib | undefined;
  return A && typeof A.destroy === 'function' ? A : null;
}

/** Remove all rigid bodies and constraints from a Bullet world. */
export function disposeMMDPhysics(physics: MMDPhysics | null | undefined): void {
  if (!physics?.world) return;
  const Ammo = getAmmo();
  if (!Ammo) return;

  const world = physics.world as {
    removeConstraint: (c: unknown) => void;
    removeRigidBody: (b: unknown) => void;
  };

  const constraints = physics.constraints as Array<{
    constraint?: unknown;
    joint?: unknown;
  }>;
  for (let i = constraints.length - 1; i >= 0; i--) {
    const c = constraints[i];
    const constraint = c?.constraint || c?.joint;
    if (!constraint) continue;
    try {
      world.removeConstraint(constraint);
      Ammo.destroy(constraint);
    } catch {
      /* already removed */
    }
    c.constraint = undefined;
    c.joint = undefined;
  }
  constraints.length = 0;

  const bodies = physics.bodies as Array<{ body?: unknown }>;
  for (let i = bodies.length - 1; i >= 0; i--) {
    const w = bodies[i];
    if (!w?.body) continue;
    try {
      world.removeRigidBody(w.body);
      Ammo.destroy(w.body);
    } catch {
      /* already removed */
    }
    w.body = undefined;
  }
  bodies.length = 0;

  try {
    Ammo.destroy(physics.world);
  } catch {
    /* world gone */
  }
  physics.world = null as unknown as MMDPhysics['world'];
}

export function disposeMeshPhysics(
  helper: MMDAnimationHelper,
  mesh: THREE.SkinnedMesh
): void {
  const state = getAnimHelperObjects(helper, mesh);
  if (state?.physics) {
    disposeMMDPhysics(state.physics as MMDPhysics);
    state.physics = undefined;
  }
}

export interface RestartMeshPhysicsOptions {
  helper: MMDAnimationHelper;
  mesh: THREE.SkinnedMesh;
  clip?: THREE.AnimationClip | null;
  physicsEnabled?: boolean;
  wasPlaying?: boolean;
  animTime?: number | null;
}

/**
 * Full physics restart — destroy Bullet state, re-add mesh to helper (mmd_rtx «Reload physics»).
 */
export function restartMeshPhysics(opts: RestartMeshPhysicsOptions): void {
  const {
    helper,
    mesh,
    clip,
    physicsEnabled = !isAmmoPhysicsBroken(),
    wasPlaying = false,
    animTime = null,
  } = opts;

  forceDetachMesh(helper, mesh);
  clearAnimMixerState(helper, mesh);
  resetMeshBindPose(mesh);

  const addParams = getPhysicsAddParams(physicsEnabled, undefined, {
    animation: clip ?? undefined,
    animationWarmup: false,
  }, countMeshRigidBodies(mesh)) as Parameters<MMDAnimationHelper['add']>[1];

  try {
    helper.add(mesh, addParams);
  } catch (err) {
    // _addMesh pushes the mesh BEFORE physics setup. If Bullet OOM / setup throws,
    // the mesh is already registered — must detach before retrying without physics.
    if (isAmmoOomError(err)) {
      markAmmoPhysicsBroken(err);
    }
    forceDetachMesh(helper, mesh);
    clearAnimMixerState(helper, mesh);
    resetMeshBindPose(mesh);

    if (physicsEnabled) {
      try {
        helper.add(
          mesh,
          getPhysicsAddParams(false, undefined, {
            animation: clip ?? undefined,
            animationWarmup: false,
          }) as Parameters<MMDAnimationHelper['add']>[1]
        );
      } catch (err2) {
        console.warn('[MMD] Physics restart failed (no-physics fallback):', err2);
        throw err2;
      }
    } else {
      throw err;
    }
  }
  applyIkFixOnly(mesh, helper);

  const state = getAnimHelperObjects(helper, mesh) as
    | {
        activeClip?: THREE.AnimationClip;
        mixer?: THREE.AnimationMixer;
      }
    | undefined;
  if (state && clip) {
    state.activeClip = clip;
  }

  if (animTime != null && state?.mixer) {
    const acts = (state.mixer as THREE.AnimationMixer & { _actions?: THREE.AnimationAction[] })
      ._actions;
    if (acts?.[0]) {
      acts[0].time = animTime;
      acts[0].paused = !wasPlaying;
      if (!acts[0].isRunning()) acts[0].play();
    }
  }

  helper.update(0);
  mesh.skeleton?.update();
  mesh.updateMatrixWorld(true);

  const physics = (getAnimHelperObjects(helper, mesh) as { physics?: MMDPhysics } | undefined)
    ?.physics;
  if (physics) {
    physics.reset();
    applyPhysicsLiveSettings(physics);
    configureArmPhysicsForAnimation(mesh, helper);
  }

  helper.enable('physics', physicsEnabled && Boolean(physics));
  helper.enable('animation', Boolean(clip));
  helper.enable('ik', true);
  helper.enable('grant', true);
}

/** Remove mesh from helper even if remove() throws or physics dispose left it registered. */
export function safeRemoveMeshFromHelper(
  helper: MMDAnimationHelper,
  mesh: THREE.SkinnedMesh
): void {
  forceDetachMesh(helper, mesh);
}

/** Remove mesh from helper even if remove() throws or physics dispose left it registered. */
function forceDetachMesh(helper: MMDAnimationHelper, mesh: THREE.SkinnedMesh): void {
  disposeMeshPhysics(helper, mesh);
  try {
    helper.remove(mesh);
  } catch {
    /* not registered via public API */
  }
  // Belt-and-suspenders: _addMesh can leave the mesh in `meshes` after a failed setup.
  const meshes = helper.meshes as THREE.SkinnedMesh[];
  const idx = meshes.indexOf(mesh);
  if (idx >= 0) {
    meshes.splice(idx, 1);
  }
  const objects = (helper as MMDAnimationHelper & {
    objects?: { delete?: (m: THREE.SkinnedMesh) => void };
  }).objects;
  try {
    objects?.delete?.(mesh);
  } catch {
    /* ignore */
  }
}
