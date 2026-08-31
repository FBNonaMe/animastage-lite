import { normalizeEffectParameterValues } from "../parameters/EffectParameters.js";
import { createEffectPreviewKey, EffectPreviewCache } from "./EffectPreviewCache.js";

export class EffectPreviewService {
  #inflight = new Map();

  constructor({ registry, adapter, compatibility = null, diagnostics = null, cache = null, persistentStore = null } = {}) {
    if (!registry || !adapter) throw new TypeError("Effect preview service requires registry and adapter");
    this.registry = registry;
    this.adapter = adapter;
    this.compatibility = compatibility;
    this.diagnostics = diagnostics;
    this.cache = cache || new EffectPreviewCache();
    this.persistentStore = persistentStore;
  }

  async render(reference, options = {}) {
    const definition = reference?.manifest ? reference : this.registry.require(reference);
    const manifest = definition.manifest;
    if (!manifest.preview.enabled) throw new Error(`${manifest.name} does not declare an isolated preview`);
    const compatibility = this.compatibility?.evaluate?.(definition);
    if (compatibility && !compatibility.pending && !compatibility.compatible) {
      throw new Error(`${manifest.name} preview is unsupported: ${compatibility.reasons.join(", ")}`);
    }
    const width = this.#dimension(options.width, manifest.preview.width);
    const height = this.#dimension(options.height, manifest.preview.height);
    const parameters = normalizeEffectParameterValues(manifest.parameters, options.parameters || {});
    const key = createEffectPreviewKey({
      effectKey: definition.key,
      parameters,
      width,
      height,
      renderer: manifest.preview.renderer,
      cacheRevision: manifest.preview.cacheRevision,
      seed: Number(options.seed) || 1,
    });
    if (this.#inflight.has(key)) {
      const shared = await this.#inflight.get(key);
      return Object.freeze({ ...shared, cacheHit: true, deduplicated: true });
    }
    const pending = this.#renderResolved({ key, definition, manifest, parameters, width, height, options });
    this.#inflight.set(key, pending);
    try { return await pending; }
    finally { this.#inflight.delete(key); }
  }

  async #renderResolved({ key, definition, manifest, parameters, width, height, options }) {
    const memory = this.cache.get(key);
    if (memory) return Object.freeze({ record: memory, cacheHit: true, persistentHit: false });
    try {
      const stored = await this.persistentStore?.get?.(key);
      if (stored?.blob) {
        const record = this.cache.set(key, stored, { effectKey: definition.key, width, height, backend: stored.backend || manifest.preview.renderer });
        this.#diagnose(true, definition, manifest, key, width, height, record, true);
        return Object.freeze({ record, cacheHit: true, persistentHit: true });
      }
    } catch (error) {
      this.diagnostics?.emit?.({ severity: "warning", code: "EFFECT_PREVIEW_PERSISTENCE_READ_FAILED", message: error.message, stageId: definition.key });
    }
    const resolved = await this.cache.resolve(key, async () => {
      const result = await this.adapter.renderPreview?.(definition, parameters, {
        width,
        height,
        seed: Number(options.seed) || 1,
        background: manifest.preview.background,
      });
      if (!result || result.isolated !== true) {
        throw new Error("Preview adapter violated isolation contract");
      }
      return result;
    }, { effectKey: definition.key, width, height, backend: manifest.preview.renderer });
    if (!resolved.cacheHit) {
      try { await this.persistentStore?.put?.(key, resolved.record, { effectKey: definition.key, width, height, backend: manifest.preview.renderer }); }
      catch (error) { this.diagnostics?.emit?.({ severity: "warning", code: "EFFECT_PREVIEW_PERSISTENCE_WRITE_FAILED", message: error.message, stageId: definition.key }); }
    }
    this.#diagnose(resolved.cacheHit, definition, manifest, key, width, height, resolved.record, false);
    return resolved;
  }

  #diagnose(cacheHit, definition, manifest, key, width, height, record, persistentHit) {
    this.diagnostics?.emit?.({
      severity: "info", code: cacheHit ? "EFFECT_PREVIEW_CACHE_HIT" : "EFFECT_PREVIEW_RENDERED",
      message: cacheHit
        ? `Used ${persistentHit ? "persistent " : ""}cached isolated preview for ${manifest.name}`
        : `Rendered isolated preview for ${manifest.name}`,
      stageId: definition.key,
      details: { key, width, height, bytes: record.bytes, persistentHit },
    });
  }

  clearCache() { this.cache.clear(); return this.persistentStore?.clear?.(); }
  get stats() { return Object.freeze({ ...this.cache.stats, persistent: !!this.persistentStore?.available }); }

  #dimension(value, fallback) {
    const number = Math.floor(Number(value) || fallback);
    return Math.min(2048, Math.max(32, number));
  }
}
