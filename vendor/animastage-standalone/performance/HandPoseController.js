import * as THREE from "../vendor/three/build/three.module.js";
import { FINGER_NAMES, HAND_SIDES, clamp01, clampSigned } from "./PerformanceConstants.js";
import { HandPresetLibrary, MASTER_KEYS, createDefaultHandState } from "./HandPresetLibrary.js";

const CURL_DISTRIBUTION = Object.freeze({
  thumb: [0.62, 0.9, 0.74],
  index: [0.68, 0.88, 1],
  middle: [0.66, 0.9, 1],
  ring: [0.7, 0.94, 1],
  little: [0.74, 0.98, 1],
});
const MAX_CURL = Object.freeze({
  thumb: [0.92, 1.08, 0.88],
  index: [1.15, 1.38, 1.12],
  middle: [1.18, 1.42, 1.16],
  ring: [1.2, 1.44, 1.18],
  little: [1.18, 1.4, 1.16],
});
const RELAX_CURL = Object.freeze({ thumb: 0.08, index: 0.05, middle: 0.1, ring: 0.16, little: 0.22 });
const SPREAD_FACTOR = Object.freeze({ thumb: 0.95, index: 0.65, middle: 0.14, ring: -0.38, little: -0.82 });

function nonlinear(value, tension) {
  const x = clamp01(value);
  const smooth = x * x * (3 - 2 * x);
  return smooth + (x - smooth) * clamp01(tension) * 0.35;
}

function copyPose(pose) { return JSON.parse(JSON.stringify(pose)); }

function setQuaternionFromAxisAngle(target, axis, angle) {
  if (Math.abs(angle) < 1e-8) return target.identity();
  return target.setFromAxisAngle(axis, angle);
}

function bindingBone(profile, mesh, role) {
  const index = profile?.boneRoles?.[role]?.targetBoneIndex;
  return Number.isInteger(index) ? mesh?.skeleton?.bones?.[index] || null : null;
}

function tipBone(profile, mesh, side, digit) {
  const joints = profile?.fingers?.[side]?.[digit]?.joints || [];
  const binding = joints[joints.length - 1];
  return Number.isInteger(binding?.targetBoneIndex) ? mesh.skeleton.bones[binding.targetBoneIndex] : null;
}

function safeWorldPosition(bone, target) {
  if (!bone) return target.set(0, 0, 0);
  return bone.getWorldPosition(target);
}

export class HandPoseController {
  constructor(mesh, profile, options = {}) {
    this.mesh = mesh;
    this.profile = profile;
    this.state = createDefaultHandState();
    this.curlSigns = { left: -1, right: 1 };
    this.presets = new HandPresetLibrary(options.customPresets);
    this.bindings = [];
    this.bySide = { left: { wrist: null, fingers: {} }, right: { wrist: null, fingers: {} } };
    this.listeners = new Set();
    this._eventSuppression = 0;
    this._delta = new THREE.Quaternion();
    this._qCurl = new THREE.Quaternion();
    this._qSpread = new THREE.Quaternion();
    this._qTwist = new THREE.Quaternion();
    this._v0 = new THREE.Vector3();
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
    this._worldQ = new THREE.Quaternion();
    this._inverseQ = new THREE.Quaternion();
    this._compile();
  }

  _compile() {
    try { this.mesh.updateMatrixWorld(true); } catch (_) {}
    for (const side of HAND_SIDES) {
      const wrist = bindingBone(this.profile, this.mesh, `${side}.wrist`);
      const wristPosition = safeWorldPosition(wrist, this._v0).clone();
      const indexPosition = safeWorldPosition(tipBone(this.profile, this.mesh, side, "index"), this._v1).clone();
      const littlePosition = safeWorldPosition(tipBone(this.profile, this.mesh, side, "little"), this._v2).clone();
      const across = indexPosition.sub(littlePosition);
      if (across.lengthSq() < 1e-8) across.set(0, 0, side === "left" ? 1 : -1);
      across.normalize();
      const forward = new THREE.Vector3();
      let tipCount = 0;
      for (const digit of FINGER_NAMES) {
        const tip = tipBone(this.profile, this.mesh, side, digit);
        if (!tip) continue;
        forward.add(safeWorldPosition(tip, this._v3).sub(wristPosition));
        tipCount++;
      }
      if (!tipCount || forward.lengthSq() < 1e-8) forward.set(side === "left" ? 1 : -1, 0, 0);
      forward.normalize();
      const normal = new THREE.Vector3().crossVectors(forward, across);
      if (normal.lengthSq() < 1e-8) normal.set(0, 1, 0);
      normal.normalize();
      across.crossVectors(normal, forward).normalize();

      if (wrist) {
        const compiled = this._compileBone(wrist, `${side}.wrist`, across, normal, forward, side, "wrist", 0);
        this.bySide[side].wrist = compiled;
      }
      for (const digit of FINGER_NAMES) {
        const compiledJoints = [];
        const mappings = this.profile?.fingers?.[side]?.[digit]?.joints || [];
        for (let joint = 0; joint < mappings.length; joint++) {
          const role = mappings[joint].role;
          const bone = this.mesh.skeleton.bones[mappings[joint].targetBoneIndex];
          if (!bone) continue;
          compiledJoints.push(this._compileBone(bone, role, across, normal, forward, side, digit, joint));
        }
        this.bySide[side].fingers[digit] = compiledJoints;
      }
    }
  }

  _compileBone(bone, role, curlWorld, spreadWorld, twistWorld, side, digit, joint) {
    bone.getWorldQuaternion(this._worldQ);
    this._inverseQ.copy(this._worldQ).invert();
    const compiled = {
      bone, role, side, digit, joint,
      curlAxis: curlWorld.clone().applyQuaternion(this._inverseQ).normalize(),
      spreadAxis: spreadWorld.clone().applyQuaternion(this._inverseQ).normalize(),
      twistAxis: twistWorld.clone().applyQuaternion(this._inverseQ).normalize(),
      // MMD hands are mirrored in bind pose: the left fingers point toward +X
      // while the right fingers point toward -X.  A shared positive rotation
      // therefore flexes only the right hand toward the palm.  Keep wrist bend
      // unchanged, but mirror every finger flexion around the compiled axis.
      curlSign: digit === "wrist" ? 1 : (side === "left" ? -1 : 1),
      base: new THREE.Quaternion(),
      applied: new THREE.Quaternion(),
      hasLast: false,
    };
    this.bindings.push(compiled);
    return compiled;
  }

  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  _emit(reason) { if (this._eventSuppression) return; for (const listener of this.listeners) { try { listener(reason, this); } catch (_) {} } }
  runSilently(callback) { this._eventSuppression++; try { return callback?.(); } finally { this._eventSuppression--; } }

  beginFrame() {
    for (const binding of this.bindings) {
      if (!binding.hasLast) continue;
      const dot = Math.abs(binding.bone.quaternion.dot(binding.applied));
      if (dot > 0.9999995) binding.bone.quaternion.copy(binding.base);
      binding.hasLast = false;
    }
  }

  evaluate(layer, time = 0) {
    const weight = clamp01(layer?.weight ?? 1);
    if (weight <= 0) return;
    for (const side of HAND_SIDES) {
      if (layer?.sideMask?.[side] === false) continue;
      const hand = this.state.hands[side];
      const wrist = this.bySide[side].wrist;
      if (wrist && this._allows(layer, wrist.role)) {
        const bend = this._sample(layer, `${side}.master.wristBend`, hand.master.wristBend, time) * 0.7 * weight;
        const twist = this._sample(layer, `${side}.master.wristTwist`, hand.master.wristTwist, time) * 0.82 * weight;
        const sideBend = this._sample(layer, `${side}.master.wristSideBend`, hand.master.wristSideBend, time) * 0.58 * weight;
        this._apply(wrist, bend, sideBend, twist);
      }
      const masterCurl = this._sample(layer, `${side}.master.curl`, hand.master.curl, time);
      const masterSpread = this._sample(layer, `${side}.master.spread`, hand.master.spread, time);
      const relax = this._sample(layer, `${side}.master.relax`, hand.master.relax, time);
      const tension = this._sample(layer, `${side}.master.tension`, hand.master.tension, time);
      const cup = this._sample(layer, `${side}.master.cup`, hand.master.cup, time);
      const fan = this._sample(layer, `${side}.master.fan`, hand.master.fan, time);
      const thumbOpposition = this._sample(layer, `${side}.master.thumbOpposition`, hand.master.thumbOpposition, time);
      const thumbCurl = this._sample(layer, `${side}.master.thumbCurl`, hand.master.thumbCurl, time);
      for (const digit of FINGER_NAMES) {
        const finger = hand.fingers[digit];
        const curlControl = this._sample(layer, `${side}.${digit}.curl`, finger.curl, time);
        const spreadControl = this._sample(layer, `${side}.${digit}.spread`, finger.spread, time);
        const twistControl = this._sample(layer, `${side}.${digit}.twist`, finger.twist, time);
        const relaxed = relax * RELAX_CURL[digit];
        const effectiveCurl = nonlinear(masterCurl + curlControl + relaxed + (digit === "thumb" ? thumbCurl * 0.55 : 0), tension);
        const joints = this.bySide[side].fingers[digit];
        for (let joint = 0; joint < joints.length; joint++) {
          const binding = joints[joint];
          if (!this._allows(layer, binding.role)) continue;
          const jointName = joint === 0 ? "proximal" : joint === 1 ? "middle" : "distal";
          const correction = this._sample(layer, `${side}.${digit}.${jointName}`, finger[jointName] || 0, time);
          const distribution = CURL_DISTRIBUTION[digit][Math.min(joint, 2)];
          const limit = MAX_CURL[digit][Math.min(joint, 2)];
          const curlAngle = (effectiveCurl * distribution * limit + correction * 0.48) * weight;
          const digitSpread = (masterSpread * SPREAD_FACTOR[digit] + spreadControl + fan * SPREAD_FACTOR[digit] * 0.45 + cup * (joint === 0 ? SPREAD_FACTOR[digit] * -0.16 : 0)) * 0.42 * weight;
          const opposition = digit === "thumb" ? thumbOpposition * (joint === 0 ? 0.62 : 0.25) : 0;
          const twistAngle = (twistControl * 0.45 + opposition) * weight;
          this._apply(binding, curlAngle, digitSpread, twistAngle);
        }
      }
    }
    this.mesh.skeleton?.update?.();
  }

  _allows(layer, role) { return !layer?.boneMask?.size || layer.boneMask.has(role); }
  _sample(layer, channel, fallback, time) { return layer?.tracks?.has(channel) ? layer.sample(channel, time, fallback) : fallback; }

  _apply(binding, curl, spread, twist) {
    binding.base.copy(binding.bone.quaternion);
    setQuaternionFromAxisAngle(this._qCurl, binding.curlAxis, curl * binding.curlSign);
    setQuaternionFromAxisAngle(this._qSpread, binding.spreadAxis, spread);
    setQuaternionFromAxisAngle(this._qTwist, binding.twistAxis, twist);
    this._delta.identity().multiply(this._qSpread).multiply(this._qCurl).multiply(this._qTwist).normalize();
    binding.bone.quaternion.copy(binding.base).multiply(this._delta).normalize();
    binding.applied.copy(binding.bone.quaternion);
    binding.hasLast = true;
  }

  setSymmetry(enabled) { this.state.symmetry = !!enabled; this._emit("symmetry"); }

  setCurlInverted(side, inverted) {
    if (!HAND_SIDES.includes(side)) return false;
    const sign = inverted ? -1 : 1; this.curlSigns[side] = sign;
    for (const binding of this.bindings) if (binding.side === side && binding.digit !== "wrist") binding.curlSign = sign;
    this._emit(`curl-sign:${side}`); return true;
  }

  setMaster(side, control, value, options = {}) {
    if (!this.state.hands[side] || !MASTER_KEYS.includes(control)) return false;
    const unsigned = ["curl", "relax", "tension", "cup", "thumbCurl", "palmArch"].includes(control);
    const safe = unsigned ? clamp01(value) : clampSigned(value);
    this.state.hands[side].master[control] = safe;
    if (this.state.symmetry && options.mirror !== false) this.state.hands[side === "left" ? "right" : "left"].master[control] = safe;
    this._emit(`master:${side}:${control}`);
    return true;
  }

  setFinger(side, digit, control, value, options = {}) {
    const finger = this.state.hands[side]?.fingers?.[digit];
    if (!finger || !(control in finger)) return false;
    const safe = control === "curl" ? clampSigned(value) : clampSigned(value);
    finger[control] = safe;
    if (this.state.symmetry && options.mirror !== false) this.state.hands[side === "left" ? "right" : "left"].fingers[digit][control] = safe;
    this._emit(`finger:${side}:${digit}:${control}`);
    return true;
  }

  applyPreset(name, side = "both") {
    const preset = this.presets.get(name);
    if (!preset) return false;
    const sides = side === "both" ? HAND_SIDES : [side];
    for (const targetSide of sides) {
      const hand = this.state.hands[targetSide];
      if (!hand) continue;
      for (const key of MASTER_KEYS) hand.master[key] = key === "relax" ? 0 : 0;
      for (const digit of FINGER_NAMES) for (const key of Object.keys(hand.fingers[digit])) hand.fingers[digit][key] = 0;
      for (const [key, value] of Object.entries(preset.master || {})) if (key in hand.master) hand.master[key] = Number(value) || 0;
      for (const [digit, values] of Object.entries(preset.fingers || {})) {
        if (!hand.fingers[digit]) continue;
        for (const [key, value] of Object.entries(values)) if (key in hand.fingers[digit]) hand.fingers[digit][key] = Number(value) || 0;
      }
    }
    this._emit(`preset:${name}`);
    return true;
  }

  reset(side = "both") {
    const fresh = createDefaultHandState();
    const sides = side === "both" ? HAND_SIDES : [side];
    for (const targetSide of sides) if (this.state.hands[targetSide]) this.state.hands[targetSide] = fresh.hands[targetSide];
    this._emit("reset");
  }

  captureSemanticPose(side = "left") { return copyPose(this.state.hands[side]); }

  saveCurrentPreset(name, side = "left") {
    const saved = this.presets.save(name, this.captureSemanticPose(side));
    if (saved) this._emit(`preset-saved:${name}`);
    return saved;
  }

  toJSON() { return { state: copyPose(this.state), curlSigns: { ...this.curlSigns }, customPresets: this.presets.toJSON() }; }

  restore(data) {
    if (!data || typeof data !== "object") return false;
    const fresh = createDefaultHandState();
    for (const side of HAND_SIDES) {
      const source = data.state?.hands?.[side];
      if (!source) continue;
      for (const key of MASTER_KEYS) if (Number.isFinite(source.master?.[key])) fresh.hands[side].master[key] = source.master[key];
      for (const digit of FINGER_NAMES) for (const key of Object.keys(fresh.hands[side].fingers[digit])) {
        if (Number.isFinite(source.fingers?.[digit]?.[key])) fresh.hands[side].fingers[digit][key] = source.fingers[digit][key];
      }
    }
    fresh.symmetry = data.state?.symmetry !== false;
    this.state = fresh;
    for (const side of HAND_SIDES) this.setCurlInverted(side, Number(data.curlSigns?.[side]) < 0 || (data.curlSigns?.[side] === undefined && side === "left"));
    this.presets.restore(data.customPresets);
    this._emit("restore");
    return true;
  }
}
