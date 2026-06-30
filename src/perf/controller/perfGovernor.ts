/**
 * Adaptive performance governor — ported from AnimaStage Pro (mmd_rtx.html).
 * Lowers internal render scale when FPS drops; restores when headroom returns.
 * User FX toggles are respected — governor only subtracts under stress.
 */
import { isModelLoadActive } from '../modelLoadProfile';
import { getPlaybackGovernorTierCap } from '../playbackPerfMode';
import { isRecordingCapture } from '../../video/recordingCapture';

export interface LitePerfGovernorTier {
  scale: number;
  allowGodRays: boolean;
  allowSsao: boolean;
}

/**
 * Quality-first tiers: lower FX before crushing resolution (min ~78% — avoids blur from stacked downscales).
 * Extra steps only trim god rays / SSAO / bloom via effectiveVisualFx.
 */
export const MIN_GOVERNOR_RENDER_SCALE = 0.78;

export const LITE_PERF_GOVERNOR_TIERS: LitePerfGovernorTier[] = [
  { scale: 1.0, allowGodRays: true, allowSsao: true },
  { scale: 0.94, allowGodRays: true, allowSsao: true },
  { scale: 0.88, allowGodRays: true, allowSsao: false },
  { scale: 0.84, allowGodRays: false, allowSsao: false },
  { scale: MIN_GOVERNOR_RENDER_SCALE, allowGodRays: false, allowSsao: false },
];

/** Drop a tier only when clearly below 60 FPS; recover conservatively. */
const LOW_FPS = 54;
const HIGH_FPS = 66;
const COOLDOWN_MS = 1400;

let autoEnabled = true;
let tier = 0;
let triangleFloorTier = 0;
let lastChangeMs = 0;

export function setPerfGovernorTriangleFloor(floor: number): void {
  const max = LITE_PERF_GOVERNOR_TIERS.length - 1;
  triangleFloorTier = Math.max(0, Math.min(max, floor | 0));
  tier = Math.max(tier, triangleFloorTier);
}

export function tickPerfGovernor(fps: number, now: number, recordingActive = false): void {
  if (!autoEnabled || recordingActive || isModelLoadActive()) return;
  if (now - lastChangeMs < COOLDOWN_MS) return;

  const tierCap = getPlaybackGovernorTierCap();
  let newTier = tier;
  if (fps < LOW_FPS && tier < tierCap) {
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

export function getPerfGovernorScale(): number {
  const scale = LITE_PERF_GOVERNOR_TIERS[tier]?.scale ?? 1;
  return Math.max(MIN_GOVERNOR_RENDER_SCALE, scale);
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
  const cuts: string[] = [];
  const gate = getPerfGovernorFxGate();
  if (!gate.allowGodRays) cuts.push('rays');
  if (!gate.allowSsao) cuts.push('ssao');
  return cuts.length ? `Auto ${pct}% −${cuts.join('/')}` : `Auto ${pct}%`;
}
