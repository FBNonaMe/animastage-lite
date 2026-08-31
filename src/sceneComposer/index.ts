export type {
  SceneComposerState,
  SceneComposerLights,
  SceneComposerEffectLevels,
  SceneComposerBundle,
  SceneHealthReport,
  AutoSceneResult,
  EffectLevel,
  ComposerPresetId,
  ComposerVisualStyleId,
  MaterialOverrideId,
  ComposerSkyId,
  PresetPreviewSource,
} from './types';

export {
  DEFAULT_SCENE_COMPOSER,
  DEFAULT_SCENE_COMPOSER_LIGHTS,
  normalizeSceneComposerLights,
  sunPositionFromAngles,
  skyHintFromSun,
} from './defaults';
export {
  applyComposerPreset,
  applyVisualStyle,
  applyMaterialOverride,
  composerStateToVisualFxPatch,
  listComposerPresets,
  buildDefaultComposerBundle,
} from './apply';
export { effectLevelsToVisualFx, visualFxToEffectLevels } from './effectLevels';
export { COMPOSER_PRESETS, VISUAL_STYLE_PATCHES, getComposerPreset } from './presets';
export { buildAutoScene } from './autoScene';
export { computeSceneHealth } from './health';
export {
  serializeScenePreset,
  parseScenePreset,
  downloadScenePreset,
} from './serialize';
