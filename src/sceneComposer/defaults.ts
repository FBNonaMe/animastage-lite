import type { SceneComposerLights, SceneComposerState } from './types';

export const DEFAULT_SCENE_COMPOSER_LIGHTS: SceneComposerLights = {
  sunEnabled: true,
  sunAzimuth: 135,
  sunElevation: 42,
  sunColor: '#fff8f0',
  sunIntensity: 1,
  sunShadows: true,
  ambientEnabled: true,
  ambientColor: '#d8e4ff',
  ambientIntensity: 1,
  hemisphereEnabled: true,
  hemisphereIntensity: 1,
  characterRigEnabled: false,
  keyEnabled: true,
  keyColor: '#fff1df',
  keyIntensity: 1.15,
  fillEnabled: true,
  fillColor: '#c8dcff',
  fillIntensity: 0.45,
  rimEnabled: true,
  rimColor: '#d9e6ff',
  rimIntensity: 0.85,
};

/** Merge older saved projects that lack Key/Fill/Rim fields. */
export function normalizeSceneComposerLights(
  lights?: Partial<SceneComposerLights> | null
): SceneComposerLights {
  return { ...DEFAULT_SCENE_COMPOSER_LIGHTS, ...(lights ?? {}) };
}

export const DEFAULT_SCENE_COMPOSER: SceneComposerState = {
  lights: { ...DEFAULT_SCENE_COMPOSER_LIGHTS },
  skyPreset: 'blue',
  bgMode: 'scene',
  bgCustomColor: '#141820',
  presetPreviewSource: 'model',
  visualStyle: 'realistic',
  materialOverride: 'default',
  effectLevels: {
    bloom: 'off',
    glow: 'off',
    outline: 'off',
    rim: 'off',
    dof: 'off',
    ao: 'off',
    sss: 'off',
    reflection: 'off',
  },
  exposure: 0.9,
  brightness: 1,
  contrast: 1.04,
  saturation: 1,
  temperature: 0,
  tint: 0,
  gamma: 1,
  fogEnabled: false,
  fogDensity: 0.35,
  fogColor: '#c8d8f0',
  windStrength: 0,
  envBrightness: 0.72,
};

export function sunPositionFromAngles(
  azimuthDeg: number,
  elevationDeg: number,
  radius = 25
): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (Math.max(5, elevationDeg) * Math.PI) / 180;
  return [
    radius * Math.cos(el) * Math.sin(az),
    radius * Math.sin(el),
    radius * Math.cos(el) * Math.cos(az),
  ];
}

/** Map time-of-day from sun elevation for sky tint hints. */
export function skyHintFromSun(elevationDeg: number): 'day' | 'golden' | 'dusk' | 'night' {
  if (elevationDeg >= 35) return 'day';
  if (elevationDeg >= 15) return 'golden';
  if (elevationDeg >= 5) return 'dusk';
  return 'night';
}
