/**
 * Motion Capture Engine runner — WHAM / Landmark / Auto.
 * Preserves existing WHAM pipeline; Landmark forces local reconstruct.
 */
import type { WhamPipelineResult, WhamProgress } from '../wham/types';
import { runWhamMotionPipeline } from '../wham/pipeline';
import { probeWhamServer } from '../wham/backendClient';
import { sequenceToMotionSpec, finalizeWhamMotionSpec } from '../wham/toMotionSpec';
import { generateTimelineKeysFromSpec } from '../wham/keyframeGen';
import { getWhamQualityPreset } from '../wham/qualityPresets';
import { averageJointConfidence } from '../wham/temporalSmooth';
import { applyIkPass } from '../wham/ikPass';
import { applyMocap2PostProcess } from '../pipeline/applyMocap2Post';
import { autoCleanMotion } from '../pipeline/autoCleanup';
import { buildMocapQualityReport, type MocapQualityReport } from '../pipeline/qualityReport';
import {
  type MocapEngineOptions,
  type MocapEngineId,
  resolveWhamQuality,
  engineForceLocal,
  enginePrefersServer,
} from './types';
import {
  buildMocapCacheKey,
  getMocapCache,
  mocapFileFingerprint,
  setMocapCache,
} from './frameCache';

export interface MocapEngineResult extends WhamPipelineResult {
  engine: MocapEngineId;
  qualityReport: MocapQualityReport;
  fromCache: boolean;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error('Motion capture cancelled');
    err.name = 'AbortError';
    throw err;
  }
}

async function resolveEngine(
  engine: MocapEngineId,
  serverUrl?: string
): Promise<{ preferServer: boolean; resolved: MocapEngineId }> {
  if (engineForceLocal(engine)) {
    return { preferServer: false, resolved: 'landmark' };
  }
  if (engine === 'wham') {
    return { preferServer: true, resolved: 'wham' };
  }
  // auto
  const ok = await probeWhamServer(serverUrl);
  return ok
    ? { preferServer: true, resolved: 'wham' }
    : { preferServer: false, resolved: 'landmark' };
}

function rebakeKeys(
  sequence: WhamPipelineResult['sequence'],
  name: string,
  maxFrames: number,
  keyReduceTol: number
): Pick<WhamPipelineResult, 'motionSpec' | 'keyframes' | 'jointConfidence'> {
  let motionSpec = finalizeWhamMotionSpec(sequenceToMotionSpec(sequence, name));
  const frameCap = Math.min(
    maxFrames,
    Math.max(1, Math.ceil(sequence.duration * 30) + 1)
  );
  const keyframes = generateTimelineKeysFromSpec(motionSpec, frameCap, keyReduceTol);
  motionSpec = finalizeWhamMotionSpec(motionSpec);
  return {
    motionSpec,
    keyframes,
    jointConfidence: averageJointConfidence(sequence.frames),
  };
}

/**
 * Primary Mocap 2.0 entry. Uses WHAM pipeline under the hood.
 */
export async function runMocapEngine(
  file: File,
  options: MocapEngineOptions = {},
  onProgress?: (p: WhamProgress) => void
): Promise<MocapEngineResult> {
  const t0 = performance.now();
  const engine = options.engine ?? 'auto';
  const quality = options.quality ?? 'balanced';
  const whamQuality = resolveWhamQuality(quality);
  const fingerprint = mocapFileFingerprint(file);
  const cacheKey = buildMocapCacheKey(fingerprint, engine, quality);

  throwIfAborted(options.signal);

  const cached = getMocapCache(cacheKey);
  if (cached) {
    onProgress?.({
      phase: 'done',
      progress: 1,
      message: 'Loaded from motion cache (no re-detect)',
    });
    const report = buildMocapQualityReport(cached.result, {
      processingTimeMs: Math.round(performance.now() - t0),
    });
    return {
      ...cached.result,
      engine: engine as MocapEngineId,
      qualityReport: report,
      fromCache: true,
    };
  }

  const { preferServer, resolved } = await resolveEngine(engine, options.serverUrl);
  const forceLocal = engineForceLocal(engine) || !preferServer;

  onProgress?.({
    phase: 'analyze',
    progress: 0.02,
    message:
      resolved === 'wham'
        ? 'Engine: WHAM…'
        : 'Engine: Landmark (local)…',
  });

  throwIfAborted(options.signal);

  let result = await runWhamMotionPipeline(
    file,
    {
      quality: whamQuality,
      preferServer: forceLocal ? false : enginePrefersServer(engine),
      serverUrl: options.serverUrl,
      maxFrames: options.maxFrames,
    },
    onProgress
  );

  throwIfAborted(options.signal);

  onProgress?.({
    phase: 'refine',
    progress: 0.86,
    message: 'Mocap 2.0 post (confidence · hold · feet · limits)…',
  });

  const post = applyMocap2PostProcess(result.sequence, options);
  let sequence = post.sequence;

  if (quality === 'maximum' || quality === 'cinema') {
    const cleaned = autoCleanMotion(sequence, {
      intensity: quality === 'maximum' ? 'maximum' : 'high',
      footLock: options.footLock,
      confidence: options.confidence,
    });
    sequence = cleaned.sequence;
    post.correctedJoints += cleaned.correctedJoints;
    post.correctedRoot += cleaned.correctedRoot;
  }

  sequence = applyIkPass(sequence);

  const preset = getWhamQualityPreset(whamQuality);
  const baked = rebakeKeys(
    sequence,
    file.name.replace(/\.[^.]+$/, '') || 'mocap_motion',
    options.maxFrames ?? 30 * 600,
    quality === 'maximum' ? 0.7 : preset.keyReduceTol
  );

  result = {
    ...result,
    sequence,
    motionSpec: baked.motionSpec,
    keyframes: baked.keyframes,
    jointConfidence: baked.jointConfidence,
    source: forceLocal ? 'wham-local' : result.source,
    quality: whamQuality,
    meta: {
      ...result.meta,
      keyCount: baked.keyframes.length,
      frameCount: sequence.frames.length,
      duration: sequence.duration,
      sampleFps: sequence.sampleFps,
    },
  };

  const qualityReport = buildMocapQualityReport(result, {
    processingTimeMs: Math.round(performance.now() - t0),
    correctedFrames: post.correctedJoints + post.correctedRoot,
    boneErrors: post.correctedJoints,
  });

  setMocapCache({
    key: cacheKey,
    fileFingerprint: fingerprint,
    engine,
    quality,
    sequence,
    result,
    createdAt: Date.now(),
  });

  onProgress?.({
    phase: 'done',
    progress: 1,
    message: `Mocap 2.0 (${resolved}) · ${result.meta.keyCount} keys · ${qualityReport.trackingQuality}`,
  });

  return {
    ...result,
    engine: resolved,
    qualityReport,
    fromCache: false,
  };
}

/** Re-apply cleanup + rebake without re-detecting. */
export function rebakeCachedResult(
  result: WhamPipelineResult,
  options: MocapEngineOptions = {}
): MocapEngineResult {
  const t0 = performance.now();
  const cleaned = autoCleanMotion(result.sequence, {
    intensity: options.quality === 'maximum' ? 'maximum' : 'high',
    footLock: options.footLock,
    confidence: options.confidence,
  });
  const post = applyMocap2PostProcess(cleaned.sequence, options);
  const whamQuality = resolveWhamQuality(options.quality ?? 'balanced');
  const preset = getWhamQualityPreset(whamQuality);
  const baked = rebakeKeys(
    post.sequence,
    result.motionSpec.name,
    options.maxFrames ?? 30 * 600,
    preset.keyReduceTol
  );
  const next: WhamPipelineResult = {
    ...result,
    sequence: post.sequence,
    motionSpec: baked.motionSpec,
    keyframes: baked.keyframes,
    jointConfidence: baked.jointConfidence,
    meta: {
      ...result.meta,
      keyCount: baked.keyframes.length,
      frameCount: post.sequence.frames.length,
    },
  };
  const qualityReport = buildMocapQualityReport(next, {
    processingTimeMs: Math.round(performance.now() - t0),
    correctedFrames: cleaned.correctedJoints + post.correctedJoints,
    boneErrors: cleaned.correctedJoints,
  });
  return {
    ...next,
    engine: (options.engine ?? 'auto') as MocapEngineId,
    qualityReport,
    fromCache: true,
  };
}
