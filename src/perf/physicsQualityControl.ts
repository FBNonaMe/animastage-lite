import type { PhysicsQualityTier } from './perfTypes';
import { refreshScenePhysicsSubstepCaps } from '../scene/scenePhysicsRegistry';
import {
  applyMmdPhysicsRatePreset,
  type MmdPhysicsQualityPreset,
} from '../utils/mmdPhysicsPresets';

export type EffectivePhysicsTier = 'off' | 'low' | 'medium' | 'high';

let userTier: PhysicsQualityTier = 'auto';
let manualLock = false;
let adaptiveTier: EffectivePhysicsTier = 'medium';
let lastAppliedRate: 'default' | 'smooth' | 'cinematic' | null = null;

const MAX_STEPS: Record<EffectivePhysicsTier, number> = {
  off: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const RATE_BY_TIER: Record<EffectivePhysicsTier, 'default' | 'smooth' | 'cinematic' | null> = {
  off: null,
  low: 'default',
  medium: 'default',
  high: 'cinematic',
};

export function setUserPhysicsQuality(tier: PhysicsQualityTier): void {
  userTier = tier;
  manualLock = tier !== 'auto';
}

export function getUserPhysicsQuality(): PhysicsQualityTier {
  return userTier;
}

export function isPhysicsQualityManualLock(): boolean {
  return manualLock;
}

export function setAdaptivePhysicsTier(tier: EffectivePhysicsTier): void {
  if (tier === 'off') return;
  adaptiveTier = tier;
}

export function getAdaptivePhysicsTier(): EffectivePhysicsTier {
  return adaptiveTier;
}

export function resolveEffectivePhysicsTier(): EffectivePhysicsTier {
  if (userTier === 'off') return 'off';
  if (userTier === 'auto') return adaptiveTier;
  return userTier;
}

let templatePlaybackCap: number | null = null;
let timelinePlaybackCap: number | null = null;
let mobileRuntimeCap: number | null = null;
/** Perf governor reducePhysics → cloth/hair substep cap (viewport only). */
let governorPhysicsCap: number | null = null;

/** Limits substeps on phones (SAFE mode). */
export function setMobilePhysicsCap(maxSteps: number | null): void {
  mobileRuntimeCap = maxSteps;
  refreshScenePhysicsSubstepCaps();
}

/** Soft cap from adaptive governor when reducePhysics is set. */
export function setGovernorPhysicsCap(maxSteps: number | null): void {
  if (governorPhysicsCap === maxSteps) return;
  governorPhysicsCap = maxSteps;
  refreshScenePhysicsSubstepCaps();
}

/** Set during template dance playback — limits cloth substeps (mmd_rtx guard). */
export function setTemplatePhysicsCap(maxSteps: number | null): void {
  templatePlaybackCap = maxSteps;
  refreshScenePhysicsSubstepCaps();
}

/** Limits cloth substeps while timeline / VMD is playing (reduces 20ms+ physics spikes). */
export function setTimelinePlaybackPhysicsCap(maxSteps: number | null): void {
  timelinePlaybackCap = maxSteps;
  refreshScenePhysicsSubstepCaps();
}

export function getEffectivePhysicsMaxSteps(): number {
  const tierSteps = MAX_STEPS[resolveEffectivePhysicsTier()];
  let steps = tierSteps;
  if (templatePlaybackCap !== null) {
    steps = Math.min(steps, templatePlaybackCap);
  }
  if (timelinePlaybackCap !== null) {
    steps = Math.min(steps, timelinePlaybackCap);
  }
  if (mobileRuntimeCap !== null) {
    steps = Math.min(steps, mobileRuntimeCap);
  }
  if (governorPhysicsCap !== null) {
    steps = Math.min(steps, governorPhysicsCap);
  }
  return steps;
}

/** Only when user explicitly chose Off — adaptive never disables physics. */
export function shouldSkipPhysicsThisFrame(): boolean {
  return getUserPhysicsQuality() === 'off';
}

export function syncPhysicsRateForEffectiveTier(): void {
  const tier = resolveEffectivePhysicsTier();
  const rate = RATE_BY_TIER[tier];
  if (rate === lastAppliedRate) return;
  if (rate) {
    applyMmdPhysicsRatePreset(rate);
    lastAppliedRate = rate;
  } else {
    lastAppliedRate = null;
  }
}

export function physicsQualityToMmdPreset(
  tier: EffectivePhysicsTier
): MmdPhysicsQualityPreset | null {
  switch (tier) {
    case 'off':
      return 'safe';
    case 'low':
      return 'default';
    case 'medium':
      return 'smooth';
    case 'high':
      return 'cinematic';
    default:
      return null;
  }
}
