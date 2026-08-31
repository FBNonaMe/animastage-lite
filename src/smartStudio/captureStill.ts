import { saveBlob } from '../native/saveBlob';

export type StillExportKind = 'png' | 'png_transparent' | '4k' | '8k';

export interface CaptureStillOptions {
  canvas: HTMLCanvasElement | null;
  kind?: StillExportKind;
  filename?: string;
  /** Force R3F demand-loop to render before capture. */
  invalidate?: () => void;
  /** Wait this many animation frames after invalidate (WebGL buffer). */
  settleFrames?: number;
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let left = Math.max(1, n);
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function scaleCanvas(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return out;
}

function resolveSize(
  canvas: HTMLCanvasElement,
  kind: StillExportKind
): { w: number; h: number } {
  const aspect = canvas.width / Math.max(1, canvas.height);
  if (kind === '8k') {
    const w = 7680;
    return { w, h: Math.round(w / aspect) };
  }
  if (kind === '4k') {
    const w = 3840;
    return { w, h: Math.round(w / aspect) };
  }
  return { w: canvas.width, h: canvas.height };
}

/** Copy WebGL canvas pixels into a 2D canvas (works without preserveDrawingBuffer if called mid-frame). */
function copyCanvasPixels(source: HTMLCanvasElement): HTMLCanvasElement | null {
  if (source.width < 2 || source.height < 2) return null;
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  try {
    ctx.drawImage(source, 0, 0);
  } catch {
    return null;
  }
  return out;
}

export async function captureSmartStill(options: CaptureStillOptions): Promise<{
  ok: boolean;
  message: string;
}> {
  const canvas = options.canvas;
  if (!canvas) {
    return { ok: false, message: 'Viewport not ready — wait for the 3D view to load.' };
  }

  const kind = options.kind ?? 'png';
  const settleFrames = options.settleFrames ?? 3;

  // Demand frameloop needs an invalidate + live frames so the color buffer is filled.
  for (let i = 0; i < settleFrames; i++) {
    options.invalidate?.();
    await waitFrames(1);
  }

  const snapshot = copyCanvasPixels(canvas);
  if (!snapshot) {
    return { ok: false, message: 'Could not read viewport pixels. Try again.' };
  }

  const { w, h } = resolveSize(snapshot, kind);
  const exportCanvas =
    w === snapshot.width && h === snapshot.height ? snapshot : scaleCanvas(snapshot, w, h);

  const blob = await new Promise<Blob | null>((resolve) => {
    exportCanvas.toBlob((b) => resolve(b), 'image/png');
  });

  if (!blob || blob.size < 64) {
    return { ok: false, message: 'Screenshot was empty — try again after the model loads.' };
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename =
    options.filename ?? `animastage-smart-${kind}-${stamp}.png`;

  const result = await saveBlob(blob, filename);
  return { ok: result.ok, message: result.message };
}
