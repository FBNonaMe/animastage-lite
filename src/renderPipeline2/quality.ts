import type { RenderPipeline2State, GiQualityPreset } from './types';
import { isMobileClient } from './backend';

/** Scale GI / AO / post budgets for device class. */
export function scalePipelineForDevice(state: RenderPipeline2State): RenderPipeline2State {
  if (!state.performance.autoQualityScale) return state;
  const mobile = isMobileClient();
  if (!mobile) return state;

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
