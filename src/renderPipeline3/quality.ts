import type { RenderPipeline3State, GiQualityPreset } from './types';
import { isMobileClient } from '../renderPipeline2/backend';

/** Scale RP3 budgets for mobile / Android. */
export function scalePipeline3ForDevice(state: RenderPipeline3State): RenderPipeline3State {
  if (!state.performance.autoQualityScale) return state;
  if (!isMobileClient()) return state;

  const qi: Record<GiQualityPreset, GiQualityPreset> = {
    ultra: 'high',
    high: 'medium',
    medium: 'low',
    low: 'low',
  };

  return {
    ...state,
    gi: {
      ...state.gi,
      quality: qi[state.gi.quality],
      halfResolution: true,
      temporalAccumulation: true,
      intensity: state.gi.intensity * 0.85,
    },
    ao: {
      ...state.ao,
      samples: Math.min(state.ao.samples, 8),
      halfRes: true,
    },
    bloom: {
      ...state.bloom,
      radius: Math.min(state.bloom.radius, 0.7),
      intensity: Math.min(state.bloom.intensity, 0.65),
    },
    particles: {
      ...state.particles,
      count: Math.min(state.particles.count, 4000),
    },
    vegetation: {
      ...state.vegetation,
      density: Math.min(state.vegetation.density, 0.35),
      trees: false,
    },
    water: {
      ...state.water,
      caustics: Math.min(state.water.caustics, 0.2),
    },
    taa: {
      ...state.taa,
      mode: state.taa.mode === 'txaa' ? 'smaa' : state.taa.mode,
    },
    camera: {
      ...state.camera,
      motionBlur: 0,
      filmGrain: Math.min(state.camera.filmGrain, 0.08),
    },
    performance: {
      ...state.performance,
      temporalUpscale: false,
      occlusionCulling: false,
    },
  };
}
