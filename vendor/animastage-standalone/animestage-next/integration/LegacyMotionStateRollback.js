import { ensureDiagnosticCollector } from "../core/Diagnostics.js";

export const MOTION_STATE_ROLLBACK_STATES = Object.freeze({
  CAPTURED: "captured",
  RESTORING: "restoring",
  RESTORED: "restored",
  RESTORE_FAILED: "restore-failed",
});

const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key);

function normalizeThrown(value) {
  return value instanceof Error ? value : new Error(String(value));
}

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
  return value;
}

function optionalFunction(owner, name, fallback) {
  const value = owner?.[name];
  if (value == null) return fallback;
  return requiredFunction(value, name).bind(owner);
}

function isThenable(value) {
  return value != null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof value.then === "function";
}

function assertSynchronous(value, label) {
  if (!isThenable(value)) return value;
  try { Promise.resolve(value).catch(() => undefined); } catch { /* malformed thenable */ }
  throw new LegacyMotionStateAsyncCallbackError(label);
}

function toArray(value, label, { optional = false } = {}) {
  if (optional && value == null) return [];
  if (value == null || typeof value === "string" || typeof value[Symbol.iterator] !== "function") {
    throw new TypeError(`${label} must return an iterable`);
  }
  return Array.from(value);
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
}

function booleanValue(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean`);
  return value;
}

function validateTarget(value, label) {
  if (value == null || (typeof value !== "object" && typeof value !== "function")) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function captureOwnProperty(target, key) {
  return Object.freeze({ present: hasOwn(target, key), value: target[key] });
}

function restoreOwnProperty(target, key, snapshot) {
  if (!snapshot || typeof snapshot.present !== "boolean") {
    throw new TypeError(`${key} snapshot is malformed`);
  }
  if (snapshot.present) target[key] = snapshot.value;
  else delete target[key];
}

function defaultGetHelperObjects(character) {
  return character?.helperObjects ?? null;
}

function defaultGetMixer(character, helperObjects) {
  return character?.mixer ?? helperObjects?.mixer ?? character?.action?.getMixer?.() ?? null;
}

function defaultListActions() {
  return [];
}

function defaultGetAnimPlaying(character) {
  return !!character.animPlaying;
}

function defaultSetAnimPlaying(character, value) {
  character.animPlaying = value;
}

function defaultIsActionScheduled(action, mixer) {
  if (typeof action?.isScheduled === "function") return action.isScheduled();
  if (typeof mixer?._isActiveAction === "function") return mixer._isActiveAction(action);
  throw new TypeError("AnimationAction scheduling state is unavailable");
}

function defaultSetActionScheduled(action, mixer, scheduled) {
  const currentState = defaultIsActionScheduled(action, mixer);
  if (isThenable(currentState)) return currentState;
  const current = !!currentState;
  if (current === scheduled) return;
  if (scheduled) {
    if (typeof mixer?._activateAction === "function") mixer._activateAction(action);
    else if (typeof action?.play === "function") action.play();
    else throw new TypeError("AnimationAction cannot be activated");
  } else if (typeof mixer?._deactivateAction === "function") {
    mixer._deactivateAction(action);
  } else if (typeof action?.stop === "function") {
    action.stop();
  } else {
    throw new TypeError("AnimationAction cannot be deactivated");
  }
}

function cloneBackupValues(value, label) {
  if (Array.isArray(value)) return value.slice();
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    try { return new value.constructor(value); }
    catch (cause) { throw new TypeError(`${label} could not be copied`, { cause }); }
  }
  throw new TypeError(`${label} must be an array or typed array when defined`);
}

function captureHelperBackup(helperObjects, label) {
  if (helperObjects == null) return null;
  validateTarget(helperObjects, label);
  const own = hasOwn(helperObjects, "backupBones");
  const reference = helperObjects.backupBones;
  if (reference === undefined) {
    return Object.freeze({ helperObjects, own, kind: "undefined" });
  }
  return Object.freeze({
    helperObjects,
    own,
    kind: "values",
    reference,
    values: cloneBackupValues(reference, `${label}.backupBones`),
  });
}

function restoreHelperBackup(snapshot) {
  if (snapshot == null) return;
  const { helperObjects, own, kind } = snapshot;
  validateTarget(helperObjects, "helperObjects");
  if (kind === "undefined") {
    if (own) helperObjects.backupBones = undefined;
    else delete helperObjects.backupBones;
    return;
  }
  if (kind !== "values") throw new TypeError("helper backup snapshot is malformed");

  const { reference, values } = snapshot;
  if (Array.isArray(reference)) {
    reference.length = values.length;
    for (let index = 0; index < values.length; index += 1) reference[index] = values[index];
  } else if (ArrayBuffer.isView(reference) && !(reference instanceof DataView)) {
    if (reference.length !== values.length) {
      throw new RangeError("helper backup length changed since capture");
    }
    reference.set(values);
  } else {
    throw new TypeError("captured helper backup is no longer writable");
  }

  if (own) helperObjects.backupBones = reference;
  else {
    delete helperObjects.backupBones;
    if (helperObjects.backupBones !== reference) {
      throw new TypeError("inherited helper backup changed since capture");
    }
  }
}

function attachFailure(failures, targetIndex, component, task) {
  try { task(); }
  catch (error) {
    failures.push(Object.freeze({
      targetIndex,
      component,
      error: normalizeThrown(error),
    }));
  }
}

export class LegacyMotionStateRollbackError extends Error {
  constructor(message, { code = "LEGACY_MOTION_STATE_ROLLBACK_ERROR", cause, details = null } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class LegacyMotionStateAsyncCallbackError extends LegacyMotionStateRollbackError {
  constructor(callbackName) {
    super(`Motion-state callback "${callbackName}" returned a Promise; rollback is synchronous`, {
      code: "LEGACY_MOTION_STATE_ASYNC_CALLBACK",
      details: { callbackName },
    });
    this.callbackName = callbackName;
  }
}

export class LegacyMotionStateSnapshotError extends LegacyMotionStateRollbackError {
  constructor(message = "Motion-state snapshot is invalid or belongs to another rollback seam") {
    super(message, { code: "LEGACY_MOTION_STATE_INVALID_SNAPSHOT" });
  }
}

export class LegacyMotionStateCaptureError extends LegacyMotionStateRollbackError {
  constructor(component, targetIndex, cause) {
    const error = normalizeThrown(cause);
    const location = targetIndex == null ? component : `target[${targetIndex}].${component}`;
    super(`Motion-state capture failed at ${location}: ${error.message}`, {
      code: "LEGACY_MOTION_STATE_CAPTURE_FAILED",
      cause: error,
      details: { component, targetIndex },
    });
    this.component = component;
    this.targetIndex = targetIndex;
  }
}

export class LegacyMotionStateRestoreError extends LegacyMotionStateRollbackError {
  constructor(failures) {
    const normalized = Object.freeze(failures.map((failure) => Object.freeze({
      targetIndex: failure.targetIndex,
      component: failure.component,
      error: normalizeThrown(failure.error),
    })));
    const cause = normalized.length === 1
      ? normalized[0].error
      : new AggregateError(normalized.map(({ error }) => error), "Multiple motion states failed to restore");
    super(`Motion-state restoration failed in ${normalized.length} operation(s)`, {
      code: "LEGACY_MOTION_STATE_RESTORE_FAILED",
      cause,
      details: {
        failures: normalized.map(({ targetIndex, component }) => ({ targetIndex, component })),
      },
    });
    this.failures = normalized;
  }
}

/**
 * Synchronous, one-shot rollback for hidden Three/MMD animation state.
 *
 * The returned token contains no state. Mixer/action/helper references and
 * backup arrays remain private in a WeakMap. The class itself is also a valid
 * LegacyLiveFrameRollback adapter (`captureState` / `restoreState`).
 */
export class LegacyMotionStateRollback {
  #configuration;
  #records = new WeakMap();
  #sequence = 0;

  constructor(configuration = {}) {
    if (!configuration || typeof configuration !== "object") {
      throw new TypeError("LegacyMotionStateRollback expects a configuration object");
    }
    const listCharacters = requiredFunction(configuration.listCharacters, "listCharacters")
      .bind(configuration);
    this.#configuration = Object.freeze({
      listCharacters,
      getHelperObjects: optionalFunction(configuration, "getHelperObjects", defaultGetHelperObjects),
      getMixer: optionalFunction(configuration, "getMixer", defaultGetMixer),
      listActions: optionalFunction(configuration, "listActions", defaultListActions),
      getAnimPlaying: optionalFunction(configuration, "getAnimPlaying", defaultGetAnimPlaying),
      setAnimPlaying: optionalFunction(configuration, "setAnimPlaying", defaultSetAnimPlaying),
      isActionScheduled: optionalFunction(configuration, "isActionScheduled", defaultIsActionScheduled),
      setActionScheduled: optionalFunction(configuration, "setActionScheduled", defaultSetActionScheduled),
      afterRestore: optionalFunction(configuration, "afterRestore", () => undefined),
    });
    this.id = String(configuration.id ?? "motion-helper-state");
    this.label = String(configuration.label ?? "legacy-motion-state");
    this.diagnostics = ensureDiagnosticCollector(configuration.diagnostics);
    this.coordinatorCallbacks = Object.freeze({
      captureState: (context) => this.captureState(context),
      restoreState: (snapshot, context, cause) => this.restoreState(snapshot, context, cause),
    });
    Object.freeze(this);
  }

  captureState(context = null) {
    let characters;
    try {
      characters = toArray(
        assertSynchronous(this.#configuration.listCharacters(context), "listCharacters"),
        "listCharacters",
      );
    } catch (cause) {
      throw this.#captureFailure("listCharacters", null, cause, context);
    }

    const uniqueCharacters = [];
    const seenCharacters = new Set();
    for (const character of characters) {
      if (seenCharacters.has(character)) continue;
      seenCharacters.add(character);
      uniqueCharacters.push(character);
    }

    const targets = [];
    for (let targetIndex = 0; targetIndex < uniqueCharacters.length; targetIndex += 1) {
      const character = uniqueCharacters[targetIndex];
      try {
        validateTarget(character, `target[${targetIndex}]`);
        const helperObjects = assertSynchronous(
          this.#configuration.getHelperObjects(character, context),
          "getHelperObjects",
        );
        const mixer = assertSynchronous(
          this.#configuration.getMixer(character, helperObjects, context),
          "getMixer",
        );
        if (mixer != null) validateTarget(mixer, `target[${targetIndex}].mixer`);

        const extraActions = toArray(
          assertSynchronous(
            this.#configuration.listActions(character, mixer, helperObjects, context),
            "listActions",
          ),
          "listActions",
          { optional: true },
        );
        const mixerActions = toArray(mixer?._actions, "mixer._actions", { optional: true });
        const actions = [...new Set([...mixerActions, ...extraActions])];
        const actionStates = actions.map((action, actionIndex) => {
          validateTarget(action, `target[${targetIndex}].action[${actionIndex}]`);
          const scheduled = assertSynchronous(
            this.#configuration.isActionScheduled(action, mixer, character, context),
            "isActionScheduled",
          );
          if (typeof scheduled !== "boolean") {
            throw new TypeError(`target[${targetIndex}].action[${actionIndex}] scheduled state must be boolean`);
          }
          return Object.freeze({
            action,
            time: finiteNumber(action.time, `target[${targetIndex}].action[${actionIndex}].time`),
            paused: booleanValue(action.paused, `target[${targetIndex}].action[${actionIndex}].paused`),
            enabled: booleanValue(action.enabled, `target[${targetIndex}].action[${actionIndex}].enabled`),
            loopCount: captureOwnProperty(action, "_loopCount"),
            startTime: captureOwnProperty(action, "_startTime"),
            scheduled,
          });
        });

        targets.push(Object.freeze({
          character,
          mixer,
          mixerTime: mixer == null
            ? null
            : finiteNumber(mixer.time, `target[${targetIndex}].mixer.time`),
          actions: Object.freeze(actionStates),
          helperBackup: captureHelperBackup(helperObjects, `target[${targetIndex}].helperObjects`),
          animPlaying: booleanValue(
            assertSynchronous(
              this.#configuration.getAnimPlaying(character, context),
              "getAnimPlaying",
            ),
            `target[${targetIndex}].animPlaying`,
          ),
        }));
      } catch (cause) {
        throw this.#captureFailure("target", targetIndex, cause, context);
      }
    }

    const sequence = this.#sequence++;
    const token = Object.freeze(Object.create(null));
    const actionCount = targets.reduce((sum, target) => sum + target.actions.length, 0);
    this.#records.set(token, {
      state: MOTION_STATE_ROLLBACK_STATES.CAPTURED,
      sequence,
      targets: Object.freeze(targets),
      actionCount,
      settlement: null,
      failure: null,
    });
    this.diagnostics.emit({
      severity: "debug",
      code: "MOTION_STATE_CAPTURED",
      message: `Captured hidden motion state for ${targets.length} character(s).`,
      frameId: context?.frameId ?? null,
      details: { sequence, targetCount: targets.length, actionCount },
    });
    return token;
  }

  restoreState(token, context = null, cause = null) {
    if (!token || (typeof token !== "object" && typeof token !== "function")) {
      throw new LegacyMotionStateSnapshotError();
    }
    const record = this.#records.get(token);
    if (!record) throw new LegacyMotionStateSnapshotError();
    if (record.state === MOTION_STATE_ROLLBACK_STATES.RESTORING) {
      throw new LegacyMotionStateSnapshotError("Motion-state snapshot is already being restored");
    }
    if (record.state === MOTION_STATE_ROLLBACK_STATES.RESTORED) return record.settlement;
    if (record.state === MOTION_STATE_ROLLBACK_STATES.RESTORE_FAILED) throw record.failure;

    record.state = MOTION_STATE_ROLLBACK_STATES.RESTORING;
    const failures = [];
    for (let targetIndex = record.targets.length - 1; targetIndex >= 0; targetIndex -= 1) {
      const target = record.targets[targetIndex];

      attachFailure(failures, targetIndex, "helper.backupBones", () => {
        restoreHelperBackup(target.helperBackup);
      });
      if (target.mixer) {
        attachFailure(failures, targetIndex, "mixer.time", () => {
          target.mixer.time = target.mixerTime;
        });
      }

      for (let actionIndex = target.actions.length - 1; actionIndex >= 0; actionIndex -= 1) {
        const saved = target.actions[actionIndex];
        const prefix = `action[${actionIndex}]`;
        attachFailure(failures, targetIndex, `${prefix}.scheduled`, () => {
          assertSynchronous(
            this.#configuration.setActionScheduled(
              saved.action,
              target.mixer,
              saved.scheduled,
              target.character,
              context,
            ),
            "setActionScheduled",
          );
        });
        attachFailure(failures, targetIndex, `${prefix}._startTime`, () => {
          restoreOwnProperty(saved.action, "_startTime", saved.startTime);
        });
        attachFailure(failures, targetIndex, `${prefix}._loopCount`, () => {
          restoreOwnProperty(saved.action, "_loopCount", saved.loopCount);
        });
        attachFailure(failures, targetIndex, `${prefix}.time`, () => {
          saved.action.time = saved.time;
        });
        attachFailure(failures, targetIndex, `${prefix}.paused`, () => {
          saved.action.paused = saved.paused;
        });
        attachFailure(failures, targetIndex, `${prefix}.enabled`, () => {
          saved.action.enabled = saved.enabled;
        });
      }

      attachFailure(failures, targetIndex, "character.animPlaying", () => {
        assertSynchronous(
          this.#configuration.setAnimPlaying(target.character, target.animPlaying, context),
          "setAnimPlaying",
        );
      });
      attachFailure(failures, targetIndex, "afterRestore", () => {
        assertSynchronous(
          this.#configuration.afterRestore(target.character, context, cause),
          "afterRestore",
        );
      });
    }

    if (failures.length > 0) {
      const failure = new LegacyMotionStateRestoreError(failures);
      record.state = MOTION_STATE_ROLLBACK_STATES.RESTORE_FAILED;
      record.failure = failure;
      this.diagnostics.emit({
        severity: "error",
        code: failure.code,
        message: failure.message,
        frameId: context?.frameId ?? null,
        details: { sequence: record.sequence, failures: failure.details.failures },
      });
      throw failure;
    }

    const settlement = Object.freeze({
      status: MOTION_STATE_ROLLBACK_STATES.RESTORED,
      sequence: record.sequence,
      targetCount: record.targets.length,
      actionCount: record.actionCount,
    });
    record.state = MOTION_STATE_ROLLBACK_STATES.RESTORED;
    record.settlement = settlement;
    this.diagnostics.emit({
      severity: "info",
      code: "MOTION_STATE_RESTORED",
      message: `Restored hidden motion state for ${record.targets.length} character(s).`,
      frameId: context?.frameId ?? null,
      details: { sequence: record.sequence, causeCode: cause?.code ?? null },
    });
    return settlement;
  }

  #captureFailure(component, targetIndex, cause, context) {
    const error = cause instanceof LegacyMotionStateCaptureError
      ? cause
      : new LegacyMotionStateCaptureError(component, targetIndex, cause);
    this.diagnostics.emit({
      severity: "error",
      code: error.code,
      message: error.message,
      frameId: context?.frameId ?? null,
      details: { component: error.component, targetIndex: error.targetIndex },
    });
    return error;
  }
}

export function createLegacyMotionStateRollbackAdapter(configuration) {
  return new LegacyMotionStateRollback(configuration);
}
