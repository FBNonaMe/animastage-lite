import type { ReferenceCameraAnalysis } from '../types';
import type { CinematicCameraMode } from '../types';

/**
 * Reference video analysis — extracts mood/motion metadata only (no asset copying).
 * Full CV pipeline can replace this stub; API shape is stable for UI integration.
 */
export async function analyzeReferenceVideo(
  _file: File
): Promise<ReferenceCameraAnalysis> {
  return {
    motionCurve: [0.2, 0.35, 0.5, 0.65, 0.8, 0.7, 0.55, 0.4],
    avgFov: 42,
    mood: 'warm',
    palette: [
      [1, 0.85, 0.7],
      [0.4, 0.6, 0.9],
      [0.2, 0.15, 0.25],
    ],
    suggestedMode: 'showcase' as CinematicCameraMode,
  };
}

export function referenceAnalysisToCameraMode(analysis: ReferenceCameraAnalysis): CinematicCameraMode {
  return analysis.suggestedMode;
}
