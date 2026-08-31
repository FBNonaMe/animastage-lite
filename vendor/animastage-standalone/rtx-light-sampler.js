"use strict";

export function luminance(color) {
  const r = Number(color?.r ?? color?.x ?? color?.[0] ?? 0);
  const g = Number(color?.g ?? color?.y ?? color?.[1] ?? 0);
  const b = Number(color?.b ?? color?.z ?? color?.[2] ?? 0);
  return Math.max(0, r * 0.2126 + g * 0.7152 + b * 0.0722);
}

export function powerHeuristic(pdfA, pdfB) {
  const a = Math.max(0, Number(pdfA) || 0);
  const b = Math.max(0, Number(pdfB) || 0);
  const aa = a * a;
  const bb = b * b;
  return aa + bb > 0 ? aa / (aa + bb) : 0;
}

/**
 * CPU owner of the discrete light-selection distribution. Geometry/solid-angle
 * PDFs remain in the shader; this class supplies only P(select light).
 */
export class RtxLightSampler {
  constructor(maxLights = 8) {
    this.maxLights = Math.max(1, maxLights | 0);
    this.count = 0;
    this.totalPower = 0;
    this.pdf = new Float32Array(this.maxLights);
    this.cdf = new Float32Array(this.maxLights);
    this.sourceIndices = new Int32Array(this.maxLights).fill(-1);
    this.generation = 0;
  }

  rebuild(lights = []) {
    this.pdf.fill(0);
    this.cdf.fill(1);
    this.sourceIndices.fill(-1);
    const accepted = [];
    for (let sourceIndex = 0; sourceIndex < lights.length; sourceIndex++) {
      if (accepted.length >= this.maxLights) break;
      const light = lights[sourceIndex];
      if (!light || light.enabled === false) continue;
      const emitted = luminance(light.emission ?? light.color) *
        Math.max(0, Number(light.intensity ?? 1));
      const area = Math.max(1e-8, Number(light.effectiveArea ?? light.area ?? 1));
      const importance = Math.max(0, Number(light.visibilityImportance ?? 1));
      const userWeight = Math.max(0, Number(light.samplingWeight ?? 1));
      const power = emitted * area * importance * userWeight;
      if (!(power > 0) || !Number.isFinite(power)) continue;
      accepted.push({ sourceIndex, power });
    }

    this.count = accepted.length;
    this.totalPower = accepted.reduce((sum, item) => sum + item.power, 0);
    let cumulative = 0;
    for (let i = 0; i < accepted.length; i++) {
      const p = accepted[i].power / this.totalPower;
      this.pdf[i] = p;
      cumulative += p;
      this.cdf[i] = Math.min(1, cumulative);
      this.sourceIndices[i] = accepted[i].sourceIndex;
    }
    if (accepted.length) this.cdf[accepted.length - 1] = 1;
    this.generation++;
    return this.snapshot();
  }

  sample(unitRandom) {
    if (!this.count) return null;
    const u = Math.min(1 - Number.EPSILON, Math.max(0, Number(unitRandom) || 0));
    let slot = 0;
    while (slot + 1 < this.count && u > this.cdf[slot]) slot++;
    return {
      slot,
      sourceIndex: this.sourceIndices[slot],
      pdf: this.pdf[slot],
    };
  }

  strategyPdfs(sunPower) {
    const sun = Math.max(0, Number(sunPower) || 0);
    const map = this.totalPower;
    if (sun <= 0 && map <= 0) return { sun: 0, map: 0 };
    if (map <= 0) return { sun: 1, map: 0 };
    if (sun <= 0) return { sun: 0, map: 1 };
    const sunPdf = Math.min(0.95, Math.max(0.05, sun / (sun + map)));
    return { sun: sunPdf, map: 1 - sunPdf };
  }

  snapshot() {
    return {
      generation: this.generation,
      count: this.count,
      totalPower: this.totalPower,
      pdf: Array.from(this.pdf),
      cdf: Array.from(this.cdf),
      sourceIndices: Array.from(this.sourceIndices),
    };
  }
}

/** Luminance×sin(theta) environment distribution with solid-angle PDFs. */
export class RtxEnvironmentDistribution {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.total = 0;
    this.pdf = new Float64Array(0);
    this.cdf = new Float64Array(0);
  }

  rebuild(luminanceTexels, width, height) {
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);
    if (!luminanceTexels || luminanceTexels.length < w * h) {
      throw new Error("Environment luminance buffer is smaller than width*height");
    }
    this.width = w;
    this.height = h;
    this.pdf = new Float64Array(w * h);
    this.cdf = new Float64Array(w * h);
    this.total = 0;
    for (let y = 0; y < h; y++) {
      const theta = Math.PI * ((y + 0.5) / h);
      const sinTheta = Math.max(1e-8, Math.sin(theta));
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const weight = Math.max(0, Number(luminanceTexels[i]) || 0) * sinTheta;
        this.pdf[i] = weight;
        this.total += weight;
      }
    }
    if (!(this.total > 0)) {
      this.total = w * h;
      this.pdf.fill(1);
    }
    let cumulative = 0;
    for (let i = 0; i < this.pdf.length; i++) {
      this.pdf[i] /= this.total;
      cumulative += this.pdf[i];
      this.cdf[i] = Math.min(1, cumulative);
    }
    this.cdf[this.cdf.length - 1] = 1;
    return this;
  }

  sample(unitRandom) {
    if (!this.cdf.length) return null;
    const u = Math.min(1 - Number.EPSILON, Math.max(0, Number(unitRandom) || 0));
    let lo = 0;
    let hi = this.cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (u <= this.cdf[mid]) hi = mid;
      else lo = mid + 1;
    }
    const x = lo % this.width;
    const y = Math.floor(lo / this.width);
    const theta = Math.PI * ((y + 0.5) / this.height);
    const sinTheta = Math.max(1e-8, Math.sin(theta));
    const texelSolidAngle = (2 * Math.PI / this.width) *
      (Math.PI / this.height) * sinTheta;
    return {
      index: lo,
      x,
      y,
      uv: [(x + 0.5) / this.width, (y + 0.5) / this.height],
      pdfTexel: this.pdf[lo],
      pdfSolidAngle: this.pdf[lo] / texelSolidAngle,
    };
  }
}
