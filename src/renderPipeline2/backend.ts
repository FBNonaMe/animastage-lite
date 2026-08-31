/** Detect preferred realtime backend for Render Pipeline 2.0. */
export type ResolvedBackend = 'webgl' | 'webgpu';

export function detectRenderBackend(prefer: 'auto' | 'webgl' | 'webgpu' = 'auto'): ResolvedBackend {
  if (prefer === 'webgl') return 'webgl';
  if (typeof navigator === 'undefined') return 'webgl';

  const hasWebGpu =
    typeof (navigator as Navigator & { gpu?: unknown }).gpu !== 'undefined';

  if (prefer === 'webgpu') {
    return hasWebGpu ? 'webgpu' : 'webgl';
  }

  // Auto: prefer WebGPU when available, but keep WebGL as production default
  // until the Three WebGPU renderer path is fully wired in this app.
  if (hasWebGpu && (window as Window & { __AS_FORCE_WEBGPU__?: boolean }).__AS_FORCE_WEBGPU__) {
    return 'webgpu';
  }
  return 'webgl';
}

export function isMobileClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
