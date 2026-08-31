/**
 * Export reconstructed motion as JSON / download helpers.
 * VMD goes through existing editor/vmdExport when timeline keys are applied.
 */
import type { TimelineKeyframe } from '../../types';
import type { MotionSpec } from '../../ai/motionSpec';
import type { WhamPipelineResult, WhamPoseSequence } from './types';

export interface WhamJsonAnimation {
  format: 'animastage-wham-json';
  version: 1;
  name: string;
  duration: number;
  fps: number;
  source: string;
  quality: string;
  motionSpec: MotionSpec;
  keyframes: TimelineKeyframe[];
  jointConfidence: WhamPipelineResult['jointConfidence'];
}

export function buildWhamJsonAnimation(result: WhamPipelineResult): WhamJsonAnimation {
  return {
    format: 'animastage-wham-json',
    version: 1,
    name: result.motionSpec.name,
    duration: result.meta.duration,
    fps: result.meta.sampleFps,
    source: result.source,
    quality: result.quality,
    motionSpec: result.motionSpec,
    keyframes: result.keyframes,
    jointConfidence: result.jointConfidence,
  };
}

export function downloadWhamJson(result: WhamPipelineResult, filename?: string): void {
  const payload = buildWhamJsonAnimation(result);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${payload.name || 'wham_motion'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** BVH-lite text export from pose sequence (humanoid Euler approximation). */
export function sequenceToBvh(sequence: WhamPoseSequence, name = 'WHAM'): string {
  const fps = sequence.sampleFps || 30;
  const frames = sequence.frames;
  const lines: string[] = [];
  lines.push('HIERARCHY');
  lines.push('ROOT Hips');
  lines.push('{');
  lines.push('  OFFSET 0.0 0.0 0.0');
  lines.push('  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation');
  lines.push('  JOINT Spine');
  lines.push('  {');
  lines.push('    OFFSET 0.0 0.2 0.0');
  lines.push('    CHANNELS 3 Zrotation Xrotation Yrotation');
  lines.push('    End Site');
  lines.push('    {');
  lines.push('      OFFSET 0.0 0.2 0.0');
  lines.push('    }');
  lines.push('  }');
  lines.push('}');
  lines.push('MOTION');
  lines.push(`Frames: ${frames.length}`);
  lines.push(`Frame Time: ${(1 / fps).toFixed(6)}`);
  for (const f of frames) {
    const [px, py, pz] = f.root.position;
    const [rx, ry, rz] = f.root.rotation;
    const spine = f.joints.spine?.rotation ?? [0, 0, 0];
    lines.push(
      `${px.toFixed(4)} ${py.toFixed(4)} ${pz.toFixed(4)} ${rz.toFixed(2)} ${rx.toFixed(2)} ${ry.toFixed(2)} ${spine[2]!.toFixed(2)} ${spine[0]!.toFixed(2)} ${spine[1]!.toFixed(2)}`
    );
  }
  void name;
  return lines.join('\n');
}

export function downloadBvh(sequence: WhamPoseSequence, filename = 'wham_motion.bvh'): void {
  const blob = new Blob([sequenceToBvh(sequence)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
