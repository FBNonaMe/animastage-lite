import { ensureDiagnosticCollector } from "../core/Diagnostics.js";

export const LIVE_FRAME_ROLLBACK_STATES = Object.freeze({
  CAPTURED: "captured",
  RESTORING: "restoring",
  RESTORED: "restored",
  RESTORE_FAILED: "restore-failed",
});

const SNAPSHOT_KIND = "animestage-next/live-frame-rollback";
const SNAPSHOT_VERSION = 1;
const DEFAULT_TRANSFORM_FIELDS = Object.freeze(["position", "quaternion", "scale"]);
const DEFAULT_CAMERA_TRANSFORM_FIELDS = Object.freeze([
  "position",
  "quaternion",
  "scale",
  "up",
]);
const DEFAULT_CAMERA_SCALAR_FIELDS = Object.freeze([
  "fov",
  "zoom",
  "near",
  "far",
  "aspect",
  "filmGauge",
  "filmOffset",
]);

function normalizeThrown(value) {
  return value instanceof Error ? value : new Error(String(value));
}

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
  return value;
}

function optionalFunction(value, name, fallback) {
  if (value == null) return fallback;
  return requiredFunction(value, name);
}

function isThenable(value) {
  return value != null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof value.then === "function";
}

function assertSynchronous(value, label) {
  if (!isThenable(value)) return value;
  try { Promise.resolve(value).catch(() => undefined); } catch { /* malformed thenable */ }
  throw new LegacyLiveFrameAsyncAdapterError(label);
}

function toArray(value, label) {
  if (value == null || typeof value[Symbol.iterator] !== "function" || typeof value === "string") {
    throw new TypeError(`${label} must return an iterable`);
  }
  return Array.from(value);
}

function finiteTuple(value, label) {
  let tuple;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    tuple = Array.from(value);
  } else if (value && typeof value.toArray === "function") {
    tuple = value.toArray([]);
  } else if (value && typeof value === "object") {
    tuple = [value.x, value.y];
    if ("z" in value) tuple.push(value.z);
    if ("w" in value) tuple.push(value.w);
  } else {
    throw new TypeError(`${label} must be an array-like vector or expose toArray()`);
  }
  if (tuple.length < 2 || tuple.some((component) => !Number.isFinite(Number(component)))) {
    throw new TypeError(`${label} must contain only finite numeric components`);
  }
  return Object.freeze(tuple.map(Number));
}

function writeTuple(target, tuple, label) {
  if (target == null) throw new TypeError(`${label} is no longer available`);
  if (typeof target.fromArray === "function") {
    target.fromArray(tuple);
    return;
  }
  if (typeof target.set === "function") {
    target.set(...tuple);
    return;
  }
  if (Array.isArray(target) || ArrayBuffer.isView(target)) {
    if (target.length !== tuple.length) {
      throw new RangeError(`${label} component count changed since capture`);
    }
    for (let index = 0; index < tuple.length; index += 1) target[index] = tuple[index];
    return;
  }
  if (typeof target === "object") {
    const keys = ["x", "y", "z", "w"];
    for (let index = 0; index < tuple.length; index += 1) {
      if (!(keys[index] in target)) {
        throw new TypeError(`${label} cannot restore component ${keys[index]}`);
      }
      target[keys[index]] = tuple[index];
    }
    return;
  }
  throw new TypeError(`${label} is not a writable vector`);
}

function captureGenericTransform(target, fields, label) {
  if (!target || typeof target !== "object") throw new TypeError(`${label} must be an object`);
  const values = [];
  for (const field of fields) {
    if (!(field in target) || target[field] == null) {
      throw new TypeError(`${label}.${field} is required`);
    }
    values.push(Object.freeze({ field, tuple: finiteTuple(target[field], `${label}.${field}`) }));
  }
  return Object.freeze(values);
}

function restoreGenericTransform(target, snapshot, label) {
  if (!Array.isArray(snapshot)) throw new TypeError(`${label} transform snapshot is malformed`);
  for (const entry of snapshot) {
    if (!entry || typeof entry.field !== "string" || !Array.isArray(entry.tuple)) {
      throw new TypeError(`${label} transform snapshot is malformed`);
    }
    writeTuple(target?.[entry.field], entry.tuple, `${label}.${entry.field}`);
  }
}

function readDefaultInfluences(target, label) {
  const influences = target?.morphTargetInfluences;
  if (!Array.isArray(influences) && !ArrayBuffer.isView(influences)) {
    throw new TypeError(`${label}.morphTargetInfluences must be an array or typed array`);
  }
  const values = Array.from(influences, Number);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`${label}.morphTargetInfluences contains a non-finite value`);
  }
  return Object.freeze(values);
}

function writeDefaultInfluences(target, values, label) {
  const influences = target?.morphTargetInfluences;
  if ((!Array.isArray(influences) && !ArrayBuffer.isView(influences)) ||
      influences.length !== values.length) {
    throw new RangeError(`${label}.morphTargetInfluences length changed since capture`);
  }
  for (let index = 0; index < values.length; index += 1) influences[index] = values[index];
}

function defaultBones(character) {
  return character?.bones ?? character?.mesh?.skeleton?.bones ?? [];
}

function defaultMorphTargets(character) {
  if (character?.morphTargets != null) return character.morphTargets;
  if (character?.mesh?.morphTargetInfluences != null) return [character.mesh];
  if (character?.morphTargetInfluences != null) return [character];
  return [];
}

function defaultMeshes(character) {
  if (character?.meshes != null) return character.meshes;
  if (character?.mesh != null) return [character.mesh];
  return [];
}

function normalizeAdapters(configuration) {
  if (Array.isArray(configuration)) return configuration;
  if (configuration && typeof configuration === "object" &&
      ("captureState" in configuration || "restoreState" in configuration)) {
    return [configuration];
  }
  if (configuration && typeof configuration === "object") {
    if (configuration.adapters == null) return [];
    return Array.isArray(configuration.adapters)
      ? configuration.adapters
      : [configuration.adapters];
  }
  if (configuration == null) return [];
  throw new TypeError("LegacyLiveFrameRollback expects an adapter array or configuration object");
}

function validateAdapter(adapter, index) {
  if (!adapter || typeof adapter !== "object") {
    throw new TypeError(`Live-frame rollback adapter ${index} must be an object`);
  }
  return Object.freeze({
    id: String(adapter.id ?? adapter.name ?? `live-state-${index}`),
    captureState: requiredFunction(adapter.captureState, `adapter ${index}.captureState`).bind(adapter),
    restoreState: requiredFunction(adapter.restoreState, `adapter ${index}.restoreState`).bind(adapter),
  });
}

function freezeEntry(target, state) {
  return Object.freeze({ target, state });
}

function restoreEvery(tasks, label) {
  const failures = [];
  for (const task of tasks) {
    try { task(); } catch (error) { failures.push(normalizeThrown(error)); }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, `${label} restoration failed`);
}

export class LegacyLiveFrameRollbackError extends Error {
  constructor(message, { code = "LEGACY_LIVE_FRAME_ROLLBACK_ERROR", cause, details = null } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class LegacyLiveFrameAsyncAdapterError extends LegacyLiveFrameRollbackError {
  constructor(adapterId) {
    super(`Live-frame rollback adapter "${adapterId}" returned a Promise; capture and restore must be synchronous`, {
      code: "LEGACY_LIVE_FRAME_ASYNC_ADAPTER",
      details: { adapterId },
    });
    this.adapterId = adapterId;
  }
}

export class LegacyLiveFrameSnapshotError extends LegacyLiveFrameRollbackError {
  constructor(message = "Live-frame rollback snapshot is invalid or belongs to another rollback seam") {
    super(message, { code: "LEGACY_LIVE_FRAME_INVALID_SNAPSHOT" });
  }
}

export class LegacyLiveFrameCaptureError extends LegacyLiveFrameRollbackError {
  constructor(adapterId, cause) {
    const error = normalizeThrown(cause);
    super(`Live-frame state capture failed in adapter "${adapterId}": ${error.message}`, {
      code: "LEGACY_LIVE_FRAME_CAPTURE_FAILED",
      cause: error,
      details: { adapterId },
    });
    this.adapterId = adapterId;
  }
}

export class LegacyLiveFrameRestoreError extends LegacyLiveFrameRollbackError {
  constructor(failures) {
    const normalized = failures.map(({ adapterId, error }) => Object.freeze({
      adapterId,
      error: normalizeThrown(error),
    }));
    const cause = normalized.length === 1
      ? normalized[0].error
      : new AggregateError(normalized.map(({ error }) => error), "Multiple live-frame adapters failed to restore");
    super(`Live-frame restoration failed in ${normalized.length} adapter(s)`, {
      code: "LEGACY_LIVE_FRAME_RESTORE_FAILED",
      cause,
      details: { adapterIds: normalized.map(({ adapterId }) => adapterId) },
    });
    this.failures = Object.freeze(normalized);
  }
}

/**
 * One-shot synchronous rollback seam compatible with LegacyLivePoseCoordinator.
 * Adapter payloads and object references remain private behind an opaque token.
 */
export class LegacyLiveFrameRollback {
  #adapters;
  #records = new WeakMap();
  #sequence = 0;

  constructor(configuration = {}) {
    const adapters = normalizeAdapters(configuration);
    if (adapters.length === 0) throw new TypeError("At least one live-frame rollback adapter is required");
    this.#adapters = Object.freeze(adapters.map(validateAdapter));
    this.diagnostics = ensureDiagnosticCollector(
      configuration && !Array.isArray(configuration) ? configuration.diagnostics : null,
    );
    this.label = String(
      configuration && !Array.isArray(configuration)
        ? configuration.label ?? "legacy-live-frame"
        : "legacy-live-frame",
    );
    this.coordinatorCallbacks = Object.freeze({
      captureState: (context) => this.captureState(context),
      restoreState: (snapshot, context, cause) => this.restoreState(snapshot, context, cause),
    });
    Object.freeze(this);
  }

  get adapterCount() { return this.#adapters.length; }

  captureState(context = null) {
    const entries = [];
    for (const adapter of this.#adapters) {
      try {
        const state = assertSynchronous(adapter.captureState(context), `${adapter.id}:captureState`);
        entries.push(Object.freeze({ adapter, state }));
      } catch (cause) {
        const error = cause instanceof LegacyLiveFrameCaptureError
          ? cause
          : new LegacyLiveFrameCaptureError(adapter.id, cause);
        this.diagnostics.emit({
          severity: "error",
          code: error.code,
          message: error.message,
          frameId: context?.frameId ?? null,
          details: { adapterId: adapter.id, capturedAdapters: entries.map(({ adapter: item }) => item.id) },
        });
        throw error;
      }
    }

    const sequence = this.#sequence++;
    const token = Object.freeze({ kind: SNAPSHOT_KIND, version: SNAPSHOT_VERSION, sequence });
    this.#records.set(token, {
      state: LIVE_FRAME_ROLLBACK_STATES.CAPTURED,
      entries: Object.freeze(entries),
      settlement: null,
      failure: null,
    });
    this.diagnostics.emit({
      severity: "debug",
      code: "LIVE_FRAME_STATE_CAPTURED",
      message: `Captured ${entries.length} live-frame state adapter(s).`,
      frameId: context?.frameId ?? null,
      details: { sequence, adapterIds: entries.map(({ adapter }) => adapter.id) },
    });
    return token;
  }

  restoreState(token, context = null, cause = null) {
    if (!token || typeof token !== "object") throw new LegacyLiveFrameSnapshotError();
    const record = this.#records.get(token);
    if (!record || token.kind !== SNAPSHOT_KIND || token.version !== SNAPSHOT_VERSION) {
      throw new LegacyLiveFrameSnapshotError();
    }
    if (record.state === LIVE_FRAME_ROLLBACK_STATES.RESTORING) {
      throw new LegacyLiveFrameSnapshotError("Live-frame rollback snapshot is already being restored");
    }
    if (record.state === LIVE_FRAME_ROLLBACK_STATES.RESTORED) return record.settlement;
    if (record.state === LIVE_FRAME_ROLLBACK_STATES.RESTORE_FAILED) throw record.failure;

    record.state = LIVE_FRAME_ROLLBACK_STATES.RESTORING;
    const failures = [];
    for (let index = record.entries.length - 1; index >= 0; index -= 1) {
      const { adapter, state } = record.entries[index];
      try {
        assertSynchronous(
          adapter.restoreState(state, context, cause),
          `${adapter.id}:restoreState`,
        );
      } catch (error) {
        failures.push({ adapterId: adapter.id, error: normalizeThrown(error) });
      }
    }

    if (failures.length > 0) {
      const failure = new LegacyLiveFrameRestoreError(failures);
      record.state = LIVE_FRAME_ROLLBACK_STATES.RESTORE_FAILED;
      record.failure = failure;
      this.diagnostics.emit({
        severity: "error",
        code: failure.code,
        message: failure.message,
        frameId: context?.frameId ?? null,
        details: { sequence: token.sequence, adapterIds: failure.details.adapterIds },
      });
      throw failure;
    }

    const settlement = Object.freeze({
      status: LIVE_FRAME_ROLLBACK_STATES.RESTORED,
      sequence: token.sequence,
      adapterCount: record.entries.length,
    });
    record.state = LIVE_FRAME_ROLLBACK_STATES.RESTORED;
    record.settlement = settlement;
    this.diagnostics.emit({
      severity: "info",
      code: "LIVE_FRAME_STATE_RESTORED",
      message: `Restored ${record.entries.length} live-frame state adapter(s).`,
      frameId: context?.frameId ?? null,
      details: { sequence: token.sequence, causeCode: cause?.code ?? null },
    });
    return settlement;
  }
}

/**
 * Captures bone transforms, morph arrays, and visible character-root transforms.
 * The caller supplies only object enumeration callbacks; no Three.js type is used.
 */
export function createLiveCharacterPoseRollbackAdapter({
  id = "visible-character-pose",
  listCharacters,
  getBones = defaultBones,
  getMorphTargets = defaultMorphTargets,
  getMeshes = defaultMeshes,
  readTransform = null,
  writeTransform = null,
  readMorphInfluences = readDefaultInfluences,
  writeMorphInfluences = writeDefaultInfluences,
  afterRestore = null,
} = {}) {
  const enumerate = requiredFunction(listCharacters, "listCharacters");
  const bonesFor = requiredFunction(getBones, "getBones");
  const morphsFor = requiredFunction(getMorphTargets, "getMorphTargets");
  const meshesFor = requiredFunction(getMeshes, "getMeshes");
  const readPoseTransform = optionalFunction(
    readTransform,
    "readTransform",
    (target, label) => captureGenericTransform(target, DEFAULT_TRANSFORM_FIELDS, label),
  );
  const writePoseTransform = optionalFunction(
    writeTransform,
    "writeTransform",
    (target, state, label) => restoreGenericTransform(target, state, label),
  );
  const readInfluences = requiredFunction(readMorphInfluences, "readMorphInfluences");
  const writeInfluences = requiredFunction(writeMorphInfluences, "writeMorphInfluences");
  const restored = optionalFunction(afterRestore, "afterRestore", () => undefined);

  return Object.freeze({
    id: String(id),
    captureState(context) {
      const characters = toArray(enumerate(context), "listCharacters");
      return Object.freeze(characters.map((character, characterIndex) => {
        const label = `character[${characterIndex}]`;
        const bones = toArray(bonesFor(character, context), `${label} bones`)
          .map((target, index) => freezeEntry(
            target,
            assertSynchronous(readPoseTransform(target, `${label}.bone[${index}]`, context), `${id}:readTransform`),
          ));
        const morphs = toArray(morphsFor(character, context), `${label} morph targets`)
          .map((target, index) => freezeEntry(
            target,
            assertSynchronous(readInfluences(target, `${label}.morph[${index}]`, context), `${id}:readMorphInfluences`),
          ));
        const meshes = toArray(meshesFor(character, context), `${label} meshes`)
          .map((target, index) => freezeEntry(
            target,
            assertSynchronous(readPoseTransform(target, `${label}.mesh[${index}]`, context), `${id}:readTransform`),
          ));
        return Object.freeze({ character, bones: Object.freeze(bones), morphs: Object.freeze(morphs), meshes: Object.freeze(meshes) });
      }));
    },
    restoreState(snapshot, context, cause) {
      if (!Array.isArray(snapshot)) throw new TypeError("Character pose snapshot is malformed");
      const tasks = [];
      for (let characterIndex = snapshot.length - 1; characterIndex >= 0; characterIndex -= 1) {
        const entry = snapshot[characterIndex];
        if (!entry || !Array.isArray(entry.bones) || !Array.isArray(entry.morphs) || !Array.isArray(entry.meshes)) {
          tasks.push(() => { throw new TypeError(`character[${characterIndex}] snapshot is malformed`); });
          continue;
        }
        for (let index = entry.meshes.length - 1; index >= 0; index -= 1) {
          const item = entry.meshes[index];
          tasks.push(() => assertSynchronous(
            writePoseTransform(item.target, item.state, `character[${characterIndex}].mesh[${index}]`, context),
            `${id}:writeTransform`,
          ));
        }
        for (let index = entry.morphs.length - 1; index >= 0; index -= 1) {
          const item = entry.morphs[index];
          tasks.push(() => assertSynchronous(
            writeInfluences(item.target, item.state, `character[${characterIndex}].morph[${index}]`, context),
            `${id}:writeMorphInfluences`,
          ));
        }
        for (let index = entry.bones.length - 1; index >= 0; index -= 1) {
          const item = entry.bones[index];
          tasks.push(() => assertSynchronous(
            writePoseTransform(item.target, item.state, `character[${characterIndex}].bone[${index}]`, context),
            `${id}:writeTransform`,
          ));
        }
        tasks.push(() => assertSynchronous(
          restored(entry.character, context, cause),
          `${id}:afterRestore`,
        ));
      }
      restoreEvery(tasks, "Character pose");
    },
  });
}

/** Captures the active camera transform plus selected numeric lens fields. */
export function createLiveCameraRollbackAdapter({
  id = "active-camera",
  getCamera,
  transformFields = DEFAULT_CAMERA_TRANSFORM_FIELDS,
  scalarFields = DEFAULT_CAMERA_SCALAR_FIELDS,
  readTransform = null,
  writeTransform = null,
  afterRestore = null,
} = {}) {
  const resolveCamera = requiredFunction(getCamera, "getCamera");
  const vectors = Object.freeze(Array.from(transformFields, String));
  const scalars = Object.freeze(Array.from(scalarFields, String));
  const readCameraTransform = optionalFunction(
    readTransform,
    "readTransform",
    (camera, label) => captureGenericTransform(camera, vectors, label),
  );
  const writeCameraTransform = optionalFunction(
    writeTransform,
    "writeTransform",
    (camera, state, label) => restoreGenericTransform(camera, state, label),
  );
  const restored = optionalFunction(afterRestore, "afterRestore", () => undefined);

  return Object.freeze({
    id: String(id),
    captureState(context) {
      const camera = resolveCamera(context);
      if (!camera || typeof camera !== "object") throw new TypeError("getCamera() must return an object");
      const scalarState = [];
      for (const field of scalars) {
        if (!(field in camera) || camera[field] == null) continue;
        const value = Number(camera[field]);
        if (!Number.isFinite(value)) throw new TypeError(`camera.${field} must be finite`);
        scalarState.push(Object.freeze({ field, value }));
      }
      return Object.freeze({
        camera,
        transform: assertSynchronous(readCameraTransform(camera, "camera", context), `${id}:readTransform`),
        scalars: Object.freeze(scalarState),
      });
    },
    restoreState(snapshot, context, cause) {
      if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.scalars)) {
        throw new TypeError("Camera snapshot is malformed");
      }
      const tasks = [
        () => assertSynchronous(
          writeCameraTransform(snapshot.camera, snapshot.transform, "camera", context),
          `${id}:writeTransform`,
        ),
      ];
      for (const entry of snapshot.scalars) {
        tasks.push(() => {
          if (!entry || typeof entry.field !== "string" || !Number.isFinite(entry.value)) {
            throw new TypeError("Camera scalar snapshot is malformed");
          }
          snapshot.camera[entry.field] = entry.value;
        });
      }
      tasks.push(() => assertSynchronous(restored(snapshot.camera, context, cause), `${id}:afterRestore`));
      restoreEvery(tasks, "Camera state");
    },
  });
}
