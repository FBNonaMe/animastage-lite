import type { SceneBackgroundSettings, SceneHdrSettings, VisualFxSettings } from '../types';

export type EffectLevel = 'off' | 'low' | 'medium' | 'high' | 'auto';

export type ComposerPresetId =
  | 'studio'
  | 'golden_hour'
  | 'sunset'
  | 'night'
  | 'moonlight'
  | 'temple'
  | 'forest'
  | 'cyberpunk'
  | 'sci_fi'
  | 'concert'
  | 'dream'
  | 'fantasy'
  | 'anime_street'
  | 'beach'
  | 'indoor'
  | 'outdoor';

export type ComposerVisualStyleId =
  | 'default'
  | 'anime'
  | 'soft_anime'
  | 'fantasy'
  | 'cyberpunk'
  | 'studio'
  | 'realistic'
  | 'comic'
  | 'sketch';

export type MaterialOverrideId =
  | 'default'
  | 'soft_toon'
  | 'outline'
  | 'studio'
  | 'flat'
  | 'stylized';

export type ComposerSkyId =
  | 'blue'
  | 'sunset'
  | 'night'
  | 'cloudy'
  | 'fantasy'
  | 'cyber';

export type ComposerBgMode =
  | 'scene'
  | 'transparent'
  | 'solid_white'
  | 'solid_black'
  | 'custom';

export interface SceneComposerLights {
  sunEnabled: boolean;
  sunAzimuth: number;
  sunElevation: number;
  sunColor: string;
  sunIntensity: number;
  sunShadows: boolean;
  ambientEnabled: boolean;
  ambientColor: string;
  ambientIntensity: number;
  hemisphereEnabled: boolean;
  hemisphereIntensity: number;
  /** Optional portrait rig layered over sun/world lighting. */
  characterRigEnabled: boolean;
  keyEnabled: boolean;
  keyColor: string;
  keyIntensity: number;
  fillEnabled: boolean;
  fillColor: string;
  fillIntensity: number;
  rimEnabled: boolean;
  rimColor: string;
  rimIntensity: number;
}

export interface SceneComposerEffectLevels {
  bloom: EffectLevel;
  glow: EffectLevel;
  outline: EffectLevel;
  rim: EffectLevel;
  dof: EffectLevel;
  ao: EffectLevel;
  sss: EffectLevel;
  reflection: EffectLevel;
}

export type PresetPreviewSource = 'model' | 'image' | 'minimal';

export interface SceneComposerState {
  lights: SceneComposerLights;
  skyPreset: ComposerSkyId;
  bgMode: ComposerBgMode;
  bgCustomColor: string;
  /** What to show behind preset thumbnails and optional scene backdrop. */
  presetPreviewSource: PresetPreviewSource;
  visualStyle: ComposerVisualStyleId;
  materialOverride: MaterialOverrideId;
  effectLevels: SceneComposerEffectLevels;
  /** Color grading sliders (mapped to tone + grade). */
  exposure: number;
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  gamma: number;
  fogEnabled: boolean;
  fogDensity: number;
  fogColor: string;
  windStrength: number;
  envBrightness: number;
}

export interface SceneComposerBundle {
  version: 1;
  name: string;
  visualFx: VisualFxSettings;
  sceneComposer: SceneComposerState;
  sceneBackground?: SceneBackgroundSettings;
  sceneHdr?: Partial<SceneHdrSettings>;
}

export interface SceneHealthReport {
  lighting: string;
  performance: string;
  environment: string;
  weather: string;
  visualQuality: string;
  overallPercent: number;
}

export interface AutoSceneResult {
  presetId: ComposerPresetId;
  visualFx: Partial<VisualFxSettings>;
  composer: Partial<SceneComposerState>;
  sceneBackground?: Partial<SceneBackgroundSettings>;
  report: string[];
}
