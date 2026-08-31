import { ensureDiagnosticCollector } from "../core/Diagnostics.js";
import { FrameContext } from "../core/FrameContext.js";

export const LIVE_POSE_STAGE_ORDER = Object.freeze([
  "animation",
  "manual-overlay",
  "performance",
  "scene-physics",
  "commit",
]);

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
  return value;
}

function optionalFunction(value, name, fallback = null) {
  if (value == null) return fallback;
  return requiredFunction(value, name);
}

function finiteNonNegative(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${name} must be a finite number greater than or equal to zero`);
  }
  return number;
}

function nonNegativeIndex(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return number;
}

function exactBoolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
  return value;
}

function assertSynchronous(value, label) {
  if (value != null && (typeof value === "object" || typeof value === "function") &&
      typeof value.then === "function") {
    // The transaction is already being rejected. Attach a rejection handler so
    // an accidental async adapter cannot also leak an unhandled rejection into
    // the host RAF loop after rollback has completed.
    try { Promise.resolve(value).catch(() => undefined); } catch { /* malformed thenable */ }
    throw new LegacyLivePoseAsyncStageError(label);
  }
  return value;
}

function normalizeThrown(value) {
  return value instanceof Error ? value : new Error(String(value));
}

export class LegacyLivePoseCoordinatorError extends Error {
  constructor(message, { code = "LEGACY_LIVE_POSE_ERROR", cause = undefined, details = null } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class LegacyLivePoseCoordinatorBusyError extends LegacyLivePoseCoordinatorError {
  constructor() {
    super("LegacyLivePoseCoordinator is already evaluating a frame", {
      code: "LEGACY_LIVE_POSE_REENTRANCY",
    });
  }
}

export class LegacyLivePoseAsyncStageError extends LegacyLivePoseCoordinatorError {
  constructor(stageId) {
    super(`Live RAF stage "${stageId}" returned a Promise; live pose stages must be synchronous`, {
      code: "LEGACY_LIVE_POSE_ASYNC_STAGE",
      details: { stageId },
    });
    this.stageId = stageId;
  }
}

export class LegacyLivePoseStageError extends LegacyLivePoseCoordinatorError {
  constructor(stageId, cause) {
    const error = normalizeThrown(cause);
    super(`Live RAF stage "${stageId}" failed: ${error.message}`, {
      code: "LEGACY_LIVE_POSE_STAGE_FAILED",
      cause: error,
      details: { stageId, causeCode: error.code ?? null },
    });
    this.stageId = stageId;
  }
}

/**
 * Synchronous migration bridge for the current requestAnimationFrame loop.
 * All pose writers observe one immutable FrameContext and one explicit order.
 */
export class LegacyLivePoseCoordinator {
  #handlers;
  #captureState;
  #restoreState;
  #evaluating = false;

  constructor({
    sampleAnimation,
    sampleManualOverlay = () => undefined,
    samplePerformance = () => undefined,
    stepScenePhysics,
    commitPose,
    captureState = null,
    restoreState = null,
    diagnostics = null,
  } = {}) {
    this.#handlers = Object.freeze({
      animation: requiredFunction(sampleAnimation, "sampleAnimation"),
      "manual-overlay": requiredFunction(sampleManualOverlay, "sampleManualOverlay"),
      performance: requiredFunction(samplePerformance, "samplePerformance"),
      "scene-physics": requiredFunction(stepScenePhysics, "stepScenePhysics"),
      commit: requiredFunction(commitPose, "commitPose"),
    });
    this.#captureState = optionalFunction(captureState, "captureState");
    this.#restoreState = optionalFunction(restoreState, "restoreState");
    if (Boolean(this.#captureState) !== Boolean(this.#restoreState)) {
      throw new TypeError("captureState and restoreState must be supplied together");
    }
    this.diagnostics = ensureDiagnosticCollector(diagnostics);
    Object.freeze(this);
  }

  get evaluating() { return this.#evaluating; }

  /** Build the exact immutable context that will be shared by all five stages. */
  createFrameContext({
    frameId,
    timeSeconds,
    deltaSeconds,
    transportPlaying,
    evaluationPlayback = transportPlaying,
    isDiscontinuity = false,
    physicsTime = timeSeconds,
    substep = 0,
    playbackRate = 1,
    seed = null,
    signal = null,
    metadata = {},
  } = {}) {
    if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new TypeError("metadata must be an object");
    }
    const exactMetadata = {
      ...metadata,
      transportPlaying: exactBoolean(transportPlaying, "transportPlaying"),
      evaluationPlayback: exactBoolean(evaluationPlayback, "evaluationPlayback"),
      isDiscontinuity: exactBoolean(isDiscontinuity, "isDiscontinuity"),
      physicsTime: finiteNonNegative(physicsTime, "physicsTime"),
      substep: nonNegativeIndex(substep, "substep"),
    };
    const exactFrameId = nonNegativeIndex(frameId, "frameId");
    return FrameContext.live({
      frameId: exactFrameId,
      time: finiteNonNegative(timeSeconds, "timeSeconds"),
      deltaSeconds: finiteNonNegative(deltaSeconds, "deltaSeconds"),
      playbackRate,
      seed: seed == null ? exactFrameId : seed,
      signal,
      metadata: exactMetadata,
    });
  }

  /** Evaluate one complete RAF pose transaction synchronously. */
  evaluateFrame(options = {}) {
    if (this.#evaluating) throw new LegacyLivePoseCoordinatorBusyError();
    const context = options instanceof FrameContext ? options : this.createFrameContext(options);
    if (!context.isLive) throw new TypeError("LegacyLivePoseCoordinator requires a live FrameContext");
    this.#validateExactMetadata(context.metadata);

    this.#evaluating = true;
    let rollbackSnapshot;
    let captured = false;
    const results = new Map();
    const stageRecords = [];
    const view = Object.freeze({
      get context() { return context; },
      hasResult(stageId) { return results.has(stageId); },
      getResult(stageId) { return results.get(stageId); },
      completedStages() { return Object.freeze(Array.from(results.keys())); },
    });

    this.diagnostics.emit({
      severity: "debug",
      code: "LIVE_POSE_FRAME_BEGIN",
      message: `Live pose frame ${context.frameId} started.`,
      frameId: context.frameId,
      details: { mode: context.mode, ...context.metadata },
    });

    try {
      if (context.aborted) throw new LegacyLivePoseCoordinatorError("Live pose frame was aborted", {
        code: "LEGACY_LIVE_POSE_ABORTED",
        details: { frameId: context.frameId },
      });
      if (this.#captureState) {
        rollbackSnapshot = assertSynchronous(this.#captureState(context), "capture-state");
        captured = true;
      }

      for (let index = 0; index < LIVE_POSE_STAGE_ORDER.length; index += 1) {
        const stageId = LIVE_POSE_STAGE_ORDER[index];
        if (context.aborted) throw new LegacyLivePoseCoordinatorError("Live pose frame was aborted", {
          code: "LEGACY_LIVE_POSE_ABORTED",
          details: { frameId: context.frameId, beforeStage: stageId },
        });
        const output = this.#runStage(stageId, index, context, view);
        results.set(stageId, output);
        stageRecords.push(Object.freeze({ id: stageId, order: index, status: "completed", output }));
      }

      const result = Object.freeze({
        ok: true,
        context,
        stages: Object.freeze(stageRecords),
        commitOutput: results.get("commit"),
      });
      this.diagnostics.emit({
        severity: "debug",
        code: "LIVE_POSE_FRAME_COMMITTED",
        message: `Live pose frame ${context.frameId} committed.`,
        frameId: context.frameId,
        details: { stageOrder: LIVE_POSE_STAGE_ORDER },
      });
      return result;
    } catch (thrown) {
      const error = normalizeThrown(thrown);
      let restored = false;
      if (captured) {
        try {
          assertSynchronous(this.#restoreState(rollbackSnapshot, context, error), "restore-state");
          restored = true;
        } catch (restoreThrown) {
          const restoreError = normalizeThrown(restoreThrown);
          try { Object.defineProperty(error, "restoreError", { value: restoreError, enumerable: false }); }
          catch { /* preserve the primary error even if it is non-extensible */ }
          this.diagnostics.emit({
            severity: "error",
            code: "LIVE_POSE_RESTORE_FAILED",
            message: `Live pose rollback failed: ${restoreError.message}`,
            frameId: context.frameId,
            details: { restoreCode: restoreError.code ?? null },
          });
        }
      }
      try {
        Object.defineProperty(error, "frame", {
          value: Object.freeze({ context, stages: Object.freeze(stageRecords.slice()), restored }),
          enumerable: false,
        });
      } catch { /* diagnostics still retain frame identity */ }
      this.diagnostics.emit({
        severity: "error",
        code: restored ? "LIVE_POSE_FRAME_ROLLED_BACK" : "LIVE_POSE_FRAME_FAILED",
        message: restored
          ? `Live pose frame ${context.frameId} failed and was rolled back.`
          : `Live pose frame ${context.frameId} failed without rollback.`,
        frameId: context.frameId,
        details: { errorCode: error.code ?? null, restored, completedStages: stageRecords.map(({ id }) => id) },
      });
      throw error;
    } finally {
      this.#evaluating = false;
    }
  }

  #runStage(stageId, order, context, view) {
    this.diagnostics.emit({
      severity: "debug",
      code: "LIVE_POSE_STAGE_BEGIN",
      message: `Live pose stage "${stageId}" started.`,
      stageId,
      frameId: context.frameId,
      details: { order, ...context.metadata },
    });
    try {
      const output = assertSynchronous(this.#handlers[stageId](context, view), stageId);
      this.diagnostics.emit({
        severity: "debug",
        code: "LIVE_POSE_STAGE_COMPLETED",
        message: `Live pose stage "${stageId}" completed.`,
        stageId,
        frameId: context.frameId,
        details: { order },
      });
      return output;
    } catch (cause) {
      const error = cause instanceof LegacyLivePoseStageError
        ? cause
        : new LegacyLivePoseStageError(stageId, cause);
      this.diagnostics.emit({
        severity: "error",
        code: "LIVE_POSE_STAGE_FAILED",
        message: error.message,
        stageId,
        frameId: context.frameId,
        details: { order, causeCode: error.cause?.code ?? null },
      });
      throw error;
    }
  }

  #validateExactMetadata(metadata) {
    exactBoolean(metadata.transportPlaying, "metadata.transportPlaying");
    exactBoolean(metadata.evaluationPlayback, "metadata.evaluationPlayback");
    exactBoolean(metadata.isDiscontinuity, "metadata.isDiscontinuity");
    finiteNonNegative(metadata.physicsTime, "metadata.physicsTime");
    nonNegativeIndex(metadata.substep, "metadata.substep");
  }
}
