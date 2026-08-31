import * as THREE from "../vendor/three/build/three.module.js";

const DEG = Math.PI / 180;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export class GazeController {
  constructor(mesh, profile, options = {}) {
    this.mesh = mesh;
    this.profile = profile;
    this.getCamera = options.getCamera || (() => null);
    this.getSelectedObject = options.getSelectedObject || (() => null);
    this.enabled = false;
    this.targetType = "camera";
    this.targetObject = null;
    this.worldTarget = new THREE.Vector3(0, 10, -10);
    this.settings = {
      eyeYaw: 28 * DEG, eyePitch: 18 * DEG, headYaw: 48 * DEG, headPitch: 26 * DEG,
      neckContribution: 0.28, chestContribution: 0.08, headContribution: 0.42,
      smoothing: 12, headLag: 4.5, microSaccades: 0.18, forwardSign: 1, vergence: 1,
      cameraOffsetX: 0, cameraOffsetY: 0, cameraOffsetZ: 0,
      leftYawOffset: 0, leftPitchOffset: 0, rightYawOffset: 0, rightPitchOffset: 0,
    };
    this.eyeYaw = 0; this.eyePitch = 0; this.headYaw = 0; this.headPitch = 0; this.clock = 0;
    this.bindings = [];
    this._target = new THREE.Vector3(); this._position = new THREE.Vector3(); this._direction = new THREE.Vector3();
    this._parentQ = new THREE.Quaternion(); this._localQ = new THREE.Quaternion(); this._cameraOffset = new THREE.Vector3();
    this._yawQ = new THREE.Quaternion(); this._pitchQ = new THREE.Quaternion();
    this._axisY = new THREE.Vector3(0, 1, 0); this._axisX = new THREE.Vector3(1, 0, 0);
    this._angles = new Float32Array(4);
    this.primaryEye = null; this.primaryHead = null;
    this._compile();
  }

  _compile() {
    const bones = this.mesh?.skeleton?.bones || [];
    const entries = [];
    if (this.profile?.eyes?.left && this.profile?.eyes?.right) entries.push(["eye", this.profile.eyes.left, "left"], ["eye", this.profile.eyes.right, "right"]);
    else if (this.profile?.eyes?.both) entries.push(["eye", this.profile.eyes.both, "both"]);
    for (const [kind, role] of [["head", "body.head"], ["neck", "body.neck"], ["chest", "body.chest"]]) {
      if (this.profile?.boneRoles?.[role]) entries.push([kind, this.profile.boneRoles[role], null]);
    }
    const seen = new Set();
    for (const [kind, binding, side] of entries) {
      const index = binding.targetBoneIndex;
      if (!Number.isInteger(index) || !bones[index] || seen.has(index)) continue;
      seen.add(index);
      const compiled = { kind, side, bone: bones[index], base: new THREE.Quaternion(), applied: new THREE.Quaternion(), hasLast: false, yaw: 0, pitch: 0 };
      this.bindings.push(compiled);
      if (kind === "eye" && !this.primaryEye) this.primaryEye = compiled;
      if (kind === "head" && !this.primaryHead) this.primaryHead = compiled;
    }
  }

  beginFrame() {
    for (const binding of this.bindings) {
      if (binding.hasLast && Math.abs(binding.bone.quaternion.dot(binding.applied)) > 0.9999995) binding.bone.quaternion.copy(binding.base);
      binding.hasLast = false;
    }
  }

  setTargetCamera() { this.targetType = "camera"; this.targetObject = null; this.enabled = true; }
  setTargetObject(object) { this.targetType = "object"; this.targetObject = object || null; this.enabled = !!object; }
  setTargetSelectedObject() { const object = this.getSelectedObject(); if (object) this.setTargetObject(object); return !!object; }
  setTargetWorld(value) { if (value?.isVector3) this.worldTarget.copy(value); else if (Array.isArray(value)) this.worldTarget.fromArray(value); else return false; this.targetType = "world"; this.targetObject = null; this.enabled = true; return true; }
  clearTarget() { this.enabled = false; }

  _resolveTarget() {
    if (this.targetType === "camera") {
      const camera = this.getCamera();
      if (camera?.matrixWorld) {
        camera.updateWorldMatrix?.(true, false);
        this._cameraOffset.set(this.settings.cameraOffsetX, this.settings.cameraOffsetY, this.settings.cameraOffsetZ);
        this._target.copy(this._cameraOffset).applyMatrix4(camera.matrixWorld);
        return Number.isFinite(this._target.x + this._target.y + this._target.z);
      }
    } else if (this.targetType === "object") {
      const object = this.targetObject || this.getSelectedObject();
      if (object?.getWorldPosition) { object.updateWorldMatrix?.(true, false); object.getWorldPosition(this._target); return true; }
    } else if (this.targetType === "world") { this._target.copy(this.worldTarget); return true; }
    return false;
  }

  _anglesFor(binding, offset) {
    binding.bone.getWorldPosition(this._position);
    this._direction.copy(this._target).sub(this._position).normalize();
    const parent = binding.bone.parent;
    if (parent?.getWorldQuaternion) parent.getWorldQuaternion(this._parentQ).invert();
    else this._parentQ.identity();
    // Convert the target into the bone's current animated local frame.  This
    // makes camera tracking exact even when VMD already rotates head/eyes.
    this._localQ.copy(binding.base).invert();
    this._direction.applyQuaternion(this._parentQ).applyQuaternion(this._localQ);
    const sign = this.settings.forwardSign < 0 ? -1 : 1;
    const forwardZ = this._direction.z * sign;
    const yaw = Math.atan2(this._direction.x * sign, Math.max(1e-6, forwardZ));
    const pitch = Math.atan2(this._direction.y, Math.max(1e-6, Math.hypot(this._direction.x, this._direction.z)));
    this._angles[offset] = yaw; this._angles[offset + 1] = pitch;
  }

  evaluate(layer, deltaTime, time = 0) {
    if (!this.enabled || !this._resolveTarget()) return;
    if (layer?.tracks?.has("target.x")) this._target.x = layer.sample("target.x", time, this._target.x);
    if (layer?.tracks?.has("target.y")) this._target.y = layer.sample("target.y", time, this._target.y);
    if (layer?.tracks?.has("target.z")) this._target.z = layer.sample("target.z", time, this._target.z);
    for (const binding of this.bindings) binding.base.copy(binding.bone.quaternion);
    this.mesh.updateMatrixWorld?.(true);
    const dt = Math.max(0, Math.min(0.1, Number(deltaTime) || 0)); this.clock += dt;
    const eyeBinding = this.primaryEye;
    const headBinding = this.primaryHead || eyeBinding;
    if (!eyeBinding || !headBinding) return;
    this._anglesFor(headBinding, 2);
    const eyeAlpha = 1 - Math.exp(-this.settings.smoothing * dt), headAlpha = 1 - Math.exp(-this.settings.headLag * dt);
    const saccade = Math.sin(this.clock * 7.13) * Math.sin(this.clock * 2.31 + 0.7) * this.settings.microSaccades * DEG;
    this.headYaw += (clamp(this._angles[2], -this.settings.headYaw, this.settings.headYaw) - this.headYaw) * headAlpha;
    this.headPitch += (clamp(this._angles[3], -this.settings.headPitch, this.settings.headPitch) - this.headPitch) * headAlpha;
    this._anglesFor(eyeBinding, 0);
    const sharedEyeYaw = this._angles[0], sharedEyePitch = this._angles[1];
    const weight = Math.max(0, Math.min(1, layer?.weight ?? 1));
    for (const binding of this.bindings) {
      let yaw, pitch;
      if (binding.kind === "eye") {
        this._anglesFor(binding, 0);
        const sidePhase = binding === this.primaryEye ? saccade : -saccade * 0.72;
        const vergence = clamp(this.settings.vergence, 0, 1);
        const yawOffset = binding.side === "left" ? this.settings.leftYawOffset : binding.side === "right" ? this.settings.rightYawOffset : 0;
        const pitchOffset = binding.side === "left" ? this.settings.leftPitchOffset : binding.side === "right" ? this.settings.rightPitchOffset : 0;
        const targetYaw = sharedEyeYaw + (this._angles[0] - sharedEyeYaw) * vergence + yawOffset;
        const targetPitch = sharedEyePitch + (this._angles[1] - sharedEyePitch) * vergence + pitchOffset;
        binding.yaw += (clamp(targetYaw, -this.settings.eyeYaw, this.settings.eyeYaw) + sidePhase - binding.yaw) * eyeAlpha;
        binding.pitch += (clamp(targetPitch, -this.settings.eyePitch, this.settings.eyePitch) - binding.pitch) * eyeAlpha;
        yaw = binding.yaw; pitch = binding.pitch;
        if (binding === this.primaryEye) { this.eyeYaw = yaw; this.eyePitch = pitch; }
      }
      else if (binding.kind === "head") { yaw = this.headYaw * this.settings.headContribution; pitch = this.headPitch * this.settings.headContribution; }
      else if (binding.kind === "neck") { yaw = this.headYaw * this.settings.neckContribution; pitch = this.headPitch * this.settings.neckContribution; }
      else if (binding.kind === "chest") { yaw = this.headYaw * this.settings.chestContribution; pitch = this.headPitch * this.settings.chestContribution; }
      this._yawQ.setFromAxisAngle(this._axisY, yaw * weight);
      this._pitchQ.setFromAxisAngle(this._axisX, -pitch * (this.settings.forwardSign < 0 ? -1 : 1) * weight);
      binding.bone.quaternion.copy(binding.base).multiply(this._yawQ).multiply(this._pitchQ).normalize();
      binding.applied.copy(binding.bone.quaternion); binding.hasLast = true;
    }
    this.mesh.skeleton?.update?.(); this.mesh.updateMatrixWorld?.(true);
  }

  getTargetSnapshot() {
    this._resolveTarget();
    return { type: this.targetType, position: this._target.toArray(), distance: this.primaryEye ? this.primaryEye.bone.getWorldPosition(this._position).distanceTo(this._target) : 0 };
  }
  captureTransientState() {
    return {
      eyeYaw: this.eyeYaw, eyePitch: this.eyePitch,
      headYaw: this.headYaw, headPitch: this.headPitch,
      clock: this.clock,
      bindings: this.bindings.map((binding) => ({
        yaw: binding.yaw, pitch: binding.pitch,
        base: binding.base.toArray(), applied: binding.applied.toArray(),
        hasLast: binding.hasLast,
      })),
    };
  }
  restoreTransientState(state) {
    if (!state) return false;
    this.eyeYaw = Number(state.eyeYaw) || 0; this.eyePitch = Number(state.eyePitch) || 0;
    this.headYaw = Number(state.headYaw) || 0; this.headPitch = Number(state.headPitch) || 0;
    this.clock = Number(state.clock) || 0;
    for (let index = 0; index < this.bindings.length; index++) {
      const binding = this.bindings[index], saved = state.bindings?.[index];
      if (!saved) continue;
      binding.yaw = Number(saved.yaw) || 0; binding.pitch = Number(saved.pitch) || 0;
      if (Array.isArray(saved.base)) binding.base.fromArray(saved.base);
      if (Array.isArray(saved.applied)) binding.applied.fromArray(saved.applied);
      binding.hasLast = !!saved.hasLast;
    }
    return true;
  }
  resetTransientState() {
    this.beginFrame();
    this.eyeYaw = 0; this.eyePitch = 0; this.headYaw = 0; this.headPitch = 0; this.clock = 0;
    for (const binding of this.bindings) {
      binding.yaw = 0; binding.pitch = 0;
      binding.base.copy(binding.bone.quaternion);
      binding.applied.copy(binding.bone.quaternion);
      binding.hasLast = false;
    }
  }
  toJSON() { return { coordinateVersion: 2, enabled: this.enabled, targetType: this.targetType, worldTarget: this.worldTarget.toArray(), settings: { ...this.settings } }; }
  restore(data) {
    if (!data) return false;
    this.enabled = !!data.enabled; this.targetType = ["camera", "object", "world"].includes(data.targetType) ? data.targetType : "camera";
    if (Array.isArray(data.worldTarget)) this.worldTarget.fromArray(data.worldTarget);
    Object.assign(this.settings, data.settings || {});
    if (data.coordinateVersion !== 2) this.settings.forwardSign = 1;
    return true;
  }
}
