/**
 * WHAM Motion Pipeline orchestrator — primary Video → Motion Keys backend.
 */
import { MMD_FPS } from '../../utils/playhead';
import { getWhamQualityPreset } from './qualityPresets';
import { reconstructWithWhamServer } from './backendClient';
import { reconstructLocalSequence } from './localReconstruct';
import { applyTemporalConsistency, averageJointConfidence } from './temporalSmooth';
import { stabilizeHands } from './handStabilize';
import { stabilizeLegs } from './legStabilize';
import { recoverRootMotion } from './rootMotion';
import { refineMotionSequence } from './refine';
import { applyIkPass } from './ikPass';
import { sequenceToMotionSpec, finalizeWhamMotionSpec } from './toMotionSpec';
import { generateTimelineKeysFromSpec } from './keyframeGen';
import { applyPostToolToSequence } from './postTools';
import type {
  WhamPipelineOptions,
  WhamPipelineResult,
  WhamProgress,
  WhamQualityMode,
} from './types';

export async function runWhamMotionPipeline(
  file: File,
  options: WhamPipelineOptions = {},
  onProgress?: (p: WhamProgress) => void
): Promise<WhamPipelineResult> {
  const quality: WhamQualityMode = options.quality ?? 'balanced';
  const preset = getWhamQualityPreset(quality);
  const preferServer = options.preferServer ?? preset.preferServer;
  const maxFrames = options.maxFrames ?? Math.ceil(600 * MMD_FPS);

  onProgress?.({ phase: 'ingest', progress: 0.01, message: 'Importing video…' });

  let sequence =
    preferServer
      ? await reconstructWithWhamServer(file, quality, onProgress, options.serverUrl)
      : null;

  if (!sequence) {
    sequence = await reconstructLocalSequence(file, preset, onProgress);
  }

  onProgress?.({
    phase: 'stabilize_hands',
    progress: 0.62,
    message: 'Hand stabilization…',
  });
  sequence = applyTemporalConsistency(sequence, preset.temporalAlpha);
  sequence = stabilizeHands(sequence, preset.handPasses);

  onProgress?.({
    phase: 'stabilize_legs',
    progress: 0.7,
    message: 'Leg & foot stabilization…',
  });
  sequence = stabilizeLegs(sequence, preset.legPasses);

  onProgress?.({
    phase: 'root_motion',
    progress: 0.76,
    message: 'Recovering root motion…',
  });
  sequence = recoverRootMotion(sequence, preset.velocityFilter);

  onProgress?.({
    phase: 'refine',
    progress: 0.82,
    message: 'Motion cleanup & trajectory optimize…',
  });
  sequence = refineMotionSequence(sequence, preset.velocityFilter);

  if (options.postTools?.length) {
    for (const tool of options.postTools) {
      sequence = applyPostToolToSequence(sequence, tool);
    }
  }

  onProgress?.({ phase: 'ik', progress: 0.88, message: 'IK reconstruction…' });
  sequence = applyIkPass(sequence);

  onProgress?.({ phase: 'curves', progress: 0.91, message: 'Bezier curve fitting…' });
  let motionSpec = finalizeWhamMotionSpec(
    sequenceToMotionSpec(sequence, file.name.replace(/\.[^.]+$/, '') || 'wham_motion')
  );

  onProgress?.({ phase: 'keys', progress: 0.94, message: 'Generating keyframes…' });
  const frameCap = Math.min(
    maxFrames,
    Math.max(1, Math.ceil(sequence.duration * MMD_FPS) + 1)
  );
  const keyframes = generateTimelineKeysFromSpec(
    motionSpec,
    frameCap,
    preset.keyReduceTol
  );

  onProgress?.({
    phase: 'retarget',
    progress: 0.97,
    message: 'Retargeting to studio humanoid…',
  });
  motionSpec = finalizeWhamMotionSpec(motionSpec);

  const jointConfidence = averageJointConfidence(sequence.frames);

  onProgress?.({
    phase: 'done',
    progress: 1,
    message: `WHAM done — ${keyframes.length} keys · ${sequence.source}`,
  });

  return {
    sequence,
    motionSpec,
    keyframes,
    jointConfidence,
    source: sequence.source,
    quality,
    meta: {
      duration: sequence.duration,
      sampleFps: sequence.sampleFps,
      aspect: sequence.aspect,
      keyCount: keyframes.length,
      frameCount: sequence.frames.length,
    },
  };
}
