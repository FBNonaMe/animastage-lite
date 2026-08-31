/**
 * RTX Engine — extract Three.js scene geometry/materials, build a robust BVH,
 * upload everything to GPU textures for a WebGL2 path tracer.
 *
 * Design goals (rebuilt for large 500K+ poly models):
 *   - SAH (Surface Area Heuristic) BVH build with binned splitting — much
 *     better traversal coherence than median-split, ~2-3x fewer node visits
 *     per ray on average.
 *   - BVH stored as a parent-pointer array + flat children so refit is a
 *     single bottom-up pass (no recursion, no stack overflow, O(N)).
 *   - Safe per-frame skinned-mesh update: only re-extract the meshes that
 *     actually are skinned/animated, leave static geometry alone.
 *   - Texture sizes are clamped to gl.maxTextureSize; if the scene still
 *     doesn't fit we split into multiple BVH/texture pages instead of
 *     silently dropping triangles.
 *   - skinnedVertexWorld: no more exception-as-flow-control; we guard
 *     skeleton readiness and never fall through with untransformed positions.
 *
 * Texture layout (all RGBA32F, NearestFilter, ClampToEdge):
 *   - uTriData: 6 texels per tri  (v0, v1, v2, uv0, uv1, uv2)
 *   - uMatData: 4 texels per mat  (albedo+type, emit+fuzz, rect, xform)
 *   - uBvhNodes: 3 texels per node (min.xyz+leaf, max.xyz, meta)
 */
"use strict";

import * as THREE from "three";

export const RTX_MAT = {
  DIFFUSE: 0,
  METAL: 1,
  GLASS: 2,
  LIGHT: 3,
};

// BVH tuning. LEAF_SIZE higher than before (8) + SAH = much fewer node tests.
const LEAF_SIZE = 8;
const SAH_BIN_COUNT = 16; // bins per axis for SAH binned splitter
const SAH_COST_TRAVERSAL = 1.0; // Ci
const SAH_COST_INTERSECT = 1.0; // Ct
const MAX_TRIS_PER_PAGE = 1_500_000; // hard cap per BVH page (was 400k)
const MAX_PAGES = 4; // split into pages if scene is huge
const MAX_TEX = 4096; // conservative WebGL2 cap
const PREFERRED_TEX = 2048;

/* ----------------------------- materials ----------------------------- */

/** @typedef {{ type:number, albedo:number[], fuzz:number, emit:number[], ior:number, rect:number[], repeat:number[], offset:number[] }} RtxMaterial */
/** @typedef {{ v0:number[], v1:number[], v2:number[], uv0:number[], uv1:number[], uv2:number[], matIndex:number, centroid:number[] }} RtxTriangle */

/**
 * Convert a Three.js material to path-tracer material params.
 * @param {THREE.Material|null} mat
 * @returns {RtxMaterial}
 */
function materialToRTXBase(mat) {
  const def = {
    type: RTX_MAT.DIFFUSE,
    albedo: [0.75, 0.75, 0.78],
    fuzz: 0,
    emit: [0, 0, 0],
    ior: 1.5,
    rect: [0, 0, 1, -1],
    repeat: [1, 1],
    offset: [0, 0],
    // MMD sphere map (matcap). sphereMode: -1 none, 0 multiply (.sph),
    // 1 additive (.spa). sphereRect is filled by _buildAtlas (default = none).
    sphereRect: [0, 0, 0, -1],
    sphereMode: -1,
  };
  if (!mat) return def;

  // MMDToonMaterial exposes the sphere map as `.matcap` and the blend in
  // `.matcapCombine` (three.js MultiplyOperation === 0). MMD .sph = multiply,
  // .spa = additive. The path tracer was ignoring these entirely.
  if (mat.matcap) {
    def.sphereMode = mat.matcapCombine === 0 ? 0 : 1;
  }

  // three.js MMDToonMaterial (used by MMDLoader for .pmx/.pmd) is a
  // ShaderMaterial that exposes the diffuse tint as `.diffuse`, NOT `.color`
  // (see exposePropertyNames in MMDLoader). Reading only `.color` returned
  // undefined and defaulted albedo to white — every surface washed out to flat
  // white under lighting. Fall back to `.diffuse` so MMD materials get their
  // real base colour.
  const col = mat.color || mat.diffuse || new THREE.Color(0xffffff);
  let albedo = [col.r, col.g, col.b];
  const map = mat.map;
  if (map) {
    const rep = map.repeat || { x: 1, y: 1 };
    const off = map.offset || { x: 0, y: 0 };
    def.repeat = [rep.x ?? 1, rep.y ?? 1];
    def.offset = [off.x ?? 0, off.y ?? 0];
    def.rotation = map.rotation || 0; // KHR_texture_transform (glTF/Sketchfab)
  }

  const emissive = mat.emissive || new THREE.Color(0);
  const emInt = mat.emissiveIntensity ?? 1;
  const emitStr = (emissive.r + emissive.g + emissive.b) * emInt;
  // Treat a material as a self-emitting LIGHT only when it is STRONGLY emissive
  // AND has no diffuse texture. MMD/PMX loaders map the material's *ambient*
  // term onto `emissive`, so nearly every textured character material carries a
  // non-trivial emissive value. The old `emitStr > 0.05` therefore turned the
  // ENTIRE textured model into an area light — a flat, blown-out white
  // silhouette in RTX (brighter than the sky). Genuine glow elements (lamps,
  // orbs, markings) are untextured emissive, so the `!map` guard keeps them
  // working while textured surfaces render as normal diffuse: albedo × texture.
  if (emitStr > 1.0 && !map) {
    return {
      type: RTX_MAT.LIGHT,
      albedo: [0, 0, 0],
      fuzz: 0,
      emit: [
        emissive.r * emInt * 12,
        emissive.g * emInt * 12,
        emissive.b * emInt * 12,
      ],
      ior: 1.5,
      rect: def.rect,
      repeat: def.repeat,
      offset: def.offset,
    };
  }

  const transmission = mat.transmission ?? 0;
  const transparent = !!mat.transparent;
  if (transmission > 0.35 || (transparent && (mat.roughness ?? 1) < 0.15)) {
    return {
      type: RTX_MAT.GLASS,
      albedo: [1, 1, 1],
      fuzz: 0,
      emit: [0, 0, 0],
      ior: mat.ior ?? 1.5,
      rect: def.rect,
      repeat: def.repeat,
      offset: def.offset,
    };
  }

  const metalness = mat.metalness ?? 0;
  if (metalness > 0.45) {
    return {
      type: RTX_MAT.METAL,
      albedo,
      fuzz: Math.min(0.35, mat.roughness ?? 0.1),
      emit: [0, 0, 0],
      ior: 1.5,
      rect: def.rect,
      repeat: def.repeat,
      offset: def.offset,
      sphereRect: def.sphereRect,
      sphereMode: def.sphereMode,
    };
  }

  // NOTE: a name-based "touka" fade was tried here and REVERTED — it made the
  // transparent HAIR layer (La_Hair_front_touka) see-through while not fixing the
  // skirt, proving the skirt facets are not this overlay. Per-material alpha is
  // kept wired (default 1 = opaque) for future targeted use.
  const overlayAlpha = 1.0;
  return {
    type: RTX_MAT.DIFFUSE,
    albedo,
    fuzz: 0,
    emit: [0, 0, 0],
    ior: 1.5,
    rect: def.rect,
    repeat: def.repeat,
    offset: def.offset,
    rotation: def.rotation || 0,
    sphereRect: def.sphereRect,
    sphereMode: def.sphereMode,
    alpha: overlayAlpha,
  };
}

const _clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

/**
 * Flexible shader system entry point. Converts a Three.js material to RTX
 * params, then applies per-material shader overrides from
 * `material.userData.rtx` (written by the RTX Material Studio UI):
 *   { type: 'auto'|'diffuse'|'metal'|'glass'|'light',
 *     tint:[r,g,b], fuzz, alpha, emitBoost,
 *     coat, coatRough, rim, sss }
 * With no override the result is IDENTICAL to legacy behavior
 * (coat/rim/sss = 0), so existing scenes render unchanged.
 */
export function materialToRTX(mat) {
  const m = materialToRTXBase(mat);
  const ov = mat && mat.userData ? mat.userData.rtx : null;
  m.coat = 0;
  m.coatRough = 0.15;
  m.rim = 0;
  m.sss = 0;
  if (!ov || ov.enabled === false) return m;

  if (ov.type && ov.type !== "auto") {
    const t = {
      diffuse: RTX_MAT.DIFFUSE,
      metal: RTX_MAT.METAL,
      glass: RTX_MAT.GLASS,
      light: RTX_MAT.LIGHT,
    }[ov.type];
    if (t !== undefined) m.type = t;
  }
  if (Array.isArray(ov.tint) && ov.tint.length === 3) {
    m.albedo = [
      m.albedo[0] * ov.tint[0],
      m.albedo[1] * ov.tint[1],
      m.albedo[2] * ov.tint[2],
    ];
  }
  if (ov.fuzz != null) m.fuzz = _clamp01(ov.fuzz);
  if (ov.alpha != null) m.alpha = _clamp01(ov.alpha);
  if (ov.emitBoost != null && ov.emitBoost > 0) {
    // Glow: emissive derived from the base color.
    m.emit = [
      m.emit[0] + m.albedo[0] * ov.emitBoost,
      m.emit[1] + m.albedo[1] * ov.emitBoost,
      m.emit[2] + m.albedo[2] * ov.emitBoost,
    ];
  }
  if (ov.coat != null) m.coat = _clamp01(ov.coat);
  if (ov.coatRough != null) m.coatRough = _clamp01(ov.coatRough);
  if (ov.rim != null) m.rim = _clamp01(ov.rim);
  if (ov.sss != null) m.sss = _clamp01(ov.sss);
  return m;
}

/* --------------------------- skinned vertex --------------------------- */

const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _n = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _uv0 = new THREE.Vector2();
const _uv1 = new THREE.Vector2();
const _uv2 = new THREE.Vector2();
const _instMatrix = new THREE.Matrix4();
const _worldMatrix = new THREE.Matrix4();
const _ns = new THREE.Vector3(); // scratch for skinned-normal recompute

/**
 * Apply morph targets (if any are active), then skinning in local space,
 * then transform to world. Never leaves `target` partially computed.
 *
 * Improvements over the old version:
 *   - Morph targets (MMD facial expressions!) are applied before skinning, so
 *     the path-traced face matches the raster view. `mesh.boneTransform()`
 *     reads the raw position attribute internally and ignores morphs, so we
 *     hand-roll the 4-influence blend (incl. bind/bindInverse matrices)
 *     whenever a morph is active.
 * @param {THREE.SkinnedMesh} mesh
 * @param {number} index
 * @param {THREE.Vector3} target
 */
const _morphTmp = new THREE.Vector3();

function anyMorphActive(mesh) {
  const infl = mesh.morphTargetInfluences;
  const morphs = mesh.geometry?.morphAttributes?.position;
  if (!infl || !morphs || morphs.length === 0) return false;
  const ml = Math.min(morphs.length, infl.length);
  for (let m = 0; m < ml; m++) {
    if (infl[m]) return true;
  }
  return false;
}

function applyMorphsLocal(mesh, index, target) {
  const geom = mesh.geometry;
  const morphs = geom.morphAttributes?.position;
  const infl = mesh.morphTargetInfluences;
  if (!morphs || !infl) return;
  const relative = !!geom.morphTargetsRelative;
  const bx = target.x,
    by = target.y,
    bz = target.z;
  const ml = Math.min(morphs.length, infl.length);
  for (let m = 0; m < ml; m++) {
    const w = infl[m];
    if (!w) continue;
    const attr = morphs[m];
    if (!attr || index >= attr.count) continue;
    if (relative) {
      target.x += attr.getX(index) * w;
      target.y += attr.getY(index) * w;
      target.z += attr.getZ(index) * w;
    } else {
      _morphTmp.fromBufferAttribute(attr, index);
      target.x += (_morphTmp.x - bx) * w;
      target.y += (_morphTmp.y - by) * w;
      target.z += (_morphTmp.z - bz) * w;
    }
  }
}

/** Hand-rolled linear-blend skinning of `target` (local space, in place). */
function manualSkinLocal(mesh, index, target) {
  const geom = mesh.geometry;
  const si = geom.attributes.skinIndex;
  const sw = geom.attributes.skinWeight;
  const skeleton = mesh.skeleton;
  const bm = skeleton.boneMatrices;
  if (!si || !sw || !bm) return;
  if (mesh.bindMatrix) target.applyMatrix4(mesh.bindMatrix);
  const vx = target.x,
    vy = target.y,
    vz = target.z;
  const i0 = si.getX(index) | 0,
    i1 = si.getY(index) | 0,
    i2 = si.getZ(index) | 0,
    i3 = si.getW(index) | 0;
  const w0 = sw.getX(index),
    w1 = sw.getY(index),
    w2 = sw.getZ(index),
    w3 = sw.getW(index);
  let ox = 0,
    oy = 0,
    oz = 0,
    tw = 0;
  // Unrolled 4-influence blend.
  for (let b = 0; b < 4; b++) {
    const w = b === 0 ? w0 : b === 1 ? w1 : b === 2 ? w2 : w3;
    if (!w) continue;
    const bi = b === 0 ? i0 : b === 1 ? i1 : b === 2 ? i2 : i3;
    const o = bi * 16;
    if (o < 0 || o + 16 > bm.length) continue;
    ox += (bm[o] * vx + bm[o + 4] * vy + bm[o + 8] * vz + bm[o + 12]) * w;
    oy += (bm[o + 1] * vx + bm[o + 5] * vy + bm[o + 9] * vz + bm[o + 13]) * w;
    oz += (bm[o + 2] * vx + bm[o + 6] * vy + bm[o + 10] * vz + bm[o + 14]) * w;
    tw += w;
  }
  if (tw > 0) {
    if (Math.abs(tw - 1) > 1e-3) {
      const inv = 1 / tw;
      ox *= inv;
      oy *= inv;
      oz *= inv;
    }
    target.set(ox, oy, oz);
  }
  if (mesh.bindMatrixInverse) target.applyMatrix4(mesh.bindMatrixInverse);
}

function skinnedVertexWorld(mesh, index, target) {
  const geom = mesh.geometry;
  const pos = geom?.attributes?.position;
  if (!pos || index < 0 || index >= pos.count) {
    target.set(0, 0, 0);
    return;
  }
  target.fromBufferAttribute(pos, index);

  const hasMorph = anyMorphActive(mesh);
  if (hasMorph) applyMorphsLocal(mesh, index, target);

  const skinIndex = geom.attributes.skinIndex;
  const skinWeight = geom.attributes.skinWeight;
  const hasSkin = !!(
    skinIndex &&
    skinWeight &&
    mesh.skeleton &&
    mesh.skeleton.bones?.length &&
    mesh.skeleton.boneMatrices
  );

  if (!hasSkin) {
    target.applyMatrix4(mesh.matrixWorld);
    return;
  }

  try {
    if (!hasMorph && typeof mesh.boneTransform === "function") {
      // Fast path: three's own skinning (reads the raw attribute internally,
      // which is fine because no morph is active).
      mesh.boneTransform(index, target);
    } else {
      manualSkinLocal(mesh, index, target);
    }
  } catch (_e) {
    // Last-resort: keep the (possibly morphed) local position.
  }
  target.applyMatrix4(mesh.matrixWorld);
}

/**
 * World-space DEFORMED shading normal for a skinned vertex. `target` enters as
 * the LOCAL authored normal and leaves as the normalized WORLD normal. It is
 * pushed through the same linear-blend skin transform three.js uses on the GPU
 * (skinning_normal: skinMatrix * vec4(normal, 0.0) — the 3x3 rotation part only,
 * w=0 drops translation), plus the bind matrices and the mesh world matrix.
 * Rigid MMD/VRM bones make this exact; non-rigid scale is rare and tolerated.
 */
function skinnedNormalDir(mesh, index, target) {
  const geom = mesh.geometry;
  const si = geom.attributes.skinIndex;
  const sw = geom.attributes.skinWeight;
  const skeleton = mesh.skeleton;
  const bm = skeleton?.boneMatrices;
  const hasSkin = !!(si && sw && skeleton && skeleton.bones?.length && bm);
  if (!hasSkin) { target.transformDirection(mesh.matrixWorld); return; }
  if (mesh.bindMatrix) target.transformDirection(mesh.bindMatrix);
  const vx = target.x, vy = target.y, vz = target.z;
  const i0 = si.getX(index) | 0, i1 = si.getY(index) | 0,
        i2 = si.getZ(index) | 0, i3 = si.getW(index) | 0;
  const w0 = sw.getX(index), w1 = sw.getY(index),
        w2 = sw.getZ(index), w3 = sw.getW(index);
  let ox = 0, oy = 0, oz = 0, tw = 0;
  for (let b = 0; b < 4; b++) {
    const w = b === 0 ? w0 : b === 1 ? w1 : b === 2 ? w2 : w3;
    if (!w) continue;
    const bi = b === 0 ? i0 : b === 1 ? i1 : b === 2 ? i2 : i3;
    const o = bi * 16;
    if (o < 0 || o + 16 > bm.length) continue;
    // 3x3 (rotation) part only — no translation column (bm[o+12..14]) — so this
    // transforms a DIRECTION. Column-major layout matches manualSkinLocal.
    ox += (bm[o] * vx + bm[o + 4] * vy + bm[o + 8] * vz) * w;
    oy += (bm[o + 1] * vx + bm[o + 5] * vy + bm[o + 9] * vz) * w;
    oz += (bm[o + 2] * vx + bm[o + 6] * vy + bm[o + 10] * vz) * w;
    tw += w;
  }
  if (tw > 0) target.set(ox, oy, oz);
  if (mesh.bindMatrixInverse) target.transformDirection(mesh.bindMatrixInverse);
  target.transformDirection(mesh.matrixWorld); // local -> world, and normalizes
}

/* ----------------------------- extraction ----------------------------- */

/**
 * Iterate the triangle index triplets of a mesh in a deterministic order that
 * is shared by the full build AND the in-place dynamic update — both paths
 * MUST visit triangles identically or the GPU buffers desync.
 * @param {THREE.Mesh} mesh
 * @param {{ drawRange?:{start:number,count:number} }} opts
 * @param {(ia:number, ib:number, ic:number, group:{materialIndex:number})=>void} cb
 */
function forEachTriIndex(mesh, opts, cb) {
  const geom = mesh.geometry;
  const pos = geom?.attributes?.position;
  if (!pos) return;
  const index = geom.index || null;
  const drawRange =
    opts?.drawRange || geom.drawRange || { start: 0, count: Infinity };
  const fullCount = index ? index.count : pos.count;
  const drawStart = Math.max(0, drawRange.start || 0);
  const drawEnd = Math.min(
    fullCount,
    drawStart +
      (Number.isFinite(drawRange.count) ? drawRange.count : fullCount),
  );
  const srcGroups = geom.groups?.length
    ? geom.groups
    : [{ start: 0, count: fullCount, materialIndex: 0 }];

  for (const group of srcGroups) {
    const start = Math.max(group.start, drawStart);
    const end = Math.min(group.start + group.count, drawEnd);
    const count = end - start;
    if (count < 3) continue;
    if (index) {
      for (let i = start; i + 2 < start + count; i += 3) {
        cb(index.getX(i), index.getX(i + 1), index.getX(i + 2), group);
      }
    } else {
      for (let i = start; i + 2 < start + count; i += 3) {
        cb(i, i + 1, i + 2, group);
      }
    }
  }
}

/**
 * Extract world-space triangles from a mesh.
 *
 * NOTE: degenerate (zero-area) triangles are intentionally KEPT. The GPU
 * intersector rejects them anyway (det ~ 0), and skipping them here would make
 * the triangle count animation-dependent — the in-place dynamic update relies
 * on a stable 1:1 slot mapping.
 * @param {THREE.Mesh|THREE.SkinnedMesh} mesh
 * @param {Map<THREE.Material, number>} matTable
 * @param {RtxMaterial[]} materials
 * @param {THREE.Material[]} materialRefs
 * @param {RtxTriangle[]} triangles
 * @param {{ matrixWorld?:THREE.Matrix4, drawRange?:{start:number,count:number} }} [opts]
 */
// Logs each mesh's normal status ONCE (smooth vs flat going into the BVH), so we
// can tell from the console whether faceting is a data problem (flat normals fed
// to the tracer) or a shading problem. Keyed by uuid so animation rebuilds don't
// spam.
const _normDbg = new Set();

// ===================== NORMAL PIPELINE LOGGING (RTX_NORMLOG) =================
// Toggleable, high-detail console instrumentation for EVERYTHING the engine does
// with normals at BUILD time, per mesh: authored vs missing vs degenerate
// per-vertex normals, vertex welding for smooth-normal recovery, the per-triangle
// smooth-normal SUBSTITUTION decision (and WHY), zero/cancelled fallbacks, and
// before/after flatness per material. (The per-frame refit does NOT recompute
// normals — it warns about that once.)
//
// Drive it live from the DevTools console:
//   RTX_NORMLOG.enabled   = false   // silence all normal logging
//   RTX_NORMLOG.always    = true    // re-log on EVERY rebuild (default: once per mesh)
//   RTX_NORMLOG.sampleTris = 8      // also dump N raw triangle normal triplets
//   RTX_NORMLOG.collapsed = false   // expand the console groups by default
//   RTX_NORMLOG.reset()             // forget logged meshes so they log again
let _normRefitNoted = false;
const RTX_NORMLOG = {
  enabled: true,
  always: false,
  sampleTris: 0,
  collapsed: true,
  reset() { _normDbg.clear(); _normRefitNoted = false; },
};
try {
  (typeof globalThis !== "undefined" ? globalThis : window).RTX_NORMLOG = RTX_NORMLOG;
} catch (_e) {}

// ===================== REFIT BEHAVIOUR (RTX_REFIT) ==========================
// Per-frame refit options. `normals`: re-skin each SkinnedMesh triangle's shading
// normals from its authored normals every frame so the path tracer shades the
// DEFORMED pose, not the rest pose. Without this, bones move the vertex POSITIONS
// but the normals stay at build-pose -> wrong shading on deformed limbs/skirt/
// hair. Toggle live from the console: RTX_REFIT.normals = false.
const RTX_REFIT = { normals: true };
try {
  (typeof globalThis !== "undefined" ? globalThis : window).RTX_REFIT = RTX_REFIT;
} catch (_e) {}

// ===================== FORCE-SMOOTH NORMALS (RTX_SMOOTH) =====================
// force: ALWAYS replace authored vertex normals with recomputed area-weighted
// SMOOTH normals (the engine's equivalent of THREE's geometry.computeVertexNormals)
// for EVERY triangle, not just the flat/missing ones. Use when a model ships
// faceted/hard authored normals you want smoothed. NOTE: it also overrides any
// hand-authored normals (e.g. deliberately flat anime-face shading). Toggle live
// then reload the model:  RTX_SMOOTH.force = true;
// DEFAULT ON: this model (and many MMD models) ship faceted authored normals;
// forcing area-weighted smooth normals is the fix. Set RTX_SMOOTH.force = false
// (then reload) to go back to trusting authored normals.
const RTX_SMOOTH = { force: true };
try {
  (typeof globalThis !== "undefined" ? globalThis : window).RTX_SMOOTH = RTX_SMOOTH;
} catch (_e) {}

const _dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const _fmtVec = (v) =>
  v ? `[${(+v[0]).toFixed(3)}, ${(+v[1]).toFixed(3)}, ${(+v[2]).toFixed(3)}]` : "null";
// Per-triangle accounting for the substitution loop, kept out of the loop body
// for readability. Only invoked when logging is armed for this mesh (_nl != null).
function _nlCount(nl, mi, authMissing, authFlat, subbed, n0, n1, n2, sameDir) {
  nl.total++;
  if (subbed) nl.subbed++; else nl.kept++;
  if (authMissing) nl.subMissing++;
  if (authFlat) nl.subFlat++;
  const z = (n) => n[0] === 0 && n[1] === 0 && n[2] === 0;
  const z0 = z(n0), z1 = z(n1), z2 = z(n2);
  if (z0 && z1 && z2) nl.subZero++;
  else if (z0 || z1 || z2) nl.subPartialZero++;
  const finalFlat = sameDir(n0, n1) && sameDir(n0, n2);
  if (finalFlat) nl.finalFlat++;
  let ms = nl.mat.get(mi);
  if (!ms) { ms = { tris: 0, authFlat: 0, authMissing: 0, subbed: 0, finalFlat: 0 }; nl.mat.set(mi, ms); }
  ms.tris++;
  if (authMissing) ms.authMissing++;
  if (authFlat) ms.authFlat++;
  if (subbed) ms.subbed++;
  if (finalFlat) ms.finalFlat++;
}

function extractMesh(mesh, matTable, materials, materialRefs, triangles, opts = {}) {
  if (!mesh.visible || !mesh.geometry) return;
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  if (!pos) return;
  const _triStart = triangles.length; // for the per-mesh normal diagnostic below
  const uv = geom.attributes.uv || null;
  // Authored per-vertex normals — exactly what the raster renderer shades with.
  // PREFER these. Recomputing normals from geometry cannot reproduce smooth
  // shading on meshes whose vertices are split/duplicated (VRM models overlay an
  // outline copy + a lining "_ura" + transparent "_touka" layers, all coincident
  // and some back-faced), so any geometric recompute stays faceted or cancels at
  // the seams. The authored normals are already smooth; we just move them to
  // world space. (Recompute is kept below only as a fallback for meshes that
  // genuinely ship no normal attribute.)
  const norm = geom.attributes.normal || null;
  const matrixWorld = opts.matrixWorld || mesh.matrixWorld;
  const meshMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const skinned = !!mesh.isSkinnedMesh;

  if (skinned && mesh.skeleton) {
    try {
      mesh.skeleton.update();
    } catch (_e) {}
  }

  const getMatIndex = (mat) => {
    if (!mat) mat = null;
    if (matTable.has(mat)) return matTable.get(mat);
    const idx = materials.length;
    materials.push(materialToRTX(mat));
    materialRefs.push(mat);
    matTable.set(mat, idx);
    return idx;
  };

  // ---- Smooth (interpolated) vertex normals -----------------------------
  // The path tracer used flat per-triangle (face) normals -> a faceted look.
  // Recompute AREA-WEIGHTED smooth normals from the final WORLD positions
  // (skinned/morphed included), accumulated per shared vertex index, so shading
  // is smooth like the raster renderer. Works for static AND posed meshes with
  // no fragile skin-matrix-for-normal math (it uses the deformed positions we
  // already compute). Triangle order/count is unchanged, so the dynamic-refit
  // path stays in sync.
  const vCount = pos.count;
  const wx = new Float32Array(vCount);
  const wy = new Float32Array(vCount);
  const wz = new Float32Array(vCount);
  const wdone = new Uint8Array(vCount);
  // Weld coincident vertices by POSITION, not by index. Smooth normals are
  // averaged per WELD GROUP, so a mesh whose vertices are split at UV/normal
  // seams — or is fully NON-INDEXED (every triangle gets its own 3 vertices, as
  // many glTF/VRM exports are) — still shades smoothly. Accumulating per vertex
  // INDEX only smooths where neighbours literally share an index; a split mesh
  // then collapses to ONE face normal per vertex => the faceted skirt. The split
  // copies are position-identical at the seam, so a position key re-unites them.
  const weldId = new Int32Array(vCount).fill(-1);
  const weldMap = new Map(); // "qx,qy,qz" -> weld group id
  let weldCount = 0;
  // Scale-relative weld tolerance. A fixed 1e-5 absolute is far too tight for any
  // model not near unit scale (an MMD model is tens of units): coincident split
  // vertices land in different quant buckets and never weld, leaving "singletons"
  // whose smooth normal collapses to the face normal => faceting that no shading
  // trick can fix. Derive the tolerance from the model's world-space size.
  let _mnx = Infinity, _mny = Infinity, _mnz = Infinity, _mxx = -Infinity, _mxy = -Infinity, _mxz = -Infinity;
  for (let _i = 0; _i < pos.count; _i++) {
    const _x = pos.getX(_i), _y = pos.getY(_i), _z = pos.getZ(_i);
    if (_x < _mnx) _mnx = _x; if (_y < _mny) _mny = _y; if (_z < _mnz) _mnz = _z;
    if (_x > _mxx) _mxx = _x; if (_y > _mxy) _mxy = _y; if (_z > _mxz) _mxz = _z;
  }
  const _localDiag = isFinite(_mnx) ? Math.hypot(_mxx - _mnx, _mxy - _mny, _mxz - _mnz) : 1;
  _tmp.setFromMatrixScale(matrixWorld);
  const _worldDiag = _localDiag * Math.max(_tmp.x, _tmp.y, _tmp.z, 1e-6);
  // Weld vertices within ~0.02% of the model size (catches split seams without
  // merging genuinely distinct surfaces). Never TIGHTER than the old 1e-5.
  const _weldEps = Math.max(1e-5, _worldDiag * 2e-4);
  const QK = 1 / _weldEps;
  const worldVert = (idx) => {
    if (wdone[idx]) return;
    if (skinned) skinnedVertexWorld(mesh, idx, _v0);
    else _v0.fromBufferAttribute(pos, idx).applyMatrix4(matrixWorld);
    wx[idx] = _v0.x;
    wy[idx] = _v0.y;
    wz[idx] = _v0.z;
    wdone[idx] = 1;
    // Weld key is built ALWAYS now (not only when authored normals are absent):
    // it is the smooth-normal source we substitute in for triangles whose
    // authored normals turn out to be FLAT (the per-triangle choice below).
    const key =
      Math.round(_v0.x * QK) + "," +
      Math.round(_v0.y * QK) + "," +
      Math.round(_v0.z * QK);
    let id = weldMap.get(key);
    if (id === undefined) { id = weldCount++; weldMap.set(key, id); }
    weldId[idx] = id;
  };
  const weldNrm = new Float32Array(vCount * 3); // <= vCount weld groups
  // Accumulate an area-weighted face normal into a weld group, FLIPPING it to
  // agree with whatever is already there. A zero-thickness double-sided sheet
  // (front + back faces share each vertex with OPPOSITE winding — VRM's sheer
  // overlay skirt) would otherwise cancel to a zero normal and fall back to flat
  // shading. The sign is irrelevant downstream: the shader re-orients the normal
  // to face the ray, so we only need a consistent non-zero axis.
  const accumWeld = (g, x, y, z) => {
    if (weldNrm[g] * x + weldNrm[g + 1] * y + weldNrm[g + 2] * z < 0) {
      x = -x; y = -y; z = -z;
    }
    weldNrm[g] += x; weldNrm[g + 1] += y; weldNrm[g + 2] += z;
  };
  const triBuf = []; // [ia, ib, ic, matIndex, u0x,u0y, u1x,u1y, u2x,u2y] * N
  forEachTriIndex(mesh, opts, (ia, ib, ic, group) => {
    const mat = meshMats[group.materialIndex] ?? meshMats[0];
    // Skip fully-transparent materials (opacity ~ 0) — invisible MMD base/shadow
    // layers that would otherwise render opaque and overlap the body.
    if (mat && typeof mat.opacity === "number" && mat.opacity < 0.04) return;
    const matIndex = getMatIndex(mat);
    worldVert(ia);
    worldVert(ib);
    worldVert(ic);
    const ax = wx[ia], ay = wy[ia], az = wz[ia];
    const bx = wx[ib], by = wy[ib], bz = wz[ib];
    const cx = wx[ic], cy = wy[ic], cz = wz[ic];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const fnx = e1y * e2z - e1z * e2y; // area-weighted face normal
    const fny = e1z * e2x - e1x * e2z;
    const fnz = e1x * e2y - e1y * e2x;
    accumWeld(weldId[ia] * 3, fnx, fny, fnz);
    accumWeld(weldId[ib] * 3, fnx, fny, fnz);
    accumWeld(weldId[ic] * 3, fnx, fny, fnz);
    let u0x = 0, u0y = 0, u1x = 0, u1y = 0, u2x = 0, u2y = 0;
    if (uv) {
      u0x = uv.getX(ia); u0y = uv.getY(ia);
      u1x = uv.getX(ib); u1y = uv.getY(ib);
      u2x = uv.getX(ic); u2y = uv.getY(ic);
    }
    triBuf.push(ia, ib, ic, matIndex, u0x, u0y, u1x, u1y, u2x, u2y);
  });
  // Authored vertex normal -> world space (null if absent or degenerate).
  // transformDirection applies matrixWorld's upper-3x3 and normalizes; normals
  // are frozen at build like the rest of the pipeline, matching raster on the
  // static model.
  const authNormOf = (idx) => {
    if (!norm) return null;
    _n.set(norm.getX(idx), norm.getY(idx), norm.getZ(idx));
    if (_n.lengthSq() <= 1e-20) return null;
    _n.transformDirection(matrixWorld);
    return [_n.x, _n.y, _n.z];
  };
  // Recomputed smooth normal from position-welded face normals (null if it
  // cancels to ~zero, e.g. a coincident front+back sheet).
  const weldNormOf = (idx) => {
    const g = weldId[idx] * 3;
    const x = weldNrm[g], y = weldNrm[g + 1], z = weldNrm[g + 2];
    const l = Math.sqrt(x * x + y * y + z * z);
    return l > 1e-12 ? [x / l, y / l, z / l] : null;
  };
  const FLAT_EPS = 0.9995;
  const sameDir = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > FLAT_EPS;
  // Arm normal logging for this mesh (once per uuid unless RTX_NORMLOG.always).
  const _nlOn = RTX_NORMLOG.enabled && (RTX_NORMLOG.always || !_normDbg.has(mesh.uuid));
  const _nl = _nlOn
    ? { total: 0, kept: 0, subbed: 0, subMissing: 0, subFlat: 0, subZero: 0, subPartialZero: 0, finalFlat: 0, mat: new Map() }
    : null;
  for (let k = 0; k < triBuf.length; k += 10) {
    const ia = triBuf[k], ib = triBuf[k + 1], ic = triBuf[k + 2];
    const ax = wx[ia], ay = wy[ia], az = wz[ia];
    const bx = wx[ib], by = wy[ib], bz = wz[ib];
    const cx = wx[ic], cy = wy[ic], cz = wz[ic];
    let n0 = authNormOf(ia), n1 = authNormOf(ib), n2 = authNormOf(ic);
    // Substitute recomputed SMOOTH normals when the authored ones are missing OR
    // FLAT (the three identical = a face normal the model shipped — VRM ships its
    // low-poly transparent overlay skirt that way, which the tracer can only
    // flat-shade). A genuinely flat surface welds back to the same flat normal,
    // so this is safe; only wrongly-flat curved surfaces actually get smoothed.
    const _authMissing = !n0 || !n1 || !n2;
    const _authFlat = !_authMissing && sameDir(n0, n1) && sameDir(n0, n2);
    // RTX_SMOOTH.force => recompute smooth normals for EVERY triangle
    // (computeVertexNormals-style), not only flat/missing ones.
    const _subbed = _authMissing || _authFlat || RTX_SMOOTH.force;
    if (_subbed) {
      n0 = weldNormOf(ia) || n0 || [0, 0, 0];
      n1 = weldNormOf(ib) || n1 || [0, 0, 0];
      n2 = weldNormOf(ic) || n2 || [0, 0, 0];
    }
    if (_nl) _nlCount(_nl, triBuf[k + 3], _authMissing, _authFlat, _subbed, n0, n1, n2, sameDir);
    triangles.push({
      v0: [ax, ay, az],
      v1: [bx, by, bz],
      v2: [cx, cy, cz],
      uv0: [triBuf[k + 4], triBuf[k + 5]],
      uv1: [triBuf[k + 6], triBuf[k + 7]],
      uv2: [triBuf[k + 8], triBuf[k + 9]],
      n0, n1, n2,
      matIndex: triBuf[k + 3],
      centroid: [(ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3],
    });
  }
  // ---- normal pipeline diagnostics (RTX_NORMLOG) --------------------------
  // Everything the engine decided about THIS mesh's normals, grouped in the
  // console: authored health, vertex welding, the smooth-normal substitution
  // decision (and why), zero-fallbacks, and before/after flatness per material.
  if (_nlOn) {
    _normDbg.add(mesh.uuid);
    try {
      // (1) authored per-vertex normal health, over the unique vertices used.
      let aValid = 0, aDegen = 0, aTouched = 0;
      for (let i = 0; i < vCount; i++) {
        if (!wdone[i]) continue;
        aTouched++;
        if (!norm) continue;
        const lx = norm.getX(i), ly = norm.getY(i), lz = norm.getZ(i);
        if (lx * lx + ly * ly + lz * lz <= 1e-20) aDegen++; else aValid++;
      }
      // (2) weld-group sizes — how well coincident vertices share a smooth normal.
      const grpSize = new Int32Array(weldCount);
      for (let i = 0; i < vCount; i++) if (wdone[i] && weldId[i] >= 0) grpSize[weldId[i]]++;
      let singles = 0, maxg = 0, usedGroups = 0;
      for (let gi = 0; gi < weldCount; gi++) {
        const s = grpSize[gi];
        if (s > 0) usedGroups++;
        if (s === 1) singles++;
        if (s > maxg) maxg = s;
      }
      // (3) per-material singleton-vertex ratio + model scale vs weld tolerance.
      // A vertex whose weld group has size 1 has no neighbour to average a smooth
      // normal with -> it can only flat-shade. If a whole MATERIAL is mostly
      // singletons, its surface CANNOT be smoothed by welding => persistent facets
      // (exactly what the matcap skirt shows). A weld tolerance far tighter than
      // the model's feature size is the usual cause of spurious singletons.
      let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
      for (let i = 0; i < vCount; i++) {
        if (!wdone[i]) continue;
        const x = wx[i], y = wy[i], z = wz[i];
        if (x < mnx) mnx = x; if (y < mny) mny = y; if (z < mnz) mnz = z;
        if (x > mxx) mxx = x; if (y > mxy) mxy = y; if (z > mxz) mxz = z;
      }
      const diag = isFinite(mnx) ? Math.hypot(mxx - mnx, mxy - mny, mxz - mnz) : 0;
      const weldTol = 1 / QK;
      const singMat = new Map(); // matIndex -> {sing, tot} over triangle-vertices
      for (let k2 = 0; k2 < triBuf.length; k2 += 10) {
        const mi = triBuf[k2 + 3];
        let sm = singMat.get(mi);
        if (!sm) { sm = { sing: 0, tot: 0 }; singMat.set(mi, sm); }
        sm.tot += 3;
        if (grpSize[weldId[triBuf[k2]]] === 1) sm.sing++;
        if (grpSize[weldId[triBuf[k2 + 1]]] === 1) sm.sing++;
        if (grpSize[weldId[triBuf[k2 + 2]]] === 1) sm.sing++;
      }

      // Top-level one-liner (always visible, even when the group is collapsed)
      // with the decisive numbers, so no expanding/toggling is needed.
      const _afterFlat = _nl.total ? Math.round((100 * _nl.finalFlat) / _nl.total) : 0;
      const _singPct = aTouched ? Math.round((100 * singles) / aTouched) : 0;
      console.info(
        `[RTX norm] ${mesh.name || "(unnamed)"} SUMMARY — FINAL flat=${_afterFlat}%, singletons=${_singPct}%, weldTol=${weldTol}, force-smooth=${RTX_SMOOTH.force ? "ON" : "off"}`);
      const open = RTX_NORMLOG.collapsed
        ? (console.groupCollapsed || console.group || console.info)
        : (console.group || console.info);
      open.call(console,
        `[RTX norm] ${mesh.name || "(unnamed)"}  tris=${_nl.total} verts=${aTouched}  normalAttr=${!!norm} skinned=${!!skinned}`);

      console.info(
        norm
          ? `authored normals: ${aValid} valid, ${aDegen} degenerate (zero-length) / ${aTouched} used verts`
          : `authored normals: NONE — mesh ships no normal attribute; every triangle relies on the welded recompute`);
      console.info(
        `vertex welding: ${usedGroups} groups for ${aTouched} verts — singletons=${singles} (${aTouched ? Math.round((100 * singles) / aTouched) : 0}%, no neighbour to smooth with), largest group=${maxg}`);
      console.info(
        `model scale: bbox diag=${diag.toFixed(3)} units, weld tolerance=${weldTol} units (diag is ${weldTol ? Math.round(diag / weldTol).toLocaleString() : "?"}x the tolerance) — high singletons + huge ratio = splits not welding`);

      const subPct = _nl.total ? Math.round((100 * _nl.subbed) / _nl.total) : 0;
      console.info(
        `substitution: kept authored=${_nl.kept}, replaced with smooth=${_nl.subbed} (${subPct}%)  [because missing=${_nl.subMissing}, because flat=${_nl.subFlat}]`);
      if (_nl.subZero || _nl.subPartialZero)
        console.warn(
          `ZERO-normal fallback: ${_nl.subZero} triangles fully zero, ${_nl.subPartialZero} partial — weld cancelled (coincident front/back sheet); these shade flat/wrong`);

      const beforePct = _nl.total ? Math.round((100 * (_nl.subMissing + _nl.subFlat)) / _nl.total) : 0;
      const afterPct = _nl.total ? Math.round((100 * _nl.finalFlat) / _nl.total) : 0;
      console.info(
        `FLAT%  before=${beforePct}% (authored flat/missing)  ->  after=${afterPct}% (final, post-substitution)  — lower after = smoother`);

      const rows = [];
      for (const [mi, ms] of _nl.mat) {
        const ref = materialRefs[mi];
        const sm = singMat.get(mi);
        rows.push({
          material: (ref && ref.name) || "#" + mi,
          tris: ms.tris,
          authFlatPct: Math.round((100 * ms.authFlat) / ms.tris),
          missingPct: Math.round((100 * ms.authMissing) / ms.tris),
          subbedPct: Math.round((100 * ms.subbed) / ms.tris),
          singletonPct: sm && sm.tot ? Math.round((100 * sm.sing) / sm.tot) : 0,
          FINALflatPct: Math.round((100 * ms.finalFlat) / ms.tris),
        });
      }
      rows.sort((a, b) => b.FINALflatPct - a.FINALflatPct);
      (console.table || console.info).call(console, rows);

      const ns = RTX_NORMLOG.sampleTris | 0;
      if (ns > 0 && triangles.length > _triStart) {
        const step = Math.max(1, Math.floor((triangles.length - _triStart) / ns));
        const samp = [];
        for (let ti = _triStart; ti < triangles.length && samp.length < ns; ti += step) {
          const t = triangles[ti];
          const ref = materialRefs[t.matIndex];
          samp.push({
            tri: ti - _triStart,
            material: (ref && ref.name) || "#" + t.matIndex,
            n0: _fmtVec(t.n0), n1: _fmtVec(t.n1), n2: _fmtVec(t.n2),
            flat: _dot3(t.n0, t.n1) > 0.9995 && _dot3(t.n0, t.n2) > 0.9995,
          });
        }
        (console.table || console.info).call(console, samp);
      }
      (console.groupEnd || function () {}).call(console);
    } catch (_e) {
      try { console.warn("[RTX norm] logging failed:", _e); } catch (__e) {}
    }
  }
}

/**
 * Re-extract ONLY the vertex positions of one previously extracted object,
 * mutating the existing triangle records in place (identical visit order to
 * extractMesh). UVs and materials are untouched — they never animate here.
 * Because the triangle OBJECTS are shared with the per-page `pageTris`
 * arrays, mutating them in place updates every page view for free.
 * @returns {boolean} false when the slot count no longer matches (caller
 *   should fall back to a full rebuild).
 */
function reextractPositionsInPlace(range, triangles) {
  const mesh = range.object;
  if (!mesh || !mesh.geometry) return false;
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  if (!pos) return false;

  let write = range.start;
  const end = range.start + range.count;
  let overflow = false;
  const skinned = !!mesh.isSkinnedMesh;
  // MUST mirror extractMesh's opacity skip exactly, or the refit writes a
  // different triangle count than range.count -> overflow -> false -> a full
  // BVH rebuild every single frame (the constant "[RTX] Built" spam).
  const meshMats = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  const matSkip = (group) => {
    const m = meshMats[group.materialIndex] ?? meshMats[0];
    return !!(m && typeof m.opacity === "number" && m.opacity < 0.04);
  };
  if (skinned && mesh.skeleton) {
    try {
      mesh.skeleton.update();
    } catch (_e) {}
  }

  const writeTri = (ia, ib, ic, matrixWorld) => {
    if (write >= end) {
      overflow = true;
      return;
    }
    if (skinned) {
      skinnedVertexWorld(mesh, ia, _v0);
      skinnedVertexWorld(mesh, ib, _v1);
      skinnedVertexWorld(mesh, ic, _v2);
    } else {
      _v0.fromBufferAttribute(pos, ia).applyMatrix4(matrixWorld);
      _v1.fromBufferAttribute(pos, ib).applyMatrix4(matrixWorld);
      _v2.fromBufferAttribute(pos, ic).applyMatrix4(matrixWorld);
    }
    const t = triangles[write++];
    const a = t.v0,
      b = t.v1,
      c = t.v2,
      ce = t.centroid;
    a[0] = _v0.x;
    a[1] = _v0.y;
    a[2] = _v0.z;
    b[0] = _v1.x;
    b[1] = _v1.y;
    b[2] = _v1.z;
    c[0] = _v2.x;
    c[1] = _v2.y;
    c[2] = _v2.z;
    ce[0] = (_v0.x + _v1.x + _v2.x) * (1 / 3);
    ce[1] = (_v0.y + _v1.y + _v2.y) * (1 / 3);
    ce[2] = (_v0.z + _v1.z + _v2.z) * (1 / 3);
  };

  if (mesh.isInstancedMesh) {
    const count = Math.max(0, mesh.count || 0);
    for (let inst = 0; inst < count; inst++) {
      mesh.getMatrixAt(inst, _instMatrix);
      _worldMatrix.multiplyMatrices(mesh.matrixWorld, _instMatrix);
      forEachTriIndex(mesh, {}, (ia, ib, ic, group) => {
        if (matSkip(group)) return;
        writeTri(ia, ib, ic, _worldMatrix);
      });
    }
  } else if (mesh.isBatchedMesh) {
    const drawInfo = mesh._drawInfo;
    const drawRanges = mesh._drawRanges;
    if (
      !drawInfo?.length ||
      !drawRanges?.length ||
      typeof mesh.getMatrixAt !== "function"
    ) {
      forEachTriIndex(mesh, {}, (ia, ib, ic, group) => {
        if (matSkip(group)) return;
        writeTri(ia, ib, ic, mesh.matrixWorld);
      });
    } else {
      for (let i = 0; i < drawInfo.length; i++) {
        const info = drawInfo[i];
        if (!info?.visible || info.active === false) continue;
        const rng = drawRanges[info.geometryIndex];
        if (!rng || rng.count <= 0) continue;
        mesh.getMatrixAt(i, _instMatrix);
        _worldMatrix.multiplyMatrices(mesh.matrixWorld, _instMatrix);
        forEachTriIndex(mesh, { drawRange: rng }, (ia, ib, ic, group) => {
          if (matSkip(group)) return;
          writeTri(ia, ib, ic, _worldMatrix);
        });
      }
    }
  } else {
    forEachTriIndex(mesh, {}, (ia, ib, ic, group) => {
      if (matSkip(group)) return;
      writeTri(ia, ib, ic, mesh.matrixWorld);
    });
  }
  if (RTX_NORMLOG.enabled && !_normRefitNoted) {
    _normRefitNoted = true;
    console.info(
      RTX_REFIT.normals
        ? "[RTX norm] per-frame refit: positions + centroids updated, and SKINNED triangle normals are re-skinned from authored normals each frame (RTX_REFIT.normals=true). Disable with RTX_REFIT.normals=false."
        : "[RTX norm] per-frame refit updates POSITIONS + centroids only — triangle normals stay at build-time (rest-pose) values (RTX_REFIT.normals=false).");
  }
  return !overflow && write === end;
}

/**
 * After a skinned refit has updated triangle POSITIONS, re-skin each triangle's
 * shading normals so the path tracer shades the DEFORMED pose, not the rest pose.
 * Transforms the model's AUTHORED per-vertex normals by the same linear-blend
 * skin matrix three.js uses on the GPU, then to world space — preserving the
 * authored normals' artistry (e.g. the deliberately flat anime-face shading)
 * rather than replacing them with geometric face normals, which would FACET the
 * whole model. Visitation MUST mirror reextractPositionsInPlace's skinned path so
 * the triangle records line up 1:1.
 */
function recomputeRangeNormalsInPlace(range, triangles) {
  if (!RTX_REFIT.normals || RTX_SMOOTH.force || !range.skinned) return;
  const mesh = range.object;
  if (!mesh || mesh.isInstancedMesh || mesh.isBatchedMesh) return; // skinned meshes only
  const geom = mesh.geometry;
  const norm = geom?.attributes?.normal;
  const pos = geom?.attributes?.position;
  if (!norm || !pos) return; // no authored normals to skin -> leave as build values

  // Per-geometry-vertex deformed-normal cache: each vertex is skinned once per
  // frame and reused across every triangle that shares it.
  let nc = range._nrm;
  if (!nc || nc.dn.length !== pos.count * 3) {
    nc = range._nrm = { dn: new Float32Array(pos.count * 3), done: new Uint8Array(pos.count) };
  }
  const dn = nc.dn, done = nc.done;
  done.fill(0);
  const skinNorm = (idx) => {
    const o = idx * 3;
    if (done[idx]) return !(dn[o] === 0 && dn[o + 1] === 0 && dn[o + 2] === 0);
    done[idx] = 1;
    _ns.set(norm.getX(idx), norm.getY(idx), norm.getZ(idx));
    if (_ns.lengthSq() <= 1e-20) { dn[o] = 0; dn[o + 1] = 0; dn[o + 2] = 0; return false; }
    skinnedNormalDir(mesh, idx, _ns);
    dn[o] = _ns.x; dn[o + 1] = _ns.y; dn[o + 2] = _ns.z;
    return true;
  };

  const meshMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const matSkip = (group) => {
    const m = meshMats[group.materialIndex] ?? meshMats[0];
    return !!(m && typeof m.opacity === "number" && m.opacity < 0.04);
  };

  let w = range.start;
  const end = range.start + range.count;
  forEachTriIndex(mesh, {}, (ia, ib, ic, group) => {
    if (matSkip(group)) return;
    if (w >= end) return;
    const t = triangles[w++];
    if (!skinNorm(ia) || !skinNorm(ib) || !skinNorm(ic)) return; // keep build value if any is unusable
    const a = ia * 3, b = ib * 3, c = ic * 3;
    t.n0[0] = dn[a]; t.n0[1] = dn[a + 1]; t.n0[2] = dn[a + 2];
    t.n1[0] = dn[b]; t.n1[1] = dn[b + 1]; t.n1[2] = dn[b + 2];
    t.n2[0] = dn[c]; t.n2[1] = dn[c + 1]; t.n2[2] = dn[c + 2];
  });
}

function extractInstancedMesh(mesh, matTable, materials, materialRefs, triangles) {
  const count = Math.max(0, mesh.count || 0);
  for (let i = 0; i < count; i++) {
    mesh.getMatrixAt(i, _instMatrix);
    _worldMatrix.multiplyMatrices(mesh.matrixWorld, _instMatrix);
    extractMesh(mesh, matTable, materials, materialRefs, triangles, {
      matrixWorld: _worldMatrix,
    });
  }
}

function extractBatchedMesh(mesh, matTable, materials, materialRefs, triangles) {
  const drawInfo = mesh._drawInfo;
  const drawRanges = mesh._drawRanges;
  if (!drawInfo?.length || !drawRanges?.length || typeof mesh.getMatrixAt !== "function") {
    extractMesh(mesh, matTable, materials, materialRefs, triangles);
    return;
  }

  for (let i = 0; i < drawInfo.length; i++) {
    const info = drawInfo[i];
    if (!info?.visible || info.active === false) continue;
    const range = drawRanges[info.geometryIndex];
    if (!range || range.count <= 0) continue;
    mesh.getMatrixAt(i, _instMatrix);
    _worldMatrix.multiplyMatrices(mesh.matrixWorld, _instMatrix);
    extractMesh(mesh, matTable, materials, materialRefs, triangles, {
      matrixWorld: _worldMatrix,
      drawRange: range,
    });
  }
}

function geometryTriangleCount(geom, drawRange = geom?.drawRange) {
  const pos = geom?.attributes?.position;
  if (!pos) return 0;
  const index = geom.index || null;
  const fullCount = index ? index.count : pos.count;
  const start = Math.max(0, drawRange?.start || 0);
  const end = Math.min(
    fullCount,
    start + (Number.isFinite(drawRange?.count) ? drawRange.count : fullCount),
  );
  return Math.max(0, Math.floor((end - start) / 3));
}

function objectTriangleCount(obj) {
  if (obj.isBatchedMesh) {
    const drawInfo = obj._drawInfo || [];
    const drawRanges = obj._drawRanges || [];
    let tris = 0;
    for (const info of drawInfo) {
      if (!info?.visible || info.active === false) continue;
      tris += geometryTriangleCount(obj.geometry, drawRanges[info.geometryIndex]);
    }
    return tris;
  }
  const base = geometryTriangleCount(obj.geometry);
  if (obj.isInstancedMesh) return base * Math.max(0, obj.count || 0);
  return base;
}

function isRenderVisible(obj) {
  let p = obj;
  while (p) {
    if (!p.visible) return false;
    p = p.parent;
  }
  return true;
}

/**
 * @param {THREE.Object3D} root
 * @param {{ exclude?: (obj:THREE.Object3D)=>boolean, excludeRoots?: THREE.Object3D[] }} [opts]
 */
export function extractSceneGeometry(root, opts = {}) {
  const exclude = opts.exclude || (() => false);
  const excludeRoots = opts.excludeRoots || [];
  const isUnderExcluded = (obj) => {
    for (const r of excludeRoots) {
      if (r && obj === r) return true;
      let p = obj.parent;
      while (p) {
        if (p === r) return true;
        p = p.parent;
      }
    }
    return false;
  };
  const isUnderExcludedPredicate = (obj) => {
    let p = obj;
    while (p) {
      if (exclude(p)) return true;
      p = p.parent;
    }
    return false;
  };
  const materials = [];
  const matTable = new Map();
  const triangles = [];
  const materialRefs = [];
  /** Per-source-object slot ranges — drives the cheap dynamic update. */
  const ranges = [];

  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!isRenderVisible(obj) || isUnderExcluded(obj) || isUnderExcludedPredicate(obj)) return;
    const extractable =
      obj.isBatchedMesh || obj.isInstancedMesh || obj.isMesh || obj.isSkinnedMesh;
    if (!extractable) return;
    const start = triangles.length;
    if (obj.isBatchedMesh) {
      extractBatchedMesh(obj, matTable, materials, materialRefs, triangles);
    } else if (obj.isInstancedMesh) {
      extractInstancedMesh(obj, matTable, materials, materialRefs, triangles);
    } else {
      extractMesh(obj, matTable, materials, materialRefs, triangles);
    }
    const count = triangles.length - start;
    if (count > 0) {
      ranges.push({
        object: obj,
        start,
        count,
        skinned: !!obj.isSkinnedMesh,
        matrixSnapshot: Float32Array.from(obj.matrixWorld.elements),
        instanceVersion: obj.isInstancedMesh
          ? (obj.instanceMatrix?.version ?? 0)
          : 0,
        morphSnapshot: obj.morphTargetInfluences
          ? Float32Array.from(obj.morphTargetInfluences)
          : null,
      });
    }
  });

  // No hard decimation. If we exceed the per-page limit, the engine will split
  // into multiple pages. If we exceed ALL pages, we keep the first N and warn
  // so the user knows which mesh pushed us over.
  const totalCap = MAX_TRIS_PER_PAGE * MAX_PAGES;
  if (triangles.length > totalCap) {
    console.warn(
      `[RTX] Scene has ${triangles.length} tris — truncating to ${totalCap} (${MAX_PAGES} pages).`,
    );
    triangles.length = totalCap;
    for (let i = ranges.length - 1; i >= 0; i--) {
      const r = ranges[i];
      if (r.start >= totalCap) ranges.splice(i, 1);
      else if (r.start + r.count > totalCap) r.count = totalCap - r.start;
    }
  }
  return { triangles, materials, materialRefs, ranges };
}

/* ------------------------------- SAH BVH ------------------------------ */

/**
 * Build a binned-SAH BVH.
 *
 * Output: {
 *   nodes: [{ min:[x,y,z], max:[x,y,z], left, right, start, count, isLeaf, parent }],
 *   indices: Int32Array,   // BVH leaf order -> original triangle index
 * }
 *
 * Nodes are emitted in PRE-ORDER (root = node 0; every parent has a lower
 * index than its children), which satisfies both consumers:
 *   - GPU traversal starts at node index 0 (the root);
 *   - bottom-up refit walks nodes[] backwards, so children are always
 *     refit before their parents.
 *
 * CORRECTNESS NOTE — this is the rewritten builder. Every triangle lookup
 * goes through the `indices[]` permutation (`indices[i]`, never the raw range
 * position `i`). The previous implementation indexed the centroid/AABB arrays
 * by position, so after the very first partition every deeper node's box
 * bounded the WRONG triangles. Symptoms: holes / missing chunks of the mesh,
 * ghost shadows, and pathological traversal cost on 100k+ poly models. It
 * also ran the whole SAH build twice (a dead first pass) — that pass is gone,
 * roughly halving build time.
 */
export function buildBVH(triangles) {
  const n = triangles.length;
  if (n === 0) return { nodes: [], indices: new Int32Array(0) };

  const indices = new Int32Array(n);
  for (let i = 0; i < n; i++) indices[i] = i;

  // Flat centroid + AABB arrays, indexed by ORIGINAL triangle id.
  const centroids = new Float32Array(n * 3);
  const triMin = new Float32Array(n * 3);
  const triMax = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = triangles[i];
    const c = t.centroid;
    const o = i * 3;
    centroids[o] = c[0];
    centroids[o + 1] = c[1];
    centroids[o + 2] = c[2];
    const a = t.v0,
      b = t.v1,
      d = t.v2;
    let minX = a[0],
      minY = a[1],
      minZ = a[2];
    let maxX = minX,
      maxY = minY,
      maxZ = minZ;
    if (b[0] < minX) minX = b[0];
    if (b[0] > maxX) maxX = b[0];
    if (b[1] < minY) minY = b[1];
    if (b[1] > maxY) maxY = b[1];
    if (b[2] < minZ) minZ = b[2];
    if (b[2] > maxZ) maxZ = b[2];
    if (d[0] < minX) minX = d[0];
    if (d[0] > maxX) maxX = d[0];
    if (d[1] < minY) minY = d[1];
    if (d[1] > maxY) maxY = d[1];
    if (d[2] < minZ) minZ = d[2];
    if (d[2] > maxZ) maxZ = d[2];
    triMin[o] = minX;
    triMin[o + 1] = minY;
    triMin[o + 2] = minZ;
    triMax[o] = maxX;
    triMax[o + 1] = maxY;
    triMax[o + 2] = maxZ;
  }

  /** Bounds of the triangles referenced by indices[s..e). */
  const rangeBounds = (s, e, out) => {
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    for (let i = s; i < e; i++) {
      const o = indices[i] * 3;
      const a = triMin[o],
        b = triMin[o + 1],
        c = triMin[o + 2];
      const d = triMax[o],
        f = triMax[o + 1],
        g = triMax[o + 2];
      if (a < minX) minX = a;
      if (b < minY) minY = b;
      if (c < minZ) minZ = c;
      if (d > maxX) maxX = d;
      if (f > maxY) maxY = f;
      if (g > maxZ) maxZ = g;
    }
    out[0] = minX;
    out[1] = minY;
    out[2] = minZ;
    out[3] = maxX;
    out[4] = maxY;
    out[5] = maxZ;
  };

  const surfaceArea6 = (b) => {
    const dx = Math.max(0, b[3] - b[0]),
      dy = Math.max(0, b[4] - b[1]),
      dz = Math.max(0, b[5] - b[2]);
    return 2 * (dx * dy + dy * dz + dz * dx);
  };

  // Reusable SAH bin scratch — hoisted out of the per-node loop. For a 500k
  // triangle mesh the splitter runs ~hundreds of thousands of times; the old
  // version allocated ~8 arrays per call.
  const BINS = SAH_BIN_COUNT;
  const bMin = new Float32Array(BINS * 3);
  const bMax = new Float32Array(BINS * 3);
  const bCnt = new Int32Array(BINS);
  const rArea = new Float32Array(BINS); // merged area of bins [k..last]
  const rCnt = new Int32Array(BINS); // merged count of bins [k..last]
  const sahOut = { cost: Infinity, split: -1 };

  /** Best SAH split of indices[s..e) along `axis`; writes into sahOut. */
  const findSAHSplit = (s, e, axis, nodeSA, out) => {
    out.cost = Infinity;
    out.split = -1;
    const count = e - s;
    if (count <= 1) return;

    let cMin = Infinity,
      cMax = -Infinity;
    for (let i = s; i < e; i++) {
      const v = centroids[indices[i] * 3 + axis];
      if (v < cMin) cMin = v;
      if (v > cMax) cMax = v;
    }
    if (cMax - cMin < 1e-6) return;

    const binCount = Math.min(BINS, count);
    const inv = binCount / (cMax - cMin);
    for (let k = 0; k < binCount; k++) {
      const o = k * 3;
      bMin[o] = Infinity;
      bMin[o + 1] = Infinity;
      bMin[o + 2] = Infinity;
      bMax[o] = -Infinity;
      bMax[o + 1] = -Infinity;
      bMax[o + 2] = -Infinity;
      bCnt[k] = 0;
    }
    for (let i = s; i < e; i++) {
      const id = indices[i];
      let bin = ((centroids[id * 3 + axis] - cMin) * inv) | 0;
      if (bin >= binCount) bin = binCount - 1;
      if (bin < 0) bin = 0;
      const to = id * 3,
        bo = bin * 3;
      if (triMin[to] < bMin[bo]) bMin[bo] = triMin[to];
      if (triMin[to + 1] < bMin[bo + 1]) bMin[bo + 1] = triMin[to + 1];
      if (triMin[to + 2] < bMin[bo + 2]) bMin[bo + 2] = triMin[to + 2];
      if (triMax[to] > bMax[bo]) bMax[bo] = triMax[to];
      if (triMax[to + 1] > bMax[bo + 1]) bMax[bo + 1] = triMax[to + 1];
      if (triMax[to + 2] > bMax[bo + 2]) bMax[bo + 2] = triMax[to + 2];
      bCnt[bin]++;
    }

    // Backward sweep: merged area/count of bins [k .. binCount-1].
    {
      let mx = Infinity,
        my = Infinity,
        mz = Infinity;
      let Mx = -Infinity,
        My = -Infinity,
        Mz = -Infinity;
      let cAcc = 0;
      for (let k = binCount - 1; k >= 1; k--) {
        const bo = k * 3;
        if (bMin[bo] < mx) mx = bMin[bo];
        if (bMin[bo + 1] < my) my = bMin[bo + 1];
        if (bMin[bo + 2] < mz) mz = bMin[bo + 2];
        if (bMax[bo] > Mx) Mx = bMax[bo];
        if (bMax[bo + 1] > My) My = bMax[bo + 1];
        if (bMax[bo + 2] > Mz) Mz = bMax[bo + 2];
        cAcc += bCnt[k];
        const dx = Math.max(0, Mx - mx),
          dy = Math.max(0, My - my),
          dz = Math.max(0, Mz - mz);
        rArea[k] = 2 * (dx * dy + dy * dz + dz * dx);
        rCnt[k] = cAcc;
      }
    }

    // Forward sweep: left side = bins [0 .. k-1], split plane after bin k-1.
    let lmx = Infinity,
      lmy = Infinity,
      lmz = Infinity;
    let lMx = -Infinity,
      lMy = -Infinity,
      lMz = -Infinity;
    let lCount = 0;
    let bestCost = Infinity,
      bestSplit = -1;
    const invSA = 1 / Math.max(nodeSA, 1e-6);
    for (let k = 1; k < binCount; k++) {
      const bo = (k - 1) * 3;
      if (bMin[bo] < lmx) lmx = bMin[bo];
      if (bMin[bo + 1] < lmy) lmy = bMin[bo + 1];
      if (bMin[bo + 2] < lmz) lmz = bMin[bo + 2];
      if (bMax[bo] > lMx) lMx = bMax[bo];
      if (bMax[bo + 1] > lMy) lMy = bMax[bo + 1];
      if (bMax[bo + 2] > lMz) lMz = bMax[bo + 2];
      lCount += bCnt[k - 1];
      const rCount = rCnt[k];
      if (lCount === 0 || rCount === 0) continue;
      const dx = Math.max(0, lMx - lmx),
        dy = Math.max(0, lMy - lmy),
        dz = Math.max(0, lMz - lmz);
      const lArea = 2 * (dx * dy + dy * dz + dz * dx);
      const cost =
        SAH_COST_TRAVERSAL +
        (lArea * lCount + rArea[k] * rCount) * SAH_COST_INTERSECT * invSA;
      if (cost < bestCost) {
        bestCost = cost;
        bestSplit = s + lCount;
      }
    }
    out.cost = bestCost;
    out.split = bestSplit;
  };

  /**
   * Iterative quickselect on indices[s..e) by centroid along `axis`, so that
   * position k splits the range into <= / >= halves. Small windows fall back
   * to a sort. Median-of-3 pivot + 3-way partition keeps equal keys O(n).
   */
  const nthElement = (s0, e0, k, axis) => {
    let s = s0,
      e = e0;
    while (e - s > 16) {
      const m = (s + e) >> 1;
      const a = centroids[indices[s] * 3 + axis];
      const b = centroids[indices[m] * 3 + axis];
      const c = centroids[indices[e - 1] * 3 + axis];
      const pivotIdx =
        a < b ? (b < c ? m : a < c ? e - 1 : s) : a < c ? s : b < c ? e - 1 : m;
      const pivotVal = centroids[indices[pivotIdx] * 3 + axis];
      let i = s,
        j = s,
        kk = e;
      while (j < kk) {
        const v = centroids[indices[j] * 3 + axis];
        if (v < pivotVal) {
          const t = indices[i];
          indices[i] = indices[j];
          indices[j] = t;
          i++;
          j++;
        } else if (v > pivotVal) {
          kk--;
          const t = indices[j];
          indices[j] = indices[kk];
          indices[kk] = t;
        } else {
          j++;
        }
      }
      if (k < i) e = i;
      else if (k >= kk) s = kk;
      else return; // k landed inside the equal block — done
    }
    const tmp = [];
    for (let i = s; i < e; i++) tmp.push(indices[i]);
    tmp.sort((x, y) => centroids[x * 3 + axis] - centroids[y * 3 + axis]);
    for (let i = 0; i < tmp.length; i++) indices[s + i] = tmp[i];
  };

  // ---- Single planning pass (explicit stack, no recursion) ----------------
  // Records every range + its split decision; leaves are flagged. Children
  // are pushed right-then-left so the left subtree is processed first.
  const buildPlan = []; // { s, e, forceLeaf, planParent, slot, bounds }
  {
    const nb = new Float32Array(6);
    const localStack = [{ s: 0, e: n, planParent: -1, slot: null }];
    while (localStack.length) {
      const cur = localStack.pop();
      const s = cur.s,
        e = cur.e;
      const count = e - s;
      rangeBounds(s, e, nb);

      const myIdx = buildPlan.length;
      buildPlan.push({
        s,
        e,
        forceLeaf: false,
        planParent: cur.planParent,
        slot: cur.slot,
        bounds: [nb[0], nb[1], nb[2], nb[3], nb[4], nb[5]],
      });

      if (count <= LEAF_SIZE) {
        buildPlan[myIdx].forceLeaf = true;
        continue;
      }

      const ex = nb[3] - nb[0],
        ey = nb[4] - nb[1],
        ez = nb[5] - nb[2];
      let axis = 0;
      if (ey > ex) axis = 1;
      if (ez > (axis === 0 ? ex : ey)) axis = 2;
      const nodeSA = surfaceArea6(nb);

      let bestCost = Infinity,
        bestSplit = -1,
        bestAxis = axis;
      for (let a2 = 0; a2 < 3; a2++) {
        findSAHSplit(s, e, a2, nodeSA, sahOut);
        if (sahOut.split > 0 && sahOut.cost < bestCost) {
          bestCost = sahOut.cost;
          bestSplit = sahOut.split;
          bestAxis = a2;
        }
      }

      let split = bestSplit;
      if (split <= s || split >= e) {
        // SAH failed (degenerate / all centroids equal) — median split.
        split = s + (count >> 1);
        nthElement(s, e, split, axis);
      } else {
        nthElement(s, e, split, bestAxis);
      }

      // SAH says "leaf is cheaper" and the leaf is small enough for the
      // shader's fixed per-leaf loop guard (LEAF_SIZE * 4 = 32).
      const leafCost = SAH_COST_INTERSECT * count;
      if (bestCost >= leafCost && count <= LEAF_SIZE * 4) {
        buildPlan[myIdx].forceLeaf = true;
        continue;
      }

      localStack.push({ s: split, e, planParent: myIdx, slot: "right" });
      localStack.push({ s, e: split, planParent: myIdx, slot: "left" });
    }
  }

  // ---- Emit nodes in PRE-ORDER, then wire child/parent links --------------
  const nodes = [];
  const childMap = new Map(); // planIdx -> { left, right }
  for (let i = 0; i < buildPlan.length; i++) {
    const p = buildPlan[i];
    if (p.planParent >= 0) {
      const slot = childMap.get(p.planParent) || { left: -1, right: -1 };
      slot[p.slot] = i;
      childMap.set(p.planParent, slot);
    }
  }

  const planIsLeaf = (planIdx) => {
    const p = buildPlan[planIdx];
    if (p.forceLeaf) return true;
    const ch = childMap.get(planIdx);
    return !ch || ch.left < 0 || ch.right < 0;
  };

  const nodeIdFor = new Int32Array(buildPlan.length).fill(-1);
  {
    const stk = [0];
    while (stk.length) {
      const planIdx = stk.pop();
      const p = buildPlan[planIdx];
      const leaf = planIsLeaf(planIdx);
      nodeIdFor[planIdx] = nodes.length;
      nodes.push({
        min: p.bounds.slice(0, 3),
        max: p.bounds.slice(3, 6),
        left: -1,
        right: -1,
        start: leaf ? p.s : -1,
        count: leaf ? p.e - p.s : 0,
        isLeaf: leaf,
        parent: -1,
      });
      if (!leaf) {
        const ch = childMap.get(planIdx);
        // Right first so left is popped next -> left subtree gets contiguous
        // ids right after the parent.
        stk.push(ch.right);
        stk.push(ch.left);
      }
    }
  }

  for (let i = 0; i < buildPlan.length; i++) {
    const nid = nodeIdFor[i];
    if (nid < 0) continue;
    const node = nodes[nid];
    if (node.isLeaf) continue;
    const ch = childMap.get(i);
    const leftId = nodeIdFor[ch.left];
    const rightId = nodeIdFor[ch.right];
    node.left = leftId;
    node.right = rightId;
    nodes[leftId].parent = nid;
    nodes[rightId].parent = nid;
  }

  return { nodes, indices };
}

/* ------------------------------ texture helpers ------------------------------ */

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function chooseTexDims(totalTexels, maxTexSize, preferredW) {
  const capW = Math.max(
    1,
    Math.min(maxTexSize || MAX_TEX, preferredW || PREFERRED_TEX),
  );
  // We want W * H >= totalTexels, W <= capW, both <= maxTexSize.
  let w = Math.min(capW, nextPow2(Math.ceil(Math.sqrt(totalTexels))));
  if (w < 1) w = 1;
  let h = Math.ceil(totalTexels / w);
  if (h > maxTexSize) {
    // Need to grow W. Try doubling.
    while (h > maxTexSize && w < maxTexSize) {
      w *= 2;
      h = Math.ceil(totalTexels / w);
    }
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

/* ------------------------------ RTXEngine ------------------------------ */

/**
 * GPU scene path-tracing backend.
 * Holds GPU textures for triangles, materials, BVH nodes, and the atlas.
 * Supports per-frame dynamic update for skinned/animated geometry.
 */
export class RTXEngine {
  constructor(renderer) {
    this.renderer = renderer;
    this.triangles = [];
    this.materials = [];
    this.materialRefs = [];
    this.bvhNodes = [];
    this.triIndices = new Int32Array(0);
    /** Per-source-mesh triangle slot ranges (drives the fast dynamic path). */
    this.ranges = [];

    // Multi-page support for very large scenes.
    this.pages = []; // [{ triTex, matTex, bvhTex, atlasTex, triTexSize, bvhTexSize, matTexSize, triCount, nodeCount, matCount, triStartIndex, triangles }]
    this.triCount = 0;
    this.nodeCount = 0;
    this.matCount = 0;

    this.ready = false;
    this._rebuildSig = "";
    this._lastSceneVersion = -1;
  }

  _disposeAll() {
    for (const p of this.pages) {
      p.triTex?.dispose();
      p.matTex?.dispose();
      p.bvhTex?.dispose();
      p.atlasTex?.dispose?.();
    }
    this.pages = [];
  }

  /**
   * Fast path for the shader system: re-read every source material (including
   * fresh `userData.rtx` overrides) and repack ONLY the material textures —
   * no geometry/BVH/atlas rebuild, so slider edits are near-instant.
   * Texel-density (m4.y) is preserved from the existing packed data.
   */
  updateMaterialsOnly() {
    if (!this.ready || !this.pages.length || !this.materialRefs.length) return false;
    const MAT_STRIDE = 6;
    const materials = this.materialRefs.map((ref) => materialToRTX(ref));
    // keep texture layer assignments from the previous pack
    for (let i = 0; i < materials.length; i++) {
      const prev = this.materials[i];
      if (!prev) continue;
      materials[i].diffuseLayer = prev.diffuseLayer;
      materials[i].sphereLayer = prev.sphereLayer;
      materials[i].sphereMode = prev.sphereMode;
    }
    this.materials = materials;
    for (const page of this.pages) {
      const tex = page.matTex;
      const data = tex?.image?.data;
      if (!data) continue;
      const cap = Math.floor(data.length / 4);
      for (let i = 0; i < materials.length; i++) {
        const m = materials[i];
        const base = i * MAT_STRIDE;
        if (base + 5 >= cap) break;
        const o0 = (base + 0) * 4, o1 = (base + 1) * 4, o2 = (base + 2) * 4;
        const o3 = (base + 3) * 4, o4 = (base + 4) * 4, o5 = (base + 5) * 4;
        data[o0 + 0] = m.albedo[0];
        data[o0 + 1] = m.albedo[1];
        data[o0 + 2] = m.albedo[2];
        data[o0 + 3] = m.type;
        data[o1 + 0] = m.emit[0];
        data[o1 + 1] = m.emit[1];
        data[o1 + 2] = m.emit[2];
        data[o1 + 3] = m.fuzz;
        data[o2 + 0] = m.diffuseLayer != null ? m.diffuseLayer : -1;
        data[o2 + 1] = m.sphereLayer != null ? m.sphereLayer : -1;
        data[o2 + 2] = m.sphereMode != null ? m.sphereMode : -1;
        data[o2 + 3] = m.rotation || 0;
        const rep = m.repeat || [1, 1];
        const off = m.offset || [0, 0];
        data[o3 + 0] = rep[0];
        data[o3 + 1] = rep[1];
        data[o3 + 2] = off[0];
        data[o3 + 3] = off[1];
        data[o4 + 0] = m.alpha != null ? m.alpha : 1;
        // data[o4 + 1] — texel density: PRESERVED (computed at build time)
        data[o5 + 0] = m.coat || 0;
        data[o5 + 1] = m.coatRough != null ? m.coatRough : 0.15;
        data[o5 + 2] = m.rim || 0;
        data[o5 + 3] = m.sss || 0;
      }
      tex.needsUpdate = true;
    }
    return true;
  }

  /**
   * Build atlas (shared across pages). Materials and their refs don't change
   * with paging, but the rect field on each material can be referenced from
   * any page. We use one atlas per engine.
   */
  _buildAtlas() {
    // NATIVE per-texture layers via sampler2DArray — NO atlas packing. Each
    // unique texture becomes its own array layer at native resolution and is
    // sampled with the native UV in the shader (exactly like the raster engine
    // binds a texture per mesh). This replaces the packed atlas, which had to
    // downscale/blur textures and bled neighbouring tiles -> artefacts.
    const gpuMax = Math.min(
      this.renderer?.capabilities?.maxTextureSize || 2048,
      2048,
    );
    // Assign one layer per UNIQUE texture image (diffuse map + sphere matcap),
    // deduped — many materials share the same skin/cloth texture.
    const layerOf = new Map(); // texture.image -> layer index
    const uniqueTex = []; // textures, in layer order
    const layerFor = (tex) => {
      const img = tex && tex.image;
      if (!img || !img.width || !img.height) return -1;
      const had = layerOf.get(img);
      if (had !== undefined) return had;
      const layer = uniqueTex.length;
      layerOf.set(img, layer);
      uniqueTex.push(tex);
      return layer;
    };
    let maxDim = 1;
    for (const ref of this.materialRefs) {
      if (ref && ref.map && ref.map.image && ref.map.image.width) {
        layerFor(ref.map);
        maxDim = Math.max(maxDim, ref.map.image.width, ref.map.image.height);
      }
      if (ref && ref.matcap && ref.matcap.image && ref.matcap.image.width) {
        layerFor(ref.matcap);
        maxDim = Math.max(
          maxDim,
          ref.matcap.image.width,
          ref.matcap.image.height,
        );
      }
    }
    const depth = Math.max(1, uniqueTex.length);
    // Power-of-2 layer size at the NATIVE max resolution (capped to GPU limit).
    // Array layers must all share one size, so smaller textures are upscaled
    // (lossless) and the largest stays 1:1 — no downscaling/compression.
    let size = 1;
    while (size < maxDim && size < gpuMax) size <<= 1;
    // Memory guard: every layer shares `size`, so the backing array is
    // size*size*4*depth bytes AND we briefly hold all source images decoded.
    // A VRoid/VRM-style model with 16+ 4K textures would need a 256MB+ array on
    // top of ~1GB of decoded sources - enough that getImageData()/drawImage()
    // start throwing partway and most layers silently drop (the "3/16 baked"
    // bug). Shrink the shared size until the array fits a sane budget; very
    // texture-heavy models lose a little resolution but actually finish baking.
    const MAX_ARRAY_BYTES = 192 * 1024 * 1024; // 192 MB backing texture array
    while (size > 256 && size * size * 4 * depth > MAX_ARRAY_BYTES) size >>= 1;
    this._texArraySize = size; // for the shader's mip-LOD calculation
    const canvas =
      typeof document !== "undefined" && document.createElement
        ? document.createElement("canvas")
        : typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(size, size)
          : null;
    let _dbgBaked = 0;
    let arrTex = null;
    if (canvas) {
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const layerBytes = size * size * 4;
        const data = new Uint8Array(layerBytes * depth);
        const _dbgFails = [];
        // Some textures (DataTexture / GLB-embedded raw pixels) aren't a
        // CanvasImageSource, so drawImage() throws on them. Convert the raw
        // RGBA/RGB byte buffer into a drawable canvas first.
        const blitData = (img) => {
          const w = img.width, h = img.height, buf = img.data;
          let rgba;
          if (buf instanceof Uint8Array || buf instanceof Uint8ClampedArray) {
            if (buf.length === w * h * 4) {
              rgba = new Uint8ClampedArray(buf.length);
              rgba.set(buf);
            } else if (buf.length === w * h * 3) {
              rgba = new Uint8ClampedArray(w * h * 4);
              for (let p = 0, q = 0; p < buf.length; p += 3, q += 4) {
                rgba[q] = buf[p]; rgba[q + 1] = buf[p + 1];
                rgba[q + 2] = buf[p + 2]; rgba[q + 3] = 255;
              }
            }
          }
          if (!rgba) throw new Error(
            "unsupported data image (" +
              (buf && buf.constructor ? buf.constructor.name : typeof buf) +
              " len " + (buf ? buf.length : 0) + ")",
          );
          const tmp = document.createElement("canvas");
          tmp.width = w; tmp.height = h;
          tmp.getContext("2d").putImageData(new ImageData(rgba, w, h), 0, 0);
          return tmp;
        };
        for (let L = 0; L < uniqueTex.length; L++) {
          ctx.clearRect(0, 0, size, size);
          const t = uniqueTex[L];
          const img = t.image;
          try {
            const drawable =
              (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) ||
              (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) ||
              (typeof OffscreenCanvas !== "undefined" && img instanceof OffscreenCanvas) ||
              (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap);
            const src = drawable ? img : (img && img.data ? blitData(img) : null);
            if (!src) throw new Error(
              "non-drawable image: " +
                (img && img.constructor ? img.constructor.name : typeof img),
            );
            if (t.flipY !== false) {
              // flipY=true (MMD default) textures are flipped by the GPU on
              // upload; a DataArrayTexture is NOT, so flip here to match. glTF
              // sets flipY=false -> draw as-is. The shader then samples with the
              // native V (no global flip), so both conventions render correctly.
              ctx.save();
              ctx.translate(0, size);
              ctx.scale(1, -1);
              ctx.drawImage(src, 0, 0, size, size);
              ctx.restore();
            } else {
              ctx.drawImage(src, 0, 0, size, size);
            }
            data.set(ctx.getImageData(0, 0, size, size).data, L * layerBytes);
            _dbgBaked++;
          } catch (e) {
            _dbgFails.push(
              (t.name || (img && img.constructor && img.constructor.name) || "?") +
                " " + (img ? img.width + "x" + img.height : "") +
                " -> " + (e && e.message ? e.message : e),
            );
          }
        }
        if (_dbgFails.length) {
          try {
            console.warn(
              "[RTX tex] " + _dbgFails.length + "/" + depth +
                " layer(s) failed to bake @ " + size + "px:",
              _dbgFails,
            );
          } catch (_e) {}
        }
        arrTex = new THREE.DataArrayTexture(data, size, size, depth);
        arrTex.format = THREE.RGBAFormat;
        arrTex.type = THREE.UnsignedByteType;
        arrTex.colorSpace = THREE.SRGBColorSpace;
        // Per-layer mipmaps: each layer is independent, so mipmaps DON'T bleed
        // across textures (unlike the old atlas) -> clean anti-aliasing.
        arrTex.minFilter = THREE.LinearMipmapLinearFilter;
        arrTex.magFilter = THREE.LinearFilter;
        arrTex.wrapS = THREE.ClampToEdgeWrapping;
        arrTex.wrapT = THREE.ClampToEdgeWrapping;
        arrTex.generateMipmaps = true;
        arrTex.needsUpdate = true;
        this._atlasCanvas = canvas; // last layer (for the Dump button)
      }
    }
    // Resolve each material's diffuse / sphere layer index.
    let _dbgMap = 0;
    for (let i = 0; i < this.materials.length; i++) {
      const ref = this.materialRefs[i];
      const m = this.materials[i];
      if (ref && ref.map) _dbgMap++;
      m.diffuseLayer = layerFor(ref && ref.map); // -1 = none/undecoded
      m.sphereLayer = m.sphereMode >= 0 ? layerFor(ref && ref.matcap) : -1;
    }
    try {
      console.info(
        `[RTX tex] ${_dbgBaked}/${depth} texture layers baked @ ${size}px native (sampler2DArray, no atlas) · ${_dbgMap} materials have .map`,
      );
    } catch (_e) {}
    // One-time per-material diagnostic (per engine instance). Identifies the
    // materials WITHOUT a diffuse .map (the "N/21" gap), and flags sphere(.spa/
    // .sph)->matcap and toon->gradientMap materials the path tracer ignores, plus
    // transparency. `rtxRect.w <= 0` means the material rendered as flat albedo.
    if (!this._matDebugLogged) {
      this._matDebugLogged = true;
      try {
        const TYPE = ["DIFFUSE", "METAL", "GLASS", "LIGHT"];
        // Describe a texture: name + decoded image size. "no-img" = the texture
        // object exists but its image never loaded (a "disabled"/missing file);
        // "1x1" = a fallback placeholder. Either means the texture file wasn't
        // resolved at load time.
        const texInfo = (t) => {
          if (!t) return "-";
          const im = t.image;
          const dim = im && im.width ? `${im.width}x${im.height}` : "NO-IMG";
          const nm = t.name || (im && im.src ? im.src.split("/").pop() : "?");
          return `${nm} (${dim})`;
        };
        const rows = this.materialRefs.map((r, i) => ({
          i,
          name: (r && r.name) || "(unnamed)",
          type: TYPE[this.materials[i].type] ?? this.materials[i].type,
          diffuse: r && r.map ? texInfo(r.map) : "NONE",
          sphere: r ? texInfo(r.matcap || r.envMap) : "-",
          toon: r ? texInfo(r.gradientMap) : "-",
          alpha: r && r.opacity != null ? +r.opacity.toFixed(2) : "-",
          // How RASTER makes a layer see-through — so RTX can match it. A "touka"
          // overlay that looks transparent in raster but opaque in RTX means RTX
          // is ignoring one of these (transparent flag / blending / map alpha).
          transp: r ? !!r.transparent : "-",
          blend: r ? r.blending : "-",
          aTest: r && r.alphaTest != null ? r.alphaTest : "-",
          mapAlpha: !!(r && r.map && r.map.format === THREE.RGBAFormat),
          diffLayer: this.materials[i].diffuseLayer,
          sphLayer: this.materials[i].sphereLayer,
        }));
        if (console.table) console.table(rows);
        else console.log("[RTX mats]", rows);
      } catch (_e) {}
    }
    return arrTex;
  }

  /**
   * @param {THREE.Scene} scene
   * @param {{ excludeRoots?: THREE.Object3D[], extraExclude?: (obj:THREE.Object3D)=>boolean }} opts
   */
  rebuildFromScene(scene, opts = {}) {
    const excludeRoots = opts.excludeRoots || [];
    const extraExclude = opts.extraExclude || (() => false);
    const exclude = (obj) => {
      if (!obj.visible) return true;
      if (obj.isLight || obj.isCamera) return true;
      if (
        obj.type === "Line" ||
        obj.type === "LineSegments" ||
        obj.type === "Points"
      )
        return true;
      if (obj.userData?.rtxSkip) return true;
      return extraExclude(obj);
    };

    const { triangles, materials, materialRefs, ranges } = extractSceneGeometry(
      scene,
      {
        exclude,
        excludeRoots,
      },
    );
    const ok = this._buildFromTriangles(triangles, materials, materialRefs, ranges);
    // Remember the structural signature so the next updateDynamic() doesn't
    // mistake a freshly built scene for a changed one and rebuild again.
    if (ok) this._rebuildSig = this._sceneSignature(scene, opts);
    return ok;
  }

  _buildFromTriangles(triangles, materials, materialRefs, ranges = []) {
    this._disposeAll();
    this.triangles = triangles;
    this.materials = materials;
    this.materialRefs = materialRefs;
    this.ranges = ranges;
    for (const r of this.ranges) {
      if (r.skinned) r.poseHash = this._poseHash(r.object);
    }
    this.triCount = triangles.length;
    this.matCount = materials.length;

    if (triangles.length === 0) {
      this.ready = false;
      return false;
    }

    const maxTexSize = Math.min(
      this.renderer?.capabilities?.maxTextureSize || MAX_TEX,
      MAX_TEX,
    );

    // Split into pages.
    const total = triangles.length;
    const numPages = Math.min(MAX_PAGES, Math.ceil(total / MAX_TRIS_PER_PAGE));
    const perPage = Math.ceil(total / numPages);
    const pages = [];
    const buildStart = performance.now();

    // Build the texture atlas FIRST. _buildAtlas() assigns each material's
    // `rect` (its sub-rectangle inside the atlas). The per-page MATERIAL texture
    // built in the loop below copies m.rect into GPU memory, so the atlas MUST
    // exist before that copy — otherwise the material texture is uploaded with
    // the default rect [0,0,1,-1] (w < 0 = "untextured") and the shader never
    // samples the atlas, even though the textures were baked. THIS was the
    // all-white / untextured RTX bug (atlas reported 10/21 baked but nothing
    // showed because the rects never reached the shader).
    const atlas = this._buildAtlas();

    // Per-MATERIAL average texel density (texels per world unit) for a smooth,
    // per-pixel-continuous texture LOD. Computing the mip from each TRIANGLE's
    // own UV/area ratio makes neighbouring triangles pick different mip levels —
    // the surface then prints as facets (sharp vs blurred triangles). One
    // averaged value per material is smooth across the whole surface.
    const matDensity = new Float64Array(this.materials.length).fill(1);
    {
      const uvA = new Float64Array(this.materials.length);
      const wA = new Float64Array(this.materials.length);
      for (const t of triangles) {
        const mi = t.matIndex;
        if (mi < 0 || mi >= this.materials.length) continue;
        const e1x = t.v1[0] - t.v0[0], e1y = t.v1[1] - t.v0[1], e1z = t.v1[2] - t.v0[2];
        const e2x = t.v2[0] - t.v0[0], e2y = t.v2[1] - t.v0[1], e2z = t.v2[2] - t.v0[2];
        const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
        wA[mi] += Math.sqrt(cx * cx + cy * cy + cz * cz);
        const rep = this.materials[mi].repeat || [1, 1];
        const d1x = (t.uv1[0] - t.uv0[0]) * rep[0], d1y = (t.uv1[1] - t.uv0[1]) * rep[1];
        const d2x = (t.uv2[0] - t.uv0[0]) * rep[0], d2y = (t.uv2[1] - t.uv0[1]) * rep[1];
        uvA[mi] += Math.abs(d1x * d2y - d1y * d2x);
      }
      const sz = this._texArraySize || 1024;
      for (let i = 0; i < this.materials.length; i++) {
        matDensity[i] = wA[i] > 1e-8 ? Math.sqrt(uvA[i] / wA[i]) * sz : 1;
      }
    }

    for (let p = 0; p < numPages; p++) {
      const start = p * perPage;
      const end = Math.min(total, start + perPage);
      const pageTris = triangles.slice(start, end);
      // Adjust matIndex? No — keep global matIndex, materials are shared.
      const { nodes, indices } = buildBVH(pageTris);

      const triCount = pageTris.length;
      const orderedPageTris = new Array(triCount);
      const nodeCount = nodes.length;
      const TRI_STRIDE = 9; // 3 pos + 3 uv + 3 smooth normals (texels per tri)
      const triPixels = triCount * TRI_STRIDE;
      const triDims = chooseTexDims(triPixels, maxTexSize, PREFERRED_TEX);
      const triData = new Float32Array(triDims.w * triDims.h * 4);
      for (let i = 0; i < triCount; i++) {
        const t = pageTris[indices[i]];
        orderedPageTris[i] = t;
        const base = i * TRI_STRIDE;
        const write = (off, x, y, z, w) => {
          const p2 = base + off;
          triData[p2 * 4 + 0] = x;
          triData[p2 * 4 + 1] = y;
          triData[p2 * 4 + 2] = z;
          triData[p2 * 4 + 3] = w;
        };
        write(0, t.v0[0], t.v0[1], t.v0[2], t.matIndex);
        write(1, t.v1[0], t.v1[1], t.v1[2], t.matIndex);
        write(2, t.v2[0], t.v2[1], t.v2[2], t.matIndex);
        write(3, t.uv0[0], t.uv0[1], 0, 0);
        write(4, t.uv1[0], t.uv1[1], 0, 0);
        write(5, t.uv2[0], t.uv2[1], 0, 0);
        write(6, t.n0[0], t.n0[1], t.n0[2], 0);
        write(7, t.n1[0], t.n1[1], t.n1[2], 0);
        write(8, t.n2[0], t.n2[1], t.n2[2], 0);
      }
      const triTex = new THREE.DataTexture(
        triData,
        triDims.w,
        triDims.h,
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      triTex.needsUpdate = true;

      // Material texture (one per page is fine; identical content).
      const MAT_STRIDE = 6; // +texel 5: coat, coatRough, rim, sss (shader system)
      const matTexels = Math.max(1, materials.length * MAT_STRIDE);
      const matDims = chooseTexDims(matTexels, maxTexSize, PREFERRED_TEX);
      const matW = matDims.w,
        matH = matDims.h;
      const matData = new Float32Array(matW * matH * 4);
      for (let i = 0; i < materials.length; i++) {
        const m = materials[i];
        const base = i * MAT_STRIDE;
        const o0 = (base + 0) * 4;
        const o1 = (base + 1) * 4;
        const o2 = (base + 2) * 4;
        const o3 = (base + 3) * 4;
        const o4 = (base + 4) * 4;
        matData[o0 + 0] = m.albedo[0];
        matData[o0 + 1] = m.albedo[1];
        matData[o0 + 2] = m.albedo[2];
        matData[o0 + 3] = m.type;
        matData[o1 + 0] = m.emit[0];
        matData[o1 + 1] = m.emit[1];
        matData[o1 + 2] = m.emit[2];
        matData[o1 + 3] = m.fuzz;
        // texel 2 = layers + uv rotation: diffuse layer, sphere layer, sphere
        // blend mode (0 mult / 1 add), uv rotation (radians). -1 layer = none.
        matData[o2 + 0] = m.diffuseLayer != null ? m.diffuseLayer : -1;
        matData[o2 + 1] = m.sphereLayer != null ? m.sphereLayer : -1;
        matData[o2 + 2] = m.sphereMode != null ? m.sphereMode : -1;
        matData[o2 + 3] = m.rotation || 0;
        // texel 3 = UV transform repeat.xy + offset.xy (KHR_texture_transform).
        const rep = m.repeat || [1, 1];
        const off = m.offset || [0, 0];
        matData[o3 + 0] = rep[0];
        matData[o3 + 1] = rep[1];
        matData[o3 + 2] = off[0];
        matData[o3 + 3] = off[1];
        // texel 4 = per-material alpha (x) + per-material texel density (y).
        // alpha: 1 = opaque, < 1 fades overlay layers. density: texels-per-world,
        // drives a smooth per-material LOD (no per-triangle mip facets).
        matData[o4 + 0] = m.alpha != null ? m.alpha : 1;
        matData[o4 + 1] = matDensity[i] || 1;
        matData[o4 + 2] = 0;
        matData[o4 + 3] = 0;
        // texel 5 = flexible shader params: clearcoat strength, clearcoat
        // roughness, rim strength, sss (skin fill). All 0 => legacy look.
        const o5 = (base + 5) * 4;
        matData[o5 + 0] = m.coat || 0;
        matData[o5 + 1] = m.coatRough != null ? m.coatRough : 0.15;
        matData[o5 + 2] = m.rim || 0;
        matData[o5 + 3] = m.sss || 0;
      }
      const matTex = new THREE.DataTexture(
        matData,
        matW,
        matH,
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      matTex.needsUpdate = true;

      // BVH texture.
      const bvhTexels = Math.max(1, nodeCount * 3);
      const bvhDims = chooseTexDims(bvhTexels, maxTexSize, PREFERRED_TEX);
      const bvhW = bvhDims.w,
        bvhH = bvhDims.h;
      const bvhData = new Float32Array(bvhW * bvhH * 4);
      for (let i = 0; i < nodeCount; i++) {
        const n = nodes[i];
        const baseTexel = i * 3;
        const o0 = (baseTexel + 0) * 4;
        const o1 = (baseTexel + 1) * 4;
        const o2 = (baseTexel + 2) * 4;
        bvhData[o0 + 0] = n.min[0];
        bvhData[o0 + 1] = n.min[1];
        bvhData[o0 + 2] = n.min[2];
        bvhData[o1 + 0] = n.max[0];
        bvhData[o1 + 1] = n.max[1];
        bvhData[o1 + 2] = n.max[2];
        if (n.isLeaf) {
          bvhData[o0 + 3] = 1.0;
          bvhData[o2 + 0] = n.start;
          bvhData[o2 + 1] = n.count;
        } else {
          bvhData[o0 + 3] = 0.0;
          bvhData[o2 + 0] = n.left;
          bvhData[o2 + 1] = n.right;
        }
      }
      const bvhTex = new THREE.DataTexture(
        bvhData,
        bvhW,
        bvhH,
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      bvhTex.needsUpdate = true;

      pages.push({
        pageIndex: p,
        triTex,
        matTex,
        bvhTex,
        triTexSize: new THREE.Vector2(triDims.w, triDims.h),
        bvhTexSize: new THREE.Vector2(bvhW, bvhH),
        matTexSize: new THREE.Vector2(matW, matH),
        triCount,
        nodeCount,
        matCount: materials.length,
        triStartIndex: start,
        nodes, // CPU copy for refit
        pageTris: orderedPageTris, // CPU copy in the same order as BVH leaves + tri texture
        triOrder: Int32Array.from(indices),
        bvhDataRef: bvhData,
        bvhTextureRef: bvhTex,
      });
    }

    this.pages = pages;
    this.triCount = total;
    this.nodeCount = pages.reduce((s, p) => s + p.nodeCount, 0);

    // Attach the (already-built, see above) atlas to every page.
    if (atlas) {
      for (const p of this.pages) p.atlasTex = atlas;
    }

    this.ready = pages.length > 0 && pages[0].triCount > 0;
    const buildMs = performance.now() - buildStart;
    console.info(
      `[RTX] Built ${pages.length} page(s), ${total} tris, ${this.nodeCount} BVH nodes in ${buildMs.toFixed(0)}ms`,
    );
    return this.ready;
  }

  /** @param {THREE.Scene} scene @param {object} opts */
  rebuildIfNeeded(scene, opts = {}) {
    const sig = this._sceneSignature(scene, opts);
    if (sig === this._rebuildSig && this.ready) return false;
    this._rebuildSig = sig;
    return this.rebuildFromScene(scene, opts);
  }

  _sceneSignature(scene, opts) {
    let tris = 0;
    let meshes = 0;
    const excludeRoots = opts.excludeRoots || [];
    const extraExclude = opts.extraExclude || (() => false);
    const isUnderExcluded = (obj) => {
      for (const r of excludeRoots) {
        if (r && obj === r) return true;
        let p = obj.parent;
        while (p) {
          if (p === r) return true;
          p = p.parent;
        }
      }
      return false;
    };
    scene.traverse((o) => {
      if (
        !isRenderVisible(o) ||
        isUnderExcluded(o) ||
        o.isLight ||
        o.isCamera ||
        o.type === "Line" ||
        o.type === "LineSegments" ||
        o.type === "Points" ||
        o.userData?.rtxSkip ||
        extraExclude(o)
      ) {
        return;
      }
      if (o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.isBatchedMesh) {
        meshes++;
        tris += objectTriangleCount(o);
      }
    });
    return `${meshes}|${tris}|${excludeRoots.length}`;
  }

  /**
   * Refit BVH bounds bottom-up using parent pointers. O(N), no recursion.
   * Nodes are stored in pre-order (parent index < child index), so a single
   * backwards pass always sees children before their parents.
   * When a dirty global-triangle window [lo, hi) is given, pages that don't
   * overlap it are skipped entirely.
   */
  _refitBVH(lo = -Infinity, hi = Infinity) {
    for (const p of this.pages) {
      const pageStart = p.triStartIndex;
      const pageEnd = pageStart + p.pageTris.length;
      if (pageEnd <= lo || pageStart >= hi) continue; // untouched page

      const nodes = p.nodes;
      const pageTris = p.pageTris;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.isLeaf) {
          const s = n.start,
            cnt = n.count;
          let minX = Infinity,
            minY = Infinity,
            minZ = Infinity;
          let maxX = -Infinity,
            maxY = -Infinity,
            maxZ = -Infinity;
          for (let k = 0; k < cnt; k++) {
            const t = pageTris[s + k];
            const a = t.v0,
              b = t.v1,
              c = t.v2;
            if (a[0] < minX) minX = a[0];
            if (a[0] > maxX) maxX = a[0];
            if (a[1] < minY) minY = a[1];
            if (a[1] > maxY) maxY = a[1];
            if (a[2] < minZ) minZ = a[2];
            if (a[2] > maxZ) maxZ = a[2];
            if (b[0] < minX) minX = b[0];
            if (b[0] > maxX) maxX = b[0];
            if (b[1] < minY) minY = b[1];
            if (b[1] > maxY) maxY = b[1];
            if (b[2] < minZ) minZ = b[2];
            if (b[2] > maxZ) maxZ = b[2];
            if (c[0] < minX) minX = c[0];
            if (c[0] > maxX) maxX = c[0];
            if (c[1] < minY) minY = c[1];
            if (c[1] > maxY) maxY = c[1];
            if (c[2] < minZ) minZ = c[2];
            if (c[2] > maxZ) maxZ = c[2];
          }
          n.min[0] = minX;
          n.min[1] = minY;
          n.min[2] = minZ;
          n.max[0] = maxX;
          n.max[1] = maxY;
          n.max[2] = maxZ;
        } else {
          const l = nodes[n.left],
            r = nodes[n.right];
          n.min[0] = Math.min(l.min[0], r.min[0]);
          n.min[1] = Math.min(l.min[1], r.min[1]);
          n.min[2] = Math.min(l.min[2], r.min[2]);
          n.max[0] = Math.max(l.max[0], r.max[0]);
          n.max[1] = Math.max(l.max[1], r.max[1]);
          n.max[2] = Math.max(l.max[2], r.max[2]);
        }
      }
      // Upload refreshed bounds to the GPU copy.
      const bvhData = p.bvhDataRef;
      const nodeCount = nodes.length;
      for (let i = 0; i < nodeCount; i++) {
        const n = nodes[i];
        const baseTexel = i * 3;
        const o0 = (baseTexel + 0) * 4;
        const o1 = (baseTexel + 1) * 4;
        bvhData[o0 + 0] = n.min[0];
        bvhData[o0 + 1] = n.min[1];
        bvhData[o0 + 2] = n.min[2];
        bvhData[o1 + 0] = n.max[0];
        bvhData[o1 + 1] = n.max[1];
        bvhData[o1 + 2] = n.max[2];
      }
      p.bvhTextureRef.needsUpdate = true;
    }
  }

  /**
   * Upload triangle data to the GPU. With a dirty global window [lo, hi):
   *   - pages with no overlap are skipped (no CPU writes, no GPU upload);
   *   - inside a touched page only the dirty slots' POSITION texels are
   *     rewritten (UVs/material ids never animate).
   * Without arguments it rewrites everything (used right after a build).
   */
  _uploadTriPositions(lo = -Infinity, hi = Infinity) {
    const partial = Number.isFinite(lo) || Number.isFinite(hi);
    for (const p of this.pages) {
      const pageStart = p.triStartIndex;
      const pageEnd = pageStart + p.pageTris.length;
      if (pageEnd <= lo || pageStart >= hi) continue; // untouched page

      const triData = p.triTex.image.data;
      const pageTris = p.pageTris;
      const order = p.triOrder;
      const triCount = p.triCount;
      const TRI_STRIDE = 9; // keep in sync with the build write (pos+uv+normals)
      for (let i = 0; i < triCount; i++) {
        if (partial && order) {
          const global = pageStart + order[i];
          if (global < lo || global >= hi) continue; // clean slot
        }
        const t = pageTris[i];
        const base = (i * TRI_STRIDE) * 4;
        const v0 = t.v0,
          v1 = t.v1,
          v2 = t.v2;
        triData[base + 0] = v0[0];
        triData[base + 1] = v0[1];
        triData[base + 2] = v0[2];
        triData[base + 3] = t.matIndex;
        triData[base + 4] = v1[0];
        triData[base + 5] = v1[1];
        triData[base + 6] = v1[2];
        triData[base + 7] = t.matIndex;
        triData[base + 8] = v2[0];
        triData[base + 9] = v2[1];
        triData[base + 10] = v2[2];
        triData[base + 11] = t.matIndex;
        if (!partial) {
          triData[base + 12] = t.uv0[0];
          triData[base + 13] = t.uv0[1];
          triData[base + 14] = 0;
          triData[base + 15] = 0;
          triData[base + 16] = t.uv1[0];
          triData[base + 17] = t.uv1[1];
          triData[base + 18] = 0;
          triData[base + 19] = 0;
          triData[base + 20] = t.uv2[0];
          triData[base + 21] = t.uv2[1];
          triData[base + 22] = 0;
          triData[base + 23] = 0;
        }
        // smooth normals (texels 6,7,8): on a full upload, AND on partial refits
        // when skinned normals are being re-skinned each frame (RTX_REFIT.normals).
        if (!partial || RTX_REFIT.normals) {
          const n0 = t.n0, n1 = t.n1, n2 = t.n2;
          if (n0 && n1 && n2) {
            triData[base + 24] = n0[0];
            triData[base + 25] = n0[1];
            triData[base + 26] = n0[2];
            triData[base + 28] = n1[0];
            triData[base + 29] = n1[1];
            triData[base + 30] = n1[2];
            triData[base + 32] = n2[0];
            triData[base + 33] = n2[1];
            triData[base + 34] = n2[2];
          }
        }
      }
      p.triTex.needsUpdate = true;
    }
  }

  /** Exact world-matrix comparison against the stored snapshot. */
  _matrixChanged(range, obj) {
    const snap = range.matrixSnapshot;
    const el = obj.matrixWorld.elements;
    for (let i = 0; i < 16; i++) {
      if (snap[i] !== el[i]) return true;
    }
    return false;
  }

  _morphChanged(range, obj) {
    const snap = range.morphSnapshot;
    const cur = obj.morphTargetInfluences;
    if (!snap || !cur) return !!snap !== !!cur;
    if (snap.length !== cur.length) return true;
    for (let i = 0; i < snap.length; i++) {
      if (snap[i] !== cur[i]) return true;
    }
    return false;
  }

  /**
   * Cheap pose hash for skinned meshes: samples the skeleton's bone matrices
   * and morph influences. Lets us skip ALL per-frame work when the animation
   * is paused, so the accumulator can converge to a noise-free frame.
   */
  _poseHash(obj) {
    let h = 0;
    const bm = obj.skeleton?.boneMatrices;
    if (bm) {
      for (let i = 0; i < bm.length; i += 4) h += bm[i] * ((i & 1023) + 1);
    }
    const mi = obj.morphTargetInfluences;
    if (mi) {
      for (let i = 0; i < mi.length; i++) h += mi[i] * (i + 101);
    }
    return h;
  }

  /**
   * Per-frame dynamic update — the fast path.
   *
   * The old implementation re-extracted EVERY triangle in the scene (static
   * 100k+ poly maps included) and re-allocated one JS object per triangle,
   * every call. This version:
   *   - re-extracts only ranges that actually changed (skinned meshes with a
   *     new pose, rigid meshes whose world matrix / instance buffer / morphs
   *     changed), mutating the existing triangle records in place;
   *   - uploads / refits only the BVH pages overlapping the dirty window;
   *   - returns false (zero GPU traffic) when nothing moved.
   */
  updateDynamic(scene, opts = {}) {
    if (!this.ready || this.pages.length === 0) {
      return this.rebuildFromScene(scene, opts);
    }
    // Structural guard: the set/size of visible meshes changed (model added,
    // hidden, instance count changed...) => geometry slots are stale => full
    // rebuild. This is a light traverse, no extraction.
    //
    // CONFIRMATION GATE: overlay/capture passes toggle mesh visibility
    // INSIDE a frame, so a single-check mismatch can oscillate A/B/A/B
    // forever — that used to trigger a FULL BVH rebuild stream (and endless
    // accumulation resets). A structural change is only trusted when TWO
    // CONSECUTIVE checks read the SAME new signature; flicker never
    // confirms, a real change confirms one check later.
    const sig = this._sceneSignature(scene, opts);
    if (sig !== this._rebuildSig) {
      if (sig === this._pendingSig) {
        this._pendingSig = null;
        console.info(
          "[RTX] structural scene change confirmed:",
          this._rebuildSig, "->", sig, "— rebuilding BVH",
        );
        this._rebuildSig = sig;
        return this.rebuildFromScene(scene, opts);
      }
      this._pendingSig = sig; // remember; confirm (or drop) on the next check
    } else {
      this._pendingSig = null;
    }
    if (!this.ranges || this.ranges.length === 0) {
      return this.rebuildFromScene(scene, opts);
    }

    scene.updateMatrixWorld(true);

    let lo = Infinity,
      hi = -Infinity;
    for (const r of this.ranges) {
      const obj = r.object;
      if (!obj || !obj.geometry) {
        return this.rebuildFromScene(scene, opts);
      }
      let dirty = false;
      if (r.skinned) {
        try {
          obj.skeleton?.update?.();
        } catch (_e) {}
        const hash = this._poseHash(obj);
        if (hash !== r.poseHash) {
          r.poseHash = hash;
          dirty = true;
        }
      }
      if (!dirty && this._matrixChanged(r, obj)) dirty = true;
      if (
        !dirty &&
        obj.isInstancedMesh &&
        (obj.instanceMatrix?.version ?? 0) !== r.instanceVersion
      ) {
        dirty = true;
      }
      if (!dirty && !r.skinned && r.morphSnapshot && this._morphChanged(r, obj)) {
        dirty = true;
      }
      if (!dirty) continue;

      if (!reextractPositionsInPlace(r, this.triangles)) {
        return this.rebuildFromScene(scene, opts);
      }
      // Re-skin this range's shading normals to the deformed pose (skinned meshes
      // only; no-op when RTX_REFIT.normals is false).
      recomputeRangeNormalsInPlace(r, this.triangles);
      r.matrixSnapshot.set(obj.matrixWorld.elements);
      if (obj.isInstancedMesh) {
        r.instanceVersion = obj.instanceMatrix?.version ?? 0;
      }
      if (
        r.morphSnapshot &&
        obj.morphTargetInfluences &&
        r.morphSnapshot.length === obj.morphTargetInfluences.length
      ) {
        r.morphSnapshot.set(obj.morphTargetInfluences);
      }
      if (r.start < lo) lo = r.start;
      if (r.start + r.count > hi) hi = r.start + r.count;
    }

    if (hi < 0) return false; // scene is static this frame — nothing to do

    this._uploadTriPositions(lo, hi);
    this._refitBVH(lo, hi);
    return true;
  }

  bindUniforms(uniforms) {
    if (!this.ready || this.pages.length === 0) {
      uniforms.uSceneReady.value = 0;
      uniforms.uPageCount.value = 0;
      return;
    }
    // Backward-compat single-page uniforms point at page 0.
    const p0 = this.pages[0];
    uniforms.uSceneReady.value = 1;
    uniforms.uPageCount.value = this.pages.length;
    uniforms.uTriData.value = p0.triTex;
    uniforms.uMatData.value = p0.matTex;
    uniforms.uBvhNodes.value = p0.bvhTex;
    uniforms.uAtlas.value = p0.atlasTex || null;
    if (uniforms.uTexSize) uniforms.uTexSize.value = this._texArraySize || 1024;
    uniforms.uTriCount.value = p0.triCount;
    uniforms.uNodeCount.value = p0.nodeCount;
    uniforms.uMatCount.value = p0.matCount;
    uniforms.uTriTexSize.value.copy(p0.triTexSize);
    uniforms.uBvhTexSize.value.copy(p0.bvhTexSize);
    uniforms.uMatTexSize.value.copy(p0.matTexSize);

    // Push page-indexed uniforms. The shader declares fixed-size arrays
    // (sampler2D/vec2/int [MAX_PAGES]) and references every slot (indices 1..3
    // plus uTriCountPages[pg]), so GLSL keeps them all active. WebGL therefore
    // needs *every* element uploaded with a valid value even for single-page
    // scenes — leaving them as empty JS arrays crashes the uniform upload
    // (flatten -> undefined.toArray for vec2[], "uniform1iv: no array" for
    // int[]). We always fill to MAX_PAGES, mirroring page 0 into unused slots.
    if (uniforms.uTriDataPages) {
      const triArr = uniforms.uTriDataPages.value;
      const bvhArr = uniforms.uBvhNodesPages.value;
      const triSizeArr = uniforms.uTriTexSizePages.value;
      const bvhSizeArr = uniforms.uBvhTexSizePages.value;
      const triCntArr = uniforms.uTriCountPages.value;
      const nodeCntArr = uniforms.uNodeCountPages.value;
      while (triArr.length < MAX_PAGES) triArr.push(null);
      while (bvhArr.length < MAX_PAGES) bvhArr.push(null);
      while (triSizeArr.length < MAX_PAGES)
        triSizeArr.push(new THREE.Vector2(1, 1));
      while (bvhSizeArr.length < MAX_PAGES)
        bvhSizeArr.push(new THREE.Vector2(1, 1));
      while (triCntArr.length < MAX_PAGES) triCntArr.push(0);
      while (nodeCntArr.length < MAX_PAGES) nodeCntArr.push(0);
      for (let i = 0; i < MAX_PAGES; i++) {
        // Real page if present; otherwise mirror page 0 so every sampler slot
        // points at a valid texture (counts stay 0 so the shader skips it).
        const pg = this.pages[i] || p0;
        const active = i < this.pages.length;
        triArr[i] = pg.triTex;
        bvhArr[i] = pg.bvhTex;
        triSizeArr[i].copy(pg.triTexSize);
        bvhSizeArr[i].copy(pg.bvhTexSize);
        triCntArr[i] = active ? pg.triCount : 0;
        nodeCntArr[i] = active ? pg.nodeCount : 0;
      }
    }
  }

  dispose() {
    this._disposeAll();
    this.ready = false;
    this.triangles = [];
    this.materials = [];
    this.materialRefs = [];
  }
}