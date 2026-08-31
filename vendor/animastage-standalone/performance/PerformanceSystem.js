import { PERFORMANCE_SYSTEM_VERSION } from "./PerformanceConstants.js";
import { HandPoseController } from "./HandPoseController.js";
import { PerformanceMappingCache } from "./PerformanceMappingCache.js";
import { PerformanceStack } from "./PerformanceStack.js";
import { UniversalPerformanceRigMapper } from "./UniversalPerformanceRigMapper.js";
import { UniversalFacialRig } from "./UniversalFacialRig.js";
import { FacialExpressionController } from "./FacialExpressionController.js";
import { EmotionController } from "./EmotionController.js";
import { GazeController } from "./GazeController.js";
import { BlinkController } from "./BlinkController.js";
import { MicroExpressionEngine } from "./MicroExpressionEngine.js?v=perf10";
import { LipSyncController } from "./LipSyncController.js";
import { AutoGripSolver } from "./AutoGripSolver.js?v=perf15";
import { PerformanceTimeline } from "./PerformanceTimeline.js";
import { FaceCapture } from "./FaceCapture.js";
import { HandCapture } from "./HandCapture.js";
import { PerformanceCaptureController } from "./PerformanceCaptureController.js?v=perf11";
import { PerformanceDirector } from "./PerformanceDirector.js";
import { ManualCorrectionController } from "./ManualCorrectionController.js";
import { PerformanceBaker } from "./PerformanceBaker.js";
import { EyeAppearanceController } from "./EyeAppearanceController.js";
import { ModelMorphRegistry } from "./ModelMorphRegistry.js";
import {
  captureCharacterPerformanceState,
  resetCharacterPerformanceForOffline,
  restoreCharacterPerformanceState,
} from "./PerformanceTransientState.js";

class CharacterPerformanceRuntime {
  constructor(mesh, profile, options = {}) {
    this.mesh = mesh;
    this.profile = profile;
    this.morphRegistry = new ModelMorphRegistry(mesh, {
      fingerprint: profile.fingerprint,
      settings: options.morphRegistrySettings,
    });
    this.stack = new PerformanceStack();
    this.hands = new HandPoseController(mesh, profile);
    this.facialRig = new UniversalFacialRig(mesh, profile, this.morphRegistry);
    this.expressions = new FacialExpressionController(this.facialRig);
    this.emotions = new EmotionController(this.facialRig);
    this.gaze = new GazeController(mesh, profile, options);
    this.blink = new BlinkController(this.facialRig);
    this.microExpressions = new MicroExpressionEngine(this.facialRig);
    this.lipSync = new LipSyncController(this.facialRig);
    this.eyeAppearance = new EyeAppearanceController(mesh, profile, this.facialRig);
    this.autoGrip = new AutoGripSolver(mesh, profile, this.hands, {
      getSelectedObject: options.getSelectedObject,
      solveHandController: options.solveHandController,
      resolveObject: options.resolveObject,
      attachTargetToHand: options.attachTargetToHand,
      detachTargetFromHand: options.detachTargetFromHand,
    });
    this.timeline = new PerformanceTimeline(this, { getTimelineBridge: options.getTimelineBridge });
    this.faceCapture = new FaceCapture(this.facialRig);
    this.handCapture = new HandCapture(this.hands);
    this.capture = new PerformanceCaptureController(this.faceCapture, this.handCapture, this.stack);
    this.director = new PerformanceDirector(this);
    this.manualCorrections = new ManualCorrectionController(this.facialRig, this.morphRegistry);
    this.baker = new PerformanceBaker(this, { sampleBasePose: options.sampleBasePose, getDuration: options.getDuration });
    this.stack.setEvaluator("handPose", (layer, _deltaTime, time) => this.hands.evaluate(layer, time));
    this.stack.setEvaluator("facialBase", (layer, _deltaTime, time) => this.expressions.evaluate(layer, time));
    this.stack.setEvaluator("emotion", (layer, _deltaTime, time) => this.emotions.evaluate(layer, time));
    this.stack.setEvaluator("speech", (layer, deltaTime, time) => this.lipSync.evaluate(layer, deltaTime, time));
    this.stack.setEvaluator("eyeAppearance", (layer, deltaTime, time) => this.eyeAppearance.evaluate(layer, deltaTime, time));
    this.stack.setEvaluator("gaze", (layer, deltaTime, time) => this.gaze.evaluate(layer, deltaTime, time));
    this.stack.setEvaluator("blink", (layer, deltaTime, time) => this.blink.evaluate(layer, deltaTime, time));
    this.stack.setEvaluator("microExpression", (layer, deltaTime, time) => this.microExpressions.evaluate(layer, deltaTime, time));
    this.stack.setEvaluator("capture", (layer, deltaTime, time) => this.faceCapture.evaluate(layer, deltaTime, time));
    this.stack.setEvaluator("manualCorrection", (layer, _deltaTime, time) => this.manualCorrections.evaluate(layer, time));
  }

  beginFrame() { this.hands.beginFrame(); this.gaze.beginFrame(); this.eyeAppearance.beginFrame(); this.facialRig.beginFrame(); }
  update(deltaTime, time, options = {}) {
    // Auto Grip owns attachments and can invoke Smart Pose/physics ownership.
    // Offline sampling must be side-effect free, so the render coordinator can
    // explicitly suppress it while still evaluating face, gaze and fingers.
    if (options.updateAutoGrip !== false) this.autoGrip.update();
    const eb = this.expressions.behavior;
    const mb = this.emotions.behavior;
    this.blink.behavior.blinkRate = (eb.blinkRate || 1) * (mb.blinkRate || 1);
    this.blink.behavior.fatigue = Math.max(eb.fatigue || 0, mb.fatigue || 0);
    this.blink.behavior.tension = Math.max(eb.tension || 0, mb.tension || 0);
    this.microExpressions.tension = this.blink.behavior.tension;
    this.microExpressions.fatigue = this.blink.behavior.fatigue;
    this.microExpressions.speaking = this.lipSync.previewPlaying ? 1 : 0;
    this.facialRig.prepareFrame();
    this.stack.evaluate(deltaTime, time);
    this.facialRig.finishFrame();
  }
  captureTransientState() {
    return captureCharacterPerformanceState(this);
  }
  restoreTransientState(state) {
    return restoreCharacterPerformanceState(this, state);
  }
  resetTransientState() {
    resetCharacterPerformanceForOffline(this);
  }
  dispose() { this._morphRegistryUnsubscribe?.(); this.capture.dispose(); this.timeline.dispose(); this.autoGrip.dispose(); this.hands.beginFrame(); this.gaze.beginFrame(); this.eyeAppearance.dispose(); this.facialRig.beginFrame(); }

  toJSON() {
    return {
      performanceSystemVersion: PERFORMANCE_SYSTEM_VERSION,
      fingerprint: this.profile.fingerprint,
      layers: this.stack.toJSON(),
      hands: this.hands.toJSON(),
      expressions: this.expressions.toJSON(),
      emotions: this.emotions.toJSON(),
      gaze: this.gaze.toJSON(),
      blink: this.blink.toJSON(),
      microExpressions: this.microExpressions.toJSON(),
      lipSync: this.lipSync.toJSON(),
      eyeAppearance: this.eyeAppearance.toJSON(),
      autoGrip: this.autoGrip.toJSON(),
      capture: this.capture.toJSON(),
      director: this.director.toJSON(),
      manualCorrections: this.manualCorrections.toJSON(),
      morphRegistry: this.morphRegistry.toJSON(),
      timeline: this.timeline.toJSON(),
    };
  }

  restore(data) {
    if (!data || data.performanceSystemVersion !== PERFORMANCE_SYSTEM_VERSION) return false;
    // Restoring controller values emits their normal change events. Fence the
    // semantic Auto-key listeners so loading a project never creates surprise
    // keys at the current playhead.
    this.timeline._restoring = true;
    try {
      this.stack.restore(data.layers);
      this.hands.restore(data.hands);
      this.expressions.restore(data.expressions);
      this.emotions.restore(data.emotions);
      this.gaze.restore(data.gaze);
      this.blink.restore(data.blink);
      this.microExpressions.restore(data.microExpressions);
      this.lipSync.restore(data.lipSync);
      this.eyeAppearance.restore(data.eyeAppearance);
      this.autoGrip.restore(data.autoGrip);
      this.capture.restore(data.capture);
      this.director.restore(data.director);
      // Restore registry policy first so manual values are clamped against the
      // model/user limits that were saved with this project.
      this.morphRegistry.restore(data.morphRegistry);
      this.manualCorrections.restore(data.manualCorrections);
    } finally {
      this.timeline._restoring = false;
    }
    this.timeline.restore(data.timeline);
    return true;
  }
}

export class PerformanceSystem {
  constructor(options = {}) {
    this.getMeshes = options.getMeshes || (() => []);
    this.getActiveMesh = options.getActiveMesh || (() => null);
    this.getTime = options.getTime || (() => 0);
    this.getCamera = options.getCamera || (() => null);
    this.getSelectedObject = options.getSelectedObject || (() => null);
    this.addBakedClip = options.addBakedClip || (() => false);
    this.solveHandController = options.solveHandController || (() => false);
    this.attachTargetToHand = options.attachTargetToHand || (() => ({ ok: false, reason: "attachment-unavailable" }));
    this.detachTargetFromHand = options.detachTargetFromHand || (() => false);
    this.getTimelineBridge = options.getTimelineBridge || (() => null);
    this.resolveObject = options.resolveObject || (() => null);
    this.sampleBasePose = options.sampleBasePose || ((_mesh, _time, read) => read());
    this.getDuration = options.getDuration || (() => 0);
    this.mapper = options.mapper || new UniversalPerformanceRigMapper();
    this.mappingCache = options.mappingCache || new PerformanceMappingCache();
    this.runtimes = new WeakMap();
    this.runtimeSet = new Set();
    this.listeners = new Set();
    this.enabled = true;
  }

  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  _emit(reason, runtime = null) { for (const listener of this.listeners) { try { listener(reason, runtime); } catch (_) {} } }

  _liveMeshes() {
    const list = this.getMeshes?.() || [];
    return list.filter((mesh) => mesh?.skeleton?.bones?.length);
  }

  attach(mesh) {
    if (!mesh?.skeleton?.bones?.length) return null;
    let runtime = this.runtimes.get(mesh);
    if (runtime) return runtime;
    const firstProfile = this.mapper.map(mesh);
    const overrides = this.mappingCache.get(firstProfile.fingerprint);
    const profile = overrides ? this.mapper.map(mesh, { overrides }) : firstProfile;
    runtime = new CharacterPerformanceRuntime(mesh, profile, {
      getCamera: this.getCamera,
      getSelectedObject: this.getSelectedObject,
      solveHandController: this.solveHandController,
      attachTargetToHand: this.attachTargetToHand,
      detachTargetFromHand: this.detachTargetFromHand,
      getTimelineBridge: this.getTimelineBridge,
      resolveObject: this.resolveObject,
      sampleBasePose: this.sampleBasePose,
      getDuration: this.getDuration,
      morphRegistrySettings: overrides?.morphRegistry?.settings || overrides?.morphRegistry,
    });
    runtime._morphRegistryUnsubscribe = runtime.morphRegistry.onChange(() => {
      const cached = this.mappingCache.get(profile.fingerprint) || {};
      this.mappingCache.set(profile.fingerprint, {
        ...cached,
        morphRegistry: runtime.morphRegistry.toJSON(),
      });
      this._emit("morph-registry-changed", runtime);
    });
    this.runtimes.set(mesh, runtime);
    this.runtimeSet.add(runtime);
    this._emit("attached", runtime);
    return runtime;
  }

  detach(mesh) {
    const runtime = this.runtimes.get(mesh);
    if (!runtime) return false;
    runtime.dispose();
    this.runtimeSet.delete(runtime);
    this.runtimes.delete(mesh);
    this._emit("detached", runtime);
    return true;
  }

  _synchronizeRuntimes() {
    const live = new Set(this._liveMeshes());
    for (const mesh of live) this.attach(mesh);
    for (const runtime of [...this.runtimeSet]) if (!live.has(runtime.mesh)) this.detach(runtime.mesh);
  }

  beginFrame() {
    this._synchronizeRuntimes();
    for (const runtime of this.runtimeSet) runtime.beginFrame();
  }

  update(deltaTime = 0, explicitTime = undefined, options = {}) {
    if (!this.enabled) return;
    this._synchronizeRuntimes();
    const hasExplicitTime = Number.isFinite(Number(explicitTime));
    for (const runtime of this.runtimeSet) {
      const time = hasExplicitTime
        ? Number(explicitTime)
        : (Number(this.getTime?.(runtime.mesh)) || 0);
      runtime.update(deltaTime, time, options);
    }
  }

  /**
   * Deterministic timeline evaluation for offline rendering and baking.
   * Unlike update(), this never infers time from the visible UI timeline or an
   * active character, so face/finger-only projects cannot get stuck at a stale
   * BONE.time while the video playhead advances.
   */
  updateAt(deltaTime = 0, time = 0, options = {}) {
    if (!this.enabled) return;
    this._synchronizeRuntimes();
    const selected = options.meshes
      ? new Set(options.meshes)
      : null;
    const exactTime = Math.max(0, Number(time) || 0);
    for (const runtime of this.runtimeSet) {
      if (selected && !selected.has(runtime.mesh)) continue;
      runtime.update(deltaTime, exactTime, options);
    }
  }

  /**
   * Evaluate each selected character at its own already-sampled animation time.
   * Live multi-character scenes do not have one meaningful post-animation
   * timestamp: clips can be paused, offset or time-scaled independently.  This
   * API therefore consumes an explicit mesh -> time table and never consults
   * the active-character/UI clock for those runtimes.
   */
  updateAtTimes(deltaTime = 0, meshTimes = [], options = {}) {
    if (!this.enabled) return 0;
    this._synchronizeRuntimes();
    const entries = meshTimes instanceof Map
      ? [...meshTimes.entries()]
      : Array.isArray(meshTimes)
        ? meshTimes.map((entry) => Array.isArray(entry)
          ? entry
          : [entry?.mesh, entry?.time])
        : null;
    if (!entries) {
      throw new TypeError("meshTimes must be a Map or an array of [mesh, time] / { mesh, time } entries");
    }
    const exactTimes = new Map();
    for (const [mesh, value] of entries) {
      if (!mesh) continue;
      const time = Number(value);
      if (!Number.isFinite(time) || time < 0) {
        throw new RangeError("every explicit performance time must be finite and non-negative");
      }
      exactTimes.set(mesh, time);
    }
    let updated = 0;
    for (const runtime of this.runtimeSet) {
      if (!exactTimes.has(runtime.mesh)) continue;
      runtime.update(deltaTime, exactTimes.get(runtime.mesh), options);
      updated += 1;
    }
    return updated;
  }

  captureTransientState() {
    this._synchronizeRuntimes();
    return {
      restored: false,
      runtimes: [...this.runtimeSet].map((runtime) => ({
        runtime,
        mesh: runtime.mesh,
        state: runtime.captureTransientState(),
      })),
    };
  }

  restoreTransientState(snapshot) {
    if (!snapshot || snapshot.restored) return false;
    for (const entry of snapshot.runtimes || []) {
      const runtime = this.runtimes.get(entry.mesh);
      if (runtime && runtime === entry.runtime) runtime.restoreTransientState(entry.state);
    }
    snapshot.restored = true;
    return true;
  }

  beginOfflineEvaluation() {
    const snapshot = this.captureTransientState();
    for (const runtime of this.runtimeSet) runtime.resetTransientState();
    return snapshot;
  }

  endOfflineEvaluation(snapshot) {
    return this.restoreTransientState(snapshot);
  }

  getRuntime(mesh) { return mesh ? (this.runtimes.get(mesh) || this.attach(mesh)) : null; }
  getActiveRuntime() { return this.getRuntime(this.getActiveMesh?.()); }
  getActiveProfile() { return this.getActiveRuntime()?.profile || null; }
  getActiveHands() { return this.getActiveRuntime()?.hands || null; }
  notifyActiveRuntimeChanged() {
    const runtime = this.getActiveRuntime();
    this._emit("active-runtime-changed", runtime);
    return runtime;
  }

  setMappingOverrides(mesh, overrides) {
    if (!mesh) return false;
    const old = this.getRuntime(mesh);
    const fingerprint = old?.profile?.fingerprint || this.mapper.map(mesh).fingerprint;
    if (!this.mappingCache.set(fingerprint, overrides)) return false;
    if (old) {
      const state = old.toJSON();
      old.dispose();
      this.runtimeSet.delete(old);
      this.runtimes.delete(mesh);
      const next = this.attach(mesh);
      next?.restore(state);
      this._emit("mapping-changed", next);
    }
    return true;
  }

  serializeForMesh(mesh) { return this.getRuntime(mesh)?.toJSON() || null; }
  restoreForMesh(mesh, data) { return this.getRuntime(mesh)?.restore(data) || false; }

  resetActiveHands(side = "both") {
    const hands = this.getActiveHands();
    if (!hands) return false;
    hands.reset(side);
    this._emit("hands-reset", this.getActiveRuntime());
    return true;
  }

  solveActiveGrip(options = {}) {
    const runtime = this.getActiveRuntime();
    if (!runtime) return { ok: false, message: "No active character." };
    runtime.timeline.checkpoint();
    const result = runtime.autoGrip.solve(options);
    if (!result.ok) runtime.timeline.discardCheckpoint();
    if (result.ok && runtime.timeline.handAutoKeyEnabled()) runtime.timeline.keyHand(options.side === "right" ? "right" : "left", false);
    this._emit("auto-grip", runtime);
    return result;
  }

  releaseActiveGrip() {
    const runtime = this.getActiveRuntime();
    if (!runtime) return false;
    runtime.timeline.checkpoint(); runtime.autoGrip.release();
    this._emit("auto-grip-release", runtime);
    return true;
  }

  bakeActiveLipSync(name = "Lip Sync") {
    const runtime = this.getActiveRuntime();
    if (!runtime) return false;
    const clip = runtime.lipSync.buildMorphClip(name);
    return !!clip && !!this.addBakedClip(runtime.mesh, clip, name);
  }

  bakeActivePerformance(name = "Baked Performance", options = {}) {
    const runtime = this.getActiveRuntime(); if (!runtime) return false;
    const clip = runtime.baker.buildAll(name, options);
    return !!clip && !!this.addBakedClip(runtime.mesh, clip, name);
  }

  exportActivePerformanceVmd(name = "Baked Performance", options = {}) {
    const runtime = this.getActiveRuntime(); return runtime?.baker.exportVmd(name, options) || null;
  }

  getActiveMorphExportReport() {
    return this.getActiveRuntime()?.baker.morphExportReport() || null;
  }
}

export function createPerformanceSystem(options) { return new PerformanceSystem(options); }
