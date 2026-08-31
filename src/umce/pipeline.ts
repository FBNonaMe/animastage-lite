import * as THREE from 'three';
import { CORE_CANONICAL_BONES } from './canonicalBones';
import { applyUmceMeshRepairs } from './applyRepairs';
import { applyCanonicalSubstitutes, planAutoRepairs } from './autoRepair';
import { umceLogReportSummary, setUmceConsoleEnabled } from './logger';
import { extractUmceContextFromMesh } from './modelContext';
import { buildMotionCompatibilityMap, extractVmdBoneNames } from './motionMapper';
import { analyzePhysics } from './physicsAnalyzer';
import { analyzeRig } from './rigAnalyzer';
import { buildBoneIdentities, runUniversalScanner } from './universalScanner';
import type { UmcePipelineOptions, UmceReport } from './types';

function computeCompatibilityPercent(
  canonicalCount: number,
  coreMissing: number,
  physicsWarnings: number,
  motionPercent?: number
): number {
  const coreScore = Math.max(0, 100 - coreMissing * (100 / CORE_CANONICAL_BONES.length));
  const physicsPenalty = Math.min(15, physicsWarnings * 3);
  let score = coreScore * 0.6 + Math.min(100, canonicalCount * 4) * 0.25 - physicsPenalty;
  if (motionPercent !== undefined) {
    score = score * 0.7 + motionPercent * 0.3;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function runUmcePipeline(
  mesh: THREE.SkinnedMesh,
  options: UmcePipelineOptions = {}
): UmceReport {
  if (options.logToConsole !== false) {
    setUmceConsoleEnabled(true);
  } else {
    setUmceConsoleEnabled(false);
  }

  const ctx = extractUmceContextFromMesh(mesh, options.modelFileName);
  const { canonicalMap: initialMap, bones } = runUniversalScanner(ctx, mesh);
  const rig = analyzeRig(ctx, bones, initialMap);
  const physics = analyzePhysics(ctx);

  let repairs = planAutoRepairs(bones, initialMap, rig, physics);
  let canonicalMap = initialMap;
  if (options.applyRepairs !== false) {
    canonicalMap = applyCanonicalSubstitutes(canonicalMap, repairs, bones);
  }

  const boneIdentities = buildBoneIdentities(bones, canonicalMap);
  const mappedCanonical = Object.keys(canonicalMap).length;

  let motion: UmceReport['motion'];
  if (options.vmdBoneNames?.length) {
    motion = buildMotionCompatibilityMap(options.vmdBoneNames, bones, canonicalMap);
  }

  const warnings: string[] = [...physics.warnings];
  if (rig.missingCanonical.length > 0) {
    warnings.push(`Missing core bones: ${rig.missingCanonical.join(', ')}`);
  }
  if (motion?.unmappedBones.length) {
    warnings.push(`${motion.unmappedBones.length} VMD bone(s) unmapped`);
  }

  const fallbackMode = mappedCanonical < CORE_CANONICAL_BONES.length / 2;

  const compatibilityPercent = computeCompatibilityPercent(
    mappedCanonical,
    rig.missingCanonical.length,
    physics.warnings.length,
    motion?.compatibilityPercent
  );

  const report: UmceReport = {
    analyzedAt: Date.now(),
    modelFileName: options.modelFileName,
    compatibilityPercent,
    fallbackMode,
    formatHint: rig.formatHint,
    canonicalMap,
    boneIdentities,
    rig,
    physics,
    motion,
    repairs,
    warnings,
    stats: {
      boneCount: bones.length,
      morphCount: ctx.morphCount,
      ikChains: ctx.iks.length,
      rigidBodies: physics.rigidBodyCount,
      constraints: physics.constraintCount,
      mappedCanonical,
    },
  };

  umceLogReportSummary(compatibilityPercent, warnings.length);

  if (options.applyRepairs !== false) {
    const applied = applyUmceMeshRepairs(mesh, report);
    report.repairs = [...report.repairs, ...applied];
  }

  return report;
}

export { extractVmdBoneNames };
