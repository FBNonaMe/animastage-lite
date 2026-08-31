export type {
  AsrpPipelineId,
  AsrpQualityTier,
  AsrpMaterialKind,
  AsrpMaterialProfile,
  AsrpSettings,
  AsrpQualityProfile,
} from './types';

export { DEFAULT_ASRP } from './defaults';
export { detectAsrpQualityTier, getAsrpQualityProfile } from './quality';
export { classifyAsrpMaterial, getAsrpMaterialProfile } from './materialKinds';
export { resolveAsrpHeightMap } from './heightApprox';
export {
  patchMaterialSilhouettePom,
  syncSilhouettePomUniforms,
} from './silhouettePom';
export {
  applyAsrpToObject,
  isAsrpActive,
  buildPomBagFromSettings,
} from './applyAsrp';
export { default as AsrpSystem } from './AsrpSystem';
export { pipelineToRenderFlags, renderFlagsToPipeline } from './pipelineMap';

/** ASRP V2 — unified frame graph */
export {
  resolveAsrpFrame,
  mergeVisualFxFromFrame,
  ASRP_VISUAL_STYLES,
  getAsrpVisualStyle,
  aliasLegacyStyleId,
  applyAsrpVisualStyle,
  applyAutoCinematicDirector,
  applyAsrpMaterialShadingToObject,
  AsrpVolumetricAtmosphere,
  AsrpMotionBlurLite,
  AsrpAdvancedPassFlags,
  AsrpPropDistanceLod,
  type AsrpVisualStyleId,
  type AsrpFrameState,
  type AsrpFrameBudgets,
  type ResolveAsrpFrameOptions,
} from './v2';
