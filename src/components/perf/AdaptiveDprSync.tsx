import { useThree, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { CharacterQuality, ViewportFormat } from '../../types';
import { resolveEffectiveCanvasDpr } from '../../perf/controller/effectiveDpr';
import { getPortraitStressDprCap } from '../../perf/scenePerfPolicy';

/** Minimum interval between actual setPixelRatio calls (resizes render target). */
const DPR_APPLY_INTERVAL_MS = 450;
/** Maximum DPR movement per apply — transitions spread over ~1–2s, no visible jump. */
const DPR_MAX_STEP = 0.05;
/** Ignore sub-perceptual differences. */
const DPR_EPSILON = 0.008;

interface AdaptiveDprSyncProps {
  characterQuality: CharacterQuality;
  viewportFormat: ViewportFormat;
  portraitLite?: boolean;
  rtxEnabled?: boolean;
  templateMotion?: boolean;
  /** Hard cap while LIVE MediaRecorder is running. */
  liveRecordingCap?: number;
}

/**
 * Smart pixel ratio — applies adaptive DPR with smooth stepping.
 * Never snaps between quality levels: each apply moves at most DPR_MAX_STEP
 * toward the target, so resolution changes are imperceptible.
 */
export function AdaptiveDprSync({
  characterQuality,
  viewportFormat,
  portraitLite = false,
  rtxEnabled = false,
  templateMotion = false,
  liveRecordingCap,
}: AdaptiveDprSyncProps) {
  const { gl } = useThree();
  const lastApplied = useRef(-1);
  const lastChangeMs = useRef(0);

  useFrame(() => {
    const dprSpec = resolveEffectiveCanvasDpr(characterQuality, viewportFormat);
    const target =
      typeof dprSpec === 'number'
        ? dprSpec
        : Math.min(window.devicePixelRatio || 1, dprSpec[1]);

    const stressCap = getPortraitStressDprCap(viewportFormat, rtxEnabled, templateMotion);
    let capped = Math.min(target, portraitLite ? stressCap : 2);
    if (liveRecordingCap != null && liveRecordingCap > 0) {
      capped = Math.min(capped, liveRecordingCap);
    }

    // First frame — apply immediately so the canvas starts at the right resolution.
    if (lastApplied.current <= 0) {
      const initial = Math.round(capped * 1000) / 1000;
      gl.setPixelRatio(initial);
      lastApplied.current = initial;
      lastChangeMs.current = performance.now();
      return;
    }

    const delta = capped - lastApplied.current;
    if (Math.abs(delta) < DPR_EPSILON) return;

    const now = performance.now();
    if (now - lastChangeMs.current < DPR_APPLY_INTERVAL_MS) return;

    // Smooth interpolation — step toward target, never jump.
    const step = Math.sign(delta) * Math.min(Math.abs(delta), DPR_MAX_STEP);
    const next = Math.round((lastApplied.current + step) * 1000) / 1000;

    gl.setPixelRatio(next);
    lastApplied.current = next;
    lastChangeMs.current = now;
  });

  return null;
}

export default AdaptiveDprSync;
