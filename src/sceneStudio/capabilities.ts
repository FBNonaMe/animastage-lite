import type {
  SceneFxBackend,
  SceneFxBackendPreference,
  SceneFxCapabilities,
} from './types';

interface NavigatorGpuLike {
  requestAdapter?: () => Promise<{
    features?: Set<string>;
    limits?: { maxStorageBufferBindingSize?: number };
  } | null>;
}

export async function detectSceneFxCapabilities(
  preference: SceneFxBackendPreference = 'auto'
): Promise<SceneFxCapabilities> {
  const gpu = (navigator as Navigator & { gpu?: NavigatorGpuLike }).gpu;
  let webGpu = false;
  let timestampQuery = false;
  let maxStorageBufferBindingSize = 0;
  let fallbackReason: string | null = null;

  if (gpu?.requestAdapter) {
    try {
      const adapter = await gpu.requestAdapter();
      webGpu = Boolean(adapter);
      timestampQuery = adapter?.features?.has('timestamp-query') ?? false;
      maxStorageBufferBindingSize = adapter?.limits?.maxStorageBufferBindingSize ?? 0;
    } catch {
      fallbackReason = 'WebGPU adapter initialization failed';
    }
  } else {
    fallbackReason = 'WebGPU is not available in this browser';
  }

  let backend: SceneFxBackend = webGpu ? 'webgpu' : 'webgl';
  if (preference === 'webgl') backend = 'webgl';
  if (preference === 'webgpu' && !webGpu) {
    backend = 'webgl';
    fallbackReason = fallbackReason ?? 'Requested WebGPU is unavailable';
  }

  return {
    webGpu,
    compute: webGpu,
    timestampQuery,
    depthTexture: true,
    maxStorageBufferBindingSize,
    backend,
    fallbackReason,
  };
}

export function sceneFxCountForBackend(
  requested: number,
  backend: SceneFxBackend,
  mobile: boolean
): number {
  const hardCap = backend === 'webgpu' ? (mobile ? 80_000 : 250_000) : mobile ? 4_000 : 20_000;
  return Math.max(0, Math.min(Math.round(requested), hardCap));
}
