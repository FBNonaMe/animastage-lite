import { ShaderBackendUnavailableError, ShaderCompilationError } from "../../core/EffectErrors.js";

const DEFAULT_VERTEX = `#version 300 es
precision highp float;
const vec2 POSITIONS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){ gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0); }`;
const DEFAULT_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
void main(){ outColor = vec4(1.0); }`;

function normalizeSource(text) {
  const source = String(text || "");
  if (/^\s*#version\b/m.test(source)) return source;
  return `#version 300 es\nprecision highp float;\n#line 1\n${source}`;
}

function parseLog(log, sourceId) {
  return String(log || "").replaceAll("\0", "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean).map((message) => {
    const match = /(?:ERROR|WARNING):\s*\d+:(\d+)(?::(\d+))?\s*:?\s*(.*)/i.exec(message)
      || /0\((\d+)\)\s*:\s*(?:error|warning)\s*[^:]*:\s*(.*)/i.exec(message);
    return Object.freeze({
      severity: /warning/i.test(message) ? "warning" : "error",
      message: match ? (match[3] || match[2] || message).trim() : message.trim(),
      sourceId,
      line: match ? Number(match[1]) || null : null,
      column: match && match[3] ? Number(match[2]) || null : null,
    });
  });
}

export class WebGL2ShaderBackend {
  constructor({ canvasFactory = null, contextAttributes = {} } = {}) {
    this.id = "webgl2";
    this.revision = "1";
    this.canvasFactory = canvasFactory || (() => globalThis.document?.createElement?.("canvas") || null);
    this.contextAttributes = { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, ...contextAttributes };
  }

  get available() {
    try { return !!this.canvasFactory?.()?.getContext?.("webgl2", this.contextAttributes); }
    catch (_) { return false; }
  }

  async compile(source, { stage = "fragment", signal = null } = {}) {
    if (source.language !== "glsl") throw new TypeError("WebGL2 backend accepts GLSL only");
    if (signal?.aborted) throw signal.reason || new DOMException("Compilation aborted", "AbortError");
    const canvas = this.canvasFactory?.();
    const gl = canvas?.getContext?.("webgl2", this.contextAttributes);
    if (!gl) throw new ShaderBackendUnavailableError(this.id, "WebGL2 is unavailable for isolated shader compilation");
    const requestedStage = stage === "vertex" ? "vertex" : "fragment";
    const vertexText = requestedStage === "vertex" ? normalizeSource(source.text) : DEFAULT_VERTEX;
    const fragmentText = requestedStage === "fragment" ? normalizeSource(source.text) : DEFAULT_FRAGMENT;
    const shaders = [];
    const compileOne = (type, text) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("WebGL could not allocate a shader");
      shaders.push(shader);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const diagnostics = parseLog(gl.getShaderInfoLog(shader), source.id);
        throw new ShaderCompilationError(`${requestedStage} GLSL compilation failed`, { backend: this.id, sourceId: source.id, stage: requestedStage, diagnostics });
      }
      return shader;
    };
    let program = null;
    try {
      const vertex = compileOne(gl.VERTEX_SHADER, vertexText);
      const fragment = compileOne(gl.FRAGMENT_SHADER, fragmentText);
      if (signal?.aborted) throw signal.reason || new DOMException("Compilation aborted", "AbortError");
      program = gl.createProgram();
      if (!program) throw new Error("WebGL could not allocate a program");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new ShaderCompilationError("GLSL program link failed", {
          backend: this.id, sourceId: source.id, stage: requestedStage,
          diagnostics: parseLog(gl.getProgramInfoLog(program), source.id),
        });
      }
      let disposed = false;
      return {
        backend: this.id,
        stage: requestedStage,
        program,
        isolated: true,
        diagnostics: Object.freeze([]),
        dispose() {
          if (disposed) return;
          disposed = true;
          try { gl.deleteProgram(program); } catch (_) {}
          for (const shader of shaders) { try { gl.deleteShader(shader); } catch (_) {} }
        },
      };
    } catch (error) {
      if (program) try { gl.deleteProgram(program); } catch (_) {}
      for (const shader of shaders) { try { gl.deleteShader(shader); } catch (_) {} }
      if (error instanceof ShaderCompilationError || error instanceof ShaderBackendUnavailableError || error?.name === "AbortError") throw error;
      throw new ShaderCompilationError(error?.message || String(error), { backend: this.id, sourceId: source.id, stage: requestedStage, cause: error });
    }
  }
}
