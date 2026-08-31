/**
 * AI Scene Director 1.0 — structured Scene Plan + validated Scene Commands.
 * Never invents asset filenames; never runs arbitrary JS.
 */
import type { ViewportFormat } from '../types';
import type { SceneMoodPresetId } from '../sceneStudio/types';
import type { CinematicLightingPresetId } from '../sceneStudio/lighting';
import type { ShotPresetId } from '../shotComposer/types';
import type { PhysicsPresetId } from '../physics/physicsPresets';

export type AiDirectorMode = 'normal' | 'fast' | 'pro';

export type AiDirectorAssetCategory =
  | 'character'
  | 'environment'
  | 'stage'
  | 'animation'
  | 'pose'
  | 'material'
  | 'hdri'
  | 'sky'
  | 'weather'
  | 'fx'
  | 'particles'
  | 'camera'
  | 'lighting'
  | 'physics'
  | 'render'
  | 'scene_preset'
  | 'lut'
  | 'mood';

export interface AiDirectorAssetMeta {
  id: string;
  name: string;
  type: AiDirectorAssetCategory;
  category: AiDirectorAssetCategory;
  tags: string[];
  thumbnail?: string | null;
  compatibleFormats?: string[];
  recommendedUse?: string;
  presets?: string[];
  dependencies?: string[];
  /** Live scene object id when this is an imported model. */
  modelId?: string | null;
}

export type CharacterPlacementIntent =
  | 'center'
  | 'left'
  | 'right'
  | 'foreground'
  | 'background'
  | 'near_camera'
  | 'far_camera'
  | 'street_center'
  | 'keep';

export type CameraMovementIntent =
  | 'static'
  | 'slow_orbit'
  | 'orbit'
  | 'push_in'
  | 'pull_out'
  | 'pan'
  | 'none';

export interface AiScenePlan {
  version: 1;
  summary: string;
  environmentId: string | null;
  characterId: string | null;
  moodPresetId: SceneMoodPresetId | null;
  timeHours: number | null;
  weather: string | null;
  fog: 'none' | 'light' | 'medium' | 'heavy' | null;
  lightingPresetId: CinematicLightingPresetId | null;
  shotPreset: ShotPresetId | null;
  aspectRatio: ViewportFormat | null;
  cameraMovement: CameraMovementIntent;
  placement: CharacterPlacementIntent;
  physicsPresetId: PhysicsPresetId | null;
  fxIds: string[];
  /** Effect ids to remove before applying new ones (pro plans). */
  removeFxIds?: string[];
  colorGrade: string | null;
  materialStyle: string | null;
  animationAssetId: string | null;
  notes: string[];
  warnings: string[];
}

export type SceneCommandAction =
  | 'setMood'
  | 'setEnvironment'
  | 'setCharacter'
  | 'placeCharacter'
  | 'createShot'
  | 'setAspect'
  | 'setWeather'
  | 'setLighting'
  | 'setFx'
  | 'addEffect'
  | 'removeEffect'
  | 'setPhysicsPreset'
  | 'setMaterialStyle'
  | 'setRenderAspect'
  | 'applyAnimation'
  | 'setCameraMovement';

export interface SceneCommand {
  action: SceneCommandAction;
  /** Validated payload — only allowlisted fields. */
  payload: Record<string, string | number | boolean | string[] | null>;
}

export interface AiScenePlanValidation {
  ok: boolean;
  plan: AiScenePlan;
  commands: SceneCommand[];
  suggestions: Array<{ field: string; requested: string; suggestedId: string; suggestedName: string }>;
  errors: string[];
}

export interface AiDirectorHistoryEntry {
  id: string;
  createdAt: number;
  prompt: string;
  plan: AiScenePlan;
  mode: AiDirectorMode;
}

export const EMPTY_SCENE_PLAN: AiScenePlan = {
  version: 1,
  summary: '',
  environmentId: null,
  characterId: null,
  moodPresetId: null,
  timeHours: null,
  weather: null,
  fog: null,
  lightingPresetId: null,
  shotPreset: null,
  aspectRatio: null,
  cameraMovement: 'none',
  placement: 'keep',
  physicsPresetId: null,
  fxIds: [],
  removeFxIds: [],
  colorGrade: null,
  materialStyle: null,
  animationAssetId: null,
  notes: [],
  warnings: [],
};
