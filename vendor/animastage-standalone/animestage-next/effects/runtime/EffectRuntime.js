import { DiagnosticCollector, ensureDiagnosticCollector } from "../../core/Diagnostics.js";
import { EffectApplyError, EffectOwnershipError, EffectPlatformError } from "../core/EffectErrors.js";
import { EffectResourceScope } from "../core/EffectResourceScope.js";
import { normalizeEffectParameterValues } from "../parameters/EffectParameters.js";
import { EffectInstance } from "./EffectInstance.js";
import { EffectFrameState } from "./EffectFrameState.js";
import { EffectResourceTracker } from "../diagnostics/EffectResourceTracker.js";

function implementationFactory(definition) {
  const implementation = definition.implementation;
  if (typeof implementation === "function") return implementation;
  if (typeof implementation?.create === "function") return implementation.create.bind(implementation);
  throw new EffectPlatformError(`Effect ${definition.key} has no runtime implementation`, {
    code: "EFFECT_IMPLEMENTATION_MISSING",
    details: { effect: definition.key },
  });
}

export class EffectRuntime {
  #instances = new Map();
  #slots = new Map();
  #busySlots = new Set();

  constructor({ registry, adapter, diagnostics = null } = {}) {
    if (!registry) throw new TypeError("EffectRuntime requires an EffectsRegistry");
    if (!adapter || typeof adapter !== "object") throw new TypeError("EffectRuntime requires an adapter");
    this.registry = registry;
    this.adapter = adapter;
    this.diagnostics = diagnostics == null ? new DiagnosticCollector({ capacity: 1500 }) : ensureDiagnosticCollector(diagnostics);
    this.resources = new EffectResourceTracker();
  }

  get instances() { return [...this.#instances.values()]; }
  get resourceStats() { return this.resources.stats; }

  getInstance(instanceId) { return this.#instances.get(String(instanceId)) || null; }

  evaluateFrame(frameContext, options = {}) {
    const frame = frameContext instanceof EffectFrameState
      ? frameContext
      : EffectFrameState.fromFrameContext(frameContext, options);
    let updated = 0;
    let failed = 0;
    try { this.adapter.updateFrame?.(frame); }
    catch (error) {
      this.diagnostics.emit({
        severity: "error", code: "EFFECT_FRAME_ADAPTER_FAILED",
        message: "Effect frame adapter failed; individual effects remain isolated",
        frameId: frame.frameId, details: { cause: error?.message || String(error) },
      });
    }
    for (const instance of this.#instances.values()) {
      if (instance.state !== "active" || typeof instance.runtime?.updateFrame !== "function") continue;
      try {
        const result = instance.runtime.updateFrame(frame);
        if (result && typeof result.then === "function") {
          throw new Error("Effect updateFrame must be synchronous and deterministic");
        }
        updated++;
      } catch (error) {
        failed++;
        this.diagnostics.emit({
          severity: "error", code: "EFFECT_FRAME_FAILED",
          message: `${instance.definition.manifest.name} failed during frame evaluation and was disabled`,
          stageId: instance.instanceId, frameId: frame.frameId,
          details: { effect: instance.definition.key, cause: error?.message || String(error) },
        });
        // An async disable begins synchronously through deactivate(), removing
        // the offending pass before the composer draws the current frame.
        void this.disable(instance, { source: "effect-frame-failure", cause: error }).catch((disableError) => {
          this.diagnostics.emit({
            severity: "error", code: "EFFECT_FRAME_DISABLE_FAILED",
            message: `${instance.definition.manifest.name} could not be fully disabled after a frame failure`,
            stageId: instance.instanceId, frameId: frame.frameId,
            details: { cause: disableError?.message || String(disableError) },
          });
        });
      }
    }
    return Object.freeze({ frame, updated, failed, active: this.#instances.size });
  }

  async apply(reference, { owner, target, parameters = {}, context = {}, instanceId = null, placementId = null } = {}) {
    const definition = typeof reference === "string" ? this.registry.require(reference) : reference;
    if (this.registry.isQuarantined(definition.key)) {
      throw new EffectPlatformError(`Effect ${definition.key} is quarantined`, {
        code: "EFFECT_QUARANTINED",
        details: { effect: definition.key },
      });
    }
    this.registry.resolveDependencyOrder(definition);
    const instance = new EffectInstance({ definition, owner, target, parameters, instanceId, placementId });
    if (this.#busySlots.has(instance.slotKey)) {
      throw new EffectOwnershipError(`Effect slot ${instance.slotKey} is already changing`, { slot: instance.slotKey });
    }
    this.#busySlots.add(instance.slotKey);
    const resources = new EffectResourceScope(instance.instanceId, this.resources);
    let snapshot = null;
    let runtime = null;
    try {
      instance.transition("preparing", ["created"]);
      snapshot = typeof this.adapter.capture === "function"
        ? await this.adapter.capture(instance, context)
        : null;
      runtime = await implementationFactory(definition)({
        instance,
        manifest: definition.manifest,
        parameters: instance.parameters,
        owner: instance.owner,
        target: instance.target,
        adapter: this.adapter,
        resources,
        diagnostics: this.diagnostics,
        context,
      });
      if (runtime != null && typeof runtime !== "object") {
        throw new TypeError(`Effect ${definition.key} returned an invalid runtime`);
      }
      instance.transition("validating", ["preparing"]);
      if (typeof runtime?.validate === "function") await runtime.validate(context);
      instance.transition("activating", ["validating"]);
      if (typeof runtime?.activate === "function") await runtime.activate(context);
      if (typeof this.adapter.validate === "function") await this.adapter.validate(instance, runtime, context);
      resources.commit();
      instance.attachRuntime({ ...(runtime || {}), resources }, snapshot);
      instance.transition("active", ["activating"]);

      const previous = this.#slots.get(instance.slotKey) || null;
      this.#slots.set(instance.slotKey, instance);
      this.#instances.set(instance.instanceId, instance);
      if (previous) await this.#retireReplaced(previous, instance, context);
      this.registry.markRecent(definition);
      this.diagnostics.emit({
        severity: "info",
        code: "EFFECT_APPLIED",
        message: `${definition.manifest.name} enabled`,
        stageId: instance.instanceId,
        details: { effect: definition.key, owner: instance.owner.id, target: instance.target.id },
      });
      return instance;
    } catch (error) {
      try { if (typeof runtime?.deactivate === "function") await runtime.deactivate({ ...context, cause: error }); }
      catch (deactivateError) { try { error.deactivateError = deactivateError; } catch (_) {} }
      const disposalErrors = await resources.dispose("apply-failed");
      try {
        if (typeof this.adapter.restore === "function") await this.adapter.restore(snapshot, instance, { ...context, cause: error });
      } catch (restoreError) {
        try { error.restoreError = restoreError; } catch (_) {}
      }
      instance.transition("failed", ["created", "preparing", "validating", "activating"]);
      this.diagnostics.emit({
        severity: "error",
        code: "EFFECT_APPLY_ROLLED_BACK",
        message: `${definition.manifest.name} failed; previous state restored`,
        stageId: instance.instanceId,
        details: { effect: definition.key, cause: error?.message || String(error), disposalErrors: disposalErrors.length },
      });
      throw new EffectApplyError(definition.manifest.id, error, { instanceId: instance.instanceId });
    } finally {
      this.#busySlots.delete(instance.slotKey);
    }
  }

  async disable(instanceOrId, context = {}) {
    const instance = typeof instanceOrId === "string" ? this.#instances.get(instanceOrId) : instanceOrId;
    if (!instance || instance.state === "disposed") return false;
    if (this.#busySlots.has(instance.slotKey)) throw new EffectOwnershipError(`Effect slot ${instance.slotKey} is busy`);
    this.#busySlots.add(instance.slotKey);
    try {
      instance.transition("disabling", ["active", "replaced"]);
      if (typeof instance.runtime?.deactivate === "function") await instance.runtime.deactivate(context);
      await instance.runtime?.resources?.dispose("effect-disabled");
      if (instance.runtime?.restoreOnDisable !== false && typeof this.adapter.restore === "function") {
        await this.adapter.restore(instance.snapshot, instance, context);
      }
      instance.clearRuntime();
      instance.transition("disposed", ["disabling"]);
      this.#instances.delete(instance.instanceId);
      if (this.#slots.get(instance.slotKey) === instance) this.#slots.delete(instance.slotKey);
      this.diagnostics.emit({
        severity: "info",
        code: "EFFECT_DISABLED",
        message: `${instance.definition.manifest.name} disabled`,
        stageId: instance.instanceId,
      });
      return true;
    } finally {
      this.#busySlots.delete(instance.slotKey);
    }
  }

  async updateParameters(instanceOrId, patch, context = {}) {
    const instance = typeof instanceOrId === "string" ? this.#instances.get(instanceOrId) : instanceOrId;
    if (!instance || instance.state !== "active") throw new EffectOwnershipError("Only an active effect can be edited");
    if (this.#busySlots.has(instance.slotKey)) throw new EffectOwnershipError(`Effect slot ${instance.slotKey} is busy`);
    const previous = instance.parameters;
    const next = normalizeEffectParameterValues(instance.definition.manifest.parameters, patch, {
      partial: true,
      base: previous,
    });
    this.#busySlots.add(instance.slotKey);
    try {
      if (typeof instance.runtime?.updateParameters !== "function") {
        throw new EffectPlatformError(`Effect ${instance.definition.key} does not support live parameters`, {
          code: "EFFECT_PARAMETERS_UNSUPPORTED",
          details: { effect: instance.definition.key },
        });
      }
      await instance.runtime.updateParameters(next, previous, context);
      if (typeof this.adapter.validate === "function") await this.adapter.validate(instance, instance.runtime, context);
      instance.replaceParameters(next);
      this.diagnostics.emit({
        severity: "info",
        code: "EFFECT_PARAMETERS_UPDATED",
        message: `${instance.definition.manifest.name} parameters updated`,
        stageId: instance.instanceId,
        details: { effect: instance.definition.key, changed: Object.keys(patch || {}) },
      });
      return instance.parameters;
    } catch (error) {
      try { await instance.runtime?.updateParameters?.(previous, next, { ...context, rollback: true, cause: error }); }
      catch (rollbackError) { try { error.rollbackError = rollbackError; } catch (_) {} }
      this.diagnostics.emit({
        severity: "error",
        code: "EFFECT_PARAMETER_UPDATE_ROLLED_BACK",
        message: `${instance.definition.manifest.name} parameter update failed; previous values restored`,
        stageId: instance.instanceId,
        details: { effect: instance.definition.key, cause: error?.message || String(error) },
      });
      throw error;
    } finally {
      this.#busySlots.delete(instance.slotKey);
    }
  }

  async #retireReplaced(previous, replacement, context) {
    if (previous.state !== "active") return;
    previous.transition("replaced", ["active"]);
    try { if (typeof previous.runtime?.deactivate === "function") await previous.runtime.deactivate({ ...context, replacement }); }
    finally {
      await previous.runtime?.resources?.dispose("effect-replaced");
      previous.clearRuntime();
      previous.transition("disposed", ["replaced"]);
      this.#instances.delete(previous.instanceId);
    }
  }
}
