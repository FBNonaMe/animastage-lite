import type { SmartGpuTier } from './types';

/** Estimate GPU tier from WebGL capabilities — no user config required. */
export function estimateGpuTier(): SmartGpuTier {
  if (typeof navigator === 'undefined') return 'balanced';

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|mobile/.test(ua);
  const isTablet = /ipad|tablet/.test(ua) || (isMobile && Math.min(screen.width, screen.height) >= 768);

  let renderer = '';
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (gl && 'getExtension' in gl) {
      const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        renderer = (
          (gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string
        ).toLowerCase();
      }
    }
  } catch {
    /* ignore */
  }

  const isIntegrated =
    /intel|uhd|iris|mali|adreno|powervr|apple gpu|swiftshader|llvmpipe/.test(renderer);
  const isHighEnd =
    /rtx|radeon rx|geforce (r)?tx|apple m[2-9]|apple m1 (pro|max|ultra)/.test(renderer);

  if (isMobile && !isTablet) {
    return memory <= 3 || cores <= 4 ? 'performance' : 'balanced';
  }
  if (isTablet) return 'medium';
  if (isHighEnd && memory >= 8) return 'ultra';
  if (isIntegrated || memory <= 4) return cores <= 4 ? 'performance' : 'balanced';
  if (memory >= 8 && cores >= 8) return 'high';
  return 'medium';
}

export function fpsTargetForTier(tier: SmartGpuTier): number {
  if (tier === 'ultra' || tier === 'high') return 60;
  if (tier === 'medium' || tier === 'balanced') return 45;
  return 30;
}

export function qualityLabelForTier(tier: SmartGpuTier): string {
  switch (tier) {
    case 'ultra':
      return 'Ultra';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'balanced':
      return 'Balanced';
    default:
      return 'Performance';
  }
}
