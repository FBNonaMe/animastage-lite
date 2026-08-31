import { FINGER_NAMES } from "./PerformanceConstants.js";
import { reduceCaptureKeys } from "./CaptureFilters.js";

const CHAINS = Object.freeze({ thumb: [1, 2, 3, 4], index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], little: [17, 18, 19, 20] });
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
function angle(a, b, c) {
  const abx = a.x - b.x, aby = a.y - b.y, abz = (a.z || 0) - (b.z || 0);
  const cbx = c.x - b.x, cby = c.y - b.y, cbz = (c.z || 0) - (b.z || 0);
  const denom = Math.hypot(abx, aby, abz) * Math.hypot(cbx, cby, cbz);
  return denom < 1e-8 ? Math.PI : Math.acos(clamp((abx * cbx + aby * cby + abz * cbz) / denom, -1, 1));
}
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)); }

export class HandCapture {
  constructor(hands) {
    this.hands = hands; this.enabled = true; this.livePreview = false; this.mirror = true; this.tracking = { left: false, right: false };
    this.suspended = false;
    this.confidence = { left: 0, right: 0 }; this.semantic = { left: null, right: null };
    this.recording = false; this.recordStart = 0; this.frames = []; this.lastTime = 0; this.lastGesture = { left: "none", right: "none" };
  }

  _semanticFromLandmarks(landmarks) {
    if (!Array.isArray(landmarks) || landmarks.length < 21) return null;
    const fingers = {}, curls = [];
    for (const digit of FINGER_NAMES) {
      const chain = CHAINS[digit], root = digit === "thumb" ? landmarks[0] : landmarks[0];
      const proximal = 1 - angle(root, landmarks[chain[0]], landmarks[chain[1]]) / Math.PI;
      const middle = 1 - angle(landmarks[chain[0]], landmarks[chain[1]], landmarks[chain[2]]) / Math.PI;
      const distal = 1 - angle(landmarks[chain[1]], landmarks[chain[2]], landmarks[chain[3]]) / Math.PI;
      const curl = clamp(proximal * 0.35 + middle * 0.4 + distal * 0.25);
      fingers[digit] = { curl, spread: 0, twist: 0, proximal: 0, middle: 0, distal: 0 }; curls.push(curl);
    }
    const palmWidth = Math.max(1e-5, distance(landmarks[5], landmarks[17]));
    const middleX = landmarks[9].x;
    for (const [digit, index] of [["index", 5], ["middle", 9], ["ring", 13], ["little", 17]]) fingers[digit].spread = clamp((landmarks[index].x - middleX) / palmWidth, -1, 1) * 0.55;
    const opposition = clamp(1 - distance(landmarks[4], landmarks[5]) / (palmWidth * 1.35));
    const average = curls.reduce((sum, value) => sum + value, 0) / curls.length;
    return { master: { curl: 0, spread: 0, relax: 0, tension: clamp(Math.abs(curls[1] - curls[4]) * 0.4), cup: clamp((curls[3] + curls[4]) * 0.25), fan: 0, thumbOpposition: opposition, thumbCurl: fingers.thumb.curl * 0.25, palmArch: 0, wristBend: 0, wristTwist: 0, wristSideBend: 0 }, fingers, average };
  }

  _gesture(semantic) {
    if (!semantic) return "none";
    const f = semantic.fingers;
    if (semantic.average < 0.16) return "open_palm";
    if (semantic.average > 0.72) return "fist";
    if (f.index.curl < 0.25 && f.middle.curl > 0.55 && f.ring.curl > 0.55 && f.little.curl > 0.55) return "pointing";
    if (f.index.curl < 0.3 && f.middle.curl < 0.3 && f.ring.curl > 0.52 && f.little.curl > 0.52) return "peace_sign";
    if (f.thumb.curl < 0.35 && f.index.curl > 0.58 && f.middle.curl > 0.58) return "thumbs_up";
    if (semantic.master.thumbOpposition > 0.72 && f.index.curl < 0.5) return "pinch";
    return "custom";
  }

  ingestFrame(frame = {}) {
    if (this.suspended) return false;
    const time = Number.isFinite(frame.time) ? frame.time : performance.now() / 1000;
    const detected = Array.isArray(frame.hands) ? frame.hands : [];
    this.tracking.left = false; this.tracking.right = false;
    for (const item of detected) {
      let side = String(item.handedness || item.side || "left").toLowerCase().includes("right") ? "right" : "left";
      if (this.mirror) side = side === "left" ? "right" : "left";
      const confidence = clamp(Number(item.confidence) || 0);
      if (confidence < 0.08) continue;
      const semantic = this._semanticFromLandmarks(item.worldLandmarks || item.landmarks); if (!semantic) continue;
      this.semantic[side] = semantic; this.tracking[side] = true; this.confidence[side] = confidence; this.lastGesture[side] = this._gesture(semantic);
      if (this.enabled && this.livePreview) this._apply(side, semantic);
    }
    this.lastTime = time;
    if (this.recording) this.frames.push({ time: time - this.recordStart, left: this.tracking.left ? this._flat(this.semantic.left) : null, right: this.tracking.right ? this._flat(this.semantic.right) : null });
    return this.tracking.left || this.tracking.right;
  }

  _apply(side, semantic) {
    this.hands.runSilently(() => {
      for (const [key, value] of Object.entries(semantic.master)) this.hands.setMaster(side, key, value, { mirror: false });
      for (const digit of FINGER_NAMES) for (const [key, value] of Object.entries(semantic.fingers[digit])) this.hands.setFinger(side, digit, key, value, { mirror: false });
    });
  }
  _flat(semantic) { const out = {}; for (const [key, value] of Object.entries(semantic.master)) out[`master.${key}`] = value; for (const digit of FINGER_NAMES) for (const [key, value] of Object.entries(semantic.fingers[digit])) out[`${digit}.${key}`] = value; return out; }
  startRecording(time = this.lastTime || performance.now() / 1000) { this.frames.length = 0; this.recordStart = time; this.recording = true; this.livePreview = true; }
  stopRecording(layer, options = {}) { this.recording = false; return this.bakeRecording(layer, options); }
  bakeRecording(layer, options = {}) {
    if (!layer || !this.frames.length) return false;
    const offset = Math.max(0, Number(options.offset) || 0), tolerance = Math.max(0.0001, Number(options.tolerance) || 0.006);
    for (const side of ["left", "right"]) {
      const channels = new Set(); for (const frame of this.frames) for (const channel of Object.keys(frame[side] || {})) channels.add(channel);
      for (const channel of channels) {
        const keys = []; let held = 0;
        for (const frame of this.frames) { if (Number.isFinite(frame[side]?.[channel])) held = frame[side][channel]; keys.push({ time: frame.time + offset, value: held }); }
        for (const key of reduceCaptureKeys(keys, tolerance)) layer.setKey(`${side}.${channel}`, key.time, key.value, "smooth");
      }
    }
    return true;
  }
  loadRecording(frames) { if (!Array.isArray(frames)) return false; this.frames = frames.filter((frame) => Number.isFinite(frame?.time)).map((frame) => ({ time: Math.max(0, frame.time), left: frame.left && { ...frame.left }, right: frame.right && { ...frame.right } })); return this.frames.length > 0; }
  captureTransientState() {
    return {
      livePreview: this.livePreview,
      suspended: this.suspended,
      tracking: { ...this.tracking },
      confidence: { ...this.confidence },
      semantic: {
        left: this.semantic.left ? structuredClone(this.semantic.left) : null,
        right: this.semantic.right ? structuredClone(this.semantic.right) : null,
      },
      recording: this.recording,
      recordStart: this.recordStart,
      lastTime: this.lastTime,
      lastGesture: { ...this.lastGesture },
      frameCount: this.frames.length,
    };
  }
  restoreTransientState(state) {
    if (!state || typeof state !== "object") return false;
    this.livePreview = !!state.livePreview;
    this.suspended = !!state.suspended;
    this.tracking = { left: !!state.tracking?.left, right: !!state.tracking?.right };
    this.confidence = { left: Number(state.confidence?.left) || 0, right: Number(state.confidence?.right) || 0 };
    this.semantic = {
      left: state.semantic?.left ? structuredClone(state.semantic.left) : null,
      right: state.semantic?.right ? structuredClone(state.semantic.right) : null,
    };
    this.recording = !!state.recording;
    this.recordStart = Number(state.recordStart) || 0;
    this.lastTime = Number(state.lastTime) || 0;
    this.lastGesture = { left: state.lastGesture?.left || "none", right: state.lastGesture?.right || "none" };
    if (Number.isInteger(state.frameCount) && this.frames.length > state.frameCount) this.frames.length = state.frameCount;
    return true;
  }
  resetTransientState() {
    this.livePreview = false;
    this.suspended = true;
    this.tracking = { left: false, right: false };
    this.confidence = { left: 0, right: 0 };
    this.recording = false;
    this.lastGesture = { left: "none", right: "none" };
  }
  toJSON() { return { enabled: this.enabled, mirror: this.mirror, frames: this.frames.map((frame) => ({ time: frame.time, left: frame.left && { ...frame.left }, right: frame.right && { ...frame.right } })) }; }
  restore(data) { if (!data) return false; this.enabled = data.enabled !== false; this.mirror = data.mirror !== false; this.loadRecording(data.frames || []); this.recording = false; this.livePreview = false; return true; }
}
