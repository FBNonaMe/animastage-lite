import type { SmartGpuTier } from '../../smartStudio/types';
import { estimateGpuTier } from '../../smartStudio/qualityEngine';
import type { QualityMode } from '../scene/types';
import type { DeviceClass } from './types';

export function detectDeviceClass(): DeviceClass {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|mobile/.test(ua);
  const isTablet =
    /ipad|tablet/.test(ua) || (isMobile && Math.min(screen.width, screen.height) >= 768);

  if (isTablet) return 'tablet';
  if (isMobile) return 'phone';

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (memory <= 8 && cores <= 8) return 'laptop';
  return 'desktop';
}

export function gpuTierToQualityMode(tier: SmartGpuTier): QualityMode {
  switch (tier) {
    case 'ultra':
    case 'high':
      return 'quality';
    case 'medium':
    case 'balanced':
      return 'balanced';
    default:
      return 'performance';
  }
}

export function resolveAutoPerformance(): {
  deviceClass: DeviceClass;
  gpuTier: SmartGpuTier;
  qualityMode: QualityMode;
  label: string;
} {
  const deviceClass = detectDeviceClass();
  const gpuTier = estimateGpuTier();
  const qualityMode = gpuTierToQualityMode(gpuTier);

  const label =
    gpuTier === 'ultra'
      ? 'Ultra'
      : gpuTier === 'high'
        ? 'High'
        : gpuTier === 'balanced' || gpuTier === 'medium'
          ? 'Balanced'
          : 'Performance';

  return { deviceClass, gpuTier, qualityMode, label };
}
