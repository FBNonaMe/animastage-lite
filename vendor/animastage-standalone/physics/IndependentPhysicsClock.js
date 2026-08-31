/**
 * Frame-rate independent clock for the Reze/MMD physics world.
 *
 * Physics state and Three.js bones cannot be transferred safely to a Worker,
 * but the authoritative wall clock can live there.  The worker emits timing
 * pulses while the renderer is busy; the main thread drains those pulses as a
 * bounded number of fixed Reze steps. Offline rendering bypasses wall time
 * completely and advances an exact deterministic number of fixed steps.
 */
export class IndependentPhysicsClock {
  constructor(options = {}) {
    this.rate = this._clampRate(options.rate ?? 65);
    this.fixedStep = 1 / this.rate;
    this.maxCatchUpSteps = this._clampInt(options.maxCatchUpSteps ?? 8, 1, 32);
    this.maxBacklogSeconds = this._clamp(options.maxBacklogSeconds ?? 0.25, 0.05, 1);
    this.accumulator = 0;
    this.offlineAccumulator = 0;
    this.workerPending = 0;
    this.workerReady = false;
    this.worker = null;
    this.running = false;
    this.lastPulseAt = 0;
    this.stats = {
      mode: "realtime",
      source: "frame",
      rate: this.rate,
      fixedStep: this.fixedStep,
      steps: 0,
      totalSteps: 0,
      backlog: 0,
      droppedSeconds: 0,
      overloads: 0,
      workerPulses: 0,
    };
    if (options.useWorker !== false) this.startWorker();
  }

  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || min));
  }

  _clampInt(value, min, max) {
    return Math.round(this._clamp(value, min, max));
  }

  _clampRate(value) {
    return this._clamp(value, 30, 240);
  }

  configure(options = {}) {
    const previousStep = this.fixedStep;
    if (options.rate != null) this.rate = this._clampRate(options.rate);
    if (options.maxCatchUpSteps != null)
      this.maxCatchUpSteps = this._clampInt(options.maxCatchUpSteps, 1, 32);
    if (options.maxBacklogSeconds != null)
      this.maxBacklogSeconds = this._clamp(options.maxBacklogSeconds, 0.05, 1);
    this.fixedStep = 1 / this.rate;
    if (previousStep > 0 && previousStep !== this.fixedStep) {
      // Preserve the fractional progress through the current step.
      this.accumulator = (this.accumulator / previousStep) * this.fixedStep;
      this.offlineAccumulator =
        (this.offlineAccumulator / previousStep) * this.fixedStep;
    }
    this.stats.rate = this.rate;
    this.stats.fixedStep = this.fixedStep;
    return this.snapshot();
  }

  startWorker() {
    if (this.worker || typeof Worker === "undefined" || typeof Blob === "undefined")
      return false;
    try {
      const source = `
        let last = performance.now();
        const pulse = () => {
          const now = performance.now();
          postMessage({ type: 'physics-clock-pulse', delta: Math.max(0, (now - last) / 1000), now });
          last = now;
        };
        setInterval(pulse, 8);
        postMessage({ type: 'physics-clock-ready' });
      `;
      const url = URL.createObjectURL(
        new Blob([source], { type: "text/javascript" }),
      );
      const worker = new Worker(url, { name: "animastage-physics-clock" });
      URL.revokeObjectURL(url);
      worker.onmessage = (event) => {
        const message = event.data || {};
        if (message.type === "physics-clock-ready") {
          this.running = true;
          return;
        }
        if (message.type !== "physics-clock-pulse") return;
        const delta = Math.max(
          0,
          Math.min(this.maxBacklogSeconds, Number(message.delta) || 0),
        );
        const pending = this.workerPending + delta;
        if (pending > this.maxBacklogSeconds) {
          this.stats.droppedSeconds += pending - this.maxBacklogSeconds;
          this.stats.overloads++;
        }
        this.workerPending = Math.min(this.maxBacklogSeconds, pending);
        this.workerReady = true;
        this.lastPulseAt = Number(message.now) || 0;
        this.stats.workerPulses++;
      };
      worker.onerror = () => {
        this.stopWorker();
        this.stats.source = "frame";
      };
      this.worker = worker;
      return true;
    } catch (_) {
      this.worker = null;
      return false;
    }
  }

  stopWorker() {
    try {
      this.worker?.terminate?.();
    } catch (_) {}
    this.worker = null;
    this.running = false;
    this.workerReady = false;
    this.workerPending = 0;
  }

  reset(options = {}) {
    this.accumulator = 0;
    this.workerPending = 0;
    if (options.offline !== false) this.offlineAccumulator = 0;
    this.stats.steps = 0;
    this.stats.backlog = 0;
    if (options.keepTotals !== true) {
      this.stats.totalSteps = 0;
      this.stats.droppedSeconds = 0;
      this.stats.overloads = 0;
    }
  }

  _runSteps(stepCount, stepFunction, fixedStep = this.fixedStep) {
    let completed = 0;
    for (let i = 0; i < stepCount; i++) {
      stepFunction(fixedStep, i, stepCount);
      completed++;
    }
    this.stats.steps = completed;
    this.stats.totalSteps += completed;
    return completed;
  }

  advanceRealtime(frameDelta, stepFunction) {
    // The fallback still uses fixed steps.  It may ingest a long render frame,
    // but never more than the configured safe backlog window.
    const fallback = Math.max(
      0,
      Math.min(this.maxBacklogSeconds, Number(frameDelta) || 0),
    );
    const useWorker = !!this.worker && this.workerReady;
    const delta = useWorker ? this.workerPending : fallback;
    this.workerPending = 0;
    this.stats.mode = "realtime";
    this.stats.source = useWorker ? "worker" : "frame";

    this.accumulator += delta;
    if (this.accumulator > this.maxBacklogSeconds) {
      const dropped = this.accumulator - this.maxBacklogSeconds;
      this.accumulator = this.maxBacklogSeconds;
      this.stats.droppedSeconds += dropped;
      this.stats.overloads++;
    }

    const desired = Math.floor((this.accumulator + 1e-9) / this.fixedStep);
    const count = Math.min(desired, this.maxCatchUpSteps);
    const completed = this._runSteps(count, stepFunction);
    this.accumulator = Math.max(0, this.accumulator - completed * this.fixedStep);
    this.stats.backlog = this.accumulator;
    if (desired > this.maxCatchUpSteps) this.stats.overloads++;
    return this.snapshot();
  }

  advanceOffline(frameDelta, stepFunction) {
    const delta = Math.max(0, Number(frameDelta) || 0);
    this.stats.mode = "offline";
    this.stats.source = "timeline";
    this.offlineAccumulator += delta;
    const desired = Math.floor(
      (this.offlineAccumulator + 1e-9) / this.fixedStep,
    );
    // 2048 steps/frame is a corruption guard, not a realtime budget. Normal
    // 24/30/60 fps output uses only 1-3 steps per frame at 65 Hz.
    const count = Math.min(desired, 2048);
    const completed = this._runSteps(count, stepFunction);
    this.offlineAccumulator = Math.max(
      0,
      this.offlineAccumulator - completed * this.fixedStep,
    );
    this.stats.backlog = this.offlineAccumulator;
    return this.snapshot();
  }

  snapshot() {
    return {
      ...this.stats,
      rate: this.rate,
      fixedStep: this.fixedStep,
      maxCatchUpSteps: this.maxCatchUpSteps,
      maxBacklogSeconds: this.maxBacklogSeconds,
      interpolationAlpha: Math.max(
        0,
        Math.min(1, this.accumulator / this.fixedStep),
      ),
      workerRunning: !!this.worker && this.running,
    };
  }

  dispose() {
    this.stopWorker();
    this.reset();
  }
}

export default IndependentPhysicsClock;
