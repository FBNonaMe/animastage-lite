import { ShaderBackendUnavailableError, ShaderCompilationError } from "../../core/EffectErrors.js";
import { reflectShaderSource } from "../../reflection/ShaderReflection.js";

function normalizeMessage(message, sourceId) {
  return Object.freeze({
    severity: message.type === "warning" ? "warning" : message.type === "info" ? "info" : "error",
    message: String(message.message || "WebGPU shader diagnostic"),
    sourceId,
    line: Number(message.lineNum) || null,
    column: Number(message.linePos) || null,
    offset: Number(message.offset) || null,
    length: Number(message.length) || null,
  });
}

export class WebGPUShaderBackend {
  #adapter = null;
  #device = null;
  #devicePromise = null;

  constructor({ gpu = globalThis.navigator?.gpu || null, powerPreference = "high-performance" } = {}) {
    this.id = "webgpu";
    this.revision = "1";
    this.gpu = gpu;
    this.powerPreference = powerPreference;
  }

  get available() { return !!this.gpu?.requestAdapter; }
  get device() { return this.#device; }

  async ensureDevice() {
    if (this.#device) return this.#device;
    if (this.#devicePromise) return this.#devicePromise;
    if (!this.available) throw new ShaderBackendUnavailableError(this.id, "WebGPU is not exposed by this browser");
    this.#devicePromise = (async () => {
      this.#adapter = await this.gpu.requestAdapter({ powerPreference: this.powerPreference });
      if (!this.#adapter) throw new ShaderBackendUnavailableError(this.id, "No compatible WebGPU adapter was found");
      const device = await this.#adapter.requestDevice();
      device.lost?.then?.(() => { this.#device = null; this.#devicePromise = null; }).catch?.(() => {});
      this.#device = device;
      return device;
    })();
    try { return await this.#devicePromise; }
    catch (error) { this.#devicePromise = null; throw error; }
  }

  async compile(source, { stage = "fragment", entryPoint = source.entryPoint, signal = null } = {}) {
    if (source.language !== "wgsl") throw new TypeError("WebGPU backend accepts WGSL only");
    if (signal?.aborted) throw signal.reason || new DOMException("Compilation aborted", "AbortError");
    const requestedEntry = String(entryPoint || "main");
    const reflected = reflectShaderSource(source).entryPoints;
    if (!reflected.some((entry) => entry.name === requestedEntry && entry.stage === stage)) {
      throw new ShaderCompilationError(`WGSL ${stage} entry point "${requestedEntry}" was not found`, {
        backend: this.id, sourceId: source.id, stage,
        diagnostics: [{ severity: "error", message: `Expected @${stage} fn ${requestedEntry}(...)`, sourceId: source.id, line: null, column: null }],
      });
    }
    const device = await this.ensureDevice();
    if (signal?.aborted) throw signal.reason || new DOMException("Compilation aborted", "AbortError");
    let module;
    try { module = device.createShaderModule({ code: source.text, label: `AnimaStage:${source.id}` }); }
    catch (cause) {
      throw new ShaderCompilationError(cause?.message || "WGSL module creation failed", { backend: this.id, sourceId: source.id, stage, cause });
    }
    const info = typeof module.getCompilationInfo === "function" ? await module.getCompilationInfo() : { messages: [] };
    const diagnostics = Object.freeze(Array.from(info.messages || [], (message) => normalizeMessage(message, source.id)));
    const errors = diagnostics.filter((entry) => entry.severity === "error");
    if (errors.length) {
      throw new ShaderCompilationError(`WGSL compilation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}`, {
        backend: this.id, sourceId: source.id, stage, diagnostics,
      });
    }
    return {
      backend: this.id,
      stage,
      entryPoint: requestedEntry,
      module,
      isolated: true,
      diagnostics,
      dispose() {},
    };
  }
}
