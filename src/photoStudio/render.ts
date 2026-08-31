/** Ultra + social still export with cover-crop and PNG/JPG/WebP. */
import { saveBlob } from '../native/saveBlob';
import { withVqPhotoCapture } from '../visualQuality';

export interface PhotoRenderOptions {
  canvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  mime?: 'image/png' | 'image/jpeg' | 'image/webp';
  transparent?: boolean;
  quality?: number;
  filename?: string;
  invalidate?: () => void;
  settleFrames?: number;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function coverCrop(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  transparent: boolean
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(width));
  out.height = Math.max(1, Math.round(height));
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  if (!transparent) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, out.width, out.height);
  }
  const scale = Math.max(out.width / source.width, out.height / source.height);
  const drawW = source.width * scale;
  const drawH = source.height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (out.width - drawW) / 2, (out.height - drawH) / 2, drawW, drawH);
  return out;
}

export async function renderPhotoStill(options: PhotoRenderOptions): Promise<{
  ok: boolean;
  message: string;
}> {
  return withVqPhotoCapture(async () => {
    if (!options.canvas || options.canvas.width < 2 || options.canvas.height < 2) {
      return { ok: false, message: 'Viewport is not ready.' };
    }
    // Extra settle frames under Photo Quality so shadows/AO/fog catch up.
    const settles = Math.max(options.settleFrames ?? 3, 6);
    for (let i = 0; i < settles; i++) {
      options.invalidate?.();
      await nextFrame();
    }
    const source = document.createElement('canvas');
    source.width = options.canvas.width;
    source.height = options.canvas.height;
    const sourceCtx = source.getContext('2d');
    if (!sourceCtx) return { ok: false, message: 'Could not create screenshot canvas.' };
    sourceCtx.drawImage(options.canvas, 0, 0);

    const mime = options.transparent ? 'image/png' : (options.mime ?? 'image/png');
    const out = coverCrop(source, options.width, options.height, Boolean(options.transparent));
    const blob = await new Promise<Blob | null>((resolve) =>
      out.toBlob(resolve, mime, options.quality ?? 0.94)
    );
    if (!blob || blob.size < 64) return { ok: false, message: 'Screenshot was empty.' };

    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name =
      options.filename ?? `animastage-photo-${options.width}x${options.height}-${stamp}.${ext}`;
    const saved = await saveBlob(blob, name);
    return { ok: saved.ok, message: saved.message };
  });
}

export const ULTRA_RENDER_SIZES = {
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 },
  '8k': { width: 7680, height: 4320 },
};
