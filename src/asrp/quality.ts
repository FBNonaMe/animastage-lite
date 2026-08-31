import { isMobileRuntime, isNativeApp } from '../utils/platform';
import { detectDeviceClass } from '../product/oneClick/deviceTier';
import type { AsrpQualityProfile, AsrpQualityTier, AsrpSettings } from './types';

function isLowEnd(): boolean {
  if (typeof navigator === 'undefined') return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  return (isMobileRuntime() && memory <= 4) || (cores <= 4 && memory <= 4);
}

export function detectAsrpQualityTier(forceExport = false): AsrpQualityTier {
  if (forceExport) return 'export';
  if (isLowEnd()) return 'simplified';
  if (isNativeApp() || isMobileRuntime()) return 'balanced';
  const device = detectDeviceClass();
  if (device === 'phone') return 'simplified';
  if (device === 'tablet' || device === 'laptop') return 'balanced';
  return 'ultra';
}

export function getAsrpQualityProfile(
  settings: AsrpSettings,
  opts?: { exporting?: boolean; rtxLite?: boolean }
): AsrpQualityProfile {
  const exporting = Boolean(opts?.exporting && settings.exportBoost);
  const tier =
    settings.quality === 'auto'
      ? detectAsrpQualityTier(exporting)
      : settings.quality;

  const rtx = opts?.rtxLite ? 1.15 : 1;
  const sampleOverride =
    typeof settings.samples === 'number' && settings.samples > 0
      ? settings.samples
      : null;

  const table: Record<AsrpQualityTier, AsrpQualityProfile> = {
    simplified: {
      tier: 'simplified',
      minLayers: 4,
      maxLayers: 12,
      refineSteps: 1,
      depthScale: 0.65 * rtx,
      silhouette: false,
      distanceFadeStart: 8,
      distanceFadeEnd: 22,
    },
    balanced: {
      tier: 'balanced',
      minLayers: 8,
      maxLayers: 24,
      refineSteps: 2,
      depthScale: 0.9 * rtx,
      silhouette: true,
      distanceFadeStart: 12,
      distanceFadeEnd: 36,
    },
    ultra: {
      tier: 'ultra',
      minLayers: 12,
      maxLayers: 40,
      refineSteps: 3,
      depthScale: 1.05 * rtx,
      silhouette: true,
      distanceFadeStart: 18,
      distanceFadeEnd: 48,
    },
    export: {
      tier: 'export',
      minLayers: 24,
      maxLayers: 64,
      refineSteps: 5,
      depthScale: 1.25 * rtx,
      silhouette: true,
      distanceFadeStart: 40,
      distanceFadeEnd: 120,
    },
  };

  const profile = { ...table[tier] };
  if (sampleOverride != null) {
    profile.minLayers = Math.max(4, Math.floor(sampleOverride * 0.4));
    profile.maxLayers = sampleOverride;
  }
  profile.depthScale *= settings.depthStrength * settings.parallaxScale * settings.heightScale;
  profile.distanceFadeStart *= settings.distanceFade;
  profile.distanceFadeEnd *= settings.distanceFade;
  return profile;
}
