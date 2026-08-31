import { createDeterministicWarmupPlan } from "../render/OfflineFrameCoordinator.mjs";
import {
  RenderCancelledError,
  isRenderCancelled,
  throwIfAborted,
} from "../render/Cancellation.mjs";

export const LEGACY_PREROLL_MODES = Object.freeze({
  DISABLED: "disabled",
  BOUNDED: "bounded",
  FULL: "full",
});

export const DEFAULT_LEGACY_PREROLL_WINDOW_SECONDS = 2.5;
export const DEFAULT_LEGACY_PREROLL_STEP_HZ = 65;

function finiteNonNegative(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${name} must be finite and greater than or equal to zero`);
  }
  return number;
}

function positiveFinite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError(`${name} must be positive and finite`);
  }
  return number;
}

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
  return value;
}

function optionalFunction(value, name) {
  if (value != null && typeof value !== "function") throw new TypeError(`${name} must be a function`);
  return value ?? null;
}

function normalizeMode(value) {
  const mode = value ?? LEGACY_PREROLL_MODES.BOUNDED;
  if (!Object.values(LEGACY_PREROLL_MODES).includes(mode)) {
    throw new RangeError(`Unsupported offline preroll mode: ${String(mode)}`);
  }
  return mode;
}

function defaultYieldControl() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function sameTime(left, right) {
  return Math.abs(Number(left) - Number(right)) <= 1e-10;
}

/**
 * Transitional production bridge for deterministic legacy physics preroll.
 *
 * It consumes the exact same warmup step contract as OfflineFrameCoordinator,
 * but owns no camera, renderer, DOM, frame adapter or output sink. Every step
 * evaluates the complete scene-wide character pose coordinator once, so two
 * characters never receive two different scene clocks.
 */
export class LegacyOfflinePrerollBridge {
  #poseCoordinator;
  #getStates;
  #preparePhysics;
  #captureState;
  #restoreState;
  #onBegin;
  #onStep;
  #onEnd;
  #onRollback;
  #onDiagnostic;
  #yieldControl;
  #activeRecord = null;
  #records = new WeakMap();
  #sequence = 0;

  constructor({
    poseCoordinator,
    getStates,
    preparePhysics,
    captureState = null,
    restoreState = null,
    onBegin = null,
    onStep = null,
    onEnd = null,
    onRollback = null,
    onDiagnostic = null,
    yieldControl = defaultYieldControl,
  } = {}) {
    if (!poseCoordinator || typeof poseCoordinator.sampleAuthoredPose !== "function"
      || typeof poseCoordinator.evaluateFrame !== "function") {
      throw new TypeError("poseCoordinator must implement sampleAuthoredPose and evaluateFrame");
    }
    this.#poseCoordinator = poseCoordinator;
    this.#getStates = requiredFunction(getStates, "getStates");
    this.#preparePhysics = requiredFunction(preparePhysics, "preparePhysics");
    this.#captureState = optionalFunction(captureState, "captureState");
    this.#restoreState = optionalFunction(restoreState, "restoreState");
    if (!!this.#captureState !== !!this.#restoreState) {
      throw new TypeError("captureState and restoreState must be supplied together");
    }
    this.#onBegin = optionalFunction(onBegin, "onBegin");
    this.#onStep = optionalFunction(onStep, "onStep");
    this.#onEnd = optionalFunction(onEnd, "onEnd");
    this.#onRollback = optionalFunction(onRollback, "onRollback");
    this.#onDiagnostic = optionalFunction(onDiagnostic, "onDiagnostic");
    this.#yieldControl = requiredFunction(yieldControl, "yieldControl");
  }

  get active() { return this.#activeRecord != null; }

  async begin(options = {}) {
    if (this.#activeRecord) throw new Error("Legacy offline preroll is already active");
    const normalized = this.#normalizeOptions(options);
    const plan = this.#createPlan(normalized);
    const states = this.#getStates() || [];
    if (!Array.isArray(states)) throw new TypeError("getStates must return an array");
    const token = Object.freeze({
      id: `legacy-preroll-${++this.#sequence}`,
      plan,
      physicsTimeline: { time: plan.fromTimeSeconds },
    });
    const record = {
      token,
      options: normalized,
      states,
      snapshot: null,
      snapshotCaptured: false,
      cursor: 0,
      status: "beginning",
      startedAt: globalThis.performance?.now?.() ?? Date.now(),
    };
    this.#records.set(token, record);
    this.#activeRecord = record;

    const beginContext = this.#lifecycleContext(record, "begin");
    this.#diagnostic("begin", beginContext);
    try {
      this.#throwIfCancelled(record, -1);
      if (this.#captureState) {
        record.snapshot = await this.#captureState(states, beginContext);
        record.snapshotCaptured = true;
      }
      await this.#onBegin?.(beginContext);
      this.#throwIfCancelled(record, -1);
      this.#poseCoordinator.sampleAuthoredPose(plan.fromTimeSeconds, 0, {
        ...normalized.metadata,
        source: "legacy-offline-preroll",
        offlinePreroll: true,
        initialPrerollPose: true,
        cameraSampled: false,
        outputFrame: false,
      });
      await this.#preparePhysics(states, {
        evaluatePose: false,
        evaluationTime: plan.fromTimeSeconds,
        offlinePreroll: true,
      });
      this.#throwIfCancelled(record, -1);
      record.status = "running";
      return token;
    } catch (error) {
      await this.#rollbackRecord(record, error);
      throw error;
    }
  }

  /** Accepts either the planned step or OfflineFrameCoordinator's callback context. */
  async step(token, callbackContext = null) {
    const record = this.#requireRecord(token, ["running"]);
    const planned = record.token.plan.steps[record.cursor];
    if (!planned) throw new Error("Legacy offline preroll has no remaining steps");
    this.#validateCallbackStep(planned, callbackContext);
    this.#throwIfCancelled(record, planned.stepIndex);
    const context = Object.freeze({
      phase: "warmup",
      ...planned,
      warmupFromTimeSeconds: record.token.plan.fromTimeSeconds,
      outputStartTimeSeconds: record.token.plan.toTimeSeconds,
      signal: record.options.signal,
      metadata: record.options.metadata,
      cameraSampled: false,
      outputFrame: false,
    });

    const evaluation = this.#poseCoordinator.evaluateFrame({
      timeSeconds: planned.timeSeconds,
      deltaSeconds: planned.deltaSeconds,
      physicsTimeline: record.token.physicsTimeline,
      metadata: {
        ...record.options.metadata,
        source: "legacy-offline-preroll",
        offlinePreroll: true,
        prerollStepIndex: planned.stepIndex,
        prerollStepCount: planned.stepCount,
        previousTimeSeconds: planned.previousTimeSeconds,
        isFinalPrerollStep: planned.isFinalStep,
        cameraSampled: false,
        outputFrame: false,
      },
    });
    await this.#onStep?.(context, evaluation);
    record.cursor++;
    this.#diagnostic("step", {
      ...context,
      completedSteps: record.cursor,
      physicsTimeSeconds: record.token.physicsTimeline.time,
    });
    this.#notifyProgress(record, context);
    this.#throwIfCancelled(record, planned.stepIndex);
    return evaluation;
  }

  async end(token) {
    const record = this.#requireRecord(token, ["running"]);
    if (record.cursor !== record.token.plan.steps.length) {
      throw new Error(`Cannot end preroll: ${record.token.plan.steps.length - record.cursor} step(s) remain`);
    }
    this.#throwIfCancelled(record, record.cursor - 1);
    const context = this.#lifecycleContext(record, "end");
    await this.#onEnd?.(context);
    record.status = "completed";
    this.#activeRecord = null;
    const diagnostics = this.#resultDiagnostics(record, "completed");
    this.#diagnostic("end", diagnostics);
    return Object.freeze({ physicsTimeline: record.token.physicsTimeline, diagnostics });
  }

  async rollback(token, cause = new Error("Legacy offline preroll rolled back")) {
    const record = this.#requireRecord(token, ["beginning", "running"]);
    return this.#rollbackRecord(record, cause);
  }

  /** Convenience lifecycle used by the current manual production export loop. */
  async run(options = {}) {
    let token;
    try {
      token = await this.begin(options);
      for (const planned of token.plan.steps) {
        await this.step(token, planned);
        const record = this.#records.get(token);
        if ((planned.stepIndex + 1) % record.options.yieldEverySteps === 0 && !planned.isFinalStep) {
          await this.#yieldControl();
          this.#throwIfCancelled(record, planned.stepIndex);
        }
      }
      return await this.end(token);
    } catch (error) {
      const record = token ? this.#records.get(token) : null;
      if (record && (record.status === "beginning" || record.status === "running")) {
        await this.#rollbackRecord(record, error);
      }
      throw error;
    }
  }

  #normalizeOptions(options) {
    const outputStartTimeSeconds = finiteNonNegative(options.outputStartTimeSeconds, "outputStartTimeSeconds");
    const fps = positiveFinite(options.fps ?? 30, "fps");
    const mode = normalizeMode(options.mode);
    const windowSeconds = positiveFinite(
      options.windowSeconds ?? DEFAULT_LEGACY_PREROLL_WINDOW_SECONDS,
      "windowSeconds",
    );
    if (options.fixedStepSeconds !== undefined && options.fixedStepHz !== undefined) {
      throw new TypeError("Use fixedStepSeconds or fixedStepHz, not both");
    }
    const fixedStepSeconds = options.fixedStepSeconds !== undefined
      ? positiveFinite(options.fixedStepSeconds, "fixedStepSeconds")
      : 1 / positiveFinite(options.fixedStepHz ?? DEFAULT_LEGACY_PREROLL_STEP_HZ, "fixedStepHz");
    const yieldEverySteps = Math.max(
      1,
      Math.floor(positiveFinite(options.yieldEverySteps ?? 32, "yieldEverySteps")),
    );
    return Object.freeze({
      outputStartTimeSeconds,
      fps,
      mode,
      windowSeconds,
      fixedStepSeconds,
      maxWarmupSteps: options.maxWarmupSteps ?? 1_000_000,
      yieldEverySteps,
      signal: options.signal,
      isCancelled: optionalFunction(options.isCancelled, "isCancelled"),
      onProgress: optionalFunction(options.onProgress, "onProgress"),
      metadata: Object.freeze({ ...(options.metadata ?? {}) }),
    });
  }

  #createPlan(options) {
    const warmupFrom = options.mode === LEGACY_PREROLL_MODES.DISABLED
      ? options.outputStartTimeSeconds
      : options.mode === LEGACY_PREROLL_MODES.FULL
        ? 0
        : { windowSeconds: options.windowSeconds };
    const outputPlan = Object.freeze([Object.freeze({
      sequenceIndex: 0,
      frameIndex: 0,
      timeSeconds: options.outputStartTimeSeconds,
      fps: options.fps,
    })]);
    return createDeterministicWarmupPlan({
      fps: options.fps,
      startFrame: 0,
      frameCount: 1,
      startTimeSeconds: options.outputStartTimeSeconds,
      warmupFrom,
      warmupFixedStepSeconds: options.fixedStepSeconds,
      maxWarmupSteps: options.maxWarmupSteps,
    }, outputPlan);
  }

  #requireRecord(token, statuses) {
    const record = token && this.#records.get(token);
    if (!record) throw new TypeError("Unknown legacy offline preroll token");
    if (!statuses.includes(record.status)) throw new Error(`Legacy offline preroll token is ${record.status}`);
    if (record !== this.#activeRecord) throw new Error("Legacy offline preroll token is not active");
    return record;
  }

  #validateCallbackStep(planned, supplied) {
    if (!supplied) return;
    if (Number(supplied.stepIndex) !== planned.stepIndex
      || !sameTime(supplied.previousTimeSeconds, planned.previousTimeSeconds)
      || !sameTime(supplied.timeSeconds, planned.timeSeconds)
      || !sameTime(supplied.deltaSeconds, planned.deltaSeconds)) {
      throw new RangeError("OfflineFrameCoordinator warmup callback does not match the active preroll plan");
    }
  }

  #throwIfCancelled(record, stepIndex) {
    throwIfAborted(record.options.signal, {
      stage: "legacy-offline-preroll",
      stepIndex,
      outputStartTimeSeconds: record.options.outputStartTimeSeconds,
    });
    if (record.options.isCancelled?.()) {
      throw new RenderCancelledError("Offline render cancelled during physics preroll", {
        details: { stepIndex, outputStartTimeSeconds: record.options.outputStartTimeSeconds },
      });
    }
  }

  #notifyProgress(record, context) {
    if (!record.options.onProgress) return;
    try {
      record.options.onProgress(Object.freeze({
        phase: "warmup",
        completed: context.stepIndex + 1,
        total: context.stepCount,
        timeSeconds: context.timeSeconds,
        outputStartTimeSeconds: context.outputStartTimeSeconds,
      }));
    } catch (error) {
      this.#diagnostic("progress-callback-failed", {
        stepIndex: context.stepIndex,
        message: error?.message || String(error),
      });
    }
  }

  #lifecycleContext(record, phase) {
    return Object.freeze({
      phase,
      id: record.token.id,
      mode: record.options.mode,
      states: record.states,
      fromTimeSeconds: record.token.plan.fromTimeSeconds,
      toTimeSeconds: record.token.plan.toTimeSeconds,
      durationSeconds: record.token.plan.durationSeconds,
      fixedStepSeconds: record.token.plan.fixedStepSeconds,
      stepCount: record.token.plan.steps.length,
      completedSteps: record.cursor,
      signal: record.options.signal,
      metadata: record.options.metadata,
      physicsTimeline: record.token.physicsTimeline,
      cameraSamples: 0,
      outputFramesEmitted: 0,
    });
  }

  #resultDiagnostics(record, status, cause = null) {
    return Object.freeze({
      status,
      mode: record.options.mode,
      fromTimeSeconds: record.token.plan.fromTimeSeconds,
      toTimeSeconds: record.token.plan.toTimeSeconds,
      durationSeconds: record.token.plan.durationSeconds,
      fixedStepSeconds: record.token.plan.fixedStepSeconds,
      stepCount: record.token.plan.steps.length,
      completedSteps: record.cursor,
      physicsTimeSeconds: record.token.physicsTimeline.time,
      cameraSamples: 0,
      outputFramesEmitted: 0,
      cancelled: cause ? isRenderCancelled(cause) : false,
      elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - record.startedAt,
    });
  }

  async #rollbackRecord(record, cause) {
    if (record.status === "rolled-back") return this.#resultDiagnostics(record, "rolled-back", cause);
    const context = Object.freeze({
      ...this.#lifecycleContext(record, "rollback"),
      cause,
      cancelled: isRenderCancelled(cause),
    });
    let rollbackError = null;
    try {
      if (this.#restoreState && record.snapshotCaptured) {
        await this.#restoreState(record.snapshot, record.states, context);
      }
    } catch (error) {
      rollbackError = error;
    }
    try {
      await this.#onRollback?.(context);
    } catch (error) {
      if (!rollbackError) rollbackError = error;
      else rollbackError.hookError = error;
    }
    record.status = "rolled-back";
    if (this.#activeRecord === record) this.#activeRecord = null;
    const diagnostics = this.#resultDiagnostics(record, "rolled-back", cause);
    this.#diagnostic("rollback", { ...diagnostics, message: cause?.message || String(cause) });
    if (rollbackError) {
      try { cause.rollbackError = rollbackError; } catch (_) {}
    }
    return diagnostics;
  }

  #diagnostic(phase, details) {
    if (!this.#onDiagnostic) return;
    try { this.#onDiagnostic(Object.freeze({ ...details, phase })); }
    catch (_) {
      // Diagnostics cannot change deterministic simulation or cancellation.
    }
  }
}
