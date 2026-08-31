/** Same-origin proxy path registered by Vite dev/preview middleware. */
export const STYLE_PACK_PROXY_PATH = '/__style_pack_proxy';

export type StylePackUrlResult = { url: string } | { error: string };

/** Resolve GitHub repo pages to archive ZIP for MMD shader import. */
export function resolveMmdShaderDownloadUrl(raw: string): StylePackUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { error: 'Paste a ZIP download link first.' };

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'github.com') {
      const repoRoot = u.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
      if (repoRoot) {
        const owner = repoRoot[1]!;
        const repo = repoRoot[2]!.replace(/\.git$/i, '');
        return {
          url: `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`,
        };
      }
    }
  } catch {
    /* fall through */
  }

  return normalizeStylePackUrl(trimmed);
}

/** Normalize and validate a user-pasted native style pack URL before download. */
export function normalizeStylePackUrl(raw: string): StylePackUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { error: 'Paste a ZIP download link first.' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: 'Enter a valid http(s) URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Only http(s) download links are supported.' };
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const path = parsed.pathname;

  if (host === 'github.com') {
    const repoRoot = path.match(/^\/([^/]+)\/([^/]+)\/?$/);
    if (repoRoot) {
      return {
        error:
          'That is a GitHub repository page, not a ZIP file. Import a .zip style pack file, or paste a direct download link ending in .zip (for example a GitHub release asset).',
      };
    }
    if (path.includes('/tree/') || path.includes('/blob/')) {
      return {
        error:
          'That is a GitHub file browser link. Paste a direct .zip download URL instead.',
      };
    }
    if (path.includes('/releases') && !path.includes('/download/')) {
      return {
        error:
          'That is a GitHub releases page. Right-click a release asset and copy the direct .zip download link.',
      };
    }
  }

  return { url: parsed.toString() };
}

function isZipBuffer(buf: ArrayBuffer): boolean {
  const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  return head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b;
}

function looksLikeHtml(buf: ArrayBuffer): boolean {
  const sample = new TextDecoder('utf-8', { fatal: false })
    .decode(buf.slice(0, Math.min(512, buf.byteLength)))
    .trim()
    .toLowerCase();
  return sample.startsWith('<!doctype html') || sample.startsWith('<html') || sample.includes('<head>');
}

export function assertStylePackZipBuffer(buf: ArrayBuffer, sourceLabel = 'download'): void {
  if (buf.byteLength < 22) {
    throw new Error(`The ${sourceLabel} was empty or too small to be a ZIP archive.`);
  }
  if (isZipBuffer(buf)) return;
  if (looksLikeHtml(buf)) {
    throw new Error(
      'The link returned a web page instead of a ZIP file. Use a direct .zip download URL or import the file with Import ZIP.'
    );
  }
  throw new Error(
    'Downloaded file is not a ZIP archive. Style packs must be .zip files containing manifest.json, config.json, and shaders.'
  );
}

async function fetchViaProxy(url: string): Promise<Response | null> {
  const proxyUrl = `${STYLE_PACK_PROXY_PATH}?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxyUrl);
    if (res.status === 404) return null;
    return res;
  } catch {
    return null;
  }
}

async function fetchDirect(url: string): Promise<Response> {
  return fetch(url, { mode: 'cors', credentials: 'omit' });
}

/** Download remote bytes — tries same-origin proxy first, then direct fetch. */
export async function fetchRemoteStylePackBytes(
  url: string,
  opts?: { allowMmdShaderRepo?: boolean }
): Promise<ArrayBuffer> {
  const normalized = opts?.allowMmdShaderRepo
    ? resolveMmdShaderDownloadUrl(url)
    : normalizeStylePackUrl(url);
  if ('error' in normalized) throw new Error(normalized.error);

  const target = normalized.url;
  let lastError: string | null = null;

  const proxyRes = await fetchViaProxy(target);
  if (proxyRes) {
    if (!proxyRes.ok) {
      lastError = `Download failed (${proxyRes.status}). Check the link and try again.`;
    } else {
      const buf = await proxyRes.arrayBuffer();
      assertStylePackZipBuffer(buf);
      return buf;
    }
  }

  try {
    const directRes = await fetchDirect(target);
    if (!directRes.ok) {
      throw new Error(`Download failed (${directRes.status}). Check the link and try again.`);
    }
    const buf = await directRes.arrayBuffer();
    assertStylePackZipBuffer(buf);
    return buf;
  } catch (err) {
    if (err instanceof Error && err.message.includes('ZIP')) throw err;
    if (lastError) throw new Error(lastError);
    throw new Error(
      'Could not download the style pack. The server may block browser downloads (CORS). Import the .zip file directly, or use a direct download link from a release asset.'
    );
  }
}

/** JSON fetch for update manifests — same proxy fallback. */
export async function fetchRemoteJson<T>(url: string): Promise<T | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const proxyRes = await fetchViaProxy(trimmed);
    if (proxyRes?.ok) return (await proxyRes.json()) as T;

    const directRes = await fetch(trimmed, { mode: 'cors', credentials: 'omit' });
    if (!directRes.ok) return null;
    return (await directRes.json()) as T;
  } catch {
    return null;
  }
}
