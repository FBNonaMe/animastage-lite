import { EffectOwnershipError } from "../core/EffectErrors.js";
import { normalizeEffectParameterValues } from "../parameters/EffectParameters.js";

let nextInstanceId = 1;

function identity(value, field) {
  if (!value || typeof value !== "object") throw new EffectOwnershipError(`${field} must be an object`);
  const kind = String(value.kind || "").trim();
  const id = String(value.id || "").trim();
  if (!kind || !id) throw new EffectOwnershipError(`${field} requires kind and id`, { field, value });
  return Object.freeze({ kind, id, ref: value.ref ?? null });
}

export class EffectInstance {
  #state = "created";
  #runtime = null;
  #snapshot = null;
  #parameters = null;

  constructor({ definition, owner, target, parameters = {}, instanceId = null, placementId = null }) {
    if (!definition?.manifest) throw new TypeError("EffectInstance requires a registered definition");
    this.instanceId = instanceId || `fx-${String(nextInstanceId++).padStart(6, "0")}`;
    this.definition = definition;
    this.owner = identity(owner, "owner");
    this.target = identity(target, "target");
    this.placementId = placementId == null ? "" : String(placementId).trim();
    this.#parameters = normalizeEffectParameterValues(definition.manifest.parameters, parameters);
    Object.seal(this);
  }

  get state() { return this.#state; }
  get runtime() { return this.#runtime; }
  get snapshot() { return this.#snapshot; }
  get parameters() { return this.#parameters; }
  get slotKey() {
    const placement = this.placementId ? `|placement:${this.placementId}` : "";
    return `${this.owner.kind}:${this.owner.id}|${this.target.kind}:${this.target.id}|${this.definition.manifest.slot}${placement}`;
  }

  transition(next, allowed) {
    if (!allowed.includes(this.#state)) {
      throw new Error(`Effect instance ${this.instanceId} cannot transition ${this.#state} -> ${next}`);
    }
    this.#state = next;
  }

  attachRuntime(runtime, snapshot) {
    this.#runtime = runtime || null;
    this.#snapshot = snapshot ?? null;
  }

  clearRuntime() {
    this.#runtime = null;
    this.#snapshot = null;
  }

  replaceParameters(parameters) {
    this.#parameters = normalizeEffectParameterValues(this.definition.manifest.parameters, parameters);
    return this.#parameters;
  }
}
