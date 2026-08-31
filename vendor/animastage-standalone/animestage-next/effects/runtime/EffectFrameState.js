import { FRAME_MODES } from "../../core/FrameContext.js";
import { EffectPlatformError } from "../core/EffectErrors.js";

function finite(value, field, minimum = -Infinity) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) {
    throw new EffectPlatformError(`${field} must be a finite number${minimum !== -Infinity ? ` >= ${minimum}` : ""}`, {
      code: "EFFECT_FRAME_INVALID", details: { field, value },
    });
  }
  return number;
}
function index(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new EffectPlatformError(`${field} must be a non-negative safe integer`, {
      code: "EFFECT_FRAME_INVALID", details: { field, value },
    });
  }
  return number;
}
function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function mix32(value) {
  let result = value >>> 0;
  result ^= result >>> 16;
  result = Math.imul(result, 0x7feb352d);
  result ^= result >>> 15;
  result = Math.imul(result, 0x846ca68b);
  result ^= result >>> 16;
  return result >>> 0;
}

/** Immutable renderer-independent effect uniforms for one evaluated frame. */
export class EffectFrameState {
  constructor({
    mode = FRAME_MODES.LIVE,
    frameId = 0,
    frameIndex = null,
    fps = null,
    time = 0,
    deltaSeconds = 0,
    seed = frameId,
    sceneRevision = 0,
  } = {}) {
    if (mode !== FRAME_MODES.LIVE && mode !== FRAME_MODES.OFFLINE) {
      throw new EffectPlatformError(`Unknown effect frame mode "${mode}"`, { code: "EFFECT_FRAME_INVALID" });
    }
    this.mode = mode;
    this.frameId = index(frameId, "frameId");
    this.frameIndex = frameIndex == null ? null : index(frameIndex, "frameIndex");
    this.fps = fps == null ? null : finite(fps, "fps", Number.EPSILON);
    this.absoluteTime = finite(time, "time", 0);
    this.deltaTime = finite(deltaSeconds, "deltaSeconds", 0);
    this.seed = index(seed >>> 0, "seed") >>> 0;
    this.sceneRevision = typeof sceneRevision === "number" ? finite(sceneRevision, "sceneRevision", 0) : hashString(sceneRevision);
    Object.freeze(this);
  }

  static fromFrameContext(context, options = {}) {
    if (!context || typeof context !== "object") throw new TypeError("Effect frame context must be an object");
    return new EffectFrameState({
      mode: context.mode,
      frameId: context.frameId,
      frameIndex: context.frameIndex,
      fps: context.fps,
      time: context.time,
      deltaSeconds: context.deltaSeconds,
      seed: context.seed,
      sceneRevision: options.sceneRevision ?? context.metadata?.sceneRevision ?? 0,
    });
  }

  /** Stable [0,1) sample. It never reads Math.random or wall-clock time. */
  random(stream = 0, sampleIndex = 0) {
    const streamHash = typeof stream === "number" ? stream >>> 0 : hashString(stream);
    const sample = index(sampleIndex, "sampleIndex") >>> 0;
    return mix32(this.seed ^ Math.imul(this.frameId + 1, 0x9e3779b1) ^ streamHash ^ Math.imul(sample + 1, 0x85ebca6b)) / 0x100000000;
  }

  get uniforms() {
    return Object.freeze({
      frameIndex: this.frameIndex ?? this.frameId,
      absoluteTime: this.absoluteTime,
      deltaTime: this.deltaTime,
      fps: this.fps ?? 0,
      seed: this.seed,
      sceneRevision: this.sceneRevision,
      offline: this.mode === FRAME_MODES.OFFLINE,
    });
  }
}
