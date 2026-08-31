import {
  RenderCancelledError,
  createLinkedAbortController,
  isRenderCancelled,
  throwIfAborted,
} from './Cancellation.mjs';
import { RenderTransaction } from './RenderTransaction.mjs';
import { RenderAdapterRegistry } from './FrameRenderAdapter.mjs';
import { RenderFrameLog } from '../diagnostics/RenderFrameLog.mjs';

function positiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`);
  return value;
}

function integer(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be a safe integer greater than or equal to ${minimum}`);
  }
  return value;
}

export function createDeterministicFramePlan(job) {
  const fps = positiveNumber(job.fps, 'fps');
  const startFrame = integer(job.startFrame ?? 0, 'startFrame');
  let frameCount;
  if (job.frameCount !== undefined) {
    frameCount = integer(job.frameCount, 'frameCount', 1);
  } else if (job.endFrame !== undefined) {
    const endFrame = integer(job.endFrame, 'endFrame');
    if (endFrame < startFrame) throw new RangeError('endFrame must not be less than startFrame');
    frameCount = endFrame - startFrame + 1;
  } else {
    throw new TypeError('A render job requires frameCount or inclusive endFrame');
  }

  const explicitStartTime = job.startTimeSeconds;
  if (explicitStartTime !== undefined && !Number.isFinite(explicitStartTime)) {
    throw new RangeError('startTimeSeconds must be finite');
  }

  return Object.freeze(Array.from({ length: frameCount }, (_, sequenceIndex) => {
    const frameIndex = startFrame + sequenceIndex;
    const timeSeconds = explicitStartTime === undefined
      ? frameIndex / fps
      : explicitStartTime + sequenceIndex / fps;
    return Object.freeze({ sequenceIndex, frameIndex, timeSeconds, fps });
  }));
}

function resolveWarmupStart(job, outputStartTimeSeconds) {
  if (job.warmupFrom === undefined && job.warmupWindowSeconds === undefined) return null;
  if (job.warmupFrom !== undefined && job.warmupWindowSeconds !== undefined) {
    throw new TypeError('Use warmupFrom or warmupWindowSeconds, not both');
  }

  if (job.warmupWindowSeconds !== undefined) {
    const windowSeconds = positiveNumber(job.warmupWindowSeconds, 'warmupWindowSeconds');
    return Math.max(0, outputStartTimeSeconds - windowSeconds);
  }

  if (typeof job.warmupFrom === 'object' && job.warmupFrom !== null) {
    const windowSeconds = positiveNumber(job.warmupFrom.windowSeconds, 'warmupFrom.windowSeconds');
    return Math.max(0, outputStartTimeSeconds - windowSeconds);
  }

  if (!Number.isFinite(job.warmupFrom) || job.warmupFrom < 0) {
    throw new RangeError('warmupFrom must be a non-negative finite timeline time');
  }
  return job.warmupFrom;
}

/**
 * Builds exact fixed-step preroll intervals ending at the first output frame.
 * A final shorter remainder step is emitted when the duration is not divisible
 * by the fixed step. Times are derived from integer step indices, never by
 * repeatedly adding delta.
 */
export function createDeterministicWarmupPlan(job, outputPlan = createDeterministicFramePlan(job)) {
  if (!Array.isArray(outputPlan) || outputPlan.length === 0) {
    throw new TypeError('Warmup planning requires a non-empty output frame plan');
  }
  const toTimeSeconds = outputPlan[0].timeSeconds;
  const fromTimeSeconds = resolveWarmupStart(job, toTimeSeconds);
  if (fromTimeSeconds === null) return null;
  if (fromTimeSeconds > toTimeSeconds) {
    throw new RangeError('warmupFrom must not be later than the first output frame');
  }

  const explicitStep = job.warmupFixedStepSeconds ?? job.fixedStepSeconds;
  const explicitRate = job.warmupStepHz ?? job.fixedStepHz;
  if (explicitStep !== undefined && explicitRate !== undefined) {
    throw new TypeError('Use a fixed-step duration or rate for warmup, not both');
  }
  const fixedStepSeconds = explicitStep !== undefined
    ? positiveNumber(explicitStep, 'warmupFixedStepSeconds')
    : 1 / positiveNumber(explicitRate ?? 65, 'warmupStepHz');
  const durationSeconds = toTimeSeconds - fromTimeSeconds;
  const tolerance = Math.max(1e-12, Math.abs(durationSeconds) * 1e-12);
  const completeSteps = Math.floor((durationSeconds + tolerance) / fixedStepSeconds);
  const completeDuration = completeSteps * fixedStepSeconds;
  const hasRemainder = completeDuration < durationSeconds - tolerance;
  const stepCount = completeSteps + (hasRemainder ? 1 : 0);
  const maxWarmupSteps = integer(job.maxWarmupSteps ?? 1_000_000, 'maxWarmupSteps', 1);
  if (stepCount > maxWarmupSteps) {
    throw new RangeError(`Warmup requires ${stepCount} steps, above maxWarmupSteps=${maxWarmupSteps}`);
  }

  const steps = Array.from({ length: stepCount }, (_, stepIndex) => {
    const previousTimeSeconds = fromTimeSeconds + stepIndex * fixedStepSeconds;
    const timeSeconds = stepIndex === stepCount - 1
      ? toTimeSeconds
      : fromTimeSeconds + (stepIndex + 1) * fixedStepSeconds;
    return Object.freeze({
      stepIndex,
      stepCount,
      previousTimeSeconds,
      timeSeconds,
      deltaSeconds: timeSeconds - previousTimeSeconds,
      isFinalStep: stepIndex === stepCount - 1,
    });
  });

  return Object.freeze({
    fromTimeSeconds,
    toTimeSeconds,
    durationSeconds,
    fixedStepSeconds,
    steps: Object.freeze(steps),
  });
}

function normalizePoseSamples(evaluation, context, extractor) {
  let samples;
  if (extractor) {
    samples = extractor(evaluation, context);
  } else if (evaluation?.poseSamples !== undefined) {
    samples = evaluation.poseSamples;
  } else if (evaluation?.pose !== undefined || evaluation?.poseFingerprint !== undefined) {
    samples = [{
      id: evaluation.poseId ?? context.job.characterId ?? 'character',
      pose: evaluation.pose,
      fingerprint: evaluation.poseFingerprint,
      expectedDynamic: evaluation.expectedDynamic,
    }];
  } else {
    return [];
  }

  if (samples && !Array.isArray(samples) && typeof samples === 'object') {
    samples = Object.entries(samples).map(([id, value]) => (
      value && typeof value === 'object' && ('pose' in value || 'fingerprint' in value)
        ? { id, ...value }
        : { id, pose: value }
    ));
  }
  if (!Array.isArray(samples)) throw new TypeError('Pose sample extractor must return an array or object map');
  return samples;
}

function validateSink(sink) {
  if (!sink) return;
  if (typeof sink.writeFrame !== 'function') throw new TypeError('Output sink must implement writeFrame');
  for (const name of ['beginJob', 'commitJob', 'abortJob', 'disposeJob']) {
    if (sink[name] !== undefined && typeof sink[name] !== 'function') {
      throw new TypeError(`Output sink ${name} must be a function when provided`);
    }
  }
}

/**
 * Deterministically samples an animation timeline one exact frame at a time.
 *
 * Evaluator contract:
 *   evaluateFrame(frameContext) -> evaluation
 * Adapter contract:
 *   sampleFrame({ ...frameContext, evaluation, session }) -> renderedFrame
 * Sink contract:
 *   writeFrame({ ...frameContext, renderedFrame, session })
 */
export class OfflineFrameCoordinator {
  #evaluator;
  #adapters;
  #log;
  #active = null;

  constructor({ evaluator, adapters, log } = {}) {
    if (!evaluator || typeof evaluator.evaluateFrame !== 'function') {
      throw new TypeError('OfflineFrameCoordinator requires an evaluator with evaluateFrame');
    }
    this.#evaluator = evaluator;
    this.#adapters = adapters instanceof RenderAdapterRegistry
      ? adapters
      : new RenderAdapterRegistry(adapters ?? []);
    this.#log = log ?? new RenderFrameLog();
  }

  get active() {
    return Boolean(this.#active);
  }

  get log() {
    return this.#log;
  }

  cancel(reason = new RenderCancelledError()) {
    if (!this.#active) return false;
    if (!this.#active.controller.signal.aborted) this.#active.controller.abort(reason);
    return true;
  }

  async render(job, options = {}) {
    if (this.#active) throw new Error('An offline render job is already running');
    if (!job || typeof job !== 'object') throw new TypeError('Render job is required');
    const plan = createDeterministicFramePlan(job);
    const warmupPlan = createDeterministicWarmupPlan(job, plan);
    const warmupCallback = job.evaluateWarmupStep
      ?? this.#evaluator.evaluateWarmupStep?.bind(this.#evaluator)
      ?? this.#evaluator.warmupStep?.bind(this.#evaluator);
    if (warmupPlan?.steps.length && typeof warmupCallback !== 'function') {
      throw new TypeError('Warmup requires evaluateWarmupStep on the job or evaluator');
    }
    const adapter = this.#adapters.resolve(job.adapterId ?? job.renderMode);
    const sink = job.sink ?? options.sink;
    validateSink(sink);

    const linked = createLinkedAbortController([options.signal, job.signal]);
    const controller = linked.controller;
    const signal = controller.signal;
    const jobId = String(job.id ?? `offline-${Date.now()}`);
    const transaction = new RenderTransaction(jobId);
    const collectedFrames = [];
    const jobContext = Object.freeze({
      id: jobId,
      fps: plan[0].fps,
      frameCount: plan.length,
      startFrame: plan[0].frameIndex,
      endFrame: plan.at(-1).frameIndex,
      renderMode: adapter.mode,
      adapterId: adapter.id,
      characterId: job.characterId,
      metadata: job.metadata ?? {},
      warmup: warmupPlan ? {
        fromTimeSeconds: warmupPlan.fromTimeSeconds,
        toTimeSeconds: warmupPlan.toTimeSeconds,
        fixedStepSeconds: warmupPlan.fixedStepSeconds,
        stepCount: warmupPlan.steps.length,
      } : null,
    });

    this.#active = { id: jobId, controller, transaction };
    this.#log.beginJob(jobContext);
    let activeFrame = null;

    try {
      throwIfAborted(signal, { jobId, stage: 'begin' });

      // Register restoration hooks before beginJob. If an adapter mutates global
      // renderer state and then throws during initialization, abort/dispose still
      // get a chance to restore it.
      const adapterState = { session: undefined };
      this.#registerAdapterHooks(transaction, adapter, adapterState, jobContext, signal);
      adapterState.session = await adapter.beginJob?.({
        job: jobContext,
        options: job.adapterOptions ?? {},
        signal,
        transaction,
      });

      const sinkState = { session: undefined };
      this.#registerSinkHooks(transaction, sink, sinkState, jobContext, signal);
      sinkState.session = await sink?.beginJob?.({
        job: jobContext,
        signal,
        transaction,
      });

      if (warmupPlan) {
        await this.#runWarmup({
          warmupPlan,
          callback: warmupCallback,
          job: jobContext,
          signal,
          transaction,
          onProgress: options.onWarmupProgress ?? job.onWarmupProgress,
        });
      }

      for (const planned of plan) {
        throwIfAborted(signal, { jobId, frameIndex: planned.frameIndex, stage: 'frame-start' });
        const frameContext = Object.freeze({
          ...planned,
          frameId: `${jobId}:${planned.frameIndex}`,
          job: jobContext,
          signal,
        });
        activeFrame = this.#log.beginFrame(frameContext);

        try {
          const evaluation = await this.#log.timeStage(activeFrame, 'evaluate', () => (
            this.#evaluator.evaluateFrame(frameContext)
          ));
          throwIfAborted(signal, { jobId, frameIndex: planned.frameIndex, stage: 'evaluate' });

          const poseSamples = normalizePoseSamples(evaluation, frameContext, job.getPoseSamples);
          for (const sample of poseSamples) {
            this.#log.recordPose(activeFrame, {
              ...sample,
              expectedDynamic: sample.expectedDynamic
                ?? job.freezeDetection?.expectedDynamic
                ?? true,
            });
          }

          const renderedFrame = await this.#log.timeStage(activeFrame, 'render', () => (
            adapter.sampleFrame({
              ...frameContext,
              evaluation,
              session: adapterState.session,
              options: job.adapterOptions ?? {},
              transaction,
            })
          ), { mode: adapter.mode, adapterId: adapter.id });
          throwIfAborted(signal, { jobId, frameIndex: planned.frameIndex, stage: 'render' });

          if (sink) {
            await this.#log.timeStage(activeFrame, 'write', () => sink.writeFrame({
              ...frameContext,
              evaluation,
              renderedFrame,
              session: sinkState.session,
              transaction,
            }));
            throwIfAborted(signal, { jobId, frameIndex: planned.frameIndex, stage: 'write' });
          }

          if (job.collectFrames) collectedFrames.push(renderedFrame);
          this.#log.endFrame(activeFrame, 'completed');
          activeFrame = null;
          this.#notifyProgress(options.onProgress ?? job.onProgress, {
            jobId,
            completed: planned.sequenceIndex + 1,
            total: plan.length,
            frameIndex: planned.frameIndex,
            timeSeconds: planned.timeSeconds,
          });
        } catch (error) {
          this.#log.endFrame(activeFrame, isRenderCancelled(error) ? 'cancelled' : 'failed', error);
          activeFrame = null;
          throw error;
        }
      }

      throwIfAborted(signal, { jobId, stage: 'commit' });
      await transaction.commit({ job: jobContext, signal });
      this.#log.endJob('completed', { frameCount: plan.length });
      return {
        id: jobId,
        status: 'completed',
        adapterId: adapter.id,
        renderMode: adapter.mode,
        frameCount: plan.length,
        frames: job.collectFrames ? collectedFrames : undefined,
        diagnostics: this.#log.report().at(-1),
      };
    } catch (error) {
      if (activeFrame) this.#log.endFrame(activeFrame, isRenderCancelled(error) ? 'cancelled' : 'failed', error);
      try {
        await transaction.rollback(error, { job: jobContext, signal });
      } catch (cleanupError) {
        try {
          error.cleanupError = cleanupError;
        } catch {
          // Preserve the primary error even if it is frozen.
        }
        this.#log.event('error', 'TRANSACTION_CLEANUP_FAILED', cleanupError.message, {
          cleanupError: {
            name: cleanupError.name,
            message: cleanupError.message,
          },
        });
      }
      const cancelled = isRenderCancelled(error) || signal.aborted;
      this.#log.endJob(cancelled ? 'cancelled' : 'failed', { error });
      throw error;
    } finally {
      linked.dispose();
      this.#active = null;
    }
  }

  #registerAdapterHooks(transaction, adapter, state, job, signal) {
    if (adapter.completeJob) {
      transaction.onCommit((context) => adapter.completeJob({ ...context, job, signal, session: state.session }), `${adapter.id}:complete`);
    }
    if (adapter.abortJob) {
      transaction.onRollback((context) => adapter.abortJob({ ...context, job, signal, session: state.session }), `${adapter.id}:abort`);
    }
    if (adapter.disposeJob) {
      transaction.defer((context) => adapter.disposeJob({ ...context, job, signal, session: state.session }), `${adapter.id}:dispose`);
    }
  }

  #registerSinkHooks(transaction, sink, state, job, signal) {
    if (!sink) return;
    if (sink.commitJob) {
      transaction.onCommit((context) => sink.commitJob({ ...context, job, signal, session: state.session }), 'sink:commit');
    }
    if (sink.abortJob) {
      transaction.onRollback((context) => sink.abortJob({ ...context, job, signal, session: state.session }), 'sink:abort');
    }
    if (sink.disposeJob) {
      transaction.defer((context) => sink.disposeJob({ ...context, job, signal, session: state.session }), 'sink:dispose');
    }
  }

  #notifyProgress(callback, progress) {
    if (!callback) return;
    try {
      callback(progress);
    } catch (error) {
      this.#log.event('warning', 'PROGRESS_CALLBACK_FAILED', error.message, {});
    }
  }

  async #runWarmup({ warmupPlan, callback, job, signal, transaction, onProgress }) {
    this.#log.beginWarmup({
      fromTimeSeconds: warmupPlan.fromTimeSeconds,
      toTimeSeconds: warmupPlan.toTimeSeconds,
      fixedStepSeconds: warmupPlan.fixedStepSeconds,
      stepCount: warmupPlan.steps.length,
    });
    try {
      for (const step of warmupPlan.steps) {
        throwIfAborted(signal, { jobId: job.id, stage: 'warmup', stepIndex: step.stepIndex });
        const context = Object.freeze({
          phase: 'warmup',
          ...step,
          warmupFromTimeSeconds: warmupPlan.fromTimeSeconds,
          outputStartTimeSeconds: warmupPlan.toTimeSeconds,
          job,
          signal,
          transaction,
        });
        await this.#log.timeWarmupStep(context, () => callback(context));
        throwIfAborted(signal, { jobId: job.id, stage: 'warmup', stepIndex: step.stepIndex });
        this.#notifyProgress(onProgress, {
          phase: 'warmup',
          jobId: job.id,
          completed: step.stepIndex + 1,
          total: step.stepCount,
          timeSeconds: step.timeSeconds,
          outputStartTimeSeconds: warmupPlan.toTimeSeconds,
        });
      }
      this.#log.endWarmup('completed');
    } catch (error) {
      this.#log.endWarmup(isRenderCancelled(error) ? 'cancelled' : 'failed', error);
      throw error;
    }
  }
}
