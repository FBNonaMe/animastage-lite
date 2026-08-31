/** Pick which scene character receives a VMD-only import. */
import type { AssetModelKind } from '../types';

interface AttachCandidate {
  id: string;
  assetKind?: AssetModelKind;
  visible?: boolean;
}

function isCharacter(model: AttachCandidate): boolean {
  return (model.assetKind ?? 'character') === 'character';
}

export function resolveVmdAttachTargetModelId(
  selectedObjectId: string | null | undefined,
  models: AttachCandidate[]
): string | null {
  if (models.length === 0) return null;

  if (selectedObjectId) {
    const selected = models.find((m) => m.id === selectedObjectId);
    // A stage or prop cannot play a character motion — fall through to a character.
    if (selected && isCharacter(selected)) return selected.id;
  }

  const characters = models.filter(isCharacter);
  const visibleCharacter = [...characters].reverse().find((m) => m.visible !== false);
  if (visibleCharacter) return visibleCharacter.id;
  if (characters.length > 0) return characters[characters.length - 1]!.id;

  return models[0]!.id;
}

export function resolveVmdAttachTargetLabel(
  selectedObjectId: string | null | undefined,
  models: (AttachCandidate & { name: string })[]
): string | null {
  const id = resolveVmdAttachTargetModelId(selectedObjectId, models);
  if (!id) return null;
  return models.find((m) => m.id === id)?.name ?? null;
}
