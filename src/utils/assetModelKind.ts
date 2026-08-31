import type { MMDModel } from '../types';
import type { AssetModelKind } from '../types';

export function inferAssetKindFromName(fileName: string): AssetModelKind {
  const n = fileName.toLowerCase().replace(/\.[^.]+$/, '');
  const ext = fileName.toLowerCase().split('.').pop() ?? '';

  if (
    /stage|scene|city|street|environment|room|platform|set\b|moonlight|gameready|background|blimp|building|town|urban|concert|arena|map\b/i.test(
      n
    )
  ) {
    return 'stage';
  }

  if (/prop|car|vehicle|tree|lamp|furniture|accessory|blimp/i.test(n)) {
    return 'prop';
  }

  if (
    /character|chara|body|girl|boy|avatar|person|evelynn|miku|dance|model|human|rig|esper|npc|hero|idol/i.test(
      n
    )
  ) {
    return 'character';
  }

  // Most user GLB/FBX/VRM drops are characters — defaulting to "prop" hid them in UX
  // and used the wrong normalize target.
  if (/^(glb|gltf|vrm|fbx|pmx|pmd)$/i.test(ext)) {
    return 'character';
  }

  return 'character';
}

const KIND_ORDER: Record<AssetModelKind, number> = {
  stage: 0,
  prop: 1,
  character: 2,
};

export function sortByAssetKind<T extends { assetKind?: AssetModelKind }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (KIND_ORDER[a.assetKind ?? 'character'] ?? 9) -
      (KIND_ORDER[b.assetKind ?? 'character'] ?? 9)
  );
}

export function sceneHasStage(models: readonly MMDModel[]): boolean {
  return models.some((m) => m.visible && m.assetKind === 'stage');
}

export function pickPreferredSelectModelId(models: MMDModel[]): string | null {
  const character = [...models].reverse().find((m) => m.assetKind === 'character');
  if (character) return character.id;
  const stage = [...models].reverse().find((m) => m.assetKind === 'stage');
  if (stage) return stage.id;
  return models[models.length - 1]?.id ?? null;
}

export function isGenericImportedModel(model: {
  modelFormat?: string;
  assetKind?: AssetModelKind;
}): boolean {
  if (model.modelFormat && model.modelFormat !== 'mmd') return true;
  if (model.assetKind && model.assetKind !== 'character') return true;
  return false;
}
