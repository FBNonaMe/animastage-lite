const SNAPSHOT_DATA = Symbol("DeterministicWindFieldSnapshot.data");

function characterKey(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("characterId must be a non-empty string");
  }
  return value.trim();
}

function finite(value, name, { min = -Infinity, exclusiveMin = false } = {}) {
  if (!Number.isFinite(value) || (exclusiveMin ? value <= min : value < min)) {
    const operator = exclusiveMin ? ">" : ">=";
    throw new RangeError(`${name} must be a finite number ${operator} ${min}`);
  }
  return value;
}

function integer(value, name, { min = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(`${name} must be a safe integer greater than or equal to ${min}`);
  }
  return value;
}

function exactBoolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
  return value;
}

function normalizeDirection(direction) {
  if (direction == null || typeof direction !== "object") {
    throw new TypeError("direction must be an object or array-like vector");
  }
  const x = Number(direction.x ?? direction[0]);
  const y = Number(direction.y ?? direction[1]);
  const z = Number(direction.z ?? direction[2]);
  if (![x, y, z].every(Number.isFinite)) {
    throw new TypeError("direction must contain three finite components");
  }
  const length = Math.hypot(x, y, z);
  if (length <= 1e-12) return Object.freeze({ x: 0, y: 0, z: 0 });
  return Object.freeze({ x: x / length, y: y / length, z: z / length });
}

function sameStep(first, second) {
  return Math.abs(first - second) <= Math.max(Math.abs(first), Math.abs(second), 1) * 1e-12;
}

function tickAt(time, fixedStep) {
  // A small step-relative epsilon prevents 0.9999999999999999 / (1/60)
  // from selecting the previous tick at exact authored frame boundaries.
  return Math.floor((time + fixedStep * 1e-9) / fixedStep);
}

function cloneState(state) {
  return Object.freeze({
    characterId: state.characterId,
    fixedStep: state.fixedStep,
    tick: state.tick,
    evaluationTime: state.evaluationTime,
    smoothedStrength: state.smoothedStrength,
  });
}

function validateSnapshotState(state) {
  const characterId = characterKey(state?.characterId);
  const fixedStep = finite(state?.fixedStep, "snapshot.fixedStep", { min: 0, exclusiveMin: true });
  const tick = integer(state?.tick, "snapshot.tick");
  const evaluationTime = finite(state?.evaluationTime, "snapshot.evaluationTime", { min: 0 });
  const smoothedStrength = finite(state?.smoothedStrength, "snapshot.smoothedStrength", { min: 0 });
  return { characterId, fixedStep, tick, evaluationTime, smoothedStrength };
}

export class DeterministicWindFieldError extends Error {
  constructor(message, { code = "DETERMINISTIC_WIND_ERROR", details = null } = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class WindTimeDiscontinuityError extends DeterministicWindFieldError {
  constructor(characterId, previousTime, evaluationTime) {
    super(`Wind time for "${characterId}" moved backward from ${previousTime} to ${evaluationTime}`, {
      code: "WIND_TIME_DISCONTINUITY",
      details: { characterId, previousTime, evaluationTime },
    });
  }
}

export class WindFixedStepMismatchError extends DeterministicWindFieldError {
  constructor(characterId, expected, received) {
    super(`Wind fixedStep for "${characterId}" changed from ${expected} to ${received} without reset`, {
      code: "WIND_FIXED_STEP_MISMATCH",
      details: { characterId, expected, received },
    });
  }
}

export class WindAdvanceLimitError extends DeterministicWindFieldError {
  constructor(characterId, steps, limit) {
    super(`Wind advance for "${characterId}" requires ${steps} fixed steps; safety limit is ${limit}`, {
      code: "WIND_ADVANCE_LIMIT",
      details: { characterId, steps, limit },
    });
  }
}

/** Serializable immutable snapshot of one character or the complete field. */
export class DeterministicWindFieldSnapshot {
  #states;

  constructor({ scope, characterId = null, states }) {
    if (scope !== "all" && scope !== "character") throw new TypeError("snapshot scope must be all or character");
    if (!Array.isArray(states)) throw new TypeError("snapshot states must be an array");
    this.scope = scope;
    this.characterId = scope === "character" ? characterKey(characterId) : null;
    this.version = 1;
    const validated = states.map(validateSnapshotState);
    const ids = new Set();
    for (const state of validated) {
      if (ids.has(state.characterId)) throw new TypeError(`snapshot contains duplicate character "${state.characterId}"`);
      ids.add(state.characterId);
    }
    if (scope === "character" && (validated.length > 1 || (validated[0] && validated[0].characterId !== this.characterId))) {
      throw new TypeError("character snapshot state must match snapshot.characterId");
    }
    this.#states = Object.freeze(validated.map(cloneState));
    Object.freeze(this);
  }

  get states() { return this.#states.map((state) => ({ ...state })); }

  toJSON() {
    return {
      type: "DeterministicWindFieldSnapshot",
      version: this.version,
      scope: this.scope,
      characterId: this.characterId,
      states: this.states,
    };
  }

  [SNAPSHOT_DATA]() { return this.#states; }
}

/**
 * Renderer-independent deterministic wind sampler with isolated character
 * smoothing state. No wall clock is read; callers own evaluation time.
 */
export class DeterministicWindField {
  #states = new Map();

  constructor({
    responseRate = -Math.log(0.95) * 60,
    maxAdvanceSteps = 1_000_000,
  } = {}) {
    this.responseRate = finite(responseRate, "responseRate", { min: 0 });
    this.maxAdvanceSteps = integer(maxAdvanceSteps, "maxAdvanceSteps", { min: 1 });
    Object.freeze(this);
  }

  get size() { return this.#states.size; }
  has(characterId) { return this.#states.has(characterKey(characterId)); }

  /** Return a defensive copy of the deterministic state for diagnostics. */
  getState(characterId) {
    const state = this.#states.get(characterKey(characterId));
    return state ? cloneState(state) : null;
  }

  /**
   * Advance one character to an explicit time and sample its wind vector.
   * `targetStrength` is treated as constant over newly crossed fixed steps.
   */
  evaluate(characterId, {
    evaluationTime,
    fixedStep,
    targetStrength,
    direction = { x: 1, y: 0, z: 0 },
    turbulence = 0.15,
    frequency = 0.5,
    phaseOffset = 0,
    isDiscontinuity = false,
  } = {}) {
    const key = characterKey(characterId);
    const time = finite(evaluationTime, "evaluationTime", { min: 0 });
    const step = finite(fixedStep, "fixedStep", { min: 0, exclusiveMin: true });
    const target = finite(targetStrength, "targetStrength", { min: 0 });
    const gustDepth = finite(turbulence, "turbulence", { min: 0 });
    if (gustDepth > 1) throw new RangeError("turbulence must be less than or equal to 1");
    const gustFrequency = finite(frequency, "frequency", { min: 0 });
    const phase = finite(phaseOffset, "phaseOffset");
    exactBoolean(isDiscontinuity, "isDiscontinuity");
    const normalizedDirection = normalizeDirection(direction);
    const targetTick = tickAt(time, step);
    if (!Number.isSafeInteger(targetTick) || targetTick < 0) {
      throw new RangeError("evaluationTime / fixedStep exceeds the safe tick range");
    }

    const previousState = this.#states.get(key);
    let state = previousState ? { ...previousState } : null;
    if (isDiscontinuity) {
      state = {
        characterId: key,
        fixedStep: step,
        tick: targetTick,
        evaluationTime: time,
        smoothedStrength: target,
      };
    } else if (!state) {
      state = {
        characterId: key,
        fixedStep: step,
        tick: 0,
        evaluationTime: 0,
        smoothedStrength: 0,
      };
    } else {
      if (!sameStep(state.fixedStep, step)) {
        throw new WindFixedStepMismatchError(key, state.fixedStep, step);
      }
      if (time + step * 1e-9 < state.evaluationTime) {
        throw new WindTimeDiscontinuityError(key, state.evaluationTime, time);
      }
    }

    const steps = Math.max(0, targetTick - state.tick);
    if (steps > this.maxAdvanceSteps) throw new WindAdvanceLimitError(key, steps, this.maxAdvanceSteps);
    const alpha = this.responseRate === 0 ? 0 : 1 - Math.exp(-this.responseRate * step);
    for (let index = 0; index < steps; index += 1) {
      state.smoothedStrength += (target - state.smoothedStrength) * alpha;
    }
    if (!Number.isFinite(state.smoothedStrength) || state.smoothedStrength < 0) {
      throw new DeterministicWindFieldError(`Wind smoothing for "${key}" produced an invalid strength`, {
        code: "WIND_NUMERIC_FAILURE",
        details: { characterId: key, smoothedStrength: state.smoothedStrength },
      });
    }
    state.tick = targetTick;
    state.evaluationTime = time;

    let gust = 1;
    if (gustDepth > 0 && gustFrequency > 0) {
      const t = time * gustFrequency * Math.PI * 2 + phase;
      gust = 1 + gustDepth * 0.5 * (Math.sin(t) + Math.sin(t * 0.37 + 1.3));
    }
    const magnitude = state.smoothedStrength * gust;
    if (!Number.isFinite(magnitude)) {
      throw new DeterministicWindFieldError(`Wind sampling for "${key}" produced a non-finite magnitude`, {
        code: "WIND_NUMERIC_FAILURE",
        details: { characterId: key, magnitude },
      });
    }
    const vector = Object.freeze({
      x: normalizedDirection.x * magnitude,
      y: normalizedDirection.y * magnitude,
      z: normalizedDirection.z * magnitude,
    });
    this.#states.set(key, state);
    return Object.freeze({
      characterId: key,
      evaluationTime: time,
      fixedStep: step,
      tick: targetTick,
      substepsAdvanced: steps,
      targetStrength: target,
      smoothedStrength: state.smoothedStrength,
      gust,
      magnitude,
      direction: normalizedDirection,
      vector,
    });
  }

  /** Capture one character, including absence, or the entire field. */
  snapshot(characterId = null) {
    if (characterId == null) {
      const states = Array.from(this.#states.values())
        .sort((first, second) => first.characterId < second.characterId ? -1 : first.characterId > second.characterId ? 1 : 0);
      return new DeterministicWindFieldSnapshot({ scope: "all", states });
    }
    const key = characterKey(characterId);
    const state = this.#states.get(key);
    return new DeterministicWindFieldSnapshot({ scope: "character", characterId: key, states: state ? [state] : [] });
  }

  /** Restore the exact state represented by a snapshot. */
  restore(snapshot) {
    if (!(snapshot instanceof DeterministicWindFieldSnapshot)) {
      throw new TypeError("restore expects a DeterministicWindFieldSnapshot");
    }
    const states = snapshot[SNAPSHOT_DATA]();
    if (snapshot.scope === "all") {
      this.#states.clear();
      for (const state of states) this.#states.set(state.characterId, { ...state });
    } else {
      this.#states.delete(snapshot.characterId);
      if (states[0]) this.#states.set(snapshot.characterId, { ...states[0] });
    }
    return this;
  }

  /** Remove one character state or all character states. */
  reset(characterId = null) {
    if (characterId == null) this.#states.clear();
    else this.#states.delete(characterKey(characterId));
    return this;
  }

  /** Lightweight synchronous transaction around snapshot/restore. */
  beginTransaction(characterId = null) {
    const snapshot = this.snapshot(characterId);
    let active = true;
    return Object.freeze({
      get active() { return active; },
      snapshot,
      commit() {
        if (!active) return false;
        active = false;
        return true;
      },
      rollback: () => {
        if (!active) return false;
        this.restore(snapshot);
        active = false;
        return true;
      },
    });
  }
}
