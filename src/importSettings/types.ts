/**
 * Model import options — environment / renderer stay project-owned unless opted in.
 */

export interface ModelImportSettings {
  importMaterials: boolean;
  importAnimations: boolean;
  importPhysics: boolean;
  importMorphs: boolean;
  importTextures: boolean;
  /** OFF by default — characters must not inject scene lights. */
  importLights: boolean;
  /** OFF by default. */
  importCameras: boolean;
  /** OFF by default — never apply embedded environment from assets. */
  applyEnvironment: boolean;
  /** OFF by default — fog stays as stored in the project. */
  enableFog: boolean;
}

export const DEFAULT_MODEL_IMPORT_SETTINGS: ModelImportSettings = {
  importMaterials: true,
  importAnimations: true,
  importPhysics: true,
  importMorphs: true,
  importTextures: true,
  importLights: false,
  importCameras: false,
  applyEnvironment: false,
  enableFog: false,
};

const STORAGE_KEY = 'as_model_import_settings_v1';

export function loadModelImportSettings(): ModelImportSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MODEL_IMPORT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ModelImportSettings>;
    return { ...DEFAULT_MODEL_IMPORT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_MODEL_IMPORT_SETTINGS };
  }
}

export function saveModelImportSettings(settings: ModelImportSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
