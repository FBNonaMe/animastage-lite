/**
 * Environment Builder — import 3D scenes as cinematic backgrounds.
 */
import type { CameraOrbitPresetId, VisualFxSettings } from '../types';
import type { DynamicSkyState } from '../dynamicSky/types';
import type { SceneComposerState } from '../sceneComposer/types';

export type AssetImportRole = 'character' | 'prop' | 'environment' | 'background';

export type WorldScalePresetId =
  | 'real_world'
  | 'anime'
  | 'mmd'
  | 'vrm'
  | 'custom';

export type SceneKind = 'indoor' | 'outdoor' | 'stage' | 'unknown';

export type EnvironmentCategoryId =
  | 'anime_street'
  | 'japanese_school'
  | 'temple'
  | 'shrine'
  | 'bedroom'
  | 'cafe'
  | 'forest'
  | 'beach'
  | 'cyberpunk'
  | 'concert'
  | 'fantasy'
  | 'castle'
  | 'snow'
  | 'city'
  | 'night'
  | 'studio';

export type SmartCameraId =
  | 'entrance'
  | 'hero'
  | 'portrait'
  | 'wide'
  | 'movie'
  | 'low_angle'
  | 'high_angle'
  | 'orbit'
  | 'walkthrough';

export type CharacterPlacementId =
  | 'snap_floor'
  | 'snap_stage'
  | 'center'
  | 'spawn_left'
  | 'spawn_right'
  | 'spawn_back';

export type BackgroundFxId =
  | 'bloom'
  | 'dof'
  | 'fog'
  | 'volumetric'
  | 'god_rays'
  | 'ssr'
  | 'reflections'
  | 'ao'
  | 'shadow_catcher';

export interface WorldScalePresetDef {
  id: WorldScalePresetId;
  label: string;
  description: string;
  /** Approx meters that one scene unit equals — informs camera framing. */
  unitMeters: number;
  /**
   * Real scale multiplier for the imported environment model
   * (applied on top of import normalization). Null = keep as is.
   */
  envScaleMultiplier: number | null;
  cameraStudio: { focusTarget: 'face' | 'body' | 'full'; orbitPreset: CameraOrbitPresetId };
}

export interface EnvironmentDepthSettings {
  blur: number;
  fog: number;
  distanceFade: number;
  brightness: number;
  saturation: number;
  exposure: number;
  contrast: number;
}

export const DEFAULT_ENV_DEPTH: EnvironmentDepthSettings = {
  blur: 0,
  fog: 0.25,
  distanceFade: 0.3,
  brightness: 1,
  saturation: 1,
  exposure: 1,
  contrast: 1,
};

export interface EnvironmentPatches {
  visualFx?: Partial<VisualFxSettings>;
  dynamicSky?: Partial<DynamicSkyState>;
  sceneComposer?: Partial<SceneComposerState> & {
    lights?: Partial<SceneComposerState['lights']>;
  };
  cameraPreset?: CameraOrbitPresetId;
  message?: string;
}

export interface EnvironmentCategoryDef {
  id: EnvironmentCategoryId;
  label: string;
  kind: SceneKind;
  description: string;
  patches: EnvironmentPatches;
}

export interface SmartCameraDef {
  id: SmartCameraId;
  label: string;
  description: string;
  preset: CameraOrbitPresetId;
  focusTarget: 'face' | 'body' | 'full';
}

export interface BackgroundFxDef {
  id: BackgroundFxId;
  label: string;
  visualFx: Partial<VisualFxSettings>;
}

export interface SceneAnalysisResult {
  kind: SceneKind;
  hasEnvironment: boolean;
  characterCount: number;
  suggestions: string[];
  recommendedCamera: SmartCameraId;
  recommendedCategory: EnvironmentCategoryId | null;
}

export interface EnvironmentPresetV1 {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  categoryId: EnvironmentCategoryId | null;
  scaleId: WorldScalePresetId;
  cameraId: SmartCameraId | null;
  depth: EnvironmentDepthSettings;
  timeHours: number | null;
  visualFx?: Partial<VisualFxSettings>;
  dynamicSky?: Partial<DynamicSkyState>;
  sceneComposer?: Partial<SceneComposerState>;
}
