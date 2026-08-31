import { scanUniversalRig } from "../mmd-universal-rig.js";
import { RIG_PROFILE_VERSION } from "./PerformanceConstants.js";
import { createPerformanceRigFingerprint } from "./PerformanceRigFingerprint.js";
import {
  classifyNameSide,
  compactPerformanceName,
  detectFingerName,
  detectJointOrdinal,
  normalizePerformanceName,
} from "./PerformanceNameNormalizer.js";

const DIGITS = ["thumb", "index", "middle", "ring", "little"];
const SIDES = ["left", "right"];
const JOINT_ROLES = ["proximal", "middle", "distal"];
const HELPER_NAME = /(?:^|[_ .-])(?:ik|target|dummy|end)(?:$|[_ .-])|ＩＫ|操作|補助|表示|先端/i;

const MORPH_RULES = Object.freeze({
  blink: [/^(?:まばたき|瞬き|blink|eyeclose|eyesclosed)$/i, /まばたき|瞬き|両目.*閉|blink|eyes?.*close/i],
  // In common MMD rigs ウィンク / ウィンク２ are left-eye alternatives.
  // Only an explicit 右/right token is safe for the right eye.
  blinkLeft: [/^(?:ウィンク(?:2|２)?|ウィンク左|ウィンク(?:2|２)左|winkleft|leftwink|blinkleft)$/i, /左.*(?:ウィンク|閉)|(?:wink|blink).*left/i],
  blinkRight: [/^(?:ウィンク右|ウィンク(?:2|２)右|winkright|rightwink|blinkright)$/i, /右.*(?:ウィンク|閉)|(?:wink|blink).*right/i],
  smile: [/^(?:笑い|笑顔|にこり|smile|happy)$/i, /笑|smile|happy|grin/i],
  angry: [/^(?:怒り|怒|angry|anger)$/i, /怒|angry|anger/i],
  sad: [/^(?:悲しい|悲しみ|悲|sad|sorrow)$/i, /悲|sad|sorrow/i],
  surprised: [/^(?:驚き|驚|びっくり|surprised?)$/i, /驚|びっくり|surpris/i],
  mouthA: [/^(?:あ|ア|a|moutha|vowela)$/i, /口.*(?:あ|ア)|mouth_?a|vowel_?a/i],
  mouthI: [/^(?:い|イ|i|mouthi|voweli)$/i, /口.*(?:い|イ)|mouth_?i|vowel_?i/i],
  mouthU: [/^(?:う|ウ|u|mouthu|vowelu)$/i, /口.*(?:う|ウ)|mouth_?u|vowel_?u/i],
  mouthE: [/^(?:え|エ|e|mouthe|vowele)$/i, /口.*(?:え|エ)|mouth_?e|vowel_?e/i],
  mouthO: [/^(?:お|オ|o|moutho|vowelo)$/i, /口.*(?:お|オ)|mouth_?o|vowel_?o/i],
  browUp: [/^(?:上|眉上|browup|eyebrowup)$/i, /眉.*上|brow.*up|eyebrow.*up/i],
  browDown: [/^(?:下|眉下|browdown|eyebrowdown)$/i, /眉.*下|brow.*down|eyebrow.*down/i],
  eyeSquint: [/^(?:細目|目細|squint)$/i, /細目|目.*細|squint/i],
  eyeWide: [/^(?:見開き|目開|eyewide|wideeyes)$/i, /見開|目.*開|eye.*wide|wide.*eye/i],
  eyeSquintLeft: [/^(?:左細目|細目左|eyesquintleft|leftsquint)$/i, /左.*(?:細目|目細)|(?:squint).*left/i],
  eyeSquintRight: [/^(?:右細目|細目右|eyesquintright|rightsquint)$/i, /右.*(?:細目|目細)|(?:squint).*right/i],
  eyeWideLeft: [/^(?:左見開き|見開き左|eyewideleft|leftwideeye)$/i, /左.*(?:見開|目開)|(?:wide).*left/i],
  eyeWideRight: [/^(?:右見開き|見開き右|eyewideright|rightwideeye)$/i, /右.*(?:見開|目開)|(?:wide).*right/i],
  pupilLarge: [/^(?:瞳大|瞳孔大|pupillarge|pupildilate)$/i, /(?:瞳|瞳孔|pupil).*(?:大|large|dilat)/i],
  pupilSmall: [/^(?:瞳小|瞳孔小|pupilsmall|pupilcontract)$/i, /(?:瞳|瞳孔|pupil).*(?:小|small|contract)/i],
  pupilLargeLeft: [/^(?:左瞳大|瞳大左|pupillargeleft)$/i, /左.*(?:瞳|瞳孔).*大|pupil.*large.*left/i],
  pupilLargeRight: [/^(?:右瞳大|瞳大右|pupillargeright)$/i, /右.*(?:瞳|瞳孔).*大|pupil.*large.*right/i],
  pupilSmallLeft: [/^(?:左瞳小|瞳小左|pupilsmallleft)$/i, /左.*(?:瞳|瞳孔).*小|pupil.*small.*left/i],
  pupilSmallRight: [/^(?:右瞳小|瞳小右|pupilsmallright)$/i, /右.*(?:瞳|瞳孔).*小|pupil.*small.*right/i],
  irisLarge: [/^(?:虹彩大|irislarge)$/i, /(?:虹彩|iris).*(?:大|large)/i],
  irisSmall: [/^(?:虹彩小|irissmall)$/i, /(?:虹彩|iris).*(?:小|small)/i],
  irisLargeLeft: [/^(?:左虹彩大|虹彩大左|irislargeleft)$/i, /左.*虹彩.*大|iris.*large.*left/i],
  irisLargeRight: [/^(?:右虹彩大|虹彩大右|irislargeright)$/i, /右.*虹彩.*大|iris.*large.*right/i],
  irisSmallLeft: [/^(?:左虹彩小|虹彩小左|irissmallleft)$/i, /左.*虹彩.*小|iris.*small.*left/i],
  irisSmallRight: [/^(?:右虹彩小|虹彩小右|irissmallright)$/i, /右.*虹彩.*小|iris.*small.*right/i],
  corneaLarge: [/^(?:角膜大|cornealarge)$/i, /(?:角膜|cornea).*(?:大|large|bulge)/i],
  corneaSmall: [/^(?:角膜小|corneasmall)$/i, /(?:角膜|cornea).*(?:小|small|flat)/i],
  corneaLargeLeft: [/^(?:左角膜大|角膜大左|cornealargeleft)$/i, /左.*角膜.*大|cornea.*large.*left/i],
  corneaLargeRight: [/^(?:右角膜大|角膜大右|cornealargeright)$/i, /右.*角膜.*大|cornea.*large.*right/i],
  corneaSmallLeft: [/^(?:左角膜小|角膜小左|corneasmallleft)$/i, /左.*角膜.*小|cornea.*small.*left/i],
  corneaSmallRight: [/^(?:右角膜小|角膜小右|corneasmallright)$/i, /右.*角膜.*小|cornea.*small.*right/i],
  eyeHighlightOn: [/^(?:目光|瞳光|ハイライト|highlighton|eyehighlight)$/i, /(?:目|瞳|eye).*(?:光|highlight)|highlight.*on/i],
  eyeHighlightOff: [/^(?:ハイライト消し|ハイライト無し|highlightoff|nohighlight)$/i, /(?:ハイライト|highlight).*(?:消|無|off)|no.*highlight/i],
  eyeHighlightOnLeft: [/^(?:左目光|左瞳光|ハイライト左|highlightleft)$/i, /左.*(?:目光|瞳光|ハイライト)|highlight.*left/i],
  eyeHighlightOnRight: [/^(?:右目光|右瞳光|ハイライト右|highlightright)$/i, /右.*(?:目光|瞳光|ハイライト)|highlight.*right/i],
  eyeHighlightOffLeft: [/^(?:左ハイライト消し|ハイライト消し左|highlightoffleft)$/i, /左.*ハイライト.*(?:消|無)|highlight.*off.*left/i],
  eyeHighlightOffRight: [/^(?:右ハイライト消し|ハイライト消し右|highlightoffright)$/i, /右.*ハイライト.*(?:消|無)|highlight.*off.*right/i],
  cheek: [/^(?:頬|ほほ|cheek)$/i, /頬|ほほ|cheek/i],
  mouthCorner: [/^(?:口角|mouthcorner)$/i, /口角|mouth.*corner|lip.*corner/i],
  tongue: [/^(?:舌|べー|tongue)$/i, /舌|tongue/i],
});

function makeBinding(role, index, target, confidence, source, extra = {}) {
  return {
    role,
    targetBoneIndex: index,
    targetBoneName: target?.name || "",
    confidence: Math.max(0, Math.min(1, confidence)),
    source: [...new Set(source)],
    ...extra,
  };
}

function worldPosition(bone) {
  const e = bone?.matrixWorld?.elements;
  return e ? [e[12], e[13], e[14]] : [0, 0, 0];
}

function distance3(a, b) {
  const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
  return Math.hypot(x, y, z);
}

function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function normalize3(a) {
  const length = Math.hypot(a[0], a[1], a[2]);
  return length > 1e-8 ? scale3(a, 1 / length) : [1, 0, 0];
}

function hierarchyDepth(index, parentIndex) {
  let depth = 0, cursor = index;
  while (cursor >= 0 && depth < parentIndex.length + 1) { cursor = parentIndex[cursor]; depth++; }
  return depth;
}

function distanceFromAncestor(index, ancestor, parentIndex) {
  let steps = 0, cursor = index;
  while (cursor >= 0 && steps <= parentIndex.length) {
    if (cursor === ancestor) return steps;
    cursor = parentIndex[cursor];
    steps++;
  }
  return Infinity;
}

function longestLinearChain(root, children, excluded, limit = 5) {
  const chain = [];
  let cursor = root;
  while (cursor >= 0 && chain.length < limit && !excluded.has(cursor)) {
    chain.push(cursor);
    const usable = children[cursor].filter((child) => !excluded.has(child));
    if (!usable.length) break;
    if (usable.length === 1) cursor = usable[0];
    else {
      usable.sort((a, b) => descendantDepth(b, children, excluded) - descendantDepth(a, children, excluded));
      cursor = usable[0];
    }
  }
  return chain;
}

function descendantDepth(root, children, excluded, limit = 6) {
  let best = 0;
  const queue = [[root, 0]];
  while (queue.length) {
    const [index, depth] = queue.shift();
    best = Math.max(best, depth);
    if (depth >= limit) continue;
    for (const child of children[index]) if (!excluded.has(child)) queue.push([child, depth + 1]);
  }
  return best;
}

function selectThreeJoints(indices) {
  if (indices.length <= 3) return indices.slice();
  return [indices[0], indices[Math.floor((indices.length - 1) / 2)], indices[indices.length - 1]];
}

function findNamedEyeBones(bones, parentIndex, side) {
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < bones.length; i++) {
    const raw = String(bones[i]?.name || "").normalize("NFKC");
    const n = compactPerformanceName(raw);
    if (/まつげ|睫|瞼|eyelid|lash|brow|眉/i.test(raw + n)) continue;
    const isEye = /両目|(^|[^a-z])目([^a-z]|$)|eye|eyeball/i.test(raw + "_" + n);
    if (!isEye) continue;
    const detectedSide = classifyNameSide(raw);
    if (side && detectedSide !== side) continue;
    if (!side && detectedSide) continue;
    let score = /両目/.test(raw) && !side ? 1 : 0.75;
    if (/(?:^|_)(?:eye|eyes)(?:_|$)/i.test(normalizePerformanceName(raw))) score += 0.12;
    score -= hierarchyDepth(i, parentIndex) * 0.0001;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best >= 0 ? { index: best, confidence: Math.min(0.98, bestScore), source: ["name", "hierarchy"] } : null;
}

function mapMorphs(mesh) {
  const dictionary = mesh?.morphTargetDictionary || {};
  const entries = Object.entries(dictionary)
    .filter(([, index]) => Number.isInteger(index) && index >= 0)
    .map(([name, index]) => ({ name, index, normalized: normalizePerformanceName(name), compact: compactPerformanceName(name) }));
  const mapped = {};
  for (const [role, rules] of Object.entries(MORPH_RULES)) {
    const hits = [];
    for (const entry of entries) {
      const raw = entry.name.normalize("NFKC");
      const text = `${raw}|${entry.normalized}|${entry.compact}`;
      let confidence = 0;
      if (rules[0].test(raw) || rules[0].test(entry.normalized) || rules[0].test(entry.compact)) confidence = 0.98;
      else if (rules[1].test(text)) confidence = 0.78;
      if (!confidence) continue;
      const side = classifyNameSide(entry.name);
      if (role === "blinkLeft" && side === "right") continue;
      if (role === "blinkRight" && side === "left") continue;
      if (/^(?:eyeSquint|eyeWide|pupilLarge|pupilSmall|irisLarge|irisSmall|corneaLarge|corneaSmall|eyeHighlightOn|eyeHighlightOff)$/.test(role) && side) continue;
      hits.push({
        role,
        targetMorphIndex: entry.index,
        targetMorphName: entry.name,
        confidence,
        weight: 1,
        source: ["name"],
      });
    }
    hits.sort((a, b) => b.confidence - a.confidence || a.targetMorphIndex - b.targetMorphIndex);
    // Side-specific controls must never sum several alternative wink morphs:
    // many PMX files ship both ウィンク and ウィンク２, which close the same
    // eye with different shapes.  Activating both looks like a bilateral blink.
    const singleTarget = /^(?:blinkLeft|blinkRight|eyeSquintLeft|eyeSquintRight|eyeWideLeft|eyeWideRight|pupil|iris|cornea|eyeHighlight)/.test(role);
    if (hits.length) mapped[role] = singleTarget ? [hits[0]] : hits;
  }
  return mapped;
}

function applyManualOverrides(profile, mesh, overrides) {
  if (!overrides || typeof overrides !== "object") return;
  const bones = mesh?.skeleton?.bones || [];
  for (const [role, indexValue] of Object.entries(overrides.boneRoles || {})) {
    const index = Number(indexValue);
    if (!Number.isInteger(index) || !bones[index]) continue;
    const binding = makeBinding(role, index, bones[index], 1, ["manual"]);
    profile.boneRoles[role] = binding;
    const match = role.match(/^(left|right)\.(thumb|index|middle|ring|little)\.(proximal|middle|distal)$/);
    if (match) {
      const [, side, digit, joint] = match;
      profile.fingers[side][digit][joint] = binding;
      const slot = JOINT_ROLES.indexOf(joint);
      if (slot >= 0) profile.fingers[side][digit].joints[slot] = binding;
    }
  }
  for (const [role, values] of Object.entries(overrides.morphRoles || {})) {
    const indices = Array.isArray(values) ? values : [values];
    const bindings = [];
    for (const value of indices) {
      const index = Number(typeof value === "object" ? value.index : value);
      const name = Object.keys(mesh?.morphTargetDictionary || {}).find((key) => mesh.morphTargetDictionary[key] === index);
      if (!Number.isInteger(index) || !name) continue;
      bindings.push({ role, targetMorphIndex: index, targetMorphName: name, confidence: 1, weight: Number(value?.weight) || 1, source: ["manual"] });
    }
    if (bindings.length) profile.morphs[role] = bindings;
    else if (values === null || (Array.isArray(values) && !values.length)) delete profile.morphs[role];
  }
}

export class UniversalPerformanceRigMapper {
  constructor(options = {}) {
    this.minimumConfidence = options.minimumConfidence ?? 0.35;
  }

  map(mesh, options = {}) {
    const fingerprint = createPerformanceRigFingerprint(mesh);
    const bones = mesh?.skeleton?.bones || [];
    const profile = {
      version: RIG_PROFILE_VERSION,
      fingerprint,
      boneCount: bones.length,
      morphCount: Object.keys(mesh?.morphTargetDictionary || {}).length,
      boneRoles: {},
      fingers: { left: {}, right: {} },
      eyes: {},
      eyeParts: { left: {}, right: {} },
      morphs: mapMorphs(mesh),
      warnings: [],
      stats: { mappedFingerJoints: 0, mappedMorphRoles: 0, averageConfidence: 0 },
    };
    for (const side of SIDES) for (const digit of DIGITS) {
      profile.fingers[side][digit] = { joints: [], proximal: null, middle: null, distal: null };
    }
    if (!bones.length) {
      profile.warnings.push({ code: "NO_SKELETON", severity: "error", message: "This model has no usable skeleton." });
      return profile;
    }

    try { mesh.updateMatrixWorld?.(true); } catch (_) {}
    const scan = scanUniversalRig(mesh, { cap: Math.max(220, bones.length) });
    const indexOf = new Map();
    for (let i = 0; i < bones.length; i++) indexOf.set(bones[i], i);
    const parentIndex = bones.map((bone) => bone?.parent?.isBone ? (indexOf.get(bone.parent) ?? -1) : -1);
    const children = Array.from({ length: bones.length }, () => []);
    for (let i = 0; i < parentIndex.length; i++) if (parentIndex[i] >= 0) children[parentIndex[i]].push(i);
    const positions = bones.map(worldPosition);

    const anchorRoles = {
      "body.head": scan.anchors?.head,
      "body.neck": scan.anchors?.neck,
      "body.chest": scan.anchors?.spine,
      "left.wrist": scan.anchors?.wristL,
      "right.wrist": scan.anchors?.wristR,
    };
    for (const [role, bone] of Object.entries(anchorRoles)) {
      const index = indexOf.get(bone);
      if (!Number.isInteger(index)) continue;
      const source = scan.anchorSource?.[role.endsWith("wrist") ? (role.startsWith("left") ? "wristL" : "wristR") : role.split(".")[1]] || "geometry";
      profile.boneRoles[role] = makeBinding(role, index, bone, source === "name" ? 0.94 : 0.72, [source, "universal-rig"]);
    }

    const excluded = new Set([...(scan.ikTargets || []), ...(scan.grantDriven || []), ...(scan.physicsBones || [])]);
    const named = { left: {}, right: {} };
    for (const side of SIDES) for (const digit of DIGITS) named[side][digit] = [];
    for (let i = 0; i < bones.length; i++) {
      if (excluded.has(i) || HELPER_NAME.test(bones[i]?.name || "")) continue;
      const digit = detectFingerName(bones[i]?.name);
      if (!digit) continue;
      let side = classifyNameSide(bones[i]?.name);
      if (!side) {
        const leftWrist = profile.boneRoles["left.wrist"]?.targetBoneIndex;
        const rightWrist = profile.boneRoles["right.wrist"]?.targetBoneIndex;
        const dl = Number.isInteger(leftWrist) ? distanceFromAncestor(i, leftWrist, parentIndex) : Infinity;
        const dr = Number.isInteger(rightWrist) ? distanceFromAncestor(i, rightWrist, parentIndex) : Infinity;
        if (Math.min(dl, dr) < Infinity) side = dl < dr ? "left" : "right";
      }
      if (!side) continue;
      named[side][digit].push(i);
    }

    for (const side of SIDES) {
      const wristIndex = profile.boneRoles[`${side}.wrist`]?.targetBoneIndex;
      const fallbackChains = Number.isInteger(wristIndex)
        ? this._findFingerChains(wristIndex, bones, children, positions, excluded, scan.metrics?.height || 1)
        : [];
      this._assignFingerChains(profile, side, wristIndex, named[side], fallbackChains, bones, parentIndex, positions);
    }

    const bothEyes = findNamedEyeBones(bones, parentIndex, null);
    const leftEye = findNamedEyeBones(bones, parentIndex, "left");
    const rightEye = findNamedEyeBones(bones, parentIndex, "right");
    for (const [role, hit] of [["both", bothEyes], ["left", leftEye], ["right", rightEye]]) {
      if (!hit) continue;
      const binding = makeBinding(`eyes.${role}`, hit.index, bones[hit.index], hit.confidence, hit.source);
      profile.eyes[role] = binding;
      profile.boneRoles[`eyes.${role}`] = binding;
    }
    const eyePartRules = {
      iris: /虹彩|iris/i,
      pupil: /瞳孔|pupil/i,
      cornea: /角膜|cornea/i,
      highlight: /ハイライト|highlight/i,
    };
    for (const side of SIDES) for (const [part, pattern] of Object.entries(eyePartRules)) {
      let best = -1, bestConfidence = 0;
      const eyeIndex = profile.eyes[side]?.targetBoneIndex;
      for (let i = 0; i < bones.length; i++) {
        const name = String(bones[i]?.name || "").normalize("NFKC");
        if (!pattern.test(name)) continue;
        const detectedSide = classifyNameSide(name);
        const inheritedSide = Number.isInteger(eyeIndex) && distanceFromAncestor(i, eyeIndex, parentIndex) < Infinity;
        if (detectedSide && detectedSide !== side) continue;
        if (!detectedSide && !inheritedSide) continue;
        const confidence = detectedSide ? 0.96 : 0.78;
        if (confidence > bestConfidence) { best = i; bestConfidence = confidence; }
      }
      if (best >= 0) {
        const role = `eyes.${side}.${part}`;
        const binding = makeBinding(role, best, bones[best], bestConfidence, [bestConfidence > 0.9 ? "name" : "hierarchy", "eye-part"]);
        profile.eyeParts[side][part] = binding;
        profile.boneRoles[role] = binding;
      }
    }

    applyManualOverrides(profile, mesh, options.overrides);
    this._validate(profile);
    return profile;
  }

  _findFingerChains(wristIndex, bones, children, positions, excluded, height) {
    let roots = children[wristIndex].filter((index) => !excluded.has(index));
    if (roots.length < 3) {
      for (const child of roots.slice()) {
        const grandchildren = children[child].filter((index) => !excluded.has(index));
        if (grandchildren.length >= 3) roots = grandchildren;
      }
    }
    const wristPosition = positions[wristIndex];
    const chains = [];
    for (const root of roots) {
      const joints = longestLinearChain(root, children, excluded, 5)
        .filter((index) => !HELPER_NAME.test(bones[index]?.name || ""));
      if (!joints.length) continue;
      const tip = positions[joints[joints.length - 1]];
      const length = distance3(wristPosition, tip);
      if (length < height * 0.003 || length > height * 0.28) continue;
      chains.push({
        joints,
        digit: joints.map((index) => detectFingerName(bones[index]?.name)).find(Boolean) || null,
        tip,
        length,
        direction: normalize3(sub3(tip, wristPosition)),
      });
    }
    return chains;
  }

  _assignFingerChains(profile, side, wristIndex, namedGroups, fallbackChains, bones, parentIndex, positions) {
    const used = new Set();
    const chainsByDigit = {};
    for (const digit of DIGITS) {
      const indices = namedGroups[digit].slice();
      indices.sort((a, b) => {
        const da = Number.isInteger(wristIndex) ? distanceFromAncestor(a, wristIndex, parentIndex) : hierarchyDepth(a, parentIndex);
        const db = Number.isInteger(wristIndex) ? distanceFromAncestor(b, wristIndex, parentIndex) : hierarchyDepth(b, parentIndex);
        const oa = detectJointOrdinal(bones[a]?.name), ob = detectJointOrdinal(bones[b]?.name);
        if (oa != null && ob != null && oa !== ob) return oa - ob;
        return da - db;
      });
      const unique = indices.filter((index) => !used.has(index));
      if (unique.length) {
        chainsByDigit[digit] = unique.slice(0, 5);
        for (const index of chainsByDigit[digit]) used.add(index);
      }
    }

    for (const chain of fallbackChains) {
      if (!chain.digit || chainsByDigit[chain.digit]) continue;
      chainsByDigit[chain.digit] = chain.joints;
      chain.joints.forEach((index) => used.add(index));
    }
    const unassigned = fallbackChains.filter((chain) => !chain.joints.some((index) => used.has(index)));
    const missing = DIGITS.filter((digit) => !chainsByDigit[digit]);
    if (unassigned.length && missing.length) {
      let forward = [0, 0, 0];
      for (const chain of unassigned) forward = add3(forward, chain.direction);
      forward = normalize3(forward);
      let thumb = unassigned[0];
      let thumbScore = -Infinity;
      for (const chain of unassigned) {
        const divergence = 1 - dot3(chain.direction, forward);
        const score = divergence * 2 - chain.length;
        if (score > thumbScore) { thumbScore = score; thumb = chain; }
      }
      if (missing.includes("thumb")) {
        chainsByDigit.thumb = thumb.joints;
        thumb.joints.forEach((index) => used.add(index));
      }
      const others = unassigned.filter((chain) => chain !== thumb && !chain.joints.some((index) => used.has(index)));
      const wristPosition = Number.isInteger(wristIndex) ? positions[wristIndex] : [0, 0, 0];
      const thumbVector = sub3(thumb.tip, wristPosition);
      others.sort((a, b) => distance3(sub3(a.tip, wristPosition), thumbVector) - distance3(sub3(b.tip, wristPosition), thumbVector));
      for (const digit of ["index", "middle", "ring", "little"]) {
        if (chainsByDigit[digit] || !others.length) continue;
        chainsByDigit[digit] = others.shift().joints;
      }
    }

    for (const digit of DIGITS) {
      const allIndices = chainsByDigit[digit] || [];
      const chosen = selectThreeJoints(allIndices);
      for (let slot = 0; slot < chosen.length; slot++) {
        const index = chosen[slot];
        const jointRole = JOINT_ROLES[Math.min(slot, 2)];
        const namedEvidence = detectFingerName(bones[index]?.name) === digit;
        const sideEvidence = classifyNameSide(bones[index]?.name) === side;
        const confidence = namedEvidence ? (sideEvidence ? 0.98 : 0.88) : 0.56;
        const source = namedEvidence ? ["name", "hierarchy"] : ["hierarchy", "position"];
        const role = `${side}.${digit}.${jointRole}`;
        const binding = makeBinding(role, index, bones[index], confidence, source, { chainLength: allIndices.length });
        profile.fingers[side][digit].joints.push(binding);
        profile.fingers[side][digit][jointRole] = binding;
        profile.boneRoles[role] = binding;
      }
    }
  }

  _validate(profile) {
    const confidence = [];
    for (const side of SIDES) {
      if (!profile.boneRoles[`${side}.wrist`]) {
        profile.warnings.push({ code: "MISSING_WRIST", side, severity: "warning", message: `No ${side} wrist could be mapped.` });
      }
      let sideJoints = 0;
      for (const digit of DIGITS) {
        const joints = profile.fingers[side][digit].joints;
        sideJoints += joints.length;
        for (const binding of joints) confidence.push(binding.confidence);
        if (!joints.length) profile.warnings.push({ code: "MISSING_FINGER", side, digit, severity: "info", message: `No ${side} ${digit} finger chain was found.` });
      }
      if (!sideJoints) profile.warnings.push({ code: "NO_FINGERS", side, severity: "warning", message: `This model has no usable ${side} finger chains.` });
      profile.stats.mappedFingerJoints += sideJoints;
    }
    profile.stats.mappedMorphRoles = Object.keys(profile.morphs).length;
    if (!profile.morphs.blink && !(profile.morphs.blinkLeft && profile.morphs.blinkRight)) {
      profile.warnings.push({ code: "MISSING_BLINK", severity: "warning", message: "This model has no mapped blink morph." });
    } else if (!profile.morphs.blinkLeft || !profile.morphs.blinkRight) {
      profile.warnings.push({ code: "SYMMETRIC_BLINK", severity: "info", message: "Separate left/right blink morphs are unavailable; symmetric blink will be used." });
    }
    if (!["mouthA", "mouthI", "mouthU", "mouthE", "mouthO"].some((role) => profile.morphs[role])) {
      profile.warnings.push({ code: "MISSING_MOUTH", severity: "warning", message: "This model has no mapped MMD vowel morphs." });
    }
    for (const values of Object.values(profile.morphs)) for (const binding of values) confidence.push(binding.confidence);
    profile.stats.averageConfidence = confidence.length ? confidence.reduce((sum, value) => sum + value, 0) / confidence.length : 0;
  }
}

export function describePerformanceRig(profile) {
  return {
    fingerprint: profile?.fingerprint || null,
    bones: profile?.boneCount || 0,
    morphs: profile?.morphCount || 0,
    mappedFingerJoints: profile?.stats?.mappedFingerJoints || 0,
    mappedMorphRoles: profile?.stats?.mappedMorphRoles || 0,
    averageConfidence: Number(profile?.stats?.averageConfidence || 0).toFixed(3),
    warnings: (profile?.warnings || []).map((warning) => warning.message),
  };
}
