import * as THREE from 'three';
import type { MMDAnimationHelper, MMDPhysics } from 'three-stdlib';
import {
  applyApisProfileToPhysics,
  applyApisGlobalFromProfile,
  setApisProfileForModel,
} from './applyProfile';
import { runApisLiveBenchmark } from './benchmark';
import { saveCachedApisProfile, buildUserSummaryFromProfile } from './cache';
import { initApisRuntime, recordApisPhysicsFrame } from './runtimeMonitor';
import { finalizeProfileAfterBenchmark } from './learner';
import type { ApisPhysicsProfile, ApisReport } from './types';

function getPhysicsFromHelper(
  helper: MMDAnimationHelper,
  mesh: THREE.SkinnedMesh
): MMDPhysics | undefined {
  const h = helper as MMDAnimationHelper & {
    objects?: { get: (m: THREE.SkinnedMesh) => { physics?: MMDPhysics } };
  };
  return h.objects?.get(mesh)?.physics;
}

/** Apply profile once Bullet physics is live, then run hidden micro-benchmark. */
export function completeApisPhysicsSetup(
  modelId: string,
  mesh: THREE.SkinnedMesh,
  helper: MMDAnimationHelper,
  profile: ApisPhysicsProfile,
  onReport?: (patch: Partial<ApisReport>) => void
): ApisPhysicsProfile {
  const physics = getPhysicsFromHelper(helper, mesh);

  if (!physics) {
    setApisProfileForModel(modelId, profile);
    applyApisGlobalFromProfile(profile);
    initApisRuntime(modelId, profile);
    return profile;
  }

  applyApisProfileToPhysics(mesh, physics, profile);

  const t0 = performance.now();
  const live = runApisLiveBenchmark(mesh, physics, profile);
  const benchMs = performance.now() - t0;

  let finalProfile = finalizeProfileAfterBenchmark(profile, live);

  if (live.score < 65 && profile.optimizationLevel < 2) {
    const softer: ApisPhysicsProfile = {
      ...finalProfile,
      optimizationLevel: finalProfile.optimizationLevel + 1,
      bodies: finalProfile.bodies.map((b) => ({
        ...b,
        linearDamping: Math.min(0.98, b.linearDamping * 1.2),
        angularDamping: Math.min(0.98, b.angularDamping * 1.2),
      })),
    };
    applyApisProfileToPhysics(mesh, physics, softer);
    const live2 = runApisLiveBenchmark(mesh, physics, softer);
    if (live2.score > live.score) {
      finalProfile = finalizeProfileAfterBenchmark(softer, live2);
    }
  }

  saveCachedApisProfile(finalProfile);
  setApisProfileForModel(modelId, finalProfile);
  initApisRuntime(modelId, finalProfile);
  recordApisPhysicsFrame(modelId, benchMs / Math.max(1, live.iterations));

  onReport?.({
    status: 'ready',
    profile: finalProfile,
    userSummary: buildUserSummaryFromProfile(finalProfile),
    devDiagnostics: import.meta.env.DEV
      ? {
          chains: finalProfile.chains,
          classifications: finalProfile.classifications,
          profile: finalProfile,
          benchmarkHistory: [profile.benchmark, live, finalProfile.benchmark],
          physicsCostMs: finalProfile.benchmark.avgFrameMs,
          runtimeOptimizationLevel: finalProfile.optimizationLevel,
        }
      : undefined,
  });

  return finalProfile;
}
