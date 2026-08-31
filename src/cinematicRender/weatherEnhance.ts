import type { VisualFxSettings, WeatherPresetId } from '../types';
import type { SceneComposerState } from '../sceneComposer/types';
import { MMD_WEATHER_PRESETS } from '../visualFx/mmdWeatherPresets';
import type { CinematicRenderLookPatch } from './types';

/**
 * Enhanced weather looks for cinematic export — builds on mmd weather presets
 * with wetness, volume fog cues, wind, and post polish.
 */
export function getCinematicWeatherPatch(id: WeatherPresetId): CinematicRenderLookPatch {
  const base = MMD_WEATHER_PRESETS.find((p) => p.id === id);
  const visualFx: Partial<VisualFxSettings> = { ...(base?.patch ?? { weatherPreset: id }) };
  const sceneComposer: Partial<SceneComposerState> = {};

  switch (id) {
    case 'clear':
      Object.assign(visualFx, {
        precipIntensity: 0,
        wetness: 0,
        snowGround: 0,
        particlesEnabled: false,
        godRaysEnabled: false,
      });
      Object.assign(sceneComposer, {
        fogEnabled: false,
        windStrength: 0.05,
      });
      break;
    case 'rain':
      Object.assign(visualFx, {
        precipIntensity: 0.95,
        wetness: 0.75,
        particlesEnabled: true,
        particlePreset: 'dust',
        particleIntensity: 0.55,
        floorReflection: 0.94,
        bloomEnabled: true,
        bloomIntensity: 0.28,
        vignetteEnabled: true,
        vignetteIntensity: 0.32,
        chromaticAberration: 0.0004,
      });
      Object.assign(sceneComposer, {
        fogEnabled: true,
        fogDensity: 0.32,
        fogColor: '#8898a8',
        windStrength: 0.45,
        envBrightness: 0.62,
      });
      break;
    case 'storm':
      Object.assign(visualFx, {
        precipIntensity: 1.45,
        wetness: 0.98,
        particlesEnabled: true,
        particlePreset: 'dust',
        particleIntensity: 0.75,
        floorReflection: 0.96,
        bloomEnabled: true,
        bloomIntensity: 0.35,
        colorGrade: 'noir',
        vignetteEnabled: true,
        vignetteIntensity: 0.5,
        godRaysEnabled: true,
        godRaysDensity: 0.4,
        toneExposure: 0.72,
        environmentIntensity: 0.4,
      });
      Object.assign(sceneComposer, {
        fogEnabled: true,
        fogDensity: 0.48,
        fogColor: '#405060',
        windStrength: 0.85,
        exposure: 0.72,
        contrast: 1.12,
        skyPreset: 'night',
      });
      break;
    case 'fog':
      Object.assign(visualFx, {
        precipIntensity: 0,
        wetness: 0.35,
        particlesEnabled: false,
        colorGrade: 'cold',
        bloomEnabled: true,
        bloomIntensity: 0.22,
        vignetteEnabled: true,
        vignetteIntensity: 0.38,
        toneExposure: 0.85,
        environmentIntensity: 0.95,
        floorReflection: 0.55,
      });
      Object.assign(sceneComposer, {
        fogEnabled: true,
        fogDensity: 0.55,
        fogColor: '#b0c0d0',
        windStrength: 0.1,
        effectLevels: { bloom: 'low', ao: 'medium', reflection: 'low', dof: 'low' },
      });
      break;
    case 'snow':
      Object.assign(visualFx, {
        precipIntensity: 1.1,
        snowGround: 0.85,
        wetness: 0.1,
        particlesEnabled: true,
        particlePreset: 'snow',
        particleIntensity: 0.95,
        colorGrade: 'cold',
        bloomEnabled: true,
        bloomIntensity: 0.3,
        floorReflection: 0.72,
        environmentIntensity: 1.05,
        toneExposure: 0.98,
      });
      Object.assign(sceneComposer, {
        fogEnabled: true,
        fogDensity: 0.28,
        fogColor: '#d8e4f0',
        windStrength: 0.35,
        skyPreset: 'blue',
        temperature: -0.15,
      });
      break;
  }

  return { visualFx, sceneComposer };
}
