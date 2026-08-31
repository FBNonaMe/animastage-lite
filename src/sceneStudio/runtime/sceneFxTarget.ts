/** Resolves which character Scene FX should follow, plus the scene scale hint. */
import type { MMDModel } from '../../types';

export interface SceneFxTarget {
  modelId: string | null;
  position: [number, number, number] | null;
  worldScale: number;
}

export function resolveSceneFxTarget(
  models: readonly MMDModel[],
  selectedObjectId?: string | null
): SceneFxTarget {
  const visible = models.filter((m) => m.visible);
  const characters = visible.filter((m) => (m.assetKind ?? 'character') === 'character');
  const selected = characters.find((m) => m.id === selectedObjectId);
  const target = selected ?? characters[characters.length - 1] ?? null;

  const stage = visible.find((m) => m.assetKind === 'stage');
  const worldScale = target?.worldScale ?? stage?.worldScale ?? 1;

  return {
    modelId: target?.id ?? null,
    position: target ? [target.positionX, target.positionY, target.positionZ] : null,
    worldScale: worldScale > 0 ? worldScale : 1,
  };
}
