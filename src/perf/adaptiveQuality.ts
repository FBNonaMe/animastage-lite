import {
  ADAPTIVE_RECOVER_FRAMES,
  ADAPTIVE_STRESS_FRAMES,
  ADAPTIVE_TIER_COOLDOWN_MS,
  FRAME_BUDGET_WARN_MS,
} from './perfConstants';
import {
  getAdaptivePhysicsTier,
  getUserPhysicsQuality,
  isPhysicsQualityManualLock,
  resolveEffectivePhysicsTier,
  setAdaptivePhysicsTier,
  syncPhysicsRateForEffectiveTier,
  type EffectivePhysicsTier,
} from './physicsQualityControl';
import { getPlaybackDegradeCap } from './playbackPerfMode';

let stressStreak = 0;
let recoverStreak = 0;
let degradeLevel = 0;
let degrading = false;
let degradeMessage: string | null = null;
let lastTierChangeMs = 0;
let lastDegradeChangeMs = 0;

const TIER_ORDER: EffectivePhysicsTier[] = ['high', 'medium', 'low'];

export function getDegradeLevel(): number {
  return degradeLevel;
}

export function isDegradingLoad(): boolean {
  return degrading;
}

export function getDegradeMessage(): string | null {
  return degradeMessage;
}

function tierIndex(t: EffectivePhysicsTier): number {
  if (t === 'off') return TIER_ORDER.length;
  return TIER_ORDER.indexOf(t);
}

function downgradeTier(t: EffectivePhysicsTier): EffectivePhysicsTier {
  const i = tierIndex(t);
  if (i >= TIER_ORDER.length - 1) return 'low';
  return TIER_ORDER[i + 1]!;
}

function upgradeTier(t: EffectivePhysicsTier): EffectivePhysicsTier {
  const i = tierIndex(t);
  if (i <= 0) return 'high';
  return TIER_ORDER[i - 1]!;
}

function canChangeTier(now: number): boolean {
  return now - lastTierChangeMs >= ADAPTIVE_TIER_COOLDOWN_MS;
}

/** Only call when physics quality is Auto — avoids fighting manual Off/Low/Med/High. */
export function tickAdaptiveQuality(frameMs: number): void {
  if (getUserPhysicsQuality() !== 'auto') {
    return;
  }

  const now = performance.now();
  const over = frameMs > FRAME_BUDGET_WARN_MS;

  if (over) {
    stressStreak += 1;
    recoverStreak = 0;
  } else if (frameMs < FRAME_BUDGET_WARN_MS * 0.88) {
    recoverStreak += 1;
    stressStreak = Math.max(0, stressStreak - 1);
  } else {
    stressStreak = Math.max(0, stressStreak - 1);
  }

  // Character-quality-first: physics is priority 5 — downgrade only after
  // visual cuts (degrade L2+) have already been applied and stress persists.
  if (
    !isPhysicsQualityManualLock() &&
    degradeLevel >= 2 &&
    stressStreak >= ADAPTIVE_STRESS_FRAMES &&
    canChangeTier(now)
  ) {
    const cur = getAdaptivePhysicsTier();
    const next = downgradeTier(cur);
    if (next !== cur) {
      setAdaptivePhysicsTier(next);
      syncPhysicsRateForEffectiveTier();
      lastTierChangeMs = now;
      degrading = true;
      degradeMessage = 'Frame budget exceeded → reducing physics';
      stressStreak = 0;
    }
  }

  if (
    !isPhysicsQualityManualLock() &&
    recoverStreak >= ADAPTIVE_RECOVER_FRAMES &&
    getAdaptivePhysicsTier() !== 'high' &&
    canChangeTier(now)
  ) {
    const cur = getAdaptivePhysicsTier();
    const next = upgradeTier(cur);
    setAdaptivePhysicsTier(next);
    syncPhysicsRateForEffectiveTier();
    lastTierChangeMs = now;
    recoverStreak = 0;
    degrading = false;
    degradeMessage = null;
  }

  const degradeCap = getPlaybackDegradeCap();
  if (over && degradeLevel < degradeCap && now - lastDegradeChangeMs >= ADAPTIVE_TIER_COOLDOWN_MS) {
    degradeLevel = Math.min(degradeCap, degradeLevel + 1);
    lastDegradeChangeMs = now;
    degrading = true;
    degradeMessage = 'Frame budget exceeded → reducing load';
  } else if (
    !over &&
    recoverStreak > ADAPTIVE_RECOVER_FRAMES / 3 &&
    now - lastDegradeChangeMs >= ADAPTIVE_TIER_COOLDOWN_MS
  ) {
    const prev = degradeLevel;
    degradeLevel = Math.max(0, degradeLevel - 1);
    if (degradeLevel < prev) {
      lastDegradeChangeMs = now;
    }
    if (degradeLevel === 0) {
      degrading = false;
      degradeMessage = null;
    }
  }

  if (!over && degradeLevel === 0 && stressStreak === 0) {
    degrading = false;
    degradeMessage = null;
  }

  void resolveEffectivePhysicsTier();
}

export function resetAdaptiveQuality(): void {
  stressStreak = 0;
  recoverStreak = 0;
  degradeLevel = 0;
  degrading = false;
  degradeMessage = null;
  lastTierChangeMs = 0;
  lastDegradeChangeMs = 0;
  setAdaptivePhysicsTier('medium');
}
