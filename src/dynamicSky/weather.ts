import type { DynamicSkyLook, DynamicWeatherId } from './types';
import { lerpColor } from './evaluateTime';

export interface WeatherMod {
  id: DynamicWeatherId;
  label: string;
  cloudCoverage: number;
  cloudDensity: number;
  cloudSpeed: number;
  cloudOpacity: number;
  fogMul: number;
  fogColorBlend?: string;
  sunMul: number;
  ambientMul: number;
  envMul: number;
  exposureMul: number;
  bloomMul: number;
  wind: number;
  saturationMul: number;
  skyDim: number;
}

export const WEATHER_MODS: Record<DynamicWeatherId, WeatherMod> = {
  clear: {
    id: 'clear',
    label: 'Clear Sky',
    cloudCoverage: 0.12,
    cloudDensity: 0.25,
    cloudSpeed: 0.25,
    cloudOpacity: 0.4,
    fogMul: 0.7,
    sunMul: 1,
    ambientMul: 1,
    envMul: 1,
    exposureMul: 1,
    bloomMul: 1,
    wind: 0.08,
    saturationMul: 1.02,
    skyDim: 1,
  },
  cloudy: {
    id: 'cloudy',
    label: 'Cloudy',
    cloudCoverage: 0.55,
    cloudDensity: 0.6,
    cloudSpeed: 0.4,
    cloudOpacity: 0.7,
    fogMul: 1.1,
    sunMul: 0.75,
    ambientMul: 1.05,
    envMul: 0.85,
    exposureMul: 0.96,
    bloomMul: 0.9,
    wind: 0.25,
    saturationMul: 0.96,
    skyDim: 0.9,
  },
  overcast: {
    id: 'overcast',
    label: 'Overcast',
    cloudCoverage: 0.92,
    cloudDensity: 0.85,
    cloudSpeed: 0.3,
    cloudOpacity: 0.9,
    fogMul: 1.35,
    fogColorBlend: '#a8b4c8',
    sunMul: 0.45,
    ambientMul: 1.15,
    envMul: 0.7,
    exposureMul: 0.9,
    bloomMul: 0.7,
    wind: 0.2,
    saturationMul: 0.9,
    skyDim: 0.75,
  },
  rain: {
    id: 'rain',
    label: 'Rain',
    cloudCoverage: 0.85,
    cloudDensity: 0.8,
    cloudSpeed: 0.55,
    cloudOpacity: 0.85,
    fogMul: 1.5,
    fogColorBlend: '#7890a8',
    sunMul: 0.4,
    ambientMul: 1.1,
    envMul: 0.65,
    exposureMul: 0.88,
    bloomMul: 0.85,
    wind: 0.45,
    saturationMul: 0.88,
    skyDim: 0.7,
  },
  storm: {
    id: 'storm',
    label: 'Storm',
    cloudCoverage: 0.98,
    cloudDensity: 0.95,
    cloudSpeed: 0.85,
    cloudOpacity: 0.95,
    fogMul: 1.8,
    fogColorBlend: '#506070',
    sunMul: 0.25,
    ambientMul: 1.2,
    envMul: 0.5,
    exposureMul: 0.82,
    bloomMul: 1.1,
    wind: 0.85,
    saturationMul: 0.82,
    skyDim: 0.55,
  },
  snow: {
    id: 'snow',
    label: 'Snow',
    cloudCoverage: 0.7,
    cloudDensity: 0.65,
    cloudSpeed: 0.2,
    cloudOpacity: 0.75,
    fogMul: 1.4,
    fogColorBlend: '#e8f0f8',
    sunMul: 0.65,
    ambientMul: 1.2,
    envMul: 0.9,
    exposureMul: 1.02,
    bloomMul: 0.95,
    wind: 0.3,
    saturationMul: 0.85,
    skyDim: 0.95,
  },
  fog: {
    id: 'fog',
    label: 'Fog',
    cloudCoverage: 0.4,
    cloudDensity: 0.5,
    cloudSpeed: 0.15,
    cloudOpacity: 0.5,
    fogMul: 2.4,
    fogColorBlend: '#c8d4e0',
    sunMul: 0.55,
    ambientMul: 1.15,
    envMul: 0.6,
    exposureMul: 0.92,
    bloomMul: 0.75,
    wind: 0.05,
    saturationMul: 0.9,
    skyDim: 0.8,
  },
  wind: {
    id: 'wind',
    label: 'Wind',
    cloudCoverage: 0.45,
    cloudDensity: 0.5,
    cloudSpeed: 1.1,
    cloudOpacity: 0.6,
    fogMul: 0.95,
    sunMul: 0.95,
    ambientMul: 1,
    envMul: 0.95,
    exposureMul: 0.98,
    bloomMul: 1,
    wind: 0.95,
    saturationMul: 1,
    skyDim: 0.98,
  },
};

export function applyWeatherToLook(
  look: DynamicSkyLook,
  weather: DynamicWeatherId,
  cloudOverrides?: { coverage?: number; density?: number; speed?: number }
): DynamicSkyLook {
  const w = WEATHER_MODS[weather] ?? WEATHER_MODS.clear;
  const fogColor = w.fogColorBlend
    ? lerpColor(look.fogColor, w.fogColorBlend, 0.55)
    : look.fogColor;

  return {
    ...look,
    sunIntensity: look.sunIntensity * w.sunMul,
    ambientIntensity: look.ambientIntensity * w.ambientMul,
    environmentIntensity: look.environmentIntensity * w.envMul,
    exposure: look.exposure * w.exposureMul,
    bloomIntensity: look.bloomIntensity * w.bloomMul,
    saturation: look.saturation * w.saturationMul,
    skyBrightness: look.skyBrightness * w.skyDim,
    fogEnabled: look.fogEnabled || w.fogMul > 1.2,
    fogDensity: Math.min(0.95, look.fogDensity * w.fogMul),
    fogColor,
    cloudCoverage: cloudOverrides?.coverage ?? w.cloudCoverage,
    cloudDensity: cloudOverrides?.density ?? w.cloudDensity,
    cloudSpeed: cloudOverrides?.speed ?? w.cloudSpeed,
    cloudOpacity: w.cloudOpacity,
    windStrength: w.wind,
  };
}
