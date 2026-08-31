import { EffectPackageSecurityError } from "../core/EffectErrors.js";
import { parseMMEEffect } from "../compatibility/mme/MMEEffectParser.js";

export const EFFECT_SOURCE_EXTENSIONS = new Set([
  "fx", "fxh", "fxsub", "hlsl", "glsl", "vert", "frag", "wgsl", "cginc", "json", "yaml", "yml",
  "txt", "md", "ini", "conf", "xml", "csv", "cube", "3dl", "png", "jpg", "jpeg", "gif",
  "bmp", "tga", "webp", "dds", "spa", "sph", "hdr", "exr", "obj", "mtl", "bin",
  // MME packages often carry controllers, accessory meshes and material maps
  // beside shader sources. They are data, not executable host programs.
  "emd", "pmx", "pmd", "vmd", "vpd", "x",
]);

export const QUARANTINED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "ps1", "scr", "dll", "com", "msi", "vbs", "js", "jse",
  "jar", "lnk", "reg", "sys", "hta", "cpl", "appx", "appxbundle",
]);

const INCLUDE_PATTERN = /(?:#\s*include|include)\s*[<\"']([^>\"']+)[>\"']/gi;
const INCLUDE_EXTENSIONS = new Set(["fx", "fxh", "fxsub", "hlsl", "glsl", "vert", "frag", "wgsl", "cginc"]);

export function normalizeEffectPackagePath(value) {
  const raw = String(value ?? "").replace(/\\/g, "/").replace(/\0/g, "");
  if (!raw || raw.startsWith("/") || raw.startsWith("//") || /^[a-z]:\//i.test(raw)) return "";
  const parts = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." || /^[a-z]:$/i.test(part)) return "";
    parts.push(part);
  }
  return parts.join("/");
}

function extensionOf(path) {
  const name = String(path).split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === "string") return new TextEncoder().encode(value);
  throw new TypeError("Effect package entries require bytes, ArrayBuffer, or text");
}

function hex(bytes) { return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(""); }

export async function sha256Hex(value, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle?.digest) throw new Error("SHA-256 is unavailable in this runtime");
  const bytes = toBytes(value);
  return hex(new Uint8Array(await cryptoApi.subtle.digest("SHA-256", bytes)));
}

function decodeText(bytes) {
  for (const encoding of ["utf-8", "shift-jis"]) {
    try { return new TextDecoder(encoding, { fatal: encoding === "utf-8" }).decode(bytes); }
    catch (_) {}
  }
  return "";
}

function resolveIncludePath(fromPath, requestedPath) {
  const request = String(requestedPath || "").replace(/\\/g, "/").replace(/\0/g, "");
  if (!request || request.startsWith("/") || request.startsWith("//") || /^[a-z]:\//i.test(request)) {
    return { path: "", escaped: true };
  }
  const parts = String(fromPath || "").split("/").slice(0, -1);
  for (const part of request.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return { path: "", escaped: true };
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return { path: parts.join("/"), escaped: false };
}

export async function inspectEffectPackageEntries(entries, {
  cryptoApi = globalThis.crypto,
  maxEntries = 30000,
  maxTotalBytes = 4 * 1024 * 1024 * 1024,
  maxSingleFileBytes = 1024 * 1024 * 1024,
} = {}) {
  if (!Array.isArray(entries)) throw new TypeError("Effect package entries must be an array");
  if (entries.length > maxEntries) {
    throw new EffectPackageSecurityError(`Effect package contains ${entries.length} entries; limit is ${maxEntries}`);
  }
  const accepted = [];
  const quarantined = [];
  const rejected = [];
  const dependencies = new Set();
  const includeReferences = [];
  const compatibilityReports = [];
  let totalBytes = 0;

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index] || {};
    const path = normalizeEffectPackagePath(entry.path || entry.name);
    if (!path) {
      rejected.push({ index, path: String(entry.path || entry.name || ""), reason: "unsafe-path" });
      continue;
    }
    const bytes = toBytes(entry.bytes ?? entry.data ?? "");
    if (bytes.byteLength > maxSingleFileBytes) {
      throw new EffectPackageSecurityError(`Effect package entry is too large: ${path}`, { path, size: bytes.byteLength });
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > maxTotalBytes) {
      throw new EffectPackageSecurityError("Effect package exceeds the uncompressed size limit", { totalBytes, maxTotalBytes });
    }
    const extension = extensionOf(path);
    const record = {
      path,
      extension,
      size: bytes.byteLength,
      sha256: await sha256Hex(bytes, cryptoApi),
    };
    if (QUARANTINED_EXTENSIONS.has(extension)) {
      quarantined.push({ ...record, reason: "executable-or-script" });
      continue;
    }
    if (!EFFECT_SOURCE_EXTENSIONS.has(extension)) {
      rejected.push({ ...record, reason: "unsupported-file-type" });
      continue;
    }
    if (INCLUDE_EXTENSIONS.has(extension) && bytes.byteLength <= 16 * 1024 * 1024) {
      const source = decodeText(bytes);
      for (const match of source.matchAll(INCLUDE_PATTERN)) {
        const requested = String(match[1] || "").replace(/\\/g, "/");
        const dependency = normalizeEffectPackagePath(requested);
        if (dependency) dependencies.add(dependency);
        const resolved = resolveIncludePath(path, requested);
        includeReferences.push({
          from: path,
          requested,
          resolved: resolved.path,
          escaped: resolved.escaped,
        });
      }
      if (extension === "fx") {
        try {
          compatibilityReports.push(parseMMEEffect(source, { id: path }));
        } catch (error) {
          compatibilityReports.push(Object.freeze({
            schema: "animestage.mme-inspection/v1",
            source: Object.freeze({ id: path, cacheKey: "", lines: source.split("\n").length }),
            includes: Object.freeze([]), parameters: Object.freeze([]), techniques: Object.freeze([]), semantics: Object.freeze([]),
            compatibility: Object.freeze({ percent: 0, supported: Object.freeze([]), partial: Object.freeze([]), unsupported: Object.freeze(["parser failure"]) }),
            diagnostics: Object.freeze([{ severity: "error", code: "MME_PARSE_FAILED", message: error?.message || String(error), line: 1 }]),
            executable: false,
            note: "Structural inspection failed. The source remains preserved and non-executable.",
          }));
        }
      }
    }
    accepted.push(record);
  }

  const fingerprintInput = accepted
    .map((record) => `${record.path}\0${record.sha256}\0${record.size}`)
    .sort()
    .join("\n");
  // MME/DX9 projects are authored for Windows, whose include lookup is
  // case-insensitive. Keep canonical archive spelling while resolving that way.
  const acceptedByLowerPath = new Map(accepted.map((record) => [record.path.toLowerCase(), record.path]));
  const dependencyReferences = includeReferences.map((reference) => {
    let canonical = reference.resolved
      ? acceptedByLowerPath.get(reference.resolved.toLowerCase()) || ""
      : "";
    let resolutionMode = canonical ? "relative" : "";
    if (!canonical && !reference.escaped && !reference.requested.startsWith("../")) {
      const requested = reference.requested.replace(/^\.\//, "");
      const ancestors = reference.from.split("/").slice(0, -1);
      for (let depth = 1; depth < ancestors.length && !canonical; depth++) {
        ancestors.pop();
        const candidate = `${ancestors.join("/")}/${requested}`;
        canonical = acceptedByLowerPath.get(candidate.toLowerCase()) || "";
        if (canonical) resolutionMode = `ancestor-${depth}`;
      }
    }
    if (!canonical && !reference.escaped) {
      const packageRoot = reference.from.split("/")[0] || "";
      const rootRelative = reference.requested.replace(/^(?:\.\.\/)+/, "").replace(/^\.\//, "");
      const rootCandidate = packageRoot && rootRelative ? `${packageRoot}/${rootRelative}` : "";
      canonical = rootCandidate ? acceptedByLowerPath.get(rootCandidate.toLowerCase()) || "" : "";
      if (canonical) resolutionMode = "package-root-fallback";
    }
    return Object.freeze({ ...reference, canonical, resolutionMode, exists: !!canonical });
  });
  const missingDependencies = dependencyReferences.filter((reference) => !reference.exists);
  return Object.freeze({
    packageSha256: await sha256Hex(fingerprintInput, cryptoApi),
    totalEntries: entries.length,
    totalBytes,
    accepted: Object.freeze(accepted),
    quarantined: Object.freeze(quarantined),
    rejected: Object.freeze(rejected),
    dependencies: Object.freeze([...dependencies].sort()),
    dependencyReferences: Object.freeze(dependencyReferences),
    missingDependencies: Object.freeze(missingDependencies),
    compatibilityReports: Object.freeze(compatibilityReports),
    safe: quarantined.length === 0 && rejected.every((entry) => entry.reason !== "unsafe-path"),
  });
}

export function buildProvenanceRecord({ manifest, inspection, source = {}, dates = {} } = {}) {
  if (!manifest?.id || !inspection?.packageSha256) throw new TypeError("Provenance requires a manifest and package inspection");
  return Object.freeze({
    schema: "animestage.effect-provenance/v1",
    effectId: manifest.id,
    effectName: manifest.name,
    author: manifest.author?.name || "Unknown",
    originalAuthorSpelling: manifest.author?.original || "",
    sourceUrl: String(source.sourceUrl || ""),
    downloadUrl: String(source.downloadUrl || source.sourceUrl || ""),
    sourceType: String(source.sourceType || "imported"),
    archiveFilename: String(source.archiveFilename || ""),
    archiveVersion: String(source.archiveVersion || manifest.version || ""),
    revision: String(source.revision || ""),
    discoveryDate: String(dates.discoveryDate || ""),
    downloadDate: String(dates.downloadDate || ""),
    sha256: inspection.packageSha256,
    originalDirectoryStructure: inspection.accepted.map((entry) => entry.path),
    licenseUrl: String(source.licenseUrl || ""),
    readmeLocation: String(source.readmeLocation || ""),
    dependencies: inspection.dependencies,
    missingDependencies: inspection.missingDependencies || [],
    redistributionNotes: String(source.redistributionNotes || ""),
    compatibilityNotes: String(source.compatibilityNotes || ""),
    compatibilityReports: inspection.compatibilityReports || [],
    quarantinedFiles: inspection.quarantined,
  });
}
