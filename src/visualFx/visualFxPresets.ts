import type {
  ColorGradePresetId,
  LightPresetId,
  LookPresetId,
  ParticlePresetId,
  ScenePresetId,
  VisualFxSettings,
} from '../types';

export type DreiEnvironmentPreset =
  | 'apartment'
  | 'city'
  | 'dawn'
  | 'forest'
  | 'lobby'
  | 'night'
  | 'park'
  | 'studio'
  | 'sunset'
  | 'warehouse';

export interface ScenePresetConfig {
  id: ScenePresetId;
  label: string;
  background: string;
  environment: DreiEnvironmentPreset;
  showEnvironmentBackground: boolean;
  fog?: { color: string; near: number; far: number };
  floorColor: string;
  floorMetalness: number;
  floorRoughness: number;
}

export interface LightPresetConfig {
  id: LightPresetId;
  label: string;
  ambient: { intensity: number; color: string };
  key: { position: [number, number, number]; intensity: number; color: string; castShadow: boolean };
  fill: { position: [number, number, number]; intensity: number; color: string };
  rim?: { position: [number, number, number]; intensity: number; color: string };
  spot?: {
    position: [number, number, number];
    intensity: number;
    color: string;
    angle: number;
    penumbra: number;
  };
  hemisphere: { intensity: number; sky: string; ground: string };
}

export interface ColorGradeConfig {
  id: ColorGradePresetId;
  label: string;
  hue: number;
  saturation: number;
  brightness: number;
  contrast: number;
  sepia?: number;
}

export interface LookPresetConfig {
  id: LookPresetId;
  label: string;
  description: string;
  patch: Partial<VisualFxSettings>;
}

/** New projects: effects off — user enables Bloom / DOF / SSAO / weather manually (RP4). */
export const DEFAULT_VISUAL_FX: VisualFxSettings = {
  bloomEnabled: false,
  bloomIntensity: 0.42,
  bloomThreshold: 0.48,
  vignetteEnabled: false,
  vignetteIntensity: 0.45,
  dofEnabled: false,
  dofFocusDistance: 0.02,
  dofBokehScale: 2.4,
  chromaticAberration: 0,
  colorGrade: 'neutral',
  scenePreset: 'studio',
  lightPreset: 'natural',
  particlesEnabled: false,
  particlePreset: 'sparkles',
  particleIntensity: 0.65,
  environmentIntensity: 0.72,
  floorReflection: 0.78,
  aoIntensity: 4.2,
  weatherPreset: 'clear',
  precipIntensity: 0,
  wetness: 0,
  snowGround: 0,
  postFxStackEnabled: true,
  ssaoEnabled: false,
  ssaoIntensity: 1.05,
  ssaoRadius: 0.32,
  ssaoHalfRes: true,
  smaaEnabled: true,
  godRaysEnabled: false,
  godRaysSamples: 24,
  godRaysDensity: 0.65,
  godRaysDecay: 0.94,
  bloomRadius: 0.35,
  letterbox239: false,
  materialDetailing: true,
  materialSmoothing: 0.55,
  renderMode: 'asrp',
  customLutUrl: null,
  customLutName: null,
  customLutIntensity: 1,
  customLutEnabled: false,
  postFxStackOrder: 'bloom_then_grade',
  rayMmdColorGrade: undefined,
  rayMmdBloom: undefined,
  rayMmdSsr: undefined,
  rayMmdVignette: undefined,
  rayMmdLens: undefined,
  animeNpr: undefined,
};

export const SCENE_PRESETS: Record<ScenePresetId, ScenePresetConfig> = {
  studio: {
    id: 'studio',
    label: 'Studio',
    background: '#141820',
    environment: 'studio',
    showEnvironmentBackground: false,
    floorColor: '#141820',
    floorMetalness: 0.35,
    floorRoughness: 0.85,
  },
  warehouse: {
    id: 'warehouse',
    label: 'Warehouse',
    background: '#0e1018',
    environment: 'warehouse',
    showEnvironmentBackground: false,
    floorColor: '#121620',
    floorMetalness: 0.42,
    floorRoughness: 0.78,
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    background: '#2a1838',
    environment: 'sunset',
    showEnvironmentBackground: false,
    fog: { color: '#3d2848', near: 18, far: 90 },
    floorColor: '#1a1420',
    floorMetalness: 0.28,
    floorRoughness: 0.9,
  },
  nightclub: {
    id: 'nightclub',
    label: 'Nightclub',
    background: '#08040f',
    environment: 'night',
    showEnvironmentBackground: false,
    fog: { color: '#120818', near: 12, far: 55 },
    floorColor: '#0a0612',
    floorMetalness: 0.55,
    floorRoughness: 0.55,
  },
  cyber: {
    id: 'cyber',
    label: 'Cyber City',
    background: '#060818',
    environment: 'city',
    showEnvironmentBackground: false,
    fog: { color: '#0a1028', near: 20, far: 80 },
    floorColor: '#0c1020',
    floorMetalness: 0.62,
    floorRoughness: 0.45,
  },
  stage: {
    id: 'stage',
    label: 'Concert Stage',
    background: '#0a0810',
    environment: 'lobby',
    showEnvironmentBackground: false,
    floorColor: '#181018',
    floorMetalness: 0.48,
    floorRoughness: 0.62,
  },
  outdoor: {
    id: 'outdoor',
    label: 'Outdoor Park',
    background: '#b8d4f0',
    environment: 'park',
    showEnvironmentBackground: false,
    fog: { color: '#c8dcf0', near: 35, far: 120 },
    floorColor: '#2a3828',
    floorMetalness: 0.08,
    floorRoughness: 0.95,
  },
};

export const LIGHT_PRESETS: Record<LightPresetId, LightPresetConfig> = {
  natural: {
    id: 'natural',
    label: 'Natural',
    ambient: { intensity: 0.75, color: '#d8e4ff' },
    key: { position: [10, 20, 10], intensity: 3.0, color: '#fff8f0', castShadow: true },
    fill: { position: [-8, 12, -6], intensity: 1.4, color: '#c8d8ff' },
    hemisphere: { intensity: 0.75, sky: '#e8f0ff', ground: '#181820' },
  },
  rim: {
    id: 'rim',
    label: 'Rim Light',
    ambient: { intensity: 0.55, color: '#c8d0ff' },
    key: { position: [8, 14, 14], intensity: 2.4, color: '#fff4e8', castShadow: true },
    fill: { position: [-6, 8, 8], intensity: 0.9, color: '#8898c8' },
    rim: { position: [0, 10, -18], intensity: 2.8, color: '#7ec8ff' },
    hemisphere: { intensity: 0.6, sky: '#dce8ff', ground: '#101018' },
  },
  concert: {
    id: 'concert',
    label: 'Concert',
    ambient: { intensity: 0.35, color: '#8060a0' },
    key: { position: [0, 24, 6], intensity: 3.8, color: '#ffe8d0', castShadow: true },
    fill: { position: [-12, 10, 4], intensity: 1.1, color: '#ff6090' },
    rim: { position: [14, 8, -8], intensity: 2.2, color: '#6090ff' },
    spot: {
      position: [-14, 22, 10],
      intensity: 1.8,
      color: '#ffe4c4',
      angle: 0.42,
      penumbra: 0.85,
    },
    hemisphere: { intensity: 0.45, sky: '#403060', ground: '#080810' },
  },
  spotlight: {
    id: 'spotlight',
    label: 'Spotlight',
    ambient: { intensity: 0.25, color: '#9090a8' },
    key: { position: [2, 28, 4], intensity: 4.5, color: '#fffaf0', castShadow: true },
    fill: { position: [-10, 6, 12], intensity: 0.35, color: '#6878a0' },
    spot: {
      position: [0, 26, 2],
      intensity: 2.4,
      color: '#ffffff',
      angle: 0.28,
      penumbra: 0.72,
    },
    hemisphere: { intensity: 0.3, sky: '#202030', ground: '#080810' },
  },
  neon: {
    id: 'neon',
    label: 'Neon',
    ambient: { intensity: 0.42, color: '#8040c0' },
    key: { position: [6, 16, 10], intensity: 2.6, color: '#e0f8ff', castShadow: true },
    fill: { position: [-10, 8, -4], intensity: 1.8, color: '#ff40a0' },
    rim: { position: [0, 6, -16], intensity: 2.5, color: '#40e0ff' },
    hemisphere: { intensity: 0.55, sky: '#6020a0', ground: '#100818' },
  },
  anime: {
    id: 'anime',
    label: 'Anime',
    ambient: { intensity: 1.1, color: '#f0f4ff' },
    key: { position: [12, 18, 8], intensity: 2.8, color: '#fff8ff', castShadow: true },
    fill: { position: [-10, 10, 6], intensity: 1.6, color: '#ffd8f0' },
    rim: { position: [-4, 12, -14], intensity: 1.4, color: '#a0d0ff' },
    hemisphere: { intensity: 0.85, sky: '#f0e8ff', ground: '#504060' },
  },
};

export const COLOR_GRADES: Record<ColorGradePresetId, ColorGradeConfig> = {
  neutral: { id: 'neutral', label: 'Neutral', hue: 0, saturation: 0, brightness: 0, contrast: 0 },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    hue: 0.02,
    saturation: 0.12,
    brightness: -0.04,
    contrast: 0.18,
  },
  anime: {
    id: 'anime',
    label: 'Anime',
    hue: -0.04,
    saturation: 0.35,
    brightness: 0.06,
    contrast: 0.12,
  },
  vaporwave: {
    id: 'vaporwave',
    label: 'Vaporwave',
    hue: 0.12,
    saturation: 0.42,
    brightness: 0.02,
    contrast: 0.08,
    sepia: 0.08,
  },
  warm: {
    id: 'warm',
    label: 'Warm Gold',
    hue: 0.06,
    saturation: 0.22,
    brightness: 0.04,
    contrast: 0.1,
  },
  cold: {
    id: 'cold',
    label: 'Cold Blue',
    hue: -0.08,
    saturation: 0.18,
    brightness: -0.02,
    contrast: 0.14,
  },
  noir: {
    id: 'noir',
    label: 'Noir',
    hue: 0,
    saturation: -0.55,
    brightness: -0.08,
    contrast: 0.28,
    sepia: 0.18,
  },
  filmic: {
    id: 'filmic',
    label: 'Filmic',
    hue: 0.01,
    saturation: -0.06,
    brightness: -0.02,
    contrast: 0.14,
  },
  high_contrast: {
    id: 'high_contrast',
    label: 'High Contrast',
    hue: 0,
    saturation: 0.08,
    brightness: -0.03,
    contrast: 0.32,
  },
  soft: {
    id: 'soft',
    label: 'Soft',
    hue: 0.02,
    saturation: 0.06,
    brightness: 0.05,
    contrast: -0.06,
  },
};

export const LOOK_PRESETS: LookPresetConfig[] = [
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'RTX · warehouse · rim light · DOF · warm grade',
    patch: {
      bloomEnabled: true,
      bloomIntensity: 0.52,
      bloomThreshold: 0.42,
      vignetteEnabled: true,
      vignetteIntensity: 0.5,
      dofEnabled: true,
      dofFocusDistance: 0.018,
      dofBokehScale: 2.8,
      chromaticAberration: 0.0012,
      colorGrade: 'cinematic',
      scenePreset: 'warehouse',
      lightPreset: 'rim',
      particlesEnabled: false,
      environmentIntensity: 0.68,
      floorReflection: 0.82,
      aoIntensity: 4.4,
    },
  },
  {
    id: 'anime',
    label: 'Anime',
    description: 'Bright studio · soft bloom · sparkles',
    patch: {
      bloomEnabled: true,
      bloomIntensity: 0.58,
      bloomThreshold: 0.48,
      vignetteEnabled: false,
      dofEnabled: false,
      chromaticAberration: 0,
      colorGrade: 'anime',
      scenePreset: 'studio',
      lightPreset: 'anime',
      particlesEnabled: true,
      particlePreset: 'sparkles',
      particleIntensity: 0.55,
      environmentIntensity: 0.85,
      floorReflection: 0.65,
    },
  },
  {
    id: 'neon_club',
    label: 'Neon Club',
    description: 'Nightclub · neon lights · confetti · strong bloom',
    patch: {
      bloomEnabled: true,
      bloomIntensity: 0.72,
      bloomThreshold: 0.35,
      vignetteEnabled: true,
      vignetteIntensity: 0.55,
      dofEnabled: false,
      chromaticAberration: 0.002,
      colorGrade: 'vaporwave',
      scenePreset: 'nightclub',
      lightPreset: 'neon',
      particlesEnabled: true,
      particlePreset: 'confetti',
      particleIntensity: 0.85,
      environmentIntensity: 0.55,
      floorReflection: 0.88,
    },
  },
  {
    id: 'portrait',
    label: 'Portrait',
    description: 'Soft DOF · sunset · warm grade',
    patch: {
      bloomEnabled: true,
      bloomIntensity: 0.38,
      bloomThreshold: 0.52,
      vignetteEnabled: true,
      vignetteIntensity: 0.42,
      dofEnabled: true,
      dofFocusDistance: 0.015,
      dofBokehScale: 3.2,
      chromaticAberration: 0.0008,
      colorGrade: 'warm',
      scenePreset: 'sunset',
      lightPreset: 'rim',
      particlesEnabled: true,
      particlePreset: 'petals',
      particleIntensity: 0.4,
      environmentIntensity: 0.75,
      floorReflection: 0.7,
    },
  },
  {
    id: 'concert',
    label: 'Concert',
    description: 'Stage · spotlights · dust particles',
    patch: {
      bloomEnabled: true,
      bloomIntensity: 0.62,
      bloomThreshold: 0.4,
      vignetteEnabled: true,
      vignetteIntensity: 0.48,
      dofEnabled: false,
      colorGrade: 'cinematic',
      scenePreset: 'stage',
      lightPreset: 'concert',
      particlesEnabled: true,
      particlePreset: 'dust',
      particleIntensity: 0.5,
      environmentIntensity: 0.62,
      floorReflection: 0.85,
      aoIntensity: 4.6,
    },
  },
  {
    id: 'cyber',
    label: 'Cyber',
    description: 'City night · cold grade · fireflies',
    patch: {
      bloomEnabled: true,
      bloomIntensity: 0.55,
      bloomThreshold: 0.44,
      vignetteEnabled: true,
      vignetteIntensity: 0.38,
      chromaticAberration: 0.0018,
      colorGrade: 'cold',
      scenePreset: 'cyber',
      lightPreset: 'neon',
      particlesEnabled: true,
      particlePreset: 'fireflies',
      particleIntensity: 0.6,
      environmentIntensity: 0.7,
      floorReflection: 0.9,
    },
  },
];

export const PARTICLE_PRESET_LABELS: Record<ParticlePresetId, string> = {
  none: 'None',
  snow: 'Snow',
  sparkles: 'Sparkles',
  petals: 'Petals',
  confetti: 'Confetti',
  dust: 'Dust',
  fireflies: 'Fireflies',
};

export function getScenePreset(id: ScenePresetId): ScenePresetConfig {
  return SCENE_PRESETS[id] ?? SCENE_PRESETS.studio;
}

export function getLightPreset(id: LightPresetId): LightPresetConfig {
  return LIGHT_PRESETS[id] ?? LIGHT_PRESETS.natural;
}

export function getColorGrade(id: ColorGradePresetId): ColorGradeConfig {
  return COLOR_GRADES[id] ?? COLOR_GRADES.neutral;
}

export function applyLookPreset(id: LookPresetId): VisualFxSettings {
  const look = LOOK_PRESETS.find((p) => p.id === id);
  if (!look) return { ...DEFAULT_VISUAL_FX };
  return { ...DEFAULT_VISUAL_FX, ...look.patch };
}

export function isCinematicVisualsActive(
  visualFx: VisualFxSettings,
  rtxActive: boolean
): boolean {
  if (rtxActive) return true;
  return (
    visualFx.bloomEnabled ||
    visualFx.scenePreset !== 'studio' ||
    visualFx.colorGrade !== 'neutral' ||
    visualFx.particlesEnabled ||
    visualFx.dofEnabled ||
    visualFx.vignetteEnabled ||
    visualFx.chromaticAberration > 0 ||
    visualFx.lightPreset !== 'natural'
  );
}

export function hasPostProcessing(visualFx: VisualFxSettings, ultraPhoto: boolean): boolean {
  if (ultraPhoto) return true;
  return (
    visualFx.bloomEnabled ||
    visualFx.vignetteEnabled ||
    visualFx.dofEnabled ||
    visualFx.colorGrade !== 'neutral' ||
    visualFx.chromaticAberration > 0
  );
}
