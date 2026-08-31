/**
 * Small async transaction used to make renderer state restoration mandatory.
 *
 * Commit hooks run in registration order. Rollback and unconditional cleanup
 * hooks run in reverse order so nested resources unwind safely.
 */

function assertFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
}

function annotateError(error, phase, label) {
  const source = error instanceof Error ? error : new Error(String(error));
  try {
    if (source.transactionPhase === undefined) source.transactionPhase = phase;
    if (source.transactionHook === undefined) source.transactionHook = label;
  } catch {
    // Frozen errors remain useful without annotations.
  }
  return source;
}

export class RenderTransaction {
  #commitHooks = [];
  #rollbackHooks = [];
  #cleanupHooks = [];
  #state = 'open';
  #result = null;

  constructor(label = 'offline-render') {
    this.label = String(label);
  }

  get state() {
    return this.#state;
  }

  get settled() {
    return this.#state === 'committed' || this.#state === 'rolled-back';
  }

  onCommit(callback, label = callback?.name || 'commit hook') {
    this.#assertOpen();
    assertFunction(callback, 'commit callback');
    this.#commitHooks.push({ callback, label: String(label) });
    return this;
  }

  onRollback(callback, label = callback?.name || 'rollback hook') {
    this.#assertOpen();
    assertFunction(callback, 'rollback callback');
    this.#rollbackHooks.push({ callback, label: String(label) });
    return this;
  }

  defer(callback, label = callback?.name || 'cleanup hook') {
    this.#assertOpen();
    assertFunction(callback, 'cleanup callback');
    this.#cleanupHooks.push({ callback, label: String(label) });
    return this;
  }

  async commit(context = {}) {
    if (this.#state === 'committed') return this.#result;
    if (this.#state === 'rolled-back') return this.#result;
    this.#assertOpen();
    this.#state = 'committing';

    const errors = [];
    await this.#run(this.#commitHooks, 'commit', context, errors, false);

    if (errors.length) {
      this.#state = 'rolling-back';
      await this.#run(this.#rollbackHooks, 'rollback', {
        ...context,
        cause: errors[0],
      }, errors, true);
      await this.#run(this.#cleanupHooks, 'cleanup', context, errors, true);
      this.#state = 'rolled-back';
      this.#result = { state: this.#state, errors: [...errors] };
      throw this.#toError(errors, 'Render transaction commit failed');
    }

    await this.#run(this.#cleanupHooks, 'cleanup', context, errors, true);
    if (errors.length) {
      this.#state = 'rolled-back';
      this.#result = { state: this.#state, errors: [...errors] };
      throw this.#toError(errors, 'Render transaction cleanup failed');
    }

    this.#state = 'committed';
    this.#result = { state: this.#state, errors: [] };
    return this.#result;
  }

  async rollback(cause, context = {}) {
    if (this.settled) return this.#result;
    if (this.#state !== 'open') {
      throw new Error(`Cannot roll back transaction while it is ${this.#state}`);
    }
    this.#state = 'rolling-back';
    const errors = [];
    const rollbackContext = { ...context, cause };
    await this.#run(this.#rollbackHooks, 'rollback', rollbackContext, errors, true);
    await this.#run(this.#cleanupHooks, 'cleanup', rollbackContext, errors, true);
    this.#state = 'rolled-back';
    this.#result = { state: this.#state, errors: [...errors] };
    if (errors.length) throw this.#toError(errors, 'Render transaction rollback failed');
    return this.#result;
  }

  #assertOpen() {
    if (this.#state !== 'open') {
      throw new Error(`Render transaction is ${this.#state}; no hooks may be added or executed`);
    }
  }

  async #run(hooks, phase, context, errors, reverse) {
    const ordered = reverse ? [...hooks].reverse() : hooks;
    for (const { callback, label } of ordered) {
      try {
        await callback(context);
      } catch (error) {
        errors.push(annotateError(error, phase, label));
      }
    }
  }

  #toError(errors, message) {
    if (errors.length === 1) return errors[0];
    return new AggregateError(errors, `${message} (${this.label})`);
  }
}
