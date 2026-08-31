/**
 * Dynamic Sky & Time of Day — continuous 24h environmental lighting.
 */

export type DynamicSkyPeriodId =
  | 'midnight'
  | 'dawn'
  | 'sunrise'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'golden_hour'
  | 'sunset'
  | 'blue_hour'
  | 'evening';

export type DynamicWeatherId =
  | 'clear'
  | 'cloudy'
  | 'overcast'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'wind';

export type DynamicEnvPresetId =
  | 'sunny_day'
  | 'anime_day'
  | 'studio'
  | 'golden_hour'
  | 'sunset'
  | 'night'
  | 'moonlight'
  | 'cyberpunk'
  | 'snow'
  | 'rain'
  | 'foggy_morning'
  | 'warm_summer'
  | 'winter';

export type DynamicSkyQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface DynamicSkyColors {
  zenith: string;
  horizon: string;
  ground: string;
  sunGlow: string;
  fog: string;
  moon: string;
}

export interface DynamicSkyLook {
  period: DynamicSkyPeriodId;
  /** Hours 0..24 */
  timeHours: number;
  sunAzimuth: number;
  sunElevation: number;
  sunColor: string;
  sunIntensity: number;
  moonAzimuth: number;
  moonElevation: number;
  moonIntensity: number;
  moonColor: string;
  ambientColor: string;
  ambientIntensity: number;
  hemisphereIntensity: number;
  colors: DynamicSkyColors;
  fogEnabled: boolean;
  fogDensity: number;
  fogColor: string;
  cloudCoverage: number;
  cloudDensity: number;
  cloudSpeed: number;
  cloudOpacity: number;
  exposure: number;
  bloomIntensity: number;
  temperature: number;
  saturation: number;
  contrast: number;
  environmentIntensity: number;
  atmosphericDensity: number;
  skyBrightness: number;
  windStrength: number;
  /** Prefer moon as key light when sun is below horizon */
  nightMode: boolean;
}

export interface DynamicSkyState {
  enabled: boolean;
  /** Continuous time of day in hours (0–24). */
  timeHours: number;
  /** Auto-advance time (seconds of real time per in-world hour). 0 = paused. */
  playSpeed: number;
  weather: DynamicWeatherId;
  cloudCoverage: number;
  cloudDensity: number;
  cloudSpeed: number;
  fogOverride: number | null;
  exposureOverride: number | null;
  quality: DynamicSkyQuality;
  showSkyDome: boolean;
  showSunDisk: boolean;
  showMoon: boolean;
  showClouds: boolean;
  animateClouds: boolean;
  presetId: DynamicEnvPresetId | null;
}

export const DEFAULT_DYNAMIC_SKY: DynamicSkyState = {
  enabled: true,
  timeHours: 14,
  playSpeed: 0,
  weather: 'clear',
  cloudCoverage: 0.25,
  cloudDensity: 0.45,
  cloudSpeed: 0.35,
  /** Force Fog OFF for new projects — user enables fog manually (RP4). */
  fogOverride: 0,
  exposureOverride: null,
  quality: 'medium',
  showSkyDome: true,
  showSunDisk: true,
  showMoon: true,
  showClouds: true,
  animateClouds: true,
  presetId: 'sunny_day',
};
