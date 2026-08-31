function canonical(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function hash64(text) {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index++) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function createEffectPreviewKey(input) {
  return `preview-${hash64(canonical(input))}`;
}

/** Bounded in-memory LRU. Object URLs are owned and revoked by this cache. */
export class EffectPreviewCache {
  #entries = new Map();
  #inflight = new Map();
  #bytes = 0;
  #sequence = 0;

  constructor({ maxEntries = 48, maxBytes = 32 * 1024 * 1024, urlApi = globalThis.URL } = {}) {
    this.maxEntries = Math.max(1, Math.floor(Number(maxEntries) || 48));
    this.maxBytes = Math.max(1024, Math.floor(Number(maxBytes) || 32 * 1024 * 1024));
    this.urlApi = urlApi;
  }

  get(key) {
    const record = this.#entries.get(String(key));
    if (!record) return null;
    this.#entries.delete(record.key);
    this.#entries.set(record.key, record);
    return record;
  }

  set(key, result, metadata = {}) {
    const normalizedKey = String(key);
    const blob = result instanceof Blob ? result : result?.blob;
    if (!(blob instanceof Blob)) throw new TypeError("Effect preview producer must return a Blob");
    this.delete(normalizedKey);
    const url = typeof this.urlApi?.createObjectURL === "function" ? this.urlApi.createObjectURL(blob) : "";
    const record = Object.freeze({
      schema: "animestage.effect-preview/v1",
      key: normalizedKey,
      effectKey: String(metadata.effectKey || result?.effectKey || ""),
      width: Math.max(1, Math.floor(Number(result?.width ?? metadata.width) || 1)),
      height: Math.max(1, Math.floor(Number(result?.height ?? metadata.height) || 1)),
      mimeType: blob.type || result?.mimeType || "image/png",
      backend: String(result?.backend || metadata.backend || "isolated"),
      isolated: result?.isolated === true,
      bytes: blob.size,
      blob,
      url,
      createdSequence: ++this.#sequence,
    });
    this.#entries.set(normalizedKey, record);
    this.#bytes += record.bytes;
    this.#trim();
    return this.#entries.get(normalizedKey) || record;
  }

  async resolve(key, producer, metadata = {}) {
    const cached = this.get(key);
    if (cached) return Object.freeze({ record: cached, cacheHit: true });
    const normalizedKey = String(key);
    if (this.#inflight.has(normalizedKey)) {
      const record = await this.#inflight.get(normalizedKey);
      return Object.freeze({ record, cacheHit: true, deduplicated: true });
    }
    const pending = Promise.resolve().then(producer).then((result) => this.set(normalizedKey, result, metadata));
    this.#inflight.set(normalizedKey, pending);
    try {
      return Object.freeze({ record: await pending, cacheHit: false });
    } finally {
      this.#inflight.delete(normalizedKey);
    }
  }

  delete(key) {
    const record = this.#entries.get(String(key));
    if (!record) return false;
    this.#entries.delete(record.key);
    this.#bytes -= record.bytes;
    if (record.url && typeof this.urlApi?.revokeObjectURL === "function") {
      try { this.urlApi.revokeObjectURL(record.url); } catch (_) {}
    }
    return true;
  }

  clear() {
    for (const key of [...this.#entries.keys()]) this.delete(key);
  }

  get entries() { return Object.freeze([...this.#entries.values()].reverse()); }
  get stats() {
    return Object.freeze({
      schema: "animestage.effect-preview-cache/v1",
      entries: this.#entries.size,
      inflight: this.#inflight.size,
      bytes: this.#bytes,
      maxEntries: this.maxEntries,
      maxBytes: this.maxBytes,
    });
  }

  #trim() {
    // Keep one oversized preview usable instead of returning an already
    // revoked URL. The next insertion will evict it normally.
    while (this.#entries.size > this.maxEntries || (this.#bytes > this.maxBytes && this.#entries.size > 1)) {
      const oldest = this.#entries.keys().next().value;
      if (oldest == null) break;
      this.delete(oldest);
    }
  }
}
