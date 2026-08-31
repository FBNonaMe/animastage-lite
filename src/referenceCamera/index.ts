export type {
  ReferenceCameraState,
  ReferenceViewMode,
  CompositionGuideId,
  CameraShotPresetId,
  CameraConstraintId,
  ReferenceVideoAsset,
  FramingModeId,
} from './types';
export {
  DEFAULT_REFERENCE_CAMERA,
  CAMERA_EASING_OPTIONS,
  FOLLOW_TARGET_OPTIONS,
} from './types';
export {
  CAMERA_SHOT_PRESETS,
  getShotPreset,
  shotPresetToKeyframe,
  snapshotFromKeyframe,
} from './shotPresets';
export { SMART_CAMERA_PRESETS, generateSmartCameraPath } from './smartPresets';
export {
  BUILTIN_CAMERA_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  getBuiltinTemplate,
  applyCameraTemplate,
  previewTemplatePath,
  estimateCharacterHeight,
  matchTemplatesToReference,
  tweakTemplateForReference,
  listUserFolders,
  listUserTemplates,
  createFolder,
  renameFolder,
  deleteFolder,
  saveUserTemplate,
  renameUserTemplate,
  moveUserTemplate,
  deleteUserTemplate,
  getUserTemplate,
  exportLibraryJson,
  exportTemplateJson,
  importLibraryJson,
  keyframesFromUserTemplate,
} from './templates';
export type {
  CameraTemplateDef,
  CameraTemplateCategory,
  CameraTemplateFolder,
  UserCameraTemplate,
  TemplateAdaptContext,
  AppliedCameraTemplate,
  TemplateMatchResult,
} from './templates';
export { smoothCameraKeyframes, stabilizeCameraKeyframes } from './smoothCamera';
export { autoMatchCameraFromReference } from './autoMatch';
export {
  sampleCameraPath,
  duplicateCameraKeyframe,
  moveCameraKeyframe,
  patchCameraKeyframe,
} from './keyframes';
export { compositionGuideLines, type GuideLine } from './compositionGuides';
export {
  evaluateCinematicCameraAtFrame,
  catmullRom3,
  hermite3,
  cubicBezier3,
} from './cinematicInterp';
export {
  applyFramingConstraints,
  applyPortraitKeepInFrame,
  recommendCompositionPlacement,
} from './framing';

export const REFERENCE_VIDEO_ACCEPT =
  'video/mp4,video/quicktime,video/webm,video/x-msvideo,image/gif,.mp4,.mov,.webm,.avi,.gif';

export const FRAMING_MODE_OPTIONS: { id: import('./types').FramingModeId; label: string }[] = [
  { id: 'none', label: 'Off' },
  { id: 'keep_character', label: 'Keep Character Visible' },
  { id: 'keep_full_body', label: 'Keep Full Body' },
  { id: 'keep_face', label: 'Keep Face Visible' },
  { id: 'keep_eyes', label: 'Keep Eyes Visible' },
  { id: 'auto_reframe', label: 'Auto Reframe' },
  { id: 'dynamic', label: 'Dynamic Composition' },
];
