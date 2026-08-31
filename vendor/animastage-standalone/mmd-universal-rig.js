// mmd-universal-rig.js
// Universal, name-agnostic skeleton scanner for MMD (PMX/PMD) models.
//
// Classic MMD rigs use Japanese semantic names (センター, 左腕, 右ひざ...).
// Modern game-rip conversions keep arbitrary names (Ctr_L_ClawA_00, Bip001,
// mixamorig:Hips, bone_017, 左手 CN, ...) — name-based scanners see nothing.
//
// This scanner trusts, in order:
//   1. Hard data  — skin weights (which bones actually deform the mesh) and
//                   MMD metadata (IK targets, grant-driven bones, physics bodies).
//   2. Names      — JP / EN / CN dictionaries + common rig conventions.
//   3. Geometry   — symmetric limb chains, height bands, hierarchy LCA.
//                   Finds hips/spine/neck/head/arms/legs with zero name info.
//   4. Guarantee  — the viewport handle list is NEVER empty for a skeleton.
//
// No imports: works with any three.js instance (reads matrixWorld directly).

const EPS_W = 1e-4;
const MAX_CHAIN = 64;

/* ------------------------------------------------------------------ names */

export function normBoneToken(name) {
  return String(name || '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

export function boneNameSide(name) {
  const raw = String(name || '');
  const n = normBoneToken(raw);
  const left = /左/.test(raw)
    || /(^|_)l($|_)|(^|_)left($|_)/i.test(n)
    || /(\.l$|_l_|^l_|_l$)/i.test(raw);
  const right = /右/.test(raw)
    || /(^|_)r($|_)|(^|_)right($|_)/i.test(n)
    || /(\.r$|_r_|^r_|_r$)/i.test(raw);
  if (left && !right) return 'L';
  if (right && !left) return 'R';
  return '';
}

// JP / EN / CN token dictionaries per anchor. `jp` tests the raw name (CJK),
// `tok` tests the normalized token string. Order = priority.
const ANCHOR_DEFS = [
  { id: 'hips',      jp: /下半身|センター|腰|胯|骨盆/, tok: /(lower_?body|pelvis|hips?|waist|cog|center|centre|root|mother)/i },
  { id: 'spine',     jp: /上半身2|上半身|胸|脊椎|脊柱/, tok: /(upper_?body_?2|upper_?body|spine|chest|torso|abdomen|body)/i },
  { id: 'neck',      jp: /首|脖子|颈|頸/,             tok: /(^|_)neck($|_)/i },
  { id: 'head',      jp: /頭|头/,                     tok: /(^|_)head($|_)/i },
  { id: 'collarL',   jp: /左肩|左鎖骨/, side: 'L',    tok: /(clavicle|collar|shoulder)/i },
  { id: 'collarR',   jp: /右肩|右鎖骨/, side: 'R',    tok: /(clavicle|collar|shoulder)/i },
  { id: 'shoulderL', jp: /左腕|左臂/,   side: 'L',    tok: /(upper_?arm|uparm|(^|_)arm($|_))/i },
  { id: 'shoulderR', jp: /右腕|右臂/,   side: 'R',    tok: /(upper_?arm|uparm|(^|_)arm($|_))/i },
  { id: 'elbowL',    jp: /左ひじ|左肘/, side: 'L',    tok: /(elbow|fore_?arm|lower_?arm)/i },
  { id: 'elbowR',    jp: /右ひじ|右肘/, side: 'R',    tok: /(elbow|fore_?arm|lower_?arm)/i },
  { id: 'wristL',    jp: /左手首|左手腕/, side: 'L',  tok: /(wrist|(^|_)hand($|_))/i },
  { id: 'wristR',    jp: /右手首|右手腕/, side: 'R',  tok: /(wrist|(^|_)hand($|_))/i },
  { id: 'hipL',      jp: /左足(?!首|先)|左腿|左大腿/, side: 'L', tok: /(thigh|upper_?leg|upleg|(^|_)leg($|_))/i },
  { id: 'hipR',      jp: /右足(?!首|先)|右腿|右大腿/, side: 'R', tok: /(thigh|upper_?leg|upleg|(^|_)leg($|_))/i },
  { id: 'kneeL',     jp: /左ひざ|左膝/, side: 'L',    tok: /(knee|calf|lower_?leg|shin)/i },
  { id: 'kneeR',     jp: /右ひざ|右膝/, side: 'R',    tok: /(knee|calf|lower_?leg|shin)/i },
  { id: 'ankleL',    jp: /左足首|左脚踝|左足[^先]*首/, side: 'L', tok: /(ankle|(^|_)foot($|_))/i },
  { id: 'ankleR',    jp: /右足首|右脚踝/, side: 'R',  tok: /(ankle|(^|_)foot($|_))/i },
  { id: 'toeL',      jp: /左つま先|左足先|左脚趾/, side: 'L', tok: /(^|_)toe/i },
  { id: 'toeR',      jp: /右つま先|右足先|右脚趾/, side: 'R', tok: /(^|_)toe/i },
];

const CHAIN_DEFS = [
  ['hips', 'spine', 'neck', 'head'],
  ['spine', 'collarL', 'shoulderL', 'elbowL', 'wristL'],
  ['spine', 'collarR', 'shoulderR', 'elbowR', 'wristR'],
  ['hips', 'hipL', 'kneeL', 'ankleL', 'toeL'],
  ['hips', 'hipR', 'kneeR', 'ankleR', 'toeR'],
];

const REGION_OF_ANCHOR = {
  hips: 'root', spine: 'spine', neck: 'head', head: 'head',
  collarL: 'armL', shoulderL: 'armL', elbowL: 'armL', wristL: 'armL',
  collarR: 'armR', shoulderR: 'armR', elbowR: 'armR', wristR: 'armR',
  hipL: 'legL', kneeL: 'legL', ankleL: 'legL', toeL: 'legL',
  hipR: 'legR', kneeR: 'legR', ankleR: 'legR', toeR: 'legR',
};

const HELPER_NAME = /ＩＫ|(^|[_\-. ])ik($|[_\-. ])|target|dummy|dumm|(^|[_\-. ])end($|[_\-. ])|操作|補助|表示|先端/i;
const TWIST_NAME = /捩|twist|[WＷ]$/;

/* --------------------------------------------------------------- scanning */

export function scanUniversalRig(mesh, opts = {}) {
  const cap = opts.cap ?? 220;
  const empty = {
    ok: false, bones: [], handles: [], anchors: {}, anchorSource: {},
    regionOf: new Map(), mirrorOf: new Map(), deformWeight: null,
    ikTargets: new Set(), grantDriven: new Set(), physicsBones: new Set(),
    metrics: null, jpAlias: new Map(), semanticIndex: new Map(), restY: new Map(),
  };
  const skeleton = mesh?.skeleton;
  const bones = skeleton?.bones;
  if (!bones?.length) return empty;

  try { mesh.updateMatrixWorld?.(true); } catch (_) { /* keep going */ }

  const N = bones.length;
  const idxOf = new Map();
  bones.forEach((b, i) => idxOf.set(b, i));

  // Rest-pose world positions straight from matrixWorld (no THREE needed).
  const wp = new Array(N);
  for (let i = 0; i < N; i++) {
    const e = bones[i]?.matrixWorld?.elements;
    wp[i] = e ? [e[12], e[13], e[14]] : [0, 0, 0];
  }

  const parentIdx = bones.map(b => (b.parent && b.parent.isBone) ? (idxOf.get(b.parent) ?? -1) : -1);
  const childIdx = Array.from({ length: N }, () => []);
  parentIdx.forEach((p, i) => { if (p >= 0) childIdx[p].push(i); });

  /* -- 1. hard data: skin weights ------------------------------------- */
  const dw = new Float64Array(N);
  const si = mesh.geometry?.attributes?.skinIndex;
  const sw = mesh.geometry?.attributes?.skinWeight;
  if (si && sw && si.count === sw.count) {
    const cnt = si.count;
    for (let v = 0; v < cnt; v++) {
      let bi = si.getX(v), w = sw.getX(v); if (w > 0 && bi >= 0 && bi < N) dw[bi] += w;
      bi = si.getY(v); w = sw.getY(v); if (w > 0 && bi >= 0 && bi < N) dw[bi] += w;
      bi = si.getZ(v); w = sw.getZ(v); if (w > 0 && bi >= 0 && bi < N) dw[bi] += w;
      bi = si.getW(v); w = sw.getW(v); if (w > 0 && bi >= 0 && bi < N) dw[bi] += w;
    }
  }
  const isDeform = i => dw[i] > EPS_W;
  const anyDeform = dw.some(w => w > EPS_W);

  // hasDeformDesc[i] = bone i has (or is) a deform bone in its subtree.
  const hasDeformDesc = new Uint8Array(N);
  {
    const order = topoOrder(parentIdx, childIdx);
    for (let k = order.length - 1; k >= 0; k--) {
      const i = order[k];
      let v = isDeform(i) ? 1 : 0;
      if (!v) for (const c of childIdx[i]) if (hasDeformDesc[c]) { v = 1; break; }
      hasDeformDesc[i] = v;
    }
  }

  /* -- 1b. hard data: MMD metadata ------------------------------------ */
  const mmd = mesh.geometry?.userData?.MMD || {};
  const ikTargets = new Set();
  const ikEffectors = new Set();
  for (const ik of mmd.iks || []) {
    if (Number.isInteger(ik.target)) ikTargets.add(ik.target);
    if (Number.isInteger(ik.effector)) ikEffectors.add(ik.effector);
  }
  const grantDriven = new Set();
  for (const g of mmd.grants || []) {
    if (!g.isLocal && (g.affectRotation || g.affectPosition) && Number.isInteger(g.index)) {
      grantDriven.add(g.index);
    }
  }
  const physicsBones = new Set();
  (mmd.bones || []).forEach((b, i) => {
    if (b && b.rigidBodyType === 1 && i < N) physicsBones.add(i);
  });

  // Name-based extra hints for W/twist duplicates (only when a base bone exists).
  const byName = new Map();
  bones.forEach((b, i) => byName.set(b.name, i));
  bones.forEach((b, i) => {
    if (/[WＷ]$/.test(b.name) && byName.has(b.name.slice(0, -1))) grantDriven.add(i);
    else if (/捩|twist/i.test(b.name)) grantDriven.add(i);
  });

  /* -- metrics --------------------------------------------------------- */
  const coreIdx = [];
  for (let i = 0; i < N; i++) {
    if (ikTargets.has(i)) continue;
    if (anyDeform ? hasDeformDesc[i] : true) coreIdx.push(i);
  }
  const pool = coreIdx.length ? coreIdx : bones.map((_, i) => i);
  let minY = Infinity, maxY = -Infinity;
  const xs = [], zs = [];
  for (const i of pool) {
    const [x, y, z] = wp[i];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    xs.push(x); zs.push(z);
  }
  const H = Math.max(1e-6, maxY - minY);
  const cx = median(xs), cz = median(zs);
  const metrics = { minY, maxY, height: H, centerX: cx, centerZ: cz };
  const flat = H < 1e-5; // degenerate skeleton — skip geometric passes

  const sideOfIdx = i => {
    const off = wp[i][0] - cx;
    return off > 0.01 * H ? 'L' : off < -0.01 * H ? 'R' : '';
  };

  /* -- 2. anchors by name ---------------------------------------------- */
  const anchors = {};       // id -> bone index
  const anchorSource = {};  // id -> 'name' | 'geometry'
  for (const def of ANCHOR_DEFS) {
    const found = findAnchorByName(bones, def, N);
    if (found >= 0) { anchors[def.id] = found; anchorSource[def.id] = 'name'; }
  }

  /* -- 3. anchors by geometry (fill the gaps) -------------------------- */
  if (!flat) {
    try {
      geometricAnchors({
        bones, N, wp, parentIdx, childIdx, dw, isDeform, hasDeformDesc,
        ikTargets, physicsBones, grantDriven, minY, maxY, H, cx, cz,
        anchors, anchorSource, sideOfIdx,
      });
    } catch (err) {
      // Geometry pass must never break scanning.
      if (typeof console !== 'undefined') console.warn('[UniversalRig] geometric pass failed:', err);
    }
  }

  /* -- regions ---------------------------------------------------------- */
  const region = new Array(N).fill('');
  // Paint anchor chain paths first.
  for (const chain of CHAIN_DEFS) {
    for (let s = 0; s < chain.length - 1; s++) {
      const a = anchors[chain[s]], b = anchors[chain[s + 1]];
      if (a === undefined || b === undefined) continue;
      const seg = chainBetween(b, a, parentIdx);
      const reg = REGION_OF_ANCHOR[chain[s + 1]] || 'other';
      for (const i of seg) if (!region[i]) region[i] = reg;
    }
  }
  for (const [id, i] of Object.entries(anchors)) {
    if (!region[i]) region[i] = REGION_OF_ANCHOR[id] || 'other';
  }
  // Propagate down the hierarchy; physics chains become 'accessory'.
  {
    const order = topoOrder(parentIdx, childIdx);
    for (const i of order) {
      if (region[i]) continue;
      if (physicsBones.has(i)) { region[i] = 'accessory'; continue; }
      const p = parentIdx[i];
      if (p >= 0 && region[p] && region[p] !== 'accessory') region[i] = region[p];
    }
  }
  /* -- structural leg-IK classification + JP semantic aliases ----------- */
  // In every MMD model the leg/toe IK effectors sit at the very bottom of the
  // skeleton — a naming-independent invariant. Classify those chains as legs
  // and give their bones canonical Japanese aliases so ALL legacy name-based
  // logic (foot-IK exclusion, limits, auto-pose gates, foot planting) runs
  // through the exact same battle-tested path as Japanese-named models.
  const jpAlias = new Map();       // real bone name -> canonical JP semantic name
  const semanticIndex = new Map(); // canonical JP name -> real bone name
  // Fence: a bone whose own name already carries ANY Japanese semantics is
  // legacy territory — never alias it, the name-based logic handles it as-is.
  const JP_SEMANTIC = /センター|グルーブ|全ての親|上半身|下半身|腰|首|頭|肩|腕|ひじ|肘|手首|指|足|脚|ひざ|膝|つま先|ＩＫ/;
  const setAlias = (i, jp) => {
    if (i === undefined || i < 0 || i >= N || !jp) return;
    const nm = bones[i].name;
    if (!nm || nm.includes(jp) || JP_SEMANTIC.test(nm)) return;
    if (!jpAlias.has(nm)) jpAlias.set(nm, jp);
    if (!semanticIndex.has(jp)) semanticIndex.set(jp, nm);
  };
  if (!flat) {
    for (const ik of mmd.iks || []) {
      const eff = ik.effector;
      if (!Number.isInteger(eff) || eff < 0 || eff >= N) continue;
      const effY = wp[eff][1];
      if (effY > minY + 0.35 * H) continue; // arm/torso corrective IK — keep as-is
      const side = wp[eff][0] >= cx ? 'L' : 'R';
      const reg = 'leg' + side;
      const involved = [ik.target, ik.effector, ...(ik.links || []).map(l => l.index)];
      for (const i of involved) {
        if (!Number.isInteger(i) || i < 0 || i >= N) continue;
        if (!region[i] || region[i] === 'other' || region[i] === 'accessory') region[i] = reg;
      }
      if (Number.isInteger(ik.target) && ik.target >= 0 && ik.target < N) {
        const ankleI = anchors['ankle' + side];
        const isToe = ankleI !== undefined ? effY < wp[ankleI][1] - 1e-6 : effY < minY + 0.04 * H;
        setAlias(ik.target, side === 'L'
          ? (isToe ? '左つま先ＩＫ' : '左足ＩＫ')
          : (isToe ? '右つま先ＩＫ' : '右足ＩＫ'));
      }
    }
  }
  const JP_OF_ANCHOR = {
    hips: '下半身', spine: '上半身', neck: '首', head: '頭',
    collarL: '左肩', shoulderL: '左腕', elbowL: '左ひじ', wristL: '左手首',
    collarR: '右肩', shoulderR: '右腕', elbowR: '右ひじ', wristR: '右手首',
    hipL: '左足', kneeL: '左ひざ', ankleL: '左足首', toeL: '左つま先',
    hipR: '右足', kneeR: '右ひざ', ankleR: '右足首', toeR: '右つま先',
  };
  for (const [id, i] of Object.entries(anchors)) setAlias(i, JP_OF_ANCHOR[id]);
  if (anchors.hips !== undefined) {
    let r = anchors.hips, guard = 0;
    while (parentIdx[r] >= 0 && guard++ < MAX_CHAIN) r = parentIdx[r];
    if (r !== anchors.hips) setAlias(r, 'センター');
  }

  const restY = new Map();
  bones.forEach((b, i) => restY.set(b.name, wp[i][1]));

  const regionOf = new Map();
  bones.forEach((b, i) => { if (region[i]) regionOf.set(b.name, region[i]); });

  /* -- mirror map -------------------------------------------------------- */
  const mirrorOf = buildMirrorMap(bones, wp, parentIdx, cx, H, byName);

  /* -- 4. viewport handles (guaranteed non-empty) ------------------------ */
  const handles = buildHandles({
    bones, N, wp, parentIdx, childIdx, dw, isDeform, hasDeformDesc,
    ikTargets, grantDriven, physicsBones, anchors, cap,
  });

  return {
    ok: true, bones, handles, anchors: mapAnchorsToBones(anchors, bones), anchorSource,
    regionOf, mirrorOf, deformWeight: dw,
    ikTargets, grantDriven, physicsBones, metrics,
    jpAlias, semanticIndex, restY,
  };
}

/* ------------------------------------------------------------ name pass */

function findAnchorByName(bones, def, N) {
  let best = -1, bestScore = -1;
  for (let i = 0; i < N; i++) {
    const raw = bones[i].name || '';
    if (HELPER_NAME.test(raw) || TWIST_NAME.test(raw)) continue;
    const n = normBoneToken(raw);
    const side = boneNameSide(raw);
    if (def.side && side !== def.side) continue;
    if (!def.side && side) continue;
    let score = -1;
    if (def.jp && def.jp.test(raw)) score = 2;
    else if (def.tok && def.tok.test(n)) score = 1;
    if (score > bestScore) { bestScore = score; best = i; }
    if (score === 2) break; // exact JP hit — take it
  }
  return bestScore >= 0 ? best : -1;
}

/* -------------------------------------------------------- geometry pass */

function geometricAnchors(ctx) {
  const {
    N, wp, parentIdx, childIdx, isDeform, hasDeformDesc, ikTargets,
    physicsBones, minY, H, cx, anchors, anchorSource, sideOfIdx,
  } = ctx;

  const need = id => anchors[id] === undefined;
  const setA = (id, i) => {
    if (i === undefined || i < 0 || anchors[id] !== undefined) return;
    anchors[id] = i; anchorSource[id] = 'geometry';
  };
  const usable = i => !ikTargets.has(i) && !physicsBones.has(i) && hasDeformDesc[i];

  const pathUp = (i) => {
    const p = [];
    while (i >= 0 && p.length < MAX_CHAIN) { p.push(i); i = parentIdx[i]; }
    return p;
  };
  const lcaOf = (a, b) => {
    const seen = new Set(pathUp(a));
    let j = b, guard = 0;
    while (j >= 0 && guard++ < MAX_CHAIN) { if (seen.has(j)) return j; j = parentIdx[j]; }
    return -1;
  };
  const dist = (a, b) => {
    const [x1, y1, z1] = wp[a], [x2, y2, z2] = wp[b];
    return Math.hypot(x2 - x1, y2 - y1, z2 - z1);
  };

  /* legs: lowest usable deform bone per side, chain climbs to the pelvis */
  const legEnd = {};
  for (const side of ['L', 'R']) {
    let end = -1, endY = Infinity;
    for (let i = 0; i < N; i++) {
      if (!usable(i) || !isDeform(i)) continue;
      if (sideOfIdx(i) !== side) continue;
      const y = wp[i][1];
      if (y > minY + 0.25 * H) continue;
      if (y < endY) { endY = y; end = i; }
    }
    if (end >= 0) legEnd[side] = end;
  }

  let pelvis = -1;
  if (legEnd.L !== undefined && legEnd.R !== undefined) {
    pelvis = lcaOf(legEnd.L, legEnd.R);
  }

  for (const side of ['L', 'R']) {
    const end = legEnd[side];
    if (end === undefined) continue;
    const path = pathUp(end); // [end .. root]
    // top of the leg = bone right below the pelvis (or highest same-side bone)
    let top = -1;
    if (pelvis >= 0) {
      const at = path.indexOf(pelvis);
      if (at > 0) top = path[at - 1];
    }
    if (top < 0) {
      for (const i of path) { if (sideOfIdx(i) === side) top = i; else break; }
    }
    if (top < 0) continue;
    // prefer the first deform bone walking down from the top (skip helper roots)
    let hip = top, walk = top, guard = 0;
    while (walk >= 0 && guard++ < MAX_CHAIN) {
      if (isDeform(walk)) { hip = walk; break; }
      const next = childIdx[walk].find(c => path.includes(c));
      if (next === undefined) break;
      walk = next;
    }
    const chain = path.slice(0, path.indexOf(hip) + 1); // [end .. hip]
    const hipY = wp[hip][1];
    const ankle = nearestByY(chain, wp, minY + 0.06 * H, isDeform);
    const knee = nearestByY(chain.filter(i => wp[i][1] > wp[ankle >= 0 ? ankle : end][1] + 0.02 * H),
      wp, (hipY + (ankle >= 0 ? wp[ankle][1] : minY)) / 2, isDeform);
    let toe = -1;
    if (ankle >= 0) {
      let tY = Infinity;
      for (const i of subtreeOf(ankle, childIdx)) {
        if (i === ankle || !isDeform(i)) continue;
        if (wp[i][1] < tY) { tY = wp[i][1]; toe = i; }
      }
    }
    setA('hip' + side, hip);
    setA('knee' + side, knee);
    setA('ankle' + side, ankle);
    setA('toe' + side, toe);
  }
  if (need('hips') && pelvis >= 0) {
    const y = wp[pelvis][1];
    if (y > minY + 0.2 * H && y < minY + 0.75 * H) setA('hips', pelvis);
  }

  /* arms: most lateral usable deform bone per side above the waist */
  const armEnd = {};
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? 1 : -1;
    let end = -1, ext = -Infinity;
    for (let i = 0; i < N; i++) {
      if (!usable(i) || !isDeform(i)) continue;
      const off = (wp[i][0] - cx) * sign;
      if (off < 0.12 * H) continue;
      if (wp[i][1] < minY + 0.45 * H) continue;
      if (off > ext) { ext = off; end = i; }
    }
    if (end >= 0) armEnd[side] = end;
  }

  const shoulderTop = {};
  for (const side of ['L', 'R']) {
    const end = armEnd[side];
    if (end === undefined) continue;
    const sign = side === 'L' ? 1 : -1;
    const path = pathUp(end);
    // arm chain = suffix of path still clearly off-center
    const chain = []; // [end .. collar-ish]
    for (const i of path) {
      if ((wp[i][0] - cx) * sign < 0.015 * H) break;
      chain.push(i);
      if (chain.length >= MAX_CHAIN) break;
    }
    if (!chain.length) continue;
    const torsoSide = chain[chain.length - 1]; // closest to torso
    shoulderTop[side] = torsoSide;
    // wrist: deepest chain bone with a finger fork (>=3 bone children)
    let wrist = -1;
    for (const i of chain) { if (childIdx[i].length >= 3) { wrist = i; break; } }
    if (wrist < 0) {
      // no finger fork — take ~78% along the chain from torso to end
      const at = Math.max(0, Math.min(chain.length - 1, Math.round((chain.length - 1) * 0.22)));
      wrist = chain[at];
    }
    // upper arm: first chain bone (from torso) clearly away from the body
    let upper = -1;
    for (let k = chain.length - 1; k >= 0; k--) {
      const i = chain[k];
      if ((wp[i][0] - cx) * sign > 0.05 * H && isDeform(i)) { upper = i; break; }
    }
    if (upper < 0) upper = torsoSide;
    // collar: chain parent of the upper arm, if still on the chain
    const upAt = chain.indexOf(upper);
    const collar = (upAt >= 0 && upAt + 1 < chain.length) ? chain[upAt + 1] : -1;
    // elbow: chain bone nearest the arc midpoint between upper and wrist
    let elbow = -1;
    const wAt = chain.indexOf(wrist);
    if (upAt > wAt && wAt >= 0) {
      const seg = chain.slice(wAt, upAt + 1); // [wrist .. upper]
      let total = 0;
      const acc = [0];
      for (let k = 1; k < seg.length; k++) { total += dist(seg[k - 1], seg[k]); acc.push(total); }
      let bestD = Infinity;
      for (let k = 1; k < seg.length - 1; k++) {
        if (!isDeform(seg[k])) continue;
        const d = Math.abs(acc[k] - total / 2);
        if (d < bestD) { bestD = d; elbow = seg[k]; }
      }
    }
    setA('shoulder' + side, upper);
    setA('collar' + side, collar);
    setA('elbow' + side, elbow);
    setA('wrist' + side, wrist);
  }

  /* spine / neck / head */
  let chest = -1;
  const sL = anchors.shoulderL ?? shoulderTop.L;
  const sR = anchors.shoulderR ?? shoulderTop.R;
  if (sL !== undefined && sR !== undefined && sL >= 0 && sR >= 0) chest = lcaOf(sL, sR);
  if (need('spine') && chest >= 0) setA('spine', chest);

  if (chest >= 0) {
    // climb up from the chest through near-center bones
    const centerish = i => Math.abs(wp[i][0] - cx) < 0.06 * H;
    const ups = [];
    let cur = chest, guard = 0;
    while (guard++ < MAX_CHAIN) {
      let next = -1, bestTop = wp[cur][1];
      for (const c of childIdx[cur]) {
        if (!centerish(c) || physicsBones.has(c)) continue;
        const top = subtreeMaxY(c, childIdx, wp);
        if (wp[c][1] >= wp[cur][1] - 0.02 * H && top > bestTop) { bestTop = top; next = c; }
      }
      if (next < 0) break;
      ups.push(next);
      cur = next;
    }
    const upDeform = ups.filter(i => isDeform(i) || hasDeformDesc[i]);
    if (upDeform.length >= 2) {
      setA('neck', upDeform[0]);
      setA('head', upDeform[upDeform.length - 1]);
    } else if (upDeform.length === 1) {
      setA('head', upDeform[0]);
    }
  }
  if (need('head')) {
    // last resort: highest near-center deform bone
    let best = -1, bestY = -Infinity;
    for (let i = 0; i < N; i++) {
      if (!isDeform(i) || physicsBones.has(i)) continue;
      if (Math.abs(wp[i][0] - cx) > 0.06 * H) continue;
      if (wp[i][1] > bestY) { bestY = wp[i][1]; best = i; }
    }
    if (best >= 0 && bestY > minY + 0.7 * H) setA('head', best);
  }
}

/* ------------------------------------------------------------- handles */

function buildHandles(ctx) {
  const {
    bones, N, parentIdx, dw, isDeform, hasDeformDesc,
    ikTargets, grantDriven, physicsBones, anchors, cap,
  } = ctx;

  const chosen = new Map(); // index -> { bone, isAnchor, tier }
  const push = (i, isAnchor, tier) => {
    if (i === undefined || i < 0 || i >= N || chosen.has(i)) return;
    if (chosen.size >= cap) return;
    chosen.set(i, { bone: bones[i], isAnchor, tier });
  };

  // 1. anchors
  for (const chain of CHAIN_DEFS) for (const id of chain) push(anchors[id], true, 'anchor');
  // 2. bones between consecutive anchors (twist/deform sub-bones)
  for (const chain of CHAIN_DEFS) {
    for (let s = 0; s < chain.length - 1; s++) {
      const a = anchors[chain[s]], b = anchors[chain[s + 1]];
      if (a === undefined || b === undefined) continue;
      for (const i of chainBetween(b, a, parentIdx)) {
        if (grantDriven.has(i) || ikTargets.has(i)) continue;
        push(i, i === a || i === b, i === a || i === b ? 'anchor' : 'main');
      }
    }
  }
  // 3. remaining body deform bones by weight (skip helper/duplicate chains)
  const byWeight = [];
  for (let i = 0; i < N; i++) if (isDeform(i)) byWeight.push(i);
  byWeight.sort((a, b) => dw[b] - dw[a]);
  for (const i of byWeight) {
    if (ikTargets.has(i) || grantDriven.has(i) || physicsBones.has(i)) continue;
    push(i, false, 'main');
  }
  // 4. physics chains (hair / ears / tails / cloth) — small poseable dots
  for (const i of byWeight) {
    if (!physicsBones.has(i) || ikTargets.has(i) || grantDriven.has(i)) continue;
    push(i, false, 'minor');
  }
  // 5. structural parents of deform chains
  for (let i = 0; i < N; i++) {
    if (chosen.size >= cap) break;
    if (!chosen.has(i) && hasDeformDesc[i] && !ikTargets.has(i) && !grantDriven.has(i)) {
      push(i, false, 'minor');
    }
  }
  // 6. guarantee: never leave the user with an empty / near-empty rig
  if (chosen.size < Math.min(8, N)) {
    for (let i = 0; i < N && chosen.size < cap; i++) push(i, false, 'minor');
  }

  return [...chosen.values()];
}

/* --------------------------------------------------------------- mirror */

export function mirrorNameOf(name) {
  if (!name) return null;
  if (name.includes('左')) return name.replace(/左/g, '右');
  if (name.includes('右')) return name.replace(/右/g, '左');
  if (/left/i.test(name)) return name.replace(/left/ig, m => m[0] === 'L' ? 'Right' : 'right');
  if (/right/i.test(name)) return name.replace(/right/ig, m => m[0] === 'R' ? 'Left' : 'left');
  if (/(^|[_\-. ])L([_\-. ]|$)/.test(name)) return name.replace(/(^|[_\-. ])L([_\-. ]|$)/, '$1R$2');
  if (/(^|[_\-. ])R([_\-. ]|$)/.test(name)) return name.replace(/(^|[_\-. ])R([_\-. ]|$)/, '$1L$2');
  if (/\.L$/i.test(name)) return name.replace(/\.L$/i, '.R');
  if (/\.R$/i.test(name)) return name.replace(/\.R$/i, '.L');
  return null;
}

function buildMirrorMap(bones, wp, parentIdx, cx, H, byName) {
  const map = new Map();
  const N = bones.length;
  const used = new Set();

  // 1. name-based pairs
  for (let i = 0; i < N; i++) {
    const m = mirrorNameOf(bones[i].name);
    if (!m || !byName.has(m)) continue;
    const j = byName.get(m);
    if (j === i) continue;
    map.set(bones[i].name, bones[j].name);
    used.add(i); used.add(j);
  }
  // 2. geometric pairs for everything left (works with meaningless names)
  const tol = Math.max(1e-4, 0.02 * H);
  const lefts = [], rights = [];
  for (let i = 0; i < N; i++) {
    if (used.has(i)) continue;
    const off = wp[i][0] - cx;
    if (off > tol * 0.5) lefts.push(i);
    else if (off < -tol * 0.5) rights.push(i);
  }
  for (const i of lefts) {
    let best = -1, bestD = tol;
    const [xi, yi, zi] = wp[i];
    for (const j of rights) {
      if (used.has(j)) continue;
      const [xj, yj, zj] = wp[j];
      const d = Math.hypot((xi - cx) + (xj - cx), yi - yj, zi - zj);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best >= 0) {
      // parents must also mirror (or be shared) — avoids false pairs
      const pi = parentIdx[i], pj = parentIdx[best];
      const pOK = pi === pj
        || (pi >= 0 && pj >= 0 && (
          map.get(bones[pi].name) === bones[pj].name
          || Math.hypot((wp[pi][0] - cx) + (wp[pj][0] - cx), wp[pi][1] - wp[pj][1], wp[pi][2] - wp[pj][2]) < tol));
      if (!pOK) continue;
      map.set(bones[i].name, bones[best].name);
      map.set(bones[best].name, bones[i].name);
      used.add(i); used.add(best);
    }
  }
  return map;
}

/* ---------------------------------------------------------------- utils */

function topoOrder(parentIdx, childIdx) {
  const N = parentIdx.length;
  const order = [];
  const stack = [];
  for (let i = 0; i < N; i++) if (parentIdx[i] < 0) stack.push(i);
  const seen = new Set();
  while (stack.length) {
    const i = stack.pop();
    if (seen.has(i)) continue;
    seen.add(i);
    order.push(i);
    for (const c of childIdx[i]) stack.push(c);
  }
  // orphaned/cyclic safety
  for (let i = 0; i < N; i++) if (!seen.has(i)) order.push(i);
  return order;
}

function subtreeOf(root, childIdx) {
  const out = [];
  const stack = [root];
  while (stack.length && out.length < 4096) {
    const i = stack.pop();
    out.push(i);
    for (const c of childIdx[i]) stack.push(c);
  }
  return out;
}

function subtreeMaxY(root, childIdx, wp) {
  let m = -Infinity;
  for (const i of subtreeOf(root, childIdx)) if (wp[i][1] > m) m = wp[i][1];
  return m;
}

function nearestByY(list, wp, targetY, isDeform) {
  let best = -1, bestD = Infinity;
  for (const i of list) {
    if (!isDeform(i)) continue;
    const d = Math.abs(wp[i][1] - targetY);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0) {
    for (const i of list) {
      const d = Math.abs(wp[i][1] - targetY);
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  return best;
}

// Walk from distal up to (and including) proximal: [distal, ..., proximal].
function chainBetween(distal, proximal, parentIdx) {
  const chain = [];
  let n = distal, guard = 0;
  while (n >= 0 && guard++ < MAX_CHAIN) {
    chain.push(n);
    if (n === proximal) return chain;
    n = parentIdx[n];
  }
  return [distal, proximal];
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mapAnchorsToBones(anchors, bones) {
  const out = {};
  for (const [id, i] of Object.entries(anchors)) out[id] = bones[i] || null;
  return out;
}

// Console-friendly summary for debugging model imports.
export function describeRigScan(scan) {
  if (!scan?.ok) return { ok: false };
  const anchors = {};
  for (const [id, b] of Object.entries(scan.anchors)) {
    if (b) anchors[id] = `${b.name} (${scan.anchorSource[id]})`;
  }
  return {
    ok: true,
    bones: scan.bones.length,
    handles: scan.handles.length,
    anchorsFound: Object.keys(anchors).length,
    anchors,
    deformBones: scan.deformWeight ? scan.deformWeight.filter(w => w > EPS_W).length : 0,
    physicsBones: scan.physicsBones.size,
    ikTargets: scan.ikTargets.size,
    grantDriven: scan.grantDriven.size,
    mirrorPairs: scan.mirrorOf.size / 2,
    jpAliases: scan.jpAlias ? Object.fromEntries(scan.jpAlias) : {},
  };
}
