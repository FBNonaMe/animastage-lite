import * as THREE from 'three';
import type { MMDPhysics } from 'three-stdlib';
import type { MmdPhysicsBodyWrapper } from '../utils/mmdCharacterPhysics';
import {
  applyPhysicsLiveSettings,
  configureArmPhysicsForAnimation,
  getAnimHelperObjects,
} from '../utils/mmdCharacterPhysics';
import {
  findDuplicateHashGroups,
  getAllPhysicsModels,
  type PhysicsModelRegistration,
} from './physicsStabilityRegistry';

/** Ammo activation states */
const ACTIVE_TAG = 1;
const DISABLE_DEACTIVATION = 4;
const DISABLE_SIMULATION = 5;

const MAX_LINEAR_SPEED = 48;
const MAX_ANGULAR_SPEED = 28;
const INSTABILITY_FPS_THRESHOLD = 25;

let lastInstabilityHintAt = 0;
let instabilityHintActive = false;

type AmmoVec = { destroy?: () => void };
type AmmoLib = {
  btVector3: new (x: number, y: number, z: number) => AmmoVec;
};

function getAmmo(): AmmoLib | null {
  const A = globalThis.Ammo as AmmoLib | undefined;
  return A?.btVector3 ? A : null;
}

function zeroAmmoVector(): AmmoVec | null {
  const Ammo = getAmmo();
  return Ammo ? new Ammo.btVector3(0, 0, 0) : null;
}

function isFiniteVelocity(v: { x: () => number; y: () => number; z: () => number }): boolean {
  return (
    Number.isFinite(v.x()) &&
    Number.isFinite(v.y()) &&
    Number.isFinite(v.z())
  );
}

function clampBodyVelocities(body: MmdPhysicsBodyWrapper['body']): boolean {
  if (!body) return false;
  const Ammo = getAmmo();
  if (!Ammo) return false;

  let clamped = false;
  const lin = body.getLinearVelocity();
  const ang = body.getAngularVelocity();

  if (!isFiniteVelocity(lin) || !isFiniteVelocity(ang)) {
    const zero = zeroAmmoVector();
    if (zero) {
      body.setLinearVelocity(zero);
      body.setAngularVelocity(zero);
      zero.destroy?.();
    }
    body.activate(true);
    return true;
  }

  const lx = lin.x();
  const ly = lin.y();
  const lz = lin.z();
  const linSpeed = Math.sqrt(lx * lx + ly * ly + lz * lz);

  if (linSpeed > MAX_LINEAR_SPEED) {
    const scale = MAX_LINEAR_SPEED / linSpeed;
    const clampedVec = new Ammo.btVector3(lx * scale, ly * scale, lz * scale);
    body.setLinearVelocity(clampedVec);
    clampedVec.destroy?.();
    clamped = true;
  }

  const ax = ang.x();
  const ay = ang.y();
  const az = ang.z();
  const angSpeed = Math.sqrt(ax * ax + ay * ay + az * az);

  if (angSpeed > MAX_ANGULAR_SPEED) {
    const scale = MAX_ANGULAR_SPEED / angSpeed;
    const clampedVec = new Ammo.btVector3(ax * scale, ay * scale, az * scale);
    body.setAngularVelocity(clampedVec);
    clampedVec.destroy?.();
    clamped = true;
  }

  return clamped;
}

/** Soft reset — sync bodies from bones, clear forces/velocity, reactivate. Animation untouched. */
export function softResetModelPhysics(reg: PhysicsModelRegistration): number {
  const physics = reg.getPhysics();
  if (!physics?.bodies?.length || !physics.world) return 0;

  reg.syncSkeleton();

  physics.reset();

  const zero = zeroAmmoVector();
  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  let count = 0;

  for (const wrapper of bodies) {
    const rb = wrapper.body;
    if (!rb) continue;

    try {
      rb.clearForces?.();
      if (zero) {
        rb.setLinearVelocity(zero);
        rb.setAngularVelocity(zero);
      }
      wrapper.updateFromBone?.();

      if (wrapper.params.type === 0) {
        rb.setActivationState(DISABLE_DEACTIVATION);
      } else if (reg.visible) {
        rb.setActivationState(DISABLE_DEACTIVATION);
        rb.activate(true);
      } else {
        rb.setActivationState(DISABLE_SIMULATION);
      }
      count++;
    } catch {
      /* body may have been removed */
    }
  }

  zero?.destroy?.();

  applyPhysicsLiveSettings(physics);
  configureArmPhysicsForAnimation(reg.mesh, reg.helper);
  reg.ensurePhysicsEnabled?.();
  reg.helper.enable('physics', true);

  return count;
}

export function setModelPhysicsHidden(reg: PhysicsModelRegistration, hidden: boolean): void {
  const physics = reg.getPhysics();
  if (!physics?.bodies?.length) return;

  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  for (const wrapper of bodies) {
    const rb = wrapper.body;
    if (!rb || wrapper.params.type === 0) continue;

    if (hidden) {
      const zero = zeroAmmoVector();
      if (zero) {
        rb.setLinearVelocity(zero);
        rb.setAngularVelocity(zero);
        zero.destroy?.();
      }
      rb.clearForces?.();
      rb.setActivationState(DISABLE_SIMULATION);
    } else {
      rb.setActivationState(DISABLE_DEACTIVATION);
      rb.activate(true);
      wrapper.updateFromBone?.();
    }
  }
}

export function applyStabilitySafetyLayer(physics: MMDPhysics | undefined): boolean {
  if (!physics?.bodies?.length) return false;

  let anyClamped = false;
  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  for (const wrapper of bodies) {
    if (wrapper.params.type === 0 || !wrapper.body) continue;
    if (clampBodyVelocities(wrapper.body)) anyClamped = true;
  }
  return anyClamped;
}

export function detectPhysicsInstability(
  physics: MMDPhysics | undefined,
  fps?: number
): boolean {
  if (fps !== undefined && fps > 0 && fps < INSTABILITY_FPS_THRESHOLD) {
    return true;
  }
  if (!physics?.bodies?.length) return false;

  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  for (const wrapper of bodies) {
    const rb = wrapper.body;
    if (!rb || wrapper.params.type === 0) continue;
    try {
      const lin = rb.getLinearVelocity();
      const ang = rb.getAngularVelocity();
      if (!isFiniteVelocity(lin) || !isFiniteVelocity(ang)) return true;
      const lx = lin.x();
      const ly = lin.y();
      const lz = lin.z();
      const speed = Math.sqrt(lx * lx + ly * ly + lz * lz);
      if (speed > MAX_LINEAR_SPEED * 1.5) return true;
    } catch {
      return true;
    }
  }
  return false;
}

export function applyDuplicateCollisionIsolation(): number {
  const dupGroups = findDuplicateHashGroups();
  let pairs = 0;

  for (const group of dupGroups.values()) {
    if (group.length < 2) continue;

    for (const reg of group) {
      tagModelInstanceCollisionGroup(reg);
    }

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        isolateModelPair(group[i]!, group[j]!);
        pairs++;
      }
    }
  }

  return pairs;
}

function tagModelInstanceCollisionGroup(reg: PhysicsModelRegistration): void {
  const physics = reg.getPhysics();
  if (!physics?.bodies?.length || !physics.world) return;

  const world = physics.world as {
    removeRigidBody: (body: unknown) => void;
    addRigidBody: (body: unknown, group: number, mask: number) => void;
  };

  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  const instanceGroup = 1 << reg.collisionGroupBit;

  for (const wrapper of bodies) {
    if (!wrapper.body || wrapper.params.type === 0) continue;
    world.removeRigidBody(wrapper.body);
    world.addRigidBody(wrapper.body, instanceGroup, wrapper.params.groupTarget);
  }
}

function isolateModelPair(a: PhysicsModelRegistration, b: PhysicsModelRegistration): void {
  maskModelsFromEachOther(a, b.collisionGroupBit);
  maskModelsFromEachOther(b, a.collisionGroupBit);
}

function maskModelsFromEachOther(reg: PhysicsModelRegistration, otherGroupBit: number): void {
  const physics = reg.getPhysics();
  if (!physics?.bodies?.length || !physics.world) return;

  const world = physics.world as {
    removeRigidBody: (body: unknown) => void;
    addRigidBody: (body: unknown, group: number, mask: number) => void;
  };

  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  const maskOut = ~(1 << otherGroupBit);

  for (const wrapper of bodies) {
    if (!wrapper.body) continue;
    let target = wrapper.params.groupTarget & maskOut;
    if (target === wrapper.params.groupTarget) continue;
    wrapper.params.groupTarget = target;
    world.removeRigidBody(wrapper.body);
    world.addRigidBody(wrapper.body, 1 << wrapper.params.groupIndex, target);
  }
}

export interface FixScenePhysicsResult {
  bodiesReset: number;
  hiddenBodiesDisabled: number;
  duplicatePairs: number;
  modelsProcessed: number;
  fallbacksUsed: number;
}

/** Global scene-wide soft physics reset — all registered models, no animation reset. */
export function fixScenePhysics(options?: { fps?: number }): FixScenePhysicsResult {
  const models = getAllPhysicsModels();
  let bodiesReset = 0;
  let hiddenBodiesDisabled = 0;
  let fallbacksUsed = 0;

  const duplicatePairs = applyDuplicateCollisionIsolation();
  const duplicateModelCount = findDuplicateHashGroups().size;

  for (const reg of models) {
    const physics = reg.getPhysics();
    if (!physics) continue;

    if (!physics.world || !physics.bodies?.length) {
      if (reg.restartPhysicsFull) {
        try {
          reg.restartPhysicsFull();
          fallbacksUsed++;
        } catch (err) {
          console.warn('[Physics] Fallback recreate failed:', reg.sceneModelId, err);
        }
      }
      continue;
    }

    bodiesReset += softResetModelPhysics(reg);

    if (!reg.visible) {
      setModelPhysicsHidden(reg, true);
      hiddenBodiesDisabled++;
    }

    applyStabilitySafetyLayer(physics);

    if (detectPhysicsInstability(physics, options?.fps)) {
      instabilityHintActive = true;
      lastInstabilityHintAt = performance.now();
    }
  }

  console.info(
    `[Physics] Reset applied to ${bodiesReset} bodies | Hidden disabled: ${hiddenBodiesDisabled} | Duplicate pairs isolated: ${duplicatePairs} | Duplicate model groups: ${duplicateModelCount}`
  );

  return {
    bodiesReset,
    hiddenBodiesDisabled,
    duplicatePairs,
    modelsProcessed: models.length,
    fallbacksUsed,
  };
}

export function shouldSuggestFixPhysics(fps?: number): boolean {
  if (instabilityHintActive && performance.now() - lastInstabilityHintAt < 30_000) {
    return true;
  }
  if (fps !== undefined && fps > 0 && fps < INSTABILITY_FPS_THRESHOLD) {
    return true;
  }
  const models = getAllPhysicsModels();
  return models.some((m) => detectPhysicsInstability(m.getPhysics(), fps));
}

export function clearPhysicsInstabilityHint(): void {
  instabilityHintActive = false;
}

export function computeModelContentHash(modelFileName?: string, byteSize?: number): string {
  const name = (modelFileName ?? 'unknown').toLowerCase();
  const size = byteSize ?? 0;
  return `${name}:${size}`;
}

export function warnDuplicateModelImport(existingName: string): void {
  console.warn(
    `[Physics] Duplicate model detected (${existingName}). Physics may be unstable. Use "Fix Physics" if needed.`
  );
}
