import * as THREE from "three";
import { SmartRigMapper } from "./SmartRigMapper.js";
import { SmartPoseSolver } from "./SmartPoseSolver.js?v=sp12";
import { SmartPoseGizmos } from "./SmartPoseGizmos.js";
import { SmartPoseTimelineAdapter } from "./SmartPoseTimelineAdapter.js";
import { SmartPoseDebug } from "./SmartPoseDebug.js";
import { chooseDefaultLegSolverMode, isLegSolverModeAvailable } from "./LegSolverOwnership.js";
import { SmartPoseLogger, v3 as logV3, solveResult as logSolve } from "./SmartPoseLogger.js";
import { SmartPoseGrantSolver, collectPhysicsOwnedBoneIndices } from "./SmartPoseGrantSolver.js?v=sp12";
import {
  SMART_POSE_CONTROLLER_DEFS,
  cloneSmartPoseSettings,
  preferredTransformModeForController,
  mirrorSmartControllerId,
} from "./SmartPosePresets.js?v=sp15";

function unique(names) {
  return Array.from(new Set((names || []).filter(Boolean)));
}

export class SmartPoseController {
  constructor(deps = {}) {
    this.deps = deps;
    this.mapper = new SmartRigMapper();
    this.solver = new SmartPoseSolver();
    // MMD grants (付与): keeps D-bones following the FK chain while the anim
    // helper is paused — without this, meshes skinned to D-bones spike at
    // knees/elbows when Smart Pose rotates the FK bones.
    this.grants = new SmartPoseGrantSolver();
    this.gizmos = new SmartPoseGizmos(deps);
    this.timeline = new SmartPoseTimelineAdapter({ getBridge: deps.getTimelineBridge });
    this.debug = new SmartPoseDebug();
    // Deep tracing: every action lands in a ring buffer even when the
    // console is quiet. Console API: __smartPoseLog.report()/dump()/save().
    this.logger = new SmartPoseLogger({ tag: "[SmartPose]" });
    this.installLogConsole();
    this.settings = cloneSmartPoseSettings();
    this.enabled = false;
    this.mesh = null;
    this.rigMap = null;
    this.selectedId = null;
    this.dragging = false;
    this.dragSnapshot = null;
    this.activeTargets = new Map();
    this.disabledNativeIks = new Map();
    this.physicsBoneSet = new Set();
    this._endCheck = null;
    this._playbackActive = false;
    this.dragStartTarget = null;
    this.lastWriteSnapshot = new Map();
    this.lastAffected = [];
    this.clipboardPose = null;
    this.onChangeListeners = [];
    this.tmpPos = new THREE.Vector3();
    this.tmpPos2 = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.tmpQuat2 = new THREE.Quaternion();
    this.tmpMat = new THREE.Matrix4();
    this.identityQ = new THREE.Quaternion();
    this.gizmos.rebuildControllers(SMART_POSE_CONTROLLER_DEFS);
  }

  /** window.__smartPoseLog — one-stop debugging console for the user. */
  installLogConsole() {
    try {
      const self = this;
      globalThis.__smartPoseLog = {
        report: () => self.logger.report(() => self.stateSnapshot()),
        dump: (n, cat) => self.logger.dump(n, cat),
        errors: (n) => self.logger.errors(n),
        save: () => self.logger.save(() => self.stateSnapshot()),
        level: (l) => self.logger.setLevel(l),
        clear: () => self.logger.clear(),
        state: () => self.stateSnapshot(),
      };
      this.logger.info("lifecycle",
        "logger active (build SP-16 · Auto Grip ownership fix) — __smartPoseLog.report() / .dump() / .errors() / .save() / .level('debug')");
    } catch (_) {}
  }

  /** JSON-safe snapshot of everything that matters for diagnosing a bug. */
  stateSnapshot() {
    const s = this.rigMap?.semantic;
    const chain = (c) => (c ? {
      start: (c.hip || c.upperLeg || c.upperArm)?.name || null,
      mid: (c.knee || c.elbow)?.name || null,
      end: (c.ankle || c.wrist || c.hand)?.name || null,
      footIK: c.footIK?.name || undefined,
    } : null);
    return {
      enabled: this.enabled,
      mesh: this.mesh?.name || null,
      bones: this.mesh?.skeleton?.bones?.length || 0,
      selected: this.selectedId,
      dragging: this.dragging,
      activeTargets: [...this.activeTargets.keys()],
      legSolverMode: this.settings.legSolverMode,
      legAvailability: this.rigMap ? this.legSolverAvailability() : null,
      nativeIksDisabled: this.disabledNativeIks.size,
      physicsSuspended: !!this.deps.isPhysicsSuspended?.(),
      playbackActive: this.isPlaybackActive(),
      invalidControllers: this.rigMap ? this.invalidControllerIds() : null,
      rigMissing: this.rigMap?.missing || null,
      chains: this.describeChains(),
      chainRepairs: this.rigMap?.chainRepairs || null,
      grantBones: this.grants?.size ?? 0,
      semantic: s ? {
        root: (s.root || s.center)?.name || null,
        pelvis: (s.lowerBody || s.pelvis)?.name || null,
        chest: (s.chest || s.upperBody)?.name || null,
        neck: s.neck?.name || null,
        head: s.head?.name || null,
        leftArm: chain(s.leftArm),
        rightArm: chain(s.rightArm),
        leftLeg: chain(s.leftLeg),
        rightLeg: chain(s.rightLeg),
      } : null,
      settings: {
        footLock: this.settings.footLock,
        autoKey: this.settings.autoKey,
        playbackPhysics: this.settings.playbackPhysics,
        stretchLimit: this.settings.stretchLimit,
        handRotationFollow: this.settings.handRotationFollow,
        footRotationFollow: this.settings.footRotationFollow,
        transformMode: this.settings.transformMode,
        space: this.settings.space,
      },
      lastAffected: this.lastAffected.slice(0, 12),
    };
  }

  onChange(cb) {
    if (typeof cb !== "function") return () => {};
    this.onChangeListeners.push(cb);
    return () => {
      const idx = this.onChangeListeners.indexOf(cb);
      if (idx >= 0) this.onChangeListeners.splice(idx, 1);
    };
  }

  emitChange() {
    for (const cb of this.onChangeListeners) {
      try { cb(this); } catch (_) {}
    }
  }

  setEnabled(enabled) {
    const next = !!enabled;
    if (this.enabled === next) return;
    this.enabled = next;
    this.logger.info("lifecycle", next ? "Smart Pose ENABLED" : "Smart Pose DISABLED");
    this.deps.setExternalPoseOwner?.(next);
    this.logger.info("physics", next
      ? `physics ${this.deps.isPhysicsSuspended?.() ? "SUSPENDED" : "suspension unavailable"}`
      : "physics ownership released");
    if (!next) {
      this._playbackActive = false;
      this.restoreNativeLegIks();
      this.activeTargets.clear();
      this.lastWriteSnapshot.clear();
    }
    this.gizmos.setVisible(next && !!this.ensureReady());
    if (next) this.syncControllersFromSkeleton({ force: true });
    else this.selectedId = null;
    this.gizmos.setSelected(this.selectedId);
    this.deps.requestAttachRefresh?.();
    this.emitChange();
  }

  isEnabled() {
    return this.enabled;
  }

  isPlaybackActive() {
    return !!this.deps.isPlaybackActive?.();
  }

  ensureReady() {
    const mesh = this.deps.getMesh?.();
    if (!mesh?.skeleton?.bones?.length) {
      this.mesh = null;
      this.rigMap = null;
      this.gizmos.setVisible(false);
      return false;
    }
    if (this.mesh !== mesh || !this.rigMap) {
      this.mesh = mesh;
      this.rigMap = this.mapper.map(mesh, { modelKey: mesh.name || "model" });
      // PHYSICS OWNERSHIP: bones with dynamic rigid bodies belong to Reze.
      // Smart Pose must never write OR RESTORE them — a full-skeleton
      // snapshot restore per click teleports every body and the impulses
      // compound until the mesh explodes.
      this.physicsBoneSet = new Set();
      const physIdx = collectPhysicsOwnedBoneIndices(mesh.geometry?.userData?.MMD);
      for (const i of physIdx) {
        const bone = mesh.skeleton.bones[i];
        if (bone) this.physicsBoneSet.add(bone);
      }
      if (this.physicsBoneSet.size) {
        this.logger.info("rig", `physics ownership: ${this.physicsBoneSet.size} dynamic bones excluded from Smart Pose writes/restores`);
      }
      const grantCount = this.grants.setMesh(mesh);
      if (grantCount || this.grants.skippedPhysics) {
        this.logger.info("rig",
          `grant bridge: ${grantCount} grant-driven bones (D-bones) will follow the FK chain`
          + (this.grants.skippedPhysics ? ` — ${this.grants.skippedPhysics} physics-owned bones left to Reze` : ""));
      }
      this.gizmos.rebuildControllers(SMART_POSE_CONTROLLER_DEFS);
      this.gizmos.setInvalidControllers(this.invalidControllerIds());
      this.selectedId = null;
      // Prefer the model's own MMD leg IK, exactly like Classic Bones/VMD.
      // Smart Pose moves the real 足IK target and asks the motion system to run
      // that native CCDIK chain explicitly while the animation helper is paused.
      // The analytic solver remains only as a fallback for rigs with no PMX IK.
      if (!this.settings.legSolverMode) {
        const avail = this.legSolverAvailability();
        this.settings.legSolverMode = chooseDefaultLegSolverMode(avail);
        this.debug.log?.("leg solver mode", this.settings.legSolverMode);
      }
      if (this.rigMap?.missing?.length) {
        this.debug.log("rig map incomplete", this.rigMap.missing);
      }
      // full rig-mapping trace: bones, chains, missing pieces, leg owner
      const invalid = this.invalidControllerIds();
      this.logger.info("rig", `model mapped: "${mesh.name || "model"}"`, {
        bones: mesh.skeleton.bones.length,
        legSolverMode: this.settings.legSolverMode,
        legAvailability: this.legSolverAvailability(),
        invalidControllers: invalid,
        missing: this.rigMap?.missing || [],
        chainRepairs: this.rigMap?.chainRepairs || [],
        chains: this.describeChains(),
      });
      if (invalid.length) {
        this.logger.warn("rig", `controllers without full chains: ${invalid.join(", ")}`, { chains: this.describeChains() });
      }
      this.syncControllersFromSkeleton({ force: true });
      this.emitChange();
    }
    return !!this.rigMap;
  }

  isAncestorBone(ancestor, descendant) {
    if (!ancestor || !descendant) return false;
    let cur = descendant;
    let guard = 0;
    while (cur && guard++ < 256) {
      if (cur === ancestor) return true;
      cur = cur.parent?.isBone ? cur.parent : null;
    }
    return false;
  }

  /** Human-readable limb chains for logs/dumps: bone names + hierarchy check. */
  describeChains() {
    const s = this.rigMap?.semantic;
    if (!s) return null;
    const info = (start, mid, end) => ({
      bones: [start?.name || "—", mid?.name || "—", end?.name || "—"],
      linked: this.chainIsValid(start, mid, end),
    });
    return {
      leftArm: info(s.leftArm?.upperArm, s.leftArm?.elbow, s.leftArm?.wrist || s.leftArm?.hand),
      rightArm: info(s.rightArm?.upperArm, s.rightArm?.elbow, s.rightArm?.wrist || s.rightArm?.hand),
      leftLeg: { ...info(s.leftLeg?.hip || s.leftLeg?.upperLeg, s.leftLeg?.knee, s.leftLeg?.ankle), footIK: s.leftLeg?.footIK?.name || null },
      rightLeg: { ...info(s.rightLeg?.hip || s.rightLeg?.upperLeg, s.rightLeg?.knee, s.rightLeg?.ankle), footIK: s.rightLeg?.footIK?.name || null },
    };
  }

  chainIsValid(start, mid, end) {
    return !!start && !!mid && !!end && this.isAncestorBone(start, mid) && this.isAncestorBone(mid, end);
  }

  invalidControllerIds() {
    const s = this.rigMap?.semantic;
    if (!s) return SMART_POSE_CONTROLLER_DEFS.map((def) => def.id);
    const leftArmOk = this.chainIsValid(s.leftArm?.upperArm, s.leftArm?.elbow, s.leftArm?.wrist || s.leftArm?.hand);
    const rightArmOk = this.chainIsValid(s.rightArm?.upperArm, s.rightArm?.elbow, s.rightArm?.wrist || s.rightArm?.hand);
    // Match SmartPoseSolver.solveLeg: in "nativeMmdIk" mode the solver only
    // moves the model's own IK target bone, so footIK alone is a valid setup.
    const nativeLegOk = (leg) => (this.settings.legSolverMode === "nativeMmdIk") && !!leg?.footIK;
    const leftLegOk = this.chainIsValid(s.leftLeg?.hip || s.leftLeg?.upperLeg, s.leftLeg?.knee, s.leftLeg?.ankle) || nativeLegOk(s.leftLeg);
    const rightLegOk = this.chainIsValid(s.rightLeg?.hip || s.rightLeg?.upperLeg, s.rightLeg?.knee, s.rightLeg?.ankle) || nativeLegOk(s.rightLeg);
    const invalid = [];
    const mark = (condition, ids) => { if (!condition) invalid.push(...ids); };
    mark(!!(s.root || s.center), ["root"]);
    mark(!!s.pelvis, ["pelvis"]);
    mark(!!s.chest, ["chest"]);
    mark(!!s.head && !!s.neck, ["head"]);
    mark(leftArmOk, ["leftHand", "leftElbowPole"]);
    mark(rightArmOk, ["rightHand", "rightElbowPole"]);
    mark(leftLegOk, ["leftFoot", "leftKneePole"]);
    mark(rightLegOk, ["rightFoot", "rightKneePole"]);
    mark(!!s.head, ["lookTarget"]);
    return invalid;
  }

  debugEnabled() {
    try {
      return !!this.settings.debug || globalThis.SMART_POSE_DEBUG === true || globalThis.localStorage?.getItem("SMART_POSE_DEBUG") === "1";
    } catch (_) {
      return !!this.settings.debug;
    }
  }

  boneIndex(bone) {
    return bone && this.mesh?.skeleton?.bones ? this.mesh.skeleton.bones.indexOf(bone) : -1;
  }

  boneLabel(bone) {
    if (!bone) return "MISSING";
    const idx = this.boneIndex(bone);
    return `#${idx} ${bone.name || "(unnamed)"}`;
  }

  captureBoneState(bones = []) {
    return bones.filter(Boolean).map((bone) => ({
      bone,
      name: bone.name,
      q: bone.quaternion.clone(),
      p: bone.position.clone(),
    }));
  }

  traceSolve(id, result, before = []) {
    if (!this.debugEnabled()) return;
    const s = this.rigMap?.semantic;
    const leg = id?.startsWith("left") ? s?.leftLeg : id?.startsWith("right") ? s?.rightLeg : null;
    const obj = this.gizmos.objectFor(id);
    const target = obj ? obj.getWorldPosition(new THREE.Vector3()) : null;
    const after = before.map((item) => ({
      bone: item.name,
      quaternionChanged: item.bone.quaternion.angleTo(item.q) > 1e-6,
      positionChanged: item.bone.position.distanceTo(item.p) > 1e-6,
    }));
    console.groupCollapsed?.(`[SmartPoseTrace] ${id}`);
    console.log("[SmartPoseTrace]", id, {
      controllerSelected: this.selectedId === id,
      controllerWorldTarget: target ? target.toArray() : null,
      mappedHip: this.boneLabel(leg?.hip || leg?.upperLeg),
      mappedKnee: this.boneLabel(leg?.knee),
      mappedAnkle: this.boneLabel(leg?.ankle),
      mappedFootIK: this.boneLabel(leg?.footIK),
      chainValid: leg ? this.chainIsValid(leg.hip || leg.upperLeg, leg.knee, leg.ankle) : undefined,
      solverCalled: !!result,
      solverSolved: !!result?.solved,
      solverErrorAfter: result?.error,
      changedBones: after,
      boneMatricesUpdated: !!this.mesh?.matrixWorld,
      visibleMeshChanged: !!result?.solved && after.some((b) => b.quaternionChanged || b.positionChanged),
    });
    console.groupEnd?.();
  }

  watchdogBeforeApply() {
    // ALWAYS-ON external-overwrite detector: if some other system (anim
    // helper, PMX IK, grants, physics) rewrote bones Smart Pose just posed,
    // this is the #1 source of "mystery" fighting bugs — log it loudly.
    if (!this.lastWriteSnapshot.size) return false;
    const changed = [];
    for (const [bone, state] of this.lastWriteSnapshot) {
      if (!bone) continue;
      if (bone.quaternion.angleTo(state.q) > 1e-6 || bone.position.distanceTo(state.p) > 1e-6) {
        changed.push(bone.name || "(unnamed)");
      }
    }
    if (changed.length) {
      this.logger.warn("watchdog",
        `EXTERNAL OVERWRITE of ${changed.length} bone(s) between Smart Pose frames — another system is fighting Smart Pose`, {
          bones: changed.slice(0, 12),
          suspects: "MMDAnimationHelper.update / PMX IK / grants / physics",
        }, { throttleKey: "watchdog", throttleMs: 1500 });
    }
    // Keep the settled snapshot armed after a clean frame. A helper/grant reset
    // may happen much later; update() will restore this exact pose without IK.
    return changed.length > 0;
  }

  rememberWrittenBones(names = []) {
    if (!names.length || !this.mesh?.skeleton?.bones) return;
    const byName = new Map(this.mesh.skeleton.bones.map((bone) => [bone.name, bone]));
    for (const name of names) {
      const bone = byName.get(name);
      if (!bone) continue;
      this.lastWriteSnapshot.set(bone, { q: bone.quaternion.clone(), p: bone.position.clone() });
    }
  }

  /** Restore the exact settled Smart Pose result after a helper/grant/physics
   *  write. Never run IK again for the same target: both CCDIK and two-bone
   *  shortest-arc updates can choose another valid bend/twist when iterated. */
  restoreWrittenBones() {
    if (!this.lastWriteSnapshot.size || !this.mesh?.skeleton) return [];
    const restored = [];
    for (const [bone, state] of this.lastWriteSnapshot) {
      if (!bone || this.physicsBoneSet?.has(bone)) continue;
      if (bone.quaternion.angleTo(state.q) <= 1e-6 && bone.position.distanceTo(state.p) <= 1e-6) continue;
      bone.quaternion.copy(state.q);
      bone.position.copy(state.p);
      if (bone.name) restored.push(bone.name);
    }
    if (restored.length) {
      this.mesh.skeleton.update();
      this.mesh.updateMatrixWorld(true);
      this.deps.onSkeletonChanged?.(this.mesh, restored);
      this.logger.info("watchdog", `restored ${restored.length} settled bone(s) without re-running IK`, {
        bones: restored.slice(0, 12),
      }, { throttleKey: "watchdog-restore", throttleMs: 1200 });
    }
    return restored;
  }

  pairedEndController(id) {
    if (id === "leftKneePole") return "leftFoot";
    if (id === "rightKneePole") return "rightFoot";
    if (id === "leftElbowPole") return "leftHand";
    if (id === "rightElbowPole") return "rightHand";
    return null;
  }

  pairedPoleController(id) {
    if (id === "leftFoot") return "leftKneePole";
    if (id === "rightFoot") return "rightKneePole";
    if (id === "leftHand") return "leftElbowPole";
    if (id === "rightHand") return "rightElbowPole";
    return null;
  }

  /** Chain attachment point + total limb length for reach clamping. */
  chainReach(id) {
    const s = this.rigMap?.semantic;
    if (!s) return null;
    let start = null, mid = null, end = null;
    if (id === "leftFoot" || id === "leftKneePole") { start = s.leftLeg?.hip || s.leftLeg?.upperLeg; mid = s.leftLeg?.knee; end = s.leftLeg?.ankle; }
    else if (id === "rightFoot" || id === "rightKneePole") { start = s.rightLeg?.hip || s.rightLeg?.upperLeg; mid = s.rightLeg?.knee; end = s.rightLeg?.ankle; }
    else if (id === "leftHand" || id === "leftElbowPole") { start = s.leftArm?.upperArm; mid = s.leftArm?.elbow; end = s.leftArm?.wrist || s.leftArm?.hand; }
    else if (id === "rightHand" || id === "rightElbowPole") { start = s.rightArm?.upperArm; mid = s.rightArm?.elbow; end = s.rightArm?.wrist || s.rightArm?.hand; }
    if (!start || !mid || !end) return null;
    start.updateWorldMatrix(true, false);
    const p0 = start.getWorldPosition(new THREE.Vector3());
    const p1 = mid.getWorldPosition(new THREE.Vector3());
    const p2 = end.getWorldPosition(new THREE.Vector3());
    return { root: p0, len: p0.distanceTo(p1) + p1.distanceTo(p2) };
  }

  /** REACH CLAMP: no matter WHAT drags the gizmo (grazing-angle transform
   *  controls, camera drift, a wild fling), the solve target is capped to a
   *  sphere around the limb root. Feet can no longer be sent 10 units below
   *  the floor — the #1 source of "нога відлетіла в місиво" reports. */
  clampControllerTarget(id) {
    const info = this.chainReach(id);
    if (!info) return false;
    const obj = this.gizmos.objectFor(id);
    if (!obj) return false;
    const maxR = info.len * (id.includes("Pole") ? 1.9 : 1.3);
    obj.getWorldPosition(this.tmpPos);
    const dist = this.tmpPos.distanceTo(info.root);
    if (dist <= maxR || dist < 1e-6) return false;
    this.tmpPos.sub(info.root).multiplyScalar(maxR / dist).add(info.root);
    obj.position.copy(this.tmpPos);
    obj.updateMatrixWorld(true);
    this.logger.debug("solve", `target clamped to reach: ${id}`, {
      wasDist: +dist.toFixed(3), maxDist: +maxR.toFixed(3),
    }, { throttleKey: `clamp:${id}`, throttleMs: 600 });
    return true;
  }

  storeControllerTarget(id) {
    const obj = this.gizmos.objectFor(id);
    if (!obj) return false;
    this.clampControllerTarget(id);
    obj.updateWorldMatrix(true, false);
    this.activeTargets.set(id, {
      position: obj.getWorldPosition(new THREE.Vector3()),
      quaternion: obj.getWorldQuaternion(new THREE.Quaternion()),
    });
    return true;
  }

  storeRelatedTargets(id) {
    this.storeControllerTarget(id);
    const end = this.pairedEndController(id);
    const pole = this.pairedPoleController(id);
    if (end) this.storeControllerTarget(end);
    if (pole) this.storeControllerTarget(pole);
    if (id === "pelvis" && this.settings.footLock) {
      for (const foot of ["leftFoot", "rightFoot", "leftKneePole", "rightKneePole"]) this.storeControllerTarget(foot);
    }
  }

  /** Relinquish a controller after a transient programmatic solve (Auto Grip).
   *  The solved bone pose stays in place, but Smart Pose no longer restores
   *  that arm over subsequent Classic Bones or Smart Pose user edits. */
  releaseControllerOwnership(id) {
    if (!id) return false;
    const ids = new Set([id, this.pairedEndController(id), this.pairedPoleController(id)].filter(Boolean));
    let changed = false;
    for (const controllerId of ids) changed = this.activeTargets.delete(controllerId) || changed;

    const releasedBones = new Set();
    for (const controllerId of ids) {
      for (const bone of this.bonesForController(controllerId)) if (bone) releasedBones.add(bone);
    }
    for (const bone of releasedBones) changed = this.lastWriteSnapshot.delete(bone) || changed;
    if (ids.has(this._endCheck?.id)) this._endCheck = null;

    this.syncControllersFromSkeleton({ force: true, includeActive: true });
    this.logger.debug("ownership", `released transient controller ownership: ${id}`, {
      controllers: [...ids],
      bones: [...releasedBones].map((bone) => bone.name || "(unnamed)"),
    });
    return changed;
  }

  restoreControllerTargetObject(id) {
    const target = this.activeTargets.get(id);
    if (!target) return false;
    this.gizmos.setControllerTransform(id, target.position, target.quaternion);
    return true;
  }

  activeLegSides(extraControllerId = null) {
    const ids = new Set([...this.activeTargets.keys(), extraControllerId].filter(Boolean));
    const sides = new Set();
    for (const id of ids) {
      if (id === "leftFoot" || id === "leftKneePole") sides.add("left");
      if (id === "rightFoot" || id === "rightKneePole") sides.add("right");
    }
    return sides;
  }

  restoreNativeLegIks() {
    for (const [ik, active] of this.disabledNativeIks) ik.active = active;
    this.disabledNativeIks.clear();
  }

  nativeLegIkForSide(side) {
    const objects = this.deps.getMMDObjects?.(this.mesh);
    const iks = objects?.ikSolver?.iks;
    if (!Array.isArray(iks) || !this.rigMap?.semantic) return [];
    const leg = side === "left" ? this.rigMap.semantic.leftLeg : this.rigMap.semantic.rightLeg;
    const ankleIndex = this.boneIndex(leg?.ankle);
    if (ankleIndex < 0) return [];
    const bones = this.mesh.skeleton.bones;
    return iks.filter((ik) => {
      if (ik?.effector !== ankleIndex) return false;
      const targetName = bones[ik.target]?.name || "";
      return !/toe|つま先/i.test(targetName);
    });
  }

  nativeLegSideForController(id) {
    if (id === "leftFoot" || id === "leftKneePole") return "left";
    if (id === "rightFoot" || id === "rightKneePole") return "right";
    return null;
  }

  /** Complete the native leg path after SmartPoseSolver moved the PMX 足IK
   *  target. Production delegates to mmd-character-motion.js so this uses the
   *  exact same patched CCDIKSolver as Classic Bones and VMD playback. */
  solveNativeLegForController(id) {
    if (this.settings.legSolverMode !== "nativeMmdIk") return [];
    const side = this.nativeLegSideForController(id);
    if (!side) return [];
    const iks = this.nativeLegIkForSide(side);
    if (!iks.length) return [];

    let outcome = this.deps.solveNativeLegIk?.(this.mesh, iks);
    if (!outcome) {
      // Safe fallback for embedders/tests that have not wired the motion bridge.
      const solver = this.deps.getMMDObjects?.(this.mesh)?.ikSolver;
      if (typeof solver?.updateOne === "function") {
        const affected = new Set();
        let count = 0;
        for (const ik of iks) {
          if (!ik || ik.active === false) continue;
          solver.updateOne(ik);
          count++;
          for (const index of [ik.target, ik.effector, ...(ik.links || []).map((link) => link.index)]) {
            const name = this.mesh?.skeleton?.bones?.[index]?.name;
            if (name) affected.add(name);
          }
        }
        outcome = { solved: count > 0, affected: [...affected], count };
      }
    }
    if (!outcome?.solved) {
      this.logger.warn("ik", `native ${side} leg IK pass did not run`, {
        chains: iks.length,
        active: iks.filter((ik) => ik?.active !== false).length,
      }, { throttleKey: `native-leg:${side}`, throttleMs: 1200 });
      return [];
    }
    this.logger.debug("ik", `native ${side} leg IK solved`, {
      chains: outcome.count ?? iks.length,
      affected: outcome.affected || [],
    }, { throttleKey: `native-leg-ok:${side}`, throttleMs: 600 });
    return outcome.affected || [];
  }

  /** leg-solver-ownership.ts: which leg solvers this model offers. */
  legSolverAvailability() {
    const s = this.rigMap?.semantic;
    return {
      hasNativeMmdIk:
        this.nativeLegIkForSide("left").length > 0 ||
        this.nativeLegIkForSide("right").length > 0,
      hasCustomChain: !!(
        (s?.leftLeg?.hip && s?.leftLeg?.knee && s?.leftLeg?.ankle) ||
        (s?.rightLeg?.hip && s?.rightLeg?.knee && s?.rightLeg?.ankle)
      ),
    };
  }

  applyNativeLegIkPolicy(extraControllerId = null) {
    // Native ownership: the model's own IK chains stay ACTIVE — Smart Pose
    // only moves the IK target bones (see SmartPoseSolver.solveLeg).
    if ((this.settings.legSolverMode || "nativeMmdIk") === "nativeMmdIk") {
      this.restoreNativeLegIks();
      return;
    }
    const activeSides = this.activeLegSides(extraControllerId);
    if (!activeSides.size) {
      this.restoreNativeLegIks();
      return;
    }
    const before = this.disabledNativeIks.size;
    const keepDisabled = new Set();
    for (const side of activeSides) {
      for (const ik of this.nativeLegIkForSide(side)) {
        keepDisabled.add(ik);
        if (!this.disabledNativeIks.has(ik)) this.disabledNativeIks.set(ik, ik.active !== false);
        ik.active = false;
      }
    }
    for (const [ik, active] of Array.from(this.disabledNativeIks.entries())) {
      if (keepDisabled.has(ik)) continue;
      ik.active = active;
      this.disabledNativeIks.delete(ik);
    }
    if (this.disabledNativeIks.size !== before) {
      this.logger.info("ik", `native leg IK: ${this.disabledNativeIks.size} chains disabled (was ${before})`, {
        sides: [...activeSides],
      });
    }
  }

  /** Switch the leg owner (nativeMmdIk / smartPoseIk / disabled). */
  setLegSolverMode(mode) {
    const availability = this.legSolverAvailability();
    if (!isLegSolverModeAvailable(mode, availability)) {
      this.logger.warn("settings", `legSolverMode "${mode}" rejected — unavailable on this model`, availability);
      return false;
    }
    this.logger.info("settings", `legSolverMode: ${this.settings.legSolverMode} -> ${mode}`);
    this.settings.legSolverMode = mode;
    if (mode === "nativeMmdIk") this.restoreNativeLegIks();
    this.gizmos.setInvalidControllers(this.invalidControllerIds());
    this.syncControllersFromSkeleton({ force: true });
    this.emitChange();
    return true;
  }

  setSetting(name, value) {
    if (!(name in this.settings)) return;
    if (this.settings[name] !== value) {
      this.logger.info("settings", `${name}: ${JSON.stringify(this.settings[name])} -> ${JSON.stringify(value)}`);
    }
    this.settings[name] = value;
    if (name === "debug") this.debug.setEnabled(value);
    if (name === "autoKey") this.timeline.bridge()?.setAutoKey?.(!!value);
    if (name === "playbackPhysics" && this.enabled && this.isPlaybackActive()) {
      this.deps.setExternalPoseOwner?.(!value);
      this.logger.info("physics", value
        ? "playback physics ENABLED — Reze owns dynamic hair/clothes"
        : "playback physics DISABLED — Smart Pose keeps physics suspended");
    }
    this.emitChange();
  }

  setTransformMode(mode) {
    this.settings.transformMode = mode;
    const tc = this.deps.getTransformControls?.();
    if (tc && this.enabled && this.selectedId) tc.setMode(this.transformModeFor(this.selectedId));
    this.emitChange();
  }

  setSpace(space) {
    this.settings.space = space === "local" ? "local" : "world";
    const tc = this.deps.getTransformControls?.();
    if (tc) tc.space = this.settings.space;
    this.emitChange();
  }

  transformModeFor(id) {
    if (id?.includes("Pole")) return "translate";
    return this.settings.transformMode || preferredTransformModeForController(id);
  }

  selectController(id) {
    if (!this.enabled || !this.ensureReady()) return false;
    if (!this.gizmos.objectFor(id)) {
      this.logger.warn("select", `controller "${id}" has no gizmo object`);
      return false;
    }
    this.logger.info("select", `controller: ${this.selectedId || "(none)"} -> ${id}`);
    this.selectedId = id;
    this.gizmos.setSelected(id);
    const tc = this.deps.getTransformControls?.();
    if (tc) {
      tc.setMode(this.transformModeFor(id));
      tc.space = this.settings.space || "world";
    }
    this.deps.requestAttachRefresh?.();
    this.emitChange();
    return true;
  }

  /** Programmatic controller edit for deterministic systems such as Auto Grip.
   * Uses the exact same snapshot/solve/grant/ownership path as a user drag. */
  solveControllerWorldPose(id, worldPosition, worldQuaternion = null, options = {}) {
    if (!this.enabled || !this.ensureReady() || !worldPosition) return false;
    const object = this.gizmos.objectFor(id);
    if (!object) return false;
    const previousAutoKey = this.settings.autoKey;
    if (options.autoKey === false) this.settings.autoKey = false;
    try {
      if (!this.beginTransform(object)) return false;
      this.tmpPos.copy(worldPosition);
      if (object.parent) object.parent.worldToLocal(this.tmpPos);
      object.position.copy(this.tmpPos);
      if (worldQuaternion) {
        this.tmpQuat.copy(worldQuaternion);
        if (object.parent) {
          object.parent.getWorldQuaternion(this.tmpQuat2).invert();
          this.tmpQuat.premultiply(this.tmpQuat2);
        }
        object.quaternion.copy(this.tmpQuat);
      }
      object.updateMatrixWorld(true);
      this.updateTransform(object, false);
      this.endTransform(object);
      if (options.persistent === false) this.releaseControllerOwnership(id);
      return true;
    } catch (error) {
      this.dragSnapshot = null;
      this.dragging = false;
      if (options.persistent === false) this.releaseControllerOwnership(id);
      this.logger.warn("solve", `programmatic controller solve failed: ${id}`, { error: error?.message || String(error) });
      return false;
    } finally {
      this.settings.autoKey = previousAutoKey;
    }
  }

  attachTransformControls(transformControls) {
    if (!this.enabled || !this.ensureReady() || !this.selectedId) return false;
    const object = this.gizmos.objectFor(this.selectedId);
    if (!object) return false;
    transformControls.attach(object);
    transformControls.setMode(this.transformModeFor(this.selectedId));
    transformControls.space = this.settings.space || "world";
    transformControls.setSize(1.08);
    transformControls.visible = true;
    return true;
  }

  isTransformTarget(obj) {
    return this.gizmos.isControllerObject(obj);
  }

  controllerIdFromObject(obj) {
    return this.gizmos.controllerIdFromObject(obj);
  }

  pickFromEvent(e) {
    if (!this.enabled || !this.ensureReady()) return null;
    return this.gizmos.pickFromEvent(e);
  }

  updateHover(clientX, clientY) {
    if (!this.enabled || !this.ensureReady()) return;
    const fakeEvent = { clientX, clientY };
    this.gizmos.setHover(this.gizmos.pickFromEvent(fakeEvent));
  }

  beginTransform(object) {
    if (!this.enabled || !this.isTransformTarget(object)) return false;
    if (this.isPlaybackActive()) {
      this.deps.showError?.("Pause timeline playback before editing Smart Pose controllers.");
      return false;
    }
    this.ensureReady();
    const id = this.controllerIdFromObject(object);
    // BETWEEN-DRAGS FORENSICS: compare against the state we left at the last
    // drag END. Any delta here was made by something OUTSIDE Smart Pose
    // (anim helper, pose engine, physics write-back, gizmo drift) — this is
    // the exact gap where "клік відкидає ногу" bugs live.
    if (this._endCheck) {
      const changedBones = [];
      for (const st of this._endCheck.bones) {
        const rotDeg = (st.bone.quaternion.angleTo(st.q) * 180) / Math.PI;
        const posDelta = st.bone.position.distanceTo(st.p);
        if (rotDeg > 0.01 || posDelta > 1e-4) {
          changedBones.push(`${st.name}: rot ${rotDeg.toFixed(2)}° pos ${posDelta.toFixed(4)}`);
        }
      }
      const gizmoNow = this.gizmos.objectFor(this._endCheck.id)?.getWorldPosition(this.tmpPos)?.toArray()?.map((n) => +n.toFixed(4));
      const gizmoDrift = gizmoNow && this._endCheck.gizmo
        ? Math.hypot(...gizmoNow.map((n, i) => n - this._endCheck.gizmo[i]))
        : 0;
      if (changedBones.length || gizmoDrift > 1e-3) {
        this.logger.warn("watchdog", `state changed BETWEEN drags — external influence on ${changedBones.length} bone(s), gizmo drift ${gizmoDrift.toFixed(4)}`, {
          sinceEndOf: this._endCheck.id,
          bones: changedBones.slice(0, 10),
          gizmoWas: this._endCheck.gizmo,
          gizmoNow,
        });
      } else {
        this.logger.debug("watchdog", "between-drags check clean", { sinceEndOf: this._endCheck.id });
      }
    }
    this.dragging = true;
    this.dragSnapshot = this.snapshotSkeleton();
    this.lastAffected = [];
    // remember the exact grab point: if the pointer is released without a
    // real move, endTransform turns the whole click into a NO-OP.
    const grabObj = this.gizmos.objectFor(id);
    this.dragStartTarget = grabObj ? {
      id,
      p: grabObj.getWorldPosition(new THREE.Vector3()),
      q: grabObj.getWorldQuaternion(new THREE.Quaternion()),
    } : null;
    this.logger.info("drag", `BEGIN ${id}`, {
      legSolverMode: this.settings.legSolverMode,
      footLock: this.settings.footLock,
      activeTargets: [...this.activeTargets.keys()],
      target: logV3(this.gizmos.objectFor(id)?.getWorldPosition(this.tmpPos)),
    });
    if (id === "pelvis" && this.settings.footLock) {
      for (const foot of ["leftFoot", "rightFoot", "leftKneePole", "rightKneePole"]) this.storeControllerTarget(foot);
    }
    this.applyNativeLegIkPolicy(id);
    this.deps.setExternalPoseOwner?.(true);
    return true;
  }

  updateTransform(object, finalize = false) {
    if (!this.enabled || !this.isTransformTarget(object) || !this.ensureReady()) return false;
    if (this.isPlaybackActive()) return false;
    const id = this.controllerIdFromObject(object);
    if (!id) return false;
    this.applyNativeLegIkPolicy(id);
    if (this.dragSnapshot) this.restoreSkeleton(this.dragSnapshot);
    this.clampControllerTarget(id);
    const before = this.captureBoneState(this.bonesForController(id));
    const result = this.solver.solveController({
      controllerId: id,
      controllerObject: this.gizmos.objectFor(id) || object,
      controllerObjects: this.gizmos.controllerObjects(),
      rigMap: this.rigMap,
      settings: this.settings,
    });
    // buffered per-frame trace (console-throttled) + LOUD unsolved warnings
    this.logger.debug("solve", `${id} update`, {
      target: logV3(this.gizmos.objectFor(id)?.position),
      result: logSolve(result),
    }, { throttleKey: `upd:${id}`, throttleMs: 400 });
    if (!result?.solved) {
      this.logger.warn("solve", `${id} NOT solved: ${result?.reason || "unknown reason"}`,
        logSolve(result), { throttleKey: `fail:${id}`, throttleMs: 800 });
    }
    const affected = [...(result.affected || [])];
    if (result?.solved) affected.push(...this.solveNativeLegForController(id));
    if (id === "pelvis" && this.settings.footLock) {
      affected.push(...this.solveStoredFootLocks());
    }
    affected.push(...this.grants.apply()); // D-bones follow the FK chain
    this.lastAffected = unique(affected);
    this.mesh.skeleton.update();
    this.mesh.updateMatrixWorld(true);
    this.rememberWrittenBones(this.lastAffected);
    this.traceSolve(id, result, before);
    this.deps.onSkeletonChanged?.(this.mesh, this.lastAffected);
    this.debug.setStats({ controller: id, error: result.error, affected: this.lastAffected.length });
    if (finalize) this.endTransform(object);
    return true;
  }

  endTransform(object) {
    if (!this.enabled || !this.isTransformTarget(object)) return false;
    const clickedId = this.controllerIdFromObject(object);
    // IDLE-CLICK NO-OP: grabbing a controller and releasing it without a real
    // move must change NOTHING — no solve, no target store, no grant pass.
    // This kills every remaining source of click drift (solver hysteresis on
    // unreachable targets, float noise, sub-pixel pointer twitches).
    if (this.dragStartTarget && this.dragStartTarget.id === clickedId) {
      const obj = this.gizmos.objectFor(clickedId);
      if (obj) {
        obj.getWorldPosition(this.tmpPos);
        obj.getWorldQuaternion(this.tmpQuat);
        const moved = this.tmpPos.distanceTo(this.dragStartTarget.p) > 0.01
          || Math.abs(this.tmpQuat.dot(this.dragStartTarget.q)) < 1 - 1e-6;
        if (!moved) {
          if (this.dragSnapshot) {
            this.restoreSkeleton(this.dragSnapshot);
            this.dragSnapshot = null;
          }
          this.dragging = false;
          // snap the gizmo back to the exact grab point (undo sub-eps nudges)
          this.gizmos.setControllerTransform(clickedId, this.dragStartTarget.p, this.dragStartTarget.q);
          this.dragStartTarget = null;
          this.deps.setExternalPoseOwner?.(true);
          this.logger.info("drag", `END ${clickedId} — idle click, NO-OP`, null, { throttleKey: "idleclick", throttleMs: 800 });
          this.emitChange();
          return true;
        }
      }
    }
    this.dragStartTarget = null;
    if (this.dragSnapshot) {
      this.restoreSkeleton(this.dragSnapshot);
      this.dragSnapshot = null;
      this.updateTransform(object, false);
    }
    this.dragging = false;
    this.deps.setExternalPoseOwner?.(true);
    const id = this.controllerIdFromObject(object);
    if (id) this.storeRelatedTargets(id);
    this.applyNativeLegIkPolicy(id);
    let keyed = false;
    if (this.settings.autoKey && this.timeline.autoKeyEnabled()) {
      keyed = this.timeline.keyAffectedBones(this.lastAffected, { includePosition: true });
    }
    this.logger.info("drag", `END ${id}`, {
      affected: this.lastAffected.length,
      bones: this.lastAffected.slice(0, 10),
      autoKeyed: keyed,
      nativeIksDisabled: this.disabledNativeIks.size,
      target: logV3(this.gizmos.objectFor(id)?.getWorldPosition(this.tmpPos)),
    });
    // forensic anchor for the next BEGIN: leg/arm chain + grant-driven bones
    // we just wrote, plus the exact gizmo target we ended at.
    const watchNames = new Set(this.lastAffected);
    const watchBones = (this.mesh?.skeleton?.bones || []).filter((b) => watchNames.has(b.name));
    this._endCheck = {
      id,
      bones: this.captureBoneState(watchBones),
      gizmo: this.gizmos.objectFor(id)?.getWorldPosition(this.tmpPos)?.toArray()?.map((n) => +n.toFixed(4)) || null,
    };
    this.syncControllersFromSkeleton({ force: true });
    this.emitChange();
    return true;
  }

  update() {
    if (!this.enabled || !this.ensureReady()) return;
    this.gizmos.setVisible(true);
    const playbackActive = this.isPlaybackActive();
    if (playbackActive) {
      if (!this._playbackActive) {
        // Playback is an intentional upstream bone writer.  A settled Smart
        // Pose snapshot must never be restored over an evaluated timeline
        // frame; doing so was the hands/feet snapping and watchdog spam seen
        // on every playback tick.  Auto-key/Bake is the supported way to put
        // Smart Pose edits into the timeline itself.
        this._playbackActive = true;
        this.dragging = false;
        this.dragSnapshot = null;
        this.dragStartTarget = null;
        this.activeTargets.clear();
        this.lastWriteSnapshot.clear();
        this._endCheck = null;
        this.restoreNativeLegIks();
        this.deps.setExternalPoseOwner?.(!this.settings.playbackPhysics);
        this.logger.info("playback", this.settings.playbackPhysics
          ? "timeline owns animated bones; settled pose hold released; physics LIVE"
          : "timeline owns animated bones; settled pose hold released; physics SUSPENDED");
      }
      this.syncControllersFromSkeleton({ force: true, includeActive: true });
      this.gizmos.updateScale();
      return;
    }
    if (this._playbackActive) {
      this._playbackActive = false;
      this.deps.setExternalPoseOwner?.(true);
      this.activeTargets.clear();
      this.lastWriteSnapshot.clear();
      this.syncControllersFromSkeleton({ force: true, includeActive: true });
      this.logger.info("playback", "timeline stopped; Smart Pose controllers rebased to the displayed pose");
    }
    if (!this.dragging) {
      // Native CCDIK and shortest-arc limb IK are not safe to iterate from an
      // already-solved pose. If another subsystem resets a D/Knee/Elbow helper,
      // restore the exact settled local transforms instead of re-solving every
      // active hand and foot (which used to make one grant reset bend all limbs).
      const externallyOverwritten = this.activeTargets.size
        ? this.watchdogBeforeApply()
        : false;
      if (externallyOverwritten) this.restoreWrittenBones();
      this.syncControllersFromSkeleton({ force: false });
    }
    this.gizmos.updateScale();
  }

  bonesForController(id) {
    const s = this.rigMap?.semantic;
    if (!s) return [];
    if (id === "chest") return s.torso || s.spine || [];
    if (id === "pelvis") return [s.center, s.groove, s.lowerBody || s.pelvis].filter(Boolean);
    if (id === "leftFoot" || id === "leftKneePole") return [s.leftLeg?.hip, s.leftLeg?.knee, s.leftLeg?.ankle].filter(Boolean);
    if (id === "rightFoot" || id === "rightKneePole") return [s.rightLeg?.hip, s.rightLeg?.knee, s.rightLeg?.ankle].filter(Boolean);
    if (id === "leftHand" || id === "leftElbowPole") return [s.leftArm?.upperArm, s.leftArm?.elbow, s.leftArm?.wrist].filter(Boolean);
    if (id === "rightHand" || id === "rightElbowPole") return [s.rightArm?.upperArm, s.rightArm?.elbow, s.rightArm?.wrist].filter(Boolean);
    if (id === "head") return [s.neck, s.head].filter(Boolean);
    return [];
  }

  applyActiveCorrections({ skipWatchdog = false } = {}) {
    if (this.isPlaybackActive()) return;
    if (!skipWatchdog) this.watchdogBeforeApply();
    this.applyNativeLegIkPolicy();
    for (const id of this.activeTargets.keys()) this.restoreControllerTargetObject(id);
    const order = ["pelvis", "chest", "head", "leftHand", "rightHand", "leftFoot", "rightFoot", "lookTarget"];
    const solved = [];
    for (const id of order) {
      if (!this.activeTargets.has(id)) continue;
      const obj = this.gizmos.objectFor(id);
      if (!obj) continue;
      const before = this.captureBoneState(this.bonesForController(id));
      const result = this.solver.solveController({
        controllerId: id,
        controllerObject: obj,
        controllerObjects: this.gizmos.controllerObjects(),
        rigMap: this.rigMap,
        settings: this.settings,
      });
      if (result?.affected?.length) solved.push(...result.affected);
      if (result?.solved) solved.push(...this.solveNativeLegForController(id));
      if (!result?.solved) {
        this.logger.warn("solve", `corrections: ${id} NOT solved: ${result?.reason || "unknown reason"}`,
          logSolve(result), { throttleKey: `corr:${id}`, throttleMs: 1200 });
      }
      this.traceSolve(id, result, before);
    }
    if (solved.length) {
      solved.push(...this.grants.apply()); // D-bones follow the FK chain
      this.lastAffected = unique(solved);
      this.mesh.skeleton.update();
      this.mesh.updateMatrixWorld(true);
      this.rememberWrittenBones(this.lastAffected);
      this.deps.onSkeletonChanged?.(this.mesh, this.lastAffected);
    }
  }

  solveStoredFootLocks() {
    const affected = [];
    for (const id of ["leftFoot", "rightFoot"]) {
      if (!this.activeTargets.has(id)) continue;
      this.restoreControllerTargetObject(id);
      const obj = this.gizmos.objectFor(id);
      if (!obj) continue;
      const result = this.solver.solveController({
        controllerId: id,
        controllerObject: obj,
        controllerObjects: this.gizmos.controllerObjects(),
        rigMap: this.rigMap,
        settings: this.settings,
      });
      if (result?.affected?.length) affected.push(...result.affected);
      if (result?.solved) affected.push(...this.solveNativeLegForController(id));
    }
    return affected;
  }

  controllerWorldPose(id, outPos, outQuat) {
    const s = this.rigMap?.semantic;
    if (!s) return false;
    const useBone = (bone) => {
      if (!bone) return false;
      bone.updateWorldMatrix(true, false);
      bone.getWorldPosition(outPos);
      bone.getWorldQuaternion(outQuat);
      return true;
    };
    if (id === "root") return useBone(s.root || s.center || s.pelvis);
    if (id === "pelvis") {
      const posBone = s.groove || s.center || s.root || s.pelvis;
      const rotBone = s.lowerBody || s.pelvis || posBone;
      if (!posBone) return false;
      posBone.updateWorldMatrix(true, false);
      posBone.getWorldPosition(outPos);
      if (rotBone) {
        rotBone.updateWorldMatrix(true, false);
        rotBone.getWorldQuaternion(outQuat);
      } else outQuat.copy(this.identityQ);
      return true;
    }
    if (id === "chest") return useBone(s.chest || s.upperBody || s.spine?.[0]);
    if (id === "head") return useBone(s.head);
    if (id === "leftHand") return useBone(s.leftArm?.wrist || s.leftArm?.hand);
    if (id === "rightHand") return useBone(s.rightArm?.wrist || s.rightArm?.hand);
    // Native mode must start exactly on the real IK handle. Initializing the
    // gizmo from the ankle and then writing that transform into 足IK created a
    // first-drag offset (the visible "click and the leg jumps away" bug).
    if (id === "leftFoot") return useBone(
      this.settings.legSolverMode === "nativeMmdIk"
        ? (s.leftLeg?.footIK || s.leftLeg?.ankle)
        : (s.leftLeg?.ankle || s.leftLeg?.footIK),
    );
    if (id === "rightFoot") return useBone(
      this.settings.legSolverMode === "nativeMmdIk"
        ? (s.rightLeg?.footIK || s.rightLeg?.ankle)
        : (s.rightLeg?.ankle || s.rightLeg?.footIK),
    );
    if (id === "leftElbowPole") return this.polePose(s.leftArm?.upperArm, s.leftArm?.elbow, s.leftArm?.wrist, outPos, outQuat, 1);
    if (id === "rightElbowPole") return this.polePose(s.rightArm?.upperArm, s.rightArm?.elbow, s.rightArm?.wrist, outPos, outQuat, 1);
    if (id === "leftKneePole") return this.polePose(s.leftLeg?.hip, s.leftLeg?.knee, s.leftLeg?.ankle, outPos, outQuat, 1.2);
    if (id === "rightKneePole") return this.polePose(s.rightLeg?.hip, s.rightLeg?.knee, s.rightLeg?.ankle, outPos, outQuat, 1.2);
    if (id === "lookTarget") {
      if (!useBone(s.head)) return false;
      this.tmpPos2.set(0, 0, 1.8).applyQuaternion(outQuat);
      outPos.add(this.tmpPos2);
      outQuat.copy(this.identityQ);
      return true;
    }
    return false;
  }

  polePose(startBone, midBone, endBone, outPos, outQuat, scale = 1) {
    if (!startBone || !midBone || !endBone) return false;
    startBone.updateWorldMatrix(true, true);
    const p0 = startBone.getWorldPosition(this.tmpPos);
    const p1 = midBone.getWorldPosition(this.tmpPos2);
    const p2 = endBone.getWorldPosition(new THREE.Vector3());
    const chain = p2.sub(p0).normalize();
    const bend = p1.clone().sub(p0);
    bend.addScaledVector(chain, -bend.dot(chain));
    if (bend.lengthSq() < 1e-7) bend.set(0, 0, 1);
    bend.normalize();
    const len = p0.distanceTo(p1) + p1.distanceTo(p2);
    outPos.copy(p1).addScaledVector(bend, Math.max(0.25, len * 0.35 * scale));
    outQuat.copy(this.identityQ);
    return true;
  }

  syncControllersFromSkeleton({ force = false, includeActive = false } = {}) {
    if (!this.rigMap) return;
    for (const def of SMART_POSE_CONTROLLER_DEFS) {
      if (!includeActive && this.activeTargets.has(def.id)) continue;
      if (!force && this.dragging && def.id === this.selectedId) continue;
      if (this.controllerWorldPose(def.id, this.tmpPos, this.tmpQuat)) {
        this.gizmos.setControllerTransform(def.id, this.tmpPos, this.tmpQuat);
      }
    }
  }

  snapshotSkeleton() {
    if (!this.mesh?.skeleton?.bones) return null;
    return this.mesh.skeleton.bones.map((bone) => ({
      bone,
      q: bone.quaternion.toArray(),
      p: bone.position.toArray(),
      s: bone.scale.toArray(),
    }));
  }

  restoreSkeleton(snapshot) {
    if (!snapshot) return;
    for (const item of snapshot) {
      // NEVER rewind physics-owned bones: restoring them teleports the Reze
      // bodies and the reaction impulses compound with every click/drag tick.
      if (this.physicsBoneSet?.has(item.bone)) continue;
      item.bone.quaternion.fromArray(item.q);
      item.bone.position.fromArray(item.p);
      item.bone.scale.fromArray(item.s);
    }
    this.mesh?.skeleton?.update();
    this.mesh?.updateMatrixWorld(true);
  }

  bakeToBoneKeys() {
    if (!this.ensureReady()) return false;
    // Key the settled pose directly. A redundant native CCDIK pass here would
    // alter a constrained/unreachable leg at the moment the user presses Bake.
    if (this.activeTargets.size && this.watchdogBeforeApply()) this.restoreWrittenBones();
    const ok = this.timeline.keyFullPose({ includePosition: true });
    this.logger.info("bake", `bake to bone keys: ${ok ? "OK" : "FAILED (no timeline bridge?)"}`, {
      activeTargets: [...this.activeTargets.keys()],
    });
    if (ok) this.deps.clearError?.();
    return ok;
  }

  clearLayer() {
    this.logger.info("pose", "clear layer (targets + native IK restore)");
    this.dragSnapshot = null;
    this.lastAffected = [];
    this.activeTargets.clear();
    this.restoreNativeLegIks();
    this.lastWriteSnapshot.clear();
    this.syncControllersFromSkeleton({ force: true });
    this.emitChange();
  }

  resetPose() {
    this.logger.info("pose", "reset to rest pose");
    this.deps.applyRestPose?.();
    this.activeTargets.clear();
    this.restoreNativeLegIks();
    this.lastWriteSnapshot.clear();
    this.syncControllersFromSkeleton({ force: true });
    this.deps.setExternalPoseOwner?.(true);
    this.emitChange();
  }

  copyPose() {
    this.clipboardPose = this.snapshotSkeleton();
    return !!this.clipboardPose;
  }

  pastePose() {
    if (!this.clipboardPose) return false;
    this.restoreSkeleton(this.clipboardPose);
    this.deps.onSkeletonChanged?.(this.mesh, this.clipboardPose.map((item) => item.bone.name));
    this.syncControllersFromSkeleton({ force: true });
    this.emitChange();
    return true;
  }

  mirrorPose() {
    if (!this.ensureReady()) return false;
    const mirror = this.rigMap?.mirrorOf;
    if (!mirror?.size) return false;
    const bonesByName = new Map(this.mesh.skeleton.bones.map((bone) => [bone.name, bone]));
    const done = new Set();
    for (const [name, otherName] of mirror.entries()) {
      if (done.has(name) || done.has(otherName)) continue;
      const a = bonesByName.get(name);
      const b = bonesByName.get(otherName);
      if (!a || !b) continue;
      const aq = a.quaternion.clone();
      const ap = a.position.clone();
      a.quaternion.copy(b.quaternion);
      a.position.copy(b.position);
      b.quaternion.copy(aq);
      b.position.copy(ap);
      done.add(name);
      done.add(otherName);
    }
    this.mesh.skeleton.update();
    this.mesh.updateMatrixWorld(true);
    this.syncControllersFromSkeleton({ force: true });
    this.emitChange();
    return true;
  }

  savePosePreset() {
    if (!this.ensureReady()) return false;
    const pose = this.snapshotSkeleton()?.map((item) => ({ name: item.bone.name, q: item.q, p: item.p, s: item.s })) || [];
    try {
      localStorage.setItem(`animastage_smart_pose_preset_${this.mesh.name || "model"}`, JSON.stringify({ version: 1, pose }));
      return true;
    } catch (_) {
      return false;
    }
  }

  loadPosePreset() {
    if (!this.ensureReady()) return false;
    try {
      const raw = localStorage.getItem(`animastage_smart_pose_preset_${this.mesh.name || "model"}`);
      const data = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(data?.pose)) return false;
      const byName = new Map(this.mesh.skeleton.bones.map((bone) => [bone.name, bone]));
      for (const item of data.pose) {
        const bone = byName.get(item.name);
        if (!bone) continue;
        if (item.q) bone.quaternion.fromArray(item.q);
        if (item.p) bone.position.fromArray(item.p);
        if (item.s) bone.scale.fromArray(item.s);
      }
      this.mesh.skeleton.update();
      this.mesh.updateMatrixWorld(true);
      this.syncControllersFromSkeleton({ force: true });
      this.emitChange();
      return true;
    } catch (_) {
      return false;
    }
  }

  selectMirroredController() {
    const mirrored = mirrorSmartControllerId(this.selectedId);
    if (mirrored && mirrored !== this.selectedId) this.selectController(mirrored);
  }
}

export function createSmartPoseSystem(deps = {}) {
  return new SmartPoseController(deps);
}
