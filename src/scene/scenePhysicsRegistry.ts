/**
 * Multi-character physics substep cap — ported from AnimaStage Pro (mmd-character-motion.js).
 * Prevents substep death-spiral when 2+ cloth/hair PMX models simulate together.
 */
import type { MMDPhysics } from 'three-stdlib';
import { getEffectivePhysicsMaxSteps } from '../perf/physicsQualityControl';

const activePhysics = new Set<MMDPhysics>();
const physicsByModelId = new Map<string, MMDPhysics>();
let selectedSceneModelId: string | null = null;

export function setSelectedPhysicsModelId(modelId: string | null): void {
  selectedSceneModelId = modelId;
  applyMultiCharacterPhysicsSubstepCap();
}

export function registerScenePhysics(physics: MMDPhysics, sceneModelId?: string): () => void {
  activePhysics.add(physics);
  if (sceneModelId) physicsByModelId.set(sceneModelId, physics);
  applyMultiCharacterPhysicsSubstepCap();
  return () => {
    activePhysics.delete(physics);
    if (sceneModelId) physicsByModelId.delete(sceneModelId);
    applyMultiCharacterPhysicsSubstepCap();
  };
}

export function getActivePhysicsCount(): number {
  return activePhysics.size;
}

export function refreshScenePhysicsSubstepCaps(): void {
  applyMultiCharacterPhysicsSubstepCap();
}

export function applyMultiCharacterPhysicsSubstepCap(): void {
  const meshes = [...activePhysics];
  const want = getEffectivePhysicsMaxSteps();

  if (meshes.length >= 2) {
    const primary = selectedSceneModelId
      ? physicsByModelId.get(selectedSceneModelId)
      : null;
    for (const ph of meshes) {
      const isPrimary = !primary || ph === primary;
      ph.maxStepNum = isPrimary ? Math.min(2, want) : 1;
    }
    return;
  }

  if (meshes.length === 1 && meshes[0]!.maxStepNum !== want) {
    meshes[0]!.maxStepNum = want;
  }
}
