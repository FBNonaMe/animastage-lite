import type { AppState } from '../types';
import { estimateGpuTier } from './qualityEngine';
import type { SceneProfile } from './types';

/** Build an internal Scene Profile from current app state (UMCE-aware). */
export function analyzeSceneProfile(state: AppState): SceneProfile {
  const models = state.models;
  const selected =
    models.find((m) => m.id === state.selectedObjectId) ?? models[0] ?? null;

  let boneCount = 0;
  let morphCount = 0;
  let umceCompatibility: number | null = null;
  let formatHint: string | null = null;
  let hasClothPhysics = false;
  let hasHairPhysics = false;
  let rigidBodies = 0;

  for (const m of models) {
    boneCount += m.pmxBones?.length ?? m.modelAnalysis?.stats.boneCount ?? 0;
    morphCount += m.pmxMorphs?.length ?? m.modelAnalysis?.stats.morphCount ?? 0;
    rigidBodies += m.modelAnalysis?.stats.rigidBodyCount ?? 0;
    if (m.umceReport) {
      umceCompatibility = Math.max(umceCompatibility ?? 0, m.umceReport.compatibilityPercent);
      formatHint = m.umceReport.formatHint;
      if (m.umceReport.physics.dynamicCount > 20) hasClothPhysics = true;
      if (m.umceReport.physics.dynamicCount > 5) hasHairPhysics = true;
    }
  }

  if (rigidBodies > 30) hasClothPhysics = true;
  if (rigidBodies > 10) hasHairPhysics = true;

  const hasAnimation = models.some(
    (m) =>
      (m.hasVmdAnimation && m.vmdPlaybackEnabled !== false) ||
      (m.keyframes?.length ?? 0) > 0 ||
      Boolean(m.activeTemplateId)
  );

  const modelCount = models.length;
  const stageSize: SceneProfile['stageSize'] =
    modelCount >= 3 ? 'group' : modelCount === 2 ? 'duo' : 'solo';

  /** Height heuristic from bone count / UMCE — average humanoid default. */
  let characterHeightHint: SceneProfile['characterHeightHint'] = 'average';
  if (boneCount > 0 && boneCount < 80) characterHeightHint = 'short';
  if (boneCount > 200) characterHeightHint = 'tall';

  return {
    modelCount,
    hasAnimation,
    hasCameraVmd: Boolean(state.hasCameraVmd),
    hasPhysics: state.physicsMode !== 'off' && rigidBodies > 0,
    hasClothPhysics,
    hasHairPhysics,
    morphCount,
    boneCount,
    umceCompatibility,
    formatHint,
    characterHeightHint,
    stageSize,
    gpuTier: estimateGpuTier(),
    selectedModelId: selected?.id ?? null,
    selectedModelName: selected?.name ?? null,
  };
}
