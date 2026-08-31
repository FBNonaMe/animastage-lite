import type { ViewportFormat, VisualFxSettings } from '../types';
import type { DynamicSkyState, DynamicWeatherId } from '../dynamicSky/types';
import type { SceneComposerState } from '../sceneComposer/types';

export type SceneStudioUiMode = 'basic' | 'advanced' | 'pro';
export type SceneFxBackendPreference = 'auto' | 'webgpu' | 'webgl';
export type SceneFxBackend = 'webgpu' | 'webgl';
export type SceneFxMount =
  | 'background'
  | 'world'
  | 'surface'
  | 'character'
  | 'foreground'
  | 'post';
export type SceneFxQuality = 'low' | 'medium' | 'high' | 'ultra' | 'auto';
export type SceneFxCategory =
  | 'weather'
  | 'magic'
  | 'anime'
  | 'cinematic'
  | 'particles'
  | 'energy'
  | 'environment'
  | 'character'
  | 'camera'
  | 'audio';

export type SceneMoodPresetId =
  | 'clear_day'
  | 'sunset'
  | 'golden_hour'
  | 'night'
  | 'moonlight'
  | 'rain'
  | 'heavy_rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'heavy_fog'
  | 'cyberpunk'
  | 'neon_night'
  | 'fantasy'
  | 'apocalypse'
  | 'cinematic'
  | 'anime'
  | 'mmd';

export interface SceneFxParameterValue {
  value: number | boolean | string | [number, number, number];
}

export interface SceneEffectWindow {
  startFrame: number;
  endFrame?: number | null;
  blendIn?: number;
  blendOut?: number;
}

export interface SceneEffectKeyframe {
  frame: number;
  parameterId: string;
  value: number;
  interpolation?: 'linear' | 'bezier';
  easeIn?: number;
  easeOut?: number;
}

export interface SceneFxRuntimeError {
  message: string;
  atFrame?: number;
  at: number;
}

export interface SceneFxInstance {
  id: string;
  effectId: string;
  effectVersion: number;
  name: string;
  enabled: boolean;
  mount: SceneFxMount;
  category: SceneFxCategory;
  intensity: number;
  quality: SceneFxQuality;
  order: number;
  targetModelId?: string | null;
  targetBone?: string | null;
  parameters: Record<string, SceneFxParameterValue>;
  /** Timeline window — omit for always-on effects. */
  window?: SceneEffectWindow | null;
  keyframes?: SceneEffectKeyframe[];
  runtimeError?: SceneFxRuntimeError | null;
  favorite?: boolean;
}

export interface SceneFxDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  category: SceneFxCategory;
  mount: SceneFxMount;
  tags: string[];
  author?: string;
  thumbnail?: string;
  requires: {
    depth?: boolean;
    audio?: boolean;
    character?: boolean;
    bones?: boolean;
    compute?: boolean;
  };
  fallbackEffectId?: string;
  /** Maps to another built-in runtime when this id is cosmetic / alias. */
  runtimeEffectId?: string;
}

export interface SceneWeatherControls {
  weather: DynamicWeatherId | 'dust' | 'ash' | 'mist';
  intensity: number;
  speed: number;
  directionDeg: number;
  density: number;
  turbulence: number;
}

export interface SceneParticleBudget {
  requestedCount: number;
  effectiveCount: number;
  adaptive: boolean;
  collisions: boolean;
  collideWithCharacter: boolean;
  collideWithEnvironment: boolean;
}

export interface SceneFxCapabilities {
  webGpu: boolean;
  compute: boolean;
  timestampQuery: boolean;
  depthTexture: boolean;
  maxStorageBufferBindingSize: number;
  backend: SceneFxBackend;
  fallbackReason: string | null;
}

export interface SceneStudioShotState {
  shotId: string;
  moodPresetId: SceneMoodPresetId | null;
  fxStack: SceneFxInstance[];
  dynamicSky?: Partial<DynamicSkyState>;
  sceneComposer?: Partial<SceneComposerState>;
  visualFx?: Partial<VisualFxSettings>;
}

export interface SceneStudioState {
  version: 1;
  uiMode: SceneStudioUiMode;
  backendPreference: SceneFxBackendPreference;
  activeMoodPresetId: SceneMoodPresetId | null;
  weather: SceneWeatherControls;
  fxStack: SceneFxInstance[];
  particles: SceneParticleBudget;
  autoCharacterLights: boolean;
  materialStyle:
    | 'classic_mmd'
    | 'toon'
    | 'anime'
    | 'soft_anime'
    | 'cinematic'
    | 'realistic'
    | 'fantasy'
    | 'cyberpunk'
    | 'stylized'
    | 'high_contrast';
  shotStates: SceneStudioShotState[];
}

export interface SceneMoodPreset {
  id: SceneMoodPresetId;
  name: string;
  description: string;
  timeHours: number;
  weather: SceneWeatherControls;
  dynamicSky: Partial<DynamicSkyState>;
  sceneComposer: Partial<SceneComposerState>;
  visualFx: Partial<VisualFxSettings>;
  effects: Array<Pick<SceneFxInstance, 'effectId' | 'name' | 'mount' | 'category' | 'intensity'>>;
}

export interface SceneStudioApplyPatch {
  sceneStudio: SceneStudioState;
  dynamicSky: DynamicSkyState;
  sceneComposer: SceneComposerState;
  visualFx: VisualFxSettings;
  viewportFormat?: ViewportFormat;
}

export const DEFAULT_SCENE_STUDIO: SceneStudioState = {
  version: 1,
  uiMode: 'basic',
  backendPreference: 'auto',
  activeMoodPresetId: null,
  weather: {
    weather: 'clear',
    intensity: 0,
    speed: 1,
    directionDeg: 0,
    density: 0,
    turbulence: 0,
  },
  fxStack: [],
  particles: {
    requestedCount: 12_000,
    effectiveCount: 4_000,
    adaptive: true,
    collisions: false,
    collideWithCharacter: false,
    collideWithEnvironment: true,
  },
  autoCharacterLights: false,
  materialStyle: 'anime',
  shotStates: [],
};
