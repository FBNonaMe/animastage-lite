export class EffectResourceScope {
  #records = [];
  #state = "open";

  constructor(label = "effect-resources", tracker = null) {
    this.label = String(label);
    this.tracker = tracker;
  }

  get state() { return this.#state; }
  get size() { return this.#records.length; }

  own(resource, disposer = null, label = "resource") {
    if (this.#state !== "open") throw new Error(`Resource scope is ${this.#state}`);
    const dispose = disposer || resource?.dispose;
    if (typeof dispose !== "function") throw new TypeError("Owned effect resources require a disposer");
    const token = this.tracker?.allocate?.(this.label, label) || null;
    this.#records.push({
      resource,
      label: String(label),
      token,
      dispose: disposer ? () => disposer(resource) : () => dispose.call(resource),
    });
    return resource;
  }

  defer(disposer, label = disposer?.name || "cleanup") {
    if (typeof disposer !== "function") throw new TypeError("Deferred cleanup must be a function");
    return this.own(null, disposer, label);
  }

  commit() {
    if (this.#state !== "open") throw new Error(`Resource scope is ${this.#state}`);
    this.#state = "committed";
    return this;
  }

  async dispose(reason = "effect-disabled") {
    if (this.#state === "disposed") return [];
    this.#state = "disposing";
    const errors = [];
    for (const record of [...this.#records].reverse()) {
      try {
        await record.dispose(reason);
        if (record.token) this.tracker?.release?.(record.token);
      }
      catch (error) {
        try { error.effectResource = record.label; } catch (_) {}
        if (record.token) this.tracker?.disposalFailed?.(record.token, error);
        errors.push(error);
      }
    }
    this.#records.length = 0;
    this.#state = "disposed";
    return errors;
  }
}
