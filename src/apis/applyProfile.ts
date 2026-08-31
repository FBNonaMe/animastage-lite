import * as THREE from 'three';
import type { MMDPhysics } from 'three-stdlib';
import type { MmdPhysicsBodyWrapper } from '../utils/mmdCharacterPhysics';
import {
  applyPhysicsLiveSettings,
  mmdPhysicsSettings,
  syncAllPhysicsBodiesFromBones,
} from '../utils/mmdCharacterPhysics';
import type { ApisPhysicsProfile } from './types';

const profileByModelId = new Map<string, ApisPhysicsProfile>();

export function setApisProfileForModel(modelId: string, profile: ApisPhysicsProfile | null): void {
  if (profile) profileByModelId.set(modelId, profile);
  else profileByModelId.delete(modelId);
}

export function getApisProfileForModel(modelId: string): ApisPhysicsProfile | null {
  return profileByModelId.get(modelId) ?? null;
}

function updateRigidBodyCollisionFilter(
  physics: MMDPhysics,
  body: MmdPhysicsBodyWrapper,
  newTarget: number
): void {
  if (newTarget === body.params.groupTarget || !body.body) return;
  body.params.groupTarget = newTarget;
  const world = physics.world as {
    removeRigidBody: (b: unknown) => void;
    addRigidBody: (b: unknown, group: number, mask: number) => void;
  };
  world.removeRigidBody(body.body);
  world.addRigidBody(body.body, 1 << body.params.groupIndex, newTarget);
}

export function applyApisProfileToPhysics(
  mesh: THREE.SkinnedMesh,
  physics: MMDPhysics | undefined,
  profile: ApisPhysicsProfile
): void {
  if (!physics?.bodies?.length) return;

  mmdPhysicsSettings.stablePhys = profile.global.stablePhys;
  mmdPhysicsSettings.physicsRate = profile.global.physicsRate;
  mmdPhysicsSettings.physicsSubsteps = profile.global.physicsSubsteps;
  mmdPhysicsSettings.physicsGravity = profile.global.physicsGravity;
  mmdPhysicsSettings.physicsSwing = profile.global.physicsSwing;

  applyPhysicsLiveSettings(physics);

  const Ammo = globalThis.Ammo as
    | {
        btVector3: new (x: number, y: number, z: number) => unknown;
        btTransform: new () => {
          setOrigin: (v: unknown) => void;
          setRotation: (q: unknown) => void;
        };
      }
    | undefined;

  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  const tuningByIndex = new Map(profile.bodies.map((b) => [b.bodyIndex, b]));

  for (let i = 0; i < bodies.length; i++) {
    const wrapper = bodies[i]!;
    const tuning = tuningByIndex.get(i);
    if (!tuning || !wrapper.body) continue;

    if (!tuning.simulate) {
      wrapper.body.setActivationState(5);
      continue;
    }

    const mass = wrapper.params.mass ?? 1;
    if (tuning.massScale !== 1 && Ammo?.btVector3) {
      const localInertia = new Ammo.btVector3(0, 0, 0);
      wrapper.body.setMassProps(mass * tuning.massScale, localInertia);
      wrapper.body.updateInertiaTensor();
    }

    wrapper.body.setDamping(tuning.linearDamping, tuning.angularDamping);

    const maskOverride = profile.collision.bodyMasks[i];
    if (maskOverride !== undefined) {
      updateRigidBodyCollisionFilter(physics, wrapper, maskOverride);
    }
  }

  syncAllPhysicsBodiesFromBones(mesh, physics);
  physics.reset?.();
}

export function applyApisGlobalFromProfile(profile: ApisPhysicsProfile): void {
  mmdPhysicsSettings.stablePhys = profile.global.stablePhys;
  mmdPhysicsSettings.physicsRate = profile.global.physicsRate;
  mmdPhysicsSettings.physicsSubsteps = profile.global.physicsSubsteps;
  mmdPhysicsSettings.physicsGravity = profile.global.physicsGravity;
  mmdPhysicsSettings.physicsSwing = profile.global.physicsSwing;
}
