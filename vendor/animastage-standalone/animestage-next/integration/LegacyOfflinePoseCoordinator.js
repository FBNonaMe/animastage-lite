function finiteNonNegative(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${name} must be a finite number greater than or equal to zero`);
  }
  return number;
}

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
  return value;
}

/**
 * Transitional synchronous bridge for the legacy Three/MMD runtime.
 *
 * It gives the current application one deterministic authored-pose -> physics
 * transaction without forcing the 26k-line shell to be replaced in one risky
 * change. The bridge deliberately owns timeline time; no stage may infer an
 * offline time from UI visibility or transport play/pause state.
 */
export class LegacyOfflinePoseCoordinator {
  #sampleAnimation;
  #sampleManualOverlay;
  #samplePerformance;
  #advancePhysics;
  #finalizePhysics;
  #getStates;
  #captureState;
  #restoreState;
  #onStage;
  #evaluating = false;

  constructor({
    sampleAnimation,
    sampleManualOverlay = () => {},
    samplePerformance = () => {},
    advancePhysics,
    finalizePhysics,
    getStates,
    captureState = null,
    restoreState = null,
    onStage = null,
  } = {}) {
    this.#sampleAnimation = requiredFunction(sampleAnimation, "sampleAnimation");
    this.#sampleManualOverlay = requiredFunction(sampleManualOverlay, "sampleManualOverlay");
    this.#samplePerformance = requiredFunction(samplePerformance, "samplePerformance");
    this.#advancePhysics = requiredFunction(advancePhysics, "advancePhysics");
    this.#finalizePhysics = requiredFunction(finalizePhysics, "finalizePhysics");
    this.#getStates = requiredFunction(getStates, "getStates");
    if (captureState != null) this.#captureState = requiredFunction(captureState, "captureState");
    if (restoreState != null) this.#restoreState = requiredFunction(restoreState, "restoreState");
    if (onStage != null) this.#onStage = requiredFunction(onStage, "onStage");
    if (!!this.#captureState !== !!this.#restoreState) {
      throw new TypeError("captureState and restoreState must be supplied together");
    }
  }

  get evaluating() { return this.#evaluating; }

  sampleAuthoredPose(timeSeconds, deltaSeconds = 0, metadata = {}) {
    const time = finiteNonNegative(timeSeconds, "timeSeconds");
    const delta = finiteNonNegative(deltaSeconds, "deltaSeconds");
    this.#stage("animation", metadata, () => this.#sampleAnimation(time, metadata));
    this.#stage("manual-overlay", metadata, () => this.#sampleManualOverlay(time, metadata));
    this.#stage("performance", metadata, () => this.#samplePerformance(delta, time, metadata));
  }

  evaluateFrame({ timeSeconds, deltaSeconds = 0, physicsTimeline = null, metadata = {} } = {}) {
    if (this.#evaluating) throw new Error("LegacyOfflinePoseCoordinator is already evaluating a frame");
    const time = finiteNonNegative(timeSeconds, "timeSeconds");
    const delta = finiteNonNegative(deltaSeconds, "deltaSeconds");
    const clock = physicsTimeline || { time: Math.max(0, time - delta) };
    if (!Number.isFinite(Number(clock.time))) clock.time = Math.max(0, time - delta);
    const states = this.#getStates() || [];
    const rollback = this.#captureState?.(states) ?? null;
    this.#evaluating = true;

    try {
      this.#stage("physics", metadata, () => this.#advancePhysics(states, delta, {
        beforeStep: (fixedStep, index, count) => {
          const step = finiteNonNegative(fixedStep, "fixedStep");
          clock.time += step;
          this.sampleAuthoredPose(clock.time, step, {
            ...metadata,
            substepIndex: index,
            substepCount: count,
            physicsSubstep: true,
          });
          // The physics adapter consumes this same authoritative time for
          // deterministic per-substep effects such as character wind.
          return clock.time;
        },
      }));

      // The video sample may lie between physics ticks. Re-evaluate authored
      // layers at the exact frame time, then restore only physics-owned bones.
      this.sampleAuthoredPose(time, 0, { ...metadata, exactFrameSample: true });
      this.#stage("physics-finalize", metadata, () => this.#finalizePhysics(states));
      return Object.freeze({ states, timeSeconds: time, deltaSeconds: delta, physicsTime: clock.time });
    } catch (error) {
      if (rollback != null) {
        try { this.#restoreState(rollback, states); }
        catch (restoreError) {
          try { error.restoreError = restoreError; } catch (_) {}
        }
      }
      throw error;
    } finally {
      this.#evaluating = false;
    }
  }

  #stage(name, metadata, task) {
    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    this.#onStage?.({ phase: "begin", name, metadata, startedAt });
    try {
      const result = task();
      this.#onStage?.({
        phase: "end",
        name,
        metadata,
        status: "completed",
        durationMs: (globalThis.performance?.now?.() ?? Date.now()) - startedAt,
      });
      return result;
    } catch (error) {
      this.#onStage?.({
        phase: "end",
        name,
        metadata,
        status: "failed",
        error,
        durationMs: (globalThis.performance?.now?.() ?? Date.now()) - startedAt,
      });
      throw error;
    }
  }
}
