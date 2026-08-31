function freezeRecord(value) {
  return Object.freeze({ ...value });
}

function safeParameter(gl, name, fallback = 0) {
  try {
    const token = gl?.[name];
    if (token == null) return fallback;
    const value = gl.getParameter(token);
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  } catch (_) { return fallback; }
}

function safeExtension(gl, name) {
  try { return gl?.getExtension?.(name) || null; }
  catch (_) { return null; }
}

function rendererIdentity(gl) {
  const debug = safeExtension(gl, "WEBGL_debug_renderer_info");
  let vendor = "WebGL";
  let renderer = "Browser GPU";
  try {
    if (debug) {
      vendor = String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) || vendor);
      renderer = String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || renderer);
    }
  } catch (_) {}
  return freezeRecord({ vendor, renderer });
}

/**
 * Side-effect free renderer capability snapshot. It never creates textures,
 * framebuffers or shader programs, so opening Shader Studio cannot disturb the
 * active scene or the renderer state.
 */
export function probeEffectRenderer(renderer, { passIds = [] } = {}) {
  if (!renderer || typeof renderer.getContext !== "function") {
    return Object.freeze({
      schema: "animestage.effect-capabilities/v1",
      available: false,
      backend: "pending",
      device: freezeRecord({ vendor: "", renderer: "Renderer not ready" }),
      features: Object.freeze([]),
      languages: Object.freeze([]),
      limits: freezeRecord({}),
      passes: Object.freeze([...passIds]),
    });
  }
  let gl = null;
  try { gl = renderer.getContext(); } catch (_) {}
  if (!gl) return probeEffectRenderer(null, { passIds });
  const webgl2 = typeof globalThis.WebGL2RenderingContext !== "undefined"
    ? gl instanceof globalThis.WebGL2RenderingContext
    : typeof gl.beginQuery === "function";
  const timerQuery = !!safeExtension(gl, webgl2 ? "EXT_disjoint_timer_query_webgl2" : "EXT_disjoint_timer_query");
  const floatColor = !!safeExtension(gl, "EXT_color_buffer_float");
  const floatLinear = !!safeExtension(gl, "OES_texture_float_linear");
  const anisotropic = !!(
    safeExtension(gl, "EXT_texture_filter_anisotropic")
    || safeExtension(gl, "WEBKIT_EXT_texture_filter_anisotropic")
    || safeExtension(gl, "MOZ_EXT_texture_filter_anisotropic")
  );
  const features = new Set([
    webgl2 ? "webgl2" : "webgl1",
    "glsl",
    "javascript",
    "native",
    "effect-composer",
    "post-processing",
    "deterministic-frame-context",
  ]);
  if (timerQuery) features.add("gpu-timer-query");
  if (floatColor) features.add("float-color-buffer");
  if (floatLinear) features.add("float-texture-linear");
  if (anisotropic) features.add("anisotropic-filtering");
  const limits = {
    maxTextureSize: safeParameter(gl, "MAX_TEXTURE_SIZE"),
    maxCubeMapTextureSize: safeParameter(gl, "MAX_CUBE_MAP_TEXTURE_SIZE"),
    maxTextureUnits: safeParameter(gl, "MAX_TEXTURE_IMAGE_UNITS"),
    maxCombinedTextureUnits: safeParameter(gl, "MAX_COMBINED_TEXTURE_IMAGE_UNITS"),
    maxVertexTextureUnits: safeParameter(gl, "MAX_VERTEX_TEXTURE_IMAGE_UNITS"),
    maxDrawBuffers: webgl2 ? safeParameter(gl, "MAX_DRAW_BUFFERS", 1) : 1,
    maxColorAttachments: webgl2 ? safeParameter(gl, "MAX_COLOR_ATTACHMENTS", 1) : 1,
    maxSamples: webgl2 ? safeParameter(gl, "MAX_SAMPLES", 0) : 0,
  };
  return Object.freeze({
    schema: "animestage.effect-capabilities/v1",
    available: true,
    backend: webgl2 ? "webgl2" : "webgl1",
    device: rendererIdentity(gl),
    features: Object.freeze([...features].sort()),
    languages: Object.freeze(["glsl", "javascript", "native"]),
    limits: freezeRecord(limits),
    passes: Object.freeze([...passIds]),
  });
}

export class EffectCompatibilityService {
  constructor({ registry, adapter, diagnostics = null } = {}) {
    if (!registry || !adapter) throw new TypeError("EffectCompatibilityService requires registry and adapter");
    this.registry = registry;
    this.adapter = adapter;
    this.diagnostics = diagnostics;
  }

  get context() {
    try { return this.adapter.getCompatibilityContext?.() || probeEffectRenderer(null); }
    catch (_) { return probeEffectRenderer(null); }
  }

  evaluate(reference) {
    const definition = typeof reference === "string" ? this.registry.resolve(reference) : reference;
    const context = this.context;
    const result = this.registry.getCompatibility(definition, context);
    if (context.available !== false) return result;
    // During startup the lazy renderer provider can still be in its temporal
    // dead zone. Keep cards usable and label the result pending; apply-time
    // resolution runs again after initialization.
    return Object.freeze({ ...result, compatible: result.runnable, pending: true, reasons: Object.freeze(["renderer-pending"]) });
  }

  resolve(reference, { allowFallback = true } = {}) {
    const definition = typeof reference === "string" ? this.registry.require(reference) : reference;
    const primary = this.evaluate(definition);
    if (primary.compatible) return Object.freeze({ definition, compatibility: primary, fallbackFrom: null });
    const requirements = definition.manifest.requirements;
    if (allowFallback && requirements.policy === "fallback" && requirements.fallbackEffect) {
      const fallback = this.registry.resolve(requirements.fallbackEffect);
      const fallbackCompatibility = fallback ? this.evaluate(fallback) : null;
      if (fallback && fallbackCompatibility?.compatible) {
        this.diagnostics?.emit?.({
          severity: "warning",
          code: "EFFECT_CAPABILITY_FALLBACK",
          message: `${definition.manifest.name} is not supported; ${fallback.manifest.name} was selected safely`,
          stageId: definition.key,
          details: { requested: definition.key, fallback: fallback.key, reasons: primary.reasons },
        });
        return Object.freeze({ definition: fallback, compatibility: fallbackCompatibility, fallbackFrom: definition });
      }
    }
    return Object.freeze({ definition: null, compatibility: primary, fallbackFrom: definition });
  }
}
