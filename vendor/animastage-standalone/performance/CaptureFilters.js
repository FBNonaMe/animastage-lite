export class OneEuroFilter {
  constructor(options = {}) {
    this.minCutoff = Math.max(0.01, Number(options.minCutoff) || 1);
    this.beta = Math.max(0, Number(options.beta) || 0.035);
    this.derivativeCutoff = Math.max(0.01, Number(options.derivativeCutoff) || 1);
    this.reset();
  }

  reset(value = 0, time = NaN) {
    this.value = value; this.derivative = 0; this.time = time; this.initialized = Number.isFinite(time);
  }

  _alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }

  filter(value, time) {
    if (!Number.isFinite(value) || !Number.isFinite(time)) return this.value;
    if (!this.initialized) { this.value = value; this.time = time; this.initialized = true; return value; }
    const dt = Math.max(1e-4, Math.min(0.25, time - this.time)); this.time = time;
    const derivative = (value - this.value) / dt;
    const da = this._alpha(this.derivativeCutoff, dt);
    this.derivative += (derivative - this.derivative) * da;
    const alpha = this._alpha(this.minCutoff + this.beta * Math.abs(this.derivative), dt);
    this.value += (value - this.value) * alpha;
    return this.value;
  }

  /** Exact runtime state used by offline-render transactions. */
  captureTransientState() {
    return {
      value: this.value,
      derivative: this.derivative,
      time: this.time,
      initialized: this.initialized,
    };
  }

  restoreTransientState(state) {
    if (!state || typeof state !== "object") return false;
    this.value = Number(state.value) || 0;
    this.derivative = Number(state.derivative) || 0;
    this.time = Number.isFinite(Number(state.time)) ? Number(state.time) : NaN;
    this.initialized = !!state.initialized;
    return true;
  }
}

export class OneEuroFilterBank {
  constructor(size, options = {}) {
    this.filters = Array.from({ length: Math.max(0, size | 0) }, () => new OneEuroFilter(options));
  }
  reset(values = null, time = NaN) { for (let i = 0; i < this.filters.length; i++) this.filters[i].reset(Number(values?.[i]) || 0, time); }
  filter(source, time, target) { for (let i = 0; i < this.filters.length; i++) target[i] = this.filters[i].filter(Number(source[i]) || 0, time); return target; }
  captureTransientState() { return this.filters.map((filter) => filter.captureTransientState()); }
  restoreTransientState(state) {
    if (!Array.isArray(state) || state.length !== this.filters.length) return false;
    for (let i = 0; i < this.filters.length; i++) this.filters[i].restoreTransientState(state[i]);
    return true;
  }
}

export function reduceCaptureKeys(keys, tolerance = 0.006) {
  if (!Array.isArray(keys) || keys.length <= 2) return Array.isArray(keys) ? keys.slice() : [];
  const keep = new Uint8Array(keys.length); keep[0] = 1; keep[keys.length - 1] = 1;
  const stack = [[0, keys.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop(); const a = keys[start], b = keys[end];
    let best = -1, bestError = tolerance;
    for (let i = start + 1; i < end; i++) {
      const u = (keys[i].time - a.time) / Math.max(1e-8, b.time - a.time);
      const error = Math.abs(keys[i].value - (a.value + (b.value - a.value) * u));
      if (error > bestError) { bestError = error; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([start, best], [best, end]); }
  }
  return keys.filter((_key, index) => keep[index]);
}
