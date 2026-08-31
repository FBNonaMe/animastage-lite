import { FrameValidationError } from "../core/errors.js";

export const MANUAL_BONE_LAYER_MODES = Object.freeze({
  OVERLAY: "overlay",
  FULL_POSE: "fullPose",
});

export const MANUAL_BONE_LAYER_REASONS = Object.freeze({
  LIVE: "live",
  OFFLINE: "offline",
  SCRUB: "scrub",
  EDITOR: "editor",
});

const VALID_MODES = new Set(Object.values(MANUAL_BONE_LAYER_MODES));
const VALID_REASONS = new Set(Object.values(MANUAL_BONE_LAYER_REASONS));
const DEFAULT_DURATION_SECONDS = 10;
const DEFAULT_KEY_TOLERANCE_SECONDS = 0.06;

function isIdentity(value) {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function assertMesh(mesh) {
  if (!isIdentity(mesh)) {
    throw new FrameValidationError("A manual bone layer requires an explicit mesh identity.");
  }
  return mesh;
}

function characterIdOf(value) {
  const id = String(value ?? "").trim();
  if (!id) throw new FrameValidationError("A manual bone layer requires a non-empty characterId.");
  return id;
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new FrameValidationError(`${label} must be finite.`, { value });
  }
  return number;
}

function durationOf(value) {
  const duration = finiteNumber(value ?? DEFAULT_DURATION_SECONDS, "Manual bone layer duration");
  if (duration <= 0) {
    throw new FrameValidationError("Manual bone layer duration must be greater than zero.", { duration });
  }
  return duration;
}

function modeOf(value) {
  const mode = value ?? MANUAL_BONE_LAYER_MODES.OVERLAY;
  if (!VALID_MODES.has(mode)) {
    throw new FrameValidationError(`Unknown manual bone layer mode "${mode}".`, {
      mode,
      validModes: [...VALID_MODES],
    });
  }
  return mode;
}

function reasonOf(value) {
  const reason = value ?? MANUAL_BONE_LAYER_REASONS.LIVE;
  if (!VALID_REASONS.has(reason)) {
    throw new FrameValidationError(`Unknown manual bone sampling reason "${reason}".`, {
      reason,
      validReasons: [...VALID_REASONS],
    });
  }
  return reason;
}

function tuple(value, length, label) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
    throw new FrameValidationError(`${label} must be an array-like value of length ${length}.`);
  }
  if (value.length !== length) {
    throw new FrameValidationError(`${label} must contain exactly ${length} values.`, {
      length: value.length,
    });
  }
  const result = Array.from(value, Number);
  if (result.some((component) => !Number.isFinite(component))) {
    throw new FrameValidationError(`${label} contains a non-finite component.`, { value: result });
  }
  return Object.freeze(result);
}

function normalizePayload(payload, boneName) {
  if (Array.isArray(payload) || ArrayBuffer.isView(payload)) {
    return tuple(payload, 4, `${boneName}.rotation`);
  }
  if (payload == null || typeof payload !== "object") {
    throw new FrameValidationError(`Pose payload for bone "${boneName}" must be a quaternion or object.`);
  }
  const normalized = {};
  if (payload.q != null) normalized.q = tuple(payload.q, 4, `${boneName}.q`);
  if (payload.p != null) normalized.p = tuple(payload.p, 3, `${boneName}.p`);
  if (payload.s != null) normalized.s = tuple(payload.s, 3, `${boneName}.s`);
  if (Object.keys(normalized).length === 0) {
    throw new FrameValidationError(`Pose payload for bone "${boneName}" has no q, p, or s channel.`);
  }
  return Object.freeze(normalized);
}

function normalizePose(pose, keyIndex) {
  if (pose == null || typeof pose !== "object" || Array.isArray(pose)) {
    throw new FrameValidationError(`Manual bone key ${keyIndex} pose must be an object.`);
  }
  const normalized = {};
  for (const [rawName, payload] of Object.entries(pose)) {
    const boneName = String(rawName).trim();
    if (!boneName) throw new FrameValidationError(`Manual bone key ${keyIndex} contains an empty bone name.`);
    normalized[boneName] = normalizePayload(payload, boneName);
  }
  return Object.freeze(normalized);
}

function normalizeKey(key, index, duration) {
  if (key == null || typeof key !== "object" || Array.isArray(key)) {
    throw new FrameValidationError(`Manual bone key ${index} must be an object.`);
  }
  const time = finiteNumber(key.t ?? key.time, `Manual bone key ${index} time`);
  if (time < 0 || time > duration) {
    throw new FrameValidationError(`Manual bone key ${index} time is outside the layer duration.`, {
      time,
      duration,
    });
  }
  return Object.freeze({ t: time, pose: normalizePose(key.pose, index) });
}

function normalizeKeys(keys, duration) {
  if (!Array.isArray(keys)) throw new FrameValidationError("Manual bone layer keys must be an array.");
  return Object.freeze(keys
    .map((key, index) => normalizeKey(key, index, duration))
    .sort((first, second) => first.t - second.t));
}

function clonePayload(payload) {
  if (Array.isArray(payload)) return [...payload];
  const result = {};
  if (payload.q) result.q = [...payload.q];
  if (payload.p) result.p = [...payload.p];
  if (payload.s) result.s = [...payload.s];
  return result;
}

function clonePose(pose) {
  return Object.fromEntries(Object.entries(pose).map(([name, payload]) => [name, clonePayload(payload)]));
}

function frozenPoseSnapshot(pose) {
  return Object.freeze(Object.fromEntries(
    Object.entries(pose).map(([name, payload]) => [
      name,
      Array.isArray(payload)
        ? Object.freeze([...payload])
        : Object.freeze(Object.fromEntries(
          Object.entries(payload).map(([channel, values]) => [channel, Object.freeze([...values])]),
        )),
    ]),
  ));
}

function cloneKeys(keys) {
  return keys.map((key) => ({
    t: key.t,
    pose: clonePose(key.pose),
  }));
}

function ownsPose(record) {
  if (record.keys.length === 0 && !record.manualHold) return false;
  return !!(record.playing || record.timelineActive || record.manualHold);
}

function publicState(record, active) {
  return Object.freeze({
    characterId: record.characterId,
    modelKey: record.modelKey,
    duration: record.duration,
    transportDuration: record.transportDuration,
    time: record.time,
    playing: record.playing,
    timelineActive: record.timelineActive,
    manualHold: record.manualHold,
    mode: record.mode,
    revision: record.revision,
    keyCount: record.keys.length,
    restBoneCount: Object.keys(record.restPose).length,
    ownsPose: ownsPose(record),
    editorActive: active,
    selectedBone: record.selectedBone,
    // Both values are normalized and recursively frozen when written. Reuse
    // them during real-time sampling instead of cloning an entire animation
    // track and rest skeleton on every RAF frame.
    restPose: record.restPose,
    keys: record.keys,
  });
}

function publicSummary(record, active) {
  return Object.freeze({
    characterId: record.characterId,
    modelKey: record.modelKey,
    duration: record.duration,
    transportDuration: record.transportDuration,
    time: record.time,
    playing: record.playing,
    timelineActive: record.timelineActive,
    manualHold: record.manualHold,
    mode: record.mode,
    revision: record.revision,
    keyCount: record.keys.length,
    restBoneCount: Object.keys(record.restPose).length,
    ownsPose: ownsPose(record),
    editorActive: active,
    selectedBone: record.selectedBone,
  });
}

function clampTime(time, duration) {
  return Math.max(0, Math.min(duration, finiteNumber(time, "Manual bone layer time")));
}

function callbackResultMustBeSynchronous(result, label) {
  if (result != null && typeof result.then === "function") {
    throw new ManualBoneLayerAsyncApplyError(label);
  }
  return result;
}

export class ManualBoneLayerError extends Error {
  constructor(message, { code = "MANUAL_BONE_LAYER_ERROR", details = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class ManualBoneLayerUnknownCharacterError extends ManualBoneLayerError {
  constructor(reference) {
    super("No manual bone layer is registered for the requested character.", {
      code: "MANUAL_BONE_LAYER_UNKNOWN_CHARACTER",
      details: { reference },
    });
  }
}

export class ManualBoneLayerDuplicateCharacterError extends ManualBoneLayerError {
  constructor(characterId) {
    super(`Character id "${characterId}" already belongs to another manual bone layer.`, {
      code: "MANUAL_BONE_LAYER_DUPLICATE_CHARACTER",
      details: { characterId },
    });
  }
}

export class ManualBoneLayerAsyncApplyError extends ManualBoneLayerError {
  constructor(characterId) {
    super(`Manual bone sampling for "${characterId}" returned a Promise.`, {
      code: "MANUAL_BONE_LAYER_ASYNC_APPLY",
      details: { characterId },
    });
  }
}

export class ManualBoneLayerApplyError extends ManualBoneLayerError {
  constructor(characterId, cause) {
    super(`Manual bone sampling failed for "${characterId}": ${cause?.message ?? cause}`, {
      code: "MANUAL_BONE_LAYER_APPLY_FAILED",
      details: { characterId },
      cause,
    });
  }
}

/**
 * Per-character transport and key storage for the legacy manual bone editor.
 *
 * The selected editor character is deliberately independent from playback:
 * activating B never pauses, clears, or transfers A's layer. Every sampling
 * callback receives the exact registered mesh and an immutable layer snapshot.
 */
export class LegacyManualBoneLayerRegistry {
  #recordsByMesh = new WeakMap();
  #recordsById = new Map();
  #records = new Set();
  #active = null;
  #applyLayer;

  constructor({ applyLayer } = {}) {
    if (typeof applyLayer !== "function") {
      throw new FrameValidationError("LegacyManualBoneLayerRegistry requires an applyLayer callback.");
    }
    this.#applyLayer = applyLayer;
  }

  get size() { return this.#records.size; }
  get activeMesh() { return this.#active?.mesh ?? null; }

  #record(reference) {
    let record = null;
    if (typeof reference === "string") record = this.#recordsById.get(reference) ?? null;
    else if (isIdentity(reference)) record = this.#recordsByMesh.get(reference) ?? null;
    if (!record) throw new ManualBoneLayerUnknownCharacterError(reference);
    return record;
  }

  register(mesh, {
    characterId,
    modelKey = "",
    duration = DEFAULT_DURATION_SECONDS,
    transportDuration = duration,
    time = 0,
    playing = false,
    timelineActive = false,
    manualHold = false,
    mode = MANUAL_BONE_LAYER_MODES.OVERLAY,
    selectedBone = null,
    restPose = {},
    keys = [],
  } = {}) {
    assertMesh(mesh);
    const id = characterIdOf(characterId);
    const existingForMesh = this.#recordsByMesh.get(mesh);
    if (existingForMesh) {
      if (existingForMesh.characterId !== id) {
        throw new ManualBoneLayerDuplicateCharacterError(id);
      }
      return this.getState(mesh);
    }
    if (this.#recordsById.has(id)) throw new ManualBoneLayerDuplicateCharacterError(id);
    const safeDuration = durationOf(duration);
    const safeTransportDuration = Math.max(
      safeDuration,
      durationOf(transportDuration),
    );
    const record = {
      mesh,
      characterId: id,
      modelKey: String(modelKey ?? ""),
      duration: safeDuration,
      transportDuration: safeTransportDuration,
      time: clampTime(time, safeTransportDuration),
      playing: !!playing,
      timelineActive: !!timelineActive,
      manualHold: !!manualHold,
      mode: modeOf(mode),
      selectedBone: selectedBone == null ? null : String(selectedBone),
      restPose: normalizePose(restPose, "rest"),
      keys: normalizeKeys(keys, safeDuration),
      revision: 0,
    };
    this.#recordsByMesh.set(mesh, record);
    this.#recordsById.set(id, record);
    this.#records.add(record);
    return this.getState(mesh);
  }

  ensure(mesh, options = {}) {
    const existing = isIdentity(mesh) ? this.#recordsByMesh.get(mesh) : null;
    return existing ? this.getState(mesh) : this.register(mesh, options);
  }

  has(reference) {
    if (typeof reference === "string") return this.#recordsById.has(reference);
    return isIdentity(reference) && this.#recordsByMesh.has(reference);
  }

  resolveMesh(characterId) {
    return this.#record(characterId).mesh;
  }

  renameCharacter(reference, characterId, { modelKey } = {}) {
    const record = this.#record(reference);
    const nextId = characterIdOf(characterId);
    const conflicting = this.#recordsById.get(nextId);
    if (conflicting && conflicting !== record) {
      throw new ManualBoneLayerDuplicateCharacterError(nextId);
    }
    if (record.characterId !== nextId) {
      this.#recordsById.delete(record.characterId);
      record.characterId = nextId;
      this.#recordsById.set(nextId, record);
      record.revision += 1;
    }
    if (modelKey != null && record.modelKey !== String(modelKey)) {
      record.modelKey = String(modelKey);
      record.revision += 1;
    }
    return this.getState(record.mesh);
  }

  activate(reference) {
    const record = reference == null ? null : this.#record(reference);
    const previous = this.#active;
    this.#active = record;
    return Object.freeze({
      changed: previous !== record,
      previousMesh: previous?.mesh ?? null,
      mesh: record?.mesh ?? null,
      previousCharacterId: previous?.characterId ?? null,
      characterId: record?.characterId ?? null,
    });
  }

  getState(reference) {
    const record = this.#record(reference);
    return publicState(record, record === this.#active);
  }

  list() {
    return Object.freeze([...this.#records].map((record) => publicSummary(record, record === this.#active)));
  }

  getKeys(reference) {
    return cloneKeys(this.#record(reference).keys);
  }

  getRestPose(reference) {
    return clonePose(this.#record(reference).restPose);
  }

  replaceRestPose(reference, restPose) {
    const record = this.#record(reference);
    record.restPose = normalizePose(restPose, "rest");
    record.revision += 1;
    return this.getState(record.mesh);
  }

  replaceKeys(reference, keys) {
    const record = this.#record(reference);
    record.keys = normalizeKeys(keys, record.duration);
    record.revision += 1;
    return this.getState(record.mesh);
  }

  upsertKey(reference, key, { toleranceSeconds = DEFAULT_KEY_TOLERANCE_SECONDS } = {}) {
    const record = this.#record(reference);
    const tolerance = finiteNumber(toleranceSeconds, "Manual bone key tolerance");
    if (tolerance < 0) throw new FrameValidationError("Manual bone key tolerance cannot be negative.");
    const normalized = normalizeKey(key, 0, record.duration);
    const keys = cloneKeys(record.keys);
    const index = keys.findIndex((entry) => Math.abs(entry.t - normalized.t) <= tolerance);
    const normalizedClone = cloneKeys([normalized])[0];
    if (index >= 0) {
      keys[index] = {
        t: normalized.t,
        pose: { ...keys[index].pose, ...normalizedClone.pose },
      };
    } else {
      keys.push(normalizedClone);
    }
    return this.replaceKeys(record.mesh, keys);
  }

  setDuration(reference, duration, { clampKeys = false } = {}) {
    const record = this.#record(reference);
    const nextDuration = durationOf(duration);
    if (!clampKeys && record.keys.some((key) => key.t > nextDuration)) {
      throw new FrameValidationError("Cannot shorten a manual bone layer past an existing key.", {
        characterId: record.characterId,
        duration: nextDuration,
      });
    }
    const keys = clampKeys
      ? cloneKeys(record.keys).map((key) => ({ ...key, t: Math.min(key.t, nextDuration) }))
      : cloneKeys(record.keys);
    const transportFollowedAuthoredDuration =
      Math.abs(record.transportDuration - record.duration) <= Number.EPSILON * 16;
    record.duration = nextDuration;
    record.transportDuration = transportFollowedAuthoredDuration
      ? nextDuration
      : Math.max(record.transportDuration, nextDuration);
    record.time = Math.min(record.time, record.transportDuration);
    record.keys = normalizeKeys(keys, nextDuration);
    record.revision += 1;
    return this.getState(record.mesh);
  }

  setTransportDuration(reference, duration) {
    const record = this.#record(reference);
    const lastKeyTime = record.keys.length
      ? Number(record.keys[record.keys.length - 1].t) || 0
      : 0;
    const next = Math.max(0.001, lastKeyTime, durationOf(duration));
    if (!Object.is(next, record.transportDuration)) {
      record.transportDuration = next;
      record.time = Math.min(record.time, next);
      record.revision += 1;
    }
    return this.getState(record.mesh);
  }

  setTime(reference, time) {
    const record = this.#record(reference);
    const next = clampTime(time, record.transportDuration);
    if (!Object.is(next, record.time)) {
      record.time = next;
      record.revision += 1;
    }
    return record.time;
  }

  setPlaying(reference, playing) {
    const record = this.#record(reference);
    const next = !!playing;
    if (record.playing !== next) {
      record.playing = next;
      record.revision += 1;
    }
    return this.getState(record.mesh);
  }

  setTimelineActive(reference, active) {
    const record = this.#record(reference);
    const next = !!active;
    if (record.timelineActive !== next) {
      record.timelineActive = next;
      record.revision += 1;
    }
    return this.getState(record.mesh);
  }

  setManualHold(reference, active) {
    const record = this.#record(reference);
    const next = !!active;
    if (record.manualHold !== next) {
      record.manualHold = next;
      record.revision += 1;
    }
    return this.getState(record.mesh);
  }

  setMode(reference, mode) {
    const record = this.#record(reference);
    const next = modeOf(mode);
    if (record.mode !== next) {
      record.mode = next;
      record.revision += 1;
    }
    return this.getState(record.mesh);
  }

  setSelectedBone(reference, boneName) {
    const record = this.#record(reference);
    const next = boneName == null ? null : String(boneName);
    if (record.selectedBone !== next) {
      record.selectedBone = next;
      record.revision += 1;
    }
    return this.getState(record.mesh);
  }

  ownsPose(reference) {
    return ownsPose(this.#record(reference));
  }

  ownerMeshes() {
    return Object.freeze([...this.#records].filter(ownsPose).map((record) => record.mesh));
  }

  advance(deltaSeconds, {
    loop = false,
    loopIn = 0,
    loopOut = null,
    resolveLoopRegion = null,
  } = {}) {
    const delta = finiteNumber(deltaSeconds, "Manual bone transport delta");
    const requestedLoopIn = finiteNumber(loopIn, "Manual bone loop start");
    const requestedLoopOut = loopOut == null
      ? null
      : finiteNumber(loopOut, "Manual bone loop end");
    if (resolveLoopRegion != null && typeof resolveLoopRegion !== "function") {
      throw new FrameValidationError("Manual bone loop-region resolver must be a function.");
    }
    const changed = [];
    for (const record of this.#records) {
      if (!record.playing) continue;
      let recordLoop = !!loop;
      let recordLoopIn = requestedLoopIn;
      let recordLoopOut = requestedLoopOut;
      if (resolveLoopRegion) {
        const resolved = callbackResultMustBeSynchronous(
          resolveLoopRegion(record.mesh, publicSummary(record, record === this.#active)),
          `${record.characterId} loop region`,
        );
        if (resolved != null) {
          if (typeof resolved !== "object" || Array.isArray(resolved)) {
            throw new FrameValidationError(
              `Manual bone loop-region resolver for "${record.characterId}" must return an object or null.`,
            );
          }
          if (Object.hasOwn(resolved, "loop")) recordLoop = !!resolved.loop;
          if (Object.hasOwn(resolved, "loopIn")) {
            recordLoopIn = finiteNumber(
              resolved.loopIn,
              `${record.characterId} manual bone loop start`,
            );
          }
          if (Object.hasOwn(resolved, "loopOut")) {
            recordLoopOut = resolved.loopOut == null
              ? null
              : finiteNumber(
                resolved.loopOut,
                `${record.characterId} manual bone loop end`,
              );
          }
        }
      }
      let next = record.time + delta;
      if (recordLoop) {
        const start = Math.max(0, Math.min(record.transportDuration, recordLoopIn));
        const requestedEnd = recordLoopOut == null
          ? record.transportDuration
          : recordLoopOut;
        const end = Math.max(start, Math.min(record.transportDuration, requestedEnd));
        const span = end - start;
        if (span > 0) {
          if (delta >= 0 && next >= end) {
            next = start + (((next - start) % span) + span) % span;
          } else if (delta < 0 && next < start) {
            next = start + (((next - start) % span) + span) % span;
          } else {
            next = Math.max(0, Math.min(record.transportDuration, next));
          }
        } else {
          next = start;
        }
      } else {
        next = Math.max(0, Math.min(record.transportDuration, next));
        if ((delta >= 0 && next >= record.transportDuration) || (delta < 0 && next <= 0)) {
          record.playing = false;
        }
      }
      record.time = next;
      record.revision += 1;
      changed.push(record.mesh);
    }
    return Object.freeze(changed);
  }

  sample(reference, {
    timeSeconds,
    mode,
    reason = MANUAL_BONE_LAYER_REASONS.LIVE,
    includePaused = false,
  } = {}) {
    const record = this.#record(reference);
    const sampleTime = timeSeconds == null ? record.time : clampTime(timeSeconds, record.duration);
    const sampleMode = modeOf(mode ?? record.mode);
    const sampleReason = reasonOf(reason);
    const eligible = record.keys.length > 0 && (includePaused || ownsPose(record));
    if (!eligible) {
      return Object.freeze({
        applied: false,
        mesh: record.mesh,
        characterId: record.characterId,
        reason: record.keys.length === 0 ? "no-keys" : "inactive",
      });
    }
    const state = publicState(record, record === this.#active);
    try {
      const output = callbackResultMustBeSynchronous(this.#applyLayer(Object.freeze({
        mesh: record.mesh,
        characterId: record.characterId,
        timeSeconds: sampleTime,
        mode: sampleMode,
        reason: sampleReason,
        layer: state,
      })), record.characterId);
      return Object.freeze({
        applied: true,
        mesh: record.mesh,
        characterId: record.characterId,
        timeSeconds: sampleTime,
        mode: sampleMode,
        output,
      });
    } catch (error) {
      if (error instanceof ManualBoneLayerAsyncApplyError) throw error;
      throw new ManualBoneLayerApplyError(record.characterId, error);
    }
  }

  sampleScene({
    timeSeconds,
    characters,
    reason = MANUAL_BONE_LAYER_REASONS.LIVE,
    includePaused = false,
    resolveMesh = (character) => character?.mesh ?? character,
    resolveMode = null,
  } = {}) {
    if (characters == null || typeof characters[Symbol.iterator] !== "function") {
      throw new FrameValidationError("sampleScene characters must be iterable.");
    }
    if (typeof resolveMesh !== "function") throw new FrameValidationError("resolveMesh must be a function.");
    if (resolveMode != null && typeof resolveMode !== "function") {
      throw new FrameValidationError("resolveMode must be a function when supplied.");
    }
    const results = [];
    const seen = new Set();
    for (const character of characters) {
      const mesh = resolveMesh(character);
      if (!isIdentity(mesh) || seen.has(mesh) || !this.#recordsByMesh.has(mesh)) continue;
      seen.add(mesh);
      const record = this.#recordsByMesh.get(mesh);
      const resolvedMode = resolveMode == null
        ? record.mode
        : modeOf(resolveMode(character, publicSummary(record, record === this.#active)));
      results.push(this.sample(mesh, {
        timeSeconds,
        mode: resolvedMode,
        reason,
        includePaused,
      }));
    }
    return Object.freeze(results);
  }

  dispose(reference) {
    const record = this.#record(reference);
    const wasActive = record === this.#active;
    if (wasActive) this.#active = null;
    record.playing = false;
    record.timelineActive = false;
    record.manualHold = false;
    this.#records.delete(record);
    this.#recordsById.delete(record.characterId);
    this.#recordsByMesh.delete(record.mesh);
    return Object.freeze({
      disposed: true,
      mesh: record.mesh,
      characterId: record.characterId,
      wasActive,
    });
  }

  clear() {
    const disposed = [];
    for (const record of [...this.#records]) disposed.push(this.dispose(record.mesh));
    return Object.freeze(disposed);
  }
}
