/** Base error for the deterministic character-frame core. */
export class FrameCoreError extends Error {
  constructor(message, { code = "FRAME_CORE_ERROR", details = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

/** Thrown when a context, schema, mask, or pose value is invalid. */
export class FrameValidationError extends FrameCoreError {
  constructor(message, details = null) {
    super(message, { code: "FRAME_VALIDATION_ERROR", details });
  }
}

/** Thrown before evaluation when two stages claim an incompatible pose slot. */
export class PoseOwnershipConflictError extends FrameCoreError {
  constructor(conflicts) {
    const count = Array.isArray(conflicts) ? conflicts.length : 0;
    super(`Pose ownership contains ${count} incompatible claim${count === 1 ? "" : "s"}.`, {
      code: "POSE_OWNERSHIP_CONFLICT",
      details: { conflicts: Array.isArray(conflicts) ? conflicts : [] },
    });
    this.conflicts = Array.isArray(conflicts) ? conflicts : [];
  }
}

/** Thrown when a stage writes outside its declared pose mask. */
export class UnauthorizedPoseWriteError extends FrameCoreError {
  constructor(stageId, slot) {
    super(`Stage "${stageId}" attempted an undeclared write to "${slot}".`, {
      code: "UNAUTHORIZED_POSE_WRITE",
      details: { stageId, slot },
    });
    this.stageId = stageId;
    this.slot = slot;
  }
}

/** Wraps a stage failure after its pose transaction has been rolled back. */
export class PoseStageExecutionError extends FrameCoreError {
  constructor(stageId, cause, details = null) {
    super(`Pose stage "${stageId}" failed and was rolled back: ${cause?.message ?? cause}`, {
      code: "POSE_STAGE_EXECUTION_FAILED",
      details: { stageId, ...details },
      cause,
    });
    this.stageId = stageId;
  }
}

/** Thrown when the same evaluator is entered concurrently. */
export class EvaluatorBusyError extends FrameCoreError {
  constructor(characterId) {
    super(`Character evaluator "${characterId}" is already evaluating a frame.`, {
      code: "EVALUATOR_BUSY",
      details: { characterId },
    });
  }
}

/** Thrown when the supplied cancellation signal aborts frame evaluation. */
export class FrameEvaluationAbortedError extends FrameCoreError {
  constructor(frameId) {
    super(`Frame ${frameId} evaluation was aborted.`, {
      code: "FRAME_EVALUATION_ABORTED",
      details: { frameId },
    });
  }
}
