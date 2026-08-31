/**
 * Mocap 2.0 smoke — confidence gate, hold-last, foot lock, outliers, .md roundtrip.
 * Run: npx tsx scripts/mocap2-smoke.ts
 */
import assert from 'node:assert/strict';
import type { WhamFrame, WhamPoseSequence } from '../src/mocap/wham/types.ts';
import { applyConfidenceGate } from '../src/mocap/pipeline/confidenceGate.ts';
import { applyHoldLastPose } from '../src/mocap/pipeline/holdLastPose.ts';
import { applyFootLock, extractFootContacts } from '../src/mocap/pipeline/footLock.ts';
import { applyOutlierFilter } from '../src/mocap/pipeline/outlierFilter.ts';
import { applyAnatomicalLimits } from '../src/mocap/pipeline/anatomicalLimits.ts';
import { autoCleanMotion } from '../src/mocap/pipeline/autoCleanup.ts';
import {
  buildAsMdDocument,
  parseAsMdDocument,
} from '../src/mocap/normalized/motionDocument.ts';
import { buildMocapQualityReport } from '../src/mocap/pipeline/qualityReport.ts';
import type { WhamPipelineResult } from '../src/mocap/wham/types.ts';
import { resolveWhamQuality, engineForceLocal } from '../src/mocap/engine/types.ts';

function frame(
  i: number,
  opts?: {
    handConf?: number;
    handRot?: [number, number, number];
    footPos?: [number, number, number];
  }
): WhamFrame {
  const handConf = opts?.handConf ?? 0.9;
  const handRot = opts?.handRot ?? [10, 0, 0];
  const footPos = opts?.footPos ?? [0.1, 0, i * 0.001];
  return {
    time: i / 30,
    frame: i,
    root: {
      position: [0, 0, i * 0.01],
      rotation: [0, 0, 0],
      velocity: [0, 0, 0.3],
      acceleration: [0, 0, 0],
    },
    joints: {
      hips: { rotation: [0, 0, 0], confidence: 0.95 },
      leftHand: { rotation: handRot, confidence: handConf, position: [0.3, 1, 0] },
      rightHand: { rotation: [0, 0, 0], confidence: 0.9 },
      leftFoot: { rotation: [0, 0, 0], confidence: 0.9, position: footPos },
      rightFoot: {
        rotation: [0, 0, 0],
        confidence: 0.9,
        position: [-0.1, 0, i * 0.001],
      },
      leftLowerArm: { rotation: [40, 0, 0], confidence: 0.85 },
      leftLowerLeg: { rotation: [20, 0, 0], confidence: 0.85 },
      neck: { rotation: [5, 0, 0], confidence: 0.9 },
      head: { rotation: [0, 10, 0], confidence: 0.9 },
    },
  };
}

function makeSeq(frames: WhamFrame[]): WhamPoseSequence {
  return {
    frames,
    duration: frames.length / 30,
    sampleFps: 30,
    width: 720,
    height: 1280,
    aspect: '9:16',
    source: 'wham-local',
  };
}

{
  assert.equal(resolveWhamQuality('maximum'), 'cinema');
  assert.equal(engineForceLocal('landmark'), true);
  assert.equal(engineForceLocal('wham'), false);
}

{
  const seq = makeSeq([
    frame(0, { handConf: 0.95 }),
    frame(1, { handConf: 0.1, handRot: [90, 0, 0] }),
    frame(2, { handConf: 0.95, handRot: [12, 0, 0] }),
  ]);
  const gated = applyConfidenceGate(seq, { low: 0.28 });
  const mid = gated.frames[1]!.joints.leftHand!;
  assert.ok(mid.rotation[0]! < 50, 'low confidence should hold / damp jump');
}

{
  const seq = makeSeq([
    frame(0, { handConf: 0.95, handRot: [15, 0, 0] }),
    frame(1, { handConf: 0.05 }),
    frame(2, { handConf: 0.05 }),
    frame(3, { handConf: 0.95, handRot: [20, 0, 0] }),
  ]);
  // Remove joint on frame 1-2 to simulate loss
  delete seq.frames[1]!.joints.leftHand;
  delete seq.frames[2]!.joints.leftHand;
  const held = applyHoldLastPose(seq);
  assert.ok(held.frames[1]!.joints.leftHand, 'hold last pose fills gap');
  assert.ok(held.frames[2]!.joints.leftHand, 'hold last pose fills gap 2');
}

{
  const frames: WhamFrame[] = [];
  for (let i = 0; i < 20; i++) {
    frames.push(
      frame(i, {
        footPos: [0.1, 0, i < 10 ? 0 : (i - 10) * 0.02],
      })
    );
  }
  const locked = applyFootLock(makeSeq(frames), {
    enabled: true,
    strength: 0.9,
    contactThreshold: 0.05,
    releaseSpeed: 0.4,
  });
  const contacts = extractFootContacts(locked, 0.05);
  assert.ok(contacts.length > 0);
}

{
  const seq = makeSeq([
    frame(0, { handRot: [0, 0, 0] }),
    frame(1, { handRot: [170, 0, 0] }),
    frame(2, { handRot: [10, 0, 0] }),
  ]);
  const { sequence, stats } = applyOutlierFilter(seq, 200);
  assert.ok(stats.correctedJoints >= 1);
  assert.ok(sequence.frames[1]!.joints.leftHand!.rotation[0]! < 100);
}

{
  const seq = makeSeq([
    frame(0),
    {
      ...frame(1),
      joints: {
        ...frame(1).joints,
        leftLowerArm: { rotation: [200, 0, 0], confidence: 1 },
      },
    },
  ]);
  const limited = applyAnatomicalLimits(seq);
  assert.ok(limited.frames[1]!.joints.leftLowerArm!.rotation[0]! <= 145);
}

{
  const seq = makeSeq(Array.from({ length: 12 }, (_, i) => frame(i)));
  const cleaned = autoCleanMotion(seq, { intensity: 'medium' });
  assert.equal(cleaned.sequence.frames.length, 12);
}

{
  const seq = makeSeq(Array.from({ length: 8 }, (_, i) => frame(i)));
  const fakeResult: WhamPipelineResult = {
    sequence: seq,
    motionSpec: {
      name: 'smoke',
      duration: seq.duration,
      loop: false,
      tracks: {},
    },
    keyframes: [
      { id: 'k1', frame: 0, track: 'bone_head_y', value: 0 },
      { id: 'k2', frame: 10, track: 'bone_head_y', value: 5 },
    ],
    jointConfidence: { hips: 0.9, leftHand: 0.8 },
    source: 'wham-local',
    quality: 'balanced',
    meta: {
      duration: seq.duration,
      sampleFps: 30,
      aspect: '9:16',
      keyCount: 2,
      frameCount: 8,
    },
  };
  const report = buildMocapQualityReport(fakeResult, { processingTimeMs: 12 });
  assert.ok(['excellent', 'good', 'fair', 'poor'].includes(report.trackingQuality));

  const doc = buildAsMdDocument(fakeResult, { engine: 'landmark', qualityReport: report });
  const round = parseAsMdDocument(JSON.parse(JSON.stringify(doc)));
  assert.equal(round.kind, 'animastage.motion.md');
  assert.equal(round.sequence.frames.length, 8);
}

console.log('mocap2-smoke: ok');
