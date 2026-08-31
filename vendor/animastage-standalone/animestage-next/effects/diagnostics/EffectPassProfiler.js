function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const ordered = values.slice().sort((a, b) => a - b);
  const index = Math.max(0, Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1));
  return ordered[index];
}

function summarize(values) {
  if (!values.length) return Object.freeze({ samples: 0, averageMs: 0, p95Ms: 0, maxMs: 0, lastMs: 0 });
  return Object.freeze({
    samples: values.length,
    averageMs: values.reduce((sum, value) => sum + value, 0) / values.length,
    p95Ms: percentile(values, 0.95),
    maxMs: Math.max(...values),
    lastMs: values[values.length - 1],
  });
}

function boundedPush(values, value, capacity) {
  if (!Number.isFinite(value) || value < 0) return;
  values.push(value);
  if (values.length > capacity) values.splice(0, values.length - capacity);
}

/**
 * Instruments EffectComposer passes without changing their shader code or
 * render order. CPU timing always works; WebGL2 timer queries are used when
 * available and automatically fall back to CPU-only sampling otherwise.
 */
export class EffectPassProfiler {
  #records = new Map();
  #instrumented = new Map();
  #gpuContexts = new WeakMap();
  #diagnostics;
  #now;

  constructor({
    diagnostics = null,
    frameBudgetMs = 16.667,
    defaultPassBudgetMs = 4,
    sampleWindow = 180,
    warningAfterSamples = 30,
    now = () => globalThis.performance?.now?.() ?? Date.now(),
  } = {}) {
    this.#diagnostics = diagnostics;
    this.#now = now;
    this.frameBudgetMs = Math.max(1, finite(frameBudgetMs, 16.667));
    this.defaultPassBudgetMs = Math.max(0.1, finite(defaultPassBudgetMs, 4));
    this.sampleWindow = Math.max(8, Math.trunc(finite(sampleWindow, 180)));
    this.warningAfterSamples = Math.max(1, Math.trunc(finite(warningAfterSamples, 30)));
  }

  instrumentPass(passId, pass, { budgetMs = this.defaultPassBudgetMs } = {}) {
    const id = String(passId || "").trim();
    if (!id || !pass || typeof pass.render !== "function") return false;
    const existing = this.#instrumented.get(id);
    if (existing?.pass === pass) return true;
    if (existing) this.uninstrumentPass(id);
    const record = this.#record(id, budgetMs);
    const original = pass.render;
    const profiler = this;
    function profiledRender(...args) {
      const renderer = args[0];
      profiler.#pollGpu(renderer);
      const query = profiler.#beginGpu(renderer, record);
      const startedAt = profiler.#now();
      try { return original.apply(this, args); }
      finally {
        boundedPush(record.cpu, Math.max(0, profiler.#now() - startedAt), profiler.sampleWindow);
        profiler.#endGpu(renderer, query);
        profiler.#checkBudget(record);
      }
    }
    try { pass.render = profiledRender; }
    catch (_) { return false; }
    this.#instrumented.set(id, { pass, original, wrapper: profiledRender });
    return true;
  }

  uninstrumentPass(passId) {
    const id = String(passId);
    const entry = this.#instrumented.get(id);
    if (!entry) return false;
    if (entry.pass.render === entry.wrapper) {
      try { entry.pass.render = entry.original; } catch (_) {}
    }
    this.#instrumented.delete(id);
    return true;
  }

  reset(passId = null) {
    const records = passId == null ? this.#records.values() : [this.#records.get(String(passId))].filter(Boolean);
    for (const record of records) {
      record.cpu.length = 0;
      record.gpu.length = 0;
      record.overBudget = false;
      record.warningIssued = false;
    }
  }

  dispose() {
    for (const id of [...this.#instrumented.keys()]) this.uninstrumentPass(id);
    this.#records.clear();
  }

  getReport() {
    const passes = [...this.#records.values()].map((record) => {
      const cpu = summarize(record.cpu);
      const gpu = summarize(record.gpu);
      const effective = gpu.samples ? gpu : cpu;
      return Object.freeze({
        passId: record.passId,
        budgetMs: record.budgetMs,
        overBudget: effective.samples >= this.warningAfterSamples && effective.averageMs > record.budgetMs,
        timingSource: gpu.samples ? "gpu" : "cpu",
        cpu,
        gpu,
      });
    }).sort((a, b) => b.gpu.averageMs - a.gpu.averageMs || b.cpu.averageMs - a.cpu.averageMs || a.passId.localeCompare(b.passId));
    const totalAverageMs = passes.reduce((sum, pass) => sum + (pass.gpu.samples ? pass.gpu.averageMs : pass.cpu.averageMs), 0);
    return Object.freeze({
      schema: "animestage.effect-performance/v1",
      frameBudgetMs: this.frameBudgetMs,
      totalAverageMs,
      budgetUse: this.frameBudgetMs ? totalAverageMs / this.frameBudgetMs : 0,
      instrumented: this.#instrumented.size,
      passes: Object.freeze(passes),
    });
  }

  #record(passId, budgetMs) {
    let record = this.#records.get(passId);
    if (!record) {
      record = { passId, budgetMs: Math.max(0.1, finite(budgetMs, this.defaultPassBudgetMs)), cpu: [], gpu: [], warningIssued: false, overBudget: false };
      this.#records.set(passId, record);
    } else record.budgetMs = Math.max(0.1, finite(budgetMs, record.budgetMs));
    return record;
  }

  #gpuState(renderer) {
    let gl = null;
    try { gl = renderer?.getContext?.() || null; } catch (_) {}
    if (!gl || typeof gl.createQuery !== "function" || typeof gl.beginQuery !== "function") return null;
    let state = this.#gpuContexts.get(gl);
    if (state) return state.available ? state : null;
    let extension = null;
    try { extension = gl.getExtension("EXT_disjoint_timer_query_webgl2"); } catch (_) {}
    state = { gl, extension, available: !!extension, pending: [], active: false };
    this.#gpuContexts.set(gl, state);
    if (!state.available) {
      this.#diagnostics?.emit?.({
        severity: "info", code: "EFFECT_GPU_TIMER_CPU_FALLBACK",
        message: "GPU timer queries are unavailable; effect profiling uses safe CPU timing",
      });
      return null;
    }
    return state;
  }

  #beginGpu(renderer, record) {
    const state = this.#gpuState(renderer);
    if (!state || state.active || state.pending.length >= 12) return null;
    try {
      const query = state.gl.createQuery();
      state.gl.beginQuery(state.extension.TIME_ELAPSED_EXT, query);
      state.active = true;
      return { state, query, record };
    } catch (_) {
      state.active = false;
      return null;
    }
  }

  #endGpu(_renderer, token) {
    if (!token) return;
    try {
      token.state.gl.endQuery(token.state.extension.TIME_ELAPSED_EXT);
      token.state.pending.push(token);
    } catch (_) {
      try { token.state.gl.deleteQuery(token.query); } catch (_) {}
    } finally { token.state.active = false; }
  }

  #pollGpu(renderer) {
    const state = this.#gpuState(renderer);
    if (!state?.pending.length) return;
    let disjoint = false;
    try { disjoint = !!state.gl.getParameter(state.extension.GPU_DISJOINT_EXT); } catch (_) {}
    const keep = [];
    for (const token of state.pending) {
      let available = false;
      try { available = !!state.gl.getQueryParameter(token.query, state.gl.QUERY_RESULT_AVAILABLE); }
      catch (_) { available = true; disjoint = true; }
      if (!available) { keep.push(token); continue; }
      if (!disjoint) {
        try {
          const nanoseconds = Number(state.gl.getQueryParameter(token.query, state.gl.QUERY_RESULT));
          boundedPush(token.record.gpu, nanoseconds / 1e6, this.sampleWindow);
        } catch (_) {}
      }
      try { state.gl.deleteQuery(token.query); } catch (_) {}
    }
    state.pending = keep;
  }

  #checkBudget(record) {
    const values = record.gpu.length ? record.gpu : record.cpu;
    if (values.length < this.warningAfterSamples) return;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const over = average > record.budgetMs;
    if (over && !record.warningIssued) {
      record.warningIssued = true;
      this.#diagnostics?.emit?.({
        severity: "warning", code: "EFFECT_PASS_OVER_BUDGET",
        message: `${record.passId} exceeds its ${record.budgetMs.toFixed(2)} ms pass budget`,
        stageId: record.passId,
        details: { averageMs: average, source: record.gpu.length ? "gpu" : "cpu", samples: values.length },
      });
    } else if (!over && average < record.budgetMs * 0.8) record.warningIssued = false;
    record.overBudget = over;
  }
}
