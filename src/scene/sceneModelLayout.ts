import type { MMDModel } from '../types';
import type { AssetModelKind } from '../types';

/** Recommended max characters for stable recording on consumer GPUs. */
export const MAX_SCENE_CHARACTERS = 4;

/** Default stage slots — duo scene uses ±7 m spacing. */
const SPAWN_SLOTS: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x: -7, y: 0, z: 0 },
  { x: 7, y: 0, z: 0 },
  { x: -10, y: 0, z: 4 },
  { x: 10, y: 0, z: 4 },
];

export function canAddSceneCharacter(currentCount: number): boolean {
  return currentCount < MAX_SCENE_CHARACTERS;
}

export function getSpawnPositionForIndex(index: number): {
  x: number;
  y: number;
  z: number;
} {
  const slot = SPAWN_SLOTS[index];
  if (slot) return { ...slot };
  const ring = Math.floor(index / SPAWN_SLOTS.length) + 1;
  const angle = (index % SPAWN_SLOTS.length) * (Math.PI / 2);
  return {
    x: Math.cos(angle) * 8 * ring,
    y: 0,
    z: Math.sin(angle) * 5 * ring,
  };
}

export function getNextSpawnPosition(models: readonly MMDModel[]): {
  x: number;
  y: number;
  z: number;
} {
  return getSpawnPositionForIndex(models.length);
}

function batchHasStage(
  existing: readonly MMDModel[],
  batch: readonly { assetKind?: AssetModelKind }[],
  upToIndex: number
): boolean {
  if (existing.some((m) => m.assetKind === 'stage')) return true;
  return batch.slice(0, upToIndex).some((b) => b.assetKind === 'stage');
}

/** Stage at origin; characters center on stage when one is loaded. */
export function getSpawnPositionForImport(
  existing: readonly MMDModel[],
  batch: readonly { assetKind?: AssetModelKind }[],
  indexInBatch: number
): { x: number; y: number; z: number } {
  const kind = batch[indexInBatch]?.assetKind ?? 'character';

  if (kind === 'stage') {
    return { x: 0, y: 0, z: 0 };
  }

  const onStage = batchHasStage(existing, batch, indexInBatch);

  if (kind === 'character') {
    if (onStage) {
      const charSlot = batch
        .slice(0, indexInBatch + 1)
        .filter((b) => b.assetKind === 'character').length - 1;
      return charSlot <= 0
        ? { x: 0, y: 0, z: 0 }
        : getSpawnPositionForIndex(charSlot);
    }
    return getNextSpawnPosition([
      ...existing,
      ...batch.slice(0, indexInBatch).map((_, i) => ({
        id: `batch_${i}`,
      })) as MMDModel[],
    ]);
  }

  // prop — ring around stage
  const propIndex = existing.length + indexInBatch;
  const pos = getSpawnPositionForIndex(propIndex);
  return { x: pos.x, y: 0, z: pos.z + 3 };
}

export function countVisibleModels(models: readonly MMDModel[]): number {
  return models.filter((m) => m.visible).length;
}
