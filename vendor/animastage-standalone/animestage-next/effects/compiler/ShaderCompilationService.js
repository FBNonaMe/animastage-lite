import { ShaderBackendUnavailableError } from "../core/EffectErrors.js";
import { reflectShaderSource } from "../reflection/ShaderReflection.js";

function compileKey(source, backend, options) {
  return `${source.cacheKey}|${backend.id}@${backend.revision || "1"}|${options.stage || "fragment"}|${options.entryPoint || source.entryPoint}`;
}

export class ShaderCompilationService {
  #cache = new Map();
  #pins = new Map();

  constructor({ backends = [], diagnostics = null, maxEntries = 32 } = {}) {
    this.backends = new Map(backends.map((backend) => [backend.id, backend]));
    this.diagnostics = diagnostics;
    this.maxEntries = Math.max(1, Math.floor(Number(maxEntries) || 32));
  }

  backendFor(source) {
    const id = source.language === "wgsl" ? "webgpu" : source.language === "glsl" ? "webgl2" : null;
    if (!id) throw new ShaderBackendUnavailableError(source.language, `${source.language.toUpperCase()} is indexed for adaptation but cannot execute natively in this browser`);
    const backend = this.backends.get(id);
    if (!backend) throw new ShaderBackendUnavailableError(id);
    return backend;
  }

  async compile(source, options = {}) {
    if (!source?.cacheKey) throw new TypeError("Compilation requires a ShaderSource");
    const backend = options.backend ? this.backends.get(String(options.backend)) : this.backendFor(source);
    if (!backend) throw new ShaderBackendUnavailableError(options.backend || "unknown");
    const key = compileKey(source, backend, options);
    if (!options.bypassCache && this.#cache.has(key)) {
      const cached = this.#cache.get(key);
      this.#cache.delete(key);
      this.#cache.set(key, cached);
      return Object.freeze({ ...cached, cacheHit: true });
    }
    const started = performance.now();
    try {
      const artifact = await backend.compile(source, options);
      const result = Object.freeze({
        schema: "animestage.shader-compilation/v1",
        key,
        source,
        backend: backend.id,
        stage: artifact.stage || options.stage || "fragment",
        entryPoint: artifact.entryPoint || options.entryPoint || source.entryPoint,
        reflection: reflectShaderSource(source),
        diagnostics: Object.freeze([...(artifact.diagnostics || [])]),
        durationMs: Math.max(0, performance.now() - started),
        artifact,
        cacheHit: false,
      });
      this.#cache.set(key, result);
      this.#trim();
      this.diagnostics?.emit?.({ severity: "info", code: "SHADER_COMPILED", message: `${source.id} compiled with ${backend.id}`, stageId: source.id, details: { stage: result.stage, durationMs: result.durationMs } });
      return result;
    } catch (error) {
      this.diagnostics?.emit?.({ severity: "error", code: error.code || "SHADER_COMPILATION_FAILED", message: error.message, stageId: source.id, details: { backend: backend.id, stage: options.stage, diagnostics: error.diagnostics || [] } });
      throw error;
    }
  }

  pin(key) { this.#pins.set(String(key), (this.#pins.get(String(key)) || 0) + 1); }
  unpin(key) {
    const id = String(key);
    const count = this.#pins.get(id) || 0;
    if (count <= 1) this.#pins.delete(id); else this.#pins.set(id, count - 1);
  }

  clear({ force = false } = {}) {
    for (const [key, result] of [...this.#cache]) {
      if (!force && this.#pins.has(key)) continue;
      result.artifact?.dispose?.();
      this.#cache.delete(key);
    }
  }

  get stats() { return Object.freeze({ entries: this.#cache.size, pinned: this.#pins.size, maxEntries: this.maxEntries, backends: Object.freeze([...this.backends.keys()]) }); }

  #trim() {
    while (this.#cache.size > this.maxEntries) {
      const oldest = [...this.#cache.keys()].find((key) => !this.#pins.has(key));
      if (oldest == null) break;
      const result = this.#cache.get(oldest);
      this.#cache.delete(oldest);
      result?.artifact?.dispose?.();
    }
  }
}

export class EffectSourceWorkbench {
  #current = null;
  #revision = 0;
  #lastFailure = null;

  constructor({ compiler, diagnostics = null } = {}) {
    if (!compiler) throw new TypeError("Source workbench requires a compiler");
    this.compiler = compiler;
    this.diagnostics = diagnostics;
  }

  async stage(source, options = {}) {
    const previous = this.#current;
    try {
      const compilation = await this.compiler.compile(source, options);
      this.compiler.pin(compilation.key);
      this.#current = Object.freeze({ revision: ++this.#revision, compilation, committedAt: Date.now() });
      if (previous?.compilation?.key) this.compiler.unpin(previous.compilation.key);
      this.#lastFailure = null;
      // Cached artifacts are shared and owned by the compiler. Never dispose
      // one here; compiler eviction/clear owns their lifetime.
      return Object.freeze({ committed: true, current: this.#current, previous });
    } catch (error) {
      this.#lastFailure = Object.freeze({ error, sourceId: source?.id || null, at: Date.now() });
      this.diagnostics?.emit?.({ severity: "warning", code: "SHADER_SWAP_ROLLED_BACK", message: `Kept revision ${previous?.revision || 0}: ${error.message}`, stageId: source?.id || null });
      return Object.freeze({ committed: false, current: previous, previous, error });
    }
  }

  get current() { return this.#current; }
  get lastFailure() { return this.#lastFailure; }
  get report() { return Object.freeze({ revision: this.#revision, active: !!this.#current, backend: this.#current?.compilation.backend || null, sourceId: this.#current?.compilation.source.id || null, lastFailure: this.#lastFailure?.error?.message || null }); }
}
