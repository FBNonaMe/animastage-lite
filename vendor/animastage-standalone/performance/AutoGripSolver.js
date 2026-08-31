import * as THREE from "../vendor/three/build/three.module.js";
import { PerformanceLayer } from "./PerformanceLayer.js";

export const GRIP_TYPES = Object.freeze([
  "cylindrical", "spherical", "pinch", "precision", "hook", "flat", "sword", "pistol_prop", "phone", "microphone", "custom",
]);

const GRIP_PROFILE = Object.freeze({
  cylindrical: { curl: 0.58, cup: 0.5, fan: -0.06, opposition: 0.66, tension: 0.4 },
  spherical: { curl: 0.42, cup: 0.78, fan: 0.18, opposition: 0.72, tension: 0.28 },
  pinch: { curl: 0.18, cup: 0.12, fan: 0, opposition: 0.88, tension: 0.34, active: ["thumb", "index"] },
  precision: { curl: 0.25, cup: 0.2, fan: 0.04, opposition: 0.82, tension: 0.38, active: ["thumb", "index", "middle"] },
  hook: { curl: 0.76, cup: 0.28, fan: -0.08, opposition: 0.18, tension: 0.5, active: ["index", "middle", "ring", "little"] },
  flat: { curl: 0.04, cup: 0.04, fan: 0.18, opposition: 0.2, tension: 0.18 },
  sword: { curl: 0.76, cup: 0.34, fan: -0.08, opposition: 0.58, tension: 0.62 },
  pistol_prop: { curl: 0.72, cup: 0.3, fan: -0.04, opposition: 0.55, tension: 0.52, active: ["thumb", "middle", "ring", "little"] },
  phone: { curl: 0.4, cup: 0.32, fan: 0.08, opposition: 0.48, tension: 0.24 },
  microphone: { curl: 0.66, cup: 0.42, fan: -0.06, opposition: 0.58, tension: 0.42 },
  custom: { curl: 0.45, cup: 0.35, fan: 0, opposition: 0.55, tension: 0.3 },
});

function signedDistanceToBox(point, box) {
  const dx = Math.max(box.min.x - point.x, 0, point.x - box.max.x);
  const dy = Math.max(box.min.y - point.y, 0, point.y - box.max.y);
  const dz = Math.max(box.min.z - point.z, 0, point.z - box.max.z);
  const outside = Math.hypot(dx, dy, dz);
  if (outside > 0) return outside;
  return -Math.min(point.x - box.min.x, box.max.x - point.x, point.y - box.min.y, box.max.y - point.y, point.z - box.min.z, box.max.z - point.z);
}

export class AutoGripSolver {
  constructor(mesh, profile, hands, options = {}) {
    this.mesh = mesh;
    this.profile = profile;
    this.hands = hands;
    this.getSelectedObject = options.getSelectedObject || (() => null);
    this.resolveObject = options.resolveObject || (() => null);
    this.solveHandController = options.solveHandController || (() => false);
    this.attachTargetToHand = options.attachTargetToHand || (() => ({ ok: false, reason: "attachment-unavailable" }));
    this.detachTargetFromHand = options.detachTargetFromHand || (() => false);
    this.target = null;
    this.side = "left";
    this.gripType = "cylindrical";
    this.autoAttach = true;
    this.attached = false;
    // A grip is a one-shot pose by default. Following a moving prop is an
    // explicit opt-in because continuously owning the wrist would fight both
    // Smart Pose and the classic bone editor.
    this.followTarget = false;
    this.maintainGrip = false;
    this.contacts = [];
    this.lastResult = null;
    this.pendingTargetId = null;
    this.pendingMaintain = false;
    this.pendingAttach = false;
    this._offlineSuspended = false;
    this._box = new THREE.Box3(); this._center = new THREE.Vector3(); this._size = new THREE.Vector3();
    this._wrist = new THREE.Vector3(); this._tip = new THREE.Vector3(); this._closest = new THREE.Vector3(); this._surface = new THREE.Vector3();
    this._forward = new THREE.Vector3(); this._approach = new THREE.Vector3(); this._candidate = new THREE.Vector3();
    this._rotation = new THREE.Quaternion(); this._wristQ = new THREE.Quaternion(); this._targetQ = new THREE.Quaternion(); this._localQ = new THREE.Quaternion();
    this._localWrist = new THREE.Vector3(); this._maintainedWorld = new THREE.Vector3(); this._maintainedQ = new THREE.Quaternion();
    this._lastTargetMatrix = new Float32Array(16); this._layer = new PerformanceLayer("handPose");
    this._visualPoint = new THREE.Vector3(); this._visualScale = 0.06;
    this.contactGroup = new THREE.Group(); this.contactGroup.name = "AutoGripContacts"; this.contactGroup.visible = false;
    this.contactGeometry = new THREE.SphereGeometry(1, 10, 7);
  }

  setTarget(object) { this.target = object || null; return !!this.target; }
  setSelectedTarget() { return this.setTarget(this.getSelectedObject()); }

  analyzeTarget(object = this.target) {
    if (!object?.isObject3D) return null;
    for (let node = object; node; node = node.parent) if (node === this.mesh) return null;
    for (let node = this.mesh; node; node = node.parent) if (node === object) return null;
    object.updateWorldMatrix(true, true);
    this._box.setFromObject(object);
    if (this._box.isEmpty()) return null;
    this._box.getCenter(this._center); this._box.getSize(this._size);
    const axes = [
      { axis: "x", length: this._size.x }, { axis: "y", length: this._size.y }, { axis: "z", length: this._size.z },
    ].sort((a, b) => b.length - a.length);
    return {
      box: this._box,
      center: this._center,
      size: this._size,
      majorAxis: axes[0].axis,
      radius: Math.max(1e-4, (axes[1].length + axes[2].length) * 0.25),
      elongated: axes[0].length > axes[1].length * 1.45,
    };
  }

  _boneFor(role) {
    const index = this.profile?.boneRoles?.[role]?.targetBoneIndex;
    return Number.isInteger(index) ? this.mesh.skeleton.bones[index] : null;
  }

  _fingerTip(side, digit) {
    const joints = this.profile?.fingers?.[side]?.[digit]?.joints || [];
    const binding = joints[joints.length - 1];
    return Number.isInteger(binding?.targetBoneIndex) ? this.mesh.skeleton.bones[binding.targetBoneIndex] : null;
  }

  _handLength(side, wrist) {
    let sum = 0, count = 0;
    wrist.getWorldPosition(this._wrist);
    for (const digit of ["index", "middle", "ring", "little"]) {
      const tip = this._fingerTip(side, digit); if (!tip) continue;
      tip.getWorldPosition(this._tip); sum += this._tip.distanceTo(this._wrist); count++;
    }
    return count ? sum / count : 0.8;
  }

  solve(options = {}) {
    const side = options.side === "right" ? "right" : "left";
    const type = GRIP_TYPES.includes(options.gripType) ? options.gripType : "cylindrical";
    const target = options.target || this.getSelectedObject() || this.target;
    // Re-solving an existing attachment must happen in world space. Detach it
    // temporarily first, otherwise moving the wrist would also move the target
    // while the solver is still using the old contact box.
    if (this.attached && this.target) this._detachCurrentTarget();
    const analysis = this.analyzeTarget(target);
    const wrist = this._boneFor(`${side}.wrist`);
    if (!analysis || !wrist) return this._result(false, "Missing target geometry or wrist mapping.");
    this.target = target; this.side = side; this.gripType = type;
    this.mesh.updateMatrixWorld(true); wrist.getWorldPosition(this._wrist); wrist.getWorldQuaternion(this._wristQ);
    const handLength = this._handLength(side, wrist);
    this._approach.copy(analysis.center).sub(this._wrist);
    if (this._approach.lengthSq() < 1e-8) this._approach.set(0, 0, -1); else this._approach.normalize();
    analysis.box.clampPoint(this._wrist, this._surface);
    this._candidate.copy(this._surface).addScaledVector(this._approach, -Math.max(analysis.radius * 0.25, handLength * 0.42));
    const middleTip = this._fingerTip(side, "middle");
    if (middleTip) middleTip.getWorldPosition(this._tip); else this._tip.copy(this._wrist).add(this._approach);
    this._forward.copy(this._tip).sub(this._wrist).normalize();
    this._rotation.setFromUnitVectors(this._forward, this._approach);
    this._wristQ.premultiply(this._rotation).normalize();
    const positioned = this.solveHandController(side, this._candidate, this._wristQ, {
      mesh: this.mesh,
      autoKey: false,
      persistent: false,
      source: "autoGrip",
    });
    this.mesh.updateMatrixWorld(true);

    const profile = GRIP_PROFILE[type];
    const previousSymmetry = this.hands.state.symmetry; this.hands.state.symmetry = false;
    const active = new Set(profile.active || ["thumb", "index", "middle", "ring", "little"]);
    this.contacts.length = 0;
    this.hands.runSilently(() => {
      this.hands.reset(side);
      this.hands.setMaster(side, "curl", profile.curl, { mirror: false });
      this.hands.setMaster(side, "cup", profile.cup, { mirror: false });
      this.hands.setMaster(side, "fan", profile.fan, { mirror: false });
      this.hands.setMaster(side, "thumbOpposition", profile.opposition, { mirror: false });
      this.hands.setMaster(side, "tension", profile.tension, { mirror: false });
      for (const digit of ["thumb", "index", "middle", "ring", "little"]) {
        if (!active.has(digit)) { this.hands.setFinger(side, digit, "curl", -profile.curl * 0.7, { mirror: false }); continue; }
        this._solveFinger(side, digit, analysis.box, profile.curl);
      }
    });
    this.hands.beginFrame(); this.hands.evaluate(this._layer, 0); this.mesh.updateMatrixWorld(true);
    for (const digit of active) this._recordContact(side, digit, analysis.box, target);
    this.hands.state.symmetry = previousSymmetry;
    this.autoAttach = options.attach !== false;
    let attachment = null;
    if (this.autoAttach) {
      attachment = this.attachTargetToHand(target, wrist, { side, gripType: type, mesh: this.mesh });
      this.attached = attachment === true || attachment?.ok === true;
    } else this.attached = false;
    this.followTarget = !this.attached && options.maintain === true;
    this.maintainGrip = this.followTarget;
    if (this.maintainGrip) this._captureMaintainPose(target, wrist);
    this._visualScale = Math.max(0.025, Math.min(0.16, analysis.radius * 0.12));
    if (this.maintainGrip) for (const contact of this.contacts) if (contact.status === "valid") contact.status = "locked";
    this._updateContactVisuals();
    const valid = this.contacts.filter((contact) => contact.status === "valid" || contact.status === "locked").length;
    const contactMessage = valid ? `${valid} finger contacts solved.` : "Grip pose applied; target is outside exact finger contact range.";
    const attachmentMessage = this.attached ? " Prop attached to the character hand." : "";
    return this._result(true, contactMessage + attachmentMessage, { positioned, attached: this.attached, attachment, contacts: this.contacts });
  }

  _solveFinger(side, digit, box, baseline) {
    const tipBone = this._fingerTip(side, digit); if (!tipBone) return;
    let bestCurl = baseline, bestScore = Infinity;
    for (let step = 0; step <= 10; step++) {
      const curl = step / 10;
      this.hands.setFinger(side, digit, "curl", curl - baseline, { mirror: false });
      this.hands.beginFrame(); this.hands.evaluate(this._layer, 0); this.mesh.updateMatrixWorld(true);
      tipBone.getWorldPosition(this._tip);
      const distance = signedDistanceToBox(this._tip, box);
      const score = Math.abs(distance) + (distance < 0 ? Math.abs(distance) * 2.5 : 0);
      if (score < bestScore) { bestScore = score; bestCurl = curl; }
    }
    this.hands.setFinger(side, digit, "curl", bestCurl - baseline, { mirror: false });
  }

  _recordContact(side, digit, box, target) {
    const tipBone = this._fingerTip(side, digit); if (!tipBone) return;
    tipBone.getWorldPosition(this._tip); box.clampPoint(this._tip, this._closest);
    const signedDistance = signedDistanceToBox(this._tip, box);
    const status = signedDistance < -0.015 ? "penetration" : Math.abs(signedDistance) < 0.04 ? "valid" : Math.abs(signedDistance) < 0.12 ? "near" : "miss";
    const localPoint = target.worldToLocal(this._closest.clone());
    this.contacts.push({ finger: digit, status, distance: signedDistance, worldPoint: this._closest.toArray(), localPoint: localPoint.toArray(), locked: status === "valid" });
  }

  _captureMaintainPose(target, wrist) {
    target.updateWorldMatrix(true, false); wrist.getWorldPosition(this._maintainedWorld); wrist.getWorldQuaternion(this._maintainedQ);
    this._localWrist.copy(this._maintainedWorld); target.worldToLocal(this._localWrist);
    target.getWorldQuaternion(this._targetQ).invert(); this._localQ.copy(this._targetQ).multiply(this._maintainedQ);
    const elements = target.matrixWorld.elements; for (let i = 0; i < 16; i++) this._lastTargetMatrix[i] = elements[i];
  }

  _updateContactVisuals() {
    if (!this.target || !this.contacts.length) { this.contactGroup.visible = false; return; }
    const parent = this.mesh.parent || this.mesh;
    if (this.contactGroup.parent !== parent) parent.add(this.contactGroup);
    while (this.contactGroup.children.length < this.contacts.length) {
      const material = new THREE.MeshBasicMaterial({ color: 0x68d6b5, depthTest: false, transparent: true, opacity: 0.92 });
      const point = new THREE.Mesh(this.contactGeometry, material); point.renderOrder = 999; point.userData.autoGripContact = true; this.contactGroup.add(point);
    }
    const colors = { valid: 0x68d6b5, near: 0xe8c56d, penetration: 0xef5d72, miss: 0xef7d8d, locked: 0x5d9cff };
    for (let i = 0; i < this.contactGroup.children.length; i++) {
      const point = this.contactGroup.children[i], contact = this.contacts[i]; point.visible = !!contact;
      if (!contact) continue;
      this._visualPoint.fromArray(contact.localPoint); this.target.localToWorld(this._visualPoint); parent.worldToLocal(this._visualPoint);
      point.position.copy(this._visualPoint); point.scale.setScalar(this._visualScale); point.material.color.setHex(colors[contact.status] || colors.miss);
      point.userData.finger = contact.finger; point.userData.status = contact.status;
    }
    this.contactGroup.visible = true;
  }

  setContactPoint(finger, localPoint) {
    const contact = this.contacts.find((item) => item.finger === finger);
    if (!contact || !Array.isArray(localPoint) || localPoint.length < 3) return false;
    contact.localPoint = localPoint.slice(0, 3).map(Number); contact.status = "locked"; contact.locked = true; this._updateContactVisuals(); return true;
  }

  update() {
    if (this._offlineSuspended) return;
    if (!this.target && this.pendingTargetId) {
      const restored = this.resolveObject(this.pendingTargetId);
      if (restored) {
        this.target = restored; this.maintainGrip = this.pendingMaintain; this.pendingTargetId = null; this.pendingMaintain = false;
        if (this.pendingAttach) {
          const wrist = this._boneFor(`${this.side}.wrist`);
          const result = wrist ? this.attachTargetToHand(restored, wrist, { side: this.side, gripType: this.gripType, mesh: this.mesh }) : null;
          this.attached = result === true || result?.ok === true;
          if (this.attached) { this.followTarget = false; this.maintainGrip = false; }
          this.pendingAttach = false;
        }
        restored.updateWorldMatrix(true, false); this._lastTargetMatrix.fill(Number.NaN);
      }
    }
    if (!this.maintainGrip || !this.target) return;
    this.target.updateWorldMatrix(true, false);
    const elements = this.target.matrixWorld.elements; let changed = false;
    for (let i = 0; i < 16; i++) if (!Number.isFinite(this._lastTargetMatrix[i]) || Math.abs(elements[i] - this._lastTargetMatrix[i]) > 1e-6) { changed = true; break; }
    if (!changed) return;
    this._maintainedWorld.copy(this._localWrist).applyMatrix4(this.target.matrixWorld);
    this.target.getWorldQuaternion(this._targetQ); this._maintainedQ.copy(this._targetQ).multiply(this._localQ);
    this.solveHandController(this.side, this._maintainedWorld, this._maintainedQ, {
      mesh: this.mesh,
      autoKey: false,
      persistent: false,
      source: "autoGrip-follow",
    });
    this._updateContactVisuals();
    for (let i = 0; i < 16; i++) this._lastTargetMatrix[i] = elements[i];
  }

  setFollowTarget(enabled) {
    if (this.attached) return false;
    this.followTarget = !!enabled;
    this.maintainGrip = this.followTarget && !!this.target;
    if (this.maintainGrip && this.target) {
      const wrist = this._boneFor(`${this.side}.wrist`);
      if (wrist) this._captureMaintainPose(this.target, wrist);
    }
    return this.followTarget;
  }

  setAutoAttach(enabled) {
    this.autoAttach = !!enabled;
    if (this.autoAttach) this.setFollowTarget(false);
    return this.autoAttach;
  }

  _detachCurrentTarget() {
    if (!this.attached || !this.target) return false;
    const detached = this.detachTargetFromHand(this.target, { side: this.side, mesh: this.mesh });
    const ok = detached === true || detached?.ok === true;
    if (ok) this.attached = false;
    return ok;
  }

  release() { this._detachCurrentTarget(); this.followTarget = false; this.maintainGrip = false; this.attached = false; this.pendingMaintain = false; this.pendingAttach = false; this.pendingTargetId = null; this.target = null; this.contacts.length = 0; this.lastResult = null; this.contactGroup.visible = false; }
  dispose() { this.release(); this.contactGroup.removeFromParent(); this.contactGeometry.dispose(); for (const child of this.contactGroup.children) child.material?.dispose?.(); this.contactGroup.clear(); }
  _result(ok, message, extra = {}) { this.lastResult = { ok, message, ...extra }; return this.lastResult; }

  toJSON() {
    return {
      side: this.side, gripType: this.gripType, autoAttach: this.autoAttach, attached: this.attached, followTarget: this.followTarget, maintainGrip: this.maintainGrip,
      targetId: this.target?.userData?.sceneObjId || this.pendingTargetId || null,
      localWrist: this._localWrist.toArray(), localQuaternion: this._localQ.toArray(),
      contacts: this.contacts.map((contact) => ({ ...contact })),
    };
  }

  restore(data) {
    if (!data || typeof data !== "object") return false;
    this._detachCurrentTarget();
    this.side = data.side === "right" ? "right" : "left";
    this.gripType = GRIP_TYPES.includes(data.gripType) ? data.gripType : "cylindrical";
    this.autoAttach = data.autoAttach !== false;
    this.attached = false;
    // Do not revive the old always-on wrist lock from pre-fix projects. Only
    // the new explicit followTarget flag is allowed to restore it.
    this.followTarget = data.followTarget === true;
    this.maintainGrip = false;
    this.target = null;
    this.pendingTargetId = typeof data.targetId === "string" ? data.targetId : null;
    this.pendingAttach = !!data.attached && this.autoAttach && !!this.pendingTargetId;
    this.pendingMaintain = this.followTarget && !!data.maintainGrip && !!this.pendingTargetId;
    if (Array.isArray(data.localWrist)) this._localWrist.fromArray(data.localWrist);
    if (Array.isArray(data.localQuaternion)) this._localQ.fromArray(data.localQuaternion);
    this.contacts = Array.isArray(data.contacts) ? data.contacts.map((contact) => ({ ...contact, locked: false })) : [];
    this.lastResult = null;
    return true;
  }
}
