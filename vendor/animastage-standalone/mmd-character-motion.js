/**
 * MMD character skeleton, animation, physics colliders, and motion helpers.
 */
import * as THREE from 'three';
import { MMDAnimationHelper } from 'three/addons/animation/MMDAnimationHelper.js';
import {
  MMDPhysics as RezeMMDPhysics,
  MMDPhysicsHelper as RezeMMDPhysicsHelper,
  REZE_ENGINE_NAME,
  REZE_ENGINE_VERSION,
} from './physics/RezeMMDPhysics.js?v=rz3';
import { scanUniversalRig, describeRigScan } from './mmd-universal-rig.js';
import { IndependentPhysicsClock } from './physics/IndependentPhysicsClock.js';
import { DeterministicWindField } from './animestage-next/core/DeterministicWindField.js?v=next2';
import {
  capturePhysicsClockRollbackState as captureClockRollbackState,
  restorePhysicsClockRollbackState as restoreClockRollbackState,
  capturePhysicsWorldRollbackState as captureWorldRollbackState,
  restorePhysicsWorldRollbackState as restoreWorldRollbackState,
  capturePhysicsRuntimeRollbackState as captureRuntimeRollbackState,
  restorePhysicsRuntimeRollbackState as restoreRuntimeRollbackState,
  isPhysicsRollbackPending,
  setPhysicsRollbackPending,
} from './physics/PhysicsRollbackHooks.js';

export function createCharacterMotionSystem(deps) {
  const {
    showError,
    clearError = () => {},
    getSettings,
    getScene,
    isCaptureActive = () => false,
    getTransformControls = () => null,
    isTcDragging = () => false,
    escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    getAnimListEl = () => null,
    getVmdNameEl = () => null,
    getRenderer = () => null,
    getCamera = () => null,
    refreshSceneTransformAttach = () => {},
  } = deps;

  const getS = getSettings;

  let pendingModelFile = null;
  const loadedVmdFiles = [];

  const animHelper = new MMDAnimationHelper({
  afterglow: 2.0,
  resetPhysicsOnLoop: true,
});
  const physicsClock = new IndependentPhysicsClock({
  rate: 65,
  maxCatchUpSteps: 4,
  maxBacklogSeconds: 0.07,
  useWorker: true,
});
  // Wind is physics state, not a render-frame effect. Keep an isolated
  // smoothing state per character and advance it only from the same explicit
  // fixed-step time that advances Reze. This makes live playback and offline
  // frame-by-frame rendering independent of RAF/GPU timing.
  const deterministicWind = new DeterministicWindField({
  responseRate: -Math.log(0.95) * 65,
});
  const windCharacterIds = new WeakMap();
  const pendingWindDiscontinuities = new WeakSet();
  let windCharacterSerial = 0;
  let realtimeWindEvaluationTime = 0;
  let offlineWindEvaluationTime = 0;
  // MMD joints are authored around 1/65 s.  Letting the realtime clock replay a
  // quarter-second stall as 8 back-to-back steps makes animated kinematic
  // anchors jump first and the constrained hair/cloth chase them afterwards.
  // That catch-up burst is the classic "physics explosion".  Four steps cover
  // normal 20+ fps playback; older wall time is deliberately discarded.
  const STABLE_CLOCK_CATCH_UP_STEPS = 4;
  const STABLE_CLOCK_BACKLOG_SECONDS = 0.07;
  const physicsRepairState = new WeakMap();
  let lastPhysicsRuntimeStats = {
  scheduledSteps: 0,
  worldSteps: 0,
  physicsWorlds: 0,
  bodies: 0,
  dynamicBodies: 0,
  missingWorlds: 0,
  repairedWorlds: 0,
};
  // Disable arm IK — VMD FK + Grant twist bones drive arms naturally.
  const _ARM_IK_NAME = /腕|ひじ|肘|肩|手|arm|elbow|hand|shoulder|Arm|Elbow|Hand|Shoulder/i;

  function getAnimHelperObjects(helper, mesh) {
  if (helper?.objects?.get) return helper.objects.get(mesh);
  if (typeof helper?.get === 'function') return helper.get(mesh);
  return null;
}

  function isArmIkChain(ik, bones) {
  const idxs = [ik.target, ik.effector, ...(ik.links?.map(l => l.index) ?? [])];
  for (const i of idxs) {
    if (_ARM_IK_NAME.test(bones[i]?.name ?? '')) return true;
  }
  return false;
}

  function patchIkSolverForArmFix(ikSolver) {
  if (!ikSolver || ikSolver._armIkFixPatched) return;
  ikSolver._armIkFixPatched = true;
  const origUpdateOne = ikSolver.updateOne.bind(ikSolver);
  ikSolver.updateOne = function (ik) {
    if (!ik || ik.active === false) return this;
    return origUpdateOne(ik);
  };
  ikSolver.update = function () {
    const iks = this.iks;
    for (let i = 0, il = iks.length; i < il; i++) {
      const ik = iks[i];
      if (ik.active !== false) origUpdateOne(ik);
    }
    return this;
  };
}

  function applyIKFixOnly(mesh, helper) {
  if (!mesh?.skeleton?.bones) return;

  const mmd = mesh.geometry?.userData?.MMD;
  if (mmd?.format === 'pmx') {
    helper.configuration.pmxAnimation = true;
  }

  const objects = getAnimHelperObjects(helper, mesh);
  const ikSolver = objects?.ikSolver;

  if (ikSolver?.iks?.length) {
    patchIkSolverForArmFix(ikSolver);
    for (const ik of ikSolver.iks) {
      if (ik.active === undefined) ik.active = true;
      // Раніше тут було ik.active = false для рук — це ламало деформацію
      // плеча у VMD, які керують руками через IK target (左腕ＩＫ).
      // Тепер усі IK залишаються активними як у стандартному MMD.
    }
  }

  mesh.skeleton.update();
  mesh.updateMatrixWorld(true);

  configureArmPhysicsForAnimation(mesh, helper);
  // makeArmLimbCollidersKinematic(mesh, helper);
  // ↑ PMX-моделі вже задають kinematic через params.type = 0.
  // Ручне втручання збиває фізичний стан і зміщує капсули рук.
}

  /** Run selected chains through the SAME three.js CCDIK solver used by the
   *  classic MMD/VMD path, without evaluating animation, grants, or physics.
   *  Smart Pose uses this after moving the model's real 足IK target bone.
   *  Keeping the pass here prevents the editor layer from growing a second,
   *  subtly different implementation of PMX leg IK. */
  function solveNativeIkChains(mesh, chains = []) {
  if (!mesh?.skeleton?.bones?.length) return { solved: false, affected: [], count: 0 };
  const objects = getAnimHelperObjects(animHelper, mesh);
  const ikSolver = objects?.ikSolver;
  if (!ikSolver?.iks?.length || typeof ikSolver.updateOne !== 'function') {
    return { solved: false, affected: [], count: 0 };
  }

  patchIkSolverForArmFix(ikSolver);
  const requested = Array.isArray(chains) && chains.length ? chains : ikSolver.iks;
  const affected = new Set();
  let count = 0;
  mesh.skeleton.update();
  mesh.updateMatrixWorld(true);
  for (const ik of requested) {
    if (!ik || ik.active === false || !ikSolver.iks.includes(ik)) continue;
    ikSolver.updateOne(ik);
    count++;
    const indices = [ik.target, ik.effector, ...(ik.links || []).map((link) => link.index)];
    for (const index of indices) {
      const name = mesh.skeleton.bones[index]?.name;
      if (name) affected.add(name);
    }
  }
  mesh.skeleton.update();
  mesh.updateMatrixWorld(true);
  return { solved: count > 0, affected: [...affected], count };
}

  const _TORSO_PHYSICS_NAME = /胸|乳|breast|bust|torso|上半身|abdomen|腹|鎖骨|锁骨/i;

  function getPhysicsBoneName(body, mesh) {
  return body.bone?.name ?? mesh.skeleton?.bones?.[body.params?.boneIndex]?.name ?? '';
}

  function isAccessoryPhysicsBody(body) {
  const rbName = `${body.params?.name || ''} ${body.params?.englishName || ''}`.toLowerCase();
  if (/skirt|penis|ribbon|chain|cape|wing|cloth|accessory|服|ペ|装飾|チェーン|リボン|羽|マフ|スカ|ボール|ball|jewel|宝石/.test(rbName)) {
    return true;
  }
  // Dynamic spheres are usually clothing/accessory chain nodes, not limb hitboxes.
  if (body.params?.shapeType === 0 && body.params?.type !== 0) return true;
  return false;
}

  function isMainArmLimbCollider(body, mesh) {
  if (isAccessoryPhysicsBody(body)) return false;

  const shapeType = body.params?.shapeType;
  if (shapeType !== 1 && shapeType !== 2) return false;

  const boneName = getPhysicsBoneName(body, mesh);
  const rbName = `${body.params?.name || ''} ${body.params?.englishName || ''}`.toLowerCase();

  if (/arm|elbow|forearm|upper.?arm|upperarm|lowerarm|ひじ|肘|上腕/.test(rbName)) return true;
  if (/[左右]?腕/.test(boneName) && !/捩/.test(boneName) && !/IK|ＩＫ/i.test(boneName)) return true;
  if (/ひじ|肘/.test(boneName)) return true;
  if (/上腕/.test(boneName)) return true;
  if (/arm|elbow|forearm|upperarm/i.test(boneName.toLowerCase())) return true;
  return false;
}

  function applyKinematicToArmLimbBody(body) {
  body?.makeKinematic?.();
}

  function makeArmLimbCollidersKinematic(mesh, helper) {
  const mmdState = typeof helper?.get === 'function'
    ? helper.get(mesh)
    : getAnimHelperObjects(helper, mesh);
  if (!mmdState?.physics?.bodies?.length) return;

  mesh.skeleton?.update();
  mesh.updateMatrixWorld(true);
  const limbBodies = [];

  for (const body of mmdState.physics.bodies) {
    if (!isMainArmLimbCollider(body, mesh)) continue;
    applyKinematicToArmLimbBody(body);
    limbBodies.push(body);
  }

  for (const body of limbBodies) {
    body.updateFromBone?.();
  }

}

  function syncArmLimbCollidersFromBones(mesh) {
  const physics = getMeshPhysics();
  if (!physics?.bodies?.length) return;

  mesh.skeleton?.update();
  mesh.updateMatrixWorld(true);

  for (const body of physics.bodies) {
    if (!isMainArmLimbCollider(body, mesh)) continue;
    body.updateFromBone?.();
  }
}

  // Body-limb colliders (arms, legs, twist, spine/neck/head) — anything that is a
  // rigid capsule/box bound to a skeletal limb bone, excluding cloth/accessory
  // chains. Used to snap colliders back onto bones while manually posing so the
  // dynamic capsules on W-bone PMX models (Sour Miku / TDA) don't drift off-axis.
  const _LIMB_COLLIDER_BONE = /腕|肩|ひじ|肘|上腕|手首|手捩|腕捩|捩|足|ひざ|膝|足首|つま先|上半身|下半身|首|頭|spine|neck|head|arm|elbow|wrist|shoulder|leg|knee|ankle|toe|thigh|calf|hip/i;

  function isPosableLimbCollider(body, mesh) {
  if (isAccessoryPhysicsBody(body)) return false;
  const shapeType = body.params?.shapeType;
  if (shapeType !== 1 && shapeType !== 2) return false; // box / capsule only
  const boneName = getPhysicsBoneName(body, mesh);
  const key = boneMatchKey(boneName); // JP alias => same rules on renamed rigs
  if (/IK|ＩＫ/i.test(key)) return false;
  if (_LIMB_COLLIDER_BONE.test(key)) return true;
  // Name carried no information — use the universal scan region instead.
  const r = _rigScan?.regionOf?.get(boneName);
  return r === 'armL' || r === 'armR' || r === 'legL' || r === 'legR'
    || r === 'spine' || r === 'head' || r === 'root';
}

  // Snap a rigid body onto its bone regardless of dynamics type. RigidBody.reset()
  // calls _setTransformFromBone() unconditionally (unlike updateFromBone(), which
  // is a no-op for dynamic bodies), so this also re-aligns the dynamic arm/leg
  // capsules on W-bone PMX models. Velocity is zeroed so the sim can't fling them.
  function snapBodyToBone(body, options = {}) {
  if (typeof body?.reset !== 'function') return;
  if (body.params?.boneIndex === -1) return; // free body, not bound to a bone
  body.reset();
  const ab = body.body;
  if (ab && typeof ab.setLinvel === 'function') {
    ab.setLinvel({ x: 0, y: 0, z: 0 }, options.activate !== false);
    ab.setAngvel({ x: 0, y: 0, z: 0 }, options.activate !== false);
    if (options.activate !== false) ab.wakeUp?.();
    return;
  }
}

  // Re-align limb capsules (arms/legs/twist) to the current bone pose. Used after
  // a manual transform so the colliders track the bones we just moved.
  function syncLimbCollidersFromBones(mesh) {
  const target = mesh || currentMesh;
  if (!target?.skeleton) return;
  const physics = animHelper.objects.get(target)?.physics || null;
  if (!physics?.bodies?.length) return;

  target.skeleton.update();
  target.updateMatrixWorld(true);

  for (const body of physics.bodies) {
    if (!isPosableLimbCollider(body, target)) continue;
    snapBodyToBone(body);
  }
}

  // While posing, we must NOT step the sim for the active model: dynamic arm/leg
  // capsules would drive (deform) the bones via _updateBones() and drift off-axis.
  // Instead, pin every bone-bound collider onto the posed skeleton each frame so
  // the bones stay exactly as posed and the debug capsules sit on the limbs.
  function holdCollidersOnPose(mesh, physics) {
  if (!mesh?.skeleton || !physics?.bodies?.length) return;
  mesh.skeleton.update();
  mesh.updateMatrixWorld(true);
  for (const body of physics.bodies) {
    snapBodyToBone(body);
  }
}

  // An OPEN unified timeline is not a reason to freeze Reze. The timeline is
  // visible by default, so treating visibility as a hard pose hold routed every
  // frame through holdCollidersOnPose() and no physics.update() ever ran. Keep
  // the core-pose guard active for timeline poses, but allow free dynamic
  // bodies (hair, clothes and accessories) to simulate. Classic Bones remains
  // a strict hold while its 3D editor owns the skeleton.
  function poseOwnerAllowsPhysics(mesh) {
  if (!mesh || !animHelper.enabled.physics) return false;
  if (classicBonePoseOwnsMesh(mesh) || manualHoldOwnsMesh(mesh)) return false;
  if (isExternalPosePhysicsSuspended(mesh)) return false;
  return timelinePoseOwnsMesh(mesh) || externalPoseOwnsMesh(mesh);
}

  // POSE-CORE GUARD for live physics. Semi-dynamic bodies (type 2 write-back)
  // sit directly on limb/torso bones in many models — simulating them while
  // posing makes the leg itself sag/dangle (右足D drifted 68° in testing).
  // During Smart Pose: core-limb bodies are PINNED to the posed bones every
  // frame and the sim's write-back to core bones is undone, while free
  // dynamics (hair, skirt, chest, constraint-driven accessories) keep living.
  const _poseGuardCache = new WeakMap();
  const _POSE_CORE_RE = /足|脚|ひざ|膝|腕|肘|ひじ|手首|肩|上半身|下半身|センター|腰|首|頭|つま先|leg|knee|thigh|ankle|foot|toe|arm|elbow|wrist|shoulder|spine|hip|waist|center|neck|head/i;
  function getPoseCoreGuard(mesh, physics) {
  let guard = _poseGuardCache.get(physics);
  if (guard) return guard;
  const bodies = [];
  const bones = [];
  const seen = new Set();
  for (const body of physics?.bodies || []) {
    const idx = body?.params?.boneIndex;
    const bone = mesh?.skeleton?.bones?.[idx];
    if (!bone?.name || !_POSE_CORE_RE.test(bone.name)) continue;
    bodies.push(body);
    const type = body?.params?.type ?? 0;
    if (type !== 0 && !seen.has(bone)) {
      seen.add(bone);
      bones.push(bone);
    }
  }
  guard = { bodies, bones };
  _poseGuardCache.set(physics, guard);
  try { console.info(`[Motion] pose-core guard: ${bodies.length} core bodies pinned, ${bones.length} write-back bones protected`); } catch (_) {}
  return guard;
}

  function stepPosePhysics(mesh, physics, dt) {
  try {
    const guard = getPoseCoreGuard(mesh, physics);
    // pin core bodies to the POSED bones (stable anchors for accessory constraints)
    mesh.skeleton.update();
    mesh.updateMatrixWorld(true);
    for (const body of guard.bodies) snapBodyToBone(body, { activate: false });
    // remember core bone transforms; the sim must not own them while posing
    const saved = guard.bones.map((bone) => ({ bone, q: bone.quaternion.clone(), p: bone.position.clone() }));
    physics.update(Math.min(Number.isFinite(dt) && dt > 0 ? dt : 0.016, 0.05));
    for (const s of saved) {
      s.bone.quaternion.copy(s.q);
      s.bone.position.copy(s.p);
    }
  } catch (e) {
    physics._fatal = true;
    markRezeBroken(e);
  }
}

  // ===== MOTION PIPELINE TRACER (window.__motionLog) ======================
  // Records WHICH update branch ran each frame and WHY (all pose-ownership
  // flags), so "physics did not follow the pose" bugs stop being guesswork.
  //   __motionLog.report() — branch counts + current flags
  //   __motionLog.dump(n)  — console.table of the last n frames
  //   __motionLog.save()   — download the full buffer as JSON
  const MOTION_TRACE = {
    buf: [],
    seq: 0,
    lastBranch: "",
    lastError: null,
    consoleBranchByFamily: new Map(),
  };
  function traceMotion(branch, extra = null) {
  let entry;
  try {
    entry = {
      seq: MOTION_TRACE.seq++,
      t: +performance.now().toFixed(0),
      branch,
      flags: {
        boneEditor: classicBonePoseOwnsMesh(currentMesh),
        timelineActive: timelinePoseOwnsMesh(currentMesh),
        manualHold: manualHoldOwnsMesh(currentMesh),
        externalOwner: externalPoseOwnsMesh(currentMesh),
        externalOwnerCount: externalPoseOwnerCount(currentMesh),
        // NOTE: S is LOCAL to the update functions — always go through getS()
        physicsOn: !!(typeof getS === "function" && getS()?.physics),
        physicsEngine: selectedPhysicsBackend(),
        physicsOk: physicsRuntimeReady(),
      },
    };
    if (extra) entry.extra = extra;
    MOTION_TRACE.buf.push(entry);
    if (MOTION_TRACE.buf.length > 2400) MOTION_TRACE.buf.shift();
    MOTION_TRACE.lastBranch = branch;
    // Animation and physics are deliberately separate phases, so their trace
    // entries alternate every render frame. Comparing only with lastBranch
    // therefore printed both phases forever and added avoidable main-thread
    // work to an already heavy render. Preserve every entry in the ring buffer,
    // but announce only an actual state change within each pipeline family.
    const family = String(branch).split(":", 1)[0] || "pipeline";
    const stableBranch = String(branch)
      .replace(/:\d+world-step\(s\)$/, ":N-world-step(s)")
      .replace(/:\d+\/\d+$/, ":N/N");
    if (MOTION_TRACE.consoleBranchByFamily.get(family) !== stableBranch) {
      MOTION_TRACE.consoleBranchByFamily.set(family, stableBranch);
      console.info("[Motion] pipeline →", branch, entry.flags);
    }
  } catch (err) {
    // NEVER die silently: remember why tracing failed and shout once.
    const msg = String(err?.message || err);
    if (MOTION_TRACE.lastError !== msg) {
      MOTION_TRACE.lastError = msg;
      try { console.error("[Motion] tracer failed:", msg); } catch (_) {}
    }
  }
  return entry;
}
  try {
  window.__motionLog = {
    report() {
      const counts = {};
      for (const e of MOTION_TRACE.buf) counts[e.branch] = (counts[e.branch] || 0) + 1;
      const out = { frames: MOTION_TRACE.seq, counts, currentBranch: MOTION_TRACE.lastBranch, lastFlags: MOTION_TRACE.buf[MOTION_TRACE.buf.length - 1]?.flags || null, tracerError: MOTION_TRACE.lastError };
      console.info("[Motion] ===== REPORT =====", out);
      return out;
    },
    dump(n = 60) {
      const rows = MOTION_TRACE.buf.slice(-n);
      try { console.table(rows.map((e) => ({ t: e.t, branch: e.branch, ...e.flags }))); } catch (_) {}
      return rows;
    },
    save() {
      const payload = { exportedAt: new Date().toISOString(), report: this.report(), events: MOTION_TRACE.buf };
      try {
        const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `motion-log-${Date.now()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      } catch (_) {}
      return payload;
    },
  };
} catch (_) {}

  function debugArmBodies() {
  const physics = getMeshPhysics();
  if (!physics) { console.log('no physics'); return; }
  if (!currentMesh?.skeleton) { console.log('no mesh'); return; }

  console.group('=== ARM RIGID BODIES ===');
  for (const body of physics.bodies) {
    const boneName = getPhysicsBoneName(body, currentMesh);
    if (!/腕|肩|ひじ|肘|arm|elbow|shoulder/i.test(boneName)) continue;

    const bone = currentMesh.skeleton.bones[body.params.boneIndex];
    const bonePos = bone ? bone.getWorldPosition(new THREE.Vector3()) : null;
    const bodyPos = body.body ? physBodyOrigin(body.body) : null;

    console.log({
      boneName,
      rbName: body.params.name,
      pmxType: body.params.type,
      shapeType: body.params.shapeType,
      mass: body.params.mass,
      isMainArm: isMainArmLimbCollider(body, currentMesh),
      bonePos: bonePos && `${bonePos.x.toFixed(2)}, ${bonePos.y.toFixed(2)}, ${bonePos.z.toFixed(2)}`,
      bodyPos: bodyPos && `${bodyPos.x.toFixed(2)}, ${bodyPos.y.toFixed(2)}, ${bodyPos.z.toFixed(2)}`,
      hasOffset: !!body.boneOffsetForm,
    });
  }
  console.groupEnd();
}
window.debugArmBodies = debugArmBodies;

  function debugArmIK() {
  const objects = animHelper?.objects.get(currentMesh);
  const ikSolver = objects?.ikSolver;
  if (!ikSolver?.iks) { console.log('no IK solver'); return; }
  const bones = currentMesh.skeleton.bones;
  console.group('=== ARM IK CHAINS ===');
  for (const ik of ikSolver.iks) {
    const targetName = bones[ik.target]?.name || '';
    const effectorName = bones[ik.effector]?.name || '';
    if (!/腕|肩|ひじ|肘|手|arm/i.test(targetName + effectorName)) continue;
    console.log({
      target: targetName,
      effector: effectorName,
      active: ik.active,
      links: ik.links.map(l => bones[l.index]?.name),
    });
  }
  console.groupEnd();
}
window.debugArmIK = debugArmIK;

  function debugArmDeform() {
  if (!currentMesh?.skeleton) { console.log('no mesh'); return; }
  const bones = currentMesh.skeleton.bones;
  const grants = currentMesh.geometry?.userData?.MMD?.grants || [];
  console.group('=== ARM DEFORM / GRANT ===');
  console.log('grants total:', grants.length);
  const armRe = /腕|肩|ひじ|肘|手首|捩/;
  for (const g of grants) {
    const bn = bones[g.index]?.name || '?';
    if (!armRe.test(bn)) continue;
    console.log({
      bone: bn,
      grantParent: bones[g.parentIndex]?.name || '?',
      ratio: g.ratio,
      affectRotation: g.affectRotation,
      affectPosition: g.affectPosition,
      isLocal: g.isLocal,
    });
  }
  for (const b of bones) {
    if (!armRe.test(b.name)) continue;
    const q = b.quaternion;
    const restIdentity = Math.abs(q.x) < 1e-4 && Math.abs(q.y) < 1e-4 && Math.abs(q.z) < 1e-4;
    console.log({ bone: b.name, parent: b.parent?.name || '(root)', restIdentityRot: restIdentity });
  }
  console.groupEnd();
}
window.debugArmDeform = debugArmDeform;

  function updateRigidBodyCollisionFilter(physics, body, newTarget) {
  if (newTarget === body.params.groupTarget) return;
  if (typeof body.setCollisionMask === 'function') {
    body.setCollisionMask(newTarget);
    return;
  }
  body.params.groupTarget = newTarget;
  physics.world.removeRigidBody(body.body);
  physics.world.addRigidBody(body.body, 1 << body.params.groupIndex, newTarget);
}

  function configureArmPhysicsForAnimation(mesh, helper) {
  const mmdState = typeof helper?.get === 'function'
    ? helper.get(mesh)
    : getAnimHelperObjects(helper, mesh);
  const physics = mmdState?.physics;
  if (!physics?.bodies?.length || !physics.world) return;

  const torsoGroups = new Set();
  const armGroups = new Set();

  for (const body of physics.bodies) {
    const boneName = getPhysicsBoneName(body, mesh);
    if (_TORSO_PHYSICS_NAME.test(boneName)) torsoGroups.add(body.params.groupIndex);
    if (isMainArmLimbCollider(body, mesh)) armGroups.add(body.params.groupIndex);
  }

  if (torsoGroups.size === 0) torsoGroups.add(0);

  for (const body of physics.bodies) {
    if (!isMainArmLimbCollider(body, mesh)) continue;
    let target = body.params.groupTarget;
    for (const g of torsoGroups) target &= ~(1 << g);
    updateRigidBodyCollisionFilter(physics, body, target);
  }

  for (const body of physics.bodies) {
    const boneName = getPhysicsBoneName(body, mesh);
    if (!_TORSO_PHYSICS_NAME.test(boneName)) continue;
    let target = body.params.groupTarget;
    for (const g of armGroups) target &= ~(1 << g);
    updateRigidBodyCollisionFilter(physics, body, target);
  }
}

  function freezeTwistBones(mesh) {
  if (!mesh || !mesh.skeleton) return;
  mesh.skeleton.bones.forEach(bone => {
    const name = bone.name;
    if (name.includes('捩') || name.toLowerCase().includes('twist')) {
      bone.quaternion.set(0, 0, 0, 1);
    }
  });
  mesh.updateMatrixWorld(true);
}

  let rezeReady = true;
  let rezePhysicsBroken = false;
  let rezeFailureReason = '';
  let physDebugHelper = null;

  function requestedPhysicsBackend() {
  return 'reze';
}

  function selectedPhysicsBackend() {
  return rezeReady && !rezePhysicsBroken ? 'reze' : 'none';
}

  function physicsRuntimeReady() {
  return selectedPhysicsBackend() !== 'none';
}

  function physicsRuntimeBroken() {
  return !physicsRuntimeReady() && rezePhysicsBroken;
}

  function markRezeBroken(reason) {
  if (rezePhysicsBroken) return;
  rezePhysicsBroken = true;
  rezeReady = false;
  rezeFailureReason = String(reason?.message || reason || 'unknown error');
  if (getS()) getS().physics = false;
  const cb = document.getElementById('cPhysics');
  if (cb) cb.checked = false;
  console.error(`[Reze] ${REZE_ENGINE_NAME} disabled for this session:`, rezeFailureReason);
}

  animHelper._createMMDPhysics = function createSelectedMMDPhysics(mesh, params) {
  if (!physicsRuntimeReady()) throw new Error(rezeFailureReason || 'Reze Physics is unavailable');
  return new RezeMMDPhysics(
    mesh,
    mesh.geometry.userData.MMD.rigidBodies,
    mesh.geometry.userData.MMD.constraints,
    Object.assign({ solverIterations: 12 }, params),
  );
}

  function physBodyOrigin(body) {
  if (typeof body?.translation === 'function') {
    const p = body.translation();
    return { x: p.x, y: p.y, z: p.z };
  }
  const tr = body.getCenterOfMassTransform();
  const o = tr.getOrigin();
  return { x: o.x(), y: o.y(), z: o.z() };
}

  function readPhysBodyPose(body, target = {}) {
  if (!body) return null;
  try {
    if (typeof body.translation === 'function' && typeof body.rotation === 'function') {
      const p = body.translation();
      const q = body.rotation();
      target.x = p.x; target.y = p.y; target.z = p.z;
      target.qx = q.x; target.qy = q.y; target.qz = q.z; target.qw = q.w;
    } else {
      const tr = body.getCenterOfMassTransform();
      const p = tr.getOrigin();
      const q = tr.getRotation();
      target.x = p.x(); target.y = p.y(); target.z = p.z();
      target.qx = q.x(); target.qy = q.y(); target.qz = q.z(); target.qw = q.w();
    }
    target.valid = [target.x, target.y, target.z, target.qx, target.qy, target.qz, target.qw]
      .every(Number.isFinite);
    return target;
  } catch (_) {
    target.valid = false;
    return target;
  }
}

  function physBodyLinvel(body) {
  if (typeof body?.linvel === 'function') {
    const v = body.linvel();
    return { x: v.x, y: v.y, z: v.z };
  }
  const v = body.getLinearVelocity();
  return { x: v.x(), y: v.y(), z: v.z() };
}

  function physBodyAngvel(body) {
  if (typeof body?.angvel === 'function') {
    const v = body.angvel();
    return { x: v.x, y: v.y, z: v.z };
  }
  const v = body.getAngularVelocity();
  return { x: v.x(), y: v.y(), z: v.z() };
}

  function physBodyAddForce(body, f, wake) {
  if (typeof body?.addForce === 'function') {
    body.addForce(f, wake !== false);
    return;
  }
}

  function physBodyWake(body) {
  if (typeof body?.wakeUp === 'function') body.wakeUp();
}
  let currentMesh = null;
  const loadedAnims = []; // animation-layer entries ({ name, clip, weight, blendMode, ... })
  let activeAnimIdx = -1;
  let animPlaying = false;
  let animSpeed = 1.0;

  // One mixer per character, many ordered animation layers per mixer.  The
  // previous implementation destroyed the mixer whenever another VMD was
  // selected, which made a body VMD and a facial VMD mutually exclusive.
  // Entries are ordered bottom -> top.  An "override" layer claims only the
  // tracks it actually contains, so a face-only VMD can safely sit above a
  // full-body VMD without erasing the body animation.
  const animationLayerStates = new WeakMap();
  // Three's MMDAnimationHelper exposes IK as one scene-global switch, but a
  // baked FK clip and a VMD clip can coexist on different characters. Keep
  // the policy per mesh and scope the helper flag to each atomic sample.
  const animationIkEnabledByMesh = new WeakMap();
  const pendingPhysicsPoseReset = new WeakSet();
  let _animationLayerSerial = 0;

  const physicsRollbackRuntimeBridge = Object.freeze({
    deterministicWind,
    windCharacterIds,
    physicsRepairState,
    getRealtimeWindEvaluationTime: () => realtimeWindEvaluationTime,
    setRealtimeWindEvaluationTime: (value) => { realtimeWindEvaluationTime = Number(value); },
    getOfflineWindEvaluationTime: () => offlineWindEvaluationTime,
    setOfflineWindEvaluationTime: (value) => { offlineWindEvaluationTime = Number(value); },
    getWindCharacterSerial: () => windCharacterSerial,
    setWindCharacterSerial: (value) => { windCharacterSerial = Number(value); },
    getLastPhysicsRuntimeStats: () => lastPhysicsRuntimeStats,
    setLastPhysicsRuntimeStats: (value) => { lastPhysicsRuntimeStats = { ...value }; },
  });

  function capturePhysicsWorldRollbackState(physics) {
    return captureWorldRollbackState(physics);
  }

  function restorePhysicsWorldRollbackState(physics, snapshot) {
    return restoreWorldRollbackState(physics, snapshot);
  }

  function capturePhysicsClockRollbackState() {
    return captureClockRollbackState(physicsClock);
  }

  function restorePhysicsClockRollbackState(snapshot) {
    restoreClockRollbackState(physicsClock, snapshot);
    return physicsClock.snapshot();
  }

  function capturePhysicsRuntimeRollbackState(targets = []) {
    return captureRuntimeRollbackState(physicsRollbackRuntimeBridge, targets);
  }

  function restorePhysicsRuntimeRollbackState(snapshot) {
    restoreRuntimeRollbackState(physicsRollbackRuntimeBridge, snapshot);
    return getPhysicsClockStats();
  }

  function isPhysicsPoseResetPending(mesh) {
    return isPhysicsRollbackPending(pendingPhysicsPoseReset, mesh, 'physics pose-reset mesh');
  }

  function setPhysicsPoseResetPending(mesh, pending) {
    return setPhysicsRollbackPending(
      pendingPhysicsPoseReset,
      mesh,
      pending,
      'physics pose-reset mesh',
    );
  }

  function isWindDiscontinuityPending(mesh) {
    return isPhysicsRollbackPending(pendingWindDiscontinuities, mesh, 'wind discontinuity mesh');
  }

  function setWindDiscontinuityPending(mesh, pending) {
    return setPhysicsRollbackPending(
      pendingWindDiscontinuities,
      mesh,
      pending,
      'wind discontinuity mesh',
    );
  }

  function ensureAnimationLayerMeta(entry, index = 0) {
  if (!entry || !entry.clip) return null;
  if (!entry.layerId) entry.layerId = `anim-layer-${++_animationLayerSerial}`;
  if (entry.enabled == null) entry.enabled = true;
  if (entry.muted == null) entry.muted = false;
  if (entry.solo == null) entry.solo = false;
  if (!Number.isFinite(Number(entry.weight))) entry.weight = 1;
  entry.weight = THREE.MathUtils.clamp(Number(entry.weight), 0, 1);
  if (!['override', 'additive', 'mix'].includes(entry.blendMode)) entry.blendMode = 'override';
  if (!Number.isFinite(Number(entry.timeScale)) || Number(entry.timeScale) <= 0) entry.timeScale = 1;
  if (!Array.isArray(entry.sourceNames)) entry.sourceNames = entry.sourceName ? [entry.sourceName] : [];
  if (!entry.kind) entry.kind = entry.sourceNames.length ? 'vmd' : 'generated';
  entry.order = index;
  return entry;
}

  function normalizeAnimationLayers(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => ensureAnimationLayerMeta(entry, index))
    .filter(Boolean);
}

  function layerIsAudible(layer, hasSolo) {
  return layer.enabled !== false && !layer.muted && layer.weight > 0 && (!hasSolo || layer.solo);
}

  function buildEffectiveLayerClips(layers) {
  const hasSolo = layers.some(layer => layer.solo && layer.enabled !== false && !layer.muted);
  const active = layers.map(layer => layerIsAudible(layer, hasSolo));
  const claimedTracks = new Set();
  const clips = new Map();

  // Resolve ordered override ownership top-down. Additive and mix layers do
  // not hide lower tracks; explicit override layers do.
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!active[i]) continue;
    let clip = layer.clip;
    if (layer.blendMode === 'override') {
      const tracks = clip.tracks.filter(track => !claimedTracks.has(track.name));
      for (const track of clip.tracks) claimedTracks.add(track.name);
      clip = tracks.length === clip.tracks.length
        ? clip
        : new THREE.AnimationClip(`${clip.name || layer.name} [override ${layer.layerId}]`, clip.duration, tracks, clip.blendMode);
    } else if (layer.blendMode === 'additive') {
      clip = clip.clone();
      clip.name = `${clip.name || layer.name} [additive ${layer.layerId}]`;
      try { THREE.AnimationUtils.makeClipAdditive(clip, 0, clip); } catch (_) {}
      clip.blendMode = THREE.AdditiveAnimationBlendMode;
    }
    clips.set(layer.layerId, clip);
  }
  return { active, clips };
}

  function animationLayerHasBoneTracks(layer) {
  return !!layer?.clip?.tracks?.some?.((track) => /^\.bones\[/.test(String(track?.name || '')));
}

  function resolveAnimationIkPolicy(layers, active, primaryIndex) {
  const selected = layers[primaryIndex];
  let owner = active[primaryIndex] && animationLayerHasBoneTracks(selected)
    ? selected
    : null;
  if (!owner) {
    for (let i = layers.length - 1; i >= 0; i--) {
      if (active[i] && animationLayerHasBoneTracks(layers[i])) {
        owner = layers[i];
        break;
      }
    }
  }
  if (!owner) return true;
  if (owner.ikEnabled != null) return owner.ikEnabled !== false;
  return !/^Custom anim /i.test(String(owner.name || owner.clip?.name || ''));
}

  function installAnimationLayerStack(mesh, entries, primaryIndex = 0, opts = {}) {
  if (!mesh || !animHelper) return false;
  const layers = normalizeAnimationLayers(entries);
  if (!layers.length) return false;
  const primary = layers[Math.max(0, Math.min(layers.length - 1, primaryIndex))];

  // MMDAnimationHelper owns IK/grant/physics setup. Register an unregistered
  // mesh once, then replace only its mixer so Reze bodies remain intact.
  let objects = animHelper.objects.get(mesh);
  if (!objects || animHelper.meshes.indexOf(mesh) < 0) {
    animHelperAddMesh(mesh, physicsConfig({ animation: primary.clip, animationWarmup: false }));
    objects = animHelper.objects.get(mesh);
  }
  if (!objects) return false;

  const previous = animationLayerStates.get(mesh);
  const previousTime = opts.preserveTime !== false
    ? (previous?.mixer?.time ?? previous?.actions?.get(previous.primaryLayerId)?.time ?? 0)
    : 0;
  const wasPaused = opts.paused != null
    ? !!opts.paused
    : (previous?.paused ?? false);

  try {
    objects.mixer?.stopAllAction?.();
    objects.mixer?.uncacheRoot?.(mesh);
  } catch (_) {}
  if (opts.resetPose) resetMeshBindPose(mesh);

  const mixer = new THREE.AnimationMixer(mesh);
  const actions = new Map();
  const { active, clips } = buildEffectiveLayerClips(layers);
  const ikEnabled = resolveAnimationIkPolicy(layers, active, layers.indexOf(primary));
  // The helper exposes a scene-global IK flag. Persist the policy every time a
  // stack is rebuilt (selection/mute/solo/reorder included), then scope that
  // flag only around this mesh's atomic helper sample.
  setAnimationIkEnabledForMesh(mesh, ikEnabled);
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const effectiveClip = clips.get(layer.layerId);
    if (!active[i] || !effectiveClip || effectiveClip.tracks.length === 0) continue;
    const blendMode = layer.blendMode === 'additive'
      ? THREE.AdditiveAnimationBlendMode
      : THREE.NormalAnimationBlendMode;
    const action = mixer.clipAction(effectiveClip, mesh, blendMode);
    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(layer.weight);
    action.setEffectiveTimeScale(layer.timeScale);
    action.paused = wasPaused;
    action.play();
    actions.set(layer.layerId, action);
  }

  objects.mixer = mixer;
  clearAnimMixerState(mesh);
  objects.activeClip = primary.clip;
  const state = {
    mesh,
    mixer,
    layers,
    actions,
    primaryLayerId: primary.layerId,
    primaryIndex: layers.indexOf(primary),
    paused: wasPaused,
    ikEnabled,
  };
  animationLayerStates.set(mesh, state);
  if (previousTime > 0) {
    sampleAnimationLayersAtTime([{ mesh }], previousTime, {
      forceEvaluate: true,
      resetPhysics: false,
    });
  }
  return true;
}

  function getAnimationLayerState(mesh) {
  return mesh ? animationLayerStates.get(mesh) || null : null;
}

  function getAnimationLayerActions(mesh) {
  return [...(getAnimationLayerState(mesh)?.actions?.values?.() || [])];
}

  function getAbsoluteActionState(action, timelineTime, timeScale = 1) {
  const duration = Math.max(0, Number(action?.getClip?.()?.duration) || 0);
  const numericScale = Number(timeScale);
  const rate = Number.isFinite(numericScale) ? Math.max(0, numericScale) : 1;
  const localTime = Math.max(0, Number(timelineTime) || 0) * rate;
  if (duration <= 0) return { time: localTime, loopCount: 0 };
  if (action.loop === THREE.LoopOnce) {
    return { time: Math.min(localTime, duration), loopCount: 0 };
  }
  const loopCount = Math.floor(localTime / duration);
  return {
    // Keep the unreflected phase here. AnimationAction._updateTime(0) performs
    // the PingPong reflection from _loopCount exactly once.
    time: localTime - loopCount * duration,
    loopCount,
  };
}

  /**
   * Atomically samples every character mixer at one absolute timeline time.
   *
   * MMDAnimationHelper must own the complete operation. Calling mixer.update(0)
   * directly and then helper._animateMesh() is unsafe: the helper restores its
   * previous bone backup before evaluating the mixer, so a paused action can
   * restore the previous render frame and make the body look frozen. This path
   * temporarily enables the actions and lets the helper perform exactly one
   * restore -> mixer -> save -> IK/grant transaction with physics disabled.
   */
  function sampleAnimationLayersAtTime(states = [], time = 0, options = {}) {
  const nextTime = Math.max(0, Number(time) || 0);
  const forceEvaluate = options.forceEvaluate !== false;
  const results = [];
  const helperAnimationWas = animHelper?.enabled?.animation;
  if (forceEvaluate && animHelper?.enabled) animHelper.enabled.animation = true;

  try {
    return withHelperPhysicsDisabled(() => {
      for (const input of states || []) {
        const mesh = input?.mesh || input;
        const layerState = getAnimationLayerState(mesh);
        const objects = mesh ? animHelper?.objects?.get(mesh) : null;
        const mixer = layerState?.mixer || objects?.mixer || null;
        if (!mesh || !mixer) {
          results.push({ mesh: mesh || null, ok: false, reason: 'no-mixer' });
          continue;
        }

        const previousTime = Number(mixer.time) || 0;
        const layerById = new Map(
          (layerState?.layers || []).map((layer) => [layer.layerId, layer]),
        );
        // A legacy mixer can retain stopped/cached actions. Only the primary
        // action belongs to that character sample; enabling every cached
        // action blends unrelated clips into exported frames.
        const primaryAction = layerState ? null : getActionForMesh(mesh);
        const actionEntries = layerState
          ? [...layerState.actions.entries()].map(([layerId, action]) => ({
              action,
              timeScale: layerById.get(layerId)?.timeScale ?? action.timeScale ?? 1,
            }))
          : (primaryAction && primaryAction.getMixer?.() === mixer
              ? [{ action: primaryAction, timeScale: primaryAction.timeScale ?? 1 }]
              : []);
        if (!actionEntries.length) {
          results.push({ mesh, ok: false, reason: 'no-action' });
          continue;
        }

        const participants = new Set(actionEntries.map(({ action }) => action));
        const allActions = [...new Set([
          ...(Array.isArray(mixer._actions) ? mixer._actions : []),
          ...participants,
        ])];
        const actionStates = allActions.map((action) => ({
          action,
          paused: !!action.paused,
          enabled: action.enabled !== false,
          scheduled: action.isScheduled?.() ?? true,
        }));

        try {
          if (!layerState) {
            for (const action of allActions) {
              if (!participants.has(action)) action.enabled = false;
            }
          }
          mixer.time = nextTime;
          for (const entry of actionEntries) {
            const absolute = getAbsoluteActionState(
              entry.action,
              nextTime,
              entry.timeScale,
            );
            entry.action.time = absolute.time;
            entry.action._loopCount = absolute.loopCount;
            if (forceEvaluate) {
              if (!(entry.action.isScheduled?.() ?? true)) entry.action.play?.();
              entry.action.paused = false;
              entry.action.enabled = true;
            }
          }

          if (forceEvaluate) {
            if (typeof animHelper?._animateMesh !== 'function') {
              throw new Error(
                'Atomic MMD sampling requires MMDAnimationHelper._animateMesh()',
              );
            }
            // Exactly one MMD transaction: restore -> mixer -> save -> IK/grant.
            animateMeshWithScopedIk(mesh, 0);
            mesh.skeleton?.update?.();
            mesh.updateMatrixWorld?.(true);
          }
        } finally {
          for (const saved of actionStates) {
            saved.action.paused = saved.paused;
            saved.action.enabled = saved.enabled;
            if (!saved.scheduled && saved.action.isScheduled?.()) {
              mixer._deactivateAction?.(saved.action);
            }
          }
        }

        if (options.resetPhysics !== false &&
            Math.abs(nextTime - previousTime) > Math.max(0.08, physicsClock.fixedStep * 2)) {
          pendingPhysicsPoseReset.add(mesh);
        }
        results.push({
          mesh,
          ok: true,
          previousTime,
          time: nextTime,
          layered: !!layerState,
          actions: actionEntries.length,
        });
      }
      return results;
    });
  } finally {
    if (forceEvaluate && animHelper?.enabled) {
      animHelper.enabled.animation = helperAnimationWas;
    }
  }
}

  function setAnimationLayerTime(mesh, time, options = {}) {
  const state = getAnimationLayerState(mesh);
  if (!state?.mixer) return false;
  const nextTime = Math.max(0, Number(time) || 0);
  const [result] = sampleAnimationLayersAtTime([{ mesh }], nextTime, {
    ...options,
    // Every absolute seek must use the atomic helper path. mixer.setTime()
    // resets paused actions to zero and omits the MMD IK/grant transaction.
    forceEvaluate: true,
  });
  return result?.ok === true;
}

  function getAnimationLayerDiagnostics(mesh) {
  const state = getAnimationLayerState(mesh);
  if (!state?.mixer) return null;
  return {
    mixerTime: Number(state.mixer.time) || 0,
    paused: !!state.paused,
    actions: [...state.actions.entries()].map(([layerId, action]) => ({
      layerId,
      clip: action.getClip?.()?.name || "",
      duration: Number(action.getClip?.()?.duration) || 0,
      tracks: action.getClip?.()?.tracks?.length || 0,
      time: Number(action.time) || 0,
      paused: !!action.paused,
      enabled: !!action.enabled,
      weight: Number(action.getEffectiveWeight?.() ?? action.weight ?? 0),
      blendMode:
        state.layers.find((layer) => layer.layerId === layerId)?.blendMode ||
        "override",
    })),
  };
}

  function setAnimationLayersPaused(mesh, paused) {
  const state = getAnimationLayerState(mesh);
  if (!state) return false;
  state.paused = !!paused;
  for (const action of state.actions.values()) action.paused = state.paused;
  return true;
}

  function getAnimationLayerDuration(mesh) {
  const state = getAnimationLayerState(mesh);
  if (!state) return 0;
  let duration = 0;
  for (const layer of state.layers) {
    if (layer.enabled === false || layer.muted || layer.weight <= 0) continue;
    duration = Math.max(duration, (layer.clip?.duration || 0) / Math.max(0.0001, layer.timeScale || 1));
  }
  return duration;
}

  function clearAnimationLayerStack(mesh, opts = {}) {
  if (!mesh) return false;
  stopMeshMixer(mesh, true);
  if (opts.resetPose !== false) resetMeshBindPose(mesh);
  return true;
}

  // Single-animation install — always remove/re-add so clips never stack on the skeleton.
  let _animInstallToken = 0;

  function resetAnimGuardState() {
  _animInstallToken++;
}

  function resetMeshBindPose(mesh) {
  if (!mesh?.skeleton) return;
  if (typeof mesh.pose === 'function') mesh.pose();
  else applyRestPose(mesh);
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();
}

  function clearAnimMixerState(mesh) {
  const objects = animHelper?.objects.get(mesh);
  if (!objects) return;
  delete objects.backupBones;
  delete objects.sortedBonesData;
  objects.looped = false;
  objects.activeClip = null;
}
  // ---------------------------------------------------------------------------
  // Physics helpers
  //
  // MMDAnimationHelper.add() forwards its params to MMDPhysics, which exposes
  // `unitStep` (simulation dt in seconds), `maxStepNum` (substep cap per frame),
  // `gravity` (Vector3), and `warmup` (frames pre-simulated when adding).
  //
  // MMDPhysics default: unitStep 1/65 s, maxStepNum 3 (see three.js MMDPhysics.js).
  // Authors tune PMX rigid bodies/constraints for that step — higher rates explode hair/skirt.
  // ---------------------------------------------------------------------------
  function effectivePhysRate() {
  return getS().stablePhys ? 65 : clampPhysRate(getS().physicsRate);
}
  function effectivePhysSub() {
  return getS().stablePhys ? 3 : clampPhysSub(getS().physicsSubsteps);
}

  function physicsConfig(extra = {}) {
  syncPhysSafety();
  const wantPhysics = physicsRuntimeReady() && getS().physics;
  return Object.assign({
    physics: wantPhysics,
    warmup: wantPhysics ? getS().physicsWarmup : 0,
    unitStep: 1 / effectivePhysRate(),
    maxStepNum: effectivePhysSub(),
    gravity: new THREE.Vector3(0, -98 * getS().physicsGravity, 0),
    solverIterations: Math.max(4, Math.min(32, Number(getS().physicsSolverIterations) || 12)),
  }, extra);
}

  function syncPhysicsClockConfig() {
  const S = getS();
  if (S.independentPhysics !== false) physicsClock.startWorker();
  else physicsClock.stopWorker();
  const stable = S.stablePhys !== false;
  return physicsClock.configure({
    rate: effectivePhysRate(),
    maxCatchUpSteps: stable
      ? STABLE_CLOCK_CATCH_UP_STEPS
      : (Number(S.physicsCatchUpSteps) || STABLE_CLOCK_CATCH_UP_STEPS),
    maxBacklogSeconds: stable
      ? STABLE_CLOCK_BACKLOG_SECONDS
      : (Number(S.physicsMaxBacklog) || STABLE_CLOCK_BACKLOG_SECONDS),
  });
}

  function withHelperPhysicsDisabled(callback) {
  const previous = !!animHelper?.enabled?.physics;
  if (animHelper?.enabled) animHelper.enabled.physics = false;
  try {
    return callback();
  } finally {
    if (animHelper?.enabled) animHelper.enabled.physics = previous;
  }
}

  function setAnimationIkEnabledForMesh(mesh, enabled) {
  if (!mesh) return false;
  animationIkEnabledByMesh.set(mesh, enabled !== false);
  return animationIkEnabledByMesh.get(mesh);
}

  function isAnimationIkEnabledForMesh(mesh) {
  return !mesh || animationIkEnabledByMesh.get(mesh) !== false;
}

  function animateMeshWithScopedIk(mesh, delta = 0) {
  if (!animHelper || !mesh || typeof animHelper._animateMesh !== 'function') return false;
  const previous = animHelper.enabled?.ik;
  if (animHelper.enabled) {
    animHelper.enabled.ik = isAnimationIkEnabledForMesh(mesh);
  }
  try {
    animHelper._animateMesh(mesh, Math.max(0, Number(delta) || 0));
    return true;
  } finally {
    if (animHelper.enabled && previous !== undefined) {
      animHelper.enabled.ik = previous;
    }
  }
}

  function evaluateAnimationsWithoutPhysics(delta = 0) {
  if (!animHelper) return;
  withHelperPhysicsDisabled(() => {
    for (const mesh of animHelper.meshes || []) {
      animateMeshWithScopedIk(mesh, delta);
    }
  });
}

  function evaluateAnimationPosesAtCurrentTime(states = []) {
  if (!animHelper) return;
  withHelperPhysicsDisabled(() => {
    for (const state of states) {
      if (!state?.mesh || state.activeAnimIdx < 0) continue;
      try { animateMeshWithScopedIk(state.mesh, 0); } catch (_) {}
    }
  });
}

  function describePhysics(physics) {
  const bodies = Array.isArray(physics?.bodies) ? physics.bodies : [];
  let dynamicBodies = 0;
  for (const wrapper of bodies) {
    if (wrapper?.body && Number(wrapper?.params?.type) !== 0) dynamicBodies++;
  }
  return {
    valid: !!physics?.world && bodies.length > 0 && !physics?._fatal,
    engine: physics?.engineId || 'none',
    world: !!physics?.world,
    bodies: bodies.length,
    dynamicBodies,
  };
}

  /**
   * Repair a mesh which was registered before physics setup completed. Calling
   * helper.add() again would destroy the animation-layer mixer, so recreate
   * only the missing MMDPhysics object through the helper's own setup path.
   */
  function ensureMeshPhysics(mesh, options = {}) {
  if (!mesh) return { ok: false, reason: 'no-mesh', repaired: false, ...describePhysics(null) };
  if (!getS().physics) return { ok: false, reason: 'disabled', repaired: false, ...describePhysics(null) };
  if (!physicsRuntimeReady()) return { ok: false, reason: 'physics-runtime-unavailable', repaired: false, ...describePhysics(null) };

  const authoredBodies = mesh.geometry?.userData?.MMD?.rigidBodies;
  if (!Array.isArray(authoredBodies) || authoredBodies.length === 0) {
    return { ok: false, reason: 'no-authored-bodies', repaired: false, ...describePhysics(null) };
  }

  let objects = getAnimHelperObjects(animHelper, mesh);
  const registered = animHelper.meshes.indexOf(mesh) >= 0;
  if (!objects || !registered) {
    if (options.register === false) {
      return { ok: false, reason: 'not-registered', repaired: false, ...describePhysics(null) };
    }
    try {
      animHelperAddMesh(mesh, physicsConfig({ warmup: 0, animationWarmup: false }));
      objects = getAnimHelperObjects(animHelper, mesh);
    } catch (error) {
      console.warn('[PhysicsRepair] mesh registration failed:', error);
      return { ok: false, reason: 'registration-failed', repaired: false, error, ...describePhysics(null) };
    }
  }

  let info = describePhysics(objects?.physics);
  if (info.valid) return { ok: true, reason: 'ready', repaired: false, ...info };

  const now = performance.now();
  const repair = physicsRepairState.get(mesh) || { attempts: 0, lastAttempt: -Infinity, repairing: false };
  const cooldownMs = Number(options.cooldownMs ?? 1000);
  if (repair.repairing || now - repair.lastAttempt < cooldownMs) {
    return { ok: false, reason: repair.repairing ? 'repairing' : 'repair-cooldown', repaired: false, ...info };
  }
  repair.repairing = true;
  repair.lastAttempt = now;
  repair.attempts++;
  physicsRepairState.set(mesh, repair);

  try {
    if (objects?.physics) {
      try { disposeMMDPhysics(objects.physics); } catch (_) {}
      objects.physics = null;
    }
    if (typeof animHelper._setupMeshPhysics !== 'function') {
      throw new Error('MMDAnimationHelper._setupMeshPhysics is unavailable');
    }
    mesh.updateMatrixWorld(true);
    mesh.skeleton?.update?.();
    animHelper._setupMeshPhysics(
      mesh,
      physicsConfig({ warmup: 0, animationWarmup: false }),
    );
    objects = getAnimHelperObjects(animHelper, mesh);
    objects?.physics?.reset?.();
    applyIKFixOnly(mesh, animHelper);
    configurePhysicsInstance(objects?.physics);
    physicsClock.reset({ keepTotals: true, offline: true });
    info = describePhysics(objects?.physics);
    if (!info.valid) throw new Error(`${selectedPhysicsBackend()} world was not created`);
    console.info(
      `[PhysicsRepair] restored ${info.bodies} rigid bodies (${info.dynamicBodies} dynamic, ${info.engine}) for ${mesh.name || 'model'}`,
    );
    return { ok: true, reason: 'repaired', repaired: true, ...info };
  } catch (error) {
    console.warn('[PhysicsRepair] failed:', error);
    return { ok: false, reason: 'repair-failed', repaired: false, error, ...describePhysics(objects?.physics) };
  } finally {
    repair.repairing = false;
  }
}

  function inspectPhysicsStates(states, options = {}) {
  const summary = {
    physicsWorlds: 0,
    bodies: 0,
    dynamicBodies: 0,
    missingWorlds: 0,
    repairedWorlds: 0,
  };
  for (const state of states || []) {
    if (!state?.mesh) continue;
    const result = ensureMeshPhysics(state.mesh, options);
    if (result.world) summary.physicsWorlds++;
    else if (result.reason !== 'no-authored-bodies') summary.missingWorlds++;
    summary.bodies += result.bodies || 0;
    summary.dynamicBodies += result.dynamicBodies || 0;
    if (result.repaired) summary.repairedWorlds++;
  }
  return summary;
}

  function configurePhysicsInstance(physics) {
  if (!physics) return;
  physics.unitStep = 1 / effectivePhysRate();
  physics.maxStepNum = effectivePhysSub();
  physics.setFixedTimeStep?.(physics.unitStep);
  physics.setMaxSubSteps?.(physics.maxStepNum);
  physics.setSolverIterations?.(Math.max(4, Math.min(32, Number(getS().physicsSolverIterations) || 12)));
  if (physics.world) {
    physics.setGravity(new THREE.Vector3(0, -98 * getS().physicsGravity, 0));
  }
}

  // Runtime state belongs to a Reze world, not to a render frame. In
  // particular, waking every dynamic body on every fixed step prevents Reze
  // from ever reaching its sleeping threshold and manifests as permanent
  // high-frequency trembling.  Wake once when playback starts instead.
  const physicsPlaybackRuntime = new WeakMap();

  function usesExternalManualLayerPolicy(options) {
  return options?.externalManualLayerOwner === true;
}

  function manualLayerPlayingForMesh(mesh, options = {}) {
  if (usesExternalManualLayerPolicy(options)) {
    return typeof options.manualLayerPlaying === 'function'
      ? !!options.manualLayerPlaying(mesh)
      : false;
  }
  return boneTimelineOwnsMesh(mesh);
}

  function manualLayerOwnsPoseForMesh(mesh, options = {}) {
  if (usesExternalManualLayerPolicy(options)) {
    return typeof options.manualLayerOwnsPose === 'function'
      ? !!options.manualLayerOwnsPose(mesh)
      : false;
  }
  return manualPoseOwned(mesh);
}

  function preparePhysicsPlaybackTransitions(states, options = {}) {
  for (const state of states || []) {
    const physics = state?.mesh
      ? getAnimHelperObjects(animHelper, state.mesh)?.physics
      : null;
    if (!physics) continue;
    // External manual playback is physics playback, not VMD playback. It may
    // wake and advance this mesh's world, but must never unpause mixer actions.
    const playing = !!(state.animPlaying || manualLayerPlayingForMesh(state.mesh, options));
    const runtime = physicsPlaybackRuntime.get(physics) || {
      playing: false,
      wakePending: false,
    };
    if (playing && !runtime.playing) runtime.wakePending = true;
    if (!playing) runtime.wakePending = false;
    runtime.playing = playing;
    physicsPlaybackRuntime.set(physics, runtime);
  }
}

  function wakePhysicsAfterPlaybackStart(physics) {
  const runtime = physicsPlaybackRuntime.get(physics);
  if (!runtime?.wakePending) return 0;
  let count = 0;
  for (const wrapper of physics.bodies || []) {
    if (!wrapper?.body || Number(wrapper?.params?.type) === 0) continue;
    physBodyWake(wrapper.body);
    count++;
  }
  runtime.wakePending = false;
  return count;
}

  function resetPhysicsAtPoseDiscontinuities(states, options = {}) {
  let resets = 0;
  for (const state of states || []) {
    const mesh = state?.mesh;
    if (!mesh) continue;
    const objects = getAnimHelperObjects(animHelper, mesh);
    const physics = objects?.physics;
    const needsReset = !!objects?.looped || pendingPhysicsPoseReset.has(mesh);
    if (!physics || !needsReset) continue;
    try {
      mesh.skeleton?.update?.();
      mesh.updateMatrixWorld(true);
      physics.reset();
      configurePhysicsInstance(physics);
      const runtime = physicsPlaybackRuntime.get(physics);
      if (runtime) {
        if (usesExternalManualLayerPolicy(options)) {
          // A registry seek/reset can occur while its manual transport is
          // playing even when every VMD action is paused. Keep that exact
          // mesh in live playback after the reset; a paused held/editor pose
          // remains guarded by manualLayerOwnsPoseForMesh below.
          const manualPlaying = manualLayerPlayingForMesh(mesh, options);
          runtime.playing = !!(state.animPlaying || manualPlaying);
          runtime.wakePending = runtime.playing;
        } else {
          runtime.wakePending = false;
        }
      }
      resetWindForMesh(mesh, { discontinuity: true });
      resets++;
    } catch (error) {
      console.warn('[PhysicsStability] pose-discontinuity reset failed:', error);
    } finally {
      if (objects) objects.looped = false;
      pendingPhysicsPoseReset.delete(mesh);
    }
  }
  if (resets > 0) {
    // Do not replay worker debt against a freshly reset world.
    physicsClock.reset({ keepTotals: true, offline: true });
    traceMotion(`physics:pose-discontinuity-reset:${resets}`);
  }
  return resets;
}

  function physicsPoseGuardOwned(state, options = {}) {
  const mesh = state?.mesh;
  // A scoped external policy may deliberately suspend only this character's
  // world even while its animation is playing.  This check must precede the
  // playback fast path; the old global helper switch accidentally suspended
  // every character in the scene.
  if (isExternalPosePhysicsSuspended(mesh)) return true;
  // Playback is not manual posing.  The old condition saw the always-visible
  // Unified Timeline and reset core dynamic bodies before every 1/65 s step,
  // even while a VMD was running.  That injected impulses into every connected
  // cloth/hair chain.  Keep the guard only for a genuinely held/editor pose.
  if (usesExternalManualLayerPolicy(options)) {
    if (options.forcePlayback || state?.animPlaying || manualLayerPlayingForMesh(mesh, options)) return false;
    return manualLayerOwnsPoseForMesh(mesh, options);
  }
  if (options.forcePlayback || state?.animPlaying || boneTimelineOwnsMesh(mesh)) return false;
  return manualPoseOwned(mesh);
}

  function stepPhysicsStates(states, fixedStep, options = {}) {
  const evaluationTime = Number(options.evaluationTime);
  if (!Number.isFinite(evaluationTime) || evaluationTime < 0) {
    throw new RangeError('[PhysicsWind] stepPhysicsStates requires an explicit non-negative evaluationTime');
  }
  const summary = {
    worldSteps: 0,
    physicsWorlds: 0,
    bodies: 0,
    dynamicBodies: 0,
    missingWorlds: 0,
  };
  for (const state of states || []) {
    const mesh = state?.mesh;
    if (!mesh) continue;
    const physics = animHelper.objects.get(mesh)?.physics;
    const info = describePhysics(physics);
    if (!info.valid) {
      summary.missingWorlds++;
      continue;
    }
    summary.physicsWorlds++;
    summary.bodies += info.bodies;
    summary.dynamicBodies += info.dynamicBodies;
    const guardedPose = physicsPoseGuardOwned(state, options);
    if (guardedPose && !poseOwnerAllowsPhysics(mesh)) {
      holdCollidersOnPose(mesh, physics);
      continue;
    }
    try {
      mesh.updateMatrixWorld(true);
      // This is the only production wind application point: exactly once for
      // every character world that is about to consume this fixed substep.
      applyWindForce(evaluationTime, mesh, fixedStep, {
        isDiscontinuity: options.isDiscontinuity === true,
      });
      if (guardedPose) {
        stepPosePhysics(mesh, physics, fixedStep);
      } else {
        wakePhysicsAfterPlaybackStart(physics);
        physics.update(fixedStep);
      }
      summary.worldSteps++;
    } catch (error) {
      physics._fatal = true;
      markRezeBroken(error);
      break;
    }
  }
  return summary;
}

  function reassertPhysicsPoseAfterAnimation(states, options = {}) {
  let worlds = 0;
  for (const state of states || []) {
    // Only playback can have had physics-owned bones overwritten by a mixer.
    // Manual/editor poses deliberately remain authoritative.
    if (!state?.mesh || !(
      options.forcePlayback ||
      state.animPlaying ||
      manualLayerPlayingForMesh(state.mesh, options)
    )) continue;
    const physics = getAnimHelperObjects(animHelper, state.mesh)?.physics;
    if (!describePhysics(physics).valid) continue;
    try {
      if (typeof physics.syncBonesFromPhysics === 'function') {
        physics.syncBonesFromPhysics();
      } else if (typeof physics._updateBones === 'function') {
        // Compatibility path for third-party physics adapters.
        state.mesh.updateMatrixWorld(true);
        state.mesh.skeleton?.update?.();
        physics._updateBones();
        state.mesh.skeleton?.update?.();
        state.mesh.updateMatrixWorld(true);
      } else {
        continue;
      }
      worlds++;
    } catch (error) {
      console.warn('[PhysicsContinuity] pose reassert failed:', error);
    }
  }
  return worlds;
}

  function advanceRealtimePhysics(states, frameDelta, options = {}) {
  syncPhysicsClockConfig();
  if (!getS().physics || !physicsRuntimeReady() || !animHelper?.enabled?.physics) {
    physicsClock.reset({ keepTotals: true, offline: true });
    lastPhysicsRuntimeStats = {
      ...physicsClock.snapshot(),
      scheduledSteps: 0,
      worldSteps: 0,
      physicsWorlds: 0,
      bodies: 0,
      dynamicBodies: 0,
      missingWorlds: 0,
      repairedWorlds: 0,
    };
    return { ...lastPhysicsRuntimeStats };
  }
  preparePhysicsPlaybackTransitions(states, options);
  const inspected = inspectPhysicsStates(states);
  let stepped = { worldSteps: 0, ...inspected };
  const clockStats = physicsClock.advanceRealtime(frameDelta, (fixedStep) => {
    realtimeWindEvaluationTime += fixedStep;
    const result = stepPhysicsStates(states, fixedStep, {
      ...options,
      evaluationTime: realtimeWindEvaluationTime,
      mode: 'realtime',
    });
    stepped.worldSteps += result.worldSteps;
  });
  lastPhysicsRuntimeStats = {
    ...clockStats,
    ...inspected,
    scheduledSteps: clockStats.steps,
    worldSteps: stepped.worldSteps,
  };
  return { ...lastPhysicsRuntimeStats };
}

  function advanceOfflinePhysics(states, frameDelta, options = {}) {
  syncPhysicsClockConfig();
  if (!getS().physics || !physicsRuntimeReady() || !animHelper?.enabled?.physics)
    return physicsClock.snapshot();
  const inspected = inspectPhysicsStates(states, { cooldownMs: 0 });
  let worldSteps = 0;
  let sampledSteps = 0;
  const clockStats = physicsClock.advanceOffline(frameDelta, (fixedStep, index, count) => {
    // Offline frames (30 fps by default) alternate between two and three 65 Hz
    // physics steps. Sampling the animation only once at the video-frame end
    // made every substep see the same collider pose, producing a visible 2/3
    // cadence in cloth and hair. Re-evaluate the complete authored/custom pose
    // at the exact physics time before every step instead.
    let sampledTime = null;
    if (typeof options.beforeStep === 'function') {
      const result = options.beforeStep(fixedStep, index, count);
      const returnedTime = Number(result);
      if (Number.isFinite(returnedTime) && returnedTime >= 0) {
        sampledTime = returnedTime;
      }
      sampledSteps++;
    }
    offlineWindEvaluationTime = sampledTime == null
      ? offlineWindEvaluationTime + fixedStep
      : sampledTime;
    // Offline export is playback even when the transport was paused before
    // Render was pressed. Do not let UI pause state activate the manual-pose
    // guard or suppress final physics write-back.
    worldSteps += stepPhysicsStates(states, fixedStep, {
      forcePlayback: true,
      mode: 'offline',
      evaluationTime: offlineWindEvaluationTime,
    }).worldSteps;
  });
  lastPhysicsRuntimeStats = {
    ...clockStats,
    ...inspected,
    scheduledSteps: clockStats.steps,
    worldSteps,
    sampledSteps,
  };
  return { ...lastPhysicsRuntimeStats };
}

  function finalizeOfflinePhysicsPose(states = []) {
  return reassertPhysicsPoseAfterAnimation(states, {
    forcePlayback: true,
    mode: 'offline',
  });
}

  function resetPhysicsClock(options = {}) {
  physicsClock.reset(options);
  return physicsClock.snapshot();
}

  function setIndependentPhysicsEnabled(enabled) {
  getS().independentPhysics = !!enabled;
  if (enabled) physicsClock.startWorker();
  else physicsClock.stopWorker();
  return resetPhysicsClock({ keepTotals: true, offline: true });
}

  function prepareOfflinePhysics(states = [], options = {}) {
  syncPhysicsClockConfig();
  resetPhysicsClock({ keepTotals: true, offline: true });
  const requestedTime = Number(options.evaluationTime);
  const evaluationTime = Number.isFinite(requestedTime) && requestedTime >= 0
    ? requestedTime
    : 0;
  offlineWindEvaluationTime = evaluationTime;
  realtimeWindEvaluationTime = evaluationTime;
  deterministicWind.reset();
  if (options.evaluatePose !== false) evaluateAnimationPosesAtCurrentTime(states);
  for (const state of states) {
    const mesh = state?.mesh;
    const physics = mesh ? animHelper?.objects?.get(mesh)?.physics : null;
    if (!mesh || !physics) continue;
    try {
      // A fresh offline run starts from zero smoothed wind at t=0 (or from
      // the deterministic steady state implied by a later explicit start).
      // Do not inherit a pending live seek/restart marker.
      pendingWindDiscontinuities.delete(mesh);
      mesh.updateMatrixWorld(true);
      mesh.skeleton?.update?.();
      physics.reset();
    } catch (error) {
      console.warn('[PhysicsClock] offline reset skipped:', error);
    }
  }
  return physicsClock.snapshot();
}

  function getPhysicsClockStats() {
  return { ...physicsClock.snapshot(), ...lastPhysicsRuntimeStats };
}

  function getPhysicsRuntimeReport(mesh = currentMesh) {
  const physics = mesh ? getAnimHelperObjects(animHelper, mesh)?.physics : null;
  const info = describePhysics(physics);
  let awakeBodies = 0;
  let movingBodies = 0;
  const sample = [];
  for (const wrapper of physics?.bodies || []) {
    if (!wrapper?.body || Number(wrapper?.params?.type) === 0) continue;
    let position = null;
    let linearVelocity = null;
    let angularVelocity = null;
    try {
      position = physBodyOrigin(wrapper.body);
      linearVelocity = physBodyLinvel(wrapper.body);
      angularVelocity = physBodyAngvel(wrapper.body);
      const speed2 = linearVelocity.x ** 2 + linearVelocity.y ** 2 + linearVelocity.z ** 2;
      const angular2 = angularVelocity.x ** 2 + angularVelocity.y ** 2 + angularVelocity.z ** 2;
      if (speed2 > 1e-8 || angular2 > 1e-8) movingBodies++;
      if (typeof wrapper.body.isSleeping === 'function') {
        if (!wrapper.body.isSleeping()) awakeBodies++;
      } else if (wrapper.body.isActive?.()) awakeBodies++;
    } catch (_) {}
    if (sample.length < 12) {
      const bone = mesh?.skeleton?.bones?.[wrapper?.params?.boneIndex];
      sample.push({
        bone: bone?.name || '',
        type: Number(wrapper?.params?.type) || 0,
        position,
        linearVelocity,
        angularVelocity,
      });
    }
  }
  return {
    model: mesh?.name || null,
    requestedEngine: requestedPhysicsBackend(),
    selectedEngine: selectedPhysicsBackend(),
    reze: {
      ready: rezeReady,
      broken: rezePhysicsBroken,
      failureReason: rezeFailureReason || null,
      version: REZE_ENGINE_VERSION,
      diagnostics: physics?.engineId === 'reze' ? { ...physics.diagnostics } : null,
    },
    ...info,
    awakeBodies,
    movingBodies,
    flags: {
      settingsPhysics: !!getS()?.physics,
      helperPhysics: !!animHelper?.enabled?.physics,
      timelineActive: timelinePoseOwnsMesh(mesh),
      boneEditor: classicBonePoseOwnsMesh(mesh),
      externalPoseOwner: externalPoseOwnsMesh(mesh),
      externalPoseOwnerCount: externalPoseOwnerCount(mesh),
      externalPosePhysicsSuspended: isExternalPosePhysicsSuspended(mesh),
      manualPoseHold: manualHoldOwnsMesh(mesh),
    },
    clock: getPhysicsClockStats(),
    sample,
  };
}

  try {
  window.__physicsRuntime = {
    snapshot: () => getPhysicsRuntimeReport(),
    report: () => {
      const report = getPhysicsRuntimeReport();
      console.info('[PhysicsRuntime]', report);
      return report;
    },
    repair: () => ensureMeshPhysics(currentMesh, { cooldownMs: 0 }),
    switchEngine: () => {
      getS().physicsEngine = 'reze';
      restartPhysics();
      return getPhysicsRuntimeReport();
    },
  };
  // DOM-event bridge keeps diagnostics available to automated UI tests and
  // support tooling even when the browser runs its evaluator in an isolated
  // JavaScript world. No physics objects cross the boundary; only JSON does.
  const publishPhysicsDiagnostics = () => {
    try {
      document.documentElement.dataset.physicsDiagnostics = JSON.stringify(getPhysicsRuntimeReport());
    } catch (error) {
      document.documentElement.dataset.physicsDiagnostics = JSON.stringify({ error: String(error?.message || error) });
    }
  };
  document.addEventListener('animastage:physics-diagnostics', publishPhysicsDiagnostics);
  // Browser automation runs in an isolated JS world where page Event objects
  // are intentionally unavailable. Attribute mutation still crosses worlds,
  // so support tools can request the same read-only JSON snapshot safely.
  new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === 'data-physics-diagnostics-request')) {
      publishPhysicsDiagnostics();
    }
  }).observe(document.documentElement, { attributes: true });
  publishPhysicsDiagnostics();
  setInterval(publishPhysicsDiagnostics, 2000);
} catch (_) {}

  // Backend-aware disposal when swapping models.
  function disposeMMDPhysics(physics) {
  if (!physics?.world) return;
  physics.dispose?.();
}

  function disposeMeshPhysics(mesh) {
  if (!mesh) return;
  resetWindForMesh(mesh);
  const obj = animHelper.objects.get(mesh);
  if (obj?.physics) {
    disposeMMDPhysics(obj.physics);
    obj.physics = null;
  }
}

  function stopMeshMixer(mesh, dropLayerState = true) {
  const objects = animHelper?.objects.get(mesh);
  if (!objects?.mixer) {
    if (dropLayerState) animationLayerStates.delete(mesh);
    return;
  }
  const mixer = objects.mixer;
  try {
    mixer.stopAllAction();
    if (objects.activeClip) mixer.uncacheClip(objects.activeClip);
    mixer.uncacheRoot(mesh);
  } catch (_) {}
  objects.mixer = null;
  objects.activeClip = null;
  if (dropLayerState) animationLayerStates.delete(mesh);
}

  // Replace clip on a registered mesh — bind-pose reset + single mixer (keeps Reze bodies).
  function replaceModelAnimation(entry, opts = {}) {
  const mesh = opts.mesh || currentMesh;
  const objects = animHelper?.objects.get(mesh);
  if (!mesh || !entry?.clip || !objects) return false;
  if (animHelper.meshes.indexOf(mesh) < 0) return false;

  return installAnimationLayerStack(mesh, [entry], 0, {
    preserveTime: false,
    resetPose: true,
    paused: false,
  });
}

  // Full clean install when mesh is not yet registered with animHelper.
  function installModelAnimation(entry, opts = {}) {
  const mesh = opts.mesh || currentMesh;
  if (!mesh || !entry?.clip || !animHelper) return false;
  if (replaceModelAnimation(entry, { mesh, hardPhysics: !!opts.hardPhysics })) return true;

  const token = ++_animInstallToken;

  animHelperRemoveMesh(mesh);
  if (token !== _animInstallToken) return false;

  resetMeshBindPose(mesh);
  setAnimationIkEnabledForMesh(
    mesh,
    entry.ikEnabled != null
      ? entry.ikEnabled !== false
      : !/^Custom anim /i.test(String(entry.name || entry.clip?.name || '')),
  );

  animHelperAddMesh(mesh, physicsConfig({
    animation: entry.clip,
    animationWarmup: false,
  }));
  if (token !== _animInstallToken) return false;

  const objects = animHelper.objects.get(mesh);
  if (objects) objects.activeClip = entry.clip;

  clearAnimMixerState(mesh);

  const act = getActionForMesh(mesh);
  if (act) {
    act.reset();
    act.time = 0;
    act.paused = false;
    act.play();
  }
  return true;
}

  function getActionForMesh(mesh) {
  if (!mesh || !animHelper) return null;
  const state = animationLayerStates.get(mesh);
  if (state) {
    return state.actions.get(state.primaryLayerId) || state.actions.values().next().value || null;
  }
  const obj = animHelper.objects.get(mesh);
  const acts = obj?.mixer?._actions;
  if (!acts || acts.length === 0) return null;
  return acts[0];
}

  function playAnimOnMesh(mesh, animsArray, idx, opts = {}) {
  if (!mesh || idx < 0 || idx >= animsArray.length) return;
  // This API is used by per-character VMD assignment and model/session reload.
  // Never touch the selected editor's singleton BONE projection here: doing so
  // would persist a false `playing` value into whichever registry layer happens
  // to be active, including a different character. The legacy current-mesh
  // wrapper playAnim() owns its explicit editor stop below.
  const entry = animsArray[idx];
  if (!installAnimationLayerStack(mesh, animsArray, idx, {
    preserveTime: !!opts.preserveTime,
    resetPose: !opts.preserveTime,
    paused: false,
  })) return;
  applyIKFixOnly(mesh, animHelper);
  const physics = animHelper.objects.get(mesh)?.physics;
  if (physics && getS().physics) {
    evaluateAnimationPosesAtCurrentTime([{ mesh, activeAnimIdx: idx }]);
    physics.reset();
    resetWindForMesh(mesh, { discontinuity: true });
    resetPhysicsClock({ keepTotals: true, offline: true });
  }
  if (mesh === currentMesh) {
    animPlaying = true;
    activeAnimIdx = idx;
    syncStablePhysUI();
    refreshAnimList();
  }
  return getAnimationLayerDuration(mesh) || entry.clip.duration;
}

  // A sampled live pose and its fixed-step physics completion form one atomic
  // frame transaction. The token deliberately exposes no mutable payload;
  // coordinators can only pass it to finalizeLiveCharacterPhysics(), once.
  const livePoseTransactions = new WeakMap();
  const finalizedLivePoseTokens = new WeakSet();

  function createLivePoseToken(transaction) {
  const token = Object.freeze(Object.create(null));
  livePoseTransactions.set(token, transaction);
  return token;
}

  function consumeLivePoseToken(token) {
  if (!token || (typeof token !== 'object' && typeof token !== 'function')) {
    throw new TypeError('[Motion] finalizeLiveCharacterPhysics requires a live-pose token');
  }
  if (finalizedLivePoseTokens.has(token)) {
    throw new Error('[Motion] live-pose token was already finalized');
  }
  const transaction = livePoseTransactions.get(token);
  if (!transaction) {
    throw new TypeError('[Motion] token was not issued by this character motion system');
  }
  // Consume before stepping. Even if a physics backend throws, retrying this
  // token would advance some worlds twice and permanently desynchronise them.
  finalizedLivePoseTokens.add(token);
  livePoseTransactions.delete(token);
  return transaction;
}

  function sampleLiveCharacterPose(states, dt, opts = {}) {
  const {
    tlRegEl,
    tlLoopEl,
    physicsDelta = dt,
    afterAnimationBeforePhysics = null,
    externalManualLayerOwner = false,
    manualLayerPlaying = null,
    manualLayerOwnsPose = null,
  } = opts;

  const externalManualLayers = externalManualLayerOwner === true;
  if (externalManualLayers && manualLayerPlaying != null &&
      typeof manualLayerPlaying !== 'function') {
    throw new TypeError('[Motion] manualLayerPlaying must be a function');
  }
  if (externalManualLayers && manualLayerOwnsPose != null &&
      typeof manualLayerOwnsPose !== 'function') {
    throw new TypeError('[Motion] manualLayerOwnsPose must be a function');
  }

  const applyPostAnimationLayers = () => {
    if (typeof afterAnimationBeforePhysics !== 'function') return;
    const result = afterAnimationBeforePhysics();
    if (result != null &&
        (typeof result === 'object' || typeof result === 'function') &&
        typeof result.then === 'function') {
      // Live pose sampling is part of one RAF transaction. An asynchronous
      // layer could finish after Reze has already consumed the skeleton, so
      // reject it before issuing a physics token. Attach a handler to avoid an
      // unhandled rejection from an accidentally async adapter.
      try { Promise.resolve(result).catch(() => undefined); } catch (_) {}
      throw new TypeError('[Motion] afterAnimationBeforePhysics must be synchronous');
    }
    return result;
  };

  // Once the registry owns manual layers, this function must not even inspect
  // the legacy singleton transport. This makes a stale selected model unable
  // to advance/apply keys or leak ownership into the scene transaction.
  const boneOwner = externalManualLayers ? null : (() => {
    const boneOwner = BONE.playing ? getBoneTimelineOwner() : null;
    if (BONE.playing && !boneOwner) {
      // A timeline without its original skeleton must never fall through to
      // the selected character: identical names would pose the wrong model.
      BONE.playing = false;
    }
    return boneOwner;
  })();
  if (boneOwner) {
    BONE.time += dt * animSpeed;
    if (BONE.time > BONE.duration) {
      BONE.time = 0;
      pendingPhysicsPoseReset.add(boneOwner);
    }
  }

  if (!animHelper || !states?.length) {
    // Preserve the original standalone bone-preview path for a model without
    // an installed VMD mixer.  There is no scene-wide animation pass to skip.
    if (boneOwner) {
      applyBoneAnimTime(BONE.time, { mesh: boneOwner, mode: 'fullPose' });
      applyPostAnimationLayers();
      refreshBoneTimelineUI();
    } else if (externalManualLayers) {
      // The registry callback still owns the manual-overlay stage when there
      // is no installed animation base. It decides which registered meshes
      // need full-pose sampling.
      applyPostAnimationLayers();
    }
    return createLivePoseToken({
      states: [],
      physicsDelta,
      boneOwner,
      boneOwnerHasAnimationBase: false,
      externalManualLayerOwner: externalManualLayers,
      manualLayerPlaying,
      manualLayerOwnsPose,
      skipPhysics: true,
    });
  }

  const boneOwnerHasAnimationBase = !!(
    boneOwner && getActionForMesh(boneOwner)
  );

  const anyWithAnim = states.some(s => s.mesh && s.activeAnimIdx >= 0);
  const manuallyOwnedMeshes = externalManualLayers
    ? new Set(
      states
        .filter((state) => {
          const mesh = state?.mesh;
          if (!mesh) return false;
          // The external registry owns Classic Bones/manual overlays, while
          // Smart Pose owns the same character through the scoped motion
          // bridge. Neither may be overwritten by a paused helper sample.
          return !!manualLayerOwnsPose?.(mesh)
            || externalPoseOwnsMesh(mesh)
            || classicBonePoseOwnsMesh(mesh);
        })
        .map((state) => state.mesh),
    )
    : new Set(
      states.filter((state) => state?.mesh && manualPoseOwned(state.mesh)).map((state) => state.mesh),
    );

  // All actions on one character share this clock. Configure them before the
  // animation pass so selecting, pausing or looping a layer cannot leave the
  // other layers one frame behind.
  for (const state of states) {
    if (!state.mesh || state.activeAnimIdx < 0) continue;
    const action = getActionForMesh(state.mesh);
    if (!action) continue;
    setAnimationLayersPaused(state.mesh, !state.animPlaying);
    if (tlRegEl?.checked && state.loopOut > state.loopIn && action.time >= state.loopOut)
      setAnimationLayerTime(state.mesh, state.loopIn);
    for (const layerAction of getAnimationLayerActions(state.mesh)) {
      layerAction.loop = tlLoopEl?.checked ? THREE.LoopRepeat : THREE.LoopOnce;
      layerAction.clampWhenFinished = !tlLoopEl?.checked;
    }
  }

  if (anyWithAnim) {
    // Evaluate every character explicitly. A scene-wide helper.update() also
    // restores paused meshes from its bone backup, so one playing background
    // character used to erase Classic Bones or Smart Pose on another model.
    // A playing owned character still receives its VMD base before the manual
    // overlay; only a paused editor-owned character skips helper restoration.
    traceMotion("multi:per-character-animation+physics-decoupled", {
      owned: manuallyOwnedMeshes.size,
    });
    withHelperPhysicsDisabled(() => {
      for (const state of states) {
        if (!state?.mesh || state.activeAnimIdx < 0) continue;
        if (manuallyOwnedMeshes.has(state.mesh) && !state.animPlaying) continue;
        const step = state.animPlaying ? dt * animSpeed : 0;
        try { animateMeshWithScopedIk(state.mesh, step); } catch (_) {}
      }
    });
  }

  // The live manual timeline is a character-owned overlay, never a replacement
  // for the scene animation pass.  VMD has now established the base pose for
  // every character; only the owner's keyed bones are overwritten.  With no
  // VMD base, retain the legacy full-pose preview (rest + keyed bones).
  if (boneOwner) {
    applyBoneAnimTime(BONE.time, {
      mesh: boneOwner,
      mode: boneOwnerHasAnimationBase ? 'overlay' : 'fullPose',
    });
  }

  // Performance layers (face, gaze, fingers, Auto Grip and other custom
  // tracks) must become part of the pose before physics reads the skeleton.
  // Applying them after physics made animation and rigid bodies alternately
  // overwrite the same bones on consecutive render frames.
  applyPostAnimationLayers();

  return createLivePoseToken({
    states: states.slice(),
    physicsDelta,
    boneOwner,
    boneOwnerHasAnimationBase,
    externalManualLayerOwner: externalManualLayers,
    manualLayerPlaying,
    manualLayerOwnsPose,
    skipPhysics: false,
  });
}

  function finalizeLiveCharacterPhysics(token) {
  const transaction = consumeLivePoseToken(token);
  const {
    states,
    physicsDelta,
    boneOwner,
    boneOwnerHasAnimationBase,
    externalManualLayerOwner,
    manualLayerPlaying,
    manualLayerOwnsPose,
    skipPhysics,
  } = transaction;

  if (skipPhysics) {
    return {
      skipped: true,
      scheduledSteps: 0,
      worldSteps: 0,
      physicsWorlds: 0,
    };
  }

  // MMDAnimationHelper normally resets physics on a mixer loop inside its own
  // physics branch. Animation and Reze are deliberately decoupled here, so
  // that branch is disabled; consume its loop flag explicitly after evaluating
  // the new pose.  This also handles timeline seeks/custom loop ranges.
  const manualLayerPhysicsPolicy = {
    externalManualLayerOwner,
    manualLayerPlaying,
    manualLayerOwnsPose,
  };
  if (externalManualLayerOwner) {
    resetPhysicsAtPoseDiscontinuities(states, manualLayerPhysicsPolicy);
  } else {
    resetPhysicsAtPoseDiscontinuities(states);
  }

  const physicsStats = externalManualLayerOwner
    ? advanceRealtimePhysics(states, physicsDelta, manualLayerPhysicsPolicy)
    : advanceRealtimePhysics(states, physicsDelta);
  if (physicsStats.worldSteps === 0) {
    const reasserted = externalManualLayerOwner
      ? reassertPhysicsPoseAfterAnimation(states, manualLayerPhysicsPolicy)
      : reassertPhysicsPoseAfterAnimation(states);
    if (reasserted > 0) lastPhysicsRuntimeStats.reassertedWorlds = reasserted;
  }
  if (physicsStats.worldSteps > 0) {
    traceMotion(
      `physics:${physicsStats.source}:${physicsStats.worldSteps}world-step(s)`,
      {
        scheduledSteps: physicsStats.scheduledSteps,
        physicsWorlds: physicsStats.physicsWorlds,
        bodies: physicsStats.bodies,
        dynamicBodies: physicsStats.dynamicBodies,
      },
    );
  } else if (physicsStats.scheduledSteps > 0 && physicsStats.missingWorlds > 0) {
    traceMotion('physics:NO-BULLET-WORLD', physicsStats);
  }
  if (boneOwner) {
    traceMotion(
      `bone-timeline:${boneOwnerHasAnimationBase ? 'overlay' : 'full-pose'}:physics-${physicsStats.source}`,
      {
        worldSteps: physicsStats.worldSteps,
        scheduledSteps: physicsStats.scheduledSteps,
      },
    );
    refreshBoneTimelineUI();
  }
  return { ...physicsStats };
}

  function updateMultiCharacterMotion(states, dt, opts = {}) {
  const token = sampleLiveCharacterPose(states, dt, opts);
  return finalizeLiveCharacterPhysics(token);
}

  function animHelperRemoveMesh(mesh) {
  if (!mesh) return;
  // Ownership stores use strong mesh keys so they can support primitive or
  // object tokens uniformly.  Release them before the mesh leaves the helper;
  // otherwise a disposed character could remain logically suspended forever.
  clearExternalPoseOwnersForMesh(mesh);
  animationIkEnabledByMesh.delete(mesh);
  // Each cleanup step is isolated so one damaged model cannot keep another
  // throw) must NOT prevent the later steps — most importantly it must not stop
  // the caller from detaching the mesh from the scene graph, or a "removed"
  // model keeps being rendered (shadow + volumetric depth passes), leaving its
  // polygons in the scene and tanking FPS.
  try { stopMeshMixer(mesh); } catch (e) { console.warn('stopMeshMixer failed', e); }
  try { disposeMeshPhysics(mesh); } catch (e) { console.warn('disposeMeshPhysics failed', e); }
  try { if (mesh === currentMesh) setPhysDebugHelper(false); } catch (_) {}
  try { animHelper.remove(mesh); } catch (_) { /* mesh was not registered */ }
}

  function removeScenePlaceholder() {
  const placeholder = getScene().getObjectByName('placeholder');
  if (!placeholder) return;
  placeholder.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => m.dispose());
    }
  });
  getScene().remove(placeholder);
}

  function disposeLoadedMesh(mesh) {
  if (!mesh) return;
  animHelperRemoveMesh(mesh);
  // Detach from whatever the actual parent is (normally the scene). Relying on
  // scene.remove() alone fails if the mesh was ever reparented, and any earlier
  // throw must not skip this — so it runs unconditionally here.
  if (mesh.parent) mesh.parent.remove(mesh);
  else getScene().remove(mesh);
  if (mesh === currentMesh) currentMesh = null;
  mesh.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton && typeof o.skeleton.dispose === 'function') {
      try { o.skeleton.dispose(); } catch (_) {}
    }
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        for (const k of ['map','envMap','normalMap','roughnessMap','metalnessMap','aoMap','gradientMap','matcap','emissiveMap','alphaMap','bumpMap','displacementMap']) {
          if (m[k] && typeof m[k].dispose === 'function') m[k].dispose();
        }
        m.dispose();
      });
    }
  });
}

  // Warmup is bounded so a high-body-count PMX cannot freeze the viewport.
  function animHelperAddMesh(mesh, cfg) {
  let useCfg = cfg;
  if (!physicsRuntimeReady() || !getS().physics) {
    useCfg = Object.assign({}, cfg, { physics: false, warmup: 0 });
  }
  const attemptedBackend = selectedPhysicsBackend();
  try {
    animHelper.add(mesh, useCfg);
    applyIKFixOnly(mesh, animHelper);
    applySwing();
    applyPhysicsLive();
  } catch (e) {
    markRezeBroken(e);
    if (attemptedBackend !== 'none') {
      animHelperRemoveMesh(mesh);
      try {
        animHelper.add(mesh, Object.assign({}, cfg, {
          physics: false,
          warmup: 0,
        }));
        applyIKFixOnly(mesh, animHelper);
        showError(`${REZE_ENGINE_NAME} failed. Model loaded without physics: ${e?.message || e}`);
      } catch (e2) {
        showError('Failed to init animation: ' + (e2.message || e2));
        throw e2;
      }
    } else throw e;
  }
}

  // Full physics restart — recreate deterministic Reze state from PMX.
  function restartPhysics() {
  if (!currentMesh || !animHelper) return;

  const animEntry = activeAnimIdx >= 0 ? loadedAnims[activeAnimIdx] : null;
  const animTime = saveAnimationPoseSnapshot();
  const wasPlaying = animPlaying;

  setPhysDebugHelper(false);
  animHelperRemoveMesh(currentMesh);
  clearAnimMixerState(currentMesh);

  const cfg = physicsConfig();
  if (animEntry?.clip) {
    cfg.animation = animEntry.clip;
    cfg.animationWarmup = false;
  }

  animHelperAddMesh(currentMesh, cfg);

  const objects = animHelper.objects.get(currentMesh);
  if (objects && animEntry?.clip) objects.activeClip = animEntry.clip;

  restoreAnimationPoseSnapshot(animTime);

  const act = currentAction();
  if (act) {
    act.paused = !wasPlaying;
    if (!act.isRunning()) act.play();
  }
  animPlaying = wasPlaying;

  // Evaluate bones at current pose, then reset all rigid bodies to PMX offsets.
  evaluateAnimationPosesAtCurrentTime([{ mesh: currentMesh, activeAnimIdx }]);
  if (currentMesh.skeleton) currentMesh.skeleton.update();
  currentMesh.updateMatrixWorld(true);

  const physics = getMeshPhysics();
  if (physics) {
    physics.reset();
    applyPhysicsLive();
  }
  resetWindForMesh(currentMesh, { discontinuity: true });
  resetPhysicsClock({ keepTotals: true, offline: true });

  if (getS().physDebugHelper) setPhysDebugHelper(true);
}

  // Remove + re-add when toggling physics on/off.
  function rebuildPhysics() {
  restartPhysics();
}

  // ---------------------------------------------------------------------------
  // Physics — Reze deterministic PMX solver
  // ---------------------------------------------------------------------------
  const PHYS_LIMITS = Object.freeze({
  rateMin: 50,
  rateMax: 80,
  subMin: 2,
  subMax: 20,
  swingMax: 0.55,
});

  function clampPhysRate(r) {
  return Math.min(PHYS_LIMITS.rateMax, Math.max(PHYS_LIMITS.rateMin, Math.round(r)));
}
  function clampPhysSub(s) {
  return Math.min(PHYS_LIMITS.subMax, Math.max(PHYS_LIMITS.subMin, Math.round(s)));
}

  function getMeshPhysics() {
  if (!currentMesh) return null;
  return animHelper.objects.get(currentMesh)?.physics || null;
}

  function syncPhysSafety() {
  getS().physicsEngine = 'reze';
  getS().physicsSolverIterations = Math.max(4, Math.min(32, Math.round(Number(getS().physicsSolverIterations) || 12)));
  getS().physicsRate = clampPhysRate(getS().physicsRate);
  getS().physicsSubsteps = clampPhysSub(getS().physicsSubsteps);
  getS().physicsSwing = Math.min(PHYS_LIMITS.swingMax, Math.max(0, getS().physicsSwing));
  getS().physicsWind = Math.min(12, Math.max(0, getS().physicsWind));
  getS().physicsWarmup = Math.min(120, Math.max(0, Math.round(getS().physicsWarmup)));
}

  function applyPhysicsLive() {
  syncPhysSafety();
  syncPhysicsClockConfig();
  for (const mesh of animHelper?.meshes || []) {
    const physics = getAnimHelperObjects(animHelper, mesh)?.physics;
    configurePhysicsInstance(physics);
  }
  applySwing();
}

  function saveAnimationPoseSnapshot() {
  const act = currentAction();
  return act ? act.time : null;
}

  function restoreAnimationPoseSnapshot(t) {
  if (t == null) return;
  const act = currentAction();
  if (act) act.time = t;
}

  function applySafePhysDefaults() {
  getS().physicsEngine = 'reze';
  getS().physicsSolverIterations = 12;
  getS().physicsRate = 65;
  getS().physicsSubsteps = 4;
  getS().physicsGravity = 1.0;
  getS().physicsWarmup = 60;
  getS().physicsSwing = 0;
  getS().physicsWind = 0;
  getS().stablePhys = true;
  getS().independentPhysics = true;
  getS().physicsCatchUpSteps = STABLE_CLOCK_CATCH_UP_STEPS;
  getS().physicsMaxBacklog = STABLE_CLOCK_BACKLOG_SECONDS;
  deterministicWind.reset();
  realtimeWindEvaluationTime = 0;
  offlineWindEvaluationTime = 0;
  const cStable = document.getElementById('cStablePhys');
  if (cStable) cStable.checked = true;
  const cIndependent = document.getElementById('cIndependentPhysics');
  if (cIndependent) cIndependent.checked = true;
  const engine = document.getElementById('physicsEngine');
  if (engine) engine.value = 'reze';
  const setUI = (rId, vId, val, fmt) => {
    const r = document.getElementById(rId);
    const v = document.getElementById(vId);
    if (r) r.value = val;
    if (v) v.value = fmt(val);
  };
  setUI('rPhysRate', 'vPhysRate', 65, x => x.toFixed(0));
  setUI('rPhysSub', 'vPhysSub', 4, x => x.toFixed(0));
  setUI('rPhysSolver', 'vPhysSolver', 12, x => x.toFixed(0));
  setUI('rPhysCatch', 'vPhysCatch', STABLE_CLOCK_CATCH_UP_STEPS, x => x.toFixed(0));
  setUI('rPhysBacklog', 'vPhysBacklog', STABLE_CLOCK_BACKLOG_SECONDS, x => x.toFixed(2));
  setUI('rGrav', 'vGrav', 1, x => x.toFixed(2));
  setUI('rWarmup', 'vWarmup', 60, x => x.toFixed(0));
  setUI('rSwing', 'vSwing', 0, x => x.toFixed(2));
  setUI('rWind', 'vWind', 0, x => x.toFixed(1));
  const qual = document.getElementById('physQual');
  if (qual) qual.value = 'default';
  syncStablePhysUI();
  setIndependentPhysicsEnabled(true);
  restartPhysics();
}

  function syncStablePhysUI() {
  const lock = getS().stablePhys;
  const rRate = document.getElementById('rPhysRate');
  const vRate = document.getElementById('vPhysRate');
  const rSub = document.getElementById('rPhysSub');
  const vSub = document.getElementById('vPhysSub');
  const qual = document.getElementById('physQual');
  const rCatch = document.getElementById('rPhysCatch');
  const vCatch = document.getElementById('vPhysCatch');
  const rBacklog = document.getElementById('rPhysBacklog');
  const vBacklog = document.getElementById('vPhysBacklog');
  if (rRate) {
    rRate.disabled = lock;
    if (lock) {
      rRate.value = '65';
      if (vRate) vRate.value = '65';
    } else {
      rRate.value = String(getS().physicsRate);
      if (vRate) vRate.value = getS().physicsRate.toFixed(0);
    }
  }
  if (rSub) {
    rSub.disabled = lock;
    if (lock) {
      rSub.value = '3';
      if (vSub) vSub.value = '3';
    } else {
      rSub.value = String(getS().physicsSubsteps);
      if (vSub) vSub.value = getS().physicsSubsteps.toFixed(0);
    }
  }
  if (qual) {
    qual.disabled = lock;
    if (lock) qual.value = 'default';
  }
  if (rCatch) {
    rCatch.disabled = lock;
    if (lock) rCatch.value = String(STABLE_CLOCK_CATCH_UP_STEPS);
  }
  if (vCatch && lock) vCatch.value = String(STABLE_CLOCK_CATCH_UP_STEPS);
  if (rBacklog) {
    rBacklog.disabled = lock;
    if (lock) rBacklog.value = String(STABLE_CLOCK_BACKLOG_SECONDS);
  }
  if (vBacklog && lock) vBacklog.value = STABLE_CLOCK_BACKLOG_SECONDS.toFixed(2);
  applyPhysicsLive();
}

  function setPhysDebugHelper(on) {
  getS().physDebugHelper = !!on;
  if (physDebugHelper) {
    getScene().remove(physDebugHelper);
    physDebugHelper = null;
  }
  if (!on) return;
  const physics = getMeshPhysics();
  if (!physics || !currentMesh) return;
  physDebugHelper = new RezeMMDPhysicsHelper(currentMesh, physics);
  physDebugHelper.visible = true;
  getScene().add(physDebugHelper);
}

  function applySwing() {
  if (!currentMesh) return;
  const physics = getMeshPhysics();
  if (!physics?.bodies) return;
  const sw = Math.min(PHYS_LIMITS.swingMax, Math.max(0, getS().physicsSwing));
  for (const wrapper of physics.bodies) {
    const p = wrapper.params;
    if (!p || !wrapper.body || p.type === 0) continue;
    const linOrig = p.positionDamping !== undefined ? p.positionDamping : 0.0;
    const angOrig = p.rotationDamping !== undefined ? p.rotationDamping : 0.0;
    const lin = Math.max(0.04, linOrig * (1 - sw));
    const ang = Math.max(0.04, angOrig * (1 - sw));
    if (typeof wrapper.body.setLinearDamping === 'function') {
      wrapper.body.setLinearDamping(lin);
      wrapper.body.setAngularDamping(ang);
    } else {
      wrapper.body.setDamping(lin, ang);
    }
  }
}

  function windCharacterId(mesh) {
  if (!mesh || (typeof mesh !== 'object' && typeof mesh !== 'function')) return null;
  let id = windCharacterIds.get(mesh);
  if (!id) {
    const stableUuid = typeof mesh.uuid === 'string' && mesh.uuid.trim()
      ? mesh.uuid.trim()
      : `runtime-${++windCharacterSerial}`;
    id = `character:${stableUuid}`;
    windCharacterIds.set(mesh, id);
  }
  return id;
}

  function resetWindForMesh(mesh, options = {}) {
  const id = windCharacterId(mesh);
  if (!id) return false;
  deterministicWind.reset(id);
  if (options.discontinuity === true) pendingWindDiscontinuities.add(mesh);
  else pendingWindDiscontinuities.delete(mesh);
  return true;
}

  /**
   * Compatibility surface for callers that previously applied wind directly.
   * Production calls originate only in stepPhysicsStates() and always provide
   * explicit character, fixed-step and evaluation-time values.
   */
  function applyWindForce(time, mesh = currentMesh, fixedStep = physicsClock.fixedStep, options = {}) {
  if (!mesh || !physicsRuntimeReady()) return null;
  const evaluationTime = Number(time);
  const step = Number(fixedStep);
  if (!Number.isFinite(evaluationTime) || evaluationTime < 0 ||
      !Number.isFinite(step) || step <= 0) return null;
  const physics = getAnimHelperObjects(animHelper, mesh)?.physics;
  if (!physics?.bodies) return null;
  const characterId = windCharacterId(mesh);
  const targetStrength = Math.min(12, Math.max(0, Number(getS().physicsWind) || 0));
  // Preserve the established MMD wind motion while making its smoothing
  // deterministic. The field normalizes direction, so reapply the waveform
  // length below to retain the original x/z force amplitudes exactly.
  const wave = {
    x: Math.sin(evaluationTime * 0.5) + 0.15 * Math.sin(evaluationTime * 2.0),
    y: 0,
    z: Math.cos(evaluationTime * 0.4) + 0.15 * Math.cos(evaluationTime * 1.8),
  };
  const waveLength = Math.hypot(wave.x, wave.y, wave.z);
  const requestedDiscontinuity = options.isDiscontinuity === true ||
    pendingWindDiscontinuities.has(mesh) ||
    (!deterministicWind.has(characterId) && targetStrength <= 0.0001);
  let sample;
  try {
    sample = deterministicWind.evaluate(characterId, {
      evaluationTime,
      fixedStep: step,
      targetStrength,
      direction: wave,
      turbulence: 0,
      frequency: 0,
      isDiscontinuity: requestedDiscontinuity,
    });
  } catch (error) {
    // A changed physics rate or an authored seek is an explicit state boundary,
    // not a reason to poison the rigid-body backend. Restart only this
    // character's wind state and evaluate the same exact substep once.
    if (error?.code !== 'WIND_TIME_DISCONTINUITY' &&
        error?.code !== 'WIND_FIXED_STEP_MISMATCH') {
      console.warn('[PhysicsWind] deterministic sample skipped:', error);
      return null;
    }
    deterministicWind.reset(characterId);
    sample = deterministicWind.evaluate(characterId, {
      evaluationTime,
      fixedStep: step,
      targetStrength,
      direction: wave,
      turbulence: 0,
      frequency: 0,
      isDiscontinuity: true,
    });
  }
  pendingWindDiscontinuities.delete(mesh);
  if (sample.smoothedStrength <= 0.0001 || waveLength <= 1e-12) {
    return Object.freeze({ sample, appliedBodies: 0 });
  }
  const forceScale = 0.15 * waveLength;
  let appliedBodies = 0;
  for (const wrapper of physics.bodies) {
    if (!wrapper.params || wrapper.params.type === 0 || !wrapper.body) continue;
    physBodyAddForce(wrapper.body, {
      x: sample.vector.x * forceScale,
      y: sample.vector.y * forceScale,
      z: sample.vector.z * forceScale,
    }, true);
    appliedBodies++;
  }
  return Object.freeze({ sample, appliedBodies });
}

  function waitFrames(n = 1) {
  return new Promise((resolve) => {
    let left = n;
    const step = () => { if (--left <= 0) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

  async function waitForMeshPhysics(maxFrames = 180) {
  for (let i = 0; i < maxFrames; i++) {
    if (!currentMesh) return false;
    if (!getS().physics || physicsRuntimeBroken()) return true;
    if (getMeshPhysics()) return true;
    if (physicsRuntimeReady()) {
      const repaired = ensureMeshPhysics(currentMesh, { cooldownMs: 250 });
      if (repaired.ok) return true;
    }
    await waitFrames(1);
  }
  return !!getMeshPhysics();
}

  function refreshAnimList() {
    const el = getAnimListEl();
    if (!el) return;
    el.innerHTML = '';
    if (loadedAnims.length === 0) {
      el.innerHTML = '<div class="note" style="text-align:center; padding:6px;">no animations loaded</div>';
      return;
    }
    loadedAnims.forEach((a, i) => {
      const div = document.createElement('div');
      div.className = 'anim-item' + (i === activeAnimIdx ? ' active' : '');
      div.innerHTML = `<span>${escapeHtml(a.name)}</span><span>${i === activeAnimIdx ? '▶' : ''}</span>`;
      div.addEventListener('click', () => playAnim(i));
      el.appendChild(div);
    });
  }

  function currentDuration() {
    return getAnimationLayerDuration(currentMesh) ||
      (activeAnimIdx >= 0 ? loadedAnims[activeAnimIdx]?.clip?.duration || 0 : 0);
  }

  function playAnim(idx, opts = {}) {
  if (idx < 0 || idx >= loadedAnims.length || !currentMesh) return;
  BONE.playing = false;
  const entry = loadedAnims[idx];
  // Baked bone-clips (timeline/mocap "Bake to anim list") are pure FK: the
  // CCDIK solver would drag the leg chains toward the STATIC rest-position
  // IK targets every frame while the FK bones dance — every joint visibly
  // spins/jitters around its own axis. FK clips therefore play with IK OFF
  // (joints stay rigidly attached to the bone tree); VMD clips animate the
  // IK targets themselves, so IK is switched back on for them.
  const isBakedFk = /^Custom anim /.test(entry.name || '');
  if (isBakedFk) console.info('[Anim] FK clip — CCDIK disabled for playback (joints locked to the bone tree).');
  if (!installModelAnimation(entry, { hardPhysics: !!opts.hardPhysics })) return;
  applyIKFixOnly(currentMesh, animHelper);
  const physics = getMeshPhysics();
  if (physics && getS().physics) {
    withHelperPhysicsDisabled(() => animateMeshWithScopedIk(currentMesh, 0));
    physics.reset();
  }
  animPlaying = true;
  activeAnimIdx = idx;
  syncStablePhysUI();
  refreshAnimList();
  return entry.clip.duration;
}
  // ===========================================================================
  // BONE ANIMATION — lightweight pose/keyframe editor for MMD skeletons
  // ===========================================================================
  const BONE_STORAGE_PREFIX = 'mmd_rtx_boneanim_';
  const BONE_PRESETS = [
  { label: 'Root', match: 'センター', rigId: 'hips' },
  { label: 'Body', match: '上半身', rigId: 'spine' },
  { label: 'Head', match: '頭', rigId: 'head' },
  { label: 'Neck', match: '首', rigId: 'neck' },
  { label: 'L arm', match: '左腕', rigId: 'shoulderL' },
  { label: 'R arm', match: '右腕', rigId: 'shoulderR' },
  { label: 'L leg', match: '左足', rigId: 'hipL' },
  { label: 'R leg', match: '右足', rigId: 'hipR' },
  ];

  for (const preset of BONE_PRESETS) {
  preset.rigId = ({
    Root: 'hips',
    Body: 'spine',
    Head: 'head',
    Neck: 'neck',
    'L arm': 'shoulderL',
    'R arm': 'shoulderR',
    'L leg': 'hipL',
    'R leg': 'hipR',
  })[preset.label] || '';
}

  const BONE = {
  enabled: false,
  selected: null,
  filter: '',
  duration: 10,
  time: 0,
  playing: false,
  mode: 'fullPose',
  keys: [],
  restPose: {},
  modelKey: '',
  transformMode: 'rotate',
  space: 'local',
  autoPose: true,
  autoPoseStrength: 0.35,
  noLimits: false, // true = joint rotation limits fully OFF (free posing)
  mirrorPose: false,
  autoKey: false,
  dragSnapshot: null,
  modelOpacity: 1,
  focusDimOthers: true,
  otherBoneOpacity: 0.45,
  anatomy: null,
};

  const boneTreeCollapsed = new Set();

  // Timeline editor state: while the timeline panel is open it OWNS the pose,
  // exactly like the bone panel does. Without this, scrubbing with the bone
  // system disabled let animHelper.update(0) re-assert the paused animation
  // every frame — re-solving IK against the scrubbed pose and visibly
  // twisting limbs. The same manual-pose protection must cover both owners.
  let _timelineActive = false;
  // Explicit "↺ Rest pose" (and any explicit reset) must STICK even when a VMD
  // animation is loaded-but-paused and the bone editor is off. Without this the
  // per-frame animHelper.update(0) re-asserts the paused pose and snaps the
  // reset straight back, so the button looked dead. This hold is cleared the
  // moment any playback resumes (see updateCharacterMotion).
  let _manualPoseHold = false;
  let _manualPoseHoldMesh = null;
  let _timelineOwnerMesh = null;

  // External pose ownership is character-scoped. A token can own at most one
  // mesh, while a mesh may have several independent owners (Smart Pose, an
  // attachment tool, future mocap layers, ...). Never express this policy by
  // disabling animHelper physics: that helper flag is scene-wide.
  const _externalPoseOwners = new Map(); // Map<mesh, Map<token, policy>>
  const _externalPoseTokenMeshes = new Map(); // Map<token, mesh>
  const _legacyExternalPoseToken = Object.freeze({ kind: 'legacy-external-pose-owner' });

  function externalPoseOwnerCount(mesh = currentMesh) {
  return mesh ? (_externalPoseOwners.get(mesh)?.size || 0) : 0;
}

  function externalPoseOwnsMesh(mesh = currentMesh) {
  return externalPoseOwnerCount(mesh) > 0;
}

  function externalPosePolicy(mesh, token) {
  return mesh && token != null ? (_externalPoseOwners.get(mesh)?.get(token) || null) : null;
}

  function isExternalPosePhysicsSuspended(mesh = currentMesh) {
  const owners = mesh ? _externalPoseOwners.get(mesh) : null;
  if (!owners) return false;
  for (const policy of owners.values()) {
    if (policy?.suspendPhysics !== false) return true;
  }
  return false;
}

  function releaseExternalPoseOwner(mesh, token) {
  if (!mesh || token == null) return false;
  const owners = _externalPoseOwners.get(mesh);
  if (!owners?.delete(token)) return false;
  if (owners.size === 0) _externalPoseOwners.delete(mesh);
  if (_externalPoseTokenMeshes.get(token) === mesh) _externalPoseTokenMeshes.delete(token);
  return true;
}

  function releaseExternalPoseToken(token) {
  const mesh = _externalPoseTokenMeshes.get(token);
  return mesh ? releaseExternalPoseOwner(mesh, token) : false;
}

  function clearExternalPoseOwnersForMesh(mesh) {
  const owners = mesh ? _externalPoseOwners.get(mesh) : null;
  if (!owners) return 0;
  const count = owners.size;
  for (const token of owners.keys()) {
    if (_externalPoseTokenMeshes.get(token) === mesh) _externalPoseTokenMeshes.delete(token);
  }
  _externalPoseOwners.delete(mesh);
  traceMotion('external-pose:mesh-released', {
    mesh: mesh?.name || mesh?.uuid || '(unnamed)',
    ownersReleased: count,
  });
  return count;
}

  function getExternalPoseOwnershipSnapshot() {
  return [..._externalPoseOwners.entries()].map(([mesh, owners]) => ({
    mesh: mesh?.name || mesh?.uuid || '(unnamed)',
    ownerCount: owners.size,
    suspendPhysics: [...owners.values()].some((policy) => policy.suspendPhysics !== false),
    sources: [...new Set([...owners.values()].map((policy) => policy.source))],
  }));
}

  function classicBonePoseOwnsMesh(mesh) {
  return !!(BONE.enabled && mesh && mesh === _boneSystemMesh);
}

  function timelinePoseOwnsMesh(mesh) {
  const owner = _timelineOwnerMesh || _boneSystemMesh || currentMesh;
  return !!(_timelineActive && mesh && mesh === owner);
}

  function manualHoldOwnsMesh(mesh) {
  const owner = _manualPoseHoldMesh || _boneSystemMesh || currentMesh;
  return !!(_manualPoseHold && mesh && mesh === owner);
}

  function manualPoseOwned(mesh = currentMesh) {
  if (!mesh) return false;
  return classicBonePoseOwnsMesh(mesh)
    || timelinePoseOwnsMesh(mesh)
    || manualHoldOwnsMesh(mesh)
    || externalPoseOwnsMesh(mesh);
}

  /**
   * Acquire/release external pose ownership for exactly one character.
   *
   * setExternalPoseOwner(true, mesh, token, policy)
   * setExternalPoseOwner(false, mesh, token)
   *
   * Re-acquiring a token on another mesh atomically moves it. A stale release
   * for the previous mesh cannot clear the new owner. The historical one-arg
   * enable is rejected because there is no safe character scope; one-arg false
   * remains a harmless cleanup path for the reserved legacy token.
   */
  function setExternalPoseOwner(enabled, mesh, token, policy = {}) {
  const next = !!enabled;
  if (arguments.length < 2 || !mesh) {
    if (!next) return releaseExternalPoseToken(_legacyExternalPoseToken);
    throw new TypeError(
      'setExternalPoseOwner(true) requires (mesh, token, policy); global pose ownership is unsafe',
    );
  }
  if (typeof mesh !== 'object' && typeof mesh !== 'function') {
    throw new TypeError('setExternalPoseOwner requires a mesh object');
  }
  if (token == null) {
    throw new TypeError('setExternalPoseOwner requires a stable owner token');
  }

  if (!next) {
    const changed = releaseExternalPoseOwner(mesh, token);
    if (changed) {
      traceMotion('external-pose:owner-RELEASED', {
        mesh: mesh?.name || mesh?.uuid || '(unnamed)',
        ownerCount: externalPoseOwnerCount(mesh),
        helperPhysicsEnabled: !!animHelper.enabled.physics,
      });
    }
    return changed;
  }

  const previousMesh = _externalPoseTokenMeshes.get(token) || null;
  if (previousMesh && previousMesh !== mesh) releaseExternalPoseOwner(previousMesh, token);
  let owners = _externalPoseOwners.get(mesh);
  if (!owners) {
    owners = new Map();
    _externalPoseOwners.set(mesh, owners);
  }
  const nextPolicy = Object.freeze({
    suspendPhysics: policy?.suspendPhysics !== false,
    source: String(policy?.source || 'external-pose'),
  });
  const previousPolicy = owners.get(token) || null;
  owners.set(token, nextPolicy);
  _externalPoseTokenMeshes.set(token, mesh);
  const changed = previousMesh !== mesh
    || !previousPolicy
    || previousPolicy.suspendPhysics !== nextPolicy.suspendPhysics
    || previousPolicy.source !== nextPolicy.source;
  if (changed) {
    traceMotion(
      nextPolicy.suspendPhysics
        ? 'external-pose:mesh-physics-SUSPENDED'
        : 'external-pose:mesh-physics-LIVE',
      {
        mesh: mesh?.name || mesh?.uuid || '(unnamed)',
        ownerCount: owners.size,
        source: nextPolicy.source,
        movedFrom: previousMesh && previousMesh !== mesh
          ? (previousMesh?.name || previousMesh?.uuid || '(unnamed)')
          : null,
        helperPhysicsEnabled: !!animHelper.enabled.physics,
      },
    );
  }
  return changed;
}

  setExternalPoseOwner.supportsMeshScope = true;

  const BONE_REGION_LABELS = {
  root: '🌳 Root',
  spine: '🧍 Torso',
  head: '😀 Head',
  armL: '💪 Left arm',
  armR: '💪 Right arm',
  legL: '🦵 Left leg',
  legR: '🦵 Right leg',
  ik: '🎯 IK',
  finger: '🖐 Fingers',
  accessory: '✨ Accessories',
  other: '🦴 Other',
};

  const BONE_REGION_ICONS = {
  root: '🌳', spine: '🧍', head: '😀', armL: '💪', armR: '💪',
  legL: '🦵', legR: '🦵', ik: '🎯', finger: '🖐', accessory: '✨', other: '🦴',
};

  const BONE_INFO_RULES = [
  { match: /全ての親|^mother$/i, region: 'root', role: 'Master parent bone', desc: 'Root of the MMD hierarchy. The entire body hangs below it. Usually not animated directly.' },
  { match: /センター|^center$/i, region: 'root', role: 'Center (global position)', desc: 'Moves the whole character in space. Main root for positioning the model.' },
  { match: /グルーブ|groove/i, region: 'spine', role: 'Groove — torso tilt', desc: 'Helper bone for tilting the center without moving the feet in the scene.' },
  { match: /腰|^waist$/i, region: 'spine', role: 'Waist / lower torso', desc: 'Lower torso. Side bends and torso rotation from the pelvis.' },
  { match: /上半身2|upper.?body.?2/i, region: 'spine', role: 'Upper torso (2)', desc: 'Extra chest segment — more flexibility in the upper body.' },
  { match: /上半身|upper.?body/i, region: 'spine', role: 'Upper torso', desc: 'Chest and abdomen. Torso twist, forward/back bend.' },
  { match: /下半身|lower.?body/i, region: 'spine', role: 'Lower torso / pelvis', desc: 'Pelvis. Legs attach here; hip rotation for walking and dancing.' },
  { match: /首|neck/i, region: 'head', role: 'Neck', desc: 'Connects head to torso. Head tilt and turn.' },
  { match: /頭|head(?!phone)/i, region: 'head', role: 'Head', desc: 'Rotates the whole head — nods and turns.' },
  { match: /目|眼|eye/i, region: 'head', role: 'Eyes', desc: 'Gaze direction, blinking (often with morphs). May be left/right.' },
  { match: /眉|brow/i, region: 'head', role: 'Eyebrows', desc: 'Facial expression — surprise, anger, sadness, etc.' },
  { match: /口|唇|mouth|lip/i, region: 'head', role: 'Mouth / lips', desc: 'Lip movement for speech or expressions (often with morphs).' },
  { match: /歯|牙|teeth/i, region: 'head', role: 'Teeth', desc: 'Small mouth movements for expression detail.' },
  { match: /舌|tongue/i, region: 'head', role: 'Tongue', desc: 'Extra mouth detail.' },
  { match: /照|凉|shadow/i, region: 'accessory', role: 'Shadow / helper', desc: 'Utility bone for shadow or effect on the model, not part of the body.' },
  { match: /左.*肩|shoulder.*l/i, region: 'armL', role: 'Left shoulder', desc: 'Raises/lowers the arm, rotates the shoulder forward/back.' },
  { match: /右.*肩|shoulder.*r/i, region: 'armR', role: 'Right shoulder', desc: 'Raises/lowers the arm, rotates the shoulder forward/back.' },
  { match: /左.*腕|left.*arm/i, region: 'armL', role: 'Left upper arm', desc: 'Shoulder to elbow. Main motion for swings and gestures with the left arm.' },
  { match: /右.*腕|right.*arm/i, region: 'armR', role: 'Right upper arm', desc: 'Shoulder to elbow. Main motion for swings and gestures with the right arm.' },
  { match: /左.*ひじ|左.*肘|left.*elbow/i, region: 'armL', role: 'Left elbow', desc: 'Bends/extends the forearm relative to the upper arm.' },
  { match: /右.*ひじ|右.*肘|right.*elbow/i, region: 'armR', role: 'Right elbow', desc: 'Bends/extends the forearm relative to the upper arm.' },
  { match: /左.*手首|left.*wrist/i, region: 'armL', role: 'Left wrist', desc: 'Hand rotation, palm tilt.' },
  { match: /右.*手首|right.*wrist/i, region: 'armR', role: 'Right wrist', desc: 'Hand rotation, palm tilt.' },
  { match: /左.*手(?!首|袋)|left.*hand/i, region: 'armL', role: 'Left hand', desc: 'General hand motion; child bones are the fingers.' },
  { match: /右.*手(?!首|袋)|right.*hand/i, region: 'armR', role: 'Right hand', desc: 'General hand motion; child bones are the fingers.' },
  { match: /左.*指|left.*finger|親指.*左|人差.*左/i, region: 'finger', role: 'Left hand fingers', desc: 'Individual finger bending for grips and gestures.' },
  { match: /右.*指|right.*finger|親指.*右|人差.*右/i, region: 'finger', role: 'Right hand fingers', desc: 'Individual finger bending for grips and gestures.' },
  { match: /指|thumb/i, region: 'finger', role: 'Finger segment', desc: 'Finger bone — usually three per finger (根/中/先).' },
  { match: /左.*足(?!首|ＩＫ|IK)|left.*leg|left.*foot(?!.*ik)/i, region: 'legL', role: 'Left thigh / leg', desc: 'Upper leg from pelvis to knee. Walking, squatting, kicks.' },
  { match: /右.*足(?!首|ＩＫ|IK)|right.*leg|right.*foot(?!.*ik)/i, region: 'legR', role: 'Right thigh / leg', desc: 'Upper leg from pelvis to knee. Walking, squatting, kicks.' },
  { match: /左.*ひざ|左.*膝|left.*knee/i, region: 'legL', role: 'Left knee', desc: 'Bends/extends the lower leg.' },
  { match: /右.*ひざ|右.*膝|right.*knee/i, region: 'legR', role: 'Right knee', desc: 'Bends/extends the lower leg.' },
  { match: /左.*足首|left.*ankle/i, region: 'legL', role: 'Left ankle', desc: 'Foot rotation, toe up/down tilt.' },
  { match: /右.*足首|right.*ankle/i, region: 'legR', role: 'Right ankle', desc: 'Foot rotation, toe up/down tilt.' },
  { match: /左.*つま先|left.*toe/i, region: 'legL', role: 'Left toes', desc: 'Small toe motion for balance and walk detail.' },
  { match: /右.*つま先|right.*toe/i, region: 'legR', role: 'Right toes', desc: 'Small toe motion for balance and walk detail.' },
  { match: /左.*足ＩＫ|左.*足IK|leg.*ik.*l|foot.*ik.*l/i, region: 'ik', role: 'Left leg IK', desc: 'Inverse kinematics — sets foot position in space; the leg chain adjusts automatically.' },
  { match: /右.*足ＩＫ|右.*足IK|leg.*ik.*r|foot.*ik.*r/i, region: 'ik', role: 'Right leg IK', desc: 'Inverse kinematics — sets foot position in space; the leg chain adjusts automatically.' },
  { match: /左.*腕ＩＫ|左.*腕IK|arm.*ik.*l/i, region: 'ik', role: 'Left arm IK', desc: 'Sets hand position in space; elbow and shoulder follow.' },
  { match: /右.*腕ＩＫ|右.*腕IK|arm.*ik.*r/i, region: 'ik', role: 'Right arm IK', desc: 'Sets hand position in space; elbow and shoulder follow.' },
  { match: /ＩＫ|(?<![足腕])IK(?![足腕])/i, region: 'ik', role: 'IK target', desc: 'Inverse kinematics utility bone — end point of a limb chain.' },
  { match: /ネクタイ|tie|リボン|ribbon|スカート|skirt|チャ|受|捩|twist|補|欠|dumm/i, region: 'accessory', role: 'Accessory / helper', desc: 'Clothing or helper bone (skirt, ribbon, physics).' },
  { match: /左/i, region: 'armL', role: 'Left side', desc: 'Bone on the left side of the body or an accessory.' },
  { match: /右/i, region: 'armR', role: 'Right side', desc: 'Bone on the right side of the body or an accessory.' },
  ];

  function normBoneToken(name) {
  return String(name || '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

  function boneHasLeft(name, norm = normBoneToken(name)) {
  const raw = String(name || '');
  return /左/.test(raw)
    || /(^|_)l($|_)|(^|_)left($|_)/i.test(norm)
    || /(^left|left$|\.l$|_l_|[^a-z0-9]l[^a-z0-9]|[^a-z0-9]left[^a-z0-9])/i.test(raw);
}

  function boneHasRight(name, norm = normBoneToken(name)) {
  const raw = String(name || '');
  return /右/.test(raw)
    || /(^|_)r($|_)|(^|_)right($|_)/i.test(norm)
    || /(^right|right$|\.r$|_r_|[^a-z0-9]r[^a-z0-9]|[^a-z0-9]right[^a-z0-9])/i.test(raw);
}

  function isAccessoryLikeBone(name, norm = normBoneToken(name)) {
  const raw = String(name || '');
  if (/髪|スカート|リボン|尻尾|羽|ネクタイ|チャ|照|受|補|欠/i.test(raw)) return true;
  return /(^|_)(claw|hair|skirt|tail|cape|cloth|ribbon|wing|ear|accessory|weapon|prop|strap|bag|chain|jewel|dummy|dumm|helper)($|_)/i.test(norm);
}

  function semanticBoneRegion(name) {
  const raw = String(name || '');
  const n = normBoneToken(raw);
  const left = boneHasLeft(raw, n);
  const right = boneHasRight(raw, n);
  if (/ＩＫ|(^|_)ik($|_)|inverse_?kinematics/i.test(raw) || /(^|_)ik($|_)/i.test(n)) return 'ik';
  if (/finger|thumb|index|middle|ring|pinky|指/i.test(raw)) return 'finger';
  if (/neck|head|face|eye|brow|mouth|lip|teeth|tongue|首|頭|目|眼|眉|口|唇|歯|舌/i.test(raw)) return 'head';
  if (isAccessoryLikeBone(raw, n)) return 'accessory';

  const arm = /shoulder|clavicle|collar|upper_?arm|uparm|fore_?arm|lower_?arm|elbow|wrist|hand|arm|肩|腕|ひじ|肘|手首|手/i.test(raw);
  if (arm) return left ? 'armL' : right ? 'armR' : 'other';

  const leg = /thigh|upper_?leg|upleg|lower_?leg|calf|knee|ankle|foot|toe|leg|足|脚|ひざ|膝|足首|つま先/i.test(raw);
  if (leg) return left ? 'legL' : right ? 'legR' : 'other';

  if (/center|centre|root|mother|groove|waist|hips?|pelvis|spine|chest|upper_?body|lower_?body|body|abdomen|torso|全ての親|センター|グルーブ|腰|上半身|下半身/i.test(raw)) {
    return /center|centre|root|mother|全ての親|センター/i.test(raw) ? 'root' : 'spine';
  }
  return 'other';
}

  function boneSemanticSide(name) {
  const key = boneMatchKey(name);
  const n = normBoneToken(key);
  if (boneHasLeft(key, n)) return 'L';
  if (boneHasRight(key, n)) return 'R';
  return '';
}

  function regionsCanShareAutoPose(sourceName, candidateName) {
  if (sourceName === candidateName) return true;
  const sourceRegion = getBoneRegion(sourceName);
  const candidateRegion = getBoneRegion(candidateName);
  const sourceSide = boneSemanticSide(sourceName);
  const candidateSide = boneSemanticSide(candidateName);
  const sameSide = !sourceSide || !candidateSide || sourceSide === candidateSide;
  if (!sameSide) return false;
  if (sourceRegion === candidateRegion) return true;
  if ((sourceRegion === 'armL' || sourceRegion === 'armR') && candidateRegion === 'finger') return true;
  if (sourceRegion === 'finger' && (candidateRegion === 'armL' || candidateRegion === 'armR')) return true;
  if ((sourceRegion === 'legL' || sourceRegion === 'legR') && candidateRegion === 'ik') return true;
  if (sourceRegion === 'head') return candidateRegion === 'head';
  if (sourceRegion === 'spine') return candidateRegion === 'spine' || candidateRegion === 'root';
  if (sourceRegion === 'root') return candidateRegion === 'root' || candidateRegion === 'spine';
  return false;
}

  function getBoneRegion(name) {
  // The semantic key routes renamed bones (Ctr_*, bone_00...) through the very
  // same Japanese-name rules that legacy models use — identical behavior.
  const key = boneMatchKey(name);
  if (/左/.test(key) && /足|脚|ひざ|足首|つま先|ＩＫ|IK/.test(key)) return 'legL';
  if (/右/.test(key) && /足|脚|ひざ|足首|つま先|ＩＫ|IK/.test(key)) return 'legR';
  if (/左/.test(key) && /腕|肩|手|指|ひじ|肘/.test(key)) return 'armL';
  if (/右/.test(key) && /腕|肩|手|指|ひじ|肘/.test(key)) return 'armR';
  if (/ＩＫ|IK/.test(key)) return 'ik';
  if (/目|眼|眉|口|唇|頭|首|歯|舌|照|凉/.test(key)) return 'head';
  if (/指/.test(key)) return 'finger';
  if (/センター|グルーブ|腰|上半身|下半身|全て|mother/i.test(key)) {
    return /腰|上半身|下半身|グルーブ/i.test(key) ? 'spine' : 'root';
  }
  if (/ネクタイ|スカート|リボン|チャ|照|受|捩|補|欠|dumm/i.test(key)) return 'accessory';
  const byName = semanticBoneRegion(key);
  if (byName !== 'other') return byName;
  // Names carried no information — fall back to the universal skeleton scan
  // (regions derived from skin weights, hierarchy and geometry).
  return _rigScan?.regionOf?.get(name) || 'other';
}

  function lookupBoneInfo(name) {
  for (const r of BONE_INFO_RULES) {
    if (r.match.test(name)) {
      return { role: r.role, desc: r.desc, region: r.region || getBoneRegion(name) };
    }
  }
  return {
    role: 'Skeleton bone',
    desc: 'Part of the model rig. Rotation deforms the mesh around the joint.',
    region: getBoneRegion(name),
  };
}

  function getBoneTreeRoots() {
  if (!BONE.anatomy) return getBoneNames().slice(0, 1);
  const roots = BONE.anatomy.order.filter(n => !BONE.anatomy.parentOf[n]);
  return roots.length ? roots : getBoneNames().slice(0, 1);
}

  function boneTreeMatchesFilter(name, filter) {
  if (!filter) return true;
  const f = filter.toLowerCase();
  const info = lookupBoneInfo(name);
  return name.toLowerCase().includes(f)
    || info.role.toLowerCase().includes(f)
    || info.desc.toLowerCase().includes(f)
    || (BONE_REGION_LABELS[info.region] || '').toLowerCase().includes(f);
}

  function buildBoneTreeHtml(name, depth, filter) {
  const children = BONE.anatomy?.childOf?.[name] || [];
  const info = lookupBoneInfo(name);
  const hasChildren = children.length > 0;
  const filterActive = !!filter;
  const expanded = filterActive || !boneTreeCollapsed.has(name);
  const childParts = children.map(c => buildBoneTreeHtml(c, depth + 1, filter)).filter(Boolean);
  const selfMatch = boneTreeMatchesFilter(name, filter);
  if (filter && !selfMatch && childParts.length === 0) return '';

  const icon = BONE_REGION_ICONS[info.region] || '🦴';
  const sel = name === BONE.selected ? ' sel' : '';
  const key = boneHasAnyKey(name) ? ' has-key' : '';
  const toggleCls = hasChildren ? '' : ' empty';
  const toggleChar = expanded ? '▼' : '▶';
  const childBlock = hasChildren
    ? `<div class="be-children${expanded ? '' : ' collapsed'}">${childParts.join('')}</div>`
    : '';

  return `<div class="be-node" data-bone="${escapeHtml(name)}">
    <div class="be-row${sel}${key}" title="${escapeHtml(info.role)}">
      <span class="be-toggle${toggleCls}">${toggleChar}</span>
      <span class="be-icon">${icon}</span>
      <span class="be-name">${escapeHtml(name)}</span>
      <span class="be-role">${escapeHtml(info.role)}</span>
    </div>${childBlock}</div>`;
}

  function updateBoneDetailPanel() {
  const box = document.getElementById('boneDetail');
  if (!box) return;
  if (!BONE.selected) {
    box.innerHTML = '<div class="note" style="text-align:center;">Select a bone in the tree to see its role and connections</div>';
    return;
  }
  const name = BONE.selected;
  const info = lookupBoneInfo(name);
  const parent = BONE.anatomy?.parentOf?.[name];
  const children = BONE.anatomy?.childOf?.[name] || [];
  const chain = getAnatomyChainToRoot(name);
  const regionLbl = BONE_REGION_LABELS[info.region] || info.region;
  let html = `<div class="be-d-name">${escapeHtml(name)}</div>`;
  html += `<div class="be-d-role">${escapeHtml(regionLbl)} · ${escapeHtml(info.role)}</div>`;
  html += `<div class="be-d-desc">${escapeHtml(info.desc)}</div>`;
  html += '<div class="be-d-meta">';
  html += parent
    ? `↑ Parent: <span style="color:#aaa;">${escapeHtml(parent)}</span><br>`
    : '↑ Parent: <span style="color:#666;">none (root)</span><br>';
  if (children.length) {
    const shown = children.slice(0, 8).map(c => escapeHtml(c)).join(', ');
    const more = children.length > 8 ? ` … +${children.length - 8}` : '';
    html += `↓ Children (${children.length}): <span style="color:#aaa;">${shown}${more}</span><br>`;
  } else {
    html += '↓ Children: <span style="color:#666;">none (terminal bone)</span><br>';
  }
  html += `⛓ Chain to root: <span style="color:#888;">${chain.map(escapeHtml).join(' → ')}</span>`;
  if (boneHasAnyKey(name)) html += '<br>⭐ Has keyframe on timeline';
  html += '</div>';
  box.innerHTML = html;
}

  function scrollBoneTreeToSelection() {
  if (!BONE.selected) return;
  const node = document.querySelector(`#boneTree .be-node[data-bone="${CSS.escape(BONE.selected)}"] .be-row`);
  node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

  function refreshBoneExplorerUI() {
  const explorer = document.getElementById('boneExplorer');
  const tree = document.getElementById('boneTree');
  const stats = document.getElementById('boneExplorerStats');
  if (!explorer || !tree) return;

  const names = getBoneNames();
  if (stats) {
    if (!names.length) {
      stats.textContent = 'Load a model to explore the skeleton';
    } else {
      const roots = getBoneTreeRoots();
      stats.textContent = `${names.length} bones · ${roots.length} root${roots.length === 1 ? '' : 's'} · click to select in editor`;
    }
  }

  if (!names.length) {
    tree.innerHTML = '<div class="note" style="padding:12px;text-align:center;color:#666;">No skeleton</div>';
    updateBoneDetailPanel();
    return;
  }

  const filter = BONE.filter || '';
  const roots = getBoneTreeRoots();
  tree.innerHTML = roots.map(r => buildBoneTreeHtml(r, 0, filter)).join('') || '<div class="note" style="padding:12px;text-align:center;color:#666;">No matches</div>';
  updateBoneDetailPanel();
  if (BONE.selected) scrollBoneTreeToSelection();
}

  function syncBoneExplorerSelection() {
  const explorer = document.getElementById('boneExplorer');
  if (!explorer || explorer.classList.contains('hidden')) return;
  document.querySelectorAll('#boneTree .be-row').forEach(row => {
    const node = row.closest('.be-node');
    row.classList.toggle('sel', node?.dataset?.bone === BONE.selected);
  });
  updateBoneDetailPanel();
  scrollBoneTreeToSelection();
}

  function setBoneExplorerOpen(open) {
  const el = document.getElementById('boneExplorer');
  if (!el) return;
  const show = open ?? el.classList.contains('hidden');
  el.classList.toggle('hidden', !show);
  if (show) refreshBoneExplorerUI();
}

  // Universal, name-agnostic skeleton scan (mmd-universal-rig.js). Computed
  // once per imported model and reused for the viewport rig, preset buttons,
  // mirror posing and region grouping. Works on legacy JP-named rigs AND on
  // modern conversions with arbitrary bone names (Ctr_*, Bip001, bone_00...).
  let _rigScan = null;
  const _rigScanByMesh = new WeakMap();

  function getRigScan(mesh = currentMesh) {
  if (!mesh?.skeleton) return null;
  let scan = _rigScanByMesh.get(mesh);
  if (!scan) {
    try {
      scan = scanUniversalRig(mesh);
    } catch (err) {
      console.warn('[UniversalRig] scan failed, falling back to name-based rig:', err);
      scan = null;
    }
    if (scan) {
      _rigScanByMesh.set(mesh, scan);
      console.info('[UniversalRig] model scanned', describeRigScan(scan));
    }
  }
  return scan;
}

  let boneVisualRoot = null;            // THREE.Group named 'VisualRig'
  let skeletonHelper = null;            // THREE.SkeletonHelper for the real Bone hierarchy
  const boneVisualMap = new Map();      // boneName -> { joint, pick, jointMat, bone, baseR }
  const boneVisualLines = [];           // { line, geo, fromBone, toBone }
  let boneVisualScale = 0.05;
  let _rigHoverName = null;
  // Deform W-bone pairs: { w: THREE.Bone (e.g. 右腕W), base: THREE.Bone (右腕) }.
  // The skin + capsules are bound to the W bones; MMD drives them from the base
  // bones via grant/append. We replicate that during manual posing.
  let wBonePairs = [];
  const wBonePairsByMesh = new WeakMap();

  // Cascadeur-style rig: standard humanoid joints -> candidate PMX/English bone
  // names (first match wins). The upper-arm bone (左腕/右腕) is preferred over the
  // collar bone (左肩/右肩) as the selectable "shoulder" joint because rotating it
  // is what actually poses the arm.
  const RIG_JOINTS = [
    { id: 'hips',      aliases: ['下半身', 'センター', 'hips', 'pelvis', 'lower body'] },
    { id: 'spine',     aliases: ['上半身2', '上半身', 'spine', 'chest', 'upper body'] },
    { id: 'neck',      aliases: ['首', 'neck'] },
    { id: 'head',      aliases: ['頭', 'head'] },
    { id: 'collarL',   aliases: ['左肩', 'shoulder_L', 'left shoulder'] },
    { id: 'shoulderL', aliases: ['左腕', 'arm_L', 'left arm'] },
    { id: 'elbowL',    aliases: ['左ひじ', '左肘', 'elbow_L', 'left elbow'] },
    { id: 'wristL',    aliases: ['左手首', 'wrist_L', 'left wrist'] },
    { id: 'collarR',   aliases: ['右肩', 'shoulder_R', 'right shoulder'] },
    { id: 'shoulderR', aliases: ['右腕', 'arm_R', 'right arm'] },
    { id: 'elbowR',    aliases: ['右ひじ', '右肘', 'elbow_R', 'right elbow'] },
    { id: 'wristR',    aliases: ['右手首', 'wrist_R', 'right wrist'] },
    { id: 'hipL',      aliases: ['左足', 'leg_L', 'left leg'] },
    { id: 'kneeL',     aliases: ['左ひざ', '左膝', 'knee_L', 'left knee'] },
    { id: 'ankleL',    aliases: ['左足首', 'ankle_L', 'left ankle'] },
    { id: 'toeL',      aliases: ['左つま先', '左足先EX', 'toe_L', 'left toe'] },
    { id: 'hipR',      aliases: ['右足', 'leg_R', 'right leg'] },
    { id: 'kneeR',     aliases: ['右ひざ', '右膝', 'knee_R', 'right knee'] },
    { id: 'ankleR',    aliases: ['右足首', 'ankle_R', 'right ankle'] },
    { id: 'toeR',      aliases: ['右つま先', '右足先EX', 'toe_R', 'right toe'] },
  ];
  // Ordered anchor chains. Bones *between* two consecutive anchors (twist bones
  // 腕捩/手捩, deform bones, etc.) are auto-included by walking the real skeleton
  // hierarchy, so the rig "connects all sub-bones in the limbs".
  const RIG_CHAINS = [
    ['hips', 'spine', 'neck', 'head'],
    ['spine', 'collarL', 'shoulderL', 'elbowL', 'wristL'],
    ['spine', 'collarR', 'shoulderR', 'elbowR', 'wristR'],
    ['hips', 'hipL', 'kneeL', 'ankleL', 'toeL'],
    ['hips', 'hipR', 'kneeR', 'ankleR', 'toeR'],
  ];
  const RIG_COLOR = {
    base: 0x35d07f,   // clean Cascadeur green
    hover: 0xff8a3d,  // orange highlight on hover
    sel: 0xffd23d,    // yellow selected
    line: 0x2f8f5b,   // muted green connectors
  };
  const boneGizmoProxy = new THREE.Object3D();
  boneGizmoProxy.name = 'boneGizmoProxy';
  getScene().add(boneGizmoProxy);

  let _bonePickSuppressUntil = 0;
  let _bonePickPointer = null;
  let _boneTransformRaf = 0;

  const BONE_VIS = {
  matPick: null,
  jointGeo: null,
  pickGeo: null,
  lineMat: null,
};

  const _boneQ = new THREE.Quaternion();
  const _boneQa = new THREE.Quaternion();
  const _boneQb = new THREE.Quaternion();
  const _boneQc = new THREE.Quaternion();
  const _boneQd = new THREE.Quaternion();
  const _boneEuler = new THREE.Euler();
  const _boneVec = new THREE.Vector3();
  const _boneVec2 = new THREE.Vector3();
  const _boneVec3 = new THREE.Vector3();
  const _boneMat = new THREE.Matrix4();
  const _ndc = new THREE.Vector2();
  const _ray = new THREE.Raycaster();

  const BONE_LIMIT_RULES = [
  { match: /センター|全ての親|mother|center|centre|root/i, max: 26 },
  { match: /グルーブ|腰|groove|waist|pelvis|hips?|lower_?body/i, max: 30 },
  { match: /上半身2|upper_?body_?2|spine_?2|chest_?2/i, max: 36 },
  { match: /上半身|upper_?body|spine|chest|abdomen|torso/i, max: 40 },
  { match: /首|neck/i, max: 44 },
  { match: /頭|head/i, max: 50 },
  { match: /肩|shoulder|clavicle|collar/i, max: 75 },
  { match: /ひじ|肘|elbow|fore_?arm|lower_?arm/i, max: 118 },
  { match: /手首|手|指|wrist|hand|finger|thumb|index|middle|ring|pinky/i, max: 62 },
  { match: /腕|upper_?arm|uparm|arm/i, max: 88 },
  { match: /ひざ|膝|knee|calf|lower_?leg/i, max: 108 },
  { match: /足首|つま先|ＩＫ|IK|ankle|foot|toe/i, max: 45 },
  { match: /足|脚|thigh|upper_?leg|upleg|leg/i, max: 68 },
  { match: /.*/, max: 72 },
  ];
  const BONE_TRANSLATE_HINT = /センター|グルーブ|ＩＫ|IK|全ての親|mother|center|centre|root|groove|hips?|pelvis/i;

  function clearBoneSystem() {
  const releasedBoneMesh = _boneSystemMesh;
  BONE.selected = null;
  BONE.keys = [];
  BONE.restPose = {};
  BONE.time = 0;
  BONE.playing = false;
  BONE.mode = 'fullPose';
  BONE.modelKey = '';
  BONE.dragSnapshot = null;
  wBonePairs = [];
  _rigScan = null;
  _poseGrantMesh = null;
  _poseCorrMesh = null;
  _poseDrivenNames = null;
  _poseDrivenMesh = null;
  _boneSystemMesh = null;
  if (_timelineOwnerMesh === releasedBoneMesh) _timelineOwnerMesh = null;
  if (_manualPoseHoldMesh === releasedBoneMesh) {
    _manualPoseHold = false;
    _manualPoseHoldMesh = null;
  }
  poseV2Reset();
  updateSkeletonHelper();
  refreshBoneListUI();
  refreshBoneTimelineUI();
  refreshBonePropsUI();
  refreshBoneExplorerUI();
}

  // The bone system (rest pose, anatomy, universal scan) is GLOBAL state bound
  // to one mesh. Loading model B used to leave model A posing against B's rest
  // pose whenever bone names overlap (all JP-named models share センター/左足…)
  // — limits and grant/IK-driven legs silently broke or "magically" started
  // working depending on load order. Track the owner and re-init on mismatch.
  let _boneSystemMesh = null;

  function getBoneTimelineOwner() {
  return _boneSystemMesh?.skeleton ? _boneSystemMesh : null;
}

  function boneTimelineOwnsMesh(mesh) {
  return !!(BONE.playing && mesh && mesh === getBoneTimelineOwner());
}

  function ensureBoneSystemForMesh() {
  if (!currentMesh?.skeleton) return;
  if (_boneSystemMesh === currentMesh) return;
  console.info('[BoneSystem] active model changed — re-initializing bone system for',
    currentMesh.name || BONE.modelKey || 'model');
  initBoneSystem(currentMesh, currentMesh.name || BONE.modelKey || 'model');
}

  function initBoneSystem(mesh, modelName = '') {
  const previousBoneSystemMesh = _boneSystemMesh;
  _boneSystemMesh = mesh || null;
  if (_timelineActive && (!_timelineOwnerMesh || _timelineOwnerMesh === previousBoneSystemMesh)) {
    _timelineOwnerMesh = _boneSystemMesh;
  }
  if (_manualPoseHoldMesh && _manualPoseHoldMesh !== _boneSystemMesh) {
    _manualPoseHold = false;
    _manualPoseHoldMesh = null;
  }
  BONE.keys = [];
  BONE.time = 0;
  BONE.playing = false;
  BONE.mode = 'fullPose';
  BONE.restPose = {};
  BONE.selected = null;
  BONE.modelKey = modelName || 'model';
  if (!mesh?.skeleton) {
    refreshBoneListUI();
    refreshBoneExplorerUI();
    return;
  }
  BONE.restPose = captureBoneRestPose(mesh);
  buildBoneAnatomy(mesh);
  loadBoneAnimSaved();
  refreshBoneListUI();
  refreshBoneTimelineUI();
  refreshBonePropsUI();
  buildBonePresetButtons();
  boneTreeCollapsed.clear();
  refreshBoneExplorerUI();
}

  /**
   * Deep-copy the classic editor projection for its exact bound mesh.
   * Returning null for a foreign mesh prevents a selection change from
   * accidentally saving A's global projection as B's registry layer.
   */
  function captureLegacyBoneLayerState(mesh = _boneSystemMesh, options = {}) {
  const targetMesh = mesh || _boneSystemMesh;
  if (!targetMesh?.skeleton || targetMesh !== _boneSystemMesh) return null;
  const includeKeys = options.includeKeys !== false;
  const includeRestPose = options.includeRestPose !== false;
  return {
    ...(includeKeys ? { keys: cloneBoneLayerKeys(BONE.keys) } : {}),
    ...(includeRestPose ? { restPose: cloneBonePoseMap(BONE.restPose) } : {}),
    duration: Number(BONE.duration) || 10,
    time: Number(BONE.time) || 0,
    playing: !!BONE.playing,
    selected: BONE.selected || null,
    selectedBone: BONE.selected || null,
    modelKey: String(BONE.modelKey || ''),
    timelineActive: !!(_timelineActive && _timelineOwnerMesh === targetMesh),
    manualHold: !!(_manualPoseHold && _manualPoseHoldMesh === targetMesh),
    mode: BONE.mode === 'overlay' ? 'overlay' : 'fullPose',
  };
}

  /**
   * Project a registry-owned layer into the existing classic controls.
   * This deliberately bypasses initBoneSystem()/loadBoneAnimSaved(): the
   * registry is authoritative, so activation must never mix model-name local
   * storage or the previously selected character into the supplied state.
   */
  function activateLegacyBoneLayerState(mesh, state, options = {}) {
  if (!mesh?.skeleton?.bones) {
    throw new TypeError('[BoneSystem] activateLegacyBoneLayerState requires an explicit skeleton mesh');
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('[BoneSystem] activateLegacyBoneLayerState requires a layer state object');
  }
  const durationValue = Number(state.duration);
  const duration = Number.isFinite(durationValue) && durationValue > 0
    ? Math.max(0.001, durationValue)
    : 10;
  const timeValue = Number(state.time);
  const time = Math.max(0, Math.min(duration, Number.isFinite(timeValue) ? timeValue : 0));
  const keys = cloneBoneLayerKeys(state.keys);
  const restPose = cloneBonePoseMap(state.restPose);
  const selectedCandidate = state.selectedBone ?? state.selected ?? null;
  const selected = selectedCandidate != null &&
      mesh.skeleton.getBoneByName?.(String(selectedCandidate))
    ? String(selectedCandidate)
    : null;
  const mode = state.mode === 'overlay' ? 'overlay' : 'fullPose';

  _boneSystemMesh = mesh;
  _timelineActive = !!state.timelineActive;
  _timelineOwnerMesh = _timelineActive ? mesh : null;
  _manualPoseHold = !!state.manualHold;
  _manualPoseHoldMesh = _manualPoseHold ? mesh : null;
  BONE.keys = keys;
  BONE.restPose = restPose;
  BONE.duration = duration;
  BONE.time = time;
  BONE.playing = !!state.playing;
  BONE.selected = selected;
  BONE.modelKey = String(state.modelKey || 'model');
  BONE.mode = mode;
  BONE.dragSnapshot = null;

  // Every solver/anatomy cache below is mesh-specific. Rebinding only the
  // fields above would leave B's UI operating on A's cached grant/IK graph.
  wBonePairs = [];
  _rigScan = null;
  _poseGrantMesh = null;
  _poseCorrMesh = null;
  _poseDrivenNames = null;
  _poseDrivenMesh = null;
  poseV2Reset();
  buildBoneAnatomy(mesh);
  boneTreeCollapsed.clear();

  if (options.refreshUi !== false) {
    updateSkeletonHelper();
    refreshBoneListUI();
    refreshBoneTimelineUI();
    refreshBonePropsUI();
    buildBonePresetButtons();
    refreshBoneExplorerUI();
  }
  return captureLegacyBoneLayerState(mesh);
}

  function buildBonePresetButtons() {
  const box = document.getElementById('bonePresets');
  if (!box) return;
  box.innerHTML = '';
  BONE_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = p.label;
    btn.title = p.match;
    btn.onclick = () => selectBoneByMatch(p.match, p.rigId);
    box.appendChild(btn);
  });
}

  function selectBoneByMatch(fragment, rigId = '') {
  if (!currentMesh?.skeleton) return;
  const bone = findRigBone(currentMesh.skeleton, [fragment], rigId)
    || (rigId && getRigScan(currentMesh)?.anchors?.[rigId])   // universal scan (any naming)
    || currentMesh.skeleton.bones.find(b => b.name.includes(fragment));
  if (bone) selectBone(bone.name);
  else showError('Bone not found: ' + fragment);
}

  function getBoneNames() {
  if (!currentMesh?.skeleton) return [];
  return currentMesh.skeleton.bones.map(b => b.name);
}

  function boneHasAnyKey(name) {
  return BONE.keys.some(k => k.pose[name]);
}

  function refreshBoneListUI() {
  const list = document.getElementById('boneList');
  if (!list) return;
  const names = getBoneNames();
  const f = (BONE.filter || '').toLowerCase();
  list.innerHTML = '';
  if (names.length === 0) {
    list.innerHTML = '<div class="note" style="padding:8px;text-align:center;">Load a model first</div>';
    return;
  }
  names.filter(n => !f || n.toLowerCase().includes(f)).forEach(name => {
    const div = document.createElement('div');
    div.className = 'bone-item' + (name === BONE.selected ? ' sel' : '') + (boneHasAnyKey(name) ? ' has-key' : '');
    div.textContent = name;
    div.onclick = () => selectBone(name, false);
    list.appendChild(div);
  });
}

  function refreshBoneTimelineUI() {
  const dur = BONE.duration;
  const lbl = document.getElementById('boneTimeLbl');
  if (lbl) lbl.textContent = `${BONE.time.toFixed(2)} / ${dur.toFixed(2)} s · ${BONE.keys.length} keys`;
  const marker = document.getElementById('boneMarker');
  if (marker) marker.style.left = (Math.max(0, Math.min(1, BONE.time / dur)) * 100) + '%';
  const ticks = document.getElementById('boneKeyTicks');
  if (ticks) {
    ticks.innerHTML = '';
    BONE.keys.forEach(k => {
      const t = document.createElement('div');
      t.className = 'bone-tl-key';
      t.style.left = (Math.max(0, Math.min(1, k.t / dur)) * 100) + '%';
      ticks.appendChild(t);
    });
  }
  tlNotify(); // keep the timeline editor in sync (no-op when it's closed)
}

  function selectBone(name, fromViewport = false) {
  if (!name) return;
  if (fromViewport && !canPickBoneNow()) return;
  ensureBoneSystemForMesh(); // bone state must belong to the active model
  BONE.selected = name;
  refreshBoneListUI();
  refreshBonePropsUI();
  refreshSceneTransformAttach();
  updateSkeletonHelper();
  updatePremiumBoneVisuals();
  suggestBoneTransformMode(name);
  syncBoneExplorerSelection();
}

  function getBoneByName(name) {
  return currentMesh?.skeleton?.getBoneByName(name) || null;
}

  // "Semantic key" for name-based rules: the real bone name plus its canonical
  // Japanese alias from the universal scan (e.g. "Ctr_L_Knee 左ひざ"). Legacy
  // Japanese-named models get no alias, so every existing regex behaves
  // EXACTLY as before — new models are simply routed through the same logic.
  function boneMatchKey(name, mesh = currentMesh) {
  const scan = mesh ? getRigScan(mesh) : _rigScan;
  const alias = scan?.jpAlias?.get(name);
  return alias ? `${name} ${alias}` : name;
}

  // Resolve a canonical JP bone name (左足ＩＫ, 左足首, ...) on any model:
  // direct hit on legacy models, alias lookup on renamed rigs.
  function getBoneBySemanticName(jpName) {
  const direct = getBoneByName(jpName);
  if (direct) return direct;
  const real = _rigScan?.semanticIndex?.get(jpName);
  return real ? getBoneByName(real) : null;
}

  function setBoneTransformMode(mode) {
  BONE.transformMode = mode;
  getTransformControls().setMode(mode);
  ['btnBoneMove', 'btnBoneRot', 'btnBoneScale'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active',
      (id === 'btnBoneMove' && mode === 'translate') ||
      (id === 'btnBoneRot' && mode === 'rotate') ||
      (id === 'btnBoneScale' && mode === 'scale'));
  });
}

  function setBoneSpace(local) {
  BONE.space = local ? 'local' : 'world';
  getTransformControls().space = BONE.space;
  const btn = document.getElementById('btnBoneLocal');
  if (btn) {
    btn.classList.toggle('active', local);
    btn.textContent = local ? 'Local' : 'World';
  }
}

  function suggestBoneTransformMode(name) {
  if (!name) return;
  if (BONE_TRANSLATE_HINT.test(boneMatchKey(name))) setBoneTransformMode('translate');
  else if (BONE.transformMode === 'translate') setBoneTransformMode('rotate');
}

  function snapshotAllBones() {
  const snap = {};
  if (!currentMesh?.skeleton) return snap;
  currentMesh.updateMatrixWorld(true);
  for (const b of currentMesh.skeleton.bones) {
    b.updateWorldMatrix(true, false);
    snap[b.name] = {
      quaternion: b.quaternion.toArray(),
      position: b.position.toArray(),
      scale: b.scale.toArray(),
      worldPos: b.getWorldPosition(new THREE.Vector3()).toArray(),
    };
  }
  return snap;
}

  function storeBoneDragSnapshot() {
  ensureBoneSystemForMesh();
  BONE.dragSnapshot = snapshotAllBones();
  // Pose Engine V2: re-sync the drag cluster and stored deltas at drag start.
  if (BONE.selected) poseV2BeginDrag(BONE.selected);
}

  function getMirrorBoneName(name) {
  if (!name) return null;
  let m = null;
  if (name.includes('左')) m = name.replace(/左/g, '右');
  else if (name.includes('右')) m = name.replace(/右/g, '左');
  else if (/left/i.test(name)) m = name.replace(/left/ig, x => x[0] === 'L' ? 'Right' : 'right');
  else if (/right/i.test(name)) m = name.replace(/right/ig, x => x[0] === 'R' ? 'Left' : 'left');
  else if (/(^|[_\-. ])L($|[_\-. ])/i.test(name)) m = name.replace(/(^|[_\-. ])L($|[_\-. ])/i, '$1R$2');
  else if (/(^|[_\-. ])R($|[_\-. ])/i.test(name)) m = name.replace(/(^|[_\-. ])R($|[_\-. ])/i, '$1L$2');
  else if (/\.L$/i.test(name)) m = name.replace(/\.L$/i, '.R');
  else if (/\.R$/i.test(name)) m = name.replace(/\.R$/i, '.L');
  // Take the name-based mirror only if that bone actually exists on the model.
  if (m && m !== name && (!currentMesh?.skeleton || getBoneByName(m))) return m;
  // Universal fallback: geometric mirror pairs from the skeleton scan — works
  // even when names carry no L/R information at all.
  return _rigScan?.mirrorOf?.get(name) || null;
}

  function mirrorQuaternion(sourceQ, outQ) {
  _boneEuler.setFromQuaternion(sourceQ, 'YXZ');
  outQ.setFromEuler(new THREE.Euler(_boneEuler.x, -_boneEuler.y, -_boneEuler.z, 'YXZ'));
  return outQ;
}

  function buildBoneAnatomy(mesh) {
  BONE.anatomy = { parentOf: {}, childOf: {}, order: [] };
  if (!mesh?.skeleton) return;
  for (const b of mesh.skeleton.bones) {
    BONE.anatomy.order.push(b.name);
    const pn = (b.parent?.isBone && b.parent.name) ? b.parent.name : null;
    BONE.anatomy.parentOf[b.name] = pn;
    BONE.anatomy.childOf[b.name] = b.children
      .filter(c => c.isBone && c.name)
      .map(c => c.name);
  }
  buildWBonePairs(mesh);
  // Universal bone import: scan skin weights + MMD metadata + geometry so the
  // rest of the system never depends on bone naming conventions.
  _rigScan = getRigScan(mesh);
}

  // Detect deform W-bones (name ends in ASCII 'W' or full-width 'Ｗ') that have a
  // matching base bone, e.g. 右腕W <- 右腕. Cached so we don't rescan every frame.
  function buildWBonePairs(mesh) {
  const pairs = [];
  wBonePairs = pairs;
  if (!mesh?.skeleton) return pairs;
  const byName = new Map();
  for (const b of mesh.skeleton.bones) byName.set(b.name, b);
  for (const b of mesh.skeleton.bones) {
    const n = b.name;
    if (!/[WＷ]$/.test(n)) continue;
    const base = byName.get(n.slice(0, -1));
    if (!base || base === b) continue;
    // Parallel W chain (W's parent is another W / shared ancestor): grant copies
    // the local rotation 1:1. If the W bone is a direct child of its base, the
    // hierarchy already carries the rotation, so mirroring would double it.
    if (b.parent === base) continue;
    pairs.push({ w: b, base });
  }
  wBonePairsByMesh.set(mesh, pairs);
  return pairs;
}

  function getWBonePairs(targetMesh = currentMesh) {
  if (!targetMesh?.skeleton) return [];
  if (wBonePairsByMesh.has(targetMesh)) return wBonePairsByMesh.get(targetMesh);
  // This can occur for a secondary character whose skeleton was installed
  // before the classic bone editor ever selected it. Build a mesh-owned cache
  // without rebinding the global editor anatomy/rest state.
  const previousPairs = wBonePairs;
  const pairs = buildWBonePairs(targetMesh);
  if (targetMesh !== _boneSystemMesh) wBonePairs = previousPairs;
  return pairs;
}

  let _poseGrantSolver = null;
  let _poseGrantMesh = null;
  let _poseCorrIks = null;
  let _poseCorrMesh = null;

  // The model's real MMD grant/append solver (knows exact parent index + ratio +
  // each bone's bind orientation). Far more correct than a name-based guess.
  function getPoseGrantSolver(targetMesh = currentMesh) {
  if (!targetMesh) return null;
  const grants = targetMesh.geometry?.userData?.MMD?.grants;
  if (!grants || grants.length === 0) return null;
  if (_poseGrantMesh !== targetMesh) {
    _poseGrantSolver = animHelper.createGrantSolver(targetMesh);
    _poseGrantMesh = targetMesh;
  }
  return _poseGrantSolver;
}

  // Corrective IK chains that position deform bones (e.g. 右腕W, 右ひじW driven by
  // 右腕IK). On heavily-rigged models the mesh follows these IK-driven bones, so we
  // must solve them during manual posing. We deliberately EXCLUDE the foot/leg IK
  // (足ＩＫ / つま先ＩＫ) so FK leg posing isn't fought by it.
  const _FOOT_IK_NAME = /足ＩＫ|足IK|つま先ＩＫ|つま先IK|leg.?ik|toe.?ik|foot.?ik/i;

  // Universal (name-agnostic) leg-IK detection: a chain is a foot/leg IK if any
  // of its bones matches the legacy name regex OR falls into a leg region of the
  // universal skeleton scan (geometry + skin weights, works on Ctr_*/bone_00 rigs).
  function isLegIkChain(ik, bones, targetMesh = currentMesh) {
  // A chain must be excluded from manual-pose corrective solving ONLY when it
  // is a foot/toe IK *handle* (the classic 足ＩＫ/つま先ＩＫ the user is not
  // dragging). Deform-correction IK chains that live INSIDE the leg (they
  // position the skin-carrying D/W bones on heavily-rigged models) must keep
  // solving, otherwise the leg mesh freezes while the FK bones rotate.
  const scan = getRigScan(targetMesh);
  const target = bones[ik.target];
  const tName = target?.name || '';
  // 1. Name says it's the classic handle (works on JP models + scan aliases).
  if (tName && _FOOT_IK_NAME.test(boneMatchKey(tName, targetMesh))) return true;
  if (!target || !scan) return false;
  // 2. Structural (name-free): only look at chains operating at leg height.
  const m = scan.metrics;
  const effName = bones[ik.effector]?.name;
  const low = m && effName && scan.restY?.has(effName)
    && scan.restY.get(effName) < m.minY + 0.35 * m.height;
  if (!low) return false;
  // A handle IK hangs off the root: no skin-weighted bone in the target's
  // ancestry. Corrective chains hang inside the limb — some ancestor of the
  // target carries skin weights.
  const dw = scan.deformWeight;
  if (!dw) return false;
  let a = target.parent, depth = 0;
  while (a && a.isBone && depth++ < 24) {
    const i = targetMesh.skeleton.bones.indexOf(a);
    if (i >= 0 && dw[i] > 1e-4) return false; // inside the limb → corrective, keep
    a = a.parent;
  }
  return true; // hangs off the root at foot height → classic leg IK handle
}

  function ikChainContainsBone(ik, bones, name) {
  if (!name) return false;
  if (bones[ik.effector]?.name === name || bones[ik.target]?.name === name) return true;
  return (ik.links ?? []).some(l => bones[l.index]?.name === name);
}

  function getCorrectiveIkSolver(targetMesh = currentMesh) {
  if (!targetMesh) return null;
  const solver = animHelper.objects.get(targetMesh)?.ikSolver;
  if (!solver?.iks?.length) return null;
  if (_poseCorrMesh !== targetMesh) {
    const bones = targetMesh.skeleton.bones;
    _poseCorrIks = solver.iks.filter(ik => !isLegIkChain(ik, bones, targetMesh));
    _poseCorrMesh = targetMesh;
  }
  return { solver, iks: _poseCorrIks };
}

  function shouldApplyManualPoseGrant(grant, bones, selectedName) {
  if (!selectedName) return true;
  const boneName = bones[grant.index]?.name || '';
  const parentName = bones[grant.parentIndex]?.name || '';
  if (!boneName || !parentName) return false;
  return regionsCanShareAutoPose(selectedName, boneName)
    || regionsCanShareAutoPose(selectedName, parentName);
}

  // Drive append/grant-bones (e.g. 右腕W carrying skin + capsule) from the manually
  // posed source bones, exactly as playback does. addGrantRotation() multiplies
  // onto the bone, so grant-driven bones are first reset to their rest rotation to
  // avoid accumulating every frame. Falls back to a name-based W mirror if the
  // model exposes no grant data.
  function applyDeformWBones(targetMesh = currentMesh, options = {}) {
  if (!targetMesh?.skeleton) return;
  const selectedName = Object.prototype.hasOwnProperty.call(options, 'selectedName')
    ? options.selectedName
    : BONE.selected;
  const hasExplicitRestPose = Object.prototype.hasOwnProperty.call(options, 'restPose');
  const restPose = hasExplicitRestPose ? options.restPose : BONE.restPose;
  const gs = getPoseGrantSolver(targetMesh);
  if (gs) {
    const bones = targetMesh.skeleton.bones;
    // Reset grant-driven bones to rest first (addGrantRotation multiplies on),
    // then re-apply grant. Skip the bone the user is editing so we never clobber
    // a directly-posed bone that also happens to be grant-driven.
    for (const g of gs.grants) {
      if (g.isLocal || !g.affectRotation) continue;
      if (!shouldApplyManualPoseGrant(g, bones, selectedName)) continue;
      const bone = bones[g.index];
      if (!bone || bone.name === selectedName) continue;
      const rest = restPose?.[bone.name];
      const rq = Array.isArray(rest) ? rest : rest?.q;
      if (rq) bone.quaternion.fromArray(rq);
    }
    for (const g of gs.grants) {
      if (g.isLocal || !g.affectRotation) continue;
      if (!shouldApplyManualPoseGrant(g, bones, selectedName)) continue;
      if (bones[g.index]?.name === selectedName) continue;
      gs.updateOne(g);
    }
    // Then solve the corrective IK that positions the skin-deform bones.
    applyCorrectiveIk(targetMesh, {
      selectedName,
      ...(hasExplicitRestPose ? { restPose } : {}),
    });
    return;
  }
  const pairs = getWBonePairs(targetMesh);
  if (pairs.length === 0) return;
  const sel = selectedName;
  for (const { w, base } of pairs) {
    if (sel && !regionsCanShareAutoPose(sel, w.name) && !regionsCanShareAutoPose(sel, base.name)) continue;
    if (w.name === sel) base.quaternion.copy(w.quaternion);
    else w.quaternion.copy(base.quaternion);
  }
}

  // Reset the corrective-IK link bones to rest, then re-solve those IK chains so
  // the deform bones (which carry the skin) point at their targets again. IK is
  // idempotent (solves toward the current target), so this is safe per frame.
  function correctiveIkTouchesSelection(ik, bones, selectedName) {
  if (!selectedName) return true;
  const names = [
    bones[ik.effector]?.name,
    bones[ik.target]?.name,
    ...ik.links.map(l => bones[l.index]?.name),
  ];
  return names.some(n => n && regionsCanShareAutoPose(selectedName, n));
}

  function applyCorrectiveIk(targetMesh = currentMesh, options = {}) {
  if (!targetMesh?.skeleton) return;
  const selectedName = Object.prototype.hasOwnProperty.call(options, 'selectedName')
    ? options.selectedName
    : BONE.selected;
  const restPose = Object.prototype.hasOwnProperty.call(options, 'restPose')
    ? options.restPose
    : BONE.restPose;
  const corr = getCorrectiveIkSolver(targetMesh);
  if (!corr || corr.iks.length === 0) return;
  const bones = targetMesh.skeleton.bones;
  for (const ik of corr.iks) {
    if (!correctiveIkTouchesSelection(ik, bones, selectedName)) continue;
    // Never fight the user's hand: a chain that directly manipulates the bone
    // being posed must not be re-solved (the solver would spin it toward the
    // stale IK target). Deform chains (W bones) don't contain the FK bone.
    if (ikChainContainsBone(ik, bones, selectedName)) continue;
    for (const l of ik.links) {
      const b = bones[l.index];
      if (!b || b.name === selectedName) continue;
      const rest = restPose?.[b.name];
      const rq = Array.isArray(rest) ? rest : rest?.q;
      if (rq) b.quaternion.fromArray(rq);
    }
  }
  targetMesh.updateMatrixWorld(true);
  for (const ik of corr.iks) {
    if (!correctiveIkTouchesSelection(ik, bones, selectedName)) continue;
    if (ikChainContainsBone(ik, bones, selectedName)) continue;
    corr.solver.updateOne(ik);
  }
}

  function getBoneLimitRad(name) {
  // No-limits mode: report an effectively unbounded angle so ANY consumer
  // of the limit value (present or future) is disarmed, not just the clamp.
  if (BONE.noLimits) return Math.PI * 4;
  let maxDeg = 72;
  const key = boneMatchKey(name); // JP alias => legacy per-joint limits everywhere
  for (const r of BONE_LIMIT_RULES) {
    if (r.match.test(key)) { maxDeg = r.max; break; }
  }
  const scale = 0.58 + BONE.autoPoseStrength * 0.42;
  return THREE.MathUtils.degToRad(maxDeg * scale);
}

  function clampBoneRotationFromRest(boneName) {
  if (BONE.noLimits) return; // limits switched off — full free posing
  const bone = getBoneByName(boneName);
  const rest = BONE.restPose[boneName];
  if (!bone || !rest) return;
  const restQ = Array.isArray(rest) ? rest : rest.q;
  if (!restQ) return;
  _boneQa.fromArray(restQ);
  _boneQc.copy(_boneQa).invert().multiply(bone.quaternion);
  _boneEuler.setFromQuaternion(_boneQc, 'YXZ');
  const max = getBoneLimitRad(boneName);
  const maxZ = max * 0.82;
  _boneEuler.x = THREE.MathUtils.clamp(_boneEuler.x, -max, max);
  _boneEuler.y = THREE.MathUtils.clamp(_boneEuler.y, -max, max);
  _boneEuler.z = THREE.MathUtils.clamp(_boneEuler.z, -maxZ, maxZ);
  _boneQd.setFromEuler(_boneEuler);
  bone.quaternion.copy(_boneQa).multiply(_boneQd);
  if (!Number.isFinite(bone.quaternion.x)) bone.quaternion.fromArray(restQ);
}

  function getAnatomyChainToRoot(name) {
  const chain = [];
  let n = name;
  const seen = new Set();
  while (n && !seen.has(n)) {
    seen.add(n);
    chain.push(n);
    n = BONE.anatomy?.parentOf?.[n] || null;
  }
  return chain;
}

  function getAnatomySubtree(name) {
  const out = [];
  const stack = [name];
  const seen = new Set();
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    for (const c of (BONE.anatomy?.childOf?.[n] || [])) stack.push(c);
  }
  return out;
}

  function enforceAnatomyOnChain(changedName) {
  if (BONE.noLimits) return; // free posing — nothing to enforce
  const affected = new Set([
    ...getAnatomyChainToRoot(changedName),
    ...getAnatomySubtree(changedName),
  ]);
  for (const n of affected) {
    if (regionsCanShareAutoPose(changedName, n)) clampBoneRotationFromRest(n);
  }
}

  function applyLinkedBoneAutoPose(changedName, snap, deltaQ, baseStrength) {
  let parentName = BONE.anatomy?.parentOf?.[changedName];
  let str = baseStrength * 0.38;
  let depth = 0;
  while (parentName && str > 0.018 && depth < 28) {
    if (!regionsCanShareAutoPose(changedName, parentName)) break;
    const parent = getBoneByName(parentName);
    const pSnap = snap[parentName];
    if (parent && pSnap) {
      _boneQa.fromArray(pSnap.quaternion);
      parent.quaternion.copy(_boneQa).multiply(
        _boneQb.slerpQuaternions(new THREE.Quaternion(), deltaQ, str)
      );
      clampBoneRotationFromRest(parentName);
    }
    parentName = BONE.anatomy?.parentOf?.[parentName];
    str *= 0.54;
    depth++;
  }
}

  function applyFootPlant(changedName, snap) {
  if (!/センター|グルーブ|腰/i.test(boneMatchKey(changedName))) return;
  if (BONE.transformMode !== 'translate') return;
  const root = getBoneByName(changedName);
  const rSnap = snap[changedName];
  if (!root || !rSnap) return;
  const delta = [
    root.position.x - rSnap.position[0],
    root.position.y - rSnap.position[1],
    root.position.z - rSnap.position[2],
  ];
  if (Math.abs(delta[0]) + Math.abs(delta[1]) + Math.abs(delta[2]) < 1e-6) return;
  const pull = BONE.autoPoseStrength * 0.88;
  for (const n of ['左足ＩＫ', '右足ＩＫ', '左足首', '右足首', '左つま先', '右つま先']) {
    const ik = getBoneBySemanticName(n); // works on renamed rigs via scan alias
    const is = ik ? snap[ik.name] : null;
    if (!ik || !is) continue;
    ik.position.set(
      is.position[0] - delta[0] * pull,
      is.position[1] - delta[1] * pull,
      is.position[2] - delta[2] * pull
    );
  }
}

  function applyBoneMirrorPose(changedName, snap) {
  const mirrorName = getMirrorBoneName(changedName);
  if (!mirrorName) return;
  const src = getBoneByName(changedName);
  const dst = getBoneByName(mirrorName);
  const srcSnap = snap[changedName];
  const dstSnap = snap[mirrorName];
  if (!src || !dst || !srcSnap || !dstSnap) return;
  _boneQa.fromArray(srcSnap.quaternion).invert().multiply(src.quaternion);
  mirrorQuaternion(_boneQa, _boneQb);
  _boneQc.fromArray(dstSnap.quaternion).multiply(_boneQb);
  dst.quaternion.copy(_boneQc);
  if (BONE.transformMode === 'translate') {
    const dp = [
      src.position.x - srcSnap.position[0],
      src.position.y - srcSnap.position[1],
      src.position.z - srcSnap.position[2],
    ];
    dst.position.set(
      dstSnap.position[0] + dp[0],
      dstSnap.position[1] - dp[1],
      dstSnap.position[2] - dp[2]
    );
  }
}

  function applyAutoPoseAdjust(changedName) {
  if (!BONE.autoPose || !BONE.dragSnapshot || !changedName) return;
  const snap = BONE.dragSnapshot;
  const bone = getBoneByName(changedName);
  const bSnap = snap[changedName];
  if (!bone || !bSnap) return;

  clampBoneRotationFromRest(changedName);

  _boneQa.fromArray(bSnap.quaternion);
  _boneQc.copy(_boneQa).invert().multiply(bone.quaternion);

  applyLinkedBoneAutoPose(changedName, snap, _boneQc, BONE.autoPoseStrength);
  applyFootPlant(changedName, snap);
  if (BONE.mirrorPose) applyBoneMirrorPose(changedName, snap);
  enforceAnatomyOnChain(changedName);
}

  /* ===================== Pose Engine V2 (deterministic) =====================
   * The legacy manual-pose path mutates parent bones (auto-pose) directly on
   * the scene graph, then resets grant-driven bones and re-solves corrective
   * IK. On grant-heavy rigs (足D/腕W parallel chains, 389-bone TDA-style
   * models) those mutations feed back into the next gizmo event: the gizmo
   * re-derives the bone-local rotation against parents that just moved, the
   * delta grows, and the chain winds up — legs "spin".
   *
   * V2 is a clean evaluator: every gizmo event rebuilds the affected bones
   * from REST + stored per-bone deltas, so the same gizmo orientation always
   * produces the same pose. Feedback loops are impossible by construction.
   *
   * The legacy path is kept fully intact (per project policy) — set
   * localStorage 'mmd_pose_engine' = 'legacy' or window.MMD_POSE_LEGACY = true
   * to switch back. */
  const POSE2 = {
    deltas: new Map(),   // boneName -> { q:[x,y,z,w] delta from rest, p:[x,y,z] }
    cluster: null,       // Set<boneName> rebuilt during the current drag
    clusterSel: '',
  };

  function poseEngineV2Enabled() {
  try {
    if (typeof window !== 'undefined') {
      if (window.MMD_POSE_LEGACY === true) return false;
      if (window.localStorage?.getItem('mmd_pose_engine') === 'legacy') return false;
    }
  } catch (_) { /* storage blocked — default to v2 */ }
  return true;
}

  function poseV2Reset() {
  POSE2.deltas.clear();
  POSE2.cluster = null;
  POSE2.clusterSel = '';
}

  function poseV2RestOf(name) {
  const rest = BONE.restPose[name];
  if (!rest) return null;
  return Array.isArray(rest) ? { q: rest, p: null } : { q: rest.q, p: rest.p };
}

  let _poseDrivenNames = null;
  let _poseDrivenMesh = null;
  // Bones that are OUTPUTS of the rig (grant/append-driven, W duplicates):
  // never pose inputs — the solvers write them after every rebuild.
  function getPoseDrivenNames() {
  if (_poseDrivenMesh === currentMesh && _poseDrivenNames) return _poseDrivenNames;
  const out = new Set();
  const bones = currentMesh?.skeleton?.bones || [];
  if (_rigScan?.grantDriven) {
    for (const i of _rigScan.grantDriven) {
      const n = bones[i]?.name;
      if (n) out.add(n);
    }
  }
  for (const { w } of wBonePairs) out.add(w.name);
  _poseDrivenNames = out;
  _poseDrivenMesh = currentMesh;
  return out;
}

  // Start (or restart) a drag: cache the affected cluster and sync stored
  // deltas from the CURRENT pose so edits stack on scrubbed/keyed poses.
  function poseV2BeginDrag(selName) {
  if (!currentMesh?.skeleton || !selName) return;
  const cluster = new Set([selName]);
  for (const b of currentMesh.skeleton.bones) {
    if (regionsCanShareAutoPose(selName, b.name)) cluster.add(b.name);
  }
  POSE2.cluster = cluster;
  POSE2.clusterSel = selName;
  const driven = getPoseDrivenNames();
  console.debug('[PoseV2] drag start:', selName,
    '· cluster', cluster.size, '· driven', driven.size,
    '· region', getBoneRegion(selName));
  for (const name of cluster) {
    // the user's hand always wins — never treat the selected bone as an output
    if (driven.has(name) && name !== selName) { POSE2.deltas.delete(name); continue; }
    const bone = getBoneByName(name);
    const rest = poseV2RestOf(name);
    if (!bone || !rest?.q) continue;
    _boneQa.fromArray(rest.q).invert();
    _boneQb.copy(bone.quaternion).premultiply(_boneQa); // delta = rest⁻¹ · local
    const dp = rest.p
      ? [bone.position.x - rest.p[0], bone.position.y - rest.p[1], bone.position.z - rest.p[2]]
      : [0, 0, 0];
    const hasRot = Math.abs(_boneQb.x) + Math.abs(_boneQb.y) + Math.abs(_boneQb.z) > 1e-7
      || Math.abs(1 - Math.abs(_boneQb.w)) > 1e-7;
    const hasPos = Math.abs(dp[0]) + Math.abs(dp[1]) + Math.abs(dp[2]) > 1e-7;
    if (hasRot || hasPos) POSE2.deltas.set(name, { q: _boneQb.toArray(), p: dp });
    else POSE2.deltas.delete(name);
  }
}

  function poseV2Apply() {
  const sel = BONE.selected;
  if (!sel || !currentMesh?.skeleton) return;
  if (POSE2.clusterSel !== sel || !POSE2.cluster) poseV2BeginDrag(sel);
  const cluster = POSE2.cluster;
  const driven = getPoseDrivenNames();

  // 1. Capture the selected bone's new delta from the gizmo and clamp it ONCE.
  const selBone = getBoneByName(sel);
  const selRest = poseV2RestOf(sel);
  if (!selBone || !selRest?.q) return;
  clampBoneRotationFromRest(sel);
  _boneQa.fromArray(selRest.q).invert();
  _boneQb.copy(selBone.quaternion).premultiply(_boneQa);
  const selP = selRest.p
    ? [selBone.position.x - selRest.p[0], selBone.position.y - selRest.p[1], selBone.position.z - selRest.p[2]]
    : [0, 0, 0];
  const selDelta = { q: _boneQb.toArray(), p: selP };
  POSE2.deltas.set(sel, selDelta);

  // 2. Deterministic rebuild of the whole cluster from REST + stored deltas.
  for (const name of cluster) {
    const bone = getBoneByName(name);
    const rest = poseV2RestOf(name);
    if (!bone || !rest?.q) continue;
    if (driven.has(name) && name !== sel) {
      // rig outputs: back to rest, the grant solver rewrites them below
      bone.quaternion.fromArray(rest.q);
      if (rest.p) bone.position.fromArray(rest.p);
      continue;
    }
    const d = POSE2.deltas.get(name);
    _boneQa.fromArray(rest.q);
    if (d) { _boneQb.fromArray(d.q); _boneQa.multiply(_boneQb); }
    bone.quaternion.copy(_boneQa);
    if (rest.p) {
      bone.position.set(
        rest.p[0] + (d?.p?.[0] || 0),
        rest.p[1] + (d?.p?.[1] || 0),
        rest.p[2] + (d?.p?.[2] || 0)
      );
    }
  }

  // 3. Auto-pose assist: ancestors ease toward the selected delta. Computed
  //    fresh from stored state on every event — it can never accumulate.
  if (BONE.autoPose) {
    _boneQc.fromArray(selDelta.q);
    let parentName = BONE.anatomy?.parentOf?.[sel];
    let str = BONE.autoPoseStrength * 0.38;
    let depth = 0;
    while (parentName && str > 0.018 && depth < 28) {
      if (!regionsCanShareAutoPose(sel, parentName)) break;
      if (!driven.has(parentName)) {
        const parent = getBoneByName(parentName);
        if (parent) {
          parent.quaternion.multiply(_boneQb.identity().slerp(_boneQc, str));
          clampBoneRotationFromRest(parentName);
        }
      }
      parentName = BONE.anatomy?.parentOf?.[parentName];
      str *= 0.54;
      depth++;
    }
  }

  // 4. Mirror posing: mirrored delta applied to the mirror bone from ITS rest.
  if (BONE.mirrorPose) {
    const mirrorName = getMirrorBoneName(sel);
    const mirror = mirrorName ? getBoneByName(mirrorName) : null;
    const mRest = mirrorName ? poseV2RestOf(mirrorName) : null;
    if (mirror && mRest?.q && !driven.has(mirrorName)) {
      _boneQa.fromArray(selDelta.q);
      mirrorQuaternion(_boneQa, _boneQb);
      POSE2.deltas.set(mirrorName, { q: _boneQb.toArray(), p: [selDelta.p[0], -selDelta.p[1], -selDelta.p[2]] });
      _boneQd.fromArray(mRest.q).multiply(_boneQb);
      mirror.quaternion.copy(_boneQd);
      if (mRest.p) {
        mirror.position.set(
          mRest.p[0] + selDelta.p[0],
          mRest.p[1] - selDelta.p[1],
          mRest.p[2] - selDelta.p[2]
        );
      }
    }
  }

  // 5. Rig outputs: grants (MMD append) for driven bones in the cluster, then
  //    corrective IK for non-leg chains — same solvers playback uses.
  const gs = getPoseGrantSolver();
  if (gs) {
    const bones = currentMesh.skeleton.bones;
    // A grant is relevant when its driven bone OR its source sits in the
    // cluster (matches legacy shouldApplyManualPoseGrant semantics).
    const toSolve = [];
    for (const g of gs.grants) {
      if (g.isLocal || !g.affectRotation) continue;
      const bn = bones[g.index]?.name;
      const pn = bones[g.parentIndex]?.name;
      if (!bn || bn === sel) continue;
      if (!cluster.has(bn) && !(pn && cluster.has(pn))) continue;
      toSolve.push(g);
    }
    // Reset first (the solver multiplies on), then apply in PMX order.
    // A grant may only be solved when its bone could be reset — otherwise the
    // multiplicative solver would accumulate rotation every event.
    const solvable = toSolve.filter(g => {
      const bone = bones[g.index];
      const rest = bone ? poseV2RestOf(bone.name) : null;
      if (bone && rest?.q) { bone.quaternion.fromArray(rest.q); return true; }
      return false;
    });
    for (const g of solvable) gs.updateOne(g);
  } else if (wBonePairs.length) {
    for (const { w, base } of wBonePairs) {
      if (!cluster.has(w.name) && !cluster.has(base.name)) continue;
      if (w.name === sel) base.quaternion.copy(w.quaternion);
      else w.quaternion.copy(base.quaternion);
    }
  }
  applyCorrectiveIk();
}

  function onBoneTransformChanged(finalize = false) {
  if (!currentMesh?.skeleton || !BONE.selected) return;
  ensureBoneSystemForMesh(); // never pose against another model's rest data
  if (!BONE.selected) return; // re-init cleared a stale selection
  applyBoneGizmoProxyToBone();
  if (poseEngineV2Enabled()) {
    // Deterministic evaluator — see Pose Engine V2 above.
    poseV2Apply();
  } else {
  if (BONE.autoPose) applyAutoPoseAdjust(BONE.selected);
  else {
    clampBoneRotationFromRest(BONE.selected);
    for (const c of getAnatomySubtree(BONE.selected)) {
      if (c !== BONE.selected) clampBoneRotationFromRest(c);
    }
  }
  // Drive the skin/capsule W-bones from the posed base bones (MMD append).
  applyDeformWBones();
  }
  currentMesh.skeleton.update();
  // Keep limb capsules glued to the bones we just posed so dynamic colliders on
  // W-bone PMX models don't drift off-axis.
  if (getS()?.physics && physicsRuntimeReady()) {
    syncLimbCollidersFromBones(currentMesh);
  }
  if (finalize) {
    refreshBonePropsUI();
    updatePremiumBoneVisuals();
    if (BONE.autoKey) addBoneKeyframe(false);
    saveBoneAnim();
  }
}

  function refreshBonePropsUI() {
  const box = document.getElementById('boneProps');
  if (!box) return;
  const bone = BONE.selected ? getBoneByName(BONE.selected) : null;
  if (!bone) {
    box.innerHTML = '<div class="note" style="text-align:center;padding:4px;">Select a bone to edit X/Y/Z in 3D</div>';
    return;
  }
  const fmt = (v, d = 3) => Number.isFinite(v) ? v.toFixed(d) : '0';
  const p = bone.position, r = bone.rotation, s = bone.scale;
  const rx = THREE.MathUtils.radToDeg(r.x), ry = THREE.MathUtils.radToDeg(r.y), rz = THREE.MathUtils.radToDeg(r.z);
  let html = `<div style="font-size:11px;color:#c9a0ff;margin-bottom:4px;">${escapeHtml(bone.name)}</div>`;
  html += `<div class="note" style="margin-bottom:4px;">Position (local)</div>`;
  ['x', 'y', 'z'].forEach(ax => {
    html += `<div class="axis-row"><label>${ax.toUpperCase()}</label><input type="number" step="0.01" data-bone-prop="pos-${ax}" value="${fmt(p[ax])}"></div>`;
  });
  html += `<div class="note" style="margin:6px 0 4px;">Rotation ° (local)</div>`;
  ['x', 'y', 'z'].forEach(ax => {
    const val = ax === 'x' ? rx : ax === 'y' ? ry : rz;
    html += `<div class="axis-row"><label>${ax.toUpperCase()}</label><input type="number" step="0.5" data-bone-prop="rot-${ax}" value="${fmt(val, 1)}"></div>`;
  });
  html += `<div class="note" style="margin:6px 0 4px;">Scale</div>`;
  ['x', 'y', 'z'].forEach(ax => {
    html += `<div class="axis-row"><label>${ax.toUpperCase()}</label><input type="number" step="0.01" min="0.01" data-bone-prop="scl-${ax}" value="${fmt(s[ax])}"></div>`;
  });
  box.innerHTML = html;
  box.querySelectorAll('input[data-bone-prop]').forEach(inp => {
    inp.addEventListener('change', () => applyBonePropInput(inp));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });
}

  function applyBonePropInput(inp) {
  const bone = BONE.selected ? getBoneByName(BONE.selected) : null;
  if (!bone || !inp.dataset.boneProp) return;
  storeBoneDragSnapshot();
  const [kind, axis] = inp.dataset.boneProp.split('-');
  const v = parseFloat(inp.value);
  if (!Number.isFinite(v)) return;
  if (kind === 'pos') bone.position[axis] = v;
  else if (kind === 'rot') bone.rotation[axis] = THREE.MathUtils.degToRad(v);
  else if (kind === 'scl') bone.scale[axis] = Math.max(0.01, v);
  onBoneTransformChanged(true);
  syncBoneGizmoProxyFromBone();
}

  function pickBoneFromEvent(e) {
  if (!currentMesh?.skeleton || !canPickBoneNow()) return null;
  if (_bonePickPointer?.moved) return null;
  const renderer = getRenderer();
  const camera = getCamera();
  if (!renderer?.domElement || !camera) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  _ray.setFromCamera(_ndc, camera);

  if (boneVisualRoot?.visible) {
    const pickables = [];
    boneVisualMap.forEach(v => { if (v.pick) pickables.push(v.pick); });
    const hits = _ray.intersectObjects(pickables, false);
    hits.sort((a, b) => a.distance - b.distance);
    for (const h of hits) {
      const name = h.object.userData?.boneName;
      if (name) return name;
    }
    return null;
  }

  currentMesh.updateMatrixWorld(true);
  const hits = _ray.intersectObject(currentMesh, true);
  let refPoint = hits.length ? hits[0].point : (_ray.ray.at(10, _boneVec), _boneVec);
  let bestName = null, bestScore = Infinity;
  for (const b of currentMesh.skeleton.bones) {
    b.getWorldPosition(_boneVec2);
    const dist3d = _boneVec2.distanceToSquared(refPoint);
    _boneVec.copy(_boneVec2).project(camera);
    const sx = (_boneVec.x * 0.5 + 0.5) * rect.width + rect.left;
    const sy = (-_boneVec.y * 0.5 + 0.5) * rect.height + rect.top;
    const dist2d = (sx - e.clientX) ** 2 + (sy - e.clientY) ** 2;
    const score = dist2d * 0.55 + dist3d * 6;
    if (score < bestScore) { bestScore = score; bestName = b.name; }
  }
  return bestName;
}

  function snapshotBonePose(names = null, opts = {}) {
  const pose = {};
  if (!currentMesh?.skeleton) return pose;
  const includePosition = !!opts.includePosition;
  const includeScale = !!opts.includeScale;
  for (const b of currentMesh.skeleton.bones) {
    if (names && !names.includes(b.name)) continue;
    if (includePosition || includeScale) {
      const payload = { q: b.quaternion.toArray() };
      if (includePosition) payload.p = b.position.toArray();
      if (includeScale) payload.s = b.scale.toArray();
      pose[b.name] = payload;
    } else {
      pose[b.name] = b.quaternion.toArray();
    }
  }
  return pose;
}

  function addBoneKeyframe(fullPose) {
  if (!currentMesh?.skeleton) { showError('Load a model first.'); return; }
  animPlaying = false;
  const t = BONE.time;
  const pose = fullPose ? snapshotBonePose() : (BONE.selected ? snapshotBonePose([BONE.selected]) : snapshotBonePose());
  const idx = BONE.keys.findIndex(k => Math.abs(k.t - t) < 0.06);
  if (idx >= 0) {
    BONE.keys[idx].pose = { ...BONE.keys[idx].pose, ...pose };
  } else {
    BONE.keys.push({ t, pose });
    BONE.keys.sort((a, b) => a.t - b.t);
  }
  refreshBoneListUI();
  refreshBoneTimelineUI();
  saveBoneAnim();
}

  function cloneBonePosePayload(payload) {
  if (Array.isArray(payload) || ArrayBuffer.isView(payload)) return Array.from(payload, Number);
  if (!payload || typeof payload !== 'object') return null;
  const copy = {};
  if (Array.isArray(payload.q) || ArrayBuffer.isView(payload.q)) copy.q = Array.from(payload.q, Number);
  if (Array.isArray(payload.p) || ArrayBuffer.isView(payload.p)) copy.p = Array.from(payload.p, Number);
  if (Array.isArray(payload.s) || ArrayBuffer.isView(payload.s)) copy.s = Array.from(payload.s, Number);
  return Object.keys(copy).length ? copy : null;
}

  function cloneBonePoseMap(pose) {
  const copy = {};
  if (!pose || typeof pose !== 'object' || Array.isArray(pose)) return copy;
  for (const [name, payload] of Object.entries(pose)) {
    const cloned = cloneBonePosePayload(payload);
    if (cloned) copy[name] = cloned;
  }
  return copy;
}

  function cloneBoneLayerKeys(keys) {
  if (!Array.isArray(keys)) return [];
  return keys.map((key) => ({
    t: Number(key?.t) || 0,
    pose: cloneBonePoseMap(key?.pose),
  })).sort((a, b) => a.t - b.t);
}

  /** Capture one exact skeleton's local rest transform without consulting selection. */
  function captureBoneRestPose(targetMesh) {
  const restPose = {};
  if (!targetMesh?.skeleton?.bones) return restPose;
  for (const bone of targetMesh.skeleton.bones) {
    restPose[bone.name] = {
      q: bone.quaternion.toArray(),
      p: bone.position.toArray(),
      s: bone.scale.toArray(),
    };
  }
  return restPose;
}

  /**
   * Restore a rest pose on one exact mesh.
   *
   * The no-second-argument branch is the legacy editor compatibility path and
   * remains restricted to `_boneSystemMesh`. Supplying `restPose` is the new
   * registry path: it never reads BONE/currentMesh and may target any live
   * character explicitly.
   */
  function applyRestPose(targetMesh = currentMesh, restPose = undefined) {
  const hasExplicitRestPose = restPose !== undefined;
  if (!targetMesh?.skeleton) return false;
  if (!hasExplicitRestPose && targetMesh !== _boneSystemMesh) return false;
  const sourceRestPose = hasExplicitRestPose ? restPose : BONE.restPose;
  if (!sourceRestPose || typeof sourceRestPose !== 'object') return false;
  for (const b of targetMesh.skeleton.bones) {
    const r = sourceRestPose[b.name];
    if (!r) continue;
    if (Array.isArray(r)) b.quaternion.fromArray(r);
    else {
      if (r.q) b.quaternion.fromArray(r.q);
      if (r.p) b.position.fromArray(r.p);
      if (r.s) b.scale.fromArray(r.s);
    }
  }
  // Pose Engine V2 belongs to the currently projected classic editor only.
  // Restoring a background registry layer must not invalidate that editor.
  if (targetMesh === _boneSystemMesh) poseV2Reset();
  targetMesh.skeleton.update();
  return true;
}

  // Explicit user "↺ Rest pose": reset to rest AND take pose ownership so a
  // loaded-but-paused VMD animation can't re-assert the pose right back.
  function resetToRestPose() {
  BONE.playing = false;
  _manualPoseHold = true;
  _manualPoseHoldMesh = _boneSystemMesh || currentMesh || null;
  applyRestPose();
  refreshBoneTimelineUI();
}

  function posePayloadQuaternionArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.q)) return payload.q;
  return null;
}

  function posePayloadPositionArray(payload) {
  if (payload && Array.isArray(payload.p)) return payload.p;
  return null;
}

  function sampleBoneQuaternion(keys, boneName, t) {
  const keyed = keys.filter(k => k.pose[boneName]).sort((a, b) => a.t - b.t);
  if (keyed.length === 0) return null;
  if (t <= keyed[0].t) return _boneQ.fromArray(posePayloadQuaternionArray(keyed[0].pose[boneName]) || [0, 0, 0, 1]);
  if (t >= keyed[keyed.length - 1].t) return _boneQ.fromArray(posePayloadQuaternionArray(keyed[keyed.length - 1].pose[boneName]) || [0, 0, 0, 1]);
  let i = 0;
  while (i < keyed.length - 1 && keyed[i + 1].t < t) i++;
  const k0 = keyed[i], k1 = keyed[i + 1];
  const u = (t - k0.t) / Math.max(k1.t - k0.t, 0.0001);
  _boneQa.fromArray(posePayloadQuaternionArray(k0.pose[boneName]) || [0, 0, 0, 1]);
  _boneQb.fromArray(posePayloadQuaternionArray(k1.pose[boneName]) || [0, 0, 0, 1]);
  return _boneQa.slerp(_boneQb, u);
}

  function sampleBonePosition(keys, boneName, t) {
  const keyed = keys.filter(k => posePayloadPositionArray(k.pose[boneName])).sort((a, b) => a.t - b.t);
  if (keyed.length === 0) return null;
  if (t <= keyed[0].t) return _boneVec.fromArray(posePayloadPositionArray(keyed[0].pose[boneName]));
  if (t >= keyed[keyed.length - 1].t) return _boneVec.fromArray(posePayloadPositionArray(keyed[keyed.length - 1].pose[boneName]));
  let i = 0;
  while (i < keyed.length - 1 && keyed[i + 1].t < t) i++;
  const k0 = keyed[i], k1 = keyed[i + 1];
  const u = (t - k0.t) / Math.max(k1.t - k0.t, 0.0001);
  _boneVec.fromArray(posePayloadPositionArray(k0.pose[boneName]));
  _boneVec2.fromArray(posePayloadPositionArray(k1.pose[boneName]));
  return _boneVec.lerp(_boneVec2, u);
}

  function posePayloadScaleArray(payload) {
  if (payload && Array.isArray(payload.s)) return payload.s;
  return null;
}

  function sampleBoneScale(keys, boneName, t) {
  const keyed = keys.filter(k => posePayloadScaleArray(k.pose[boneName])).sort((a, b) => a.t - b.t);
  if (keyed.length === 0) return null;
  if (t <= keyed[0].t) return _boneVec.fromArray(posePayloadScaleArray(keyed[0].pose[boneName]));
  if (t >= keyed[keyed.length - 1].t) return _boneVec.fromArray(posePayloadScaleArray(keyed[keyed.length - 1].pose[boneName]));
  let i = 0;
  while (i < keyed.length - 1 && keyed[i + 1].t < t) i++;
  const k0 = keyed[i], k1 = keyed[i + 1];
  const u = (t - k0.t) / Math.max(k1.t - k0.t, 0.0001);
  _boneVec.fromArray(posePayloadScaleArray(k0.pose[boneName]));
  _boneVec2.fromArray(posePayloadScaleArray(k1.pose[boneName]));
  return _boneVec.lerp(_boneVec2, u);
}

  function applyBoneAnimTime(t, options = {}) {
  const explicitLayerData = Object.prototype.hasOwnProperty.call(options, 'keys') ||
    Object.prototype.hasOwnProperty.call(options, 'restPose');
  // Registry sampling is an explicit identity boundary. A supplied layer can
  // never fall through to the selected/classic mesh if its owner disappeared.
  const targetMesh = explicitLayerData ? options.mesh : (options.mesh || _boneSystemMesh);
  if (!targetMesh?.skeleton) return false;
  if (!explicitLayerData && targetMesh !== _boneSystemMesh) return false;
  const keys = explicitLayerData ? options.keys : BONE.keys;
  const restPose = explicitLayerData ? options.restPose : BONE.restPose;
  if (!Array.isArray(keys)) return false;
  const explicitMode = options.mode;
  if (explicitLayerData && explicitMode !== 'overlay' && explicitMode !== 'fullPose') return false;
  const overlay = explicitMode === 'overlay' ||
    (!explicitLayerData && explicitMode == null && !!getActionForMesh(targetMesh));
  // Full-pose playback keeps the legacy editor behaviour. Layered/offline
  // playback is an overlay: unkeyed bones must preserve the VMD base instead
  // of being reset to rest (the old reset made face keys move while the body
  // appeared frozen in rest pose).
  if (explicitLayerData && !overlay &&
      (!Object.prototype.hasOwnProperty.call(options, 'restPose') ||
       !restPose || typeof restPose !== 'object')) return false;
  if (!overlay && !applyRestPose(targetMesh, explicitLayerData ? restPose : undefined)) return false;
  for (const b of targetMesh.skeleton.bones) {
    const q = sampleBoneQuaternion(keys, b.name, t);
    if (q) b.quaternion.copy(q);
    const p = sampleBonePosition(keys, b.name, t);
    if (p) b.position.copy(p);
    const s = sampleBoneScale(keys, b.name, t);
    if (s) b.scale.copy(s);
  }
  if (targetMesh === _boneSystemMesh) {
    POSE2.cluster = null; // next manual drag re-syncs deltas from this pose
  }
  // Timeline sampling has no single edited selection. Resolve every relevant
  // append/grant and corrective IK chain on this mesh, not whichever model is
  // currently highlighted in the scene hierarchy.
  applyDeformWBones(targetMesh, {
    selectedName: null,
    ...(explicitLayerData ? { restPose } : {}),
  });
  targetMesh.skeleton.update();
  return true;
}

  function seekBoneTime(t, options = {}) {
  const previousTime = BONE.time;
  const targetMesh = options.mesh || _boneSystemMesh || currentMesh;
  BONE.time = Math.max(0, Math.min(BONE.duration, t));
  if (options.resetPhysics !== false &&
      Math.abs(BONE.time - previousTime) > Math.max(0.08, physicsClock.fixedStep * 2) && targetMesh)
    pendingPhysicsPoseReset.add(targetMesh);
  applyBoneAnimTime(BONE.time, { ...options, mesh: targetMesh });
  if (options.refreshUi !== false) refreshBoneTimelineUI();
}

  function buildClipFromBoneKeys() {
  const tracks = [];
  const names = new Set();
  BONE.keys.forEach(k => Object.keys(k.pose).forEach(n => names.add(n)));
  for (const name of names) {
    const times = [];
    const values = [];
    for (const k of BONE.keys) {
      if (!k.pose[name]) continue;
      const q = posePayloadQuaternionArray(k.pose[name]);
      if (!q) continue;
      times.push(k.t);
      values.push(...q);
    }
    if (times.length === 0) continue;
    const bone = currentMesh.skeleton.getBoneByName(name);
    if (!bone) continue;
    const idx = currentMesh.skeleton.bones.indexOf(bone);
    tracks.push(new THREE.QuaternionKeyframeTrack(`.bones[${idx}].quaternion`, times, values));

    const posTimes = [];
    const posValues = [];
    for (const k of BONE.keys) {
      if (!k.pose[name]) continue;
      const p = posePayloadPositionArray(k.pose[name]);
      if (!p) continue;
      posTimes.push(k.t);
      posValues.push(...p);
    }
    if (posTimes.length) {
      tracks.push(new THREE.VectorKeyframeTrack(`.bones[${idx}].position`, posTimes, posValues));
    }
  }
  return new THREE.AnimationClip('CustomBoneAnim', BONE.duration, tracks);
}

  function bakeBoneAnim() {
  if (!currentMesh?.skeleton) return;
  if (BONE.keys.length < 1) { showError('Add at least 1 keyframe first.'); return; }
  BONE.playing = false;
  animPlaying = false;
  const clip = buildClipFromBoneKeys();
  loadedAnims.push({ name: `Custom anim ${loadedAnims.length + 1}`, clip });
  refreshAnimList();
  playAnim(loadedAnims.length - 1);
  clearError();
}

  function saveBoneAnim() {
  try {
    const key = BONE_STORAGE_PREFIX + (BONE.modelKey || 'default');
    localStorage.setItem(key, JSON.stringify({ duration: BONE.duration, keys: BONE.keys }));
  } catch (_e) {}
}

  function loadBoneAnimSaved() {
  try {
    const key = BONE_STORAGE_PREFIX + (BONE.modelKey || 'default');
    const j = localStorage.getItem(key);
    if (!j) return;
    const data = JSON.parse(j);
    if (data.duration) BONE.duration = data.duration;
    if (Array.isArray(data.keys)) BONE.keys = data.keys;
    const v = document.getElementById('vBoneDur');
    const r = document.getElementById('rBoneDur');
    if (v) v.value = String(BONE.duration);
    if (r) r.value = BONE.duration;
  } catch (_e) {}
}

  /* ---------------- Timeline bridge (anim-timeline.js) -------------------
   * A NARROW window into the existing keyframe store for the new timeline
   * editor. Pose Engine V2 is deliberately untouched: every pose write goes
   * through the SAME applyBoneAnimTime/seekBoneTime paths the classic strip
   * uses (they already reset POSE2.cluster, so the next manual drag re-syncs
   * its deltas from the scrubbed pose — the fragile part stays safe). */
  const _tlListeners = [];
  function tlNotify() {
  for (const cb of _tlListeners) { try { cb(); } catch (_e) {} }
}

  function tlAddKeyAt(t, boneName = null, opts = {}) {
  if (!currentMesh?.skeleton) return false;
  const tt = Math.max(0, Math.min(BONE.duration, t));
  const names = Array.isArray(boneName) ? boneName : (boneName ? [boneName] : null);
  const pose = names ? snapshotBonePose(names, opts) : snapshotBonePose(null, opts);
  if (!Object.keys(pose).length) return false;
  const idx = BONE.keys.findIndex(k => Math.abs(k.t - tt) < 0.06);
  if (idx >= 0) BONE.keys[idx].pose = { ...BONE.keys[idx].pose, ...pose };
  else {
    BONE.keys.push({ t: tt, pose });
    BONE.keys.sort((a, b) => a.t - b.t);
  }
  saveBoneAnim();
  refreshBoneListUI();
  refreshBoneTimelineUI();
  return true;
}

  function getTimelineBridge() {
  return {
    // --- data (live ref; call commit() after mutating in place) ---
    keys: () => BONE.keys,
    replaceKeys: (keys) => {
      BONE.keys = Array.isArray(keys) ? keys : [];
      BONE.keys.sort((a, b) => a.t - b.t);
      saveBoneAnim();
      refreshBoneListUI();
      refreshBoneTimelineUI();
    },
    commit: () => {
      BONE.keys.sort((a, b) => a.t - b.t);
      saveBoneAnim();
      refreshBoneListUI();
      refreshBoneTimelineUI();
    },
    duration: () => BONE.duration,
    setDuration: (d) => {
      const n = Number(d);
      BONE.duration = Number.isFinite(n) ? Math.max(1, Math.min(600, n)) : 10;
      saveBoneAnim();
      refreshBoneTimelineUI();
    },
    // --- transport (existing safe paths only) ---
    time: () => BONE.time,
    seek: (t) => seekBoneTime(t),
    playing: () => BONE.playing,
    setPlaying: (v) => {
      if (v) ensureBoneSystemForMesh();
      BONE.playing = !!v && !!getBoneTimelineOwner();
    },
    // --- keys / posing ---
    addKeyAt: tlAddKeyAt,
    addKeyBones: (boneNames = null, opts = {}) => tlAddKeyAt(BONE.time, boneNames, opts),
    addKeyPose: () => addBoneKeyframe(true),
    // --- selection / metadata ---
    selectedBone: () => BONE.selected,
    selectBone: (name) => selectBone(name, false),
    regionOf: (name) => getBoneRegion(name),
    enabled: () => !!currentMesh?.skeleton,
    autoKey: () => BONE.autoKey,
    setAutoKey: (v) => { BONE.autoKey = !!v; },
    // pose ownership: the open timeline suppresses the paused-animation
    // re-assert (and pins colliders) exactly like the bone panel does
    setTimelineActive: (v, mesh = currentMesh) => {
      _timelineActive = !!v;
      _timelineOwnerMesh = _timelineActive ? (mesh || _boneSystemMesh || null) : null;
    },
    timelineActive: () => _timelineActive,
    setExternalPoseOwner,
    isExternalPosePhysicsSuspended,
    externalPoseOwnershipSnapshot: getExternalPoseOwnershipSnapshot,
    // --- read-only access for the mocap retargeter -----------------------
    mesh: () => currentMesh,
    restOf: (name) => {
      const r = poseV2RestOf(name);
      return r ? { q: r.q ? [...r.q] : null, p: r.p ? [...r.p] : null } : null;
    },
    // --- change feed (fired from refreshBoneTimelineUI) ---
    onChange: (cb) => {
      if (typeof cb === 'function') _tlListeners.push(cb);
      return () => {
        const i = _tlListeners.indexOf(cb);
        if (i >= 0) _tlListeners.splice(i, 1);
      };
    },
  };
}

  function isBoneTransformTarget(obj) {
  return obj === boneGizmoProxy || !!obj?.isBone;
}

  function canPickBoneNow() {
  return !isTcDragging() && performance.now() >= _bonePickSuppressUntil;
}

  function suppressBonePick(ms = 320) {
  _bonePickSuppressUntil = performance.now() + ms;
}

  function syncBoneGizmoProxyFromBone() {
  const bone = BONE.selected ? getBoneByName(BONE.selected) : null;
  if (!bone) return;
  bone.updateWorldMatrix(true, false);
  boneGizmoProxy.matrix.copy(bone.matrixWorld);
  boneGizmoProxy.matrix.decompose(boneGizmoProxy.position, boneGizmoProxy.quaternion, boneGizmoProxy.scale);
  boneGizmoProxy.scale.set(1, 1, 1);
}

  function applyBoneGizmoProxyToBone() {
  const bone = BONE.selected ? getBoneByName(BONE.selected) : null;
  if (!bone?.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  _boneMat.copy(bone.parent.matrixWorld).invert().multiply(boneGizmoProxy.matrix);
  _boneMat.decompose(_boneVec, _boneQa, _boneVec2);
  const mode = BONE.transformMode || 'rotate';
  if (mode === 'translate') {
    if (Number.isFinite(_boneVec.x)) bone.position.copy(_boneVec);
  } else if (mode === 'scale') {
    if (Number.isFinite(_boneVec2.x)) {
      bone.scale.set(
        Math.max(0.01, _boneVec2.x),
        Math.max(0.01, _boneVec2.y),
        Math.max(0.01, _boneVec2.z),
      );
    }
  } else if (Number.isFinite(_boneQa.x)) {
    bone.quaternion.copy(_boneQa);
  }
}

  function sanitizeGeometryMorphAttributes(geometry) {
  if (!geometry) return;
  const ma = geometry.morphAttributes;
  if (ma) {
    for (const key of ['position', 'normal', 'color']) {
      const arr = ma[key];
      if (Array.isArray(arr) && arr.length === 0) delete ma[key];
    }
  }
  if (Array.isArray(geometry.morphTargets) && geometry.morphTargets.length === 0) {
    delete geometry.morphTargets;
  }
}

  function sanitizeMeshMorphAttributes(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.geometry) sanitizeGeometryMorphAttributes(o.geometry);
  });
}

  function captureModelMaterials(mesh) {
  if (!mesh) return;
  sanitizeMeshMorphAttributes(mesh);
  mesh.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      if (m.userData._opacityCaptured) return;
      m.userData._origOpacity = m.opacity ?? 1;
      m.userData._origTransparent = !!m.transparent;
      m.userData._origDepthWrite = m.depthWrite !== false;
      m.userData._opacityCaptured = true;
    });
  });
}

  function applyModelOpacity(alpha, mesh = currentMesh) {
  const targetMesh = mesh || null;
  if (!targetMesh) return;
  const a = Math.max(0.05, Math.min(1, alpha));
  BONE.modelOpacity = a;
  targetMesh.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      const orig = m.userData._origOpacity ?? 1;
      const out = orig * a;
      m.opacity = out;
      m.transparent = out < 0.995 || m.userData._origTransparent;
      m.depthWrite = out > 0.12 && (m.userData._origDepthWrite ?? true);
    });
  });
}

  function styleBoneVisualMaterials(vis, isSel, isHover) {
  const m = vis.jointMat;
  if (isSel) {
    m.color.setHex(RIG_COLOR.sel);
    m.opacity = 0.95;
  } else if (isHover) {
    m.color.setHex(RIG_COLOR.hover);
    m.opacity = 0.95;
  } else {
    m.color.setHex(RIG_COLOR.base);
    m.opacity = 0.85;
  }
}

  function ensureBoneVisAssets() {
  if (BONE_VIS.jointGeo) return;
  // Clean solid spheres (Cascadeur look) instead of dense wireframe icosahedrons.
  BONE_VIS.jointGeo = new THREE.SphereGeometry(1, 16, 12);
  BONE_VIS.pickGeo = new THREE.SphereGeometry(1, 8, 6);
  BONE_VIS.lineMat = new THREE.LineBasicMaterial({
    color: RIG_COLOR.line,
    transparent: true,
    opacity: 0.6,
    depthTest: false,
    depthWrite: false,
  });
  BONE_VIS.matPick = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.001,
    depthWrite: false,
    depthTest: false,
  });
}

  function disposeBoneVisuals() {
  if (boneVisualRoot) {
    getScene().remove(boneVisualRoot);
    boneVisualRoot.traverse(o => {
      if (o.material && o.material !== BONE_VIS.lineMat && o.material !== BONE_VIS.matPick && o.material.dispose) {
        o.material.dispose();
      }
      if (o.geometry && o.geometry !== BONE_VIS.jointGeo && o.geometry !== BONE_VIS.pickGeo) {
        o.geometry.dispose();
      }
    });
    boneVisualRoot = null;
  }
  skeletonHelper = null;
  boneVisualMap.clear();
  boneVisualLines.length = 0;
  _rigHoverName = null;
}

  function computeBoneVisualScale(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  // ~1.3% of model height keeps joints readable across PMX scales (Cascadeur dots).
  return Math.max(0.04, Math.max(size.x, size.y, size.z) * 0.013);
}

  function matchesRigSemantic(bone, rigId) {
  if (!bone?.name || !rigId) return false;
  const raw = bone.name;
  const n = normBoneToken(raw);
  if (isAccessoryLikeBone(raw, n)) return false;
  if (/ik|ＩＫ|target|dummy|dumm|helper|offset|twist|捩|(^|[_\-. ])end($|[_\-. ])/i.test(raw)) return false;
  const side = rigId.endsWith('L') ? 'L' : rigId.endsWith('R') ? 'R' : '';
  if (side === 'L' && !boneHasLeft(raw, n)) return false;
  if (side === 'R' && !boneHasRight(raw, n)) return false;
  if (!side && (boneHasLeft(raw, n) || boneHasRight(raw, n))) return false;
  const core = rigId.replace(/[LR]$/, '');
  if (core === 'hips') return /(lower_?body|pelvis|hips?|waist|center|centre|root|c_hips?|j_bip_c_hips?)/i.test(n) || /下半身|センター|腰/.test(raw);
  if (core === 'spine') return /(upper_?body_?2|upper_?body|spine|chest|abdomen|torso|body)/i.test(n) || /上半身|胸/.test(raw);
  if (core === 'neck') return /neck/i.test(n) || /首/.test(raw);
  if (core === 'head') return /head/i.test(n) || /頭/.test(raw);
  if (core === 'collar') return /(clavicle|collar|shoulder)/i.test(n) || /肩|鎖骨|锁骨/.test(raw);
  if (core === 'shoulder') return /(upper_?arm|uparm|arm|shoulder)/i.test(n) && !/(fore|lower|elbow|wrist|hand|finger)/i.test(n) || /腕/.test(raw);
  if (core === 'elbow') return /(elbow|fore_?arm|lower_?arm)/i.test(n) || /ひじ|肘/.test(raw);
  if (core === 'wrist') return /(wrist|hand)/i.test(n) && !/(finger|thumb|index|middle|ring|pinky)/i.test(n) || /手首/.test(raw);
  if (core === 'hip') return /(thigh|upper_?leg|upleg|leg)/i.test(n) && !/(knee|calf|lower|ankle|foot|toe)/i.test(n) || /足/.test(raw);
  if (core === 'knee') return /(knee|calf|lower_?leg)/i.test(n) || /ひざ|膝/.test(raw);
  if (core === 'ankle') return /(ankle|foot)/i.test(n) && !/toe/i.test(n) || /足首/.test(raw);
  if (core === 'toe') return /toe/i.test(n) || /つま先|足先/.test(raw);
  return false;
}

  function findRigBone(skeleton, aliases, rigId = '') {
  const bones = skeleton.bones;
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    let b = bones.find(bn => bn.name === alias);
    if (!b) b = bones.find(bn => bn.name.toLowerCase() === a);
    if (!b) b = bones.find(bn => bn.name.toLowerCase().includes(a));
    if (b && (!rigId || matchesRigSemantic(b, rigId))) return b;
  }
  if (rigId) {
    const semantic = bones.find(bn => matchesRigSemantic(bn, rigId));
    if (semantic) return semantic;
  }
  return null;
}

  function isViewportEditableBoneName(name) {
  const raw = String(name || '');
  if (!raw) return false;
  const n = normBoneToken(raw);
  if (/ＩＫ|IK|ik|ctl|ctrl|control|target|dummy|dumm|helper|offset|twist|捩|操作|補助|表示|先端|(^|[_\-. ])end($|[_\-. ])/i.test(raw)) return false;
  if (isAccessoryLikeBone(raw, n)) return false;
  if (/耳|目|口|舌|歯|眉/i.test(raw) || /(^|_)(eye|mouth|tongue|teeth|brow)($|_)/i.test(n)) return false;
  if (/[WＷ]$/.test(raw)) return false;
  return /全ての親|センター|グルーブ|腰|下半身|上半身|首|頭|肩|腕|ひじ|肘|手首|手|指|足|脚|ひざ|膝|足首|つま先|root|center|pelvis|hips|spine|body|chest|neck|head|shoulder|arm|elbow|wrist|hand|finger|leg|thigh|knee|ankle|foot|toe/i.test(raw);
}

  // Walk the real skeleton hierarchy from a distal bone up to (and including) a
  // proximal ancestor, returning [distal, ...sub-bones, proximal]. Used to pull
  // in twist / deform sub-bones that sit between two rig anchors.
  function collectChainBetween(distal, proximal) {
  const chain = [];
  let n = distal;
  let depth = 0;
  while (n && depth < 24) {
    chain.push(n);
    if (n === proximal) return chain;
    n = (n.parent && n.parent.isBone) ? n.parent : null;
    depth++;
  }
  // Proximal was not an ancestor (unusual rig) — just connect the two anchors.
  return [distal, proximal];
}

  function addRigJoint(mesh, bone, isAnchor, tier = isAnchor ? 'anchor' : 'main') {
  if (boneVisualMap.has(bone.name)) return;
  const jointMat = new THREE.MeshBasicMaterial({
    color: RIG_COLOR.base,
    transparent: true,
    opacity: isAnchor ? 0.85 : tier === 'minor' ? 0.55 : 0.7,
    depthTest: false,
    depthWrite: false,
  });
  const joint = new THREE.Mesh(BONE_VIS.jointGeo, jointMat);
  joint.renderOrder = 27;

  const pick = new THREE.Mesh(BONE_VIS.pickGeo, BONE_VIS.matPick);
  pick.userData.boneName = bone.name;
  pick.userData.isBonePick = true;
  pick.renderOrder = 28;

  boneVisualRoot.add(joint);
  boneVisualRoot.add(pick);
  boneVisualMap.set(bone.name, { joint, pick, jointMat, bone, isAnchor, tier });
}

  function addRigConnector(a, b) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(6, 3));
  const line = new THREE.Line(geo, BONE_VIS.lineMat);
  line.renderOrder = 26;
  line.frustumCulled = false;
  boneVisualRoot.add(line);
  boneVisualLines.push({ line, geo, fromBone: a, toBone: b });
}

  function collectViewportHandleBones(mesh) {
  // Universal scan first: name-independent (skin weights + MMD metadata +
  // geometric limb detection), guaranteed to return handles on any skeleton.
  const scan = getRigScan(mesh);
  if (scan?.handles?.length) return scan.handles;

  // Legacy name-based path (kept as a safety net if the scan ever fails).
  const out = [];
  const seen = new Set();
  const add = (bone, isAnchor = false, strict = true) => {
    if (!bone?.name || seen.has(bone.name)) return;
    if (!isAnchor && strict && !isViewportEditableBoneName(bone.name)) return;
    seen.add(bone.name);
    out.push({ bone, isAnchor, tier: isAnchor ? 'anchor' : 'main' });
  };

  const anchorBone = new Map();
  for (const def of RIG_JOINTS) {
    const bone = findRigBone(mesh.skeleton, def.aliases, def.id);
    if (bone && isViewportEditableBoneName(bone.name)) {
      anchorBone.set(def.id, bone);
      add(bone, true);
    }
  }

  for (const chain of RIG_CHAINS) {
    for (let i = 0; i < chain.length - 1; i++) {
      const proximal = anchorBone.get(chain[i]);
      const distal = anchorBone.get(chain[i + 1]);
      if (!proximal || !distal) continue;
      const seg = collectChainBetween(distal, proximal);
      for (const bone of seg) add(bone, bone === proximal || bone === distal);
    }
  }

  if (out.length < 6) {
    for (const bone of mesh.skeleton.bones) add(bone, false);
  }
  // Final guarantee: a model with bones must never render an empty rig.
  if (out.length === 0) {
    for (const bone of mesh.skeleton.bones) add(bone, false, false);
  }

  return out.slice(0, 220);
}

  function buildPremiumBoneVisuals(mesh) {
  disposeBoneVisuals();
  if (!mesh?.skeleton) return;
  ensureBoneVisAssets();
  boneVisualScale = computeBoneVisualScale(mesh);
  boneVisualRoot = new THREE.Group();
  boneVisualRoot.name = 'VisualRig';
  boneVisualRoot.renderOrder = 25;

  skeletonHelper = new THREE.SkeletonHelper(mesh);
  // Some converted models parent their bones outside the SkinnedMesh (multiple
  // roots) — rebuild the helper from the actual bone root so lines still show.
  if (!skeletonHelper.bones?.length && mesh.skeleton.bones.length) {
    let root = mesh.skeleton.bones[0];
    while (root.parent && root.parent.isBone) root = root.parent;
    skeletonHelper = new THREE.SkeletonHelper(root.parent || root);
  }
  skeletonHelper.name = 'VisualRigSkeletonHelper';
  skeletonHelper.renderOrder = 24;
  skeletonHelper.frustumCulled = false;
  if (skeletonHelper.material) {
    skeletonHelper.material.depthTest = false;
    skeletonHelper.material.depthWrite = false;
    skeletonHelper.material.transparent = true;
    skeletonHelper.material.opacity = 0.55;
  }

  for (const { bone, isAnchor, tier } of collectViewportHandleBones(mesh)) {
    addRigJoint(mesh, bone, isAnchor, tier);
  }
  console.info('[MMD SkeletonHelper] real hierarchy overlay ready', {
    helperBones: skeletonHelper.bones?.length || 0,
    selectableHandles: boneVisualMap.size,
    modelBones: mesh.skeleton.bones.length,
  });

  boneVisualRoot.add(skeletonHelper);
  getScene().add(boneVisualRoot);
  updatePremiumBoneVisuals();
}

  function updatePremiumBoneVisuals() {
  if (!boneVisualRoot || !currentMesh?.skeleton) return;
  currentMesh.updateMatrixWorld(true);
  const jr = boneVisualScale;
  const sel = BONE.selected;

  boneVisualMap.forEach((vis, name) => {
    vis.bone.getWorldPosition(_boneVec);
    const isSel = name === sel;
    const isHover = name === _rigHoverName;
    // Sub-bones render smaller than anchors; accessory/physics dots smaller still.
    const base = vis.isAnchor ? jr : vis.tier === 'minor' ? jr * 0.45 : jr * 0.62;
    const r = isSel ? base * 1.35 : (isHover ? base * 1.2 : base);
    vis.joint.position.copy(_boneVec);
    vis.joint.scale.setScalar(r);
    vis.pick.position.copy(_boneVec);
    vis.pick.scale.setScalar(r * 1.6);
    styleBoneVisualMaterials(vis, isSel, isHover);
  });

  for (const seg of boneVisualLines) {
    seg.fromBone.getWorldPosition(_boneVec);
    seg.toBone.getWorldPosition(_boneVec3);
    const pos = seg.geo.attributes.position.array;
    pos[0] = _boneVec.x;  pos[1] = _boneVec.y;  pos[2] = _boneVec.z;
    pos[3] = _boneVec3.x; pos[4] = _boneVec3.y; pos[5] = _boneVec3.z;
    seg.geo.attributes.position.needsUpdate = true;
  }
}

  // Raycast the rig joints under the cursor and recolor the hovered one (orange).
  function updateRigHover(clientX, clientY) {
  if (!boneVisualRoot?.visible || boneVisualMap.size === 0) {
    if (_rigHoverName) { _rigHoverName = null; updatePremiumBoneVisuals(); }
    return null;
  }
  const renderer = getRenderer();
  const camera = getCamera();
  if (!renderer?.domElement || !camera) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _ray.setFromCamera(_ndc, camera);
  const pickables = [];
  boneVisualMap.forEach(v => { if (v.pick) pickables.push(v.pick); });
  const hits = _ray.intersectObjects(pickables, false);
  const name = hits.length ? hits[0].object.userData?.boneName || null : null;
  if (name !== _rigHoverName) {
    _rigHoverName = name;
    updatePremiumBoneVisuals();
    if (renderer.domElement) renderer.domElement.style.cursor = name ? 'pointer' : '';
  }
  return name;
}

  function updateSkeletonHelper() {
  disposeBoneVisuals();
  if (BONE.enabled && currentMesh && !isCaptureActive()) {
    buildPremiumBoneVisuals(currentMesh);
  }
}

  function scheduleBoneTransformUpdate(finalize = false) {
  if (finalize) {
    if (_boneTransformRaf) {
      cancelAnimationFrame(_boneTransformRaf);
      _boneTransformRaf = 0;
    }
    onBoneTransformChanged(true);
    return;
  }
  if (_boneTransformRaf) return;
  _boneTransformRaf = requestAnimationFrame(() => {
    _boneTransformRaf = 0;
    onBoneTransformChanged(false);
  });
}
  function currentAction() {
  return getActionForMesh(currentMesh);
}

  function updateCharacterMotion(dt, opts = {}) {
    // Keep the legacy single-character entry point, but route it through the
    // same fixed-step scheduler as the multi-character scene.  This removes
    // the final variable-delta physics path without breaking older callers.
    if (currentMesh && animHelper) {
      updateMultiCharacterMotion(
        [{
          mesh: currentMesh,
          activeAnimIdx,
          animPlaying,
          loopIn: opts.loopIn ?? 0,
          loopOut: opts.loopOut ?? 0,
        }],
        dt,
        opts,
      );
    }
  }

  function updateCharacterBoneVisuals(tickFrame = 0) {
    if (!BONE.enabled || !boneVisualRoot) return;
    // "Posing" = animation paused and a model is loaded. Update the rig (and the
    // gizmo proxy / center-of-mass tracking) every frame while posing so it feels
    // responsive, but throttle hard during fast playback to keep 60 FPS.
    const posing = !animPlaying && !BONE.playing;
    if (!posing && (tickFrame % 4 !== 0)) return;
    if (!isTcDragging() && BONE.selected) syncBoneGizmoProxyFromBone();
    updatePremiumBoneVisuals();
  }

  async function initPhysics() {
    rezeReady = true;
    rezePhysicsBroken = false;
    rezeFailureReason = '';
    console.info(`[Reze] ${REZE_ENGINE_NAME} ${REZE_ENGINE_VERSION} ready (CPU SoA + fixed step)`);

    // Models may finish loading before module initialization. Keep their
    // animation registration, then promote them into a Reze world.
    let restored = 0;
    for (const mesh of animHelper?.meshes || []) {
      const result = ensureMeshPhysics(mesh, { cooldownMs: 0 });
      if (result.repaired) restored++;
    }
    if (restored > 0) {
      console.info(`[PhysicsRepair] ${selectedPhysicsBackend()} promotion restored ${restored} model(s)`);
    }
  }

  return {
    animHelper,
    BONE,
    loadedAnims,
    loadedVmdFiles,
    get pendingModelFile() { return pendingModelFile; },
    set pendingModelFile(v) { pendingModelFile = v; },
    get currentMesh() { return currentMesh; },
    set currentMesh(v) { currentMesh = v; },
    get activeAnimIdx() { return activeAnimIdx; },
    set activeAnimIdx(v) { activeAnimIdx = v; },
    get animPlaying() { return animPlaying; },
    set animPlaying(v) { animPlaying = v; },
    get animSpeed() { return animSpeed; },
    set animSpeed(v) { animSpeed = v; },
    get rezeReady() { return rezeReady; },
    get rezePhysicsBroken() { return rezePhysicsBroken; },
    get rezeFailureReason() { return rezeFailureReason; },
    get physicsBackend() { return selectedPhysicsBackend(); },
    get physDebugHelper() { return physDebugHelper; },
    get boneVisualRoot() { return boneVisualRoot; },
    applyIKFixOnly,
    solveNativeIkChains,
    freezeTwistBones,
    syncArmLimbCollidersFromBones,
    syncLimbCollidersFromBones,
    configureArmPhysicsForAnimation,
    makeArmLimbCollidersKinematic,
    markRezeBroken,
    selectedPhysicsBackend,
    physicsRuntimeReady,
    physicsConfig,
    disposeMMDPhysics,
    disposeMeshPhysics,
    disposeLoadedMesh,
    animHelperAddMesh,
    animHelperRemoveMesh,
    restartPhysics,
    rebuildPhysics,
    getMeshPhysics,
    applyPhysicsLive,
    ensureMeshPhysics,
    PHYS_LIMITS,
    clampPhysRate,
    clampPhysSub,
    syncPhysicsClockConfig,
    setIndependentPhysicsEnabled,
    evaluateAnimationPosesAtCurrentTime,
    advanceRealtimePhysics,
    advanceOfflinePhysics,
    finalizeOfflinePhysicsPose,
    prepareOfflinePhysics,
    resetPhysicsClock,
    getPhysicsClockStats,
    getPhysicsRuntimeReport,
    capturePhysicsWorldRollbackState,
    restorePhysicsWorldRollbackState,
    capturePhysicsClockRollbackState,
    restorePhysicsClockRollbackState,
    capturePhysicsRuntimeRollbackState,
    restorePhysicsRuntimeRollbackState,
    isPhysicsPoseResetPending,
    setPhysicsPoseResetPending,
    isWindDiscontinuityPending,
    setWindDiscontinuityPending,
    applySafePhysDefaults,
    syncStablePhysUI,
    setPhysDebugHelper,
    applySwing,
    applyWindForce,
    playAnim,
    refreshAnimList,
    currentAction,
    currentDuration,
    resetAnimGuardState,
    resetMeshBindPose,
    clearAnimMixerState,
    waitFrames,
    waitForMeshPhysics,
    removeScenePlaceholder,
    updateCharacterMotion,
    sampleLiveCharacterPose,
    finalizeLiveCharacterPhysics,
    updateMultiCharacterMotion,
    updateCharacterBoneVisuals,
    getActionForMesh,
    playAnimOnMesh,
    installAnimationLayerStack,
    getAnimationLayerState,
    getAnimationLayerActions,
    getAnimationLayerDuration,
    setAnimationLayerTime,
    sampleAnimationLayersAtTime,
    getAnimationLayerDiagnostics,
    setAnimationLayersPaused,
    clearAnimationLayerStack,
    initPhysics,
    initBoneSystem,
    clearBoneSystem,
    selectBone,
    setBoneTransformMode,
    setBoneSpace,
    setExternalPoseOwner,
    isExternalPosePhysicsSuspended,
    externalPoseOwnsMesh,
    getExternalPoseOwnershipSnapshot,
    refreshBoneExplorerUI,
    setBoneExplorerOpen,
    refreshBoneListUI,
    refreshBoneTimelineUI,
    refreshBonePropsUI,
    applyModelOpacity,
    captureModelMaterials,
    updateSkeletonHelper,
    updatePremiumBoneVisuals,
    updateRigHover,
    scheduleBoneTransformUpdate,
    pickBoneFromEvent,
    canPickBoneNow,
    suppressBonePick,
    isBoneTransformTarget,
    syncBoneGizmoProxyFromBone,
    applyBoneGizmoProxyToBone,
    seekBoneTime,
    addBoneKeyframe,
    getTimelineBridge,
    applyRestPose,
    resetToRestPose,
    bakeBoneAnim,
    saveBoneAnim,
    loadBoneAnimSaved,
    buildBonePresetButtons,
    selectBoneByMatch,
    getBoneNames,
    onBoneTransformChanged,
    captureBoneRestPose,
    captureLegacyBoneLayerState,
    activateLegacyBoneLayerState,
    sanitizeMeshMorphAttributes,
    sanitizeGeometryMorphAttributes,
    boneGizmoProxy,
    boneTreeCollapsed,
    getBoneTreeRoots,
    applyBoneAnimTime,
    storeBoneDragSnapshot,
    bonePickWasDragged() {
      return !!_bonePickPointer?.moved;
    },
    bonePickPointerDown(clientX, clientY) {
      _bonePickPointer = { x: clientX, y: clientY, moved: false };
    },
    bonePickPointerMove(clientX, clientY) {
      if (!_bonePickPointer || _bonePickPointer.moved) return;
      const dx = clientX - _bonePickPointer.x;
      const dy = clientY - _bonePickPointer.y;
      if (dx * dx + dy * dy > 16) _bonePickPointer.moved = true;
    },
  };
}
