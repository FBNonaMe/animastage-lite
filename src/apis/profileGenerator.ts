import type { UmceModelContext } from '../umce/types';
import type { UmceReport } from '../umce/types';
import type {
  ApisBenchmarkResult,
  ApisBoneMetrics,
  ApisDetectedChain,
  ApisGlobalTuning,
  ApisPhysicsProfile,
  ApisRigidBodyTuning,
  ApisStabilityGrade,
} from './types';
import { buildCollisionPlan, planConstraintRepairs } from './constraintOptimizer';
import { classifyBodyParts } from './bodyClassifier';
import { medianBoneLength } from './skeletonMetrics';
import { computeApisModelHash } from './modelHash';

const MMD_DYNAMIC = 1;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function chainForBone(chains: ApisDetectedChain[], boneIndex: number): ApisDetectedChain | undefined {
  return chains.find((c) => c.boneIndices.includes(boneIndex));
}

export function generatePhysicsProfile(input: {
  modelHash: string;
  metrics: ApisBoneMetrics[];
  chains: ApisDetectedChain[];
  ctx: UmceModelContext;
  umceReport: UmceReport;
  optimizationLevel?: number;
  dampingScale?: number;
}): ApisPhysicsProfile {
  const {
    modelHash,
    metrics,
    chains,
    ctx,
    umceReport,
    optimizationLevel = 0,
    dampingScale = 1,
  } = input;

  const refLen = medianBoneLength(metrics);
  const dynamicCount = umceReport.physics.dynamicCount;
  const levelBoost = optimizationLevel * 0.08;
  const dampMul = dampingScale * (1 + levelBoost);

  const global: ApisGlobalTuning = {
    physicsRate: Math.round(clamp(74 - dynamicCount * 0.1 - optimizationLevel * 2, 52, 78)),
    physicsSubsteps: Math.round(clamp(3 + dynamicCount / 90 - optimizationLevel * 0.5, 2, 7)),
    physicsGravity: clamp(1.0 - optimizationLevel * 0.05, 0.75, 1.05),
    physicsSwing: clamp(chains.length * 0.025 + dynamicCount * 0.0005, 0, 0.4),
    stablePhys: true,
    maxBenchmarkIterations: 3,
  };

  const byBone = new Map(metrics.map((m) => [m.index, m]));
  const bodies: ApisRigidBodyTuning[] = [];

  for (const rb of ctx.rigidBodies) {
    const boneIdx = rb.boneIndex;
    const bone = byBone.get(boneIdx);
    const chain = chainForBone(chains, boneIdx);
    const boneLen = bone?.length ?? refLen;
    const lenRatio = boneLen / Math.max(refLen, 0.01);
    const chainDepth = chain?.depth ?? 1;
    const isDynamic = rb.type === MMD_DYNAMIC || rb.type === 2;

    const massScale = clamp(lenRatio * (0.85 + chainDepth * 0.04), 0.25, 2.8);
    const baseLin = 0.12 + lenRatio * 0.04 + dynamicCount * 0.0008;
    const baseAng = 0.18 + chainDepth * 0.025 + (chain?.vertexInfluence ?? 0) * 0.00002;

    bodies.push({
      bodyIndex: rb.index,
      boneIndex: boneIdx,
      massScale: isDynamic ? massScale : 1,
      linearDamping: clamp(baseLin * dampMul, 0.05, 0.95),
      angularDamping: clamp(baseAng * dampMul, 0.08, 0.98),
      simulate: isDynamic && boneIdx >= 0,
    });
  }

  const allChainBodies = chains.flatMap((c) => c.rigidBodyIndices);
  const collision = buildCollisionPlan(umceReport, allChainBodies);
  const constraintRepairs = planConstraintRepairs(umceReport);
  const classifications = classifyBodyParts(chains);

  const benchmark = scoreProfileHeuristic({
    global,
    bodies,
    dynamicCount,
    brokenConstraints: umceReport.physics.brokenConstraints.length,
    duplicateBodies: umceReport.physics.duplicateBodies.length,
    chains,
    optimizationLevel,
  });

  const stability: ApisStabilityGrade =
    benchmark.score >= 85
      ? 'excellent'
      : benchmark.score >= 70
        ? 'good'
        : benchmark.score >= 55
          ? 'fair'
          : 'recovered';

  return {
    version: 1,
    modelHash,
    generatedAt: Date.now(),
    global,
    bodies,
    chains,
    classifications,
    collision,
    constraintRepairs,
    benchmark,
    stability,
    optimizationLevel,
  };
}

function scoreProfileHeuristic(input: {
  global: ApisGlobalTuning;
  bodies: ApisRigidBodyTuning[];
  dynamicCount: number;
  brokenConstraints: number;
  duplicateBodies: number;
  chains: ApisDetectedChain[];
  optimizationLevel: number;
}): ApisBenchmarkResult {
  let score = 100;
  score -= input.brokenConstraints * 8;
  score -= input.duplicateBodies * 4;
  score -= Math.max(0, input.dynamicCount - 120) * 0.15;
  score -= input.optimizationLevel * 3;
  score += Math.min(8, input.chains.filter((c) => c.confidence >= 0.6).length);

  return {
    score: clamp(Math.round(score), 0, 100),
    avgFrameMs: 1000 / input.global.physicsRate,
    maxStretch: 0,
    maxVelocity: 0,
    nanDetected: false,
    iterations: 0,
    variantLabel: `heuristic_L${input.optimizationLevel}`,
  };
}

export function generateProfileVariants(
  base: Omit<Parameters<typeof generatePhysicsProfile>[0], 'optimizationLevel' | 'dampingScale'>
): ApisPhysicsProfile[] {
  const variants: ApisPhysicsProfile[] = [];
  for (let level = 0; level < 3; level++) {
    variants.push(
      generatePhysicsProfile({ ...base, optimizationLevel: level, dampingScale: 1 + level * 0.12 })
    );
  }
  return variants;
}

export function pickBestProfile(profiles: ApisPhysicsProfile[]): ApisPhysicsProfile {
  return profiles.reduce((best, cur) =>
    cur.benchmark.score > best.benchmark.score ? cur : best
  );
}

export function buildProfileFromContext(
  ctx: UmceModelContext,
  umceReport: UmceReport,
  metrics: ApisBoneMetrics[],
  chains: ApisDetectedChain[],
  opts?: { modelFileName?: string; contentFingerprint?: string; pmxByteSize?: number }
): ApisPhysicsProfile {
  const modelHash = computeApisModelHash(
    ctx,
    opts?.modelFileName,
    opts?.contentFingerprint,
    opts?.pmxByteSize
  );
  return pickBestProfile(
    generateProfileVariants({
      modelHash,
      metrics,
      chains,
      ctx,
      umceReport,
    })
  );
}
