/**
 * Physics Studio presets — tune existing MmdLite / warmup knobs (Ammo path).
 * Original AnimaStage presets — not copied from external products.
 */
import type { MmdLiteConfig, PhysicsMode } from '../types';

export type PhysicsPresetId =
  | 'safe'
  | 'default'
  | 'anime'
  | 'realistic'
  | 'cinematic'
  | 'windy'
  | 'heavy'
  | 'light';

export interface PhysicsPresetDef {
  id: PhysicsPresetId;
  label: string;
  hint: string;
  physicsMode: PhysicsMode;
  mmdLite: Partial<MmdLiteConfig>;
  /** Frames of quiet sim before first visible frame / export. */
  physicsWarmup: number;
}

export const PHYSICS_PRESETS: PhysicsPresetDef[] = [
  {
    id: 'safe',
    label: 'Safe',
    hint: 'Stable cloth/hair — best for Android & export.',
    physicsMode: 'playtime',
    mmdLite: {
      stablePhys: true,
      physicsGravity: 0.85,
      physicsSwing: 0.08,
      physicsWind: 0,
    },
    physicsWarmup: 30,
  },
  {
    id: 'default',
    label: 'Default',
    hint: 'Balanced MMD hair / skirt response.',
    physicsMode: 'playtime',
    mmdLite: {
      stablePhys: true,
      physicsGravity: 1,
      physicsSwing: 0.12,
      physicsWind: 0,
    },
    physicsWarmup: 20,
  },
  {
    id: 'anime',
    label: 'Anime',
    hint: 'Lively swing, soft gravity.',
    physicsMode: 'anytime',
    mmdLite: {
      stablePhys: true,
      physicsGravity: 0.75,
      physicsSwing: 0.28,
      physicsWind: 1.5,
    },
    physicsWarmup: 15,
  },
  {
    id: 'realistic',
    label: 'Realistic',
    hint: 'Heavier cloth, lower swing.',
    physicsMode: 'playtime',
    mmdLite: {
      stablePhys: true,
      physicsGravity: 1.25,
      physicsSwing: 0.06,
      physicsWind: 0.5,
    },
    physicsWarmup: 40,
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    hint: 'Smooth, controlled — for HQ export.',
    physicsMode: 'playtime',
    mmdLite: {
      stablePhys: true,
      physicsGravity: 1.05,
      physicsSwing: 0.1,
      physicsWind: 0.8,
    },
    physicsWarmup: 60,
  },
  {
    id: 'windy',
    label: 'Windy',
    hint: 'Strong wind + swing for outdoor shots.',
    physicsMode: 'anytime',
    mmdLite: {
      stablePhys: true,
      physicsGravity: 0.95,
      physicsSwing: 0.35,
      physicsWind: 8,
    },
    physicsWarmup: 25,
  },
  {
    id: 'heavy',
    label: 'Heavy',
    hint: 'Strong gravity, minimal bounce.',
    physicsMode: 'playtime',
    mmdLite: {
      stablePhys: true,
      physicsGravity: 1.6,
      physicsSwing: 0.04,
      physicsWind: 0,
    },
    physicsWarmup: 35,
  },
  {
    id: 'light',
    label: 'Light',
    hint: 'Floaty hair / fabric.',
    physicsMode: 'anytime',
    mmdLite: {
      stablePhys: true,
      physicsGravity: 0.55,
      physicsSwing: 0.4,
      physicsWind: 2,
    },
    physicsWarmup: 12,
  },
];

export function getPhysicsPreset(id: PhysicsPresetId): PhysicsPresetDef {
  return PHYSICS_PRESETS.find((p) => p.id === id) ?? PHYSICS_PRESETS[1]!;
}
