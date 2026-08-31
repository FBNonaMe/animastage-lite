import type { ProcessedVmdFiles } from '../utils/mmdFiles';
import type { MMDModel, TimelineKeyframe } from '../types';
import type {
  AnimationLibraryAsset,
  AnimationLibraryState,
  CharacterMotionOverride,
} from './types';
import { estimateAssetCompatibility, inferSkeletonFromModel } from './retarget';

export type AssignMode = 'vmd' | 'template' | 'keyframes' | 'unsupported';

export interface AssignPlan {
  mode: AssignMode;
  modelId: string;
  asset: AnimationLibraryAsset;
  vmd?: ProcessedVmdFiles;
  templateId?: string;
  keyframes?: TimelineKeyframe[];
  override: CharacterMotionOverride;
  needsRetargetEditor: boolean;
  message: string;
}

export function assetToProcessedVmd(asset: AnimationLibraryAsset): ProcessedVmdFiles | null {
  if (!asset.vmdBlobUrls?.length) return null;
  return {
    fileMap: asset.fileMap ?? {},
    vmdBlobUrls: asset.vmdBlobUrls,
    vmdFileNames: asset.vmdFileNames ?? asset.sourceFileNames ?? ['motion.vmd'],
    cameraVmdBlobUrl: asset.cameraVmdBlobUrl,
    cameraVmdFileName: asset.cameraVmdFileName,
    hasCameraVmd: asset.hasCameraVmd,
  };
}

export function planAssignAnimation(
  asset: AnimationLibraryAsset,
  model: MMDModel,
  opts?: Partial<CharacterMotionOverride>
): AssignPlan {
  const targetSkel = inferSkeletonFromModel(model);
  const compat = estimateAssetCompatibility(asset.skeletonType, targetSkel);
  const override: CharacterMotionOverride = {
    modelId: model.id,
    assetId: asset.id,
    playbackOffset: opts?.playbackOffset ?? 0,
    speed: opts?.speed ?? 1,
    loop: opts?.loop ?? asset.loop,
    rootMotion: opts?.rootMotion ?? true,
    rootMotionScale: opts?.rootMotionScale ?? 1,
    mappingPresetId: opts?.mappingPresetId ?? asset.mappingPresetId ?? null,
    boneRemap: opts?.boneRemap,
  };

  if (asset.format === 'template' && asset.templateId) {
    return {
      mode: 'template',
      modelId: model.id,
      asset,
      templateId: asset.templateId,
      override,
      needsRetargetEditor: false,
      message: `Apply ready-made “${asset.name}” to ${model.name}`,
    };
  }

  if (asset.keyframes?.length) {
    return {
      mode: 'keyframes',
      modelId: model.id,
      asset,
      keyframes: asset.keyframes,
      override,
      needsRetargetEditor: compat === 'manual',
      message: `Apply keyframe motion “${asset.name}” to ${model.name}`,
    };
  }

  const vmd = assetToProcessedVmd(asset);
  if (vmd) {
    return {
      mode: 'vmd',
      modelId: model.id,
      asset,
      vmd,
      override,
      needsRetargetEditor: compat === 'manual' || compat === 'retarget',
      message: `Assign VMD “${asset.name}” → ${model.name} (${compat})`,
    };
  }

  return {
    mode: 'unsupported',
    modelId: model.id,
    asset,
    override,
    needsRetargetEditor: true,
    message:
      asset.format === 'bvh' || asset.format === 'fbx' || asset.format === 'gltf'
        ? `“${asset.name}” is catalogued. Convert/retarget to VMD or .asmotion for playback (format: ${asset.format}).`
        : `Re-import “${asset.name}” — session blob missing.`,
  };
}

export function upsertAssignment(
  state: AnimationLibraryState,
  override: CharacterMotionOverride
): CharacterMotionOverride[] {
  const rest = state.assignments.filter(
    (a) => !(a.modelId === override.modelId && a.assetId === override.assetId)
  );
  return [...rest, override];
}

export function mergeLibraryAssets(
  state: AnimationLibraryState,
  incoming: AnimationLibraryAsset[],
  packs: AnimationLibraryState['packs'] = []
): AnimationLibraryState {
  const byId = new Map(state.assets.map((a) => [a.id, a]));
  for (const a of incoming) byId.set(a.id, a);
  const packById = new Map(state.packs.map((p) => [p.id, p]));
  for (const p of packs) packById.set(p.id, p);
  return {
    ...state,
    assets: [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    packs: [...packById.values()],
    selectedAssetId: incoming[0]?.id ?? state.selectedAssetId,
  };
}
