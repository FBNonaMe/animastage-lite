import { MediaPipeVisionBackend } from "./CaptureBackends.js?v=perf11";

export class PerformanceCaptureController {
  constructor(faceCapture, handCapture, stack) {
    this.face = faceCapture; this.hand = handCapture; this.stack = stack;
    this.backend = null; this.activeKind = null; this.lastError = "";
  }

  async startCamera(kind, video, modelSource, options = {}) {
    await this.stopCamera(); this.lastError = ""; this.activeKind = kind === "hand" ? "hand" : "face";
    const backend = new MediaPipeVisionBackend(this.activeKind); this.backend = backend;
    const onFrame = this.activeKind === "face" ? (frame) => this.face.ingestFrame(frame) : (frame) => this.hand.ingestFrame(frame);
    try {
      await backend.start(video, { ...options, modelSource, onFrame, onError: (error) => { this.lastError = error?.message || String(error); } });
      if (this.activeKind === "face") this.face.livePreview = true; else this.hand.livePreview = true;
      return true;
    } catch (error) { this.lastError = error?.message || String(error); await this.stopCamera(); throw error; }
  }

  async stopCamera() {
    if (this.backend) await this.backend.dispose();
    this.backend = null; this.activeKind = null; this.face.livePreview = false; this.hand.livePreview = false;
  }

  startRecording(kind, time = undefined) {
    if (kind === "hand") this.hand.startRecording(time); else this.face.startRecording(time);
    return true;
  }

  stopRecording(kind, options = {}) {
    return kind === "hand"
      ? this.hand.stopRecording(this.stack.get("handPose"), options)
      : this.face.stopRecording(this.stack.get("capture"), options);
  }

  loadRecording(kind, data, options = {}) {
    const capture = kind === "hand" ? this.hand : this.face;
    const layer = this.stack.get(kind === "hand" ? "handPose" : "capture");
    return capture.loadRecording(data) && capture.bakeRecording(layer, options);
  }

  captureTransientState() {
    return {
      activeKind: this.activeKind,
      lastError: this.lastError,
      face: this.face.captureTransientState(),
      hand: this.hand.captureTransientState(),
    };
  }
  restoreTransientState(state) {
    if (!state || typeof state !== "object") return false;
    // Backend identity/lifetime is intentionally not changed by a render.
    this.activeKind = state.activeKind === "face" || state.activeKind === "hand" ? state.activeKind : null;
    this.lastError = String(state.lastError || "");
    this.face.restoreTransientState(state.face);
    this.hand.restoreTransientState(state.hand);
    return true;
  }
  resetTransientState() {
    this.face.resetTransientState();
    this.hand.resetTransientState();
  }

  toJSON() { return { face: this.face.toJSON(), hand: this.hand.toJSON() }; }
  restore(data) { if (!data) return false; this.face.restore(data.face); this.hand.restore(data.hand); return true; }
  dispose() { return this.stopCamera(); }
}
