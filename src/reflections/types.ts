import type { ScenePresetId } from '../types';

/** Auto-detected environment class for probe sizing / intensity. */
export type ReflectionSceneKind =
  | 'indoor'
  | 'outdoor'
  | 'studio'
  | 'concert'
  | 'hdr';

export type ReflectionQualityTier = 'simplified' | 'balanced' | 'ultra' | 'export';

export interface ReflectionBoxVolume {
  center: [number, number, number];
  size: [number, number, number];
}

export interface ReflectionSystemSettings {
  /** Off by default (RP4) — user enables SSR / probes manually. */
  enabled: boolean;
  /** Box projection (parallax-corrected cubemap). */
  boxProjection: boolean;
  /** Contact-hardening mip bias (frostbone25 / Godot-style approximation). */
  contactHardening: boolean;
  /** Cubemap edge resolution (auto-resolved from device unless overridden). */
  resolution: number | 'auto';
  /** Seconds between probe refreshes (0 = only on env change). */
  refreshRate: number;
  /** Global reflection intensity 0–2. */
  intensity: number;
  /** How strongly roughness blurs reflections 0–2. */
  roughnessInfluence: number;
  /** Optional manual box; null = auto from scene kind. */
  boxVolume: ReflectionBoxVolume | null;
  /** Apply to character materials (hair, eyes, accessories…). */
  characterReflections: boolean;
  /** Apply to floor / stage / props. */
  environmentReflections: boolean;
  /** Force export-tier quality while recording. */
  exportBoost: boolean;
}

export interface ReflectionProbeState {
  sceneKind: ReflectionSceneKind;
  qualityTier: ReflectionQualityTier;
  resolution: number;
  boxMin: [number, number, number];
  boxMax: [number, number, number];
  probePosition: [number, number, number];
  lastCaptureAt: number;
  captureVersion: number;
}

export interface ReflectionQualityProfile {
  tier: ReflectionQualityTier;
  resolution: number;
  refreshRate: number;
  intensityScale: number;
  contactHardening: boolean;
  maxMips: number;
}

export function sceneKindFromPreset(preset: ScenePresetId | undefined): ReflectionSceneKind {
  switch (preset) {
    case 'studio':
    case 'warehouse':
      return 'studio';
    case 'stage':
    case 'nightclub':
      return 'concert';
    case 'outdoor':
    case 'sunset':
      return 'outdoor';
    case 'cyber':
      return 'indoor';
    default:
      return 'studio';
  }
}

export function defaultBoxForScene(kind: ReflectionSceneKind): ReflectionBoxVolume {
  switch (kind) {
    case 'outdoor':
      return { center: [0, 8, 0], size: [48, 28, 48] };
    case 'concert':
      return { center: [0, 6, 2], size: [28, 18, 32] };
    case 'indoor':
      return { center: [0, 5, 0], size: [22, 14, 22] };
    case 'hdr':
      return { center: [0, 6, 0], size: [36, 22, 36] };
    case 'studio':
    default:
      return { center: [0, 5.5, 0], size: [24, 16, 24] };
  }
}
