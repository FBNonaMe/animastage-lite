/**
 * Deterministic CPU fallback used only when the WebGPU UNet cannot return a
 * valid frame. This edge-aware, multi-scale à-trous filter averages
 * Monte-Carlo outliers while retaining real color boundaries.
 */
export function edgePreservingFallbackRGBA(source, width, height, {
  passes = 2,
  strength = 0.68,
} = {}) {
  const w = Math.max(1, width | 0), h = Math.max(1, height | 0);
  if (!source || source.length !== w * h * 4) throw new Error("invalid RGBA fallback input");
  const amount = Math.max(0, Math.min(1, Number(strength) || 0));
  const count = Math.max(1, Math.min(4, passes | 0));
  let input = new Uint8ClampedArray(source);
  let output = new Uint8ClampedArray(input.length);
  const spatial = [0.72, 1, 0.72, 1, 1.65, 1, 0.72, 1, 0.72];
  const offsets = [-1, 0, 1];
  for (let pass = 0; pass < count; pass++) {
    const step = 1 << pass;
    const sigma = 54 + pass * 18;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const center = (y * w + x) * 4;
      const cr = input[center], cg = input[center + 1], cb = input[center + 2];
      let sumR = 0, sumG = 0, sumB = 0, sumW = 0, kernel = 0;
      for (const oy of offsets) {
        const sy = Math.max(0, Math.min(h - 1, y + oy * step));
        for (const ox of offsets) {
          const sx = Math.max(0, Math.min(w - 1, x + ox * step));
          const at = (sy * w + sx) * 4;
          const dr = Math.abs(input[at] - cr);
          const dg = Math.abs(input[at + 1] - cg);
          const db = Math.abs(input[at + 2] - cb);
          const difference = (dr + dg + db) / 3;
          const ratio = difference / sigma;
          const weight = spatial[kernel++] / (1 + ratio * ratio);
          sumR += input[at] * weight;
          sumG += input[at + 1] * weight;
          sumB += input[at + 2] * weight;
          sumW += weight;
        }
      }
      const keep = 1 - amount;
      output[center] = cr * keep + (sumR / sumW) * amount;
      output[center + 1] = cg * keep + (sumG / sumW) * amount;
      output[center + 2] = cb * keep + (sumB / sumW) * amount;
      output[center + 3] = input[center + 3];
    }
    [input, output] = [output, input];
  }
  return input;
}

/**
 * Conservative post-denoise detail recovery. It sharpens only the already
 * filtered image, so unlike blending the raw Monte-Carlo frame back in it
 * cannot re-introduce colored fireflies. Per-channel correction is limited to
 * avoid halos on hard anime outlines.
 */
export function recoverDenoisedDetailRGBA(source, width, height, {
  amount = 0.18,
  limit = 12,
} = {}) {
  const w = Math.max(1, width | 0), h = Math.max(1, height | 0);
  if (!source || source.length !== w * h * 4) {
    throw new Error("invalid RGBA detail-recovery input");
  }
  const gain = Math.max(0, Math.min(0.5, Number(amount) || 0));
  const cap = Math.max(0, Math.min(48, Number(limit) || 0));
  const input = source instanceof Uint8ClampedArray
    ? source
    : new Uint8ClampedArray(source);
  if (!gain || !cap || w < 2 || h < 2) return new Uint8ClampedArray(input);
  const output = new Uint8ClampedArray(input.length);
  for (let y = 0; y < h; y++) {
    const yu = Math.max(0, y - 1), yd = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const xl = Math.max(0, x - 1), xr = Math.min(w - 1, x + 1);
      const at = (y * w + x) * 4;
      const left = (y * w + xl) * 4;
      const right = (y * w + xr) * 4;
      const up = (yu * w + x) * 4;
      const down = (yd * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = input[at + c];
        const blur =
          (input[left + c] + input[right + c] +
            input[up + c] + input[down + c]) * 0.25;
        const correction = Math.max(
          -cap,
          Math.min(cap, (center - blur) * gain),
        );
        output[at + c] = center + correction;
      }
      output[at + 3] = input[at + 3];
    }
  }
  return output;
}
