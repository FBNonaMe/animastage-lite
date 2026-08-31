import type { ComposerPresetDef } from './presets';
import type { ComposerSkyId } from './types';

export interface PresetPreviewLook {
  skyTop: string;
  skyBottom: string;
  ground: string;
  /** CSS filter stack applied over the model snapshot */
  filter: string;
}

const SKY_LOOK: Record<ComposerSkyId, Omit<PresetPreviewLook, 'filter'>> = {
  blue: { skyTop: '#4a90d9', skyBottom: '#87ceeb', ground: '#3d5a40' },
  sunset: { skyTop: '#ff6b35', skyBottom: '#ffb347', ground: '#4a3728' },
  night: { skyTop: '#0a1628', skyBottom: '#1a2844', ground: '#0d1018' },
  cloudy: { skyTop: '#8a9bab', skyBottom: '#c5d0dc', ground: '#4a5248' },
  fantasy: { skyTop: '#7b5ea7', skyBottom: '#e8a0bf', ground: '#2d4a3e' },
  cyber: { skyTop: '#0f0a28', skyBottom: '#2d1b69', ground: '#120818' },
};

const PRESET_FILTER: Partial<Record<string, string>> = {
  golden_hour: 'saturate(1.15) contrast(1.05) brightness(0.95) sepia(0.12)',
  sunset: 'saturate(1.2) contrast(1.08) brightness(0.9) sepia(0.18)',
  night: 'saturate(0.85) contrast(1.1) brightness(0.72) hue-rotate(-15deg)',
  moonlight: 'saturate(0.75) contrast(1.05) brightness(0.78) hue-rotate(-25deg)',
  cyberpunk: 'saturate(1.35) contrast(1.15) brightness(0.88) hue-rotate(15deg)',
  sci_fi: 'saturate(0.9) contrast(1.12) brightness(0.92) hue-rotate(-8deg)',
  forest: 'saturate(0.95) contrast(1.05) brightness(0.94) hue-rotate(8deg)',
  beach: 'saturate(1.1) contrast(1.02) brightness(1.05)',
  studio: 'saturate(0.92) contrast(1.02) brightness(1.02)',
  realistic: 'saturate(1) contrast(1.08) brightness(0.96)',
};

export function getPresetPreviewLook(preset: ComposerPresetDef): PresetPreviewLook {
  const sky = preset.composer?.skyPreset ?? 'blue';
  const base = SKY_LOOK[sky] ?? SKY_LOOK.blue;
  const style = preset.composer?.visualStyle;
  const filter =
    PRESET_FILTER[preset.id] ??
    (style === 'realistic'
      ? 'saturate(1) contrast(1.1) brightness(0.95)'
      : style === 'anime' || style === 'soft_anime'
        ? 'saturate(1.15) contrast(1.05) brightness(1.02)'
        : style === 'cyberpunk'
          ? 'saturate(1.3) contrast(1.12) brightness(0.9) hue-rotate(12deg)'
          : 'saturate(1.05) contrast(1.04) brightness(0.98)');

  return { ...base, filter };
}
