import type { SceneComposerState } from '../sceneComposer/types';
import type { VisualFxSettings } from '../types';
import type { DynamicSkyLook, DynamicSkyQuality, DynamicSkyState } from './types';
import { evaluateTimeOfDay } from './evaluateTime';
import { applyWeatherToLook } from './weather';

export function resolveDynamicSkyLook(state: DynamicSkyState): DynamicSkyLook {
  let look = evaluateTimeOfDay(state.timeHours);
  look = applyWeatherToLook(look, state.weather, {
    coverage: state.cloudCoverage,
    density: state.cloudDensity,
    speed: state.cloudSpeed,
  });
  if (state.fogOverride != null) {
    look = {
      ...look,
      fogEnabled: state.fogOverride > 0.02,
      fogDensity: state.fogOverride,
    };
  }
  if (state.exposureOverride != null) {
    look = { ...look, exposure: state.exposureOverride };
  }
  return look;
}

export function qualityShadowSoftness(q: DynamicSkyQuality): number {
  switch (q) {
    case 'low':
      return 0.6;
    case 'medium':
      return 0.85;
    case 'high':
      return 1;
    case 'ultra':
      return 1.15;
  }
}

export function qualitySkySegments(q: DynamicSkyQuality): number {
  switch (q) {
    case 'low':
      return 16;
    case 'medium':
      return 24;
    case 'high':
      return 32;
    case 'ultra':
      return 48;
  }
}

export interface DynamicSkyApplyResult {
  sceneComposer: Partial<SceneComposerState> & {
    lights: Partial<SceneComposerState['lights']>;
  };
  visualFx: Partial<VisualFxSettings>;
}

/**
 * Map evaluated look → sceneComposer + visualFx patches (live, no reload).
 * RP4: lighting / sky colors only — never auto-enable Fog, Bloom, or Weather.
 * Fog stays project-owned unless Environment Studio sets fogOverride / fogEnabled.
 */
export function buildDynamicSkyPatches(look: DynamicSkyLook): DynamicSkyApplyResult {
  const keyIsMoon = look.nightMode && look.moonIntensity > 0.2;
  return {
    sceneComposer: {
      lights: {
        sunEnabled: true,
        sunAzimuth: keyIsMoon ? look.moonAzimuth : look.sunAzimuth,
        sunElevation: keyIsMoon
          ? Math.max(8, look.moonElevation)
          : Math.max(look.nightMode ? 4 : look.sunElevation, look.sunElevation),
        sunColor: keyIsMoon ? look.moonColor : look.sunColor,
        sunIntensity: keyIsMoon
          ? look.moonIntensity
          : Math.max(0.05, look.sunIntensity),
        sunShadows: true,
        ambientEnabled: true,
        ambientColor: look.ambientColor,
        ambientIntensity: look.ambientIntensity,
        hemisphereEnabled: true,
        hemisphereIntensity: look.hemisphereIntensity,
      },
      skyPreset: look.nightMode ? 'night' : look.sunElevation < 15 ? 'sunset' : 'blue',
      // Do not write fogEnabled / fogDensity here — import & project state own fog.
      fogColor: look.fogColor,
      exposure: look.exposure,
      temperature: look.temperature,
      saturation: look.saturation,
      contrast: look.contrast,
      windStrength: look.windStrength,
      envBrightness: look.environmentIntensity,
    },
    visualFx: {
      toneExposure: look.exposure,
      // Intensity hint only — never flip bloomEnabled / weatherPreset on.
      bloomIntensity: look.bloomIntensity,
      environmentIntensity: look.environmentIntensity,
      colorGrade: look.temperature > 0.15 ? 'warm' : look.temperature < -0.1 ? 'cold' : 'neutral',
      scenePreset: look.nightMode ? 'cyber' : look.sunElevation < 12 ? 'sunset' : 'outdoor',
      lightPreset: look.nightMode ? 'rim' : 'natural',
    },
  };
}

export function mergeComposerWithLook(
  prev: SceneComposerState,
  look: DynamicSkyLook
): SceneComposerState {
  const patch = buildDynamicSkyPatches(look);
  return {
    ...prev,
    ...patch.sceneComposer,
    lights: {
      ...prev.lights,
      ...patch.sceneComposer.lights,
    },
  };
}
