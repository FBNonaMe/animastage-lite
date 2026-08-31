export interface OidnDenoiser {
  isSupported(): boolean;
  ensure(options?: { forceRetry?: boolean }): Promise<unknown>;
  denoiseCanvas(
    srcCanvas: HTMLCanvasElement,
    guides?: { albedo?: ImageData | null; normal?: ImageData | null } | null,
    options?: Record<string, unknown>
  ): Promise<HTMLCanvasElement>;
  abort(): void;
  retry(): Promise<unknown>;
  readonly ready: boolean;
  readonly failed: boolean;
  readonly capabilities: {
    guided: boolean;
    model: string;
    status: string;
    lastError: string | null;
    fallback: boolean;
  };
}

let cached: OidnDenoiser | null = null;
let loadPromise: Promise<OidnDenoiser> | null = null;

/** Intel OIDN — bundled offline weights from standalone vendor tree. */
export async function loadOidnDenoiser(
  onStatus?: (message: string) => void
): Promise<OidnDenoiser> {
  if (cached) return cached;
  if (!loadPromise) {
    loadPromise = import('@standalone/oidn-denoise.js').then((mod) => {
      cached = mod.createOidnDenoiser({ onStatus }) as OidnDenoiser;
      return cached;
    });
  }
  return loadPromise;
}

export function getOidnDenoiser(): OidnDenoiser | null {
  return cached;
}

export function oidnIsSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.gpu);
}
