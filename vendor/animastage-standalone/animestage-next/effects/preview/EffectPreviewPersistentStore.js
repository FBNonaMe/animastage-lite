/** IndexedDB-backed preview Blob store. It is optional and never blocks startup. */
export class EffectPreviewPersistentStore {
  #database = null;
  #opening = null;

  constructor({ indexedDB = globalThis.indexedDB, databaseName = "animestage-effect-previews-v1", maxEntries = 96 } = {}) {
    this.indexedDB = indexedDB;
    this.databaseName = databaseName;
    this.maxEntries = Math.max(1, Math.floor(Number(maxEntries) || 96));
  }

  get available() { return !!this.indexedDB?.open; }

  async get(key) {
    const db = await this.#open();
    if (!db) return null;
    const record = await this.#request(db.transaction("previews", "readonly").objectStore("previews").get(String(key)));
    if (!record?.blob || !(record.blob instanceof Blob)) return null;
    return Object.freeze({ ...record, persistent: true });
  }

  async put(key, result, metadata = {}) {
    const blob = result instanceof Blob ? result : result?.blob;
    if (!(blob instanceof Blob)) return false;
    const db = await this.#open();
    if (!db) return false;
    const transaction = db.transaction("previews", "readwrite");
    const completed = this.#complete(transaction);
    const store = transaction.objectStore("previews");
    await this.#request(store.put({
      key: String(key), blob, bytes: blob.size, mimeType: blob.type || "image/png",
      width: Number(result?.width ?? metadata.width) || 1,
      height: Number(result?.height ?? metadata.height) || 1,
      backend: String(result?.backend || metadata.backend || "isolated"),
      effectKey: String(metadata.effectKey || result?.effectKey || ""),
      isolated: result?.isolated === true,
      savedAt: Date.now(),
    }));
    await completed;
    await this.#trim(db);
    return true;
  }

  async clear() {
    const db = await this.#open();
    if (!db) return;
    const transaction = db.transaction("previews", "readwrite");
    const completed = this.#complete(transaction);
    transaction.objectStore("previews").clear();
    await completed;
  }

  async count() {
    const db = await this.#open();
    if (!db) return 0;
    return Number(await this.#request(db.transaction("previews", "readonly").objectStore("previews").count())) || 0;
  }

  async #open() {
    if (!this.available) return null;
    if (this.#database) return this.#database;
    if (this.#opening) return this.#opening;
    this.#opening = new Promise((resolve) => {
      let request;
      try { request = this.indexedDB.open(this.databaseName, 1); }
      catch (_) { resolve(null); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("previews")) {
          const store = db.createObjectStore("previews", { keyPath: "key" });
          store.createIndex("savedAt", "savedAt");
        }
      };
      request.onsuccess = () => {
        this.#database = request.result;
        this.#database.onversionchange = () => { this.#database?.close?.(); this.#database = null; };
        resolve(this.#database);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    }).finally(() => { this.#opening = null; });
    return this.#opening;
  }

  #request(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  #complete(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    });
  }

  async #trim(db) {
    const count = Number(await this.#request(db.transaction("previews", "readonly").objectStore("previews").count())) || 0;
    let remaining = Math.max(0, count - this.maxEntries);
    if (remaining) {
      const transaction = db.transaction("previews", "readwrite");
      const completed = this.#complete(transaction);
      const store = transaction.objectStore("previews");
      await new Promise((resolve, reject) => {
        const cursor = store.index("savedAt").openCursor();
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current || remaining <= 0) { resolve(); return; }
          current.delete(); remaining--; current.continue();
        };
        cursor.onerror = () => reject(cursor.error || new Error("IndexedDB cursor failed"));
      });
      await completed;
    }
  }
}
