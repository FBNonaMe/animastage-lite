/**
 * AnimaStage Render Pipeline 3.0 — cinematic anime render control plane.
 * Extends RP2; renderer-agnostic; WebGL / WebGPU consume resolved budgets.
 */
import type {
  AoModeId,
  BloomStyleId,
  CameraRenderSettings,
  ColorPipelineSettings,
  ContactShadowSettings,
  GiModeId,
  GiQualityPreset,
  LightMixerSettings,
  MaterialLookId,
  MaterialPipelineSettings,
  PerformanceSettings,
  ReflectionModeId,
  ReflectionSettings,
  RenderBackendId,
  ToneMapperId,
  VolumetricSettings,
  GiSettings,
  AoSettings,
  BloomSettings,
} from '../renderPipeline2/types';
import type { ColorGradePresetId, ParticlePresetId, WeatherPresetId } from '../types';

export type {
  AoModeId,
  BloomStyleId,
  GiModeId,
  GiQualityPreset,
  MaterialLookId,
  ReflectionModeId,
  RenderBackendId,
  ToneMapperId,
};

export type RenderPipeline3PresetId =
  | 'classic_mmd'
  | 'anime'
  | 'studio'
  | 'photoreal'
  | 'cinematic'
  | 'fantasy'
  | 'cyberpunk'
  | 'golden_hour'
  | 'night'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'sunset';

export type WeatherModeId = WeatherPresetId;

export type ProbeSceneId =
  | 'indoor'
  | 'outdoor'
  | 'room'
  | 'street'
  | 'forest'
  | 'temple'
  | 'auto';

export type TaaModeId = 'off' | 'smaa' | 'taa' | 'txaa';

export type LensFocalId = '24mm' | '35mm' | '50mm' | '85mm' | '135mm' | 'ortho';

export type LightCookieId =
  | 'none'
  | 'window'
  | 'leaves'
  | 'church'
  | 'curtains'
  | 'custom';

export type MaterialLibraryId =
  | 'anime_skin'
  | 'metal'
  | 'wood'
  | 'concrete'
  | 'fabric'
  | 'leather'
  | 'plastic'
  | 'glass'
  | 'water'
  | 'stone';

export type RenderPassId =
  | 'beauty'
  | 'ao'
  | 'shadow'
  | 'reflection'
  | 'emission'
  | 'depth'
  | 'normal'
  | 'object_id'
  | 'mask'
  | 'alpha';

export type RenderGraphNodeId =
  | 'sky'
  | 'gi'
  | 'ao'
  | 'lighting'
  | 'materials'
  | 'bloom'
  | 'lut'
  | 'tone'
  | 'output';

export interface WeatherSettings {
  mode: WeatherModeId;
  intensity: number;
  wetGround: number;
  rainRipples: number;
  snowAccumulation: number;
  wind: number;
  thunder: boolean;
  cloudCover: number;
}

export interface WaterSettings {
  enabled: boolean;
  reflection: number;
  refraction: number;
  foam: number;
  waves: number;
  caustics: number;
  shoreFade: number;
}

export interface GpuParticleSettings {
  enabled: boolean;
  preset: ParticlePresetId | 'leaves' | 'smoke' | 'fire' | 'magic';
  count: number;
  intensity: number;
}

export interface VegetationSettings {
  enabled: boolean;
  density: number;
  wind: number;
  grass: boolean;
  trees: boolean;
  flowers: boolean;
}

export interface EnvironmentProbeSettings {
  enabled: boolean;
  scene: ProbeSceneId;
  blending: boolean;
  count: number;
  intensity: number;
}

export interface TaaSettings {
  mode: TaaModeId;
  stabilizeHair: boolean;
  stabilizeOutline: boolean;
  historyWeight: number;
}

export interface LensSettings {
  focal: LensFocalId;
  cookie: LightCookieId;
  cookieIntensity: number;
}

export interface RenderPassSettings {
  /** Passes enabled for export / debug capture. */
  enabled: RenderPassId[];
}

export interface RenderGraphSettings {
  /** Ordered active nodes (live preview uses enabled flags). */
  nodes: RenderGraphNodeId[];
  sky: boolean;
  gi: boolean;
  ao: boolean;
  lighting: boolean;
  materials: boolean;
  bloom: boolean;
  lut: boolean;
  tone: boolean;
}

export interface ValidatorSettings {
  enabled: boolean;
  autoFixOnPreset: boolean;
}

export interface RenderPipeline3State {
  version: 3;
  enabled: boolean;
  activePreset: RenderPipeline3PresetId | 'custom';
  /** Core look — same contract as RP2 for shared passes. */
  gi: GiSettings;
  ao: AoSettings;
  contactShadows: ContactShadowSettings;
  reflections: ReflectionSettings;
  volumetrics: VolumetricSettings;
  bloom: BloomSettings;
  color: ColorPipelineSettings;
  materials: MaterialPipelineSettings & {
    library: MaterialLibraryId;
  };
  lights: LightMixerSettings & {
    moonIntensity: number;
  };
  camera: CameraRenderSettings;
  performance: PerformanceSettings;
  weather: WeatherSettings;
  water: WaterSettings;
  particles: GpuParticleSettings;
  vegetation: VegetationSettings;
  probes: EnvironmentProbeSettings;
  taa: TaaSettings;
  lens: LensSettings;
  passes: RenderPassSettings;
  graph: RenderGraphSettings;
  validator: ValidatorSettings;
}

export interface RenderPipeline3PresetDef {
  id: RenderPipeline3PresetId;
  label: string;
  description: string;
  patch: Partial<RenderPipeline3State>;
}

export type { ColorGradePresetId };
