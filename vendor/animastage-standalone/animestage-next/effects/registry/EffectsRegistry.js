import {
  compareSemver,
  normalizeEffectManifest,
  satisfiesVersion,
} from "../core/EffectManifest.js";
import { EffectDependencyError, EffectPlatformError } from "../core/EffectErrors.js";

function keyOf(id, version) { return `${id}@${version}`; }

function freezeDefinition(manifest, implementation, source) {
  if (implementation != null && typeof implementation !== "object" && typeof implementation !== "function") {
    throw new TypeError("Effect implementation must be an object, function, or null");
  }
  return Object.freeze({
    key: keyOf(manifest.id, manifest.version),
    manifest,
    implementation,
    source: String(source || "runtime"),
  });
}

export class EffectsRegistry {
  #families = new Map();
  #favorites = new Set();
  #recent = [];
  #quarantine = new Map();
  #listeners = new Set();

  register(manifestInput, implementation = null, { source = "runtime", replace = false } = {}) {
    const manifest = normalizeEffectManifest(manifestInput, { source });
    let versions = this.#families.get(manifest.id);
    if (!versions) this.#families.set(manifest.id, versions = new Map());
    if (versions.has(manifest.version) && !replace) {
      throw new EffectPlatformError(`Effect ${manifest.id}@${manifest.version} is already registered`, {
        code: "EFFECT_DUPLICATE",
        details: { id: manifest.id, version: manifest.version, source },
      });
    }
    const definition = freezeDefinition(manifest, implementation, source);
    versions.set(manifest.version, definition);
    this.#emit("registered", definition);
    return definition;
  }

  unregister(id, version) {
    const normalizedId = String(id || "").toLowerCase();
    const versions = this.#families.get(normalizedId);
    const definition = versions?.get(String(version));
    if (!definition) return false;
    versions.delete(String(version));
    if (!versions.size) this.#families.delete(normalizedId);
    this.#emit("unregistered", definition);
    return true;
  }

  resolve(reference, range = "*") {
    const parsed = typeof reference === "string"
      ? { id: reference, range }
      : { id: reference?.id, range: reference?.range || range };
    const id = String(parsed.id || "").toLowerCase();
    const versions = this.#families.get(id);
    if (!versions) return null;
    const matching = [...versions.values()]
      .filter((definition) => satisfiesVersion(definition.manifest.version, parsed.range))
      .sort((a, b) => compareSemver(b.manifest.version, a.manifest.version));
    return matching[0] || null;
  }

  require(reference, range = "*") {
    const definition = this.resolve(reference, range);
    if (definition) return definition;
    const id = typeof reference === "string" ? reference : reference?.id;
    throw new EffectDependencyError(`Required effect "${id}" (${range}) is not registered`, { id, range });
  }

  getEffect(reference, range = "*") { return this.resolve(reference, range); }
  findEffects(filters = {}) { return this.list(filters); }
  resolveDependencies(reference) { return this.resolveDependencyOrder(reference); }

  getCompatibility(reference, {
    renderer = null,
    languages = null,
    features = null,
    capabilities = null,
    limits = {},
    available = true,
  } = {}) {
    const definition = typeof reference === "string" ? this.resolve(reference) : reference;
    if (!definition?.manifest) {
      return Object.freeze({ compatible: false, runnable: false, reasons: Object.freeze(["effect-not-registered"]), missingCapabilities: Object.freeze([]) });
    }
    const manifest = definition.manifest;
    const reasons = [];
    const normalizedRenderer = renderer == null ? null : String(renderer).toLowerCase();
    if (normalizedRenderer && !manifest.renderers.includes(normalizedRenderer)) reasons.push(`renderer:${normalizedRenderer}`);
    const availableLanguages = languages == null
      ? null
      : new Set(Array.from(languages, (entry) => String(entry).toLowerCase()));
    if (availableLanguages && manifest.languages.length && !manifest.languages.some((language) => availableLanguages.has(language))) {
      reasons.push(`language:${manifest.languages.join("|")}`);
    }
    // `manifest.capabilities` describes what an effect provides. Device-side
    // requirements are deliberately separate so a feature such as
    // "parameter-reflection" is never mistaken for a missing GPU extension.
    const availableFeatures = new Set(Array.from(features ?? capabilities ?? [], (entry) => String(entry).toLowerCase()));
    const missingCapabilities = manifest.requirements.features.filter((feature) => !availableFeatures.has(feature));
    if (missingCapabilities.length) reasons.push("missing-features");
    const insufficientLimits = [];
    for (const [name, minimum] of Object.entries(manifest.requirements.limits)) {
      const actual = Number(limits?.[name]);
      if (!Number.isFinite(actual) || actual < minimum) insufficientLimits.push(Object.freeze({ name, minimum, actual: Number.isFinite(actual) ? actual : null }));
    }
    if (insufficientLimits.length) reasons.push("insufficient-limits");
    if (this.isQuarantined(definition.key)) reasons.push("quarantined");
    if (["INCOMPATIBLE", "INCOMPLETE_DEPENDENCIES", "QUARANTINED"].includes(manifest.status)) reasons.push(`status:${manifest.status}`);
    const runnable = !!definition.implementation && ["ADAPTED", "RUNTIME_TESTED", "GPU_TESTED", "PRODUCTION_READY"].includes(manifest.status);
    if (!runnable) reasons.push("runtime-adapter-unavailable");
    return Object.freeze({
      compatible: reasons.length === 0,
      pending: available === false,
      runnable,
      renderer: normalizedRenderer,
      status: manifest.status,
      reasons: Object.freeze([...new Set(reasons)]),
      missingCapabilities: Object.freeze(missingCapabilities),
      missingFeatures: Object.freeze(missingCapabilities),
      insufficientLimits: Object.freeze(insufficientLimits),
    });
  }

  validateEffect(reference, context = {}) {
    const definition = typeof reference === "string" ? this.require(reference) : reference;
    this.resolveDependencyOrder(definition);
    return this.getCompatibility(definition, context);
  }

  resolveDependencyOrder(reference) {
    const root = typeof reference === "string" ? this.require(reference) : reference;
    if (!root?.manifest) throw new EffectDependencyError("Dependency resolution requires an effect definition");
    const ordered = [];
    const permanent = new Set();
    const visiting = [];

    const visit = (definition) => {
      if (permanent.has(definition.key)) return;
      const cycleIndex = visiting.indexOf(definition.key);
      if (cycleIndex >= 0) {
        const cycle = [...visiting.slice(cycleIndex), definition.key];
        throw new EffectDependencyError(`Effect dependency cycle: ${cycle.join(" -> ")}`, { cycle });
      }
      visiting.push(definition.key);
      for (const dependency of definition.manifest.dependencies) {
        const child = this.resolve(dependency.id, dependency.range);
        if (!child) {
          if (dependency.optional) continue;
          throw new EffectDependencyError(
            `Effect ${definition.key} requires missing ${dependency.id}@${dependency.range}`,
            { effect: definition.key, dependency },
          );
        }
        visit(child);
      }
      visiting.pop();
      permanent.add(definition.key);
      ordered.push(definition);
    };
    visit(root);
    return ordered;
  }

  list({ query = "", category = null, kind = null, renderer = null, status = null, favorites = false } = {}) {
    const needle = String(query || "").trim().toLowerCase();
    const values = [...this.#families.values()].flatMap((versions) => [...versions.values()]);
    return values.filter((definition) => {
      const manifest = definition.manifest;
      if (favorites && !this.#favorites.has(manifest.id)) return false;
      if (category && !manifest.categories.includes(String(category).toLowerCase())) return false;
      if (kind && manifest.kind !== String(kind).toLowerCase()) return false;
      if (renderer && !manifest.renderers.includes(String(renderer).toLowerCase())) return false;
      if (status && manifest.status !== String(status).toUpperCase()) return false;
      if (!needle) return true;
      return [manifest.id, manifest.name, manifest.description, manifest.author.name, ...manifest.tags]
        .some((value) => String(value).toLowerCase().includes(needle));
    }).sort((a, b) => a.manifest.name.localeCompare(b.manifest.name) || compareSemver(b.manifest.version, a.manifest.version));
  }

  setFavorite(id, favorite = true) {
    const normalized = String(id || "").toLowerCase();
    if (favorite) this.#favorites.add(normalized); else this.#favorites.delete(normalized);
    this.#emit("favorite", { id: normalized, favorite: !!favorite });
  }

  isFavorite(id) { return this.#favorites.has(String(id || "").toLowerCase()); }
  get favorites() { return [...this.#favorites]; }

  markRecent(definition, limit = 24) {
    const key = definition?.key || String(definition || "");
    this.#recent = [key, ...this.#recent.filter((entry) => entry !== key)].slice(0, limit);
  }

  get recent() {
    return this.#recent.map((key) => {
      const at = key.lastIndexOf("@");
      return at > 0 ? this.#families.get(key.slice(0, at))?.get(key.slice(at + 1)) : null;
    }).filter(Boolean);
  }

  quarantine(reference, reason, details = null) {
    const definition = typeof reference === "string" ? this.resolve(reference) : reference;
    const key = definition?.key || String(reference);
    const record = Object.freeze({ key, reason: String(reason || "unsafe effect"), details });
    this.#quarantine.set(key, record);
    this.#emit("quarantined", record);
    return record;
  }

  isQuarantined(reference) {
    const key = typeof reference === "string" ? reference : reference?.key;
    return this.#quarantine.has(String(key));
  }

  get quarantined() { return [...this.#quarantine.values()]; }
  get size() { return [...this.#families.values()].reduce((sum, versions) => sum + versions.size, 0); }

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("Registry listener must be a function");
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(type, payload) {
    for (const listener of this.#listeners) {
      try { listener(Object.freeze({ type, payload })); } catch (_) {}
    }
  }
}
