import { FrameValidationError } from "./errors.js";

export const FRAME_MODES = Object.freeze({ LIVE: "live", OFFLINE: "offline" });

function finiteNumber(value, name, { min = -Infinity } = {}) {
  if (!Number.isFinite(value) || value < min) {
    throw new FrameValidationError(`${name} must be a finite number${min !== -Infinity ? ` >= ${min}` : ""}.`, {
      [name]: value,
    });
  }
  return value;
}

function safeIndex(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new FrameValidationError(`${name} must be a non-negative safe integer.`, { [name]: value });
  }
  return value;
}

/**
 * Immutable timing and execution metadata for one character evaluation.
 * It contains no renderer state, so the same context contract works in a live
 * viewport and in deterministic offline frame rendering.
 */
export class FrameContext {
  constructor({
    mode,
    frameId,
    time,
    deltaSeconds,
    frameIndex = null,
    fps = null,
    subframe = 0,
    playbackRate = 1,
    seed = frameId,
    metadata = {},
    signal = null,
  } = {}) {
    if (mode !== FRAME_MODES.LIVE && mode !== FRAME_MODES.OFFLINE) {
      throw new FrameValidationError(`Frame mode must be "live" or "offline".`, { mode });
    }
    this.mode = mode;
    this.frameId = safeIndex(frameId, "frameId");
    this.time = finiteNumber(time, "time", { min: 0 });
    this.deltaSeconds = finiteNumber(deltaSeconds, "deltaSeconds", { min: 0 });
    this.frameIndex = frameIndex == null ? null : safeIndex(frameIndex, "frameIndex");
    this.fps = fps == null ? null : finiteNumber(fps, "fps", { min: Number.EPSILON });
    this.subframe = finiteNumber(subframe, "subframe", { min: 0 });
    if (this.subframe >= 1) {
      throw new FrameValidationError("subframe must be in the half-open interval [0, 1).", { subframe });
    }
    this.playbackRate = finiteNumber(playbackRate, "playbackRate");
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new FrameValidationError("seed must be an unsigned 32-bit integer.", { seed });
    }
    this.seed = seed >>> 0;
    if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new FrameValidationError("metadata must be an object.", { metadata });
    }
    this.metadata = Object.freeze({ ...metadata });
    this.signal = signal;
    Object.freeze(this);
  }

  static live({ frameId, time, deltaSeconds, ...rest } = {}) {
    return new FrameContext({ ...rest, mode: FRAME_MODES.LIVE, frameId, time, deltaSeconds });
  }

  static offline({ frameIndex, fps, time = null, frameId = frameIndex, subframe = 0, ...rest } = {}) {
    safeIndex(frameIndex, "frameIndex");
    finiteNumber(fps, "fps", { min: Number.EPSILON });
    finiteNumber(subframe, "subframe", { min: 0 });
    const sampleTime = time == null ? (frameIndex + subframe) / fps : time;
    return new FrameContext({
      ...rest,
      mode: FRAME_MODES.OFFLINE,
      frameId,
      frameIndex,
      fps,
      time: sampleTime,
      deltaSeconds: 1 / fps,
      subframe,
    });
  }

  get isLive() { return this.mode === FRAME_MODES.LIVE; }
  get isOffline() { return this.mode === FRAME_MODES.OFFLINE; }
  get aborted() { return Boolean(this.signal?.aborted); }

  with(overrides = {}) {
    return new FrameContext({ ...this.toObject(), ...overrides });
  }

  toObject() {
    return {
      mode: this.mode,
      frameId: this.frameId,
      time: this.time,
      deltaSeconds: this.deltaSeconds,
      frameIndex: this.frameIndex,
      fps: this.fps,
      subframe: this.subframe,
      playbackRate: this.playbackRate,
      seed: this.seed,
      metadata: this.metadata,
      signal: this.signal,
    };
  }

  toJSON() {
    const { signal: _signal, ...json } = this.toObject();
    return json;
  }
}
