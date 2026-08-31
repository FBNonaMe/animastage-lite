import * as THREE from 'three';
import type { MMDPhysics } from 'three-stdlib';
import { softResetModelPhysics, detectPhysicsInstability } from '../physics/physicsStabilitySystem';
import type { PhysicsModelRegistration } from '../physics/physicsStabilityRegistry';
import {
  applyApisProfileToPhysics,
  getApisProfileForModel,
  setApisProfileForModel,
} from './applyProfile';
import { repairStretchedPhysicsBones, syncAllPhysicsBodiesFromBones } from '../utils/mmdCharacterPhysics';
import {
  bumpApisOptimizationLevel,
  getApisRuntime,
  recordApisInstability,
  setApisFrozen,
} from './runtimeMonitor';
import { saveCachedApisProfile } from './cache';
import type { ApisPhysicsProfile } from './types';

const HEAL_COOLDOWN_MS = 2500;

export interface ApisSelfHealResult {
  healed: boolean;
  reason?: string;
}

function softenProfile(profile: ApisPhysicsProfile, level: number): ApisPhysicsProfile {
  const dampBoost = 1 + level * 0.15;
  return {
    ...profile,
    optimizationLevel: level,
    global: {
      ...profile.global,
      physicsRate: Math.max(52, profile.global.physicsRate - level * 2),
      physicsSubsteps: Math.max(2, profile.global.physicsSubsteps - 1),
      physicsSwing: Math.max(0, profile.global.physicsSwing - level * 0.04),
    },
    bodies: profile.bodies.map((b) => ({
      ...b,
      linearDamping: Math.min(0.98, b.linearDamping * dampBoost),
      angularDamping: Math.min(0.98, b.angularDamping * dampBoost),
    })),
    stability: 'recovered',
  };
}

export function apisSelfHealCheck(
  modelId: string,
  mesh: THREE.SkinnedMesh,
  physics: MMDPhysics | undefined,
  reg?: PhysicsModelRegistration,
  fps?: number
): ApisSelfHealResult {
  if (!physics?.bodies?.length) return { healed: false };

  const runtime = getApisRuntime(modelId);
  const now = performance.now();
  if (runtime && now - runtime.lastHealAt < HEAL_COOLDOWN_MS) {
    return { healed: false };
  }

  const stretch = repairStretchedPhysicsBones(mesh, physics);
  const unstable = detectPhysicsInstability(physics, fps) || stretch > 0;
  if (!unstable) return { healed: false };

  recordApisInstability(modelId);
  setApisFrozen(modelId, true);

  if (reg) softResetModelPhysics(reg);
  else physics.reset?.();

  const current = getApisProfileForModel(modelId);
  if (current) {
    const level = bumpApisOptimizationLevel(modelId);
    const softened = softenProfile(current, level);
    saveCachedApisProfile(softened);
    setApisProfileForModel(modelId, softened);
    applyApisProfileToPhysics(mesh, physics, softened);
  }

  syncAllPhysicsBodiesFromBones(mesh, physics);

  if (runtime) runtime.lastHealAt = now;
  setApisFrozen(modelId, false);

  return { healed: true, reason: stretch > 0 ? 'stretch' : 'instability' };
}

export function apisRuntimeOptimizePaused(modelId: string, paused: boolean): void {
  setApisFrozen(modelId, paused);
}
