/**
 * Build VMD / motion bone remap from retarget slot map.
 * Keys = names in the motion clip; values = bone names on the target model.
 */
import type { RetargetMappingPreset, RetargetSlotId } from './types';
import { RETARGET_SLOTS } from './types';
import { defaultMmdSlotMap } from './retarget';
import type { MMDModel } from '../types';

function normalizeBoneKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '');
}

/** Find a model bone that best matches a preferred display name. */
function resolveTargetBone(
  preferred: string,
  modelBones: string[]
): string | null {
  if (!preferred) return null;
  const exact = modelBones.find((b) => b === preferred);
  if (exact) return exact;
  const n = normalizeBoneKey(preferred);
  const fuzzy = modelBones.find((b) => normalizeBoneKey(b) === n);
  return fuzzy ?? null;
}

/**
 * Slot map stores "motion bone name" per anatomical slot.
 * Remap table: motionBone → modelBone (for UMCE / VMD helper).
 */
export function slotMapToBoneRemap(
  slotMap: Partial<Record<RetargetSlotId, string>>,
  model: MMDModel
): Record<string, string> {
  const modelBones =
    model.pmxBones?.map((b) => b.name).filter(Boolean) ??
    model.bones?.map((b) => b.name).filter(Boolean) ??
    [];
  const targetDefaults = defaultMmdSlotMap();
  const remap: Record<string, string> = {};

  for (const slot of RETARGET_SLOTS) {
    const motionBone = (slotMap[slot.id] ?? '').trim();
    if (!motionBone) continue;
    const preferredTarget =
      (targetDefaults[slot.id] ?? '').trim() || motionBone;
    const target =
      resolveTargetBone(preferredTarget, modelBones) ??
      resolveTargetBone(motionBone, modelBones) ??
      preferredTarget;
    remap[motionBone] = target;
  }
  return remap;
}

export function boneRemapFromPreset(
  preset: RetargetMappingPreset | null | undefined,
  model: MMDModel
): Record<string, string> | undefined {
  if (!preset?.slotMap) return undefined;
  const remap = slotMapToBoneRemap(preset.slotMap, model);
  return Object.keys(remap).length ? remap : undefined;
}
