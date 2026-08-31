import { MAPPING_CACHE_VERSION } from "./PerformanceConstants.js";

const STORAGE_KEY = "animastage.performance.mapping-cache.v1";

function safeParse(text) {
  try { return JSON.parse(text); } catch (_) { return null; }
}

export class PerformanceMappingCache {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage || null;
    this.memory = new Map();
    this._load();
  }

  _load() {
    if (!this.storage) return;
    try {
      const data = safeParse(this.storage.getItem(STORAGE_KEY));
      if (data?.version !== MAPPING_CACHE_VERSION || !data.profiles) return;
      for (const [fingerprint, value] of Object.entries(data.profiles)) {
        if (value && typeof value === "object") this.memory.set(fingerprint, value);
      }
    } catch (_) {}
  }

  _save() {
    if (!this.storage) return;
    try {
      const profiles = Object.fromEntries(this.memory);
      this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: MAPPING_CACHE_VERSION, profiles }));
    } catch (_) {}
  }

  get(fingerprint) {
    const value = this.memory.get(fingerprint);
    return value ? structuredCloneSafe(value) : null;
  }

  set(fingerprint, overrides) {
    if (!fingerprint || !overrides || typeof overrides !== "object") return false;
    this.memory.set(fingerprint, structuredCloneSafe(overrides));
    this._save();
    return true;
  }

  delete(fingerprint) {
    const changed = this.memory.delete(fingerprint);
    if (changed) this._save();
    return changed;
  }
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

