export type {
  CameraTemplateDef,
  CameraTemplateCategory,
  CameraTemplateFolder,
  UserCameraTemplate,
  TemplateAdaptContext,
  AppliedCameraTemplate,
  TemplateMatchResult,
} from './types';
export { CAMERA_TEMPLATE_STORAGE_KEY } from './types';
export {
  BUILTIN_CAMERA_TEMPLATES,
  getBuiltinTemplate,
  TEMPLATE_CATEGORY_LABELS,
} from './builtinCatalog';
export { applyCameraTemplate, previewTemplatePath, estimateCharacterHeight } from './adaptTemplate';
export { matchTemplatesToReference, tweakTemplateForReference } from './matchReference';
export {
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
} from './userLibrary';
