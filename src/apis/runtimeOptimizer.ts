import type { MMDPhysics } from 'three-stdlib';
import * as THREE from 'three';
import { shouldReduceApisCost, getApisRuntime, setApisFrozen } from './runtimeMonitor';
import {
  getApisProfileForModel,
  applyApisProfileToPhysics,
  setApisProfileForModel,
} from './applyProfile';
import { saveCachedApisProfile } from './cache';
import type { ApisPhysicsProfile } from './types';

function softenProfile(profile: ApisPhysicsProfile, level: number): ApisPhysicsProfile {
  const dampBoost = 1 + level * 0.12;
  return {
    ...profile,
    optimizationLevel: level,
    global: {
      ...profile.global,
      physicsRate: Math.max(52, profile.global.physicsRate - 2),
      physicsSubsteps: Math.max(2, profile.global.physicsSubsteps - 1),
    },
    bodies: profile.bodies.map((b) => ({
      ...b,
      linearDamping: Math.min(0.98, b.linearDamping * dampBoost),
      angularDamping: Math.min(0.98, b.angularDamping * dampBoost),
    })),
  };
}

export function apisRuntimeCostPass(
  modelId: string,
  mesh: THREE.SkinnedMesh,
  physics: MMDPhysics | undefined,
  isPlaying: boolean,
  isVisible: boolean
): void {
  if (!physics) return;
  const runtime = getApisRuntime(modelId);
  if (!runtime) return;

  if (!isVisible) {
    setApisFrozen(modelId, true);
    return;
  }

  if (!isPlaying) setApisFrozen(modelId, false);
  if (!shouldReduceApisCost(modelId)) return;

  const profile = getApisProfileForModel(modelId);
  if (!profile || profile.optimizationLevel >= 4) return;

  const next = softenProfile(profile, profile.optimizationLevel + 1);
  saveCachedApisProfile(next);
  setApisProfileForModel(modelId, next);
  applyApisProfileToPhysics(mesh, physics, next);
}
