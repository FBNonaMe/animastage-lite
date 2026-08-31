import type { WhamQualityMode } from './types';

export interface WhamQualityPreset {
  id: WhamQualityMode;
  label: string;
  description: string;
  /** Pose sample rate (capped by video) */
  sampleFps: number;
  /** Temporal EMA alpha (lower = smoother) */
  temporalAlpha: number;
  /** Hand stabilization passes */
  handPasses: number;
  /** Leg / foot contact passes */
  legPasses: number;
  /** Velocity / accel filter strength 0..1 */
  velocityFilter: number;
  /** Keyframe reduction tolerance (degrees) */
  keyReduceTol: number;
  /** Prefer remote WHAM when configured */
  preferServer: boolean;
  /** Cinema: max accuracy */
  cinema: boolean;
}

export const WHAM_QUALITY_PRESETS: Record<WhamQualityMode, WhamQualityPreset> = {
  fast: {
    id: 'fast',
    label: 'Fast',
    description: 'Quick preview — lighter sampling',
    sampleFps: 12,
    temporalAlpha: 0.42,
    handPasses: 1,
    legPasses: 1,
    velocityFilter: 0.35,
    keyReduceTol: 4.5,
    preferServer: false,
    cinema: false,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Stable motion for most dances',
    sampleFps: 20,
    temporalAlpha: 0.28,
    handPasses: 2,
    legPasses: 2,
    velocityFilter: 0.5,
    keyReduceTol: 2.8,
    preferServer: true,
    cinema: false,
  },
  high: {
    id: 'high',
    label: 'High Quality',
    description: 'Strong temporal consistency + hands',
    sampleFps: 30,
    temporalAlpha: 0.18,
    handPasses: 3,
    legPasses: 3,
    velocityFilter: 0.65,
    keyReduceTol: 1.6,
    preferServer: true,
    cinema: false,
  },
  cinema: {
    id: 'cinema',
    label: 'Cinema',
    description: 'Accuracy over speed — production keys',
    sampleFps: 30,
    temporalAlpha: 0.12,
    handPasses: 4,
    legPasses: 4,
    velocityFilter: 0.78,
    keyReduceTol: 0.9,
    preferServer: true,
    cinema: true,
  },
};

export function getWhamQualityPreset(mode: WhamQualityMode = 'balanced'): WhamQualityPreset {
  return WHAM_QUALITY_PRESETS[mode] ?? WHAM_QUALITY_PRESETS.balanced;
}
