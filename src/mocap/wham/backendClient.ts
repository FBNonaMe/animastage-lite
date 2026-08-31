/**
 * Optional remote WHAM server client.
 * POST multipart video → JSON pose sequence (SMPL-style / WhamFrame[]).
 */
import type { WhamFrame, WhamPoseSequence, WhamProgress, WhamQualityMode } from './types';
import { resolveVideoAspect } from './videoIngest';

const STORAGE_KEY = 'animastage.wham.serverUrl';

export function getWhamServerUrl(override?: string): string | null {
  if (override?.trim()) return override.trim().replace(/\/$/, '');
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
    const fromEnv = env?.VITE_WHAM_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)?.trim();
    if (stored) return stored.replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  return null;
}

export function setWhamServerUrl(url: string | null): void {
  try {
    if (!url?.trim()) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''));
  } catch {
    /* ignore */
  }
}

export async function probeWhamServer(baseUrl?: string): Promise<boolean> {
  const url = getWhamServerUrl(baseUrl);
  if (!url) return false;
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${url}/health`, { method: 'GET', signal: ctrl.signal });
    window.clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

function normalizeFrames(raw: unknown, sampleFps: number): WhamFrame[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      const f = row as Partial<WhamFrame> & { t?: number };
      const time = Number(f.time ?? f.t ?? i / sampleFps) || 0;
      const frame = Number(f.frame ?? Math.round(time * 30)) || 0;
      const root = f.root ?? {
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        velocity: [0, 0, 0] as [number, number, number],
        acceleration: [0, 0, 0] as [number, number, number],
      };
      return {
        time,
        frame,
        root,
        joints: (f.joints ?? {}) as WhamFrame['joints'],
      };
    })
    .sort((a, b) => a.time - b.time);
}

/**
 * Call remote WHAM reconstruction service when available.
 * Expected API: POST /reconstruct  FormData(file, quality) → { frames, duration, fps, width, height }
 */
export async function reconstructWithWhamServer(
  file: File,
  quality: WhamQualityMode,
  onProgress?: (p: WhamProgress) => void,
  serverUrl?: string
): Promise<WhamPoseSequence | null> {
  const base = getWhamServerUrl(serverUrl);
  if (!base) return null;

  onProgress?.({
    phase: 'analyze',
    progress: 0.05,
    message: 'Connecting to WHAM server…',
  });

  const form = new FormData();
  form.append('file', file);
  form.append('quality', quality);
  form.append('pipeline', 'wham');

  let res: Response;
  try {
    const ctrl = new AbortController();
    const ms = quality === 'cinema' ? 600_000 : 300_000;
    const t = window.setTimeout(() => ctrl.abort(), ms);
    res = await fetch(`${base}/reconstruct`, {
      method: 'POST',
      body: form,
      signal: ctrl.signal,
    });
    window.clearTimeout(t);
  } catch {
    return null;
  }

  if (!res.ok) return null;

  onProgress?.({
    phase: 'reconstruct',
    progress: 0.55,
    message: 'Receiving WHAM reconstruction…',
  });

  const data = (await res.json()) as {
    frames?: unknown;
    duration?: number;
    fps?: number;
    width?: number;
    height?: number;
  };

  const sampleFps = Math.max(1, Number(data.fps) || 30);
  const frames = normalizeFrames(data.frames, sampleFps);
  if (frames.length < 2) return null;

  const width = Number(data.width) || 0;
  const height = Number(data.height) || 0;
  const duration = Number(data.duration) || frames[frames.length - 1]!.time;

  return {
    frames,
    duration,
    sampleFps,
    width,
    height,
    aspect: resolveVideoAspect(width, height),
    source: 'wham-server',
  };
}
