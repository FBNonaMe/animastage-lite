import { lookupCanonicalByName, normalizeBoneName } from './boneDictionary';
import type {
  CanonicalBoneId,
  CanonicalBoneMatch,
  MotionCompatResult,
  UmceBoneRecord,
} from './types';

function canonicalToModelName(
  canonicalId: CanonicalBoneId,
  canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>>
): string | null {
  return canonicalMap[canonicalId]?.boneName ?? null;
}

function fuzzyModelBone(vmdName: string, modelBones: UmceBoneRecord[]): string | null {
  const norm = normalizeBoneName(vmdName);
  const direct = modelBones.find(
    (b) => b.name === vmdName || normalizeBoneName(b.name) === norm
  );
  if (direct) return direct.name;

  const partial = modelBones.find(
    (b) =>
      normalizeBoneName(b.name).includes(norm) ||
      norm.includes(normalizeBoneName(b.name))
  );
  return partial?.name ?? null;
}

/**
 * Map VMD bone names → model bone names via canonical layer.
 * No manual user interaction required for typical humanoid rigs.
 */
export function buildMotionCompatibilityMap(
  vmdBoneNames: string[],
  modelBones: UmceBoneRecord[],
  canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>>
): MotionCompatResult {
  const modelNameSet = new Set(modelBones.map((b) => b.name));
  const remapTable: Record<string, string> = {};
  const unmappedBones: string[] = [];

  for (const vmdBone of vmdBoneNames) {
    if (modelNameSet.has(vmdBone)) {
      remapTable[vmdBone] = vmdBone;
      continue;
    }

    const hit = lookupCanonicalByName(vmdBone);
    if (hit) {
      const modelBone = canonicalToModelName(hit.canonicalId, canonicalMap);
      if (modelBone && modelNameSet.has(modelBone)) {
        remapTable[vmdBone] = modelBone;
        continue;
      }
    }

    const fuzzy = fuzzyModelBone(vmdBone, modelBones);
    if (fuzzy) {
      remapTable[vmdBone] = fuzzy;
      continue;
    }

    unmappedBones.push(vmdBone);
  }

  const mappedCount = Object.keys(remapTable).length;
  const vmdBoneCount = vmdBoneNames.length;
  const compatibilityPercent =
    vmdBoneCount > 0 ? Math.round((mappedCount / vmdBoneCount) * 100) : 100;

  return {
    vmdBoneCount,
    mappedCount,
    unmappedBones,
    remapTable,
    compatibilityPercent,
  };
}

export function extractVmdBoneNames(vmd: {
  motions?: Array<{ boneName?: string }>;
}): string[] {
  const set = new Set<string>();
  for (const m of vmd.motions ?? []) {
    if (m.boneName) set.add(m.boneName);
  }
  return [...set];
}
