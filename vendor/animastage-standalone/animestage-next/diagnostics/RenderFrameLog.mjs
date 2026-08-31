import { fingerprintPose, isPoseFingerprint } from './PoseFingerprint.mjs';

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    code: error.code,
    stack: error.stack,
  };
}

function errorWasCancelled(error) {
  return error?.code === 'RENDER_CANCELLED'
    || error?.code === 'ABORT_ERR'
    || error?.name === 'AbortError'
    || error?.name === 'RenderCancelledError';
}

function clonePlain(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall through for Error-like or host objects.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * Unified per-job/per-frame diagnostics for live adapters and offline export.
 */
export class RenderFrameLog {
  #now;
  #freezeThreshold;
  #timeEpsilon;
  #listeners = new Set();
  #jobs = [];
  #activeJob = null;
  #poseHistory = new Map();

  constructor({ now = defaultNow, freezeThreshold = 2, timeEpsilon = 1e-9 } = {}) {
    if (typeof now !== 'function') throw new TypeError('RenderFrameLog now must be a function');
    if (!Number.isInteger(freezeThreshold) || freezeThreshold < 1) {
      throw new RangeError('freezeThreshold must be an integer of at least 1');
    }
    this.#now = now;
    this.#freezeThreshold = freezeThreshold;
    this.#timeEpsilon = timeEpsilon;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Log listener must be a function');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  beginJob(metadata = {}) {
    if (this.#activeJob) throw new Error('A render log job is already active');
    const job = {
      id: String(metadata.id ?? `render-${this.#jobs.length + 1}`),
      metadata: clonePlain(metadata),
      startedAtMs: this.#now(),
      endedAtMs: null,
      durationMs: null,
      status: 'running',
      frames: [],
      warmup: null,
      events: [],
      error: null,
    };
    this.#activeJob = job;
    this.#poseHistory.clear();
    this.#jobs.push(job);
    this.event('info', 'job-start', 'Offline render job started', metadata);
    return job;
  }

  endJob(status, details = {}) {
    const job = this.#requireJob();
    if (job.status !== 'running') return job;
    job.endedAtMs = this.#now();
    job.durationMs = Math.max(0, job.endedAtMs - job.startedAtMs);
    job.status = status;
    job.error = serializeError(details.error);
    if (details.error) {
      this.event(status === 'cancelled' ? 'warning' : 'error', `job-${status}`, details.error.message, {
        error: serializeError(details.error),
      });
    } else {
      this.event('info', `job-${status}`, `Offline render job ${status}`, details);
    }
    this.#activeJob = null;
    this.#poseHistory.clear();
    return job;
  }

  beginFrame({ frameIndex, sequenceIndex, timeSeconds, frameId }) {
    const job = this.#requireJob();
    const frame = {
      frameId: frameId ?? `${job.id}:${frameIndex}`,
      frameIndex,
      sequenceIndex,
      timeSeconds,
      startedAtMs: this.#now(),
      endedAtMs: null,
      durationMs: null,
      status: 'running',
      stages: [],
      poses: {},
      warnings: [],
      error: null,
    };
    job.frames.push(frame);
    this.#emit({ type: 'frame-start', jobId: job.id, frameId: frame.frameId });
    return frame;
  }

  beginWarmup(metadata) {
    const job = this.#requireJob();
    if (job.warmup?.status === 'running') throw new Error('Render warmup is already active');
    job.warmup = {
      ...clonePlain(metadata),
      startedAtMs: this.#now(),
      endedAtMs: null,
      durationMs: null,
      status: 'running',
      steps: [],
      error: null,
    };
    this.#emit({ type: 'warmup-start', jobId: job.id, warmup: clonePlain(metadata) });
    return job.warmup;
  }

  async timeWarmupStep(context, task) {
    if (typeof task !== 'function') throw new TypeError('Warmup step task must be a function');
    const job = this.#requireJob();
    if (!job.warmup || job.warmup.status !== 'running') {
      throw new Error('No active render warmup');
    }
    const step = {
      stepIndex: context.stepIndex,
      previousTimeSeconds: context.previousTimeSeconds,
      timeSeconds: context.timeSeconds,
      deltaSeconds: context.deltaSeconds,
      isFinalStep: context.isFinalStep,
      startedAtMs: this.#now(),
      endedAtMs: null,
      durationMs: null,
      status: 'running',
      error: null,
    };
    job.warmup.steps.push(step);
    this.#emit({ type: 'warmup-step-start', jobId: job.id, stepIndex: step.stepIndex });
    try {
      const result = await task();
      step.status = 'completed';
      return result;
    } catch (error) {
      step.status = errorWasCancelled(error) ? 'cancelled' : 'failed';
      step.error = serializeError(error);
      throw error;
    } finally {
      step.endedAtMs = this.#now();
      step.durationMs = Math.max(0, step.endedAtMs - step.startedAtMs);
      this.#emit({
        type: 'warmup-step-end',
        jobId: job.id,
        stepIndex: step.stepIndex,
        status: step.status,
        durationMs: step.durationMs,
      });
    }
  }

  endWarmup(status = 'completed', error) {
    const job = this.#requireJob();
    if (!job.warmup) throw new Error('No render warmup was started');
    if (job.warmup.status !== 'running') return job.warmup;
    job.warmup.endedAtMs = this.#now();
    job.warmup.durationMs = Math.max(0, job.warmup.endedAtMs - job.warmup.startedAtMs);
    job.warmup.status = status;
    job.warmup.error = serializeError(error);
    this.#emit({
      type: 'warmup-end',
      jobId: job.id,
      status,
      durationMs: job.warmup.durationMs,
    });
    return job.warmup;
  }

  async timeStage(frame, name, task, details = {}) {
    if (typeof task !== 'function') throw new TypeError('Stage task must be a function');
    this.#assertFrame(frame);
    const stage = {
      name: String(name),
      startedAtMs: this.#now(),
      endedAtMs: null,
      durationMs: null,
      status: 'running',
      details: clonePlain(details),
      error: null,
    };
    frame.stages.push(stage);
    this.#emit({ type: 'stage-start', frameId: frame.frameId, stage: stage.name });
    try {
      const result = await task();
      stage.status = 'completed';
      return result;
    } catch (error) {
      stage.status = errorWasCancelled(error) ? 'cancelled' : 'failed';
      stage.error = serializeError(error);
      throw error;
    } finally {
      stage.endedAtMs = this.#now();
      stage.durationMs = Math.max(0, stage.endedAtMs - stage.startedAtMs);
      this.#emit({
        type: 'stage-end',
        frameId: frame.frameId,
        stage: stage.name,
        status: stage.status,
        durationMs: stage.durationMs,
      });
    }
  }

  recordPose(frame, {
    id = 'character',
    pose,
    fingerprint,
    expectedDynamic = true,
    precision,
  }) {
    this.#assertFrame(frame);
    const resolved = fingerprint ?? fingerprintPose(pose, precision === undefined ? {} : { precision });
    if (!isPoseFingerprint(resolved)) {
      throw new TypeError('A pose fingerprint must be a 16-character hexadecimal string');
    }

    const key = String(id);
    frame.poses[key] = resolved;
    const previous = this.#poseHistory.get(key);
    let unchangedTransitions = 0;
    let warning = null;

    if (previous) {
      const advanced = frame.timeSeconds > previous.timeSeconds + this.#timeEpsilon;
      unchangedTransitions = advanced && resolved === previous.fingerprint
        ? previous.unchangedTransitions + 1
        : 0;

      if (expectedDynamic && advanced && unchangedTransitions >= this.#freezeThreshold) {
        warning = {
          code: 'POSE_FREEZE_DETECTED',
          poseId: key,
          fingerprint: resolved,
          unchangedTransitions,
          fromTimeSeconds: previous.firstUnchangedTimeSeconds ?? previous.timeSeconds,
          toTimeSeconds: frame.timeSeconds,
        };
        frame.warnings.push(warning);
        this.event('warning', warning.code, `Pose ${key} did not change while timeline time advanced`, warning);
      }
    }

    this.#poseHistory.set(key, {
      fingerprint: resolved,
      timeSeconds: frame.timeSeconds,
      unchangedTransitions,
      firstUnchangedTimeSeconds: unchangedTransitions === 1
        ? previous?.timeSeconds
        : previous?.firstUnchangedTimeSeconds,
    });
    return { fingerprint: resolved, warning };
  }

  endFrame(frame, status = 'completed', error) {
    this.#assertFrame(frame);
    if (frame.status !== 'running') return frame;
    frame.endedAtMs = this.#now();
    frame.durationMs = Math.max(0, frame.endedAtMs - frame.startedAtMs);
    frame.status = status;
    frame.error = serializeError(error);
    this.#emit({
      type: 'frame-end',
      frameId: frame.frameId,
      status,
      durationMs: frame.durationMs,
    });
    return frame;
  }

  event(level, code, message, details = {}) {
    const job = this.#requireJob();
    const event = {
      timestampMs: this.#now(),
      level,
      code,
      message,
      details: clonePlain(details),
    };
    job.events.push(event);
    this.#emit({ type: 'event', jobId: job.id, event });
    return event;
  }

  snapshot() {
    return clonePlain(this.#jobs);
  }

  report() {
    return this.#jobs.map((job) => ({
      id: job.id,
      status: job.status,
      durationMs: job.durationMs,
      frameCount: job.frames.length,
      completedFrames: job.frames.filter((frame) => frame.status === 'completed').length,
      warmupStatus: job.warmup?.status ?? null,
      warmupSteps: job.warmup?.steps.length ?? 0,
      warmupDurationMs: job.warmup?.durationMs ?? 0,
      warnings: job.events.filter((event) => event.level === 'warning').length,
      errors: job.events.filter((event) => event.level === 'error').length,
      stageTotalsMs: job.frames.flatMap((frame) => frame.stages).reduce((totals, stage) => {
        totals[stage.name] = (totals[stage.name] ?? 0) + (stage.durationMs ?? 0);
        return totals;
      }, {}),
    }));
  }

  #requireJob() {
    if (!this.#activeJob) throw new Error('No active render log job');
    return this.#activeJob;
  }

  #assertFrame(frame) {
    const job = this.#requireJob();
    if (!job.frames.includes(frame)) throw new Error('Frame does not belong to the active render job');
  }

  #emit(payload) {
    for (const listener of this.#listeners) {
      try {
        listener(payload);
      } catch {
        // Observability must never break the render.
      }
    }
  }
}
