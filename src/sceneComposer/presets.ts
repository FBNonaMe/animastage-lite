import type { VisualFxSettings } from '../types';
import type {
  ComposerPresetId,
  ComposerVisualStyleId,
  SceneComposerState,
} from './types';
import { DEFAULT_SCENE_COMPOSER } from './defaults';

export interface ComposerPresetDef {
  id: ComposerPresetId;
  label: string;
  visualFx: Partial<VisualFxSettings>;
  composer?: Partial<SceneComposerState>;
}

export const COMPOSER_PRESETS: ComposerPresetDef[] = [
  {
    id: 'studio',
    label: 'Studio',
    visualFx: {
      scenePreset: 'studio',
      lightPreset: 'natural',
      colorGrade: 'neutral',
      bloomEnabled: false,
      ssaoEnabled: true,
      ssaoIntensity: 0.95,
      particlesEnabled: false,
      weatherPreset: 'clear',
      environmentIntensity: 0.68,
      toneExposure: 0.9,
    },
    composer: {
      skyPreset: 'blue',
      bgMode: 'scene',
      visualStyle: 'realistic',
      materialOverride: 'studio',
      effectLevels: { bloom: 'off', ao: 'medium', reflection: 'high', dof: 'off' },
    },
  },
  {
    id: 'golden_hour',
    label: 'Golden Hour',
    visualFx: {
      scenePreset: 'sunset',
      lightPreset: 'natural',
      colorGrade: 'warm',
      bloomEnabled: true,
      bloomIntensity: 0.22,
      toneExposure: 0.88,
      weatherPreset: 'clear',
      ssaoEnabled: true,
      environmentIntensity: 0.78,
    },
    composer: {
      skyPreset: 'sunset',
      sunElevation: 18,
      sunAzimuth: 250,
      sunColor: '#ffd4a8',
      visualStyle: 'realistic',
      exposure: 0.88,
      temperature: 0.22,
      saturation: 1.05,
      effectLevels: { bloom: 'low', ao: 'medium', reflection: 'medium' },
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    visualFx: {
      scenePreset: 'sunset',
      lightPreset: 'natural',
      colorGrade: 'warm',
      bloomEnabled: true,
      bloomIntensity: 0.28,
      weatherPreset: 'clear',
      ssaoEnabled: true,
      toneExposure: 0.86,
    },
    composer: {
      skyPreset: 'sunset',
      sunElevation: 12,
      sunColor: '#ffb080',
      visualStyle: 'realistic',
      effectLevels: { bloom: 'low', ao: 'medium' },
    },
  },
  {
    id: 'night',
    label: 'Night',
    visualFx: {
      scenePreset: 'nightclub',
      lightPreset: 'rim',
      colorGrade: 'cold',
      bloomEnabled: true,
      bloomIntensity: 0.18,
      weatherPreset: 'clear',
      ssaoEnabled: true,
      toneExposure: 0.78,
      environmentIntensity: 0.42,
    },
    composer: {
      skyPreset: 'night',
      sunElevation: 8,
      sunColor: '#8090c0',
      visualStyle: 'realistic',
      effectLevels: { bloom: 'low', ao: 'medium' },
    },
  },
  {
    id: 'moonlight',
    label: 'Moonlight',
    visualFx: {
      scenePreset: 'nightclub',
      lightPreset: 'natural',
      colorGrade: 'cold',
      bloomEnabled: false,
      toneExposure: 0.8,
      weatherPreset: 'clear',
      ssaoEnabled: true,
      environmentIntensity: 0.38,
    },
    composer: {
      skyPreset: 'night',
      visualStyle: 'realistic',
      lights: {
        sunElevation: 55,
        sunColor: '#a8c8ff',
        sunIntensity: 0.65,
        ambientIntensity: 0.55,
      },
    },
  },
  {
    id: 'temple',
    label: 'Temple',
    visualFx: {
      scenePreset: 'outdoor',
      lightPreset: 'natural',
      colorGrade: 'warm',
      bloomEnabled: false,
      weatherPreset: 'clear',
      ssaoEnabled: true,
      environmentIntensity: 0.72,
    },
    composer: { skyPreset: 'cloudy', visualStyle: 'realistic', fogEnabled: true, fogDensity: 0.12 },
  },
  {
    id: 'forest',
    label: 'Forest',
    visualFx: {
      scenePreset: 'outdoor',
      lightPreset: 'natural',
      colorGrade: 'neutral',
      particlesEnabled: false,
      weatherPreset: 'clear',
      ssaoEnabled: true,
      environmentIntensity: 0.65,
    },
    composer: {
      skyPreset: 'blue',
      fogEnabled: true,
      fogDensity: 0.22,
      fogColor: '#a8c4a0',
      visualStyle: 'realistic',
      saturation: 0.95,
    },
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    visualFx: {
      scenePreset: 'cyber',
      lightPreset: 'neon',
      colorGrade: 'vaporwave',
      bloomEnabled: true,
      bloomIntensity: 0.42,
      weatherPreset: 'rain',
      precipIntensity: 0.35,
      ssaoEnabled: true,
    },
    composer: { skyPreset: 'cyber', visualStyle: 'cyberpunk', saturation: 1.12 },
  },
  {
    id: 'sci_fi',
    label: 'Sci-Fi',
    visualFx: {
      scenePreset: 'cyber',
      lightPreset: 'spotlight',
      colorGrade: 'cold',
      bloomEnabled: true,
      bloomIntensity: 0.25,
      ssaoEnabled: true,
      ssaoIntensity: 1.1,
      environmentIntensity: 0.55,
    },
    composer: { skyPreset: 'cyber', visualStyle: 'realistic', effectLevels: { ao: 'high' } },
  },
  {
    id: 'concert',
    label: 'Concert',
    visualFx: {
      scenePreset: 'stage',
      lightPreset: 'concert',
      colorGrade: 'neutral',
      bloomEnabled: true,
      bloomIntensity: 0.32,
      particlesEnabled: true,
      particlePreset: 'sparkles',
      ssaoEnabled: true,
    },
    composer: { visualStyle: 'realistic', envBrightness: 0.82, effectLevels: { bloom: 'low' } },
  },
  {
    id: 'dream',
    label: 'Dream',
    visualFx: {
      scenePreset: 'sunset',
      lightPreset: 'rim',
      colorGrade: 'warm',
      bloomEnabled: true,
      bloomIntensity: 0.24,
      dofEnabled: true,
      particlesEnabled: true,
      particlePreset: 'petals',
      ssaoEnabled: true,
    },
    composer: {
      skyPreset: 'fantasy',
      visualStyle: 'soft_anime',
      fogEnabled: true,
      fogDensity: 0.18,
      effectLevels: { dof: 'low', bloom: 'low' },
    },
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    visualFx: {
      scenePreset: 'outdoor',
      lightPreset: 'natural',
      colorGrade: 'anime',
      bloomEnabled: true,
      bloomIntensity: 0.26,
      particlesEnabled: true,
      particlePreset: 'fireflies',
      ssaoEnabled: true,
    },
    composer: { skyPreset: 'fantasy', visualStyle: 'fantasy' },
  },
  {
    id: 'anime_street',
    label: 'Anime Street',
    visualFx: {
      scenePreset: 'cyber',
      lightPreset: 'anime',
      colorGrade: 'anime',
      bloomEnabled: true,
      bloomIntensity: 0.38,
      weatherPreset: 'clear',
      ssaoEnabled: true,
    },
    composer: { skyPreset: 'blue', visualStyle: 'anime' },
  },
  {
    id: 'beach',
    label: 'Beach',
    visualFx: {
      scenePreset: 'outdoor',
      lightPreset: 'natural',
      colorGrade: 'warm',
      bloomEnabled: true,
      bloomIntensity: 0.18,
      toneExposure: 1,
      weatherPreset: 'clear',
      ssaoEnabled: true,
      environmentIntensity: 0.85,
    },
    composer: {
      skyPreset: 'blue',
      sunElevation: 58,
      sunColor: '#fff4e0',
      exposure: 1,
      visualStyle: 'realistic',
      effectLevels: { bloom: 'low', reflection: 'high' },
    },
  },
  {
    id: 'indoor',
    label: 'Indoor',
    visualFx: {
      scenePreset: 'warehouse',
      lightPreset: 'spotlight',
      colorGrade: 'neutral',
      bloomEnabled: false,
      environmentIntensity: 0.52,
      ssaoEnabled: true,
    },
    composer: { bgMode: 'scene', visualStyle: 'realistic', envBrightness: 0.55 },
  },
  {
    id: 'outdoor',
    label: 'Outdoor',
    visualFx: {
      scenePreset: 'outdoor',
      lightPreset: 'natural',
      colorGrade: 'neutral',
      bloomEnabled: false,
      weatherPreset: 'clear',
      ssaoEnabled: true,
      ssaoIntensity: 1.05,
      environmentIntensity: 0.78,
      toneExposure: 0.92,
    },
    composer: {
      skyPreset: 'blue',
      visualStyle: 'realistic',
      effectLevels: { ao: 'medium', reflection: 'medium' },
    },
  },
];

export function getComposerPreset(id: ComposerPresetId): ComposerPresetDef {
  return COMPOSER_PRESETS.find((p) => p.id === id) ?? COMPOSER_PRESETS[0]!;
}

export const VISUAL_STYLE_PATCHES: Record<
  ComposerVisualStyleId,
  { label: string; visualFx: Partial<VisualFxSettings>; composer?: Partial<SceneComposerState> }
> = {
  default: { label: 'Default', visualFx: {} },
  anime: {
    label: 'Anime',
    visualFx: {
      lightPreset: 'anime',
      colorGrade: 'anime',
      bloomEnabled: true,
      bloomIntensity: 0.45,
      materialDetailing: true,
    },
    composer: { saturation: 1.12, contrast: 1.05 },
  },
  soft_anime: {
    label: 'Soft Anime',
    visualFx: {
      lightPreset: 'rim',
      colorGrade: 'anime',
      bloomEnabled: true,
      bloomIntensity: 0.32,
      materialSmoothing: 0.65,
    },
    composer: { saturation: 0.95, exposure: 0.92 },
  },
  fantasy: {
    label: 'Fantasy',
    visualFx: {
      lightPreset: 'anime',
      colorGrade: 'anime',
      bloomEnabled: true,
      bloomIntensity: 0.4,
      particlesEnabled: true,
      particlePreset: 'fireflies',
    },
  },
  cyberpunk: {
    label: 'Cyberpunk',
    visualFx: {
      scenePreset: 'cyber',
      lightPreset: 'neon',
      colorGrade: 'vaporwave',
      bloomEnabled: true,
      bloomIntensity: 0.58,
    },
  },
  studio: {
    label: 'Studio',
    visualFx: {
      scenePreset: 'studio',
      lightPreset: 'natural',
      bloomEnabled: false,
      colorGrade: 'neutral',
    },
  },
  realistic: {
    label: 'Realistic',
    visualFx: {
      lightPreset: 'natural',
      colorGrade: 'neutral',
      bloomEnabled: false,
      ssaoEnabled: true,
      ssaoIntensity: 1.15,
      materialDetailing: true,
      environmentIntensity: 0.78,
      floorReflection: 0.68,
      toneExposure: 0.9,
      materialSmoothing: 0.58,
    },
    composer: {
      saturation: 1,
      contrast: 1.06,
      exposure: 0.9,
      effectLevels: { bloom: 'off', ao: 'medium', reflection: 'high', rim: 'low' },
      materialOverride: 'default',
    },
  },
  comic: {
    label: 'Comic',
    visualFx: {
      lightPreset: 'spotlight',
      colorGrade: 'anime',
      bloomEnabled: false,
      materialSmoothing: 0.35,
    },
    composer: { contrast: 1.2, saturation: 1.2 },
  },
  sketch: {
    label: 'Sketch',
    visualFx: {
      lightPreset: 'natural',
      colorGrade: 'neutral',
      bloomEnabled: false,
      vignetteEnabled: true,
      vignetteIntensity: 0.35,
      materialSmoothing: 0.25,
    },
  },
};

export function mergeComposerPreset(
  preset: ComposerPresetDef,
  baseComposer: SceneComposerState = DEFAULT_SCENE_COMPOSER
): SceneComposerState {
  const c = preset.composer ?? {};
  const flat = c as Partial<SceneComposerState> & {
    sunAzimuth?: number;
    sunElevation?: number;
    sunColor?: string;
  };
  return {
    ...baseComposer,
    ...c,
    lights: {
      ...baseComposer.lights,
      ...(c.lights ?? {}),
      ...(flat.sunAzimuth != null ? { sunAzimuth: flat.sunAzimuth } : {}),
      ...(flat.sunElevation != null ? { sunElevation: flat.sunElevation } : {}),
      ...(flat.sunColor != null ? { sunColor: flat.sunColor } : {}),
    },
  };
}
