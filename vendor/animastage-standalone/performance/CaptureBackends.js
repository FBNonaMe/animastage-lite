export class PrerecordedCaptureBackend {
  constructor(frames = []) { this.frames = Array.isArray(frames) ? frames.slice().sort((a, b) => a.time - b.time) : []; this.index = 0; }
  reset() { this.index = 0; }
  sample(time) { while (this.index + 1 < this.frames.length && this.frames[this.index + 1].time <= time) this.index++; return this.frames[this.index] || null; }
}

export class MediaPipeVisionBackend {
  constructor(kind = "face") {
    this.kind = kind === "hand" ? "hand" : "face";
    this.detector = null; this.stream = null; this.video = null; this.running = false; this.callbackId = 0; this.lastDetectMs = -Infinity;
    this.maxFps = 30; this.onFrame = null; this.onError = null;
  }

  async initialize(modelSource, options = {}) {
    const modelAssetBuffer = modelSource?.modelAssetBuffer ?? options.modelAssetBuffer;
    const modelAssetPath = typeof modelSource === "string" ? modelSource : (modelSource?.modelAssetPath ?? options.modelAssetPath);
    if (!modelAssetPath && !modelAssetBuffer) throw new Error(`A MediaPipe ${this.kind} landmarker .task model is required.`);
    await this.closeDetector();
    const vision = await import("../vendor/mediapipe/vision_bundle.js");
    const wasmBase = new URL("../vendor/mediapipe/wasm", import.meta.url).href;
    const fileset = await vision.FilesetResolver.forVisionTasks(wasmBase);
    const baseOptions = { delegate: options.delegate || "GPU" };
    if (modelAssetBuffer) baseOptions.modelAssetBuffer = modelAssetBuffer instanceof Uint8Array ? modelAssetBuffer : new Uint8Array(modelAssetBuffer);
    else baseOptions.modelAssetPath = modelAssetPath;
    if (this.kind === "face") {
      this.detector = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions, runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: options.minConfidence ?? 0.45, minFacePresenceConfidence: options.minConfidence ?? 0.45,
      });
    } else {
      this.detector = await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions, runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: options.minConfidence ?? 0.42,
        minHandPresenceConfidence: options.minConfidence ?? 0.42, minTrackingConfidence: options.minConfidence ?? 0.42,
      });
    }
    return true;
  }

  async start(video, options = {}) {
    if (!this.detector) await this.initialize(options.modelSource ?? options.modelAssetPath, options);
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Webcam capture is not supported by this browser.");
    this.stopCamera(); this.video = video; this.maxFps = Math.max(5, Math.min(60, Number(options.maxFps) || 30));
    this.onFrame = options.onFrame || null; this.onError = options.onError || null;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: this.maxFps }, facingMode: "user" }, audio: false });
      video.srcObject = this.stream; video.muted = true; video.playsInline = true; await video.play();
      this.running = true; this.lastDetectMs = -Infinity; this._schedule(); return true;
    } catch (error) {
      this.stopCamera();
      if (error?.name === "NotAllowedError") throw new Error("Webcam permission was denied.");
      if (error?.name === "NotFoundError") throw new Error("No webcam was found.");
      throw error;
    }
  }

  _schedule() {
    if (!this.running || !this.video) return;
    const callback = (_now, metadata = {}) => {
      if (!this.running) return;
      const timestampMs = Number(metadata.mediaTime) * 1000 || performance.now();
      if (timestampMs - this.lastDetectMs >= 1000 / this.maxFps) { this.lastDetectMs = timestampMs; this._detect(timestampMs); }
      this._schedule();
    };
    if (this.video.requestVideoFrameCallback) this.callbackId = this.video.requestVideoFrameCallback(callback);
    else this.callbackId = requestAnimationFrame((now) => callback(now, { mediaTime: this.video.currentTime }));
  }

  _detect(timestampMs) {
    try {
      const result = this.detector.detectForVideo(this.video, timestampMs);
      if (this.kind === "face") {
        const categories = result.faceBlendshapes?.[0]?.categories || [];
        const confidence = categories.length ? categories.reduce((sum, item) => sum + (Number(item.score) || 0), 0) / categories.length : 0;
        const matrix = result.facialTransformationMatrixes?.[0]?.data;
        this.onFrame?.({ time: timestampMs / 1000, confidence: Math.max(0.1, confidence), coefficients: categories, headMatrix: matrix ? Array.from(matrix) : null });
      } else {
        const hands = [];
        for (let i = 0; i < (result.landmarks?.length || 0); i++) {
          const handed = result.handednesses?.[i]?.[0] || {};
          hands.push({ landmarks: result.landmarks[i], worldLandmarks: result.worldLandmarks?.[i], handedness: handed.categoryName || handed.displayName || "left", confidence: Number(handed.score) || 0.75 });
        }
        this.onFrame?.({ time: timestampMs / 1000, hands });
      }
    } catch (error) { this.onError?.(error); }
  }

  stopCamera() {
    this.running = false;
    if (this.video?.cancelVideoFrameCallback && this.callbackId) this.video.cancelVideoFrameCallback(this.callbackId);
    else if (this.callbackId) cancelAnimationFrame(this.callbackId);
    this.callbackId = 0;
    if (this.stream) for (const track of this.stream.getTracks()) track.stop();
    if (this.video) { try { this.video.pause(); this.video.srcObject = null; } catch (_) {} }
    this.stream = null; this.video = null;
  }

  async closeDetector() { if (this.detector?.close) { try { this.detector.close(); } catch (_) {} } this.detector = null; }
  async dispose() { this.stopCamera(); await this.closeDetector(); }
}
