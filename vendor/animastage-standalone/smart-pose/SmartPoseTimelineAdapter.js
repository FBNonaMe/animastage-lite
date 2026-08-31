// Controller keyframe tracks — ported from
// MMD_modoki-main/src/editor/smart-pose/smart-pose-timeline.ts.
// Pure data helpers: payload create/clone, upsert/remove/move/read on
// per-controller tracks, and linear/slerp evaluation between keyframes.

import { normalizeQuaternion, slerpQuaternion } from "./SmartPoseBake.js";

export const SMART_POSE_CONTROLLER_LABELS = {
  root: "Smart Pose · Root",
  pelvis: "Smart Pose · Pelvis",
  chest: "Smart Pose · Chest",
  head: "Smart Pose · Head",
  lookAt: "Smart Pose · Look At",
  leftHand: "Smart Pose · Left Hand",
  rightHand: "Smart Pose · Right Hand",
  leftElbowPole: "Smart Pose · Left Elbow Pole",
  rightElbowPole: "Smart Pose · Right Elbow Pole",
  leftFoot: "Smart Pose · Left Foot",
  rightFoot: "Smart Pose · Right Foot",
  leftKneePole: "Smart Pose · Left Knee Pole",
  rightKneePole: "Smart Pose · Right Knee Pole",
};

const controllerIds = Object.keys(SMART_POSE_CONTROLLER_LABELS);

export function resolveSmartPoseControllerId(name) {
  for (const id of controllerIds) {
    if (name === id || name === SMART_POSE_CONTROLLER_LABELS[id]) return id;
  }
  return null;
}

function normalizeFrame(frame) {
  return Math.max(0, Math.floor(Number.isFinite(frame) ? frame : 0));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function cloneVector(value) {
  return {
    x: Number.isFinite(value?.x) ? value.x : 0,
    y: Number.isFinite(value?.y) ? value.y : 0,
    z: Number.isFinite(value?.z) ? value.z : 0,
  };
}

function lerpVector(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function cloneChannels(value) {
  const channels = {};
  if (Number.isFinite(value?.toeRollDeg)) channels.toeRollDeg = value.toeRollDeg;
  if (Number.isFinite(value?.heelLift)) channels.heelLift = value.heelLift;
  if (Number.isFinite(value?.bankDeg)) channels.bankDeg = value.bankDeg;
  return channels;
}

function lerpChannels(a, b, t) {
  const channels = {};
  for (const key of ["toeRollDeg", "heelLift", "bankDeg"]) {
    const left = Number.isFinite(a?.[key]) ? a[key] : 0;
    const right = Number.isFinite(b?.[key]) ? b[key] : 0;
    if (left !== 0 || right !== 0 || a?.[key] !== undefined || b?.[key] !== undefined) {
      channels[key] = left + (right - left) * t;
    }
  }
  return channels;
}

export function createSmartPoseControllerPayload(state) {
  return {
    kind: "smartPoseController",
    position: cloneVector(state.position),
    rotation: normalizeQuaternion(state.rotation),
    enabled: state.enabled,
    visible: state.visible,
    locked: state.locked,
    weight: clamp01(state.weight),
    channels: cloneChannels(state.channels),
  };
}

export function cloneSmartPoseControllerPayload(payload) {
  return {
    ...payload,
    position: cloneVector(payload.position),
    rotation: normalizeQuaternion(payload.rotation),
    weight: clamp01(payload.weight),
    channels: cloneChannels(payload.channels),
  };
}

export function getSmartPoseTrackFrames(tracks, id) {
  return new Uint32Array((tracks[id] ?? []).map((keyframe) => normalizeFrame(keyframe.frame)));
}

function keyframeToPayload(keyframe) {
  return {
    kind: "smartPoseController",
    position: cloneVector(keyframe.position),
    rotation: normalizeQuaternion(keyframe.rotation),
    enabled: keyframe.enabled,
    visible: keyframe.visible,
    locked: keyframe.locked,
    weight: clamp01(keyframe.weight),
    channels: cloneChannels(keyframe.channels),
  };
}

export function readSmartPoseControllerKeyframe(tracks, id, frame) {
  const normalizedFrame = normalizeFrame(frame);
  const keyframe = (tracks[id] ?? []).find((candidate) => candidate.frame === normalizedFrame);
  return keyframe ? keyframeToPayload(keyframe) : null;
}

export function upsertSmartPoseControllerKeyframe(tracks, id, frame, payload) {
  const normalizedFrame = normalizeFrame(frame);
  const keyframes = tracks[id] ?? [];
  const next = {
    frame: normalizedFrame,
    position: cloneVector(payload.position),
    rotation: normalizeQuaternion(payload.rotation),
    enabled: payload.enabled,
    visible: payload.visible,
    locked: payload.locked,
    weight: clamp01(payload.weight),
    channels: cloneChannels(payload.channels),
  };
  const index = keyframes.findIndex((candidate) => candidate.frame >= normalizedFrame);
  if (index >= 0 && keyframes[index].frame === normalizedFrame) keyframes[index] = next;
  else if (index >= 0) keyframes.splice(index, 0, next);
  else keyframes.push(next);
  tracks[id] = keyframes;
}

export function removeSmartPoseControllerKeyframe(tracks, id, frame) {
  const keyframes = tracks[id];
  if (!keyframes) return false;
  const index = keyframes.findIndex((candidate) => candidate.frame === normalizeFrame(frame));
  if (index < 0) return false;
  keyframes.splice(index, 1);
  if (keyframes.length === 0) delete tracks[id];
  return true;
}

export function moveSmartPoseControllerKeyframe(tracks, id, fromFrame, toFrame) {
  const payload = readSmartPoseControllerKeyframe(tracks, id, fromFrame);
  if (!payload || normalizeFrame(fromFrame) === normalizeFrame(toFrame)) return false;
  removeSmartPoseControllerKeyframe(tracks, id, fromFrame);
  upsertSmartPoseControllerKeyframe(tracks, id, toFrame, payload);
  return true;
}

export function evaluateSmartPoseControllerTrack(keyframes, frame) {
  if (!keyframes || keyframes.length === 0) return null;
  const normalizedFrame = Math.max(0, Number.isFinite(frame) ? frame : 0);
  if (normalizedFrame <= keyframes[0].frame) return keyframeToPayload(keyframes[0]);
  const last = keyframes[keyframes.length - 1];
  if (normalizedFrame >= last.frame) return keyframeToPayload(last);

  let rightIndex = 1;
  while (rightIndex < keyframes.length && keyframes[rightIndex].frame < normalizedFrame) rightIndex += 1;
  const left = keyframes[rightIndex - 1];
  const right = keyframes[rightIndex];
  const span = Math.max(1, right.frame - left.frame);
  const t = clamp01((normalizedFrame - left.frame) / span);
  return {
    kind: "smartPoseController",
    position: lerpVector(left.position, right.position, t),
    rotation: slerpQuaternion(left.rotation, right.rotation, t),
    enabled: t < 1 ? left.enabled : right.enabled,
    visible: t < 1 ? left.visible : right.visible,
    locked: t < 1 ? left.locked : right.locked,
    weight: left.weight + (right.weight - left.weight) * t,
    channels: lerpChannels(left.channels, right.channels, t),
  };
}

export function cloneSmartPoseControllerTracks(tracks) {
  const cloned = {};
  if (!tracks) return cloned;
  for (const id of controllerIds) {
    const keyframes = tracks[id];
    if (!keyframes) continue;
    cloned[id] = keyframes
      .map((keyframe) => ({
        frame: normalizeFrame(keyframe.frame),
        position: cloneVector(keyframe.position),
        rotation: normalizeQuaternion(keyframe.rotation),
        enabled: keyframe.enabled !== false,
        visible: keyframe.visible !== false,
        locked: keyframe.locked === true,
        weight: clamp01(keyframe.weight),
        channels: cloneChannels(keyframe.channels),
      }))
      .sort((a, b) => a.frame - b.frame);
  }
  return cloned;
}

export class SmartPoseTimelineAdapter {
  constructor({ getBridge }) {
    this.getBridge = getBridge;
  }

  bridge() {
    try {
      return this.getBridge?.() || null;
    } catch (_) {
      return null;
    }
  }

  time() {
    return this.bridge()?.time?.() ?? 0;
  }

  autoKeyEnabled() {
    return !!this.bridge()?.autoKey?.();
  }

  keyAffectedBones(boneNames, opts = {}) {
    const bridge = this.bridge();
    if (!bridge) return false;
    const names = Array.from(new Set((boneNames || []).filter(Boolean)));
    if (typeof bridge.addKeyBones === "function") {
      return bridge.addKeyBones(names, { includePosition: true, ...opts });
    }
    let ok = false;
    for (const name of names) ok = bridge.addKeyAt?.(this.time(), name) || ok;
    bridge.commit?.();
    return ok;
  }

  keyFullPose(opts = {}) {
    const bridge = this.bridge();
    if (!bridge) return false;
    if (typeof bridge.addKeyBones === "function") {
      return bridge.addKeyBones(null, { includePosition: true, ...opts });
    }
    return !!bridge.addKeyAt?.(this.time(), null);
  }
}
