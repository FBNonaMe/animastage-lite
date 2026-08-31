/**
 * Adaptive performance governor — character-quality-first rewrite.
 *
 * Reduction priority (never sacrifice character sharpness early):
 *   1. Post-processing   (chromatic aberration, god rays, DOF, SSAO, heavy bloom)
 *   2. Lighting          (shadow resolution, reflections)
 *   3. Distant scene     (weather, particles)
 *   4. Physics           (substeps via adaptive tier)
 *   5. Render scale      (LAST — small steps, hard device floor)
 *
 * Render scale never drops below 0.9 (desktop/tablet) or 0.85 (phone).
 */
import { isModelLoadActive } from '../modelLoadProfile';
import { getPlaybackGovernorTierCap } from '../playbackPerfMode';

export interface LitePerfGovernorTier {
  /** DPR multiplier — 1.0 for all FX-only tiers; reduced only in last-resort tiers. */
  scale: number;
  /* Priority 2 — post-processing */
  allowGodRays: boolean;
  allowSsao: boolean;
  allowChromaticAberration: boolean;
  allowDof: boolean;
  /** Cap on bloom intensity (null = user value untouched). */
  bloomIntensityCap: number | null;
  /* Priority 3 — lighting */
  shadowScale: number;
  allowShadows: boolean;
  reflectionCap: number | null;
  /* Priority 4 — distant scene */
  allowWeather: boolean;
  allowParticles: boolean;
  /* Priority 5 — physics hint (consumed by adaptive physics) */
  reducePhysics: boolean;
}

/** Phone detection for the last-resort render-scale floor. */
function isPhoneDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const phone = /Android.+Mobile|iPhone|Mobile Safari/i.test(ua);
  const smallScreen =
    typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 768;
  return phone && smallScreen;
}

/** Hard floor for the adaptive render-scale multiplier — characters stay crisp. */
export function getMinGovernorRenderScale(): number {
  return isPhoneDevice() ? 0.85 : 0.9;
}

/** Back-compat export — absolute lowest scale any device may reach. */
export const MIN_GOVERNOR_RENDER_SCALE = 0.85;

const FULL: Omit<LitePerfGovernorTier, 'scale'> = {
  allowGodRays: true,
  allowSsao: true,
  allowChromaticAberration: true,
  allowDof: true,
  bloomIntensityCap: null,
  shadowScale: 1,
  allowShadows: true,
  reflectionCap: null,
  allowWeather: true,
  allowParticles: true,
  reducePhysics: false,
};

export const LITE_PERF_GOVERNOR_TIERS: LitePerfGovernorTier[] = [
  // T0 — full quality
  { scale: 1, ...FULL },
  // T1 — cheap post-FX wins: chromatic aberration + god rays
  { scale: 1, ...FULL, allowChromaticAberration: false, allowGodRays: false },
  // T2 — heavier post-FX: SSAO off, DOF off, bloom capped
  {
    scale: 1,
    ...FULL,
    allowChromaticAberration: false,
    allowGodRays: false,
    allowSsao: false,
    allowDof: false,
    bloomIntensityCap: 0.3,
  },
  // T3 — lighting: half shadow resolution, reflections trimmed
  {
    scale: 1,
    ...FULL,
    allowChromaticAberration: false,
    allowGodRays: false,
    allowSsao: false,
    allowDof: false,
    bloomIntensityCap: 0.3,
    shadowScale: 0.5,
    reflectionCap: 0.35,
  },
  // T4 — distant scene + physics: weather/particles off, shadows off, physics reduced
  {
    scale: 1,
    ...FULL,
    allowChromaticAberration: false,
    allowGodRays: false,
    allowSsao: false,
    allowDof: false,
    bloomIntensityCap: 0.25,
    shadowScale: 0.5,
    allowShadows: false,
    reflectionCap: 0.25,
    allowWeather: false,
    allowParticles: false,
    reducePhysics: true,
  },
  // T5 — LAST RESORT: first gentle render-scale step
  {
    scale: 0.95,
    ...FULL,
    allowChromaticAberration: false,
    allowGodRays: false,
    allowSsao: false,
    allowDof: false,
    bloomIntensityCap: 0.2,
    shadowScale: 0.5,
    allowShadows: false,
    reflectionCap: 0.2,
    allowWeather: false,
    allowParticles: false,
    reducePhysics: true,
  },
  // T6 — absolute floor (0.9 desktop/tablet, 0.85 phone)
  {
    scale: 0.9, // replaced at read time by getMinGovernorRenderScale()
    ...FULL,
    allowChromaticAberration: false,
    allowGodRays: false,
    allowSsao: false,
    allowDof: false,
    bloomIntensityCap: 0.2,
    shadowScale: 0.5,
    allowShadows: false,
    reflectionCap: 0.2,
    allowWeather: false,
    allowParticles: false,
    reducePhysics: true,
  },
];

const MAX_TIER = LITE_PERF_GOVERNOR_TIERS.length - 1;

/** Drop a tier only when clearly below 60 FPS; recover conservatively. */
const LOW_FPS = 54;
const HIGH_FPS = 66;
const COOLDOWN_MS = 1400;
/** Extra patience before entering the render-scale tiers (5+). */
const SCALE_TIER_ENTRY_COOLDOWN_MS = 3200;
const FIRST_SCALE_TIER = 5;

let autoEnabled = true;
let tier = 0;
let triangleFloorTier = 0;
let lastChangeMs = 0;

export function setPerfGovernorTriangleFloor(floor: number): void {
  triangleFloorTier = Math.max(0, Math.min(MAX_TIER, floor | 0));
  tier = Math.max(tier, triangleFloorTier);
}

export function tickPerfGovernor(fps: number, now: number, recordingActive = false): void {
  if (!autoEnabled || recordingActive || isModelLoadActive()) return;
  if (now - lastChangeMs < COOLDOWN_MS) return;

  const tierCap = getPlaybackGovernorTierCap();
  let newTier = tier;

  if (fps < LOW_FPS && tier < tierCap) {
    // Entering render-scale territory requires sustained stress — FX cuts get more time to help.
    if (tier + 1 >= FIRST_SCALE_TIER && now - lastChangeMs < SCALE_TIER_ENTRY_COOLDOWN_MS) {
      return;
    }
    newTier += 1;
  } else if (fps > HIGH_FPS && tier > triangleFloorTier) {
    newTier -= 1;
  }

  newTier = Math.min(newTier, tierCap);
  newTier = Math.max(newTier, triangleFloorTier);

  if (newTier !== tier) {
    tier = newTier;
    lastChangeMs = now;
  }
}

export function getPerfGovernorTier(): number {
  return tier;
}

/** Target render-scale multiplier — 1.0 unless FX/lighting/scene/physics cuts were insufficient. */
export function getPerfGovernorScale(): number {
  const raw = LITE_PERF_GOVERNOR_TIERS[tier]?.scale ?? 1;
  if (raw >= 0.999) return 1;
  const floor = getMinGovernorRenderScale();
  return Math.max(floor, raw >= 0.95 ? raw : floor);
}

export function getPerfGovernorFxGate(): LitePerfGovernorTier {
  return LITE_PERF_GOVERNOR_TIERS[tier] ?? LITE_PERF_GOVERNOR_TIERS[0]!;
}

export function isPerfGovernorAutoEnabled(): boolean {
  return autoEnabled;
}

export function setPerfGovernorAuto(enabled: boolean): void {
  autoEnabled = enabled;
  if (!enabled) {
    tier = 0;
    lastChangeMs = 0;
  }
}

export function togglePerfGovernorAuto(): boolean {
  setPerfGovernorAuto(!autoEnabled);
  return autoEnabled;
}

export function resetPerfGovernor(): void {
  tier = triangleFloorTier;
  lastChangeMs = 0;
}

export function getPerfGovernorBadgeLabel(): string {
  if (!autoEnabled) return 'Auto off';
  const pct = Math.round(getPerfGovernorScale() * 100);
  const gate = getPerfGovernorFxGate();
  const cuts: string[] = [];
  if (!gate.allowGodRays) cuts.push('rays');
  if (!gate.allowSsao) cuts.push('ssao');
  if (!gate.allowShadows) cuts.push('shadows');
  if (!gate.allowWeather) cuts.push('weather');
  return cuts.length ? `Auto ${pct}% −${cuts.join('/')}` : `Auto ${pct}%`;
}
