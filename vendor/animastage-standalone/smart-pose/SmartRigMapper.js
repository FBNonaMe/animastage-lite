import { scanUniversalRig, normBoneToken, boneNameSide } from "../mmd-universal-rig.js";

const STORAGE_PREFIX = "animastage_smart_pose_rig_map_";

const JP = {
  mother: /全ての親|全親|親|母/i,
  center: /センター|中心|中心点/i,
  groove: /グルーブ|腰|胯|骨盆/i,
  lower: /下半身|下半身ＩＫ|下半身IK|骨盤|骨盆|腰/i,
  upper: /上半身(?!2)|胸|脊椎|脊柱/i,
  upper2: /上半身2|上半身２|胸2|胸２/i,
  upper3: /上半身3|上半身３|胸3|胸３/i,
  neck: /首|脖子|颈|頸/i,
  head: /頭|头/i,
  shoulder: /肩|鎖骨|锁骨/i,
  upperArm: /腕|上腕|臂/i,
  elbow: /ひじ|肘/i,
  wrist: /手首|手腕|腕首/i,
  hand: /手(?!首)|掌/i,
  leg: /足|脚|腿/i,
  knee: /ひざ|膝/i,
  ankle: /足首|脚踝/i,
  toe: /つま先|足先|脚趾|趾/i,
  eye: /目|眼/i,
};

function safeNorm(name) {
  try {
    return normBoneToken(name || "");
  } catch (_) {
    return String(name || "").toLowerCase();
  }
}

function sideMatches(name, side) {
  if (!side) return true;
  const raw = String(name || "");
  const n = safeNorm(raw);
  const detected = boneNameSide(raw);
  if (detected === side) return true;
  if (side === "L") {
    return /左|left|(^|[_\-. ])l($|[_\-. ])/i.test(raw) || /(^|_)left($|_)|(^|_)l($|_)/i.test(n);
  }
  return /右|right|(^|[_\-. ])r($|[_\-. ])/i.test(raw) || /(^|_)right($|_)|(^|_)r($|_)/i.test(n);
}

function scoreBoneName(bone, tests, side = "") {
  if (!bone?.name || !sideMatches(bone.name, side)) return 0;
  const raw = bone.name;
  const n = safeNorm(raw);
  let score = 0;
  for (const test of tests) {
    if (test instanceof RegExp) {
      if (test.test(raw) || test.test(n)) score += 10;
    } else if (typeof test === "string" && raw.toLowerCase().includes(test.toLowerCase())) {
      score += 6;
    }
  }
  if (/IK|ＩＫ|target|dummy|helper|補助|操作|先端|end/i.test(raw)) score -= 4;
  return score;
}

function findByRules(bones, tests, side = "", reject = null) {
  let best = null;
  let bestScore = 0;
  for (const bone of bones || []) {
    if (reject?.(bone)) continue;
    const score = scoreBoneName(bone, tests, side);
    if (score > bestScore) {
      best = bone;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

function firstBone(...bones) {
  return bones.find((bone) => !!bone) || null;
}

export function isBoneAncestor(ancestor, descendant) {
  if (!ancestor || !descendant) return false;
  let cur = descendant;
  let guard = 0;
  while (cur && guard++ < 256) {
    if (cur === ancestor) return true;
    cur = cur.parent?.isBone ? cur.parent : null;
  }
  return false;
}

/** Walk UP the real parent hierarchy from `startBone` and return the first
 *  ancestor whose name matches `tests` (and survives `reject`). */
export function ancestorMatching(startBone, tests, side = "", reject = null) {
  let cur = startBone?.parent?.isBone ? startBone.parent : null;
  let guard = 0;
  while (cur && guard++ < 256) {
    if (!reject?.(cur) && scoreBoneName(cur, tests, side) > 0) return cur;
    cur = cur.parent?.isBone ? cur.parent : null;
  }
  return null;
}

function repairLimbChain(limb, keys, side, midTests, startTests, startReject, notes, label) {
  if (!limb) return;
  const end = limb[keys.end] || (keys.endAlt ? limb[keys.endAlt] : null);
  if (!end) return;
  const mid = limb[keys.mid];
  const start = limb[keys.start];
  let newMid = mid;
  if (!newMid || !isBoneAncestor(newMid, end)) {
    newMid = ancestorMatching(end, midTests, side) || newMid;
  }
  let newStart = start;
  if (newMid && (!newStart || !isBoneAncestor(newStart, newMid))) {
    newStart = ancestorMatching(newMid, startTests, side, startReject) || newStart;
  }
  if (newMid !== mid || newStart !== start) {
    notes.push(`${label}: ${start?.name || "?"} > ${mid?.name || "?"} → ${newStart?.name || "?"} > ${newMid?.name || "?"} (end: ${end.name})`);
    limb[keys.mid] = newMid;
    limb[keys.start] = newStart;
    if (keys.startAlias) limb[keys.startAlias] = newStart;
  }
}

/** CHAIN CONSISTENCY REPAIR. Name-based candidates can mix the visible FK
 *  chain with D-/twist duplicates that live in a PARALLEL hierarchy (e.g.
 *  右足→右ひざ→右足首 vs 右足D→右ひざD→右足首D). The IK solver rotates
 *  ancestors, so a limb chain MUST satisfy start ⊃ mid ⊃ end in the actual
 *  bone tree — otherwise the hip/knee rotate but never carry the foot.
 *  When the picked chain is broken, re-derive mid/start by walking up the
 *  real parents of the END bone. Returns human-readable repair notes. */
export function repairSemanticChains(semantic) {
  const notes = [];
  const armMid = [JP.elbow, /elbow|fore[_\s-]?arm|lower[_\s-]?arm/i];
  const armStart = [JP.upperArm, /upper[_\s-]?arm|uparm|(^|_)arm($|_)/i];
  const armStartReject = (bone) => /捩|twist|ひじ|elbow|肩|shoulder|clavicle/i.test(bone.name || "");
  const legMid = [JP.knee, /knee|calf|lower[_\s-]?leg|shin/i];
  const legStart = [JP.leg, /thigh|upper[_\s-]?leg|upleg|(^|_)leg($|_)/i];
  const legStartReject = (bone) => /ひざ|knee|足首|ankle|IK|ＩＫ|捩|twist/i.test(bone.name || "");
  repairLimbChain(semantic.leftArm, { start: "upperArm", mid: "elbow", end: "wrist", endAlt: "hand" }, "L", armMid, armStart, armStartReject, notes, "leftArm");
  repairLimbChain(semantic.rightArm, { start: "upperArm", mid: "elbow", end: "wrist", endAlt: "hand" }, "R", armMid, armStart, armStartReject, notes, "rightArm");
  repairLimbChain(semantic.leftLeg, { start: "hip", startAlias: "upperLeg", mid: "knee", end: "ankle" }, "L", legMid, legStart, legStartReject, notes, "leftLeg");
  repairLimbChain(semantic.rightLeg, { start: "hip", startAlias: "upperLeg", mid: "knee", end: "ankle" }, "R", legMid, legStart, legStartReject, notes, "rightLeg");
  return notes;
}

function byName(bones, name) {
  if (!name) return null;
  return bones.find((bone) => bone.name === name) || null;
}

function getScanAnchor(scan, id) {
  return scan?.anchors?.[id] || null;
}

function boneIndex(bones, bone) {
  return bone ? bones.indexOf(bone) : -1;
}

function nativeIkTargetBone(bones, mmd, effectorBone, reject = null) {
  const effector = boneIndex(bones, effectorBone);
  if (effector < 0 || !Array.isArray(mmd?.iks)) return null;
  const candidates = mmd.iks.filter((ik) => ik?.effector === effector);
  const chosen = candidates.find((ik) => !reject?.(bones[ik.target], ik)) || candidates[0];
  return chosen ? bones[chosen.target] || null : null;
}

function serializeBoneMap(map) {
  const serializeBone = (bone) => bone?.name || null;
  return {
    root: serializeBone(map.root),
    center: serializeBone(map.center),
    groove: serializeBone(map.groove),
    pelvis: serializeBone(map.pelvis),
    spine: (map.spine || []).map(serializeBone).filter(Boolean),
    chest: serializeBone(map.chest),
    neck: serializeBone(map.neck),
    head: serializeBone(map.head),
    leftArm: Object.fromEntries(Object.entries(map.leftArm || {}).map(([k, v]) => [k, serializeBone(v)])),
    rightArm: Object.fromEntries(Object.entries(map.rightArm || {}).map(([k, v]) => [k, serializeBone(v)])),
    leftLeg: Object.fromEntries(Object.entries(map.leftLeg || {}).map(([k, v]) => [k, serializeBone(v)])),
    rightLeg: Object.fromEntries(Object.entries(map.rightLeg || {}).map(([k, v]) => [k, serializeBone(v)])),
    eyes: Object.fromEntries(Object.entries(map.eyes || {}).map(([k, v]) => [k, serializeBone(v)])),
  };
}

function applyOverrides(map, bones, overrides = {}) {
  const setPath = (path, name) => {
    const bone = byName(bones, name);
    if (!bone) return;
    const parts = path.split(".");
    let target = map;
    for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]] || (target[parts[i]] = {});
    target[parts[parts.length - 1]] = bone;
  };
  for (const [path, name] of Object.entries(overrides || {})) setPath(path, name);
}

export function smartRigStorageKey(modelKey = "model") {
  return STORAGE_PREFIX + String(modelKey || "model");
}

export function loadSmartRigOverrides(modelKey) {
  try {
    const raw = localStorage.getItem(smartRigStorageKey(modelKey));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.overrides || {};
  } catch (_) {
    return {};
  }
}

export function saveSmartRigMap(modelKey, map, overrides = {}) {
  try {
    localStorage.setItem(
      smartRigStorageKey(modelKey),
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        overrides,
        detected: serializeBoneMap(map),
      }),
    );
  } catch (_) {}
}

export class SmartRigMapper {
  constructor() {
    this.cache = new WeakMap();
  }

  map(mesh, options = {}) {
    if (!mesh?.skeleton?.bones?.length) return null;
    const cached = this.cache.get(mesh);
    if (cached && !options.force) return cached;

    const bones = mesh.skeleton.bones;
    let scan = null;
    try {
      scan = scanUniversalRig(mesh);
    } catch (err) {
      console.warn("[SmartPose] universal rig scan failed:", err);
    }

    const root = firstBone(
      findByRules(bones, [JP.mother, /mother|master|all[_\s-]?parent|root/i]),
      findByRules(bones, [JP.center, /center|centre|cog/i]),
      bones.find((bone) => !bone.parent?.isBone),
      bones[0],
    );
    const center = firstBone(findByRules(bones, [JP.center, /center|centre|cog/i]), root);
    const groove = findByRules(bones, [JP.groove, /groove|waist|pelvis/i]);
    const lowerBody = firstBone(
      findByRules(bones, [/下半身|lower[_\s-]?body|lowerbody/i], "", (bone) => bone === center),
      findByRules(bones, [JP.lower, /pelvis|hips?/i], "", (bone) => bone === center),
      getScanAnchor(scan, "hips"),
    );
    const pelvis = firstBone(
      lowerBody,
      findByRules(bones, [JP.lower, /lower[_\s-]?body|pelvis|hips?|waist/i], "", (bone) => bone === center),
      getScanAnchor(scan, "hips"),
      groove,
      center,
    );
    const upperBody = firstBone(findByRules(bones, [JP.upper, /upper[_\s-]?body|spine|abdomen|torso/i]), getScanAnchor(scan, "spine"));
    const upperBody2 = findByRules(bones, [JP.upper2, /upper[_\s-]?body[_\s-]?2|spine[_\s-]?2|chest/i]);
    const upperBody3 = findByRules(bones, [JP.upper3, /upper[_\s-]?body[_\s-]?3|spine[_\s-]?3|chest[_\s-]?3/i]);
    // Use the main upper-body bone as the visible Chest controller target.
    // UpperBody2 is useful for follow/compensation, but on many PMX rigs it is a
    // small additive chest bone, so direct manipulation can look like "nothing".
    const chest = firstBone(upperBody, upperBody2);
    const neck = firstBone(findByRules(bones, [JP.neck, /neck/i]), getScanAnchor(scan, "neck"));
    const head = firstBone(findByRules(bones, [JP.head, /head/i]), getScanAnchor(scan, "head"));

    const arm = (side) => {
      const suffix = side === "L" ? "L" : "R";
      const clavicle = firstBone(
        getScanAnchor(scan, `collar${suffix}`),
        findByRules(bones, [JP.shoulder, /clavicle|collar|shoulder/i], side),
      );
      const upperArm = firstBone(
        getScanAnchor(scan, `shoulder${suffix}`),
        findByRules(bones, [JP.upperArm, /upper[_\s-]?arm|uparm|(^|_)arm($|_)/i], side, (bone) => /fore|lower|elbow|wrist|hand|finger|IK|ＩＫ/i.test(bone.name)),
      );
      const elbow = firstBone(getScanAnchor(scan, `elbow${suffix}`), findByRules(bones, [JP.elbow, /elbow|fore[_\s-]?arm|lower[_\s-]?arm/i], side));
      const wrist = firstBone(getScanAnchor(scan, `wrist${suffix}`), findByRules(bones, [JP.wrist, /wrist|hand/i], side, (bone) => /finger|thumb|index|middle|ring|pinky/i.test(safeNorm(bone.name))));
      const hand = firstBone(findByRules(bones, [JP.hand, /(^|_)hand($|_)/i], side, (bone) => /finger|thumb|index|middle|ring|pinky/i.test(safeNorm(bone.name))), wrist);
      return { clavicle, shoulder: clavicle, upperArm, elbow, wrist, hand };
    };

    const leg = (side) => {
      const suffix = side === "L" ? "L" : "R";
      const hip = firstBone(
        getScanAnchor(scan, `hip${suffix}`),
        findByRules(bones, [JP.leg, /thigh|upper[_\s-]?leg|upleg|(^|_)leg($|_)/i], side, (bone) => /knee|calf|lower|ankle|foot|toe|IK|ＩＫ/i.test(bone.name)),
      );
      const knee = firstBone(getScanAnchor(scan, `knee${suffix}`), findByRules(bones, [JP.knee, /knee|calf|lower[_\s-]?leg|shin/i], side));
      const ankle = firstBone(getScanAnchor(scan, `ankle${suffix}`), findByRules(bones, [JP.ankle, /ankle|foot/i], side, (bone) => /toe|IK|ＩＫ/i.test(bone.name)));
      const toe = firstBone(getScanAnchor(scan, `toe${suffix}`), findByRules(bones, [JP.toe, /toe/i], side, (bone) => /IK|ＩＫ/i.test(bone.name)));
      const mmd = mesh.geometry?.userData?.MMD;
      const toeIK = firstBone(
        nativeIkTargetBone(bones, mmd, toe),
        findByRules(bones, [/つま先ＩＫ|つま先IK|toe[_\s-]?ik/i], side),
      );
      const footIK = firstBone(
        nativeIkTargetBone(bones, mmd, ankle, (bone) => /toe|つま先/i.test(bone?.name || "")),
        findByRules(bones, [/足ＩＫ|足IK|leg[_\s-]?ik|foot[_\s-]?ik|ankle[_\s-]?ik/i], side, (bone) => /toe|つま先|親|parent|IKP/i.test(bone.name)),
      );
      return { hip, upperLeg: hip, knee, ankle, footIK, toeIK, toe };
    };

    const leftArm = arm("L");
    const rightArm = arm("R");
    const leftLeg = leg("L");
    const rightLeg = leg("R");
    const eyes = {
      left: findByRules(bones, [JP.eye, /eye/i], "L"),
      right: findByRules(bones, [JP.eye, /eye/i], "R"),
      both: findByRules(bones, [/両目|eyes?|look/i]),
    };

    const semantic = {
      root,
      center,
      groove,
      pelvis,
      lowerBody: pelvis,
      upperBody,
      upperBody2,
      upperBody3,
      spine: [pelvis, upperBody, upperBody2, upperBody3].filter(Boolean),
      torso: [pelvis, upperBody, upperBody2, upperBody3].filter(Boolean),
      chest,
      neck,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      eyes,
    };

    const overrides = options.overrides || loadSmartRigOverrides(options.modelKey || mesh.name || "model");
    applyOverrides(semantic, bones, overrides);

    // Re-link mixed normal/D-bone chains into ONE hierarchy (see repairSemanticChains).
    const chainRepairs = repairSemanticChains(semantic);
    if (chainRepairs.length) {
      try { console.info("[SmartPose] rig · chain repair (re-linked to one hierarchy):", chainRepairs); } catch (_) {}
    }

    const missing = [];
    const required = [
      ["pelvis", semantic.pelvis],
      ["chest", semantic.chest],
      ["neck", semantic.neck],
      ["head", semantic.head],
      ["leftArm.upperArm", semantic.leftArm.upperArm],
      ["leftArm.elbow", semantic.leftArm.elbow],
      ["leftArm.wrist", semantic.leftArm.wrist],
      ["rightArm.upperArm", semantic.rightArm.upperArm],
      ["rightArm.elbow", semantic.rightArm.elbow],
      ["rightArm.wrist", semantic.rightArm.wrist],
      ["leftLeg.hip", semantic.leftLeg.hip],
      ["leftLeg.knee", semantic.leftLeg.knee],
      ["leftLeg.ankle", semantic.leftLeg.ankle],
      ["rightLeg.hip", semantic.rightLeg.hip],
      ["rightLeg.knee", semantic.rightLeg.knee],
      ["rightLeg.ankle", semantic.rightLeg.ankle],
    ];
    for (const [path, bone] of required) if (!bone) missing.push(path);

    const result = {
      ok: missing.length === 0,
      mesh,
      bones,
      scan,
      semantic,
      missing,
      overrides,
      chainRepairs,
      mirrorOf: scan?.mirrorOf || new Map(),
      confidence: Math.max(0, 1 - missing.length / required.length),
      serialized: serializeBoneMap(semantic),
    };
    saveSmartRigMap(options.modelKey || mesh.name || "model", semantic, overrides);
    this.cache.set(mesh, result);
    return result;
  }

  clear(mesh = null) {
    if (mesh) this.cache.delete(mesh);
    else this.cache = new WeakMap();
  }
}

export function createSmartRigMap(mesh, options = {}) {
  return new SmartRigMapper().map(mesh, options);
}
