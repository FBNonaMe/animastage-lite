import * as THREE from "three";

const EPS = 1e-7;

function finiteVec3(v) {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function normalizeSafe(v, fallback) {
  const len = v.length();
  if (len > EPS && finiteVec3(v)) return v.multiplyScalar(1 / len);
  return v.copy(fallback || new THREE.Vector3(0, 1, 0));
}

export class TwoBoneIKSolver {
  constructor() {
    this.p0 = new THREE.Vector3();
    this.p1 = new THREE.Vector3();
    this.p2 = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.targetClamped = new THREE.Vector3();
    this.toTarget = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.poleDir = new THREE.Vector3();
    this.bendDir = new THREE.Vector3();
    this.newMid = new THREE.Vector3();
    this.oldDir = new THREE.Vector3();
    this.newDir = new THREE.Vector3();
    this.midNow = new THREE.Vector3();
    this.endNow = new THREE.Vector3();
    this.qDelta = new THREE.Quaternion();
    this.qWorld = new THREE.Quaternion();
    this.qParent = new THREE.Quaternion();
    this.qDesired = new THREE.Quaternion();
    this.identityQ = new THREE.Quaternion();
    this.prevPoleDirs = new Map();
  }

  solve(options) {
    const {
      startBone,
      midBone,
      endBone,
      targetPosition,
      polePosition,
      stretchLimit = 1,
      endWorldQuaternion = null,
      endRotationFollow = 1,
      chainId = "chain",
    } = options || {};

    if (!startBone || !midBone || !endBone || !targetPosition) {
      return { solved: false, error: Infinity, affected: [] };
    }

    startBone.updateWorldMatrix(true, true);
    this.p0.copy(startBone.getWorldPosition(this.p0));
    this.p1.copy(midBone.getWorldPosition(this.p1));
    this.p2.copy(endBone.getWorldPosition(this.p2));
    this.target.copy(targetPosition);

    const l1 = this.p1.distanceTo(this.p0);
    const l2 = this.p2.distanceTo(this.p1);
    if (l1 <= EPS || l2 <= EPS) return { solved: false, error: Infinity, affected: [] };

    this.toTarget.copy(this.target).sub(this.p0);
    let d = this.toTarget.length();
    if (d <= EPS) {
      const prev = this.prevPoleDirs.get(chainId) || this.p1.clone().sub(this.p0).normalize();
      this.toTarget.copy(prev).multiplyScalar(EPS * 10);
      d = this.toTarget.length();
    }
    this.dir.copy(this.toTarget).multiplyScalar(1 / d);

    const totalLen = l1 + l2;
    const reach = totalLen * Math.max(0.01, stretchLimit);
    const minReach = Math.max(Math.abs(l1 - l2) + EPS, EPS);
    let clampedD = Math.min(reach, Math.max(minReach, d));
    if (polePosition && clampedD > minReach) {
      const bendReserve = Math.min(totalLen * 0.012, Math.max(0.004, totalLen * 0.004));
      clampedD = Math.min(clampedD, Math.max(minReach, reach - bendReserve));
    }
    this.targetClamped.copy(this.p0).addScaledVector(this.dir, clampedD);

    if (polePosition) this.poleDir.copy(polePosition).sub(this.p0);
    else this.poleDir.copy(this.p1).sub(this.p0);
    this.poleDir.addScaledVector(this.dir, -this.poleDir.dot(this.dir));
    if (this.poleDir.lengthSq() <= EPS) {
      const prev = this.prevPoleDirs.get(chainId);
      if (prev) this.poleDir.copy(prev);
      else this.poleDir.copy(this.p1).sub(this.p0).addScaledVector(this.dir, -this.p1.clone().sub(this.p0).dot(this.dir));
    }
    normalizeSafe(this.poleDir, new THREE.Vector3(0, 1, 0));
    this.prevPoleDirs.set(chainId, this.poleDir.clone());

    const x = (l1 * l1 - l2 * l2 + clampedD * clampedD) / (2 * clampedD);
    const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    this.newMid.copy(this.p0).addScaledVector(this.dir, x).addScaledVector(this.poleDir, h);

    this.oldDir.copy(this.p1).sub(this.p0);
    this.newDir.copy(this.newMid).sub(this.p0);
    if (this.oldDir.lengthSq() > EPS && this.newDir.lengthSq() > EPS) {
      this.oldDir.normalize();
      this.newDir.normalize();
      this.qDelta.setFromUnitVectors(this.oldDir, this.newDir);
      this.rotateBoneByWorldDelta(startBone, this.qDelta);
    }

    startBone.updateWorldMatrix(true, true);
    this.midNow.copy(midBone.getWorldPosition(this.midNow));
    this.endNow.copy(endBone.getWorldPosition(this.endNow));
    this.oldDir.copy(this.endNow).sub(this.midNow);
    this.newDir.copy(this.targetClamped).sub(this.midNow);
    if (this.oldDir.lengthSq() > EPS && this.newDir.lengthSq() > EPS) {
      this.oldDir.normalize();
      this.newDir.normalize();
      this.qDelta.setFromUnitVectors(this.oldDir, this.newDir);
      this.rotateBoneByWorldDelta(midBone, this.qDelta);
    }

    if (endWorldQuaternion && endRotationFollow > EPS) {
      if (endRotationFollow >= 0.999) this.setBoneWorldQuaternion(endBone, endWorldQuaternion);
      else {
        endBone.getWorldQuaternion(this.qWorld);
        this.qDesired.copy(this.qWorld).slerp(endWorldQuaternion, endRotationFollow);
        this.setBoneWorldQuaternion(endBone, this.qDesired);
      }
    }

    startBone.updateWorldMatrix(true, true);
    const error = endBone.getWorldPosition(this.endNow).distanceTo(this.target);
    return {
      solved: Number.isFinite(error),
      error,
      affected: [startBone.name, midBone.name, endBone.name].filter(Boolean),
    };
  }

  rotateBoneByWorldDelta(bone, deltaWorldQuaternion) {
    if (!bone || !deltaWorldQuaternion) return;
    bone.updateWorldMatrix(true, false);
    bone.getWorldQuaternion(this.qWorld);
    this.qDesired.copy(deltaWorldQuaternion).multiply(this.qWorld).normalize();
    this.setBoneWorldQuaternion(bone, this.qDesired);
  }

  setBoneWorldQuaternion(bone, worldQuaternion) {
    if (!bone || !worldQuaternion) return;
    if (bone.parent) bone.parent.updateWorldMatrix(true, false);
    if (bone.parent) bone.parent.getWorldQuaternion(this.qParent).invert();
    else this.qParent.copy(this.identityQ);
    bone.quaternion.copy(this.qParent.multiply(worldQuaternion)).normalize();
    bone.updateWorldMatrix(true, true);
  }
}

export function solveTwoBoneIK(options) {
  return new TwoBoneIKSolver().solve(options);
}
