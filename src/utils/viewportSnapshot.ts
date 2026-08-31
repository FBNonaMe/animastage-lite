/** Downscaled JPEG snapshot from the main WebGL canvas (for preset thumbnails). */
export function captureViewportSnapshot(
  canvas: HTMLCanvasElement | null,
  maxWidth = 320
): string | null {
  if (!canvas || canvas.width < 8 || canvas.height < 8) return null;
  try {
    const scale = Math.min(1, maxWidth / canvas.width);
    const w = Math.max(1, Math.round(canvas.width * scale));
    const h = Math.max(1, Math.round(canvas.height * scale));
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0, w, h);
    return off.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
}
