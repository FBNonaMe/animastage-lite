function freezeRecords(records) { return Object.freeze(records.map((record) => Object.freeze({ ...record }))); }

/** Central inventory for resources owned by effect instances. */
export class EffectResourceTracker {
  #records = new Map();
  #nextId = 1;
  #allocated = 0;
  #released = 0;
  #failedDisposals = 0;

  allocate(owner, label) {
    const token = `effect-resource-${this.#nextId++}`;
    this.#records.set(token, { token, owner: String(owner), label: String(label), state: "active" });
    this.#allocated++;
    return token;
  }

  release(token) {
    const record = this.#records.get(token);
    if (!record) return false;
    this.#records.delete(token);
    this.#released++;
    return true;
  }

  disposalFailed(token, error) {
    const record = this.#records.get(token);
    if (!record) return false;
    record.state = "dispose-failed";
    record.error = error?.message || String(error);
    this.#failedDisposals++;
    return true;
  }

  get stats() {
    const active = [...this.#records.values()];
    return Object.freeze({
      allocated: this.#allocated,
      released: this.#released,
      active: active.length,
      failedDisposals: this.#failedDisposals,
      byOwner: Object.freeze(Object.fromEntries([...new Set(active.map((record) => record.owner))]
        .sort().map((owner) => [owner, active.filter((record) => record.owner === owner).length]))),
    });
  }

  get activeRecords() { return freezeRecords([...this.#records.values()]); }
}
