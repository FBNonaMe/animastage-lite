import { FACIAL_CHANNELS, FACIAL_CHANNEL_INDEX, createFacialBuffer } from "./FacialChannels.js";
import { OneEuroFilterBank, reduceCaptureKeys } from "./CaptureFilters.js";

const ALIASES = Object.freeze({
  _neutral: null, eyeBlinkLeft: "eyeBlinkLeft", eyeBlinkRight: "eyeBlinkRight", eyeLookDownLeft: "eyeLookDownLeft",
  eyeLookDownRight: "eyeLookDownRight", eyeLookInLeft: "eyeLookInLeft", eyeLookInRight: "eyeLookInRight",
  eyeLookOutLeft: "eyeLookOutLeft", eyeLookOutRight: "eyeLookOutRight", eyeLookUpLeft: "eyeLookUpLeft",
  eyeLookUpRight: "eyeLookUpRight", eyeSquintLeft: "eyeSquintLeft", eyeSquintRight: "eyeSquintRight",
  eyeWideLeft: "eyeWideLeft", eyeWideRight: "eyeWideRight", browDownLeft: "browDownLeft", browDownRight: "browDownRight",
  browInnerUp: "browInnerUp", browOuterUpLeft: "browOuterUpLeft", browOuterUpRight: "browOuterUpRight",
  cheekPuff: "cheekPuff", cheekSquintLeft: "cheekSquintLeft", cheekSquintRight: "cheekSquintRight",
  noseSneerLeft: "noseSneerLeft", noseSneerRight: "noseSneerRight", jawOpen: "jawOpen", jawForward: "jawForward",
  jawLeft: "jawLeft", jawRight: "jawRight", mouthClose: "mouthClose", mouthFunnel: "mouthFunnel", mouthPucker: "mouthPucker",
  mouthSmileLeft: "mouthSmileLeft", mouthSmileRight: "mouthSmileRight", mouthFrownLeft: "mouthFrownLeft",
  mouthFrownRight: "mouthFrownRight", mouthDimpleLeft: "mouthDimpleLeft", mouthDimpleRight: "mouthDimpleRight",
  mouthStretchLeft: "mouthStretchLeft", mouthStretchRight: "mouthStretchRight", mouthPressLeft: "mouthPressLeft",
  mouthPressRight: "mouthPressRight", mouthUpperUpLeft: "mouthUpperUpLeft", mouthUpperUpRight: "mouthUpperUpRight",
  mouthLowerDownLeft: "mouthLowerDownLeft", mouthLowerDownRight: "mouthLowerDownRight", mouthRollUpper: "mouthRollUpper",
  mouthRollLower: "mouthRollLower", tongueOut: "tongueOut",
});

export class FaceCapture {
  constructor(rig) {
    this.rig = rig;
    this.enabled = true; this.livePreview = false; this.tracking = false; this.confidence = 0;
    this.suspended = false;
    this.values = createFacialBuffer(); this.raw = createFacialBuffer(); this.neutral = createFacialBuffer(); this.maximum = createFacialBuffer(); this.maximum.fill(1);
    this.filters = new OneEuroFilterBank(FACIAL_CHANNELS.length, { minCutoff: 1.2, beta: 0.04 });
    this.recording = false; this.recordStart = 0; this.frames = []; this.lastTime = 0;
    this.headRotation = new Float32Array(4); this.headRotation[3] = 1;
  }

  _readCoefficients(source) {
    this.raw.fill(0);
    if (Array.isArray(source)) {
      for (const item of source) {
        const name = item?.categoryName || item?.displayName || item?.name;
        const channel = ALIASES[name] || (FACIAL_CHANNEL_INDEX[name] !== undefined ? name : null);
        if (channel) this.raw[FACIAL_CHANNEL_INDEX[channel]] = Number(item.score ?? item.value) || 0;
      }
    } else for (const [name, value] of Object.entries(source || {})) {
      const channel = ALIASES[name] || (FACIAL_CHANNEL_INDEX[name] !== undefined ? name : null);
      if (channel) this.raw[FACIAL_CHANNEL_INDEX[channel]] = Number(value) || 0;
    }
  }

  ingestFrame(frame = {}) {
    if (this.suspended) return false;
    const time = Number.isFinite(frame.time) ? frame.time : performance.now() / 1000;
    const confidence = Math.max(0, Math.min(1, Number(frame.confidence) || 0));
    if (confidence < 0.08) { this.tracking = false; return false; }
    this._readCoefficients(frame.coefficients || frame.blendshapes);
    for (let i = 0; i < this.raw.length; i++) {
      const range = Math.max(0.08, this.maximum[i] - this.neutral[i]);
      let value = Math.max(0, Math.min(1, (this.raw[i] - this.neutral[i]) / range));
      if (this.tracking) value = Math.max(this.values[i] - 0.45, Math.min(this.values[i] + 0.45, value));
      this.raw[i] = value;
    }
    this.filters.filter(this.raw, time, this.values);
    if (Array.isArray(frame.headRotation) && frame.headRotation.length >= 4) this.headRotation.set(frame.headRotation.slice(0, 4));
    this.lastTime = time; this.confidence = confidence; this.tracking = true; this.livePreview = true;
    if (this.recording) this.frames.push({ time: time - this.recordStart, confidence, values: Array.from(this.values), headRotation: Array.from(this.headRotation) });
    return true;
  }

  calibrateNeutral() { this.neutral.set(this.raw); this.filters.reset(this.values, this.lastTime); }
  calibrateMaximum() { for (let i = 0; i < this.maximum.length; i++) this.maximum[i] = Math.max(this.neutral[i] + 0.08, this.raw[i]); }
  startRecording(time = this.lastTime || performance.now() / 1000) { this.frames.length = 0; this.recordStart = time; this.recording = true; }
  stopRecording(layer, options = {}) { this.recording = false; return this.bakeRecording(layer, options); }

  bakeRecording(layer, options = {}) {
    if (!layer || !this.frames.length) return false;
    const offset = Math.max(0, Number(options.offset) || 0), tolerance = Math.max(0.0001, Number(options.tolerance) || 0.006);
    for (let channel = 0; channel < FACIAL_CHANNELS.length; channel++) {
      const keys = this.frames.map((frame) => ({ time: frame.time + offset, value: frame.values[channel] || 0 }));
      for (const key of reduceCaptureKeys(keys, tolerance)) layer.setKey(`face.${FACIAL_CHANNELS[channel]}`, key.time, key.value, "smooth");
    }
    return true;
  }

  loadRecording(frames) {
    if (!Array.isArray(frames)) return false;
    this.frames = frames.filter((frame) => Number.isFinite(frame?.time) && Array.isArray(frame?.values)).map((frame) => ({ time: Math.max(0, frame.time), confidence: Number(frame.confidence) || 1, values: frame.values.slice(0, FACIAL_CHANNELS.length), headRotation: Array.isArray(frame.headRotation) ? frame.headRotation.slice(0, 4) : [0, 0, 0, 1] }));
    return this.frames.length > 0;
  }

  evaluate(layer, _deltaTime, time) {
    if (!this.enabled) return;
    let hasValues = this.livePreview && this.tracking;
    this.raw.fill(0);
    for (let i = 0; i < FACIAL_CHANNELS.length; i++) {
      const channel = `face.${FACIAL_CHANNELS[i]}`;
      if (layer?.tracks?.has(channel)) { this.raw[i] = layer.sample(channel, time, 0); hasValues = true; }
      else if (this.livePreview && this.tracking) this.raw[i] = this.values[i];
    }
    if (hasValues) this.rig.applyCoefficients(layer, this.raw, time);
  }

  captureTransientState() {
    return {
      livePreview: this.livePreview,
      suspended: this.suspended,
      tracking: this.tracking,
      confidence: this.confidence,
      values: Float32Array.from(this.values),
      raw: Float32Array.from(this.raw),
      filters: this.filters.captureTransientState(),
      recording: this.recording,
      recordStart: this.recordStart,
      lastTime: this.lastTime,
      headRotation: Float32Array.from(this.headRotation),
      frameCount: this.frames.length,
    };
  }

  restoreTransientState(state) {
    if (!state || typeof state !== "object") return false;
    this.livePreview = !!state.livePreview;
    this.suspended = !!state.suspended;
    this.tracking = !!state.tracking;
    this.confidence = Math.max(0, Math.min(1, Number(state.confidence) || 0));
    this.values.fill(0); this.raw.fill(0);
    if (state.values) this.values.set(state.values.subarray?.(0, this.values.length) || state.values);
    if (state.raw) this.raw.set(state.raw.subarray?.(0, this.raw.length) || state.raw);
    this.filters.restoreTransientState(state.filters);
    this.recording = !!state.recording;
    this.recordStart = Number(state.recordStart) || 0;
    this.lastTime = Number(state.lastTime) || 0;
    this.headRotation.fill(0); this.headRotation[3] = 1;
    if (state.headRotation) this.headRotation.set(state.headRotation.subarray?.(0, 4) || state.headRotation);
    if (Number.isInteger(state.frameCount) && this.frames.length > state.frameCount) this.frames.length = state.frameCount;
    return true;
  }

  resetTransientState() {
    // Keep the camera/backend alive, but fence asynchronous capture input out
    // of deterministic export evaluation and prevent recording extra frames.
    this.livePreview = false;
    this.suspended = true;
    this.tracking = false;
    this.recording = false;
    this.confidence = 0;
    this.values.fill(0); this.raw.fill(0);
    this.filters.reset();
    this.headRotation.fill(0); this.headRotation[3] = 1;
  }

  toJSON() { return { enabled: this.enabled, neutral: Array.from(this.neutral), maximum: Array.from(this.maximum), frames: this.frames.map((frame) => ({ ...frame, values: frame.values.slice(), headRotation: frame.headRotation.slice() })) }; }
  restore(data) { if (!data) return false; this.enabled = data.enabled !== false; if (Array.isArray(data.neutral)) this.neutral.set(data.neutral.slice(0, this.neutral.length)); if (Array.isArray(data.maximum)) this.maximum.set(data.maximum.slice(0, this.maximum.length)); this.loadRecording(data.frames || []); this.livePreview = false; this.tracking = false; return true; }
}
