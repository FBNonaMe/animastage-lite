import type { DynamicWeatherId } from '../dynamicSky/types';
import type { ColorGradePresetId, LightPresetId, WeatherPresetId } from '../types';
import type {
  SceneFxCategory,
  SceneFxMount,
  SceneMoodPreset,
  SceneMoodPresetId,
  SceneWeatherControls,
} from './types';

interface MoodSeed {
  id: SceneMoodPresetId;
  name: string;
  description: string;
  timeHours: number;
  weather: DynamicWeatherId | 'ash' | 'dust' | 'mist';
  weatherIntensity?: number;
  colorGrade: ColorGradePresetId;
  lightPreset: LightPresetId;
  bloom?: number;
  exposure?: number;
  fog?: number;
  particles?: 'none' | 'snow' | 'sparkles' | 'petals' | 'confetti' | 'dust' | 'fireflies';
  effects?: Array<[string, string, SceneFxMount, SceneFxCategory, number]>;
}

const SEEDS: MoodSeed[] = [
  { id: 'clear_day', name: 'Clear Day', description: 'Clean daylight and neutral atmosphere.', timeHours: 13, weather: 'clear', colorGrade: 'neutral', lightPreset: 'natural', exposure: 0.94 },
  { id: 'sunset', name: 'Sunset', description: 'Orange horizon and cinematic warm light.', timeHours: 19, weather: 'cloudy', colorGrade: 'warm', lightPreset: 'natural', bloom: 0.2, exposure: 0.86 },
  { id: 'golden_hour', name: 'Golden Hour', description: 'Warm low-angle portrait light.', timeHours: 17.5, weather: 'clear', colorGrade: 'warm', lightPreset: 'natural', bloom: 0.16, exposure: 0.9 },
  { id: 'night', name: 'Night', description: 'Deep night with restrained highlights.', timeHours: 22, weather: 'clear', colorGrade: 'cold', lightPreset: 'rim', bloom: 0.16, exposure: 0.76, effects: [['environment.stars', 'Shining Stars', 'background', 'environment', 0.75]] },
  { id: 'moonlight', name: 'Moonlight', description: 'Cool moon key and soft atmosphere.', timeHours: 0.5, weather: 'clear', colorGrade: 'cold', lightPreset: 'rim', bloom: 0.12, exposure: 0.72, fog: 0.08 },
  { id: 'rain', name: 'Rain', description: 'Overcast rain with wet cinematic highlights.', timeHours: 15, weather: 'rain', weatherIntensity: 0.7, colorGrade: 'cold', lightPreset: 'natural', bloom: 0.18, exposure: 0.78, fog: 0.1, effects: [['weather.rain', 'Cinematic Rain', 'world', 'weather', 0.7]] },
  { id: 'heavy_rain', name: 'Heavy Rain', description: 'Dense depth-aware rain and wet reflections.', timeHours: 18, weather: 'rain', weatherIntensity: 1.25, colorGrade: 'cold', lightPreset: 'rim', bloom: 0.25, exposure: 0.7, fog: 0.18, effects: [['weather.rain', 'Heavy Rain', 'world', 'weather', 1.25]] },
  { id: 'storm', name: 'Storm', description: 'Dark storm clouds, wind and heavy rain.', timeHours: 17, weather: 'storm', weatherIntensity: 1.5, colorGrade: 'noir', lightPreset: 'concert', bloom: 0.3, exposure: 0.62, fog: 0.22, effects: [['weather.rain', 'Storm Rain', 'world', 'weather', 1.5]] },
  { id: 'snow', name: 'Snow', description: 'Soft winter daylight and falling snow.', timeHours: 10, weather: 'snow', weatherIntensity: 0.85, colorGrade: 'cold', lightPreset: 'natural', bloom: 0.12, exposure: 0.95, fog: 0.08, particles: 'snow', effects: [['weather.snow', 'Soft Snow', 'world', 'weather', 0.85]] },
  { id: 'fog', name: 'Fog', description: 'Light cinematic mist with preserved silhouettes.', timeHours: 8, weather: 'fog', weatherIntensity: 0.45, colorGrade: 'cold', lightPreset: 'natural', exposure: 0.82, fog: 0.28, effects: [['weather.mist', 'Ground Mist', 'world', 'weather', 0.45]] },
  { id: 'heavy_fog', name: 'Heavy Fog', description: 'Dense layered fog for mysterious scenes.', timeHours: 7, weather: 'mist', weatherIntensity: 0.9, colorGrade: 'noir', lightPreset: 'rim', bloom: 0.1, exposure: 0.68, fog: 0.62, effects: [['weather.mist', 'Dense Mist', 'world', 'weather', 0.95]] },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Blue/pink neon rain and wet highlights.', timeHours: 22, weather: 'rain', weatherIntensity: 0.9, colorGrade: 'vaporwave', lightPreset: 'neon', bloom: 0.42, exposure: 0.74, fog: 0.16, effects: [['weather.rain', 'Neon Rain', 'world', 'weather', 0.9], ['character.aura', 'Neon Aura', 'character', 'energy', 0.35]] },
  { id: 'neon_night', name: 'Neon Night', description: 'High-energy club lighting and particles.', timeHours: 23, weather: 'clear', colorGrade: 'vaporwave', lightPreset: 'neon', bloom: 0.5, exposure: 0.76, particles: 'sparkles', effects: [['audio.pulse', 'Music Pulse', 'post', 'audio', 0.6]] },
  { id: 'fantasy', name: 'Fantasy', description: 'Soft magic light, petals and character energy.', timeHours: 18, weather: 'clear', colorGrade: 'warm', lightPreset: 'rim', bloom: 0.32, exposure: 0.88, particles: 'petals', effects: [['character.magic_circle', 'Magic Circle', 'surface', 'magic', 0.7], ['character.aura', 'Fantasy Aura', 'character', 'magic', 0.45]] },
  { id: 'apocalypse', name: 'Apocalypse', description: 'Ash, dust and a low-contrast ruined atmosphere.', timeHours: 16, weather: 'ash', weatherIntensity: 1, colorGrade: 'warm', lightPreset: 'natural', bloom: 0.08, exposure: 0.68, fog: 0.3, particles: 'dust', effects: [['weather.ash', 'Falling Ash', 'world', 'weather', 1]] },
  { id: 'cinematic', name: 'Cinematic', description: 'Balanced contrast, DOF and restrained bloom.', timeHours: 16, weather: 'clear', colorGrade: 'cinematic', lightPreset: 'spotlight', bloom: 0.2, exposure: 0.86 },
  { id: 'anime', name: 'Anime', description: 'Bright anime sky and clean toon presentation.', timeHours: 11, weather: 'clear', colorGrade: 'anime', lightPreset: 'anime', bloom: 0.1, exposure: 0.96 },
  { id: 'mmd', name: 'Classic MMD', description: 'Neutral MMD-friendly lighting without forced fog.', timeHours: 12, weather: 'clear', colorGrade: 'neutral', lightPreset: 'natural', exposure: 0.92 },
];

function weatherControls(seed: MoodSeed): SceneWeatherControls {
  return {
    weather: seed.weather,
    intensity: seed.weatherIntensity ?? 0,
    speed: seed.weather === 'storm' ? 1.5 : 1,
    directionDeg: seed.weather === 'storm' ? 25 : 0,
    density: seed.weatherIntensity ?? 0,
    turbulence: seed.weather === 'storm' ? 0.8 : seed.weatherIntensity ? 0.25 : 0,
  };
}

function legacyWeather(seed: MoodSeed): WeatherPresetId {
  if (seed.weather === 'rain') return 'rain';
  if (seed.weather === 'storm') return 'storm';
  if (seed.weather === 'snow') return 'snow';
  if (seed.weather === 'fog' || seed.weather === 'mist') return 'fog';
  return 'clear';
}

export const SCENE_MOOD_PRESETS: SceneMoodPreset[] = SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  description: seed.description,
  timeHours: seed.timeHours,
  weather: weatherControls(seed),
  dynamicSky: {
    enabled: true,
    timeHours: seed.timeHours,
    weather:
      seed.weather === 'ash' || seed.weather === 'dust' || seed.weather === 'mist'
        ? seed.weather === 'mist'
          ? 'fog'
          : 'overcast'
        : seed.weather,
    cloudCoverage:
      seed.weather === 'storm' ? 0.95 : seed.weather === 'rain' ? 0.75 : seed.weather === 'clear' ? 0.2 : 0.55,
    fogOverride: seed.fog ?? 0,
  },
  sceneComposer: {
    fogEnabled: Boolean(seed.fog),
    fogDensity: seed.fog ?? 0.35,
    windStrength: seed.weather === 'storm' ? 1 : seed.weatherIntensity ? 0.35 : 0,
    exposure: seed.exposure ?? 0.9,
  },
  visualFx: {
    weatherPreset: legacyWeather(seed),
    precipIntensity: seed.weatherIntensity ?? 0,
    colorGrade: seed.colorGrade,
    lightPreset: seed.lightPreset,
    bloomEnabled: Boolean(seed.bloom),
    bloomIntensity: seed.bloom ?? 0,
    toneExposure: seed.exposure ?? 0.9,
    particlesEnabled: Boolean(seed.particles && seed.particles !== 'none'),
    particlePreset: seed.particles ?? 'none',
    particleIntensity: seed.weatherIntensity ?? (seed.particles ? 0.6 : 0),
  },
  effects: (seed.effects ?? []).map(([effectId, name, mount, category, intensity]) => ({
    effectId,
    name,
    mount,
    category,
    intensity,
  })),
}));

export function getSceneMoodPreset(id: SceneMoodPresetId): SceneMoodPreset {
  return SCENE_MOOD_PRESETS.find((preset) => preset.id === id) ?? SCENE_MOOD_PRESETS[0]!;
}
