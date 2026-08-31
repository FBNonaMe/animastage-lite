import * as THREE from 'three';
import type { MMDPhysics } from 'three-stdlib';
import type { ApisPhysicsProfile, ApisBenchmarkResult } from './types';
import { applyApisProfileToPhysics } from './applyProfile';
import { repairStretchedPhysicsBones } from '../utils/mmdCharacterPhysics';

const BENCH_STEPS = 48;
const FIXED_DT = 1 / 60;

function measureMaxVelocity(physics: MMDPhysics): number {
  let max = 0;
  const bodies = physics.bodies as Array<{ body?: { getLinearVelocity?: () => { x: () => number; y: () => number; z: () => number } } }>;
  for (const wrapper of bodies) {
    const rb = wrapper.body;
    if (!rb?.getLinearVelocity) continue;
    try {
      const v = rb.getLinearVelocity();
      const speed = Math.sqrt(v.x() ** 2 + v.y() ** 2 + v.z() ** 2);
      if (Number.isFinite(speed)) max = Math.max(max, speed);
    } catch {
      return Infinity;
    }
  }
  return max;
}

/** Hidden 1–2s micro-benchmark after physics is live. */
export function runApisLiveBenchmark(
  mesh: THREE.SkinnedMesh,
  physics: MMDPhysics,
  profile: ApisPhysicsProfile
): ApisBenchmarkResult {
  applyApisProfileToPhysics(mesh, physics, profile);

  const t0 = performance.now();
  let maxStretch = 0;
  let maxVelocity = 0;
  let nanDetected = false;

  mesh.updateMatrixWorld(true);
  physics.reset?.();

  for (let i = 0; i < BENCH_STEPS; i++) {
    mesh.skeleton?.update();
    mesh.updateMatrixWorld(true);
    physics.update(FIXED_DT);
    const stretch = repairStretchedPhysicsBones(mesh, physics);
    if (stretch > 0) maxStretch = Math.max(maxStretch, stretch);

    const vel = measureMaxVelocity(physics);
    if (!Number.isFinite(vel)) {
      nanDetected = true;
      break;
    }
    maxVelocity = Math.max(maxVelocity, vel);
  }

  const elapsed = performance.now() - t0;
  const avgFrameMs = elapsed / BENCH_STEPS;

  let score = profile.benchmark.score;
  score -= maxStretch * 4;
  score -= Math.max(0, maxVelocity - 20) * 0.5;
  score -= nanDetected ? 40 : 0;
  score -= Math.max(0, avgFrameMs - 8) * 2;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    avgFrameMs,
    maxStretch,
    maxVelocity,
    nanDetected,
    iterations: BENCH_STEPS,
    variantLabel: `live_${profile.optimizationLevel}`,
  };
}

export function mergeBenchmarkIntoProfile(
  profile: ApisPhysicsProfile,
  live: ApisBenchmarkResult
): ApisPhysicsProfile {
  const stability =
    live.score >= 85 && !live.nanDetected
      ? 'excellent'
      : live.score >= 70
        ? 'good'
        : live.score >= 55
          ? 'fair'
          : 'recovered';

  return {
    ...profile,
    benchmark: live,
    stability,
  };
}
