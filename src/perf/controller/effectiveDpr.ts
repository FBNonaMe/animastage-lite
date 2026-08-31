/**
 * Character-quality-first DPR resolution.
 *
 * Degrade levels (CPU/GPU adaptive) NEVER reduce render resolution — they only
 * gate post-FX / lighting / scene via effectiveVisualFx + renderAdaptation.
 * The ONLY source of render-scale reduction is the perf governor's last-resort
 * tiers, floored at 0.9 (desktop/tablet) / 0.85 (phone).
 */
import type { CharacterQuality, ViewportFormat } from '../types';
import {
  getCharacterQualityDpr,
  getCharacterQualityGpu,
} from '../../utils/characterQuality';
import { getEffectiveDegradeLevel } from '../effectiveDegradeLevel';
import { isModelLoadActive } from '../modelLoadProfile';
import { getMobileSafeDprScale, isMobileRuntimeCapsActive } from '../mobileRuntimeCaps';
import { getPlaybackDprFloor } from '../playbackPerfMode';
import {
  getMinGovernorRenderScale,
  getPerfGovernorFxGate,
  getPerfGovernorScale,
} from './perfGovernor';

/** Hard floor on the final canvas DPR — characters must stay readable. */
const MIN_EFFECTIVE_DPR = 0.85;

export function getEffectiveDprMultiplier(): number {
  const floor = getMinGovernorRenderScale();

  // Model load: gentle, still crisp — never the old 0.72 blur.
  if (isModelLoadActive()) return floor;

  // Governor scale is 1.0 for all FX-only tiers; ≤0.95 only in last-resort tiers.
  let mul = Math.max(getPerfGovernorScale(), floor);

  // Mobile SAFE mode is a platform baseline (native DPR on phones is 2–4×);
  // apply it, but keep the adaptive result above the readability floor.
  if (isMobileRuntimeCapsActive()) {
    mul *= getMobileSafeDprScale();
  }

  const playbackFloor = getPlaybackDprFloor();
  if (playbackFloor > 0) {
    mul = Math.max(mul, playbackFloor);
  }

  return mul;
}

export function resolveEffectiveCanvasDpr(
  quality: CharacterQuality,
  viewportFormat: ViewportFormat
): number | [number, number] {
  const base = getCharacterQualityDpr(quality, viewportFormat);
  const mul = getEffectiveDprMultiplier();

  if (mul >= 0.999) return base;

  if (Array.isArray(base)) {
    return [base[0], Math.min(2, base[1] * mul)];
  }
  return Math.max(MIN_EFFECTIVE_DPR, Math.min(2, base * mul));
}

/**
 * Shadow resolution — reduced by governor lighting tiers and degrade levels
 * BEFORE any render-scale reduction happens.
 */
export function resolveEffectiveShadowMapSize(
  quality: CharacterQuality,
  viewportFormat: ViewportFormat
): number {
  const base = getCharacterQualityGpu(quality, viewportFormat).shadowMapSize;

  const gate = getPerfGovernorFxGate();
  let size = base;
  if (gate.shadowScale < 1) {
    size = Math.max(512, Math.floor(size * gate.shadowScale));
  }

  const level = getEffectiveDegradeLevel();
  if (level >= 2) return Math.max(512, Math.floor(size * 0.5));
  if (level >= 1) return Math.max(768, Math.floor(size * 0.75));
  return size;
}
