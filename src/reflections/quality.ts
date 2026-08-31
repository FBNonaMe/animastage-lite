import { isMobileRuntime, isNativeApp } from '../utils/platform';
import { detectDeviceClass } from '../product/oneClick/deviceTier';
import type { ReflectionQualityProfile, ReflectionQualityTier, ReflectionSystemSettings } from './types';

function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isMobileRuntime() && memory <= 4) return true;
  if (cores <= 4 && memory <= 4) return true;
  return false;
}

/** Resolve device quality tier — desktop ultra, Android balanced, low-end simplified. */
export function detectReflectionQualityTier(forceExport = false): ReflectionQualityTier {
  if (forceExport) return 'export';
  if (isLowEndDevice()) return 'simplified';
  if (isNativeApp() || isMobileRuntime()) return 'balanced';
  const device = detectDeviceClass();
  if (device === 'phone') return 'simplified';
  if (device === 'tablet' || device === 'laptop') return 'balanced';
  return 'ultra';
}

export function getReflectionQualityProfile(
  settings: ReflectionSystemSettings,
  opts?: { exporting?: boolean; rtxLite?: boolean }
): ReflectionQualityProfile {
  const exporting = Boolean(opts?.exporting && settings.exportBoost);
  const tier = detectReflectionQualityTier(exporting);
  const rtxBoost = opts?.rtxLite ? 1.15 : 1;

  const base: Record<ReflectionQualityTier, ReflectionQualityProfile> = {
    simplified: {
      tier: 'simplified',
      resolution: 64,
      refreshRate: Math.max(settings.refreshRate, 4),
      intensityScale: 0.7 * rtxBoost,
      contactHardening: false,
      maxMips: 4,
    },
    balanced: {
      tier: 'balanced',
      resolution: 128,
      refreshRate: Math.max(settings.refreshRate, 2.5),
      intensityScale: 0.9 * rtxBoost,
      contactHardening: settings.contactHardening,
      maxMips: 6,
    },
    ultra: {
      tier: 'ultra',
      resolution: 256,
      refreshRate: Math.max(0.8, settings.refreshRate * 0.75),
      intensityScale: 1.05 * rtxBoost,
      contactHardening: settings.contactHardening,
      maxMips: 8,
    },
    export: {
      tier: 'export',
      resolution: 512,
      refreshRate: 0,
      intensityScale: 1.2 * rtxBoost,
      contactHardening: true,
      maxMips: 8,
    },
  };

  const profile = { ...base[tier] };
  if (typeof settings.resolution === 'number' && settings.resolution > 0) {
    profile.resolution = settings.resolution;
  }
  if (settings.refreshRate > 0 && tier !== 'export') {
    profile.refreshRate = settings.refreshRate;
  }
  return profile;
}
