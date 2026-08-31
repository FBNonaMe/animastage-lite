import { EffectGraph } from "../graph/EffectGraph.js";
import { normalizeEffectParameterValues } from "../parameters/EffectParameters.js";
import {
  EFFECT_STACK_SCHEMA,
  createEffectStackPreset,
  normalizeEffectStackPreset,
  normalizeEffectStackSnapshot,
} from "../presets/EffectPresets.js";
import { EffectPlatformError } from "../core/EffectErrors.js";

let nextStackEntryId = 1;
const newEntryId = () => `stack-fx-${String(nextStackEntryId++).padStart(6, "0")}`;

function identity(value, fallback) {
  const source = value || fallback;
  if (!source || typeof source !== "object" || !String(source.kind || "").trim() || !String(source.id || "").trim()) {
    throw new EffectPlatformError("Effect Stack ownership requires kind and id", { code: "EFFECT_STACK_OWNERSHIP_INVALID" });
  }
  return { kind: String(source.kind), id: String(source.id), ref: source.ref ?? null };
}

function publicEntry(record) {
  return Object.freeze({
    stackEntryId: record.stackEntryId,
    definition: record.definition,
    owner: record.owner,
    target: record.target,
    parameters: record.instance?.parameters || record.parameters,
    enabled: record.enabled,
    label: record.label,
    instanceId: record.instance?.instanceId || null,
    state: record.instance?.state || (record.enabled ? "pending" : "disabled"),
  });
}

/**
 * Transactional editor-facing stack. Definitions remain immutable while each
 * placement owns parameters, target, lifecycle and a unique runtime slot.
 */
export class EffectStack {
  #records = new Map();
  #order = [];
  #listeners = new Set();
  #graph = new EffectGraph([]);
  #busy = false;

  constructor({ registry, runtime, adapter, compatibility = null, diagnostics = runtime?.diagnostics } = {}) {
    if (!registry || !runtime || !adapter) throw new TypeError("EffectStack requires registry, runtime, and adapter");
    this.registry = registry;
    this.runtime = runtime;
    this.adapter = adapter;
    this.compatibility = compatibility;
    this.diagnostics = diagnostics;
  }

  get entries() { return this.#order.map((id) => this.#records.get(id)).filter(Boolean).map(publicEntry); }
  get size() { return this.#order.length; }
  get graph() { return this.#graph; }
  get busy() { return this.#busy; }
  getEntry(stackEntryId) {
    const record = this.#records.get(String(stackEntryId));
    return record ? publicEntry(record) : null;
  }

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("Effect Stack listener must be a function");
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async add(reference, {
    owner = { kind: "editor", id: "shader-studio" },
    target = null,
    parameters = {},
    enabled = true,
    label = "",
    stackEntryId = null,
    index = this.#order.length,
    context = {},
  } = {}) {
    this.#assertIdle();
    const requestedDefinition = typeof reference === "string" ? this.registry.require(reference) : reference;
    const resolution = this.compatibility?.resolve?.(requestedDefinition) || { definition: requestedDefinition, compatibility: { compatible: true } };
    if (!resolution.definition) {
      throw new EffectPlatformError(`${requestedDefinition.manifest.name} is not supported by the active renderer`, {
        code: "EFFECT_RENDERER_INCOMPATIBLE",
        details: { effect: requestedDefinition.key, compatibility: resolution.compatibility },
      });
    }
    const definition = resolution.definition;
    this.registry.resolveDependencyOrder(definition);
    const id = String(stackEntryId || newEntryId());
    if (this.#records.has(id)) throw new EffectPlatformError(`Effect Stack entry ${id} already exists`, { code: "EFFECT_STACK_DUPLICATE" });
    const resolvedTarget = identity(target || this.adapter.getTarget?.(definition.manifest), null);
    const record = {
      stackEntryId: id,
      definition,
      owner: identity(owner),
      target: resolvedTarget,
      parameters: normalizeEffectParameterValues(definition.manifest.parameters, resolution.fallbackFrom
        ? Object.fromEntries(Object.entries(parameters || {}).filter(([name]) => definition.manifest.parameters.some((entry) => entry.name === name)))
        : parameters),
      enabled: enabled !== false,
      label: String(label || ""),
      instance: null,
    };
    const insertAt = Math.max(0, Math.min(this.#order.length, Math.trunc(Number(index) || 0)));
    this.#busy = true;
    try {
      if (record.enabled) record.instance = await this.#applyRecord(record, context);
      this.#records.set(id, record);
      this.#order.splice(insertAt, 0, id);
      try { await this.#syncGraph(context); }
      catch (error) {
        this.#records.delete(id);
        this.#order.splice(this.#order.indexOf(id), 1);
        if (record.instance) await this.runtime.disable(record.instance, { ...context, cause: error });
        throw error;
      }
      this.#emit("added", record);
      return publicEntry(record);
    } finally { this.#busy = false; }
  }

  async duplicate(stackEntryId, options = {}) {
    const source = this.#requireRecord(stackEntryId);
    const sourceIndex = this.#order.indexOf(source.stackEntryId);
    return this.add(source.definition, {
      owner: source.owner,
      target: source.target,
      parameters: source.instance?.parameters || source.parameters,
      enabled: source.enabled,
      label: options.label ?? (source.label ? `${source.label} copy` : `${source.definition.manifest.name} copy`),
      index: options.index ?? sourceIndex + 1,
      context: options.context || {},
    });
  }

  async remove(stackEntryId, context = {}) {
    this.#assertIdle();
    const record = this.#requireRecord(stackEntryId);
    const oldIndex = this.#order.indexOf(record.stackEntryId);
    this.#busy = true;
    try {
      if (record.instance) await this.runtime.disable(record.instance, context);
      record.instance = null;
      this.#records.delete(record.stackEntryId);
      this.#order.splice(oldIndex, 1);
      try { await this.#syncGraph(context); }
      catch (error) {
        this.#records.set(record.stackEntryId, record);
        this.#order.splice(oldIndex, 0, record.stackEntryId);
        if (record.enabled) record.instance = await this.#applyRecord(record, { ...context, rollback: true });
        await this.#syncGraph({ ...context, rollback: true });
        throw error;
      }
      this.#emit("removed", record);
      return true;
    } finally { this.#busy = false; }
  }

  async move(stackEntryId, toIndex, context = {}) {
    this.#assertIdle();
    const record = this.#requireRecord(stackEntryId);
    const from = this.#order.indexOf(record.stackEntryId);
    const to = Math.max(0, Math.min(this.#order.length - 1, Math.trunc(Number(toIndex) || 0)));
    if (from === to) return publicEntry(record);
    const oldOrder = this.#order.slice();
    this.#order.splice(from, 1);
    this.#order.splice(to, 0, record.stackEntryId);
    this.#busy = true;
    try {
      await this.#syncGraph(context);
      this.#emit("moved", record);
      return publicEntry(record);
    } catch (error) {
      this.#order = oldOrder;
      await this.#syncGraph({ ...context, rollback: true });
      throw error;
    } finally { this.#busy = false; }
  }

  async setEnabled(stackEntryId, enabled, context = {}) {
    this.#assertIdle();
    const record = this.#requireRecord(stackEntryId);
    const next = enabled !== false;
    if (record.enabled === next) return publicEntry(record);
    this.#busy = true;
    try {
      if (next) {
        record.instance = await this.#applyRecord(record, context);
        record.enabled = true;
        try { await this.#syncGraph(context); }
        catch (error) {
          await this.runtime.disable(record.instance, { ...context, cause: error });
          record.instance = null;
          record.enabled = false;
          throw error;
        }
      } else {
        if (record.instance) await this.runtime.disable(record.instance, context);
        record.instance = null;
        record.enabled = false;
        await this.#syncGraph(context);
      }
      this.#emit("enabled", record);
      return publicEntry(record);
    } finally { this.#busy = false; }
  }

  async updateParameters(stackEntryId, patch, context = {}) {
    this.#assertIdle();
    const record = this.#requireRecord(stackEntryId);
    const previous = record.instance?.parameters || record.parameters;
    const next = normalizeEffectParameterValues(record.definition.manifest.parameters, patch, { partial: true, base: previous });
    this.#busy = true;
    try {
      if (record.instance) await this.runtime.updateParameters(record.instance, patch, context);
      record.parameters = next;
      this.#emit("parameters", record);
      return publicEntry(record);
    } finally { this.#busy = false; }
  }

  snapshot() {
    return normalizeEffectStackSnapshot({
      schema: EFFECT_STACK_SCHEMA,
      entries: this.#order.map((id) => {
        const record = this.#records.get(id);
        return {
          stackEntryId: id,
          effect: { id: record.definition.manifest.id, version: record.definition.manifest.version },
          owner: { kind: record.owner.kind, id: record.owner.id },
          target: { kind: record.target.kind, id: record.target.id },
          parameters: record.instance?.parameters || record.parameters,
          enabled: record.enabled,
          label: record.label,
        };
      }),
    });
  }

  createPreset(options = {}) { return createEffectStackPreset(this.snapshot(), options); }

  preflight(input, options = {}) {
    const snapshot = input?.schema === "animestage.effect-stack-preset/v1"
      ? normalizeEffectStackPreset(input).stack
      : normalizeEffectStackSnapshot(input);
    const skipped = [];
    const records = [];
    for (const entry of snapshot.entries) {
      const requestedDefinition = this.registry.resolve(entry.effect.id, entry.effect.version);
      const resolution = requestedDefinition
        ? (this.compatibility?.resolve?.(requestedDefinition) || { definition: requestedDefinition, compatibility: { compatible: true } })
        : null;
      const definition = resolution?.definition || null;
      if (!definition) {
        const issue = {
          stackEntryId: entry.stackEntryId,
          effect: entry.effect,
          reason: requestedDefinition ? "incompatible-effect" : "missing-effect",
          compatibility: resolution?.compatibility || null,
        };
        if (options.missing === "skip") { skipped.push(issue); continue; }
        throw new EffectPlatformError(`Effect ${entry.effect.id}@${entry.effect.version} is missing`, {
          code: "EFFECT_STACK_MISSING_EFFECT", details: issue,
        });
      }
      this.registry.resolveDependencyOrder(definition);
      const parameters = normalizeEffectParameterValues(definition.manifest.parameters, resolution?.fallbackFrom
        ? Object.fromEntries(Object.entries(entry.parameters || {}).filter(([name]) => definition.manifest.parameters.some((item) => item.name === name)))
        : entry.parameters);
      const owner = identity(options.resolveOwner?.(entry.owner, definition, entry) || entry.owner);
      const target = identity(
        options.resolveTarget?.(entry.target, definition, entry)
          || this.adapter.getTarget?.(definition.manifest)
          || entry.target,
      );
      records.push({
        stackEntryId: entry.stackEntryId,
        definition,
        owner,
        target,
        parameters,
        enabled: entry.enabled,
        label: entry.label,
        instance: null,
      });
    }
    // Graph validation is mutation-free and therefore safe during Session v3 preflight.
    const graph = new EffectGraph(records);
    return Object.freeze({ snapshot, records, skipped: Object.freeze(skipped), graph });
  }

  async restore(input, options = {}) {
    this.#assertIdle();
    const plan = this.preflight(input, options);
    const previous = this.#order.map((id) => this.#records.get(id));
    this.#busy = true;
    try {
      await this.#disableRecords(previous, { ...options.context, reason: "stack-restore" });
      this.#records.clear();
      this.#order = [];
      try {
        for (const planned of plan.records) {
          const record = { ...planned };
          if (record.enabled) record.instance = await this.#applyRecord(record, options.context || {});
          this.#records.set(record.stackEntryId, record);
          this.#order.push(record.stackEntryId);
        }
        await this.#syncGraph(options.context || {});
      } catch (error) {
        const partial = this.#order.map((id) => this.#records.get(id));
        await this.#disableRecords(partial, { ...options.context, cause: error, reason: "stack-restore-failed" });
        this.#records.clear();
        this.#order = [];
        try {
          for (const old of previous) {
            const record = { ...old, instance: null, parameters: old.instance?.parameters || old.parameters };
            if (record.enabled) record.instance = await this.#applyRecord(record, { ...options.context, rollback: true });
            this.#records.set(record.stackEntryId, record);
            this.#order.push(record.stackEntryId);
          }
          await this.#syncGraph({ ...options.context, rollback: true });
        } catch (rollbackError) { try { error.rollbackError = rollbackError; } catch (_) {} }
        throw error;
      }
      for (const issue of plan.skipped) this.#diagnostic(
        "warning",
        "EFFECT_STACK_ENTRY_SKIPPED",
        issue.reason === "incompatible-effect"
          ? "Renderer-incompatible effect was skipped during stack restore"
          : "Missing effect was skipped during stack restore",
        issue,
      );
      this.#emit("restored", null);
      return this.snapshot();
    } finally { this.#busy = false; }
  }

  async clear(context = {}) {
    return this.restore({ schema: EFFECT_STACK_SCHEMA, entries: [] }, { context });
  }

  async #applyRecord(record, context) {
    return this.runtime.apply(record.definition, {
      owner: record.owner,
      target: record.target,
      parameters: record.parameters,
      placementId: record.stackEntryId,
      context: { ...context, stackEntryId: record.stackEntryId },
    });
  }

  async #disableRecords(records, context) {
    const errors = [];
    for (const record of [...records].reverse()) {
      if (!record?.instance) continue;
      try { await this.runtime.disable(record.instance, context); }
      catch (error) { errors.push(error); }
      record.instance = null;
    }
    if (errors.length) throw new AggregateError(errors, "One or more effects could not be disabled");
  }

  async #syncGraph(context = {}) {
    const records = this.#order.map((id) => this.#records.get(id)).filter(Boolean);
    const graph = new EffectGraph(records);
    const orderedEntryIds = [];
    for (const node of graph.orderedNodes) if (!orderedEntryIds.includes(node.entryId)) orderedEntryIds.push(node.entryId);
    const orderedInstances = orderedEntryIds
      .map((id) => this.#records.get(id)?.instance)
      .filter(Boolean);
    await this.adapter.reorderEffects?.(orderedInstances, graph, context);
    this.#graph = graph;
    this.#diagnostic("debug", "EFFECT_GRAPH_COMMITTED", "Effect graph order committed", {
      entries: orderedEntryIds, passes: graph.order,
    });
    return graph;
  }

  #requireRecord(stackEntryId) {
    const record = this.#records.get(String(stackEntryId));
    if (!record) throw new EffectPlatformError(`Unknown Effect Stack entry ${stackEntryId}`, { code: "EFFECT_STACK_ENTRY_MISSING" });
    return record;
  }
  #assertIdle() {
    if (this.#busy) throw new EffectPlatformError("Effect Stack is already changing", { code: "EFFECT_STACK_BUSY" });
  }
  #diagnostic(severity, code, message, details) {
    try { this.diagnostics?.emit({ severity, code, message, stageId: "effect-stack", details }); } catch (_) {}
  }
  #emit(type, record) {
    const event = Object.freeze({ type, entry: record ? publicEntry(record) : null, snapshot: this.snapshot() });
    for (const listener of this.#listeners) { try { listener(event); } catch (_) {} }
  }
}
