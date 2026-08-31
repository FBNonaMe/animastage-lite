/**
 * Local WHAM-style reconstruction from MediaPipe Pose (full sequence).
 * Used when remote WHAM server is unavailable — still runs full temporal pipeline.
 */
import { MMD_FPS } from '../../utils/playhead';
import type { WhamFrame, WhamJointId, WhamJointState, WhamPoseSequence, WhamProgress } from './types';
import type { WhamQualityPreset } from './qualityPresets';
import { loadVideoElement, resolveVideoAspect, seekVideo } from './videoIngest';

type Landmark = { x: number; y: number; z?: number; visibility?: number };

type PoseLandmarker = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number
  ) => { landmarks?: Landmark[][] };
  close: () => void;
};

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

async function getPoseLandmarker(full: boolean): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, FilesetResolver } = vision;
      const wasm = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      const model = full
        ? 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
        : 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
      return PoseLandmarker.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath: model,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      }) as Promise<PoseLandmarker>;
    })();
  }
  return landmarkerPromise;
}

function vis(lm: Landmark[] | undefined, i: number, min = 0.35): boolean {
  return (lm?.[i]?.visibility ?? 1) > min;
}

function conf(lm: Landmark[] | undefined, indices: number[]): number {
  if (!lm) return 0;
  let s = 0;
  let n = 0;
  for (const i of indices) {
    s += lm[i]?.visibility ?? 0;
    n += 1;
  }
  return n ? Math.min(1, Math.max(0, s / n)) : 0;
}

function angleDeg(ax: number, ay: number, bx: number, by: number): number {
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
}

function joint(
  rotation: [number, number, number],
  confidence: number,
  position?: [number, number, number]
): WhamJointState {
  return { rotation, confidence, position };
}

/** Convert MediaPipe landmarks → one WHAM frame (world-ish normalized coords). */
export function landmarksToWhamFrame(
  lm: Landmark[],
  time: number,
  mmdFps = MMD_FPS
): WhamFrame {
  const joints: Partial<Record<WhamJointId, WhamJointState>> = {};

  const lS = lm[11];
  const rS = lm[12];
  const lE = lm[13];
  const rE = lm[14];
  const lW = lm[15];
  const rW = lm[16];
  const lH = lm[23];
  const rH = lm[24];
  const lK = lm[25];
  const rK = lm[26];
  const lA = lm[27];
  const rA = lm[28];
  const nose = lm[0];

  const midShoulderX = lS && rS ? (lS.x + rS.x) / 2 : 0.5;
  const midShoulderY = lS && rS ? (lS.y + rS.y) / 2 : 0.4;
  const midHipX = lH && rH ? (lH.x + rH.x) / 2 : 0.5;
  const midHipY = lH && rH ? (lH.y + rH.y) / 2 : 0.6;
  const midHipZ = lH && rH ? ((lH.z ?? 0) + (rH.z ?? 0)) / 2 : 0;

  if (nose && lS && rS && vis(lm, 0) && vis(lm, 11) && vis(lm, 12)) {
    joints.head = joint(
      [(nose.y - midShoulderY) * 70, (nose.x - midShoulderX) * 90, 0],
      conf(lm, [0, 11, 12]),
      [nose.x - 0.5, 0.5 - nose.y, nose.z ?? 0]
    );
    joints.neck = joint(
      [(nose.y - midShoulderY) * 55, (nose.x - midShoulderX) * 40, 0],
      conf(lm, [0, 11, 12])
    );
  }

  if (lS && rS && vis(lm, 11) && vis(lm, 12)) {
    const lean = ((lS.y + rS.y) / 2 - midHipY) * 40;
    const twist = (rS.y - lS.y) * 80;
    joints.spine = joint([lean * 0.4, twist * 0.5, lean], conf(lm, [11, 12, 23, 24]));
    joints.chest = joint([lean * 0.25, twist * 0.35, lean * 0.6], conf(lm, [11, 12]));
  }

  if (lS && lE && vis(lm, 11) && vis(lm, 13)) {
    const a = angleDeg(lS.x, lS.y, lE.x, lE.y);
    joints.leftUpperArm = joint([0, 0, a - 90], conf(lm, [11, 13]));
    joints.leftShoulder = joint([(lE.y - lS.y) * 20, 0, (a - 90) * 0.35], conf(lm, [11, 13]));
  }
  if (lE && lW && vis(lm, 13) && vis(lm, 15)) {
    const a = angleDeg(lE.x, lE.y, lW.x, lW.y);
    const upper = joints.leftUpperArm?.rotation[2] ?? 0;
    joints.leftLowerArm = joint([0, 0, Math.max(-10, Math.min(130, a - 90 - upper))], conf(lm, [13, 15]));
    joints.leftHand = joint(
      [0, a * 0.15, (a - 90) * 0.4],
      conf(lm, [15, 13]),
      [lW.x - 0.5, 0.5 - lW.y, lW.z ?? 0]
    );
  }

  if (rS && rE && vis(lm, 12) && vis(lm, 14)) {
    const a = angleDeg(rS.x, rS.y, rE.x, rE.y);
    joints.rightUpperArm = joint([0, 0, -(a - 90)], conf(lm, [12, 14]));
    joints.rightShoulder = joint([(rE.y - rS.y) * 20, 0, -(a - 90) * 0.35], conf(lm, [12, 14]));
  }
  if (rE && rW && vis(lm, 14) && vis(lm, 16)) {
    const a = angleDeg(rE.x, rE.y, rW.x, rW.y);
    const upper = joints.rightUpperArm?.rotation[2] ?? 0;
    joints.rightLowerArm = joint(
      [0, 0, Math.max(-10, Math.min(130, -(a - 90) - upper))],
      conf(lm, [14, 16])
    );
    joints.rightHand = joint(
      [0, -a * 0.15, -(a - 90) * 0.4],
      conf(lm, [16, 14]),
      [rW.x - 0.5, 0.5 - rW.y, rW.z ?? 0]
    );
  }

  if (lH && lK && vis(lm, 23) && vis(lm, 25)) {
    const a = angleDeg(lH.x, lH.y, lK.x, lK.y);
    joints.leftUpperLeg = joint([a - 90, (lK.x - lH.x) * 40, 0], conf(lm, [23, 25]));
  }
  if (lK && lA && vis(lm, 25) && vis(lm, 27)) {
    const a = angleDeg(lK.x, lK.y, lA.x, lA.y);
    joints.leftLowerLeg = joint([Math.max(0, Math.min(130, 180 - Math.abs(a))) * 0.7, 0, 0], conf(lm, [25, 27]));
    joints.leftFoot = joint(
      [(lA.y - (lK?.y ?? lA.y)) * 30, 0, 0],
      conf(lm, [27, 31]),
      [lA.x - 0.5, 0.5 - lA.y, lA.z ?? 0]
    );
  }

  if (rH && rK && vis(lm, 24) && vis(lm, 26)) {
    const a = angleDeg(rH.x, rH.y, rK.x, rK.y);
    joints.rightUpperLeg = joint([a - 90, (rK.x - rH.x) * 40, 0], conf(lm, [24, 26]));
  }
  if (rK && rA && vis(lm, 26) && vis(lm, 28)) {
    const a = angleDeg(rK.x, rK.y, rA.x, rA.y);
    joints.rightLowerLeg = joint([Math.max(0, Math.min(130, 180 - Math.abs(a))) * 0.7, 0, 0], conf(lm, [26, 28]));
    joints.rightFoot = joint(
      [(rA.y - (rK?.y ?? rA.y)) * 30, 0, 0],
      conf(lm, [28, 32]),
      [rA.x - 0.5, 0.5 - rA.y, rA.z ?? 0]
    );
  }

  if (lH && rH && vis(lm, 23) && vis(lm, 24)) {
    const sway = (midHipX - 0.5) * 50;
    joints.hips = joint([0, sway, 0], conf(lm, [23, 24]), [midHipX - 0.5, 0.5 - midHipY, midHipZ]);
  }

  const yaw = lS && rS ? (rS.x - lS.x) * -40 : 0;
  const rootPos: [number, number, number] = [midHipX - 0.5, 0.5 - midHipY, midHipZ];

  return {
    time,
    frame: Math.round(time * mmdFps),
    root: {
      position: rootPos,
      rotation: [0, yaw, 0],
      velocity: [0, 0, 0],
      acceleration: [0, 0, 0],
    },
    joints,
  };
}

export async function reconstructLocalSequence(
  file: File,
  preset: WhamQualityPreset,
  onProgress?: (p: WhamProgress) => void
): Promise<WhamPoseSequence> {
  onProgress?.({ phase: 'ingest', progress: 0.02, message: 'Loading video…' });
  const { video, url, duration, width, height } = await loadVideoElement(file);

  onProgress?.({
    phase: 'analyze',
    progress: 0.06,
    message: preset.cinema ? 'Loading WHAM-local (full pose)…' : 'Loading pose model…',
  });

  const landmarker = await getPoseLandmarker(preset.cinema || preset.id === 'high');
  const sampleFps = Math.min(preset.sampleFps, 60);
  const step = 1 / sampleFps;
  const total = Math.max(1, Math.ceil(duration * sampleFps));
  const frames: WhamFrame[] = [];

  onProgress?.({ phase: 'reconstruct', progress: 0.1, message: `Reconstructing 0 / ${total}` });

  let t = 0;
  let i = 0;
  while (t < duration) {
    await seekVideo(video, t);
    const result = landmarker.detectForVideo(video, performance.now());
    const pose = result.landmarks?.[0];
    if (pose?.length) {
      frames.push(landmarksToWhamFrame(pose, t));
    }
    i += 1;
    if (i % 2 === 0 || t + step >= duration) {
      onProgress?.({
        phase: 'reconstruct',
        progress: 0.1 + 0.45 * (i / total),
        message: `WHAM reconstruct ${i} / ${total}`,
      });
    }
    t += step;
  }

  URL.revokeObjectURL(url);
  try {
    landmarker.close?.();
  } catch {
    /* ignore */
  }
  landmarkerPromise = null;

  if (frames.length < 2) {
    throw new Error('No pose detected — try another clip or better lighting');
  }

  // Fill root velocity / acceleration from trajectory
  for (let f = 0; f < frames.length; f++) {
    const cur = frames[f]!;
    const prev = frames[Math.max(0, f - 1)]!;
    const next = frames[Math.min(frames.length - 1, f + 1)]!;
    const dt = Math.max(1e-3, next.time - prev.time);
    const vx = (next.root.position[0] - prev.root.position[0]) / dt;
    const vy = (next.root.position[1] - prev.root.position[1]) / dt;
    const vz = (next.root.position[2] - prev.root.position[2]) / dt;
    cur.root.velocity = [vx, vy, vz];
    if (f > 0) {
      const pdt = Math.max(1e-3, cur.time - prev.time);
      cur.root.acceleration = [
        (vx - prev.root.velocity[0]) / pdt,
        (vy - prev.root.velocity[1]) / pdt,
        (vz - prev.root.velocity[2]) / pdt,
      ];
    }
  }

  return {
    frames,
    duration,
    sampleFps,
    width,
    height,
    aspect: resolveVideoAspect(width, height),
    source: 'wham-local',
  };
}
