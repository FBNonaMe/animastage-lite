import type { DynamicEnvPresetId, DynamicSkyState, DynamicWeatherId } from './types';

export interface EnvPresetDef {
  id: DynamicEnvPresetId;
  label: string;
  timeHours: number;
  weather: DynamicWeatherId;
  cloudCoverage?: number;
  description: string;
}

export const ENV_PRESETS: EnvPresetDef[] = [
  { id: 'sunny_day', label: 'Sunny Day', timeHours: 13, weather: 'clear', description: 'Bright outdoor midday' },
  { id: 'anime_day', label: 'Anime Day', timeHours: 11, weather: 'clear', cloudCoverage: 0.2, description: 'Clean anime sky' },
  { id: 'studio', label: 'Studio Lighting', timeHours: 12, weather: 'clear', description: 'Neutral studio-like day' },
  { id: 'golden_hour', label: 'Golden Hour', timeHours: 17.5, weather: 'clear', description: 'Warm late sun' },
  { id: 'sunset', label: 'Sunset', timeHours: 19, weather: 'cloudy', description: 'Orange horizon' },
  { id: 'night', label: 'Night', timeHours: 22, weather: 'clear', description: 'Deep night' },
  { id: 'moonlight', label: 'Moonlight', timeHours: 0.5, weather: 'clear', description: 'Cool moon key' },
  { id: 'cyberpunk', label: 'Cyberpunk', timeHours: 21.5, weather: 'rain', description: 'Wet neon night' },
  { id: 'snow', label: 'Snow', timeHours: 10, weather: 'snow', description: 'Winter daylight' },
  { id: 'rain', label: 'Rain', timeHours: 15, weather: 'rain', description: 'Grey rainy afternoon' },
  { id: 'foggy_morning', label: 'Foggy Morning', timeHours: 7, weather: 'fog', description: 'Soft morning mist' },
  { id: 'warm_summer', label: 'Warm Summer', timeHours: 16, weather: 'clear', description: 'Warm saturated day' },
  { id: 'winter', label: 'Winter', timeHours: 9, weather: 'overcast', description: 'Cold overcast' },
];

export function applyEnvPreset(state: DynamicSkyState, id: DynamicEnvPresetId): DynamicSkyState {
  const p = ENV_PRESETS.find((x) => x.id === id);
  if (!p) return state;
  return {
    ...state,
    enabled: true,
    timeHours: p.timeHours,
    weather: p.weather,
    cloudCoverage: p.cloudCoverage ?? state.cloudCoverage,
    presetId: id,
  };
}
