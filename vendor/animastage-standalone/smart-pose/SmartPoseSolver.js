import * as THREE from "three";
import { TwoBoneIKSolver } from "./TwoBoneIKSolver.js";
import { buildSpineFractions } from "./SpineDistribution.js";
import { LookAtSolver } from "./LookAtSolver.js";

const EPS = 1e-7;

function getArm(map, side) {
  return side === "left" ? map?.semantic?.leftArm : map?.semantic?.rightArm;
}

function getLeg(map, side) {
  return side === "left" ? map?.semantic?.leftLeg : map?.semantic?.rightLeg;
}

function controllerSide(id) {
  if (id?.startsWith("left")) return "left";
  if (id?.startsWith("right")) return "right";
  return "center";
}

export class SmartPoseSolver {
  constructor() {
    this.ik = new TwoBoneIKSolver();
    this.lookAt = new LookAtSolver();
    this.tmpPos = new THREE.Vector3();
    this.tmpPos2 = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.tmpQuat2 = new THREE.Quaternion();
    this.tmpQuat3 = new THREE.Quaternion();
    this.tmpMat = new THREE.Matrix4();
    this.identityQ = new THREE.Quaternion();
  }

  solveController({ controllerId, controllerObject, controllerObjects, rigMap, settings }) {
    if (!controllerId || !controllerObject || !rigMap?.semantic) {
      return { solved: false, affected: [], error: Infinity,
        reason: !controllerId ? "no controllerId" : !controllerObject ? "no controller object" : "rig map has no semantic bones" };
    }
    controllerObject.updateWorldMatrix(true, false);
    controllerObject.getWorldPosition(this.tmpPos);
    controllerObject.getWorldQuaternion(this.tmpQuat);

    if (controllerId === "leftHand" || controllerId === "rightHand") {
      return this.solveArm(controllerId, controllerObject, controllerObjects, rigMap, settings);
    }
    if (controllerId === "leftElbowPole" || controllerId === "rightElbowPole") {
      const handId = controllerId === "leftElbowPole" ? "leftHand" : "rightHand";
      const handObject = controllerObjects.get(handId);
      return handObject
        ? this.solveArm(handId, handObject, controllerObjects, rigMap, settings)
        : { solved: false, affected: [], error: Infinity, reason: "paired hand controller object missing" };
    }
    if (controllerId === "leftFoot" || controllerId === "rightFoot") {
      return this.solveLeg(controllerId, controllerObject, controllerObjects, rigMap, settings);
    }
    if (controllerId === "leftKneePole" || controllerId === "rightKneePole") {
      const footId = controllerId === "leftKneePole" ? "leftFoot" : "rightFoot";
      const footObject = controllerObjects.get(footId);
      return footObject
        ? this.solveLeg(footId, footObject, controllerObjects, rigMap, settings)
        : { solved: false, affected: [], error: Infinity, reason: "paired foot controller object missing" };
    }
    if (controllerId === "pelvis" || controllerId === "root") {
      return controllerId === "root"
        ? this.applyWorldTransformToBone(rigMap.semantic.root || rigMap.semantic.center, controllerObject, { position: true, rotation: true })
        : this.solvePelvis(controllerObject, rigMap);
    }
    if (controllerId === "chest") {
      return this.solveChest(controllerObject, rigMap);
    }
    if (controllerId === "head") {
      return this.solveHead(controllerObject, rigMap, settings);
    }
    if (controllerId === "lookTarget") {
      // Ported look-at (quaternion-limits.ts): head turns toward the target
      // inside yaw/pitch cones; a target behind resolves to the yaw limit
      // instead of a 180° flip.
      const head = rigMap.semantic.head;
      if (!head) return { solved: false, affected: [], error: Infinity, reason: "head bone not mapped" };
      controllerObject.getWorldPosition(this.tmpPos);
      this.lookAt.yawLimitRad = ((settings.lookAtYawLimitDeg ?? 70) * Math.PI) / 180;
      this.lookAt.pitchLimitRad = ((settings.lookAtPitchLimitDeg ?? 45) * Math.PI) / 180;
      this.lookAt.weight = settings.lookAtWeight ?? 1;
      const r = this.lookAt.solve({
        head,
        neck: rigMap.semantic.neck || null,
        targetWorldPos: this.tmpPos,
      });
      return { solved: r.affected.length > 0, affected: r.affected, error: 0 };
    }
    return { solved: false, affected: [], error: Infinity, reason: `unknown controller: ${controllerId}` };
  }

  solveArm(controllerId, controllerObject, controllerObjects, rigMap, settings = {}) {
    const side = controllerSide(controllerId);
    const arm = getArm(rigMap, side);
    const startBone = arm?.upperArm;
    const midBone = arm?.elbow;
    const endBone = arm?.wrist || arm?.hand;
    const poleObject = controllerObjects.get(side === "left" ? "leftElbowPole" : "rightElbowPole");
    if (!startBone || !midBone || !endBone) {
      return { solved: false, affected: [], error: Infinity,
        reason: `arm chain incomplete: upperArm=${!!startBone} elbow=${!!midBone} wrist=${!!endBone}` };
    }
    controllerObject.getWorldPosition(this.tmpPos);
    if (poleObject) poleObject.getWorldPosition(this.tmpPos2);
    controllerObject.getWorldQuaternion(this.tmpQuat);
    return this.ik.solve({
      startBone,
      midBone,
      endBone,
      targetPosition: this.tmpPos,
      polePosition: poleObject ? this.tmpPos2 : null,
      stretchLimit: settings.stretchLimit || 1,
      endWorldQuaternion: this.tmpQuat,
      endRotationFollow: settings.handRotationFollow ?? 1,
      chainId: controllerId,
    });
  }

  solveLeg(controllerId, controllerObject, controllerObjects, rigMap, settings = {}) {
    const side = controllerSide(controllerId);
    const leg = getLeg(rigMap, side);
    // LEG SOLVER OWNERSHIP (leg-solver-ownership.ts): exactly one system owns
    // the legs. "nativeMmdIk" drives the model's own IK target bone — the MMD
    // CCDIK chain then moves hip/knee/shin exactly like VMD motions do.
    const legMode = settings.legSolverMode || "nativeMmdIk";
    if (legMode === "disabled") return { solved: false, affected: [], error: Infinity, reason: "leg solver mode = disabled" };
    if (legMode === "nativeMmdIk" && leg?.footIK) {
      return this.applyWorldTransformToBone(leg.footIK, controllerObject, { position: true, rotation: true });
    }
    const startBone = leg?.hip || leg?.upperLeg;
    const midBone = leg?.knee;
    const endBone = leg?.ankle || leg?.footIK;
    const poleObject = controllerObjects.get(side === "left" ? "leftKneePole" : "rightKneePole");
    if (!startBone || !midBone || !endBone) {
      return { solved: false, affected: [], error: Infinity,
        reason: `leg chain incomplete: hip=${!!startBone} knee=${!!midBone} ankle=${!!endBone}` };
    }
    controllerObject.getWorldPosition(this.tmpPos);
    if (poleObject) poleObject.getWorldPosition(this.tmpPos2);
    controllerObject.getWorldQuaternion(this.tmpQuat);
    return this.ik.solve({
      startBone,
      midBone,
      endBone,
      targetPosition: this.tmpPos,
      polePosition: poleObject ? this.tmpPos2 : null,
      stretchLimit: settings.stretchLimit || 1,
      endWorldQuaternion: this.tmpQuat,
      endRotationFollow: settings.footRotationFollow ?? 1,
      chainId: controllerId,
    });
  }

  solvePelvis(controllerObject, rigMap) {
    const s = rigMap.semantic;
    const positionBone = s.groove || s.center || s.root;
    const rotationBone = s.lowerBody || s.pelvis || s.center || s.root;
    const affected = [];
    let solved = false;
    if (positionBone) {
      const r = this.applyWorldTransformToBone(positionBone, controllerObject, { position: true, rotation: false });
      solved = solved || r.solved;
      affected.push(...r.affected);
    }
    if (rotationBone) {
      const r = this.applyWorldTransformToBone(rotationBone, controllerObject, { position: false, rotation: true });
      solved = solved || r.solved;
      affected.push(...r.affected);
    }
    return { solved, affected: Array.from(new Set(affected)), error: solved ? 0 : Infinity,
      reason: solved ? undefined : "no pelvis/center/root bone mapped" };
  }

  solveChest(controllerObject, rigMap) {
    const torso = (rigMap.semantic.torso || rigMap.semantic.spine || [])
      .filter((bone) => bone && bone !== rigMap.semantic.center && bone !== rigMap.semantic.root);
    if (!torso.length) return { solved: false, affected: [], error: Infinity, reason: "no torso/spine bones mapped" };

    const targetBone = rigMap.semantic.chest || rigMap.semantic.upperBody2 || rigMap.semantic.upperBody || torso[torso.length - 1];
    if (!targetBone) return { solved: false, affected: [], error: Infinity, reason: "chest target bone not mapped" };

    controllerObject.updateWorldMatrix(true, false);
    controllerObject.getWorldQuaternion(this.tmpQuat);
    targetBone.updateWorldMatrix(true, false);
    targetBone.getWorldQuaternion(this.tmpQuat2);
    this.tmpQuat3.copy(this.tmpQuat).multiply(this.tmpQuat2.invert()).normalize();

    // spine-distribution.ts: normalized fractions guarantee the chain sums to
    // the FULL target rotation regardless of how many optional upper-body
    // bones this particular model has.
    const baseWeights = [0.1, 0.45, 0.35, 0.1];
    const fractions = buildSpineFractions(
      torso.map((_, i) => baseWeights[i] ?? baseWeights[baseWeights.length - 1]),
    );
    const affected = [];
    for (let i = 0; i < torso.length; i++) {
      const w = fractions[i];
      const q = new THREE.Quaternion().copy(this.identityQ).slerp(this.tmpQuat3, w).normalize();
      this.ik.rotateBoneByWorldDelta(torso[i], q);
      affected.push(torso[i].name);
    }
    return { solved: true, affected: affected.filter(Boolean), error: 0 };
  }

  solveHead(controllerObject, rigMap) {
    const neck = rigMap.semantic.neck;
    const head = rigMap.semantic.head;
    if (!neck || !head) return this.applyWorldTransformToBone(head, controllerObject, { position: false, rotation: true });
    neck.updateWorldMatrix(true, true);
    const neckPos = neck.getWorldPosition(this.tmpPos2);
    const headPos = head.getWorldPosition(new THREE.Vector3());
    const target = controllerObject.getWorldPosition(this.tmpPos);
    const oldDir = headPos.sub(neckPos);
    const newDir = target.clone().sub(neckPos);
    if (oldDir.lengthSq() > EPS && newDir.lengthSq() > EPS) {
      oldDir.normalize();
      newDir.normalize();
      this.tmpQuat.setFromUnitVectors(oldDir, newDir);
      this.ik.rotateBoneByWorldDelta(neck, this.tmpQuat);
    }
    controllerObject.getWorldQuaternion(this.tmpQuat2);
    this.ik.setBoneWorldQuaternion(head, this.tmpQuat2);
    return { solved: true, affected: [neck.name, head.name].filter(Boolean), error: head.getWorldPosition(this.tmpPos2).distanceTo(target) };
  }

  applyWorldTransformToBone(bone, object, opts = {}) {
    if (!bone || !object) return { solved: false, affected: [], error: Infinity,
      reason: !bone ? "target bone not mapped" : "no controller object" };
    object.updateWorldMatrix(true, false);
    if (opts.position) {
      object.getWorldPosition(this.tmpPos);
      if (bone.parent) {
        bone.parent.updateWorldMatrix(true, false);
        this.tmpMat.copy(bone.parent.matrixWorld).invert();
        bone.position.copy(this.tmpPos.applyMatrix4(this.tmpMat));
      } else {
        bone.position.copy(this.tmpPos);
      }
    }
    if (opts.rotation) {
      object.getWorldQuaternion(this.tmpQuat);
      this.ik.setBoneWorldQuaternion(bone, this.tmpQuat);
    }
    bone.updateWorldMatrix(true, true);
    return { solved: true, affected: [bone.name].filter(Boolean), error: 0 };
  }
}
