/**
 * Keep VMD bytes alive across Canvas remounts / revoked blob: URLs.
 * Portrait (9:16) layout swaps previously unmounted the R3F tree and re-fetched
 * motion blobs — if the browser had dropped them, playback failed.
 */

const vmdBufferCache = new Map<string, ArrayBuffer>();

function normalizeKey(url: string): string {
  if (!url) return '';
  let u = url;
  if (u.startsWith('blob:')) {
    const hashIdx = u.indexOf('#');
    if (hashIdx >= 0) u = u.slice(0, hashIdx);
  }
  return u;
}

export function cacheVmdArrayBuffer(url: string, buffer: ArrayBuffer): void {
  if (!url || !buffer) return;
  vmdBufferCache.set(normalizeKey(url), buffer.slice(0));
}

export function peekVmdArrayBuffer(url: string): ArrayBuffer | null {
  const hit = vmdBufferCache.get(normalizeKey(url));
  return hit ? hit.slice(0) : null;
}

export async function fetchVmdArrayBuffer(url: string): Promise<ArrayBuffer> {
  const normalized = normalizeKey(url);
  const cached = peekVmdArrayBuffer(normalized);
  if (cached) return cached;

  try {
    const res = await fetch(normalized);
    if (!res.ok) throw new Error(`VMD fetch ${res.status}`);
    const buf = await res.arrayBuffer();
    cacheVmdArrayBuffer(normalized, buf);
    return buf;
  } catch (err) {
    const fallback = peekVmdArrayBuffer(normalized);
    if (fallback) return fallback;
    throw err;
  }
}

export function dropVmdCacheForUrl(url?: string | null): void {
  if (!url) return;
  vmdBufferCache.delete(normalizeKey(url));
}
