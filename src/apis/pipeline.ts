import * as THREE from 'three';
import { extractUmceContextFromMesh } from '../umce/modelContext';
import type { UmceReport } from '../umce/types';
import { detectFlexibleChains } from './chainDetector';
import { analyzeSkeletonMetrics, medianBoneLength } from './skeletonMetrics';
import { buildProfileFromContext } from './profileGenerator';
import {
  buildUserSummaryFromProfile,
  loadCachedApisProfile,
  mergeCachedReport,
  saveCachedApisProfile,
} from './cache';
import { computeApisModelHash } from './modelHash';
import { summarizeForUser } from './bodyClassifier';
import type { ApisReport } from './types';
import { APIS_DEFAULT_USER_SUMMARY as DEFAULT_SUMMARY } from './types';

export function runApisAnalysisPipeline(
  mesh: THREE.SkinnedMesh,
  umceReport: UmceReport,
  opts?: {
    modelFileName?: string;
    contentFingerprint?: string;
    pmxByteSize?: number;
  }
): ApisReport {
  const ctx = extractUmceContextFromMesh(mesh, opts?.modelFileName);
  const modelHash = computeApisModelHash(
    ctx,
    opts?.modelFileName,
    opts?.contentFingerprint,
    opts?.pmxByteSize
  );

  const cached = loadCachedApisProfile(modelHash);
  if (cached) {
    return mergeCachedReport(
      {
        status: 'cached',
        modelHash,
        profile: cached,
        userSummary: buildUserSummaryFromProfile(cached),
      },
      cached
    );
  }

  try {
    const metrics = analyzeSkeletonMetrics(mesh, ctx);
    const refLen = medianBoneLength(metrics);
    const chains = detectFlexibleChains(metrics, ctx, refLen);
    const profile = buildProfileFromContext(ctx, umceReport, metrics, chains, opts);
    saveCachedApisProfile(profile);

    const partialSummary = summarizeForUser(profile.classifications);

    return {
      status: 'ready',
      modelHash,
      profile,
      userSummary: {
        ...partialSummary,
        simulation: 'Stable',
        performance:
          profile.benchmark.score >= 85
            ? 'Excellent'
            : profile.benchmark.score >= 70
              ? 'Good'
              : 'Balanced',
        optimized: true,
      },
      devDiagnostics: import.meta.env.DEV
        ? {
            chains: profile.chains,
            classifications: profile.classifications,
            profile,
            benchmarkHistory: [profile.benchmark],
            physicsCostMs: profile.benchmark.avgFrameMs,
            runtimeOptimizationLevel: profile.optimizationLevel,
          }
        : undefined,
    };
  } catch (err) {
    return {
      status: 'failed',
      modelHash,
      profile: null,
      userSummary: DEFAULT_SUMMARY,
      error: err instanceof Error ? err.message : 'APIS analysis failed',
    };
  }
}
