import * as THREE from 'three';
import { analyzeLoadedMesh } from '../analyzer/analyzeModel';
import { runApisAnalysisPipeline } from '../apis';
import { runUmcePipeline } from '../umce';
import type { CharacterModelFormat } from '../types';
import {
  buildPendingSummary,
  buildUserSummary,
  loadCachedCisProfile,
  mergeCachedReport,
  saveCachedCisProfile,
} from './cache';
import { buildAutoRepairs } from './modules/autoRepair';
import { scanCapabilities } from './modules/capabilityScanner';
import { scanCompatibility } from './modules/compatibilityScanner';
import { buildDiagnostics } from './modules/diagnostics';
import { buildFingerprint } from './modules/fingerprint';
import { computeHealthScore } from './modules/healthScore';
import { analyzeMaterials } from './modules/materialIntelligence';
import { analyzeMesh } from './modules/meshAnalyzer';
import { analyzeMorphs } from './modules/morphAnalyzer';
import { performanceLabel, predictPerformance } from './modules/performancePredictor';
import { buildPhysicsProfile } from './modules/physicsIntelligence';
import { analyzeSkeleton } from './modules/skeletonAnalyzer';
import type { CisPipelineOptions, CisReport, CharacterIntelligenceProfile } from './types';

function resolveModelFormat(opts: CisPipelineOptions): CharacterModelFormat {
  return opts.modelFormat ?? 'mmd';
}

/**
 * Character Intelligence System — unified import analysis pipeline.
 * Validate → Analyze → Profile → Diagnostics → Physics → Performance → Cache → Ready
 */
export async function runCisPipeline(
  mesh: THREE.SkinnedMesh,
  opts: CisPipelineOptions = {}
): Promise<CisReport> {
  const modelFormat = resolveModelFormat(opts);

  try {
    const skeleton = analyzeSkeleton(mesh);
    const meshStats = analyzeMesh(mesh);
    const morphs = analyzeMorphs(mesh);

    const usePmxBuffer =
      modelFormat === 'mmd' &&
      Boolean(opts.pmxBuffer) &&
      /\.pm[xd]$/i.test(opts.modelFileName ?? '');

    const modelAnalysis = await analyzeLoadedMesh(mesh, {
      fileMap: opts.fileMap,
      modelFileName: opts.modelFileName,
      pmxBuffer: usePmxBuffer ? (opts.pmxBuffer ?? null) : null,
    });

    const missingTextures = modelAnalysis.missingTextures ?? [];
    const materials = analyzeMaterials(mesh, opts.fileMap, missingTextures);
    const compatibility = scanCompatibility(
      mesh,
      modelFormat,
      opts.modelFileName,
      missingTextures
    );

    const umceReport = runUmcePipeline(mesh, {
      modelFileName: opts.modelFileName,
      applyRepairs: opts.applyRepairs !== false,
    });

    const apisReport = runApisAnalysisPipeline(mesh, umceReport, {
      modelFileName: opts.modelFileName,
      contentFingerprint: opts.contentFingerprint,
      pmxByteSize: opts.pmxByteSize,
    });

    const physics = buildPhysicsProfile(umceReport, apisReport);
    const repairs = buildAutoRepairs(umceReport, missingTextures);

    const partialProfile = {
      version: 1 as const,
      analyzedAt: Date.now(),
      modelFileName: opts.modelFileName,
      modelFormat,
      sourceFormat: compatibility.sourceFormat,
      skeleton,
      mesh: meshStats,
      morphs,
      materials,
      physics,
      compatibility,
      repairs,
      modelAnalysis,
      umceReport,
      apisReport,
    };

    const fingerprint = buildFingerprint(partialProfile, opts.contentFingerprint);
    const cached = loadCachedCisProfile(fingerprint.combined);
    if (cached) {
      return mergeCachedReport({
        ...cached,
        apisReport: apisReport.status === 'ready' ? apisReport : cached.apisReport,
        umceReport: umceReport ?? cached.umceReport,
      });
    }

    const health = computeHealthScore(partialProfile);
    const performance = predictPerformance({ ...partialProfile, health });
    const capabilities = scanCapabilities({ ...partialProfile, health });

    const profile: CharacterIntelligenceProfile = {
      ...partialProfile,
      fingerprint,
      diagnostics: buildDiagnostics({ ...partialProfile, modelAnalysis }),
      capabilities,
      health,
      performance,
    };

    saveCachedCisProfile(profile);

    return {
      status: 'ready',
      profile,
      userSummary: buildUserSummary(profile),
    };
  } catch (err) {
    console.warn('[CIS] Pipeline failed:', err);
    return {
      status: 'failed',
      profile: null,
      userSummary: buildPendingSummary(),
      error: err instanceof Error ? err.message : 'Character analysis failed',
    };
  }
}

export function cisReportFromProfile(profile: CharacterIntelligenceProfile): CisReport {
  return {
    status: 'ready',
    profile,
    userSummary: buildUserSummary(profile),
  };
}

export { performanceLabel };
