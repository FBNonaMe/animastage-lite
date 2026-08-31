import { clamp01 } from "./PerformanceConstants.js";

const VALID_BLEND_MODES = new Set(["additive", "override", "maximum", "multiply"]);
const VALID_INTERPOLATION = new Set(["linear", "smooth", "ease", "cubic", "spring", "stepped"]);

function smoothstep(value) { return value * value * (3 - 2 * value); }

export class PerformanceLayer {
  constructor(id, options = {}) {
    this.id = id;
    this.label = options.label || id;
    this.enabled = options.enabled !== false;
    this.weight = clamp01(options.weight ?? 1);
    this.blendMode = VALID_BLEND_MODES.has(options.blendMode) ? options.blendMode : "additive";
    this.muted = !!options.muted;
    this.solo = !!options.solo;
    this.sideMask = { left: options.sideMask?.left !== false, right: options.sideMask?.right !== false };
    this.boneMask = new Set(options.boneMask || []);
    this.morphMask = new Set(options.morphMask || []);
    this.tracks = new Map();
  }

  setWeight(value) { this.weight = clamp01(value); return this; }
  setEnabled(value) { this.enabled = !!value; return this; }
  setMuted(value) { this.muted = !!value; return this; }
  setSolo(value) { this.solo = !!value; return this; }

  reset() {
    this.enabled = true;
    this.weight = 1;
    this.muted = false;
    this.solo = false;
    this.sideMask.left = true;
    this.sideMask.right = true;
    this.boneMask.clear();
    this.morphMask.clear();
    this.tracks.clear();
  }

  setKey(channel, time, value, interpolation = "smooth") {
    if (!channel || !Number.isFinite(time) || !Number.isFinite(value)) return false;
    const mode = VALID_INTERPOLATION.has(interpolation) ? interpolation : "smooth";
    let keys = this.tracks.get(channel);
    if (!keys) { keys = []; this.tracks.set(channel, keys); }
    const at = keys.findIndex((key) => Math.abs(key.time - time) < 1e-5);
    const key = { time: Math.max(0, time), value, interpolation: mode };
    if (at >= 0) keys[at] = key;
    else {
      keys.push(key);
      keys.sort((a, b) => a.time - b.time);
    }
    return true;
  }

  deleteKey(channel, time, tolerance = 1e-4) {
    const keys = this.tracks.get(channel);
    if (!keys) return false;
    const at = keys.findIndex((key) => Math.abs(key.time - time) <= tolerance);
    if (at < 0) return false;
    keys.splice(at, 1);
    if (!keys.length) this.tracks.delete(channel);
    return true;
  }

  sample(channel, time, fallback = 0) {
    const keys = this.tracks.get(channel);
    if (!keys?.length) return fallback;
    if (time <= keys[0].time) return keys[0].value;
    const last = keys[keys.length - 1];
    if (time >= last.time) return last.value;
    let lo = 0, hi = keys.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (keys[mid].time <= time) lo = mid;
      else hi = mid;
    }
    const a = keys[lo], b = keys[hi];
    if (a.interpolation === "stepped") return a.value;
    let alpha = (time - a.time) / Math.max(1e-8, b.time - a.time);
    if (a.interpolation === "smooth") alpha = smoothstep(alpha);
    else if (a.interpolation === "ease") alpha = alpha < 0.5 ? 2 * alpha * alpha : 1 - Math.pow(-2 * alpha + 2, 2) / 2;
    else if (a.interpolation === "cubic") alpha = alpha * alpha * alpha * (alpha * (alpha * 6 - 15) + 10);
    else if (a.interpolation === "spring") alpha = 1 - Math.exp(-6 * alpha) * Math.cos(8 * alpha);
    return a.value + (b.value - a.value) * alpha;
  }

  toJSON() {
    return {
      id: this.id,
      enabled: this.enabled,
      weight: this.weight,
      blendMode: this.blendMode,
      muted: this.muted,
      solo: this.solo,
      sideMask: { ...this.sideMask },
      boneMask: [...this.boneMask],
      morphMask: [...this.morphMask],
      tracks: Object.fromEntries([...this.tracks].map(([name, keys]) => [name, keys.map((key) => ({ ...key }))])),
    };
  }

  restore(data) {
    if (!data || data.id !== this.id) return false;
    this.enabled = data.enabled !== false;
    this.weight = clamp01(data.weight ?? 1);
    this.blendMode = VALID_BLEND_MODES.has(data.blendMode) ? data.blendMode : "additive";
    this.muted = !!data.muted;
    this.solo = !!data.solo;
    this.sideMask.left = data.sideMask?.left !== false;
    this.sideMask.right = data.sideMask?.right !== false;
    this.boneMask = new Set(Array.isArray(data.boneMask) ? data.boneMask : []);
    this.morphMask = new Set(Array.isArray(data.morphMask) ? data.morphMask : []);
    this.tracks.clear();
    for (const [channel, keys] of Object.entries(data.tracks || {})) {
      for (const key of keys || []) this.setKey(channel, Number(key.time), Number(key.value), key.interpolation);
    }
    return true;
  }
}
