import { EffectManifestError } from "./EffectErrors.js";
import { normalizeEffectParameterDefinitions } from "../parameters/EffectParameters.js";

export const EFFECT_MANIFEST_SCHEMA = "animestage.effect/v1";

export const EFFECT_STATUSES = Object.freeze([
  "DISCOVERED",
  "DOWNLOADED",
  "VERIFIED",
  "PARSED",
  "ADAPTED",
  "RUNTIME_TESTED",
  "GPU_TESTED",
  "PRODUCTION_READY",
  "INCOMPLETE_DEPENDENCIES",
  "INCOMPATIBLE",
  "QUARANTINED",
]);

export const EFFECT_KINDS = Object.freeze([
  "material",
  "post-process",
  "lighting",
  "environment",
  "weather",
  "particle",
  "camera",
  "utility",
  "preset-stack",
]);

const ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

function plainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new EffectManifestError(`${field} must be a non-empty string`, { field, value });
  }
  return value.trim();
}

function stringList(value, field, { lower = false } = {}) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new EffectManifestError(`${field} must be an array`, { field });
  return [...new Set(value.map((entry, index) => {
    const item = requiredString(entry, `${field}[${index}]`);
    return lower ? item.toLowerCase() : item;
  }))];
}

function normalizeDependencies(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new EffectManifestError("dependencies must be an array");
  return value.map((dependency, index) => {
    if (!plainObject(dependency)) {
      throw new EffectManifestError(`dependencies[${index}] must be an object`);
    }
    const id = requiredString(dependency.id, `dependencies[${index}].id`).toLowerCase();
    if (!ID_PATTERN.test(id)) throw new EffectManifestError(`Invalid dependency ID "${id}"`);
    return {
      id,
      range: typeof dependency.range === "string" && dependency.range.trim()
        ? dependency.range.trim()
        : "*",
      optional: dependency.optional === true,
      reason: typeof dependency.reason === "string" ? dependency.reason.trim() : "",
    };
  });
}

function normalizePasses(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new EffectManifestError("passes must be an array");
  const seen = new Set();
  return value.map((pass, index) => {
    if (!plainObject(pass)) throw new EffectManifestError(`passes[${index}] must be an object`);
    const id = requiredString(pass.id, `passes[${index}].id`);
    if (seen.has(id)) throw new EffectManifestError(`Duplicate pass ID "${id}"`);
    seen.add(id);
    return {
      id,
      kind: typeof pass.kind === "string" && pass.kind.trim() ? pass.kind.trim().toLowerCase() : "render",
      reads: stringList(pass.reads, `passes[${index}].reads`),
      writes: stringList(pass.writes, `passes[${index}].writes`),
      after: stringList(pass.after, `passes[${index}].after`),
      before: stringList(pass.before, `passes[${index}].before`),
      optionalReads: stringList(pass.optionalReads, `passes[${index}].optionalReads`),
      allowSharedWrites: pass.allowSharedWrites === true,
    };
  });
}

function normalizeLicense(value) {
  if (value == null) return {
    type: "unknown", redistributionAllowed: "unknown", commercialUseAllowed: "unknown",
    modificationAllowed: "unknown", noticeFiles: [],
  };
  if (!plainObject(value)) throw new EffectManifestError("license must be an object");
  const permission = (entry, field) => {
    if (entry === true || entry === false || entry === "unknown") return entry;
    if (entry == null) return "unknown";
    throw new EffectManifestError(`${field} must be true, false, or "unknown"`);
  };
  return {
    type: typeof value.type === "string" && value.type.trim() ? value.type.trim() : "unknown",
    redistributionAllowed: permission(value.redistributionAllowed, "license.redistributionAllowed"),
    commercialUseAllowed: permission(value.commercialUseAllowed, "license.commercialUseAllowed"),
    modificationAllowed: permission(value.modificationAllowed, "license.modificationAllowed"),
    noticeFiles: stringList(value.noticeFiles, "license.noticeFiles"),
  };
}

function normalizeRequirements(value) {
  if (value == null) return {
    features: [], optionalFeatures: [], limits: {}, fallbackEffect: "", policy: "disable",
  };
  if (!plainObject(value)) throw new EffectManifestError("requirements must be an object");
  const limits = {};
  if (value.limits != null) {
    if (!plainObject(value.limits)) throw new EffectManifestError("requirements.limits must be an object");
    for (const [name, minimum] of Object.entries(value.limits)) {
      if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(name)) {
        throw new EffectManifestError(`Invalid renderer limit name "${name}"`);
      }
      const numeric = Number(minimum);
      if (!Number.isFinite(numeric) || numeric < 0) {
        throw new EffectManifestError(`requirements.limits.${name} must be a non-negative finite number`);
      }
      limits[name] = numeric;
    }
  }
  const fallbackEffect = typeof value.fallbackEffect === "string"
    ? value.fallbackEffect.trim().toLowerCase()
    : "";
  if (fallbackEffect && !ID_PATTERN.test(fallbackEffect)) {
    throw new EffectManifestError(`Invalid fallback effect ID "${fallbackEffect}"`);
  }
  const policy = String(value.policy || (fallbackEffect ? "fallback" : "disable")).toLowerCase();
  if (!["disable", "fallback"].includes(policy)) {
    throw new EffectManifestError('requirements.policy must be "disable" or "fallback"');
  }
  if (policy === "fallback" && !fallbackEffect) {
    throw new EffectManifestError("requirements.fallbackEffect is required for fallback policy");
  }
  return {
    features: stringList(value.features, "requirements.features", { lower: true }),
    optionalFeatures: stringList(value.optionalFeatures, "requirements.optionalFeatures", { lower: true }),
    limits,
    fallbackEffect,
    policy,
  };
}

function normalizePreview(value) {
  if (value == null) return {
    enabled: false,
    isolated: true,
    renderer: "",
    width: 320,
    height: 180,
    background: "#11101f",
    cacheRevision: "1",
  };
  if (!plainObject(value)) throw new EffectManifestError("preview must be an object");
  const dimension = (entry, field, fallback) => {
    if (entry == null) return fallback;
    const number = Number(entry);
    if (!Number.isInteger(number) || number < 32 || number > 2048) {
      throw new EffectManifestError(`${field} must be an integer between 32 and 2048`);
    }
    return number;
  };
  const background = typeof value.background === "string" ? value.background.trim() : "#11101f";
  if (!/^#[0-9a-f]{6}$/i.test(background)) {
    throw new EffectManifestError("preview.background must be a #RRGGBB color");
  }
  return {
    enabled: value.enabled === true,
    // Preview execution is intentionally restricted to an isolated renderer.
    // Packages cannot opt into mutating the live viewport for thumbnails.
    isolated: true,
    renderer: typeof value.renderer === "string" ? value.renderer.trim().toLowerCase() : "",
    width: dimension(value.width, "preview.width", 320),
    height: dimension(value.height, "preview.height", 180),
    background: background.toLowerCase(),
    cacheRevision: typeof value.cacheRevision === "string" && value.cacheRevision.trim()
      ? value.cacheRevision.trim()
      : "1",
  };
}

function deepFreeze(value, seen = new Set()) {
  if (value == null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export function parseSemver(value) {
  const match = VERSION_PATTERN.exec(String(value || ""));
  if (!match) return null;
  return Object.freeze({
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || "",
    raw: String(value),
  });
}

export function compareSemver(left, right) {
  const a = typeof left === "string" ? parseSemver(left) : left;
  const b = typeof right === "string" ? parseSemver(right) : right;
  if (!a || !b) throw new EffectManifestError("Cannot compare invalid semantic versions", { left, right });
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

export function satisfiesVersion(version, range = "*") {
  const parsed = parseSemver(version);
  const wanted = String(range || "*").trim();
  if (!parsed) return false;
  if (wanted === "*" || wanted.toLowerCase() === "latest") return true;
  const operator = wanted.startsWith("^") || wanted.startsWith("~") ? wanted[0] : "";
  const target = parseSemver(operator ? wanted.slice(1) : wanted);
  if (!target) return false;
  if (!operator) return compareSemver(parsed, target) === 0;
  if (compareSemver(parsed, target) < 0) return false;
  if (operator === "~") return parsed.major === target.major && parsed.minor === target.minor;
  if (target.major > 0) return parsed.major === target.major;
  if (target.minor > 0) return parsed.major === 0 && parsed.minor === target.minor;
  return parsed.major === 0 && parsed.minor === 0 && parsed.patch === target.patch;
}

export function normalizeEffectManifest(input, { source = "runtime" } = {}) {
  if (!plainObject(input)) throw new EffectManifestError("Effect manifest must be an object", { source });
  const schema = requiredString(input.schema, "schema");
  if (schema !== EFFECT_MANIFEST_SCHEMA) {
    throw new EffectManifestError(`Unsupported effect manifest schema "${schema}"`, { source, schema });
  }
  const id = requiredString(input.id, "id").toLowerCase();
  if (!ID_PATTERN.test(id)) throw new EffectManifestError(`Invalid effect ID "${id}"`, { source, id });
  const version = requiredString(input.version, "version");
  if (!parseSemver(version)) throw new EffectManifestError(`Invalid semantic version "${version}"`, { source, version });
  const kind = requiredString(input.kind, "kind").toLowerCase();
  if (!EFFECT_KINDS.includes(kind)) throw new EffectManifestError(`Unknown effect kind "${kind}"`, { kind });
  const status = String(input.status || "DISCOVERED").toUpperCase();
  if (!EFFECT_STATUSES.includes(status)) throw new EffectManifestError(`Unknown effect status "${status}"`, { status });

  const author = plainObject(input.author)
    ? {
        name: requiredString(input.author.name, "author.name"),
        original: typeof input.author.original === "string" ? input.author.original.trim() : "",
        url: typeof input.author.url === "string" ? input.author.url.trim() : "",
      }
    : { name: requiredString(input.author, "author"), original: "", url: "" };

  const provenance = plainObject(input.provenance) ? {
    sourceUrl: typeof input.provenance.sourceUrl === "string" ? input.provenance.sourceUrl.trim() : "",
    downloadUrl: typeof input.provenance.downloadUrl === "string" ? input.provenance.downloadUrl.trim() : "",
    sourceType: typeof input.provenance.sourceType === "string" ? input.provenance.sourceType.trim() : "builtin",
    archiveFilename: typeof input.provenance.archiveFilename === "string" ? input.provenance.archiveFilename.trim() : "",
    archiveVersion: typeof input.provenance.archiveVersion === "string" ? input.provenance.archiveVersion.trim() : "",
    revision: typeof input.provenance.revision === "string" ? input.provenance.revision.trim() : "",
    sha256: typeof input.provenance.sha256 === "string" ? input.provenance.sha256.toLowerCase().trim() : "",
    licenseUrl: typeof input.provenance.licenseUrl === "string" ? input.provenance.licenseUrl.trim() : "",
    terms: typeof input.provenance.terms === "string" ? input.provenance.terms.trim() : "",
  } : {
    sourceUrl: "", downloadUrl: "", sourceType: "builtin", archiveFilename: "",
    archiveVersion: "", revision: "", sha256: "", licenseUrl: "", terms: "",
  };
  if (provenance.sha256 && !/^[a-f0-9]{64}$/.test(provenance.sha256)) {
    throw new EffectManifestError("provenance.sha256 must contain 64 hexadecimal characters");
  }

  return deepFreeze({
    schema,
    id,
    version,
    name: requiredString(input.name, "name"),
    description: typeof input.description === "string" ? input.description.trim() : "",
    author,
    kind,
    slot: typeof input.slot === "string" && input.slot.trim() ? input.slot.trim() : kind,
    status,
    categories: stringList(input.categories, "categories", { lower: true }),
    tags: stringList(input.tags, "tags", { lower: true }),
    renderers: stringList(input.renderers, "renderers", { lower: true }),
    languages: stringList(input.languages, "languages", { lower: true }),
    capabilities: stringList(input.capabilities, "capabilities", { lower: true }),
    requirements: normalizeRequirements(input.requirements),
    dependencies: normalizeDependencies(input.dependencies),
    passes: normalizePasses(input.passes ?? input.runtime?.passes),
    textures: stringList(input.textures, "textures"),
    entryPoints: plainObject(input.entryPoints) ? { ...input.entryPoints } : {},
    compatibility: plainObject(input.compatibility) ? { ...input.compatibility } : {},
    preview: normalizePreview(input.preview),
    license: normalizeLicense(input.license),
    parameters: normalizeEffectParameterDefinitions(input.parameters),
    provenance,
  });
}
