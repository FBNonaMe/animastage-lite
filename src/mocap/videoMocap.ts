/**
 * Video → timeline keyframes via Motion Capture Engine 2.0.
 * WHAM remains the primary reconstruct backend (server or local).
 */
import type { TimelineKeyframe } from '../types';
import {
  runWhamMotionPipeline,
  type WhamPipelineResult,
  type WhamProgress,
  type WhamQualityMode,
} from './wham';
import {
  runMocapEngine,
  type MocapEngineId,
  type MocapEngineOptions,
  type MocapQualityMode,
} from './engine';

export type { WhamProgress as MocapProgress };

/** @deprecated alias — phases now include WHAM stages; progress 0..1 still valid */
export interface MocapProgress {
  phase:
    | 'idle'
    | 'loading'
    | 'processing'
    | 'done'
    | 'error'
    | WhamProgress['phase'];
  progress: number;
  message: string;
}

function toMocapProgress(p: WhamProgress): MocapProgress {
  if (p.phase === 'done' || p.phase === 'error' || p.phase === 'idle') {
    return p;
  }
  if (p.phase === 'ingest' || p.phase === 'analyze') {
    return { phase: 'loading', progress: p.progress, message: p.message };
  }
  return { phase: 'processing', progress: p.progress, message: p.message };
}

export interface ExtractMocapOptions {
  quality?: WhamQualityMode | MocapQualityMode;
  preferServer?: boolean;
  serverUrl?: string;
  maxFrames?: number;
  /** Mocap 2.0 engine — default auto */
  engine?: MocapEngineId;
  signal?: AbortSignal;
}

/**
 * Primary Video → Motion Keys entry. Uses Mocap Engine 2.0 (WHAM under the hood).
 */
export async function extractMocapFromVideo(
  file: File,
  onProgress?: (p: MocapProgress) => void,
  options?: ExtractMocapOptions
): Promise<TimelineKeyframe[]> {
  const result = await runMocapEngine(
    file,
    {
      quality: (options?.quality as MocapQualityMode) ?? 'balanced',
      preferServer: options?.preferServer,
      serverUrl: options?.serverUrl,
      maxFrames: options?.maxFrames,
      engine: options?.engine ?? 'auto',
      signal: options?.signal,
    } satisfies MocapEngineOptions,
    (p) => onProgress?.(toMocapProgress(p))
  );
  return result.keyframes;
}

/** Full engine result (keys + sequence + confidence + quality report). */
export async function extractWhamMotionFromVideo(
  file: File,
  onProgress?: (p: WhamProgress) => void,
  options?: ExtractMocapOptions
): Promise<WhamPipelineResult> {
  // Backward-compatible: still returns WhamPipelineResult shape
  return runMocapEngine(
    file,
    {
      quality: (options?.quality as MocapQualityMode) ?? 'balanced',
      preferServer: options?.preferServer ?? true,
      serverUrl: options?.serverUrl,
      maxFrames: options?.maxFrames,
      engine: options?.engine ?? (options?.preferServer === false ? 'landmark' : 'wham'),
      signal: options?.signal,
    },
    onProgress
  );
}

/** @deprecated Direct WHAM-only path — prefer extractWhamMotionFromVideo / runMocapEngine */
export async function extractWhamOnlyFromVideo(
  file: File,
  onProgress?: (p: WhamProgress) => void,
  options?: ExtractMocapOptions
): Promise<WhamPipelineResult> {
  return runWhamMotionPipeline(
    file,
    {
      quality: (options?.quality as WhamQualityMode) ?? 'balanced',
      preferServer: options?.preferServer ?? true,
      serverUrl: options?.serverUrl,
      maxFrames: options?.maxFrames,
    },
    onProgress
  );
}
