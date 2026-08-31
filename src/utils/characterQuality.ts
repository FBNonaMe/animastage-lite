import type { ViewportFormat } from '../types';
import { isNativeApp, isMobileRuntime } from './platform';

/** Character render fidelity — independent from timeline / physics. */
export type CharacterQuality = 'standard' | 'hd' | 'uhd4k';

export interface CharacterQualityGpuSettings {
  maxDpr: number;
  textureAnisotropy: number;
  shadowMapSize: number;
  /** Anime outline pass (cartoon edge). */
  useOutline: boolean;
  /** Upgrade toon materials to PBR-style standard. */
  enhanceMaterials: boolean;
}

export interface CharacterQualityPreset {
  id: CharacterQuality;
  label: string;
  shortLabel: string;
  subtitle: string;
  gpu: CharacterQualityGpuSettings;
}

export const CHARACTER_QUALITY_PRESETS: Record<CharacterQuality, CharacterQualityPreset> = {
  standard: {
    id: 'standard',
    label: 'Standard',
    shortLabel: '1×',
    subtitle: 'Fast · anime outline',
    gpu: {
      maxDpr: 1.25,
      textureAnisotropy: 4,
      shadowMapSize: 1024,
      useOutline: true,
      enhanceMaterials: false,
    },
  },
  hd: {
    id: 'hd',
    label: 'HD',
    shortLabel: 'HD',
    subtitle: 'Sharper textures · no outline',
    gpu: {
      maxDpr: 2,
      textureAnisotropy: 8,
      shadowMapSize: 2048,
      useOutline: false,
      enhanceMaterials: true,
    },
  },
  uhd4k: {
    id: 'uhd4k',
    label: '4K',
    shortLabel: '4K',
    subtitle: 'Max DPR · PBR detail · 4K shadows',
    gpu: {
      maxDpr: 3,
      textureAnisotropy: 16,
      shadowMapSize: 4096,
      useOutline: false,
      enhanceMaterials: true,
    },
  },
};

export function getCharacterQualityPreset(quality: CharacterQuality): CharacterQualityPreset {
  return CHARACTER_QUALITY_PRESETS[quality] ?? CHARACTER_QUALITY_PRESETS.standard;
}

/**
 * Lite GPU profile for 9:16 — keeps WebGL context stable on typical laptops.
 * Export upscales in ffmpeg; preview does not need max DPR / 4K shadows.
 */
export function getPortraitLiteGpu(_quality: CharacterQuality): CharacterQualityGpuSettings {
  return {
    maxDpr: 1,
    textureAnisotropy: 2,
    shadowMapSize: 512,
    useOutline: false,
    enhanceMaterials: false,
  };
}

/** Cap GPU load inside Capacitor WebView (landscape studio). */
export function getNativeLiteGpu(quality: CharacterQuality): CharacterQualityGpuSettings {
  const base = getCharacterQualityPreset(quality).gpu;
  return {
    maxDpr: Math.min(base.maxDpr, 1.5),
    textureAnisotropy: Math.min(base.textureAnisotropy, 4),
    shadowMapSize: Math.min(base.shadowMapSize, 1024),
    useOutline: base.useOutline,
    enhanceMaterials: base.enhanceMaterials,
  };
}

export function isPortraitFormat(format: ViewportFormat): boolean {
  return format === '9:16' || format === '4:5';
}

/** Browser phone / tablet WebView — cap GPU load. */
export function getMobileBrowserGpu(quality: CharacterQuality): CharacterQualityGpuSettings {
  const base = getCharacterQualityPreset(quality).gpu;
  return {
    maxDpr: Math.min(base.maxDpr, 1.25),
    textureAnisotropy: Math.min(base.textureAnisotropy, 2),
    shadowMapSize: Math.min(base.shadowMapSize, 512),
    useOutline: false,
    enhanceMaterials: quality !== 'standard',
  };
}

export function getCharacterQualityGpu(
  quality: CharacterQuality,
  viewportFormat: ViewportFormat = '16:9'
) {
  if (isPortraitFormat(viewportFormat)) {
    return getPortraitLiteGpu(quality);
  }
  if (isNativeApp()) {
    return getNativeLiteGpu(quality);
  }
  if (isMobileRuntime()) {
    return getMobileBrowserGpu(quality);
  }
  return getCharacterQualityPreset(quality).gpu;
}

export function getCharacterQualityDpr(
  quality: CharacterQuality,
  viewportFormat: ViewportFormat = '16:9'
): number | [number, number] {
  const cap = getCharacterQualityGpu(quality, viewportFormat).maxDpr;
  if (typeof window === 'undefined') return 1;
  const device = window.devicePixelRatio || 1;
  const effective = Math.min(device, cap);
  if (effective <= 1) return 1;
  return [1, effective];
}

export function shouldUseCharacterOutline(
  quality: CharacterQuality,
  viewportFormat: ViewportFormat = '16:9'
): boolean {
  return getCharacterQualityGpu(quality, viewportFormat).useOutline;
}

/** 9:16 stays on standard/lite GPU — export resolution is handled separately. */
export function portraitRecommendedQuality(current: CharacterQuality): CharacterQuality {
  return current === 'uhd4k' ? 'hd' : 'standard';
}
