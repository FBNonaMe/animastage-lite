/**
 * Apply Mocap 2.0 post stages on a WHAM sequence (shared by all engines).
 */
import type { WhamPoseSequence } from '../wham/types';
import type { MocapEngineOptions, MocapSmoothingMode } from '../engine/types';
import { applyTemporalConsistency } from '../wham/temporalSmooth';
import { applyHoldLastPose } from './holdLastPose';
import { applyConfidenceGate } from './confidenceGate';
import { applyFootLock } from './footLock';
import { applyOutlierFilter } from './outlierFilter';
import { applyAnatomicalLimits } from './anatomicalLimits';

function smoothingAlpha(mode: MocapSmoothingMode | undefined): number | null {
  switch (mode) {
    case 'none':
      return null;
    case 'light':
      return 0.4;
    case 'medium':
      return 0.28;
    case 'strong':
      return 0.18;
    case 'cinematic':
      return 0.12;
    default:
      return 0.28;
  }
}

export interface Mocap2PostResult {
  sequence: WhamPoseSequence;
  correctedJoints: number;
  correctedRoot: number;
}

export function applyMocap2PostProcess(
  sequence: WhamPoseSequence,
  options: MocapEngineOptions = {}
): Mocap2PostResult {
  let s = applyHoldLastPose(sequence);
  s = applyConfidenceGate(s, options.confidence);

  const outliers = applyOutlierFilter(s);
  s = outliers.sequence;

  const alpha = smoothingAlpha(options.smoothing);
  if (alpha != null) {
    s = applyTemporalConsistency(s, alpha);
  }

  s = applyFootLock(s, options.footLock);
  s = applyAnatomicalLimits(s);

  if (options.rootMotion && options.rootMotion.enabled === false) {
    // Zero horizontal root delta while keeping vertical soft settle
    const frames = s.frames.map((f, i) => {
      if (i === 0) return f;
      return {
        ...f,
        root: {
          ...f.root,
          position: [
            s.frames[0]!.root.position[0],
            f.root.position[1],
            s.frames[0]!.root.position[2],
          ] as [number, number, number],
          velocity: [0, f.root.velocity[1], 0] as [number, number, number],
        },
      };
    });
    s = { ...s, frames };
  }

  return {
    sequence: s,
    correctedJoints: outliers.stats.correctedJoints,
    correctedRoot: outliers.stats.correctedRoot,
  };
}
