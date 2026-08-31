// SmartPoseGrantSolver.js — MMD grant (付与) pass for Smart Pose mode.
//
// WHY: PMX models with D-bone chains (右足D, 右ひざD, 右足首D…) skin the mesh
// to the D bones, which normally COPY rotation from the visible FK bones via
// grants — executed by MMDAnimationHelper's GrantSolver every frame. While
// Smart Pose owns the pose the helper is paused, so rotating the FK chain
// left the D bones frozen at rest and the mesh (weighted between both
// chains) tore into spikes at knees/elbows. This solver re-applies grants
// after every Smart Pose solve.
//
// IDEMPOTENT: every pass first restores the authored (pre-grant) transform,
// then evaluates grants once in PMX dependency order. Never adopt the current
// value as authored during a solve: snapshots can already contain a grant, and
// treating that result as a new base doubles Knee/Elbow/D rotations per drag.

import * as THREE from "three";

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _identityQ = new THREE.Quaternion();

function quatsClose(a, b) {
  return Math.abs(a.dot(b)) > 1 - 1e-9;
}

/** Bone indices owned by DYNAMIC rigid bodies (type 1 physics / type 2
 *  physics+bone). Writing/restoring these bones from pose code teleports the
 *  bodies and the physics solver answers with impulses — every touch compounds them. */
export function collectPhysicsOwnedBoneIndices(mmd) {
  const owned = new Set();
  for (const rb of mmd?.rigidBodies || []) {
    const type = rb?.type ?? rb?.physicsType ?? 0;
    const boneIndex = rb?.boneIndex ?? rb?.bone ?? -1;
    if (type !== 0 && boneIndex >= 0) owned.add(boneIndex);
  }
  return owned;
}

export class SmartPoseGrantSolver {
  constructor() {
    this.mesh = null;
    this.entries = [];
    this.skippedPhysics = 0;
  }

  get size() {
    return this.entries.length;
  }

  /** Collect grant entries from the mesh (userData.MMD.grants, with a
   *  fallback scan of per-bone grant data). Sorted like three.js GrantSolver:
   *  by transformationClass so donor chains resolve in order. */
  setMesh(mesh) {
    this.mesh = mesh || null;
    this.entries = [];
    this.skippedPhysics = 0;
    const mmd = mesh?.geometry?.userData?.MMD;
    const bones = mesh?.skeleton?.bones;
    if (!mmd || !bones?.length) return this.size;

    // PHYSICS OWNERSHIP: bones driven by dynamic rigid bodies (type 1 physics
    // / type 2 physics+bone) belong to Reze. In the real MMD pipeline grants
    // run BEFORE physics and physics overwrites them — if we grant-write such
    // a bone here, the physics solver sees a teleported body and answers with
    // impulses; every click compounds them until the mesh explodes. Skip them.
    const physicsOwned = collectPhysicsOwnedBoneIndices(mmd);
    this.physicsOwnedIndices = physicsOwned;

    const loaderOrdered = Array.isArray(mmd.grants) && mmd.grants.length > 0;
    let raw = loaderOrdered ? mmd.grants.map((g) => ({ ...g })) : [];
    if (!raw.length && Array.isArray(mmd.bones)) {
      for (let i = 0; i < mmd.bones.length; i++) {
        const grant = mmd.bones[i]?.grant;
        if (!grant) continue;
        raw.push({ index: i, ...grant, transformationClass: mmd.bones[i].transformationClass ?? 0 });
      }
    }
    // MMDLoader already orders `mmd.grants` from grant parents to children.
    // Preserve that order. Only the metadata fallback needs a deterministic
    // deformation-class/index sort.
    if (!loaderOrdered) {
      raw.sort((a, b) => (a.transformationClass ?? 0) - (b.transformationClass ?? 0) || a.index - b.index);
    }

    for (const grant of raw) {
      if (grant.isLocal) continue; // matches three.js GrantSolver: local grants unsupported
      if (physicsOwned.has(grant.index)) {
        this.skippedPhysics++;
        continue;
      }
      const bone = bones[grant.index];
      const donor = bones[grant.parentIndex];
      if (!bone || !donor || bone === donor) continue;
      const affectRotation = grant.affectRotation !== false && grant.affectRotation !== 0;
      const affectPosition = !!grant.affectPosition;
      if (!affectRotation && !affectPosition) continue;
      this.entries.push({
        bone,
        donor,
        ratio: Number.isFinite(grant.ratio) ? grant.ratio : 1,
        affectRotation,
        affectPosition,
        authoredQ: bone.quaternion.clone(),
        authoredP: bone.position.clone(),
      });
    }
    // The pose may already have been evaluated by MMDAnimationHelper before
    // Smart Pose is enabled. Recover the pre-grant value instead of using an
    // already-granted quaternion as the baseline.
    this.syncFromCurrentPose();
    return this.size;
  }

  /** Recover authored transforms from a CURRENT, already grant-evaluated pose. */
  syncFromCurrentPose() {
    for (const e of this.entries) {
      if (e.affectRotation) {
        _q.identity().slerp(e.donor.quaternion, e.ratio).invert();
        e.authoredQ.copy(e.bone.quaternion).multiply(_q).normalize();
      } else {
        e.authoredQ.copy(e.bone.quaternion);
      }
      if (e.affectPosition) {
        _v.copy(e.donor.position).multiplyScalar(e.ratio);
        e.authoredP.copy(e.bone.position).sub(_v);
      } else {
        e.authoredP.copy(e.bone.position);
      }
    }
  }

  /** Apply one stateless grant pass. Returns names of driven bones. */
  apply() {
    const affected = [];
    // GrantSolver is multiplicative, so reset every output first. This is the
    // same invariant used by the stable Classic Pose evaluator.
    for (const e of this.entries) {
      if (e.affectRotation) e.bone.quaternion.copy(e.authoredQ);
      if (e.affectPosition) e.bone.position.copy(e.authoredP);
    }
    for (const e of this.entries) {
      let moved = false;
      if (e.affectRotation) {
        _q.set(0, 0, 0, 1).slerp(e.donor.quaternion, e.ratio);
        e.bone.quaternion.multiply(_q).normalize();
        if (!quatsClose(_q, _identityQ)) moved = true;
      }
      if (e.affectPosition) {
        _v.copy(e.donor.position).multiplyScalar(e.ratio);
        if (_v.lengthSq() > 1e-14) moved = true;
        e.bone.position.add(_v);
      }
      if (moved && e.bone.name) affected.push(e.bone.name);
    }
    return affected;
  }
}
