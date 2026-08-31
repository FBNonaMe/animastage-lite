// LookAtSolver.js — head look-at built on the ported quaternion limits
// (solveLimitedLookAtDelta from quaternion-limits.ts). The head turns toward
// the target but never beyond the yaw/pitch cones, and a target straight
// behind the head resolves to the yaw limit instead of a 180° flip.
// The old file was a stub.

import * as THREE from "three";
import { solveLimitedLookAtDelta, clampQuaternionAngle } from "./JointLimitSolver.js";

const _pos = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();

export class LookAtSolver {
  constructor() {
    this.yawLimitRad = (70 * Math.PI) / 180;
    this.pitchLimitRad = (45 * Math.PI) / 180;
    this.neckShare = 0.35; // portion of the delta absorbed by the neck
    this.weight = 1;
    // model-space forward of the face; MMD models face +Z in three.js
    this.forwardAxis = new THREE.Vector3(0, 0, 1);
    this.upAxis = new THREE.Vector3(0, 1, 0);
  }

  /**
   * Rotate neck+head toward targetWorldPos with limits.
   * @param {{head:THREE.Bone, neck?:THREE.Bone, targetWorldPos:THREE.Vector3}} input
   */
  solve({ head, neck = null, targetWorldPos }) {
    if (!head || !targetWorldPos) return { affected: [] };
    head.updateWorldMatrix(true, false);
    head.getWorldPosition(_pos);
    head.getWorldQuaternion(_q);
    _fwd.copy(this.forwardAxis).applyQuaternion(_q);
    _up.copy(this.upAxis).applyQuaternion(_q);
    _dir.copy(targetWorldPos).sub(_pos);
    if (_dir.lengthSq() < 1e-10) return { affected: [] };

    let delta = solveLimitedLookAtDelta(_fwd, _up, _dir, this.yawLimitRad, this.pitchLimitRad);
    const w = Math.max(0, Math.min(1, this.weight));
    if (w < 1) delta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), delta, w);

    const affected = [];
    const applyWorldDelta = (bone, worldDelta) => {
      const parent = bone.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.getWorldQuaternion(_qParent);
        const local = _qParent.clone().invert().multiply(worldDelta).multiply(_qParent);
        bone.quaternion.premultiply(local).normalize();
      } else {
        bone.quaternion.premultiply(worldDelta).normalize();
      }
      affected.push(bone.name);
    };

    if (neck && this.neckShare > 0) {
      const share = Math.max(0, Math.min(1, this.neckShare));
      const neckDelta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), delta, share);
      const headDelta = neckDelta.clone().invert().multiply(delta);
      applyWorldDelta(neck, neckDelta);
      applyWorldDelta(head, headDelta);
    } else {
      applyWorldDelta(head, delta);
    }
    return { affected: affected.filter(Boolean) };
  }

  /** Convenience: clamp an arbitrary head rotation delta by total angle. */
  clampDelta(delta, maxAngleRad) {
    return clampQuaternionAngle(delta, maxAngleRad);
  }
}
