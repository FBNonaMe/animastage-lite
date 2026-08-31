import type { MobileSelectionContext, MobileSelectionKind } from './types';

export interface ResolveMobileContextInput {
  selectedObjectId: string | null;
  selectedBoneId: string | null;
  highlightMaterial: string | null;
  cameraMode: string;
  models: Array<{
    id: string;
    name: string;
    assetKind?: string | null;
    type?: string;
  }>;
}

export function resolveMobileSelectionContext(
  input: ResolveMobileContextInput
): MobileSelectionContext {
  const {
    selectedObjectId,
    selectedBoneId,
    highlightMaterial,
    cameraMode,
    models,
  } = input;

  if (highlightMaterial) {
    return {
      kind: 'material',
      label: highlightMaterial,
      modelId: selectedObjectId,
      materialName: highlightMaterial,
    };
  }

  if (cameraMode === 'free' || cameraMode === 'mmd') {
    // Prefer explicit object selection over camera mode alone
  }

  const model = selectedObjectId
    ? models.find((m) => m.id === selectedObjectId)
    : undefined;

  if (!model) {
    if (cameraMode === 'free') {
      return { kind: 'camera', label: 'Free camera' };
    }
    return { kind: 'none', label: 'Nothing selected' };
  }

  if (model.assetKind === 'stage') {
    return {
      kind: 'stage',
      label: model.name || 'Stage',
      modelId: model.id,
    };
  }

  if (selectedBoneId) {
    return {
      kind: 'bone',
      label: selectedBoneId,
      modelId: model.id,
      boneId: selectedBoneId,
    };
  }

  return {
    kind: 'character',
    label: model.name || 'Character',
    modelId: model.id,
  };
}

export function contextToolsForKind(kind: MobileSelectionKind): Array<{
  id: string;
  label: string;
}> {
  switch (kind) {
    case 'character':
      return [
        { id: 'animate', label: 'Animate' },
        { id: 'materials', label: 'Materials' },
        { id: 'physics', label: 'Physics' },
        { id: 'camera', label: 'Camera' },
        { id: 'pose', label: 'Bones' },
      ];
    case 'bone':
      return [
        { id: 'rotate', label: 'Rotate' },
        { id: 'move', label: 'Move' },
        { id: 'animate', label: 'Key' },
        { id: 'timeline', label: 'Timeline' },
      ];
    case 'material':
      return [
        { id: 'materials', label: 'Edit' },
        { id: 'fx', label: 'FX' },
        { id: 'lighting', label: 'Light' },
      ];
    case 'camera':
      return [
        { id: 'camera', label: 'Framing' },
        { id: 'timeline', label: 'Keys' },
        { id: 'render', label: 'Render' },
      ];
    case 'light':
      return [
        { id: 'lighting', label: 'Lights' },
        { id: 'materials', label: 'Look' },
      ];
    case 'stage':
      return [
        { id: 'scene', label: 'Scene' },
        { id: 'lighting', label: 'Light' },
        { id: 'fx', label: 'FX' },
      ];
    default:
      return [
        { id: 'assets', label: 'Assets' },
        { id: 'scene', label: 'Scene' },
        { id: 'camera', label: 'Camera' },
        { id: 'timeline', label: 'Edit' },
      ];
  }
}
