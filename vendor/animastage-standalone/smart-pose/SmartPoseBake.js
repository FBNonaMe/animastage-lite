// SmartPoseBake.js — ported from MMD_modoki-main/src/editor/smart-pose/smart-pose-bake.ts
// Turns a Smart Pose performance into plain bone keyframes:
//   createSmartPoseBakeFrameList — sampling frames (start/end/step, end kept)
//   groupSmartPoseBakeTracks    — per-bone tracks from per-frame samples
//   simplifySmartPoseBakeTrack  — Ramer-Douglas-Peucker-style key reduction
//                                 with separate rotation/position tolerances
// Pure data in/out: samples are { frame, boneName, movable,
// position:{x,y,z}, rotation:{x,y,z,w} }.

export function createSmartPoseBakeFrameList(startFrame, endFrame, frameStep) {
  const start = Math.max(0, Math.floor(Number.isFinite(startFrame) ? startFrame : 0));
  const end = Math.max(start, Math.floor(Number.isFinite(endFrame) ? endFrame : start));
  const step = Math.max(1, Math.floor(Number.isFinite(frameStep) ? frameStep : 1));
  const frames = [];
  for (let frame = start; frame <= end; frame += step) frames.push(frame);
  if (frames[frames.length - 1] !== end) frames.push(end);
  return frames;
}

export function groupSmartPoseBakeTracks(frames) {
  const tracks = new Map();
  for (const frame of frames || []) {
    for (const sample of frame.bones || []) {
      let track = tracks.get(sample.boneName);
      if (!track) {
        track = { boneName: sample.boneName, movable: sample.movable, samples: [] };
        tracks.set(sample.boneName, track);
      }
      track.samples.push(cloneSample(sample));
    }
  }
  return [...tracks.values()].map((track) => ({
    ...track,
    samples: track.samples.sort((a, b) => a.frame - b.frame),
  }));
}

export function simplifySmartPoseBakeTrack(track, rotationToleranceDeg, positionTolerance) {
  const samples = track.samples;
  if (samples.length <= 2) return { ...track, samples: samples.map(cloneSample) };
  const rotationTolerance = Math.max(1e-6, finiteOr(rotationToleranceDeg, 0.1));
  const translationTolerance = Math.max(1e-6, finiteOr(positionTolerance, rotationTolerance));
  const kept = new Set([0, samples.length - 1]);
  const ranges = [[0, samples.length - 1]];

  while (ranges.length > 0) {
    const [leftIndex, rightIndex] = ranges.pop();
    if (rightIndex - leftIndex <= 1) continue;
    const left = samples[leftIndex];
    const right = samples[rightIndex];
    const frameSpan = Math.max(1, right.frame - left.frame);
    let worstIndex = -1;
    let worstScore = 1;
    for (let index = leftIndex + 1; index < rightIndex; index += 1) {
      const sample = samples[index];
      const t = clamp01((sample.frame - left.frame) / frameSpan);
      const rotationError = quaternionAngleDeg(sample.rotation, slerpQuaternion(left.rotation, right.rotation, t));
      const positionError = track.movable
        ? vectorDistance(sample.position, lerpVector(left.position, right.position, t))
        : 0;
      const score = Math.max(rotationError / rotationTolerance, positionError / translationTolerance);
      if (score > worstScore) {
        worstScore = score;
        worstIndex = index;
      }
    }
    if (worstIndex < 0) continue;
    kept.add(worstIndex);
    ranges.push([leftIndex, worstIndex], [worstIndex, rightIndex]);
  }

  return {
    ...track,
    samples: [...kept].sort((a, b) => a - b).map((index) => cloneSample(samples[index])),
  };
}

/* ------------------------------ helpers -------------------------------- */

function cloneSample(sample) {
  return {
    ...sample,
    position: { ...sample.position },
    rotation: normalizeQuaternion(sample.rotation),
  };
}

function lerpVector(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function vectorDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function normalizeQuaternion(value) {
  const x = finiteOr(value?.x, 0);
  const y = finiteOr(value?.y, 0);
  const z = finiteOr(value?.z, 0);
  const w = finiteOr(value?.w, 1);
  const length = Math.hypot(x, y, z, w);
  return length < 1e-8
    ? { x: 0, y: 0, z: 0, w: 1 }
    : { x: x / length, y: y / length, z: z / length, w: w / length };
}

export function slerpQuaternion(aValue, bValue, t) {
  const a = normalizeQuaternion(aValue);
  let b = normalizeQuaternion(bValue);
  let dot = quaternionDot(a, b);
  if (dot < 0) {
    dot = -dot;
    b = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
  }
  if (dot > 0.9995) {
    return normalizeQuaternion({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      w: a.w + (b.w - a.w) * t,
    });
  }
  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinTheta = Math.sin(theta);
  const leftWeight = Math.sin((1 - t) * theta) / sinTheta;
  const rightWeight = Math.sin(t * theta) / sinTheta;
  return normalizeQuaternion({
    x: a.x * leftWeight + b.x * rightWeight,
    y: a.y * leftWeight + b.y * rightWeight,
    z: a.z * leftWeight + b.z * rightWeight,
    w: a.w * leftWeight + b.w * rightWeight,
  });
}

export function quaternionAngleDeg(aValue, bValue) {
  const dot = Math.abs(quaternionDot(normalizeQuaternion(aValue), normalizeQuaternion(bValue)));
  return 2 * Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

function quaternionDot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
