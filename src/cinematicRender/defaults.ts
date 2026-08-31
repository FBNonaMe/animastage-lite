import type { CinematicRenderState } from './types';

export const DEFAULT_CINEMATIC_RENDER: CinematicRenderState = {
  enabled: true,
  qualityPreset: 'balanced',
  sunTime: 'noon',
  weather: 'clear',
  renderStyle: 'anime',
  sunIntensity: 1,
  sunColorTempK: 5600,
  softShadows: true,
  contactShadows: true,
  atmosphericScattering: true,
  lightShafts: false,
  volumetricFog: false,
  autoExportQuality: true,
};

/** Approximate kelvin → warm/cool hex for sun tint. */
export function colorTempToHex(kelvin: number): string {
  const k = Math.max(2000, Math.min(12000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;

  if (k <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(k) - 161.1195681661));
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(k - 60, -0.1332047592)));
    g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(k - 60, -0.0755148492)));
  }

  if (k >= 66) {
    b = 255;
  } else if (k <= 19) {
    b = 0;
  } else {
    b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(k - 10) - 305.0447927307));
  }

  const toHex = (n: number) =>
    Math.round(n)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
