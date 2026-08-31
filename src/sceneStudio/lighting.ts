import type { SceneComposerLights } from '../sceneComposer/types';

export type CinematicLightingPresetId =
  | 'anime_soft'
  | 'studio'
  | 'golden_hour'
  | 'sunset'
  | 'moonlight'
  | 'night'
  | 'cyberpunk'
  | 'fantasy'
  | 'warm_cinema'
  | 'cold_cinema'
  | 'high_contrast'
  | 'soft_portrait';

export interface CinematicLightingPreset {
  id: CinematicLightingPresetId;
  name: string;
  description: string;
  lights: Partial<SceneComposerLights>;
}

export const CINEMATIC_LIGHTING_PRESETS: CinematicLightingPreset[] = [
  {
    id: 'anime_soft',
    name: 'Anime Soft',
    description: 'Bright soft key with a cool, restrained rim.',
    lights: {
      characterRigEnabled: true,
      keyColor: '#fff7eb',
      keyIntensity: 0.95,
      fillColor: '#dce9ff',
      fillIntensity: 0.62,
      rimColor: '#bcd7ff',
      rimIntensity: 0.55,
      ambientIntensity: 1.05,
    },
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Neutral three-point studio illumination.',
    lights: {
      characterRigEnabled: true,
      keyColor: '#ffffff',
      keyIntensity: 1.2,
      fillColor: '#d8e4ff',
      fillIntensity: 0.5,
      rimColor: '#ffffff',
      rimIntensity: 0.8,
    },
  },
  {
    id: 'golden_hour',
    name: 'Golden Hour',
    description: 'Warm low key with cool sky fill.',
    lights: {
      characterRigEnabled: true,
      sunAzimuth: 118,
      sunElevation: 18,
      sunColor: '#ffbf79',
      sunIntensity: 1.15,
      keyColor: '#ffca8f',
      keyIntensity: 1.05,
      fillColor: '#adc7ef',
      fillIntensity: 0.32,
      rimColor: '#ff9d62',
      rimIntensity: 0.9,
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Orange edge light with a muted violet fill.',
    lights: {
      characterRigEnabled: true,
      sunAzimuth: 105,
      sunElevation: 9,
      sunColor: '#ff8b5d',
      sunIntensity: 0.9,
      keyColor: '#ff9a68',
      keyIntensity: 0.8,
      fillColor: '#706fa8',
      fillIntensity: 0.3,
      rimColor: '#ff704f',
      rimIntensity: 1.15,
    },
  },
  {
    id: 'moonlight',
    name: 'Moonlight',
    description: 'Soft blue key and silver rim.',
    lights: {
      characterRigEnabled: true,
      sunEnabled: false,
      ambientColor: '#8495bd',
      ambientIntensity: 0.35,
      keyColor: '#adc8ff',
      keyIntensity: 0.72,
      fillColor: '#556487',
      fillIntensity: 0.25,
      rimColor: '#d4e3ff',
      rimIntensity: 1.0,
    },
  },
  {
    id: 'night',
    name: 'Night',
    description: 'Low-key cool lighting with a readable silhouette.',
    lights: {
      characterRigEnabled: true,
      sunEnabled: false,
      ambientColor: '#53617f',
      ambientIntensity: 0.25,
      keyColor: '#7895c9',
      keyIntensity: 0.55,
      fillColor: '#39445f',
      fillIntensity: 0.18,
      rimColor: '#9fc2ff',
      rimIntensity: 0.9,
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Magenta key and cyan rim for neon scenes.',
    lights: {
      characterRigEnabled: true,
      keyColor: '#ff4fc8',
      keyIntensity: 1.0,
      fillColor: '#4a65ff',
      fillIntensity: 0.4,
      rimColor: '#38e8ff',
      rimIntensity: 1.25,
      ambientColor: '#30315d',
      ambientIntensity: 0.45,
    },
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Lavender key with turquoise magical edge light.',
    lights: {
      characterRigEnabled: true,
      keyColor: '#e8d0ff',
      keyIntensity: 0.9,
      fillColor: '#8ccfc8',
      fillIntensity: 0.42,
      rimColor: '#8effdb',
      rimIntensity: 1.0,
    },
  },
  {
    id: 'warm_cinema',
    name: 'Warm Cinema',
    description: 'Warm face key and subtle neutral fill.',
    lights: {
      characterRigEnabled: true,
      keyColor: '#ffd0a3',
      keyIntensity: 1.05,
      fillColor: '#b8c8db',
      fillIntensity: 0.3,
      rimColor: '#ffae75',
      rimIntensity: 0.72,
    },
  },
  {
    id: 'cold_cinema',
    name: 'Cold Cinema',
    description: 'Steel-blue key with a pale edge.',
    lights: {
      characterRigEnabled: true,
      keyColor: '#a9c8e8',
      keyIntensity: 0.95,
      fillColor: '#687c9c',
      fillIntensity: 0.28,
      rimColor: '#d8efff',
      rimIntensity: 0.85,
    },
  },
  {
    id: 'high_contrast',
    name: 'High Contrast',
    description: 'Strong key and rim with minimal fill.',
    lights: {
      characterRigEnabled: true,
      keyColor: '#fff1dc',
      keyIntensity: 1.45,
      fillEnabled: true,
      fillIntensity: 0.12,
      rimColor: '#d5e6ff',
      rimIntensity: 1.15,
      ambientIntensity: 0.28,
    },
  },
  {
    id: 'soft_portrait',
    name: 'Soft Portrait',
    description: 'Large-feeling soft key with gentle fill and hair light.',
    lights: {
      characterRigEnabled: true,
      keyColor: '#fff3e6',
      keyIntensity: 0.88,
      fillColor: '#e2eaff',
      fillIntensity: 0.58,
      rimColor: '#fff6ec',
      rimIntensity: 0.48,
      ambientIntensity: 0.75,
    },
  },
];

export function applyCinematicLightingPreset(
  current: SceneComposerLights,
  id: CinematicLightingPresetId
): SceneComposerLights {
  const preset = CINEMATIC_LIGHTING_PRESETS.find((item) => item.id === id);
  if (!preset) return current;
  return {
    ...current,
    keyEnabled: true,
    fillEnabled: true,
    rimEnabled: true,
    ...preset.lights,
  };
}
