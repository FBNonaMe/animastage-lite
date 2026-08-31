/**
 * AnimaStage Render Pipeline 2.0 — settings schema.
 * Renderer-agnostic; WebGL / WebGPU backends consume resolved budgets.
 */
import type { ColorGradePresetId } from '../types';

export type RenderBackendId = 'auto' | 'webgl' | 'webgpu';

export type GiQualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export type GiModeId =
  | 'off'
  | 'ssgi'
  | 'ssvgi'
  | 'hybrid';

export type AoModeId =
  | 'off'
  | 'ssao'
  | 'hbao'
  | 'gtao'
  | 'ssdo'
  | 'hybrid'
  | 'contact';

export type ReflectionModeId =
  | 'off'
  | 'ssr'
  | 'probe'
  | 'box'
  | 'hybrid';

export type BloomStyleId = 'classic' | 'soft' | 'cinematic' | 'multi_res';

export type ToneMapperId =
  | 'aces'
  | 'agx'
  | 'neutral'
  | 'filmic'
  | 'anime'
  | 'custom_lut';

export type MaterialLookId =
  | 'anime'
  | 'pbr'
  | 'toon'
  | 'skin'
  | 'hair'
  | 'fabric'
  | 'glass'
  | 'metal'
  | 'water'
  | 'plastic';

export type RenderPipeline2PresetId =
  | 'classic_mmd'
  | 'anime'
  | 'soft_anime'
  | 'studio'
  | 'cinematic'
  | 'movie'
  | 'photoreal'
  | 'cyberpunk'
  | 'fantasy'
  | 'golden_hour'
  | 'night'
  | 'rain'
  | 'fog'
  | 'sunset';

export interface GiSettings {
  mode: GiModeId;
  quality: GiQualityPreset;
  intensity: number;
  colorBleeding: number;
  indirectBounce: number;
  temporalAccumulation: boolean;
  halfResolution: boolean;
  denoiser: boolean;
  normalAware: boolean;
  sunBounce: number;
  skyBounce: number;
}

export interface AoSettings {
  mode: AoModeId;
  intensity: number;
  radius: number;
  power: number;
  samples: number;
  temporal: boolean;
  contactAo: boolean;
  halfRes: boolean;
}

export interface ContactShadowSettings {
  enabled: boolean;
  opacity: number;
  scale: number;
  blur: number;
  far: number;
  characters: boolean;
  props: boolean;
  ground: boolean;
}

export interface ReflectionSettings {
  mode: ReflectionModeId;
  intensity: number;
  probeBlending: boolean;
  parallaxCorrected: boolean;
  autoProbes: boolean;
}

export interface VolumetricSettings {
  fogEnabled: boolean;
  heightFog: number;
  distanceFog: number;
  scattering: number;
  godRays: boolean;
  godRaysIntensity: number;
  lightShafts: number;
  cloudShadows: number;
}

export interface BloomSettings {
  style: BloomStyleId;
  enabled: boolean;
  intensity: number;
  threshold: number;
  radius: number;
  lensDirt: number;
}

export interface ColorPipelineSettings {
  toneMapper: ToneMapperId;
  exposure: number;
  temperature: number;
  contrast: number;
  gamma: number;
  whiteBalance: number;
  lutIntensity: number;
  /** Maps to existing ColorGradePresetId when not custom. */
  gradeAlias: ColorGradePresetId;
}

export interface MaterialPipelineSettings {
  look: MaterialLookId;
  skinEnabled: boolean;
  skinSoftness: number;
  skinBackLight: number;
  eyeWetness: number;
  hairAnisotropy: number;
  autoConvert: boolean;
}

export interface LightMixerSettings {
  sunIntensity: number;
  skyIntensity: number;
  ambientIntensity: number;
  temperature: number;
  shadowResolution: 'low' | 'medium' | 'high' | 'ultra';
  volumetrics: number;
}

export interface CameraRenderSettings {
  dof: boolean;
  bokehScale: number;
  chromaticAberration: number;
  lensDistortion: number;
  filmGrain: number;
  motionBlur: number;
  vignette: number;
  sharpen: number;
  autoExposure: boolean;
  focusTracking: boolean;
}

export interface PerformanceSettings {
  backend: RenderBackendId;
  dynamicResolution: boolean;
  temporalUpscale: boolean;
  adaptiveSampling: boolean;
  lod: boolean;
  frustumCulling: boolean;
  occlusionCulling: boolean;
  gpuInstancing: boolean;
  autoQualityScale: boolean;
}

export interface RenderPipeline2State {
  version: 2;
  enabled: boolean;
  activePreset: RenderPipeline2PresetId | 'custom';
  gi: GiSettings;
  ao: AoSettings;
  contactShadows: ContactShadowSettings;
  reflections: ReflectionSettings;
  volumetrics: VolumetricSettings;
  bloom: BloomSettings;
  color: ColorPipelineSettings;
  materials: MaterialPipelineSettings;
  lights: LightMixerSettings;
  camera: CameraRenderSettings;
  performance: PerformanceSettings;
}

export interface RenderPipeline2PresetDef {
  id: RenderPipeline2PresetId;
  label: string;
  description: string;
  patch: Partial<RenderPipeline2State>;
}
