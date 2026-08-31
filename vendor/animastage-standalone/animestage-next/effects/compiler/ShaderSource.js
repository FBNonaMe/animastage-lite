import { EffectPlatformError } from "../core/EffectErrors.js";

export const SHADER_LANGUAGES = Object.freeze([
  "glsl", "wgsl", "hlsl", "mme-fx", "native",
]);

const INCLUDE_PATTERNS = Object.freeze([
  /^\s*#\s*include\s*[<"]([^>"]+)[>"]/,
  /^\s*\/\/\s*@include\s+[<"]([^>"]+)[>"]/,
]);

function cleanId(value, field) {
  const text = String(value || "").trim().replaceAll("\\", "/");
  if (!text) throw new EffectPlatformError(`${field} must be a non-empty string`, { code: "SHADER_SOURCE_INVALID" });
  if (text.startsWith("/") || /^[a-z]:\//i.test(text) || text.split("/").includes("..")) {
    throw new EffectPlatformError(`${field} must be a package-relative logical path`, {
      code: "SHADER_SOURCE_PATH_UNSAFE", details: { field, value },
    });
  }
  return text.replace(/^\.\//, "");
}

function normalizeText(value, maxBytes) {
  if (typeof value !== "string") throw new EffectPlatformError("Shader source text must be a string", { code: "SHADER_SOURCE_INVALID" });
  const text = value.replace(/\r\n?/g, "\n");
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > maxBytes) {
    throw new EffectPlatformError(`Shader source exceeds ${maxBytes} bytes`, {
      code: "SHADER_SOURCE_TOO_LARGE", details: { bytes, maxBytes },
    });
  }
  if (text.includes("\0")) throw new EffectPlatformError("Shader source contains a NUL byte", { code: "SHADER_SOURCE_INVALID" });
  return text;
}

function hash64(value) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function resolveLogicalPath(parentId, request) {
  const cleanRequest = cleanId(request, "include");
  const base = parentId.includes("/") ? parentId.slice(0, parentId.lastIndexOf("/") + 1) : "";
  const parts = `${base}${cleanRequest}`.split("/");
  const normalized = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!normalized.length) throw new EffectPlatformError(`Include escapes the effect package: ${request}`, { code: "SHADER_INCLUDE_PATH_UNSAFE" });
      normalized.pop();
    } else normalized.push(part);
  }
  return normalized.join("/");
}

export class ShaderSource {
  constructor({ id, language, text, entryPoint = "main", metadata = {}, maxBytes = 4 * 1024 * 1024 } = {}) {
    const normalizedLanguage = String(language || "").trim().toLowerCase();
    if (!SHADER_LANGUAGES.includes(normalizedLanguage)) {
      throw new EffectPlatformError(`Unsupported shader language "${language}"`, {
        code: "SHADER_LANGUAGE_UNSUPPORTED", details: { language },
      });
    }
    this.id = cleanId(id, "shader source id");
    this.language = normalizedLanguage;
    this.text = normalizeText(text, maxBytes);
    this.entryPoint = String(entryPoint || "main").trim() || "main";
    this.metadata = Object.freeze({ ...(metadata || {}) });
    this.includes = Object.freeze(this.#scanIncludes());
    this.lineCount = this.text.length ? this.text.split("\n").length : 0;
    this.cacheKey = `${this.language}:${hash64(`${this.id}\0${this.entryPoint}\0${this.text}`)}`;
    Object.freeze(this);
  }

  #scanIncludes() {
    const found = [];
    this.text.split("\n").forEach((line, index) => {
      for (const pattern of INCLUDE_PATTERNS) {
        const match = pattern.exec(line);
        if (!match) continue;
        found.push(Object.freeze({ request: match[1].trim(), line: index + 1 }));
        break;
      }
    });
    return found;
  }

  /**
   * Resolves includes into one compiler input and records the original file and
   * line for every generated line. The package resolver receives a normalized
   * logical path and must return ShaderSource, string, or null.
   */
  resolveIncludes(resolver, { maxDepth = 32 } = {}) {
    if (typeof resolver !== "function") throw new TypeError("Shader include resolver must be a function");
    const output = [];
    const sourceMap = [];
    const dependencies = [];
    const stack = [];
    const expand = (source, depth) => {
      if (depth > maxDepth) throw new EffectPlatformError(`Shader include depth exceeded ${maxDepth}`, { code: "SHADER_INCLUDE_DEPTH" });
      if (stack.includes(source.id)) {
        throw new EffectPlatformError(`Shader include cycle: ${[...stack, source.id].join(" -> ")}`, {
          code: "SHADER_INCLUDE_CYCLE", details: { cycle: [...stack, source.id] },
        });
      }
      stack.push(source.id);
      const includeByLine = new Map(source.includes.map((entry) => [entry.line, entry]));
      source.text.split("\n").forEach((line, index) => {
        const lineNumber = index + 1;
        const include = includeByLine.get(lineNumber);
        if (!include) {
          output.push(line);
          sourceMap.push(Object.freeze({ generatedLine: output.length, sourceId: source.id, sourceLine: lineNumber }));
          return;
        }
        const logicalId = resolveLogicalPath(source.id, include.request);
        let resolved = resolver(logicalId, Object.freeze({ parent: source, include }));
        if (typeof resolved === "string") resolved = createShaderSource({ id: logicalId, language: source.language, text: resolved });
        if (!(resolved instanceof ShaderSource)) {
          throw new EffectPlatformError(`Missing shader include "${logicalId}" requested by ${source.id}:${lineNumber}`, {
            code: "SHADER_INCLUDE_MISSING", details: { sourceId: source.id, line: lineNumber, include: logicalId },
          });
        }
        if (resolved.language !== source.language && resolved.language !== "native") {
          throw new EffectPlatformError(`Include ${logicalId} uses incompatible language ${resolved.language}`, {
            code: "SHADER_INCLUDE_LANGUAGE_MISMATCH",
          });
        }
        dependencies.push(logicalId);
        expand(resolved, depth + 1);
      });
      stack.pop();
    };
    expand(this, 0);
    const text = output.join("\n");
    return Object.freeze({
      source: createShaderSource({ id: this.id, language: this.language, text, entryPoint: this.entryPoint, metadata: this.metadata }),
      sourceMap: Object.freeze(sourceMap),
      dependencies: Object.freeze([...new Set(dependencies)]),
    });
  }
}

export class GLSLSource extends ShaderSource { constructor(options = {}) { super({ ...options, language: "glsl" }); } }
export class WGSLSource extends ShaderSource { constructor(options = {}) { super({ ...options, language: "wgsl" }); } }
export class HLSLSource extends ShaderSource { constructor(options = {}) { super({ ...options, language: "hlsl" }); } }
export class MMEFXSource extends ShaderSource { constructor(options = {}) { super({ ...options, language: "mme-fx" }); } }
export class NativeShaderSource extends ShaderSource { constructor(options = {}) { super({ ...options, language: "native" }); } }

export function createShaderSource(options = {}) {
  const language = String(options.language || "").toLowerCase();
  const Constructor = {
    glsl: GLSLSource,
    wgsl: WGSLSource,
    hlsl: HLSLSource,
    "mme-fx": MMEFXSource,
    native: NativeShaderSource,
  }[language];
  if (!Constructor) return new ShaderSource(options);
  return new Constructor(options);
}
