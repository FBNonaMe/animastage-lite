import { probeEffectRenderer } from "../compatibility/EffectCapabilityProbe.js";

function cloneParameters(parameters) {
  if (typeof structuredClone === "function") {
    try { return structuredClone(parameters); } catch (_) {}
  }
  return JSON.parse(JSON.stringify(parameters || {}));
}

/**
 * Owns only Effects Platform layers. Legacy sliders keep their own state.
 * Every pass receives the latest active layer for its pass ID, while removing
 * one instance cannot reset unrelated passes or material effects.
 */
export class PostProcessingEffectBridge {
  #provider;
  #layers = new Map();

  constructor(provider, { profiler = null } = {}) {
    if (provider != null && typeof provider !== "function" && typeof provider !== "object") {
      throw new TypeError("Post-processing bridge requires a pass provider");
    }
    this.#provider = provider || (() => null);
    this.profiler = profiler;
  }

  getTarget() {
    return Object.freeze({ kind: "post-chain", id: "main-composer", ref: this });
  }

  capture() {
    return Object.freeze({
      schema: "animestage.post-effect-layers/v1",
      layers: Object.freeze([...this.#layers.entries()].map(([instanceId, layer]) => Object.freeze({
        instanceId,
        passId: layer.passId,
        parameters: cloneParameters(layer.parameters),
      }))),
    });
  }

  restore(snapshot) {
    if (!snapshot || snapshot.schema !== "animestage.post-effect-layers/v1") {
      throw new TypeError("Post-processing effect snapshot is invalid");
    }
    this.#layers.clear();
    for (const layer of snapshot.layers || []) {
      this.#layers.set(layer.instanceId, {
        passId: String(layer.passId),
        parameters: cloneParameters(layer.parameters),
      });
    }
    this.#syncAll();
  }

  assertPass(passId) {
    this.#profileAvailablePasses();
    const pass = this.#passes()[String(passId)];
    if (!pass || typeof pass.setParams !== "function") {
      throw new Error(`Post-processing pass "${passId}" is not available in this renderer`);
    }
    return true;
  }

  apply(instance, passId, parameters) {
    this.assertPass(passId);
    this.#layers.set(instance.instanceId, {
      passId: String(passId),
      parameters: cloneParameters(parameters),
    });
    this.#syncPass(String(passId));
  }

  update(instance, parameters) {
    const layer = this.#layers.get(instance.instanceId);
    if (!layer) throw new Error(`Post-processing layer ${instance.instanceId} is not active`);
    layer.parameters = cloneParameters(parameters);
    this.#syncPass(layer.passId);
  }

  remove(instance) {
    const layer = this.#layers.get(instance.instanceId);
    if (!layer) return false;
    this.#layers.delete(instance.instanceId);
    this.#syncPass(layer.passId);
    return true;
  }

  reorder(instances, graph = null) {
    this.#profileAvailablePasses();
    const requested = [];
    for (const instance of instances || []) {
      const id = typeof instance === "string" ? instance : instance?.instanceId;
      if (id && this.#layers.has(id) && !requested.includes(id)) requested.push(id);
    }
    const reordered = new Map();
    for (const id of requested) reordered.set(id, this.#layers.get(id));
    for (const [id, layer] of this.#layers) if (!reordered.has(id)) reordered.set(id, layer);
    this.#layers = reordered;
    const passIds = [];
    for (const layer of this.#layers.values()) if (!passIds.includes(layer.passId)) passIds.push(layer.passId);
    this.#hostSafe()?.reorderPasses?.(passIds, graph);
    this.#syncAll();
    return Object.freeze(passIds.slice());
  }

  updateFrame(frame) {
    const seen = new Set();
    for (const layer of this.#layers.values()) {
      if (seen.has(layer.passId)) continue;
      seen.add(layer.passId);
      this.#passes()[layer.passId]?.setFrame?.(frame);
    }
  }

  get layers() {
    return this.capture().layers;
  }

  getCompatibilityContext() {
    const host = this.#hostSafe();
    if (typeof host?.getCapabilities === "function") return host.getCapabilities();
    return host?.capabilities || probeEffectRenderer(host?.renderer || null, { passIds: Object.keys(host?.passes || {}) });
  }

  getPerformanceReport() {
    this.#profileAvailablePasses();
    return this.profiler?.getReport?.() || Object.freeze({
      schema: "animestage.effect-performance/v1", frameBudgetMs: 0,
      totalAverageMs: 0, budgetUse: 0, instrumented: 0, passes: Object.freeze([]),
    });
  }

  async renderPreview(definition, parameters, options = {}) {
    const host = this.#host();
    if (typeof host?.renderPreview !== "function") {
      throw new Error("This renderer does not provide isolated effect previews");
    }
    return host.renderPreview(definition, cloneParameters(parameters), { ...options });
  }

  #host() {
    return typeof this.#provider === "function" ? this.#provider() : this.#provider;
  }

  #hostSafe() {
    try { return this.#host(); } catch (_) { return null; }
  }

  #passes() {
    return this.#hostSafe()?.passes || {};
  }

  #profileAvailablePasses() {
    if (!this.profiler) return;
    for (const [passId, pass] of Object.entries(this.#passes())) {
      this.profiler.instrumentPass(passId, pass, { budgetMs: pass?.effectBudgetMs });
    }
  }

  #syncAll() {
    const passIds = new Set([...Object.keys(this.#passes()), ...[...this.#layers.values()].map((layer) => layer.passId)]);
    for (const passId of passIds) this.#syncPass(passId);
  }

  #syncPass(passId) {
    const pass = this.#passes()[passId];
    if (!pass || typeof pass.setParams !== "function") return;
    let selected = null;
    for (const layer of this.#layers.values()) if (layer.passId === passId) selected = layer;
    pass.setParams(selected?.parameters || {});
  }
}
