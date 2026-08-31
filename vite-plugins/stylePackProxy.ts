import type { Connect } from 'vite';
import type { Plugin } from 'vite';

const PROXY_PATH = '/__style_pack_proxy';

const ALLOWED_HOSTS = new Set([
  'github.com',
  'www.github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'cdn.jsdelivr.net',
  'gitlab.com',
  'www.gitlab.com',
]);

function isAllowedRemoteUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return true;
    return host.endsWith('.githubusercontent.com');
  } catch {
    return false;
  }
}

function attachStylePackProxy(middlewares: Connect.Server): void {
  middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith(PROXY_PATH)) {
      next();
      return;
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    const target = requestUrl.searchParams.get('url')?.trim();
    if (!target) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Missing url parameter.');
      return;
    }
    if (!isAllowedRemoteUrl(target)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Remote host is not allowed for style pack proxy.');
      return;
    }

    try {
      const upstream = await fetch(target, {
        headers: { Accept: '*/*', 'User-Agent': 'AnimaStage-Lite-StylePack/1.0' },
        redirect: 'follow',
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      res.statusCode = upstream.status;
      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(body.length));
      res.end(body);
    } catch (err) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(err instanceof Error ? err.message : 'Proxy fetch failed.');
    }
  });
}

/** Dev/preview middleware — bypasses browser CORS for style pack ZIP downloads. */
export function stylePackProxyPlugin(): Plugin {
  return {
    name: 'style-pack-proxy',
    configureServer(server) {
      attachStylePackProxy(server.middlewares);
    },
    configurePreviewServer(server) {
      attachStylePackProxy(server.middlewares);
    },
  };
}

export { PROXY_PATH };
