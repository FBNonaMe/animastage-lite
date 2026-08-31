/**
 * One-click AUTO CLEAN MOTION — jitter, outliers, feet, root, limits, hold gaps.
 */
import type { WhamPoseSequence } from '../wham/types';
import { applyTemporalConsistency, clampAngularVelocity } from '../wham/temporalSmooth';
import { stabilizeHands } from '../wham/handStabilize';
import { stabilizeLegs } from '../wham/legStabilize';
import { recoverRootMotion } from '../wham/rootMotion';
import { refineMotionSequence } from '../wham/refine';
import { WHAM_HAND_JOINTS } from '../wham/types';
import { applyConfidenceGate } from './confidenceGate';
import { applyHoldLastPose } from './holdLastPose';
import { applyFootLock } from './footLock';
import { applyOutlierFilter } from './outlierFilter';
import { applyAnatomicalLimits } from './anatomicalLimits';
import type { FootLockSettings, ConfidenceGateSettings } from '../engine/types';

export interface AutoCleanOptions {
  footLock?: Partial<FootLockSettings>;
  confidence?: Partial<ConfidenceGateSettings>;
  intensity?: 'low' | 'medium' | 'high' | 'maximum';
}

export interface AutoCleanResult {
  sequence: WhamPoseSequence;
  correctedJoints: number;
  correctedRoot: number;
}

export function autoCleanMotion(
  sequence: WhamPoseSequence,
  options: AutoCleanOptions = {}
): AutoCleanResult {
  const intensity = options.intensity ?? 'high';
  const passes =
    intensity === 'low' ? 1 : intensity === 'medium' ? 2 : intensity === 'high' ? 3 : 4;

  let s = applyHoldLastPose(sequence);
  s = applyConfidenceGate(s, options.confidence);

  const outliers = applyOutlierFilter(s, intensity === 'maximum' ? 360 : 420);
  s = outliers.sequence;

  s = applyTemporalConsistency(
    s,
    intensity === 'low' ? 0.38 : intensity === 'medium' ? 0.28 : 0.18
  );
  s = clampAngularVelocity(s, 200, WHAM_HAND_JOINTS);
  s = stabilizeHands(s, passes);
  s = stabilizeLegs(s, passes);
  s = applyFootLock(s, options.footLock);
  s = recoverRootMotion(s, intensity === 'maximum' ? 0.75 : 0.55);
  s = refineMotionSequence(s, intensity === 'maximum' ? 0.72 : 0.55);
  s = applyAnatomicalLimits(s);

  return {
    sequence: s,
    correctedJoints: outliers.stats.correctedJoints,
    correctedRoot: outliers.stats.correctedRoot,
  };
}
