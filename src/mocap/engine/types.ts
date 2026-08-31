/**
 * Motion Capture Engine 2.0 — backend selection (WHAM / Landmark / Auto).
 * Does not replace WHAM; routes into existing pipeline with different preferServer flags.
 */

export type MocapEngineId = 'wham' | 'landmark' | 'auto';

export type MocapCaptureMode = 'live' | 'video' | 'photo' | 'edit';

/** Extended quality ladder (maps onto WHAM presets + extra cleanup). */
export type MocapQualityMode =
  | 'fast'
  | 'balanced'
  | 'high'
  | 'cinema'
  | 'maximum';

export type MocapSmoothingMode =
  | 'none'
  | 'light'
  | 'medium'
  | 'strong'
  | 'cinematic';

export interface MocapEngineDef {
  id: MocapEngineId;
  label: string;
  hint: string;
}

export const MOCAP_ENGINES: MocapEngineDef[] = [
  {
    id: 'wham',
    label: 'WHAM',
    hint: 'Prefer WHAM server, then local MediaPipe reconstruct.',
  },
  {
    id: 'landmark',
    label: 'Landmark',
    hint: 'Local pose landmarks only (no remote server).',
  },
  {
    id: 'auto',
    label: 'Auto',
    hint: 'Try WHAM server; fall back to Landmark automatically.',
  },
];

export const MOCAP_QUALITY_LABELS: Record<MocapQualityMode, string> = {
  fast: 'Fast',
  balanced: 'Balanced',
  high: 'High Quality',
  cinema: 'Cinematic',
  maximum: 'Maximum',
};

export interface FootLockSettings {
  enabled: boolean;
  strength: number;
  contactThreshold: number;
  releaseSpeed: number;
}

export interface ConfidenceGateSettings {
  /** Below this → hold last / skip new key contribution */
  low: number;
  /** Between low and high → heavy smooth */
  medium: number;
  high: number;
}

export interface RootMotionSettings {
  enabled: boolean;
  bakeIntoBones: boolean;
}

export const DEFAULT_FOOT_LOCK: FootLockSettings = {
  enabled: true,
  strength: 0.75,
  contactThreshold: 0.04,
  releaseSpeed: 0.35,
};

export const DEFAULT_CONFIDENCE_GATE: ConfidenceGateSettings = {
  low: 0.28,
  medium: 0.55,
  high: 0.82,
};

export const DEFAULT_ROOT_MOTION: RootMotionSettings = {
  enabled: true,
  bakeIntoBones: false,
};

export interface MocapEngineOptions {
  engine?: MocapEngineId;
  quality?: MocapQualityMode;
  captureMode?: MocapCaptureMode;
  smoothing?: MocapSmoothingMode;
  footLock?: Partial<FootLockSettings>;
  confidence?: Partial<ConfidenceGateSettings>;
  rootMotion?: Partial<RootMotionSettings>;
  preferServer?: boolean;
  serverUrl?: string;
  maxFrames?: number;
  /** Person index when multiple detections exist (0-based). */
  personIndex?: number;
  /** Abort signal for cancel-safe processing. */
  signal?: AbortSignal;
  /** Start/end frame window (video mocap). */
  frameRange?: { start: number; end: number } | null;
  mirror?: boolean;
}

/** Map Mocap 2.0 quality → WHAM quality + cleanup intensity. */
export function resolveWhamQuality(
  quality: MocapQualityMode
): 'fast' | 'balanced' | 'high' | 'cinema' {
  if (quality === 'maximum') return 'cinema';
  return quality;
}

export function enginePrefersServer(engine: MocapEngineId): boolean {
  return engine === 'wham' || engine === 'auto';
}

export function engineForceLocal(engine: MocapEngineId): boolean {
  return engine === 'landmark';
}
