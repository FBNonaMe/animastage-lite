// mocap-system.js
// ANIMASTAGE PRO — Stage-2 motion capture: video file AND webcam.
//
// Pose estimation : Google MediaPipe BlazePose (PoseLandmarker, tasks-vision).
//                   OFFLINE-FIRST: runtime + wasm ship in vendor/mediapipe/,
//                   the model is a local file OR a persistently-cached
//                   one-time download (see resolveModel).
// Anti-jitter     : One Euro Filter (Casiez et al.) on every landmark channel.
//                   Both sources are captured as a raw series first and then
//                   smoothed OFFLINE with a two-pass forward+backward filter —
//                   zero phase lag, no trembling. Low-visibility landmarks are
//                   gap-held before filtering.
// Retargeting     : BlazePose world landmarks -> MMD bone quaternions through
//                   the universal rig scanner's semantic anchors, so it works
//                   on ANY model (JP-named or renamed rigs). Aim-vector math
//                   on a pure copy of the BIND skeleton — the live skeleton,
//                   Pose Engine V2 and the solvers are NEVER touched.
// Output          : keyframes in the SAME store the timeline edits
//                   (bridge.replaceKeys) — play/scrub/undo all use the safe
//                   existing paths.

import * as THREE from "three";
import { scanUniversalRig } from "./mmd-universal-rig.js";
// Kalidokit (vendored, offline): the kinematics solver behind most VTuber
// apps. Battle-tested Euler formulas from MediaPipe landmarks — used as the
// DEFAULT retarget engine; the in-house solver stays as "Classic" fallback.
import { Pose as KalidoPose } from "./vendor/kalidokit/kalidokit.js";

/* ========================================================================= *
 *  One Euro Filter — exact implementation of Casiez, Roussel, Vogel (CHI'12)
 * ========================================================================= */
export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.02, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(x, t) {
    if (this.tPrev == null) {
      this.tPrev = t;
      this.xPrev = x;
      return x;
    }
    const dt = Math.max(t - this.tPrev, 1e-6);
    this.tPrev = t;
    const dx = (x - this.xPrev) / dt;
    const aD = OneEuroFilter.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuroFilter.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    return xHat;
  }
}

/* Two-pass (forward + backward) One Euro — zero-phase offline smoothing:
 * the backward pass cancels the forward pass's lag, the way filtfilt does
 * for IIR filters. series = [{t, v}] -> smoothed values (same order). */
export function smoothSeriesTwoPass(series, opts) {
  if (series.length < 3) return series.map((s) => s.v);
  const f1 = new OneEuroFilter(opts);
  const fwd = series.map((s) => f1.filter(s.v, s.t));
  const f2 = new OneEuroFilter(opts);
  const t0 = series[0].t, tN = series[series.length - 1].t;
  const bwd = [];
  for (let i = series.length - 1; i >= 0; i--) {
    bwd[i] = f2.filter(fwd[i], t0 + (tN - series[i].t));
  }
  return bwd;
}

/* Hold-last gap fill for landmarks below the visibility threshold. */
export function gapFill(frames, lmIndex, minVis) {
  let last = null;
  for (const f of frames) {
    const p = f.lm[lmIndex];
    if (p && (p.visibility == null || p.visibility >= minVis)) last = p;
    else if (last) f.lm[lmIndex] = { ...last, visibility: 0 };
  }
}

/* ========================================================================= *
 *  Retargeting — BlazePose world landmarks -> MMD local bone quaternions
 * ========================================================================= */
export const LM = {
  nose: 0, earL: 7, earR: 8,
  shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16,
  hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankL: 27, ankR: 28,
  toeL: 31, toeR: 32,
};

// Chain segment table (MiKaPo-style): every bone is solved as a MINIMAL
// rotation IN ITS CHAIN-PARENT'S FRAME, from mocap point a -> b. `parent`
// names the nearest POSED ancestor anchor whose accumulated delta defines
// that frame. Order matters — parents before children.
const SEGMENTS = [
  { anchor: "neck",      parent: "spine",     a: "shC",  b: "earC",  group: "head" },
  { anchor: "shoulderL", parent: "spine",     a: "shL",  b: "elL",   group: "arms" },
  { anchor: "shoulderR", parent: "spine",     a: "shR",  b: "elR",   group: "arms" },
  { anchor: "elbowL",    parent: "shoulderL", a: "elL",  b: "wrL",   group: "arms" },
  { anchor: "elbowR",    parent: "shoulderR", a: "elR",  b: "wrR",   group: "arms" },
  { anchor: "hipL",      parent: "hips",      a: "hipL", b: "kneeL", group: "legs" },
  { anchor: "hipR",      parent: "hips",      a: "hipR", b: "kneeR", group: "legs" },
  { anchor: "kneeL",     parent: "hipL",      a: "kneeL", b: "ankL", group: "legs" },
  { anchor: "kneeR",     parent: "hipR",      a: "kneeR", b: "ankR", group: "legs" },
];

/** Pure rest-skeleton copy: local/world rotations + world joint positions.
 *
 *  CRITICAL: the model is usually POSED when the user presses Apply (paused
 *  mid-dance, previous mocap, manual posing). Reading bone.position /
 *  bone.quaternion at that moment produced a GARBAGE "rest" skeleton, so
 *  every aim direction was computed against a bent pose — legs over the
 *  head. The authoritative bind pose lives in skeleton.boneInverses
 *  (inverse bind matrices), which never change no matter how the model is
 *  posed — use them as the primary source. */
export function buildRestData(mesh, restOf) {
  const skel = mesh?.skeleton;
  const bones = skel?.bones || [];
  const localQ = new Map(), localP = new Map(), parentOf = new Map();
  const worldQ = new Map(), worldP = new Map();
  for (const b of bones) parentOf.set(b.name, b.parent?.isBone ? b.parent.name : null);

  const inv = skel?.boneInverses;
  if (inv && inv.length === bones.length) {
    // --- bind pose straight from the inverse bind matrices (pose-proof) ---
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    bones.forEach((b, i) => {
      m.copy(inv[i]).invert().decompose(p, q, s);
      worldQ.set(b.name, q.clone());
      worldP.set(b.name, p.clone());
    });
    for (const b of bones) {
      const par = parentOf.get(b.name);
      const pq = par ? worldQ.get(par) : new THREE.Quaternion();
      const pp = par ? worldP.get(par) : new THREE.Vector3();
      const invPq = pq.clone().invert();
      localQ.set(b.name, invPq.clone().multiply(worldQ.get(b.name)));
      localP.set(b.name, worldP.get(b.name).clone().sub(pp).applyQuaternion(invPq));
    }
    return { localQ, localP, parentOf, worldQ, worldP, source: "bind" };
  }

  // --- fallback (no boneInverses): saved rest pose, then current locals ---
  for (const b of bones) {
    const r = restOf ? restOf(b.name) : null;
    localQ.set(b.name, r?.q ? new THREE.Quaternion().fromArray(r.q) : b.quaternion.clone());
    localP.set(b.name, r?.p ? new THREE.Vector3().fromArray(r.p) : b.position.clone());
  }
  const solve = (name) => {
    if (worldQ.has(name)) return;
    const par = parentOf.get(name);
    let pq = new THREE.Quaternion(), pp = new THREE.Vector3();
    if (par) { solve(par); pq = worldQ.get(par); pp = worldP.get(par); }
    worldQ.set(name, pq.clone().multiply(localQ.get(name)));
    worldP.set(name, localP.get(name).clone().applyQuaternion(pq).add(pp));
  };
  for (const b of bones) solve(b.name);
  return { localQ, localP, parentOf, worldQ, worldP, source: "live" };
}

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const _va = new THREE.Vector3(), _vb = new THREE.Vector3();

/** quaternion aligning ONB(primaryA, secondaryA) to ONB(primaryB, secondaryB) */
export function twoVectorQuat(pA, sA, pB, sB) {
  const mk = (p, s) => {
    const x = p.clone().normalize();
    const z = new THREE.Vector3().crossVectors(x, s).normalize();
    if (z.lengthSq() < 1e-8) z.set(0, 0, 1);
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    return new THREE.Matrix4().makeBasis(x, y, z);
  };
  const mA = mk(pA, sA), mB = mk(pB, sB);
  return new THREE.Quaternion().setFromRotationMatrix(mB.multiply(mA.invert()));
}

/**
 * Retarget ONE mocap frame — MiKaPo-style parent-frame chain solving.
 *
 * THE DESYNC/INVERSION FIX: the old solver took the MINIMAL world-space
 * rotation per segment and converted it to a local quaternion afterwards.
 * The arbitrary twist of that minimal world rotation leaked from parents
 * into children's locals — knees/elbows came out rolled or inverted the
 * moment the performer turned away from the camera. MiKaPo (vendored in
 * MiKaPo-main) solves every bone IN ITS PARENT'S FRAME instead:
 *   - torso roots (下半身/上半身) get FULL orthonormal bases (hip line /
 *     shoulder line + trunk axis, Gram-Schmidt) — deterministic twist;
 *   - each limb segment transforms its target direction INTO the parent's
 *     accumulated frame and takes the minimal rotation from the BIND
 *     direction there — twist can no longer compound down the chain.
 * We keep it universal: bind directions come from the scanner's anchors on
 * the actual skeleton, not from hard-coded MMD axes.
 *
 * @param scan   universal rig scan (anchors -> Bone object or index)
 * @param bones  mesh.skeleton.bones
 * @param rest   buildRestData() result
 * @param pts    Map key -> THREE.Vector3 (hipC/shC/earC + LM keys, model space)
 * @param groups { body, head, arms, legs } booleans
 * @param coher  optional { prevD: Map } carried ACROSS frames — temporal
 *               coherence: a joint cannot physically rotate more than ~120°
 *               between two neighbouring keys, so a bigger jump is a
 *               detector glitch / basis flip and the previous delta is HELD.
 *               Without this, one flipped frame made parent+child locals
 *               both jump ~180° — poses at the keys looked fine, but the
 *               INDEPENDENT slerp between keys spun every joint around its
 *               own axis mid-interpolation.
 * @returns pose object { boneName: [x,y,z,w] local quaternion }
 */
const COHER_MAX_STEP = (120 * Math.PI) / 180;
export function retargetFrame(scan, bones, rest, pts, groups = {}, coher = null) {
  const pose = {};
  const nameOf = (anchor) => {
    // scanUniversalRig stores anchors as Bone OBJECTS; older callers used
    // indices — accept both shapes so the retargeter can't silently no-op.
    const a = scan.anchors?.[anchor];
    if (a == null) return null;
    if (typeof a === "number") return bones[a] ? bones[a].name : null;
    if (typeof a === "object" && a.name) return a.name;
    return null;
  };
  const jointPos = (anchor) => {
    const n = nameOf(anchor);
    return n ? rest.worldP.get(n) : null;
  };
  const mid = (a, b) => (a && b ? a.clone().add(b).multiplyScalar(0.5) : a || b || null);

  // World-frame delta per POSED anchor/bone: posedWorld = D_abs * restWorld.
  const D = new Map();        // anchor  -> absolute world delta
  const DByBone = new Map();  // boneName -> absolute world delta
  // ALWAYS a clone — callers invert/multiply the result in place.
  const dOf = (anchor) => (D.get(anchor) ? D.get(anchor).clone() : new THREE.Quaternion());

  // Delta already applied to the bone's subtree by its nearest POSED
  // ancestor in the REAL hierarchy. Without this, rigs where 上半身 is a
  // DESCENDANT of 下半身 (nonstandard but real) applied the turn twice.
  const ancestorDelta = (name) => {
    let p = rest.parentOf.get(name);
    while (p) {
      const d = DByBone.get(p);
      if (d) return d.clone();
      p = rest.parentOf.get(p);
    }
    return new THREE.Quaternion();
  };

  // Write the bone's local quaternion from its ABSOLUTE world delta:
  //   posedW(parent) = A * restW(parent)   (A = nearest posed ancestor delta)
  //   local = restW(parent)^-1 * A^-1 * dAbs * restW(bone)
  //   => posedW(bone) = posedW(parent) * local = dAbs * restW(bone)  ✓
  const writeLocal = (anchor, dAbsIn) => {
    const name = nameOf(anchor);
    if (!name) return;
    let dAbs = dAbsIn;
    // temporal coherence: impossible frame-to-frame jump => hold previous
    const prev = coher?.prevD?.get(anchor);
    if (prev) {
      const dot = Math.abs(
        prev.x * dAbs.x + prev.y * dAbs.y + prev.z * dAbs.z + prev.w * dAbs.w,
      );
      const ang = 2 * Math.acos(Math.min(1, dot));
      if (ang > COHER_MAX_STEP) dAbs = prev.clone();
    }
    const parName = rest.parentOf.get(name);
    const parRestW = parName ? rest.worldQ.get(parName) : null;
    const A = ancestorDelta(name);
    const local = (parRestW ? parRestW.clone().invert() : new THREE.Quaternion())
      .multiply(A.invert())
      .multiply(dAbs)
      .multiply(rest.worldQ.get(name) || _qa.identity());
    pose[name] = local.toArray();
    D.set(anchor, dAbs.clone());
    DByBone.set(name, dAbs.clone());
    if (coher?.prevD) coher.prevD.set(anchor, dAbs.clone());
  };

  // ---- bind reference geometry (from the ACTUAL skeleton — universal) ----
  const rHipL = jointPos("hipL"), rHipR = jointPos("hipR");
  const rShL = jointPos("shoulderL"), rShR = jointPos("shoulderR");
  const rHipC = mid(rHipL, rHipR) || jointPos("hips");
  const rShC = mid(rShL, rShR);

  // ---- torso roots: FULL two-vector bases (deterministic twist) ----------
  if (groups.body !== false && rHipL && rHipR && rHipC && rShC) {
    const mHipL = pts.get("hipL"), mHipR = pts.get("hipR");
    const mHipC = pts.get("hipC"), mShC = pts.get("shC");
    if (mHipL && mHipR && mHipC && mShC) {
      const bindLine = rHipR.clone().sub(rHipL);
      const bindUp = rShC.clone().sub(rHipC);
      const tgtLine = mHipR.clone().sub(mHipL);
      const tgtUp = mShC.clone().sub(mHipC);
      if (bindLine.lengthSq() > 1e-8 && tgtLine.lengthSq() > 1e-8 &&
          bindUp.lengthSq() > 1e-8 && tgtUp.lengthSq() > 1e-8) {
        // pelvis: hip line is primary (yaw/roll), trunk up secondary
        writeLocal("hips", twoVectorQuat(bindLine, bindUp, tgtLine, tgtUp));
      }
    }
    const mShL = pts.get("shL"), mShR = pts.get("shR");
    if (rShL && rShR && mShL && mShR && pts.get("shC") && pts.get("hipC")) {
      const bindUp = rShC.clone().sub(rHipC);
      const bindLine = rShR.clone().sub(rShL);
      const tgtUp = pts.get("shC").clone().sub(pts.get("hipC"));
      const tgtLine = mShR.clone().sub(mShL);
      if (bindUp.lengthSq() > 1e-8 && tgtUp.lengthSq() > 1e-8 &&
          bindLine.lengthSq() > 1e-8 && tgtLine.lengthSq() > 1e-8) {
        // torso: trunk axis is primary (lean), shoulder line secondary (twist)
        writeLocal("spine", twoVectorQuat(bindUp, bindLine, tgtUp, tgtLine));
      }
    }
  }

  // ---- chain segments: minimal rotation IN THE PARENT'S FRAME ------------
  for (const seg of SEGMENTS) {
    if (groups[seg.group] === false) continue;
    const name = nameOf(seg.anchor);
    if (!name) continue;
    const restA = restPointFor(seg.a);
    const restB = restPointFor(seg.b);
    const tgtA = pts.get(seg.a), tgtB = pts.get(seg.b);
    if (!restA || !restB || !tgtA || !tgtB) continue;
    const r0 = _va.copy(restB).sub(restA);
    const t = _vb.copy(tgtB).sub(tgtA);
    if (r0.lengthSq() < 1e-8 || t.lengthSq() < 1e-8) continue;
    // Take the target OUT of the parent's accumulated delta, so the minimal
    // rotation is computed in the same frame the bind direction lives in —
    // MiKaPo's worldToParent transform, generalized to any bind pose.
    const tParent = t.clone().applyQuaternion(dOf(seg.parent).invert());
    _qa.setFromUnitVectors(r0.normalize(), tParent.normalize());
    // absolute delta = parent chain delta composed with the local minimal one
    writeLocal(seg.anchor, dOf(seg.parent).multiply(_qa));
  }
  return pose;

  function restPointFor(key) {
    switch (key) {
      case "hipC": return rHipC;
      case "shC": return rShC;
      case "earC": return jointPos("head") || jointPos("neck");
      case "shL": return jointPos("shoulderL");
      case "shR": return jointPos("shoulderR");
      case "elL": return jointPos("elbowL");
      case "elR": return jointPos("elbowR");
      case "wrL": return jointPos("wristL");
      case "wrR": return jointPos("wristR");
      case "hipL": return jointPos("hipL");
      case "hipR": return jointPos("hipR");
      case "kneeL": return jointPos("kneeL");
      case "kneeR": return jointPos("kneeR");
      case "ankL": return jointPos("ankleL");
      case "ankR": return jointPos("ankleR");
      default: return null;
    }
  }
}

/* ========================================================================= *
 *  Kalidokit engine — VRM-convention Eulers mapped onto the MMD skeleton
 * ========================================================================= */
// Per-axis sign calibration VRM->our MMD space (verified by node tests on a
// synthetic skeleton: T-pose, arms-down, squat, forward-raise, 45° turn).
export const KALIDO_SIGNS = { x: -1, y: 1, z: -1 };

// Kalidokit's rigArm() bakes stylistic "relax" offsets into the output
// (UpperArm.x -= 0.3*invert, y scaled by PI, elbow coupling). Nice for
// VTuber vibes, WRONG for retargeting: a T-posed performer must yield a
// T-posed model. This is the solver's output for a perfect synthetic
// T-pose — subtracted as the neutral baseline.
export const KALIDO_BASELINE = {
  LeftUpperArm: { x: -0.2, y: 0.5, z: 0 },
  RightUpperArm: { x: 0.2, y: -0.5, z: 0 },
  LeftLowerArm: { x: 0.3, y: 0, z: 0 },
  RightLowerArm: { x: 0.3, y: 0, z: 0 },
  LeftUpperLeg: { x: 0, y: 0, z: -0.1 },
  RightUpperLeg: { x: 0, y: 0, z: 0.1 },
};
function debias(e, key) {
  const b = KALIDO_BASELINE[key];
  if (!e || !b) return e;
  return { x: (e.x || 0) - (b.x || 0), y: (e.y || 0) - (b.y || 0), z: (e.z || 0) - (b.z || 0) };
}

const _eu = new THREE.Euler();
function kEuler(e, mirrorFlip) {
  if (!e) return new THREE.Quaternion();
  const sx = KALIDO_SIGNS.x, sy = KALIDO_SIGNS.y, sz = KALIDO_SIGNS.z;
  // mirror-off: swap sides is done at the mapping level; the euler itself
  // mirrors as (x, -y, -z)
  const my = mirrorFlip ? -1 : 1;
  _eu.set(sx * (e.x || 0), sy * my * (e.y || 0), sz * my * (e.z || 0), "XYZ");
  return new THREE.Quaternion().setFromEuler(_eu);
}

/**
 * One Kalidokit frame -> MMD local pose (same D-chain machinery as the
 * classic engine: ancestor-delta correctness + temporal coherence hold).
 * @param rig  Kalidokit Pose.solve() result
 * @param ctx  { scan, bones, rest, mirror, groups, coher, qAtoTL, qAtoTR }
 */
export function kalidoFrame(rig, ctx) {
  const { scan, bones, rest, mirror, groups = {}, coher } = ctx;
  const pose = {};
  const nameOf = (anchor) => {
    const a = scan.anchors?.[anchor];
    if (a == null) return null;
    if (typeof a === "number") return bones[a] ? bones[a].name : null;
    if (typeof a === "object" && a.name) return a.name;
    return null;
  };
  const DByBone = new Map();
  const ancestorDelta = (name) => {
    let p = rest.parentOf.get(name);
    while (p) {
      const d = DByBone.get(p);
      if (d) return d.clone();
      p = rest.parentOf.get(p);
    }
    return new THREE.Quaternion();
  };
  const writeLocal = (anchor, dAbsIn) => {
    const name = nameOf(anchor);
    if (!name) return;
    let dAbs = dAbsIn;
    const prev = coher?.prevD?.get(anchor);
    if (prev) {
      const dot = Math.abs(prev.x * dAbs.x + prev.y * dAbs.y + prev.z * dAbs.z + prev.w * dAbs.w);
      if (2 * Math.acos(Math.min(1, dot)) > COHER_MAX_STEP) dAbs = prev.clone();
    }
    const parName = rest.parentOf.get(name);
    const parRestW = parName ? rest.worldQ.get(parName) : null;
    const A = ancestorDelta(name);
    const local = (parRestW ? parRestW.clone().invert() : new THREE.Quaternion())
      .multiply(A.invert())
      .multiply(dAbs)
      .multiply(rest.worldQ.get(name) || new THREE.Quaternion());
    pose[name] = local.toArray();
    DByBone.set(name, dAbs.clone());
    if (coher?.prevD) coher.prevD.set(anchor, dAbs.clone());
  };

  // Kalidokit "Left*" = the avatar's left in MIRROR view. Our Mirror=ON maps
  // it straight to the model's left; Mirror=OFF swaps sides and mirrors
  // the eulers (true-side mode for learning choreography from video).
  const side = (base) => {
    const mmdL = mirror ? "L" : "R";
    const mmdR = mirror ? "R" : "L";
    return base === "L" ? mmdL : mmdR;
  };
  const flip = !mirror;
  const q = (e) => kEuler(e, flip);

  // torso
  const qHips = q(rig.Hips?.rotation);
  const qSpine = qHips.clone().multiply(q(rig.Spine));
  if (groups.body !== false) {
    writeLocal("hips", qHips.clone());
    writeLocal("spine", qSpine.clone());
  }
  // arms: A-pose offset folds the MMD diagonal bind into the VRM T-pose frame
  if (groups.arms !== false) {
    for (const S of ["L", "R"]) {
      const kSide = S === "L" ? "Left" : "Right";
      const rigUp = rig[kSide + "UpperArm"];
      const rigLo = rig[kSide + "LowerArm"];
      const dst = side(S);
      const qAtoT = (dst === "L" ? ctx.qAtoTL : ctx.qAtoTR) || new THREE.Quaternion();
      if (rigUp) {
        const eUp = debias(rigUp, kSide + "UpperArm");
        const dUp = qSpine.clone().multiply(q(eUp)).multiply(qAtoT);
        writeLocal("shoulder" + dst, dUp);
        if (rigLo) {
          const eLo = debias(rigLo, kSide + "LowerArm");
          const dLo = qSpine.clone().multiply(q(eUp)).multiply(q(eLo)).multiply(qAtoT);
          writeLocal("elbow" + dst, dLo);
        }
      }
    }
  }
  // legs
  if (groups.legs !== false) {
    for (const S of ["L", "R"]) {
      const kSide = S === "L" ? "Left" : "Right";
      const rigUp = rig[kSide + "UpperLeg"];
      const rigLo = rig[kSide + "LowerLeg"];
      const dst = side(S);
      if (rigUp) {
        const eUp = debias(rigUp, kSide + "UpperLeg");
        const dUp = qHips.clone().multiply(q(eUp));
        writeLocal("hip" + dst, dUp);
        if (rigLo) {
          const dLo = qHips.clone().multiply(q(eUp)).multiply(q(rigLo));
          writeLocal("knee" + dst, dLo);
        }
      }
    }
  }
  return pose;
}

/** A->T pose offsets for the arms, computed from the ACTUAL bind skeleton. */
export function armAtoTOffsets(scan, bones, rest) {
  const nameOf = (anchor) => {
    const a = scan.anchors?.[anchor];
    if (a == null) return null;
    if (typeof a === "number") return bones[a] ? bones[a].name : null;
    if (typeof a === "object" && a.name) return a.name;
    return null;
  };
  const pos = (anchor) => {
    const n = nameOf(anchor);
    return n ? rest.worldP.get(n) : null;
  };
  const out = { qAtoTL: new THREE.Quaternion(), qAtoTR: new THREE.Quaternion() };
  const shL = pos("shoulderL"), shR = pos("shoulderR");
  const elL = pos("elbowL"), elR = pos("elbowR");
  if (shL && shR && elL && elR) {
    const lineL = shL.clone().sub(shR).setY(0);
    if (lineL.lengthSq() > 1e-8) {
      const tL = lineL.clone().normalize();
      const bindL = elL.clone().sub(shL);
      const bindR = elR.clone().sub(shR);
      if (bindL.lengthSq() > 1e-8) {
        out.qAtoTL = new THREE.Quaternion().setFromUnitVectors(bindL.normalize(), tL);
      }
      if (bindR.lengthSq() > 1e-8) {
        out.qAtoTR = new THREE.Quaternion().setFromUnitVectors(bindR.normalize(), tL.clone().negate());
      }
    }
  }
  return out;
}

/** MediaPipe world landmarks -> model-space points map for retargetFrame. */
export function landmarksToPoints(lm, { mirror = true, flipZ = false, flipY = false } = {}) {
  const sx = mirror ? 1 : -1;
  const sz = flipZ ? 1 : -1;
  const cv = (i) => {
    const p = lm[i];
    return p ? new THREE.Vector3(p.x * sx, flipY ? p.y : -p.y, p.z * sz) : null;
  };
  // mirror also swaps person's L/R so the model mimics like a mirror
  const L = mirror ? "R" : "L", R = mirror ? "L" : "R";
  const pick = {
    shL: cv(LM["sh" + L]), shR: cv(LM["sh" + R]),
    elL: cv(LM["el" + L]), elR: cv(LM["el" + R]),
    wrL: cv(LM["wr" + L]), wrR: cv(LM["wr" + R]),
    hipL: cv(LM["hip" + L]), hipR: cv(LM["hip" + R]),
    kneeL: cv(LM["knee" + L]), kneeR: cv(LM["knee" + R]),
    ankL: cv(LM["ank" + L]), ankR: cv(LM["ank" + R]),
    earL: cv(LM["ear" + L]), earR: cv(LM["ear" + R]),
    nose: cv(LM.nose),
  };
  const mid = (a, b) => (a && b ? a.clone().add(b).multiplyScalar(0.5) : a || b || null);
  const pts = new Map(Object.entries(pick).filter(([, v]) => v));
  pts.set("hipC", mid(pick.hipL, pick.hipR));
  pts.set("shC", mid(pick.shL, pick.shR));
  pts.set("earC", mid(pick.earL, pick.earR) || pick.nose);
  return pts;
}

/* ========================================================================= *
 *  Capture pipeline: raw frames -> gap-fill -> two-pass smooth -> keys
 * ========================================================================= */
export function framesToKeys({ frames, scan, bones, rest, opts }) {
  const { keyFps = 15, minVis = 0.5, mirror = true, flipZ = false,
    groups = {}, smooth = { minCutoff: 1.2, beta: 0.03 },
    engine = "kalidokit" } = opts || {};
  if (!frames.length) return { keys: [], duration: 0, disabled: [], flipY: false };
  const useKalido = engine === "kalidokit" && typeof KalidoPose?.solve === "function";

  // 0a. AUTO GROUP-OFF by visibility (BEFORE gap-fill): limbs that are out
  // of frame (sitting at a desk -> no legs) come back as HALLUCINATED
  // landmarks with low confidence. Retargeting them threw legs over the
  // head — drop the whole group instead and tell the user.
  const avgVis = (ids) => {
    let s = 0, n = 0;
    for (const f of frames) {
      for (const i of ids) {
        const p = f.lm[i];
        if (p) { s += p.visibility != null ? p.visibility : 1; n++; }
      }
    }
    return n ? s / n : 0;
  };
  const g = {
    body: groups.body !== false, head: groups.head !== false,
    arms: groups.arms !== false, legs: groups.legs !== false,
  };
  const disabled = [];
  const visGate = Math.max(0.35, minVis);
  if (g.legs && avgVis([LM.kneeL, LM.kneeR, LM.ankL, LM.ankR]) < visGate) { g.legs = false; disabled.push("legs"); }
  if (g.arms && avgVis([LM.elL, LM.elR, LM.wrL, LM.wrR]) < visGate) { g.arms = false; disabled.push("arms"); }
  if (g.head && avgVis([LM.earL, LM.earR]) < 0.3) { g.head = false; disabled.push("head"); }

  // 0b. AUTO Y-UP calibration: MediaPipe builds differ on whether world Y
  // points up or down. MAJORITY VOTE across the whole clip — a single probe
  // frame flipped the entire capture upside down whenever the performer
  // happened to be bent over (or the detector glitched) at that moment.
  let flipY = false;
  {
    let votes = 0, total = 0;
    const step = Math.max(1, Math.floor(frames.length / 90));
    for (let i = 0; i < frames.length; i += step) {
      const pts = landmarksToPoints(frames[i].lm, { mirror, flipZ, flipY: false });
      const hipC = pts.get("hipC"), shC = pts.get("shC");
      if (hipC && shC) {
        total++;
        if (shC.y < hipC.y) votes++;
      }
    }
    flipY = total > 0 && votes > total / 2;
  }

  // 1. gap-fill weak landmarks, then smooth every channel with zero lag
  const used = new Set();
  for (const k of Object.keys(LM)) used.add(LM[k]);
  for (const i of used) gapFill(frames, i, minVis);
  for (const i of used) {
    for (const ch of ["x", "y", "z"]) {
      const series = frames
        .filter((f) => f.lm[i])
        .map((f) => ({ t: f.t, v: f.lm[i][ch] }));
      if (series.length < 3) continue;
      const sm = smoothSeriesTwoPass(series, smooth);
      let s = 0;
      for (const f of frames) {
        if (f.lm[i]) f.lm[i] = { ...f.lm[i], [ch]: sm[s++] };
      }
    }
  }

  // 2. sample at the key rate and retarget (with temporal delta coherence)
  const t0 = frames[0].t;
  const duration = frames[frames.length - 1].t - t0;
  const keys = [];
  const step = 1 / Math.max(1, keyFps);
  const coher = { prevD: new Map() };
  const kalidoCtx = useKalido
    ? { scan, bones, rest, mirror, groups: g, coher, ...armAtoTOffsets(scan, bones, rest) }
    : null;
  let fi = 0;
  for (let t = 0; t <= duration + 1e-6; t += step) {
    while (fi < frames.length - 1 && frames[fi + 1].t - t0 <= t) fi++;
    const f = frames[fi];
    if (!f?.lm) continue;
    let pose = null;
    if (useKalido) {
      try {
        // Kalidokit expects the standard MediaPipe convention (world Y down).
        // The flip vote detects builds that emit Y-up — normalize for it too.
        const lmK = flipY ? f.lm.map((p) => ({ ...p, y: -p.y })) : f.lm;
        const rig = KalidoPose.solve(lmK, f.lm2d || lmK, { runtime: "mediapipe" });
        if (rig) pose = kalidoFrame(rig, kalidoCtx);
      } catch (_) { /* fall through to classic for this frame */ }
    }
    if (!pose) {
      const pts = landmarksToPoints(f.lm, { mirror, flipZ, flipY });
      pose = retargetFrame(scan, bones, rest, pts, g, coher);
    }
    if (Object.keys(pose).length) keys.push({ t: +t.toFixed(3), pose });
  }

  // 3. QUATERNION CONTINUITY: q and -q encode the same rotation, but slerp
  // between keys with flipped signs takes the LONG way around — limbs spin
  // through wild arcs between keyframes. Keep every bone track on one
  // hemisphere by sign-aligning each key with its predecessor.
  const prevQ = new Map();
  for (const k of keys) {
    for (const [n, q] of Object.entries(k.pose)) {
      const p = prevQ.get(n);
      if (p && p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3] < 0) {
        q[0] = -q[0]; q[1] = -q[1]; q[2] = -q[2]; q[3] = -q[3];
      }
      prevQ.set(n, q);
    }
  }
  return { keys, duration: Math.max(1, duration), disabled, flipY };
}

/* ========================================================================= *
 *  UI panel + MediaPipe driver
 * ========================================================================= */
/* OFFLINE-FIRST loading order:
 *   1. vendored files in ./vendor/mediapipe/ (bundle + wasm ship with the
 *      app; drop pose_landmarker_full.task into vendor/mediapipe/models/
 *      for 100% offline operation)
 *   2. the browser Cache API — the model downloaded ONCE from the CDN is
 *      stored persistently, so every later run works offline
 *   3. CDN (first run only, or nothing local/cached)
 */
const MP_VERSION = "0.10.14";
const MP_LOCAL = "./vendor/mediapipe";
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";
const MP_MODEL_LOCAL = `${MP_LOCAL}/models/pose_landmarker_full.task`;
const MP_CACHE = "animastage-mocap-v1";

async function urlExists(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch (_) { return false; }
}

/** Resolve the pose model as an ArrayBuffer or a local URL, offline-first. */
async function resolveModel(say) {
  if (await urlExists(MP_MODEL_LOCAL)) {
    say("Model: local file (offline).");
    return { modelAssetPath: MP_MODEL_LOCAL };
  }
  try {
    const cache = await caches.open(MP_CACHE);
    const hit = await cache.match(MP_MODEL);
    if (hit) {
      say("Model: browser cache (offline).");
      return { modelAssetBuffer: new Uint8Array(await hit.arrayBuffer()) };
    }
    say("Model: downloading once from CDN (≈9 MB)… it will be cached for offline use.");
    const resp = await fetch(MP_MODEL);
    if (!resp.ok) throw new Error("model download failed: HTTP " + resp.status);
    await cache.put(MP_MODEL, resp.clone());
    return { modelAssetBuffer: new Uint8Array(await resp.arrayBuffer()) };
  } catch (e) {
    say("Model: CDN (no persistent cache available).");
    return { modelAssetPath: MP_MODEL };
  }
}

/** Store a user-picked .task file in the persistent cache. */
async function storeModelFile(file) {
  const buf = await file.arrayBuffer();
  try {
    const cache = await caches.open(MP_CACHE);
    await cache.put(MP_MODEL, new Response(buf.slice(0)));
  } catch (_) {}
  return new Uint8Array(buf);
}

export function createMocapSystem({ bridge, getHost }) {
  if (!bridge) throw new Error("mocap: bridge is required");

  const S = {
    open: false,
    landmarker: null,
    landmarkerMode: null,
    userModel: null,
    mode: null,           // "video" | "webcam"
    stream: null,
    rafId: 0,
    recording: false,
    processing: false,
    frames: [],           // { t, lm }
    prevKeys: null,       // for "restore previous"
    keyFps: 15,
    smoothing: 1.2,       // One Euro minCutoff (lower = smoother)
    beta: 0.03,
    minVis: 0.5,
    mirror: true,
    flipZ: false,
    engine: "kalidokit", // battle-tested VTuber solver; "classic" = in-house
    groups: { body: true, head: true, arms: true, legs: true },
  };

  /* ------------------------------ panel -------------------------------- */
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;top:64px;left:64px;width:340px;z-index:99998;display:none;" +
    "background:rgba(18,15,32,0.97);border:1px solid #4a3f8c;border-radius:12px;" +
    "box-shadow:0 14px 44px rgba(0,0,0,0.55);padding:10px 12px;color:#d7d2f5;" +
    "font:12px system-ui,sans-serif;backdrop-filter:blur(6px)";
  const el = (tag, style, text) => {
    const n = document.createElement(tag);
    if (style) n.style.cssText = style;
    if (text != null) n.textContent = text;
    return n;
  };
  const btn = (label, title, onclick) => {
    const b = el("button",
      "background:#241d43;border:1px solid #4a3f8c;color:#d7d2f5;border-radius:6px;" +
      "padding:4px 10px;font-size:11px;cursor:pointer;margin:2px 4px 2px 0", label);
    b.title = title;
    b.addEventListener("click", onclick);
    return b;
  };

  const head = el("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:4px");
  head.appendChild(el("div", "font-weight:800;font-size:13px;color:#cfc4ff", "🎥 Mocap — MediaPipe"));
  head.appendChild(btn("✕", "Close", () => setOpen(false)));
  panel.appendChild(head);
  panel.appendChild(el("div", "font-size:10px;color:#6f679c;margin-bottom:6px",
    "BlazePose + One Euro two-pass smoothing (zero lag). Writes keys into the timeline."));

  const srcRow = el("div", "display:flex;flex-wrap:wrap;margin-bottom:4px");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "video/*";
  fileInput.style.display = "none";
  panel.appendChild(fileInput);
  srcRow.appendChild(btn("📹 Video file", "Process a video file offline (best quality: zero-lag smoothing over the whole clip)", () => fileInput.click()));
  srcRow.appendChild(btn("📷 Webcam", "Live capture from the webcam", () => startWebcam()));
  const modelInput = document.createElement("input");
  modelInput.type = "file";
  modelInput.accept = ".task";
  modelInput.style.display = "none";
  panel.appendChild(modelInput);
  modelInput.addEventListener("change", async () => {
    const f = modelInput.files && modelInput.files[0];
    if (!f) return;
    try {
      S.userModel = await storeModelFile(f);
      S.landmarker = null; // rebuild with the new model
      say(`Model "${f.name}" stored for offline use.`);
    } catch (e) { say("Model file error: " + (e?.message || e)); }
  });
  srcRow.appendChild(btn("📦 Model…", "Pick a pose_landmarker .task file once — it is stored persistently for 100% offline mocap", () => modelInput.click()));
  const btnRec = btn("⏺ Record", "Start/stop recording the webcam performance", () => toggleRecord());
  btnRec.style.display = "none";
  srcRow.appendChild(btnRec);
  panel.appendChild(srcRow);

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = "width:100%;border-radius:8px;background:#0a0818;display:none";
  panel.appendChild(video);
  const overlay = document.createElement("canvas");
  overlay.style.cssText = "width:100%;margin-top:-4px;display:none";
  panel.appendChild(overlay);

  const progress = el("div", "height:6px;background:#241d43;border-radius:3px;margin:6px 0;display:none");
  const progressFill = el("div", "height:100%;width:0%;background:#7a5cff;border-radius:3px");
  progress.appendChild(progressFill);
  panel.appendChild(progress);

  const status = el("div", "font-size:11px;color:#9b8fd6;min-height:15px;margin:2px 0 6px", "Pick a source to begin.");
  panel.appendChild(status);
  const say = (m) => { status.textContent = m; };

  const sliderRow = (label, title, get, set, min, max, step) => {
    const row = el("div", "display:flex;align-items:center;gap:6px;margin:3px 0");
    row.title = title;
    row.appendChild(el("label", "flex:0 0 92px;color:#8f85c4;font-size:11px", label));
    const r = document.createElement("input");
    r.type = "range"; r.min = min; r.max = max; r.step = step; r.value = get();
    r.style.cssText = "flex:1";
    const v = el("span", "flex:0 0 34px;text-align:right;font-size:10px;color:#b9a8ff", String(get()));
    r.addEventListener("input", () => { set(parseFloat(r.value)); v.textContent = r.value; });
    row.appendChild(r); row.appendChild(v);
    panel.appendChild(row);
    return row;
  };
  sliderRow("Keys / sec", "Keyframe density written to the timeline", () => S.keyFps, (n) => (S.keyFps = n), 5, 30, 1);
  sliderRow("Smoothing", "One Euro min-cutoff: LOWER = smoother (less jitter), higher = snappier", () => S.smoothing, (n) => (S.smoothing = n), 0.2, 4, 0.1);
  sliderRow("Speed coef", "One Euro beta: how quickly fast motion cuts through the smoothing", () => S.beta, (n) => (S.beta = n), 0, 0.2, 0.005);
  sliderRow("Min visibility", "Landmarks below this confidence are held from the previous frame", () => S.minVis, (n) => (S.minVis = n), 0, 0.9, 0.05);

  const togRow = el("div", "display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 6px");
  const addToggle = (label, title, get, set) => {
    const lab = el("label", "display:flex;gap:4px;align-items:center;font-size:11px;cursor:pointer;color:#d7d2f5");
    lab.title = title;
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = get();
    cb.addEventListener("change", () => set(cb.checked));
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(label));
    togRow.appendChild(lab);
  };
  addToggle("Kalidokit", "Retarget engine: ON = Kalidokit (the VTuber-standard solver, recommended), OFF = classic in-house solver", () => S.engine === "kalidokit", (v) => (S.engine = v ? "kalidokit" : "classic"));
  addToggle("Mirror", "Mirror mode (webcam-natural): your left hand drives the model's left hand on screen", () => S.mirror, (v) => (S.mirror = v));
  addToggle("Flip depth", "Invert forward/backward lean if it looks reversed", () => S.flipZ, (v) => (S.flipZ = v));
  addToggle("Body", "Retarget hips + spine", () => S.groups.body, (v) => (S.groups.body = v));
  addToggle("Head", "Retarget the neck", () => S.groups.head, (v) => (S.groups.head = v));
  addToggle("Arms", "Retarget arms", () => S.groups.arms, (v) => (S.groups.arms = v));
  addToggle("Legs", "Retarget legs", () => S.groups.legs, (v) => (S.groups.legs = v));
  panel.appendChild(togRow);

  const actRow = el("div", "display:flex;flex-wrap:wrap");
  const btnApply = btn("✅ Apply to timeline", "Smooth (two-pass, zero lag), retarget and write keyframes", () => applyCapture());
  btnApply.style.display = "none";
  actRow.appendChild(btnApply);
  const btnRestore = btn("↶ Restore previous", "Bring back the keys that were on the timeline before the last Apply", () => {
    if (!S.prevKeys) return;
    bridge.replaceKeys(S.prevKeys);
    S.prevKeys = null;
    btnRestore.style.display = "none";
    say("Previous timeline restored.");
  });
  btnRestore.style.display = "none";
  actRow.appendChild(btnRestore);
  panel.appendChild(actRow);

  (getHost?.() || document.body).appendChild(panel);

  /* --------------------------- MediaPipe ------------------------------- */
  async function ensureLandmarker(runningMode) {
    if (S.landmarker && S.landmarkerMode === runningMode) return S.landmarker;
    say("Loading MediaPipe BlazePose…");
    // 1. runtime bundle: vendored first, CDN as fallback. The vendored copy
    // is named .js (NOT .mjs): common static servers ship no MIME mapping
    // for .mjs and return application/octet-stream, which browsers reject
    // for module scripts — the .mjs import silently fell through to the CDN.
    let vision;
    try {
      vision = await import(/* @vite-ignore */ `${MP_LOCAL}/vision_bundle.js`);
    } catch (_) {
      try {
        vision = await import(/* @vite-ignore */ `${MP_LOCAL}/vision_bundle.mjs`);
      } catch (_2) {
        vision = await import(/* @vite-ignore */ MP_BUNDLE);
      }
    }
    // 2. wasm: vendored first, CDN as fallback
    const wasmBase = (await urlExists(`${MP_LOCAL}/wasm/vision_wasm_internal.wasm`))
      ? `${MP_LOCAL}/wasm` : MP_WASM;
    const fileset = await vision.FilesetResolver.forVisionTasks(wasmBase);
    // 3. model: local file -> persistent cache -> one-time CDN download
    const model = S.userModel ? { modelAssetBuffer: S.userModel } : await resolveModel(say);
    if (S.landmarker) { try { S.landmarker.close(); } catch (_) {} }
    S.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { ...model, delegate: "GPU" },
      runningMode,
      numPoses: 1,
    });
    S.landmarkerMode = runningMode;
    say("BlazePose ready" + (wasmBase === MP_WASM ? " (CDN wasm)." : " (offline wasm)."));
    return S.landmarker;
  }

  function grabLandmarks(res) {
    const lm = res?.worldLandmarks?.[0];
    if (!lm || !lm.length) return null;
    const world = lm.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));
    // 2D image landmarks: Kalidokit uses them for stability/visibility
    const im = res?.landmarks?.[0];
    const lm2d = im && im.length
      ? im.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }))
      : null;
    return { world, lm2d };
  }

  /* ----------------------------- video file ---------------------------- */
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    stopWebcam();
    S.mode = "video";
    try {
      await processVideoFile(f);
    } catch (e) {
      console.error("[Mocap]", e);
      say("Error: " + (e?.message || e));
      S.processing = false;
    }
  });

  async function processVideoFile(file) {
    if (!bridge.mesh()) { say("Load a model first."); return; }
    const lmk = await ensureLandmarker("VIDEO");
    video.src = URL.createObjectURL(file);
    video.style.display = "block";
    overlay.style.display = "block";
    await new Promise((res, rej) => {
      video.onloadedmetadata = res;
      video.onerror = () => rej(new Error("cannot open this video"));
    });
    const dur = video.duration;
    const sampleFps = 30;
    S.frames = [];
    S.processing = true;
    progress.style.display = "block";
    say("Analyzing video…");
    for (let t = 0; t < dur && S.processing; t += 1 / sampleFps) {
      video.currentTime = t;
      await new Promise((res) => { video.onseeked = res; });
      const res = lmk.detectForVideo(video, Math.round(t * 1000));
      const g = grabLandmarks(res);
      if (g) S.frames.push({ t, lm: g.world, lm2d: g.lm2d });
      drawOverlay(res?.landmarks?.[0]);
      progressFill.style.width = ((t / dur) * 100).toFixed(1) + "%";
      if ((S.frames.length & 15) === 0) say(`Analyzing video… ${(t).toFixed(1)}/${dur.toFixed(1)}s · ${S.frames.length} frames`);
    }
    S.processing = false;
    progress.style.display = "none";
    say(`Captured ${S.frames.length} frames. Press Apply.`);
    btnApply.style.display = S.frames.length ? "inline-block" : "none";
  }

  /* ------------------------------ webcam ------------------------------- */
  async function startWebcam() {
    if (!bridge.mesh()) { say("Load a model first."); return; }
    try {
      stopWebcam();
      const lmk = await ensureLandmarker("VIDEO");
      S.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      video.srcObject = S.stream;
      video.style.display = "block";
      overlay.style.display = "block";
      await video.play();
      S.mode = "webcam";
      btnRec.style.display = "inline-block";
      say("Webcam live. Press ⏺ Record, perform, press it again.");
      const loop = () => {
        if (!S.stream) return;
        if (video.readyState >= 2) {
          const res = lmk.detectForVideo(video, performance.now());
          const g = grabLandmarks(res);
          drawOverlay(res?.landmarks?.[0]);
          if (g && S.recording) {
            S.frames.push({ t: performance.now() / 1000, lm: g.world, lm2d: g.lm2d });
          }
        }
        S.rafId = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      console.error("[Mocap]", e);
      say("Webcam error: " + (e?.message || e));
    }
  }
  function stopWebcam() {
    if (S.rafId) cancelAnimationFrame(S.rafId);
    S.rafId = 0;
    if (S.stream) {
      for (const tr of S.stream.getTracks()) tr.stop();
      S.stream = null;
    }
    video.srcObject = null;
    S.recording = false;
    btnRec.textContent = "⏺ Record";
    btnRec.style.display = "none";
  }
  function toggleRecord() {
    if (!S.stream) return;
    S.recording = !S.recording;
    if (S.recording) {
      S.frames = [];
      btnRec.textContent = "⏹ Stop rec";
      say("Recording… perform!");
      btnApply.style.display = "none";
    } else {
      btnRec.textContent = "⏺ Record";
      say(`Recorded ${S.frames.length} frames. Press Apply.`);
      btnApply.style.display = S.frames.length ? "inline-block" : "none";
    }
  }

  /* ------------------------- overlay skeleton -------------------------- */
  const EDGES = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [23, 24],
    [11, 23], [12, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
  function drawOverlay(imageLm) {
    if (!imageLm) return;
    const w = video.videoWidth || 640, h = video.videoHeight || 480;
    if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
    const c = overlay.getContext("2d");
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "#7a5cff"; c.lineWidth = 3; c.fillStyle = "#ffd166";
    for (const [a, b] of EDGES) {
      const p = imageLm[a], q = imageLm[b];
      if (!p || !q) continue;
      c.beginPath(); c.moveTo(p.x * w, p.y * h); c.lineTo(q.x * w, q.y * h); c.stroke();
    }
    for (const p of imageLm) {
      c.beginPath(); c.arc(p.x * w, p.y * h, 3, 0, 6.283); c.fill();
    }
  }

  /* ------------------------------ apply -------------------------------- */
  function applyCapture() {
    const mesh = bridge.mesh();
    if (!mesh?.skeleton) { say("Load a model first."); return; }
    if (!S.frames.length) { say("Nothing captured yet."); return; }
    say("Smoothing (two-pass) + retargeting…");
    try {
      const scan = scanUniversalRig(mesh);
      if (!scan?.ok && !scan?.anchors) { say("Rig scan failed on this model."); return; }
      const NEED = ["hips", "spine", "shoulderL", "elbowL", "shoulderR", "elbowR", "hipL", "kneeL", "hipR", "kneeR"];
      const have = NEED.filter((a) => scan.anchors?.[a] != null);
      console.info("[Mocap] rig anchors resolved:", have.join(", ") || "(none)");
      if (have.length < 4) {
        say("Rig anchors missing: " + NEED.filter((a) => !have.includes(a)).join(", "));
        return;
      }
      const rest = buildRestData(mesh, bridge.restOf);
      const frames = S.frames.map((f) => ({
        t: f.t,
        lm: f.lm.map((p) => ({ ...p })),
        lm2d: f.lm2d ? f.lm2d.map((p) => ({ ...p })) : null,
      }));
      const { keys, duration, disabled, flipY } = framesToKeys({
        frames, scan, bones: mesh.skeleton.bones, rest,
        opts: {
          keyFps: S.keyFps, minVis: S.minVis, mirror: S.mirror, flipZ: S.flipZ,
          groups: S.groups, engine: S.engine,
          smooth: { minCutoff: S.smoothing, beta: S.beta },
        },
      });
      console.info("[Mocap] engine:", S.engine);
      if (!keys.length) { say("Retarget produced no keys (rig anchors missing?)."); return; }
      S.prevKeys = JSON.parse(JSON.stringify(bridge.keys()));
      bridge.setPlaying(false);
      bridge.setDuration(Math.ceil(duration));
      bridge.replaceKeys(keys);
      bridge.seek(0);
      btnRestore.style.display = "inline-block";
      const notes = [];
      if (disabled?.length) notes.push(`auto-off: ${disabled.join("+")} (not visible in frame)`);
      if (flipY) notes.push("Y auto-flipped");
      say(`Done: ${keys.length} keys over ${duration.toFixed(1)}s → timeline.` +
        (notes.length ? ` [${notes.join("; ")}]` : ""));
    } catch (e) {
      console.error("[Mocap]", e);
      say("Retarget error: " + (e?.message || e));
    }
  }

  /* ----------------------------- lifecycle ----------------------------- */
  function setOpen(v) {
    S.open = !!v;
    panel.style.display = S.open ? "block" : "none";
    if (!S.open) { S.processing = false; stopWebcam(); }
  }
  function toggle() { setOpen(!S.open); }
  function dispose() {
    setOpen(false);
    if (S.landmarker) { try { S.landmarker.close(); } catch (_) {} }
    panel.remove();
  }
  return { setOpen, toggle, isOpen: () => S.open, dispose };
}
