/**
 * map-builder-optim.js
 * ---------------------------------------------------------------------------
 * Map Builder static-geometry + post-FX optimizations (Three.js r166 / WebGL2).
 * Ignores SkinnedMesh / MMD — map props, backdrop, SSAO, volumetrics, env maps.
 *
 * @module map-builder-optim
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Main camera sees map static meshes on this layer. */
export const MAP_STATIC_LAYER = 1;

/** Env/reflection capture ignores MAP_STATIC_LAYER (sky + stage only). */
export const ENV_CAPTURE_LAYERS = 0;

const _m4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();

function geometryMergeSignature(geometry) {
  const attributes = Object.entries(geometry.attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, attribute]) => [
      name,
      attribute.array?.constructor?.name || 'unknown',
      attribute.itemSize,
      attribute.normalized ? 1 : 0,
      attribute.gpuType ?? -1,
    ].join(':'))
    .join('|');
  const morphs = Object.entries(geometry.morphAttributes || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, targets]) =>
      `${name}:${targets.length}:${targets
        .map(a => `${a.array?.constructor?.name || 'unknown'}:${a.itemSize}:${a.normalized ? 1 : 0}:${a.gpuType ?? -1}`)
        .join(',')}`)
    .join('|');
  return [
    geometry.index ? 'indexed' : 'nonindexed',
    geometry.morphTargetsRelative ? 'relative' : 'absolute',
    attributes,
    morphs,
  ].join('::');
}

// =============================================================================
// §1 MAP ASSET LOADER OPTIMIZATION
// =============================================================================

/**
 * Merge all sub-meshes inside one imported prop (City.obj) that share a material.
 * Turns hundreds of draw calls into one per material — main CPU/GPU win for OBJ.
 *
 * Why: exporters emit one mesh per polygon group; the GPU cares about draw calls,
 * not triangle count. 235k tris across 800 meshes → 800 draw calls + 800 matrix updates.
 */
export function mergeMapPropMeshesByMaterial(root, opts = {}) {
  const minToMerge = opts.minMeshesToMerge ?? 2;
  if (!root) return { drawCallsBefore: 0, drawCallsAfter: 0, mergedGroups: 0 };

  root.updateMatrixWorld(true);
  _m4.copy(root.matrixWorld).invert();

  const buckets = new Map();
  const meshNodes = [];

  root.traverse(obj => {
    if (!obj.isMesh || !obj.geometry) return;
    if (obj.isSkinnedMesh || obj.isInstancedMesh || obj.userData.skipMerge) return;
    // Multi-material geometries carry groups and cannot be collapsed as if
    // their first material owned every triangle.
    if (Array.isArray(obj.material)) return;
    const mat = obj.material;
    if (!mat) return;
    meshNodes.push(obj);
    const key = `${mat.uuid}|${geometryMergeSignature(obj.geometry)}`;
    if (!buckets.has(key)) {
      buckets.set(key, { material: mat, geos: [], nodes: [] });
    }
    const g = obj.geometry.clone();
    g.applyMatrix4(obj.matrixWorld);
    g.applyMatrix4(_m4);
    buckets.get(key).geos.push(g);
    buckets.get(key).nodes.push(obj);
  });

  const drawCallsBefore = meshNodes.length;
  if (drawCallsBefore < minToMerge) {
    return { drawCallsBefore, drawCallsAfter: drawCallsBefore, mergedGroups: 0 };
  }

  let mergedGroups = 0;
  const toRemove = new Set();

  for (const [, bucket] of buckets) {
    if (bucket.geos.length < minToMerge) {
      bucket.geos.forEach(g => g.dispose());
      continue;
    }
    try {
      const merged = BufferGeometryUtils.mergeGeometries(bucket.geos, false);
      if (!merged) {
        bucket.geos.forEach(g => g.dispose());
        continue;
      }
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = opts.castShadow !== false;
      mesh.receiveShadow = opts.receiveShadow !== false;
      mesh.name = `merged_${bucket.material.name || 'mat'}`;
      mesh.layers.enable(MAP_STATIC_LAYER);
      root.add(mesh);
      mergedGroups++;
      bucket.geos.forEach(g => g.dispose());
      bucket.nodes.forEach(n => toRemove.add(n));
    } catch (err) {
      console.warn('[MapOptim] mergeGeometries failed:', err);
      bucket.geos.forEach(g => g.dispose());
    }
  }

  for (const node of toRemove) {
    node.parent?.remove(node);
  }

  const drawCallsAfter = drawCallsBefore - toRemove.size + mergedGroups;
  if (mergedGroups > 0) {
    console.info(`[MapOptim] merged ${toRemove.size} meshes → ${mergedGroups} draw call(s) (${drawCallsBefore} → ${drawCallsAfter})`);
  }
  return { drawCallsBefore, drawCallsAfter, mergedGroups };
}

/**
 * InstancedMesh for duplicated props (same fileName + shared geometry uuid after clone).
 * Call after map layout is stable — moving a source prop requires rebuild.
 */
export function rebuildDuplicatePropInstancing(propsRoot, entries, opts = {}) {
  propsRoot.children
    .filter(c => c.userData?.isMapInstancedBucket)
    .forEach(c => {
      c.traverse(o => { if (o.geometry && o.userData?.ownsGeometry) o.geometry.dispose(); });
      propsRoot.remove(c);
    });

  entries.forEach(e => {
    e.object3d?.traverse(o => {
      if (o.isMesh) o.userData.instancedOut = false;
    });
  });

  const minInst = opts.minInstances ?? 2;
  const buckets = new Map();

  for (const entry of entries) {
    if (!entry.object3d || entry.visible === false) continue;
    entry.object3d.updateMatrixWorld(true);
    entry.object3d.traverse(obj => {
      if (!obj.isMesh || !obj.geometry || obj.userData.skipInstancing) return;
      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (!mat) return;
      const key = `${entry.fileName}|${obj.geometry.uuid}|${mat.uuid}`;
      if (!buckets.has(key)) buckets.set(key, { geo: obj.geometry, mat, matrices: [], meshes: [] });
      const b = buckets.get(key);
      b.matrices.push(new THREE.Matrix4().copy(obj.matrixWorld));
      b.meshes.push(obj);
    });
  }

  const bucketRoot = new THREE.Group();
  bucketRoot.name = 'mapInstancedBuckets';
  bucketRoot.userData.isMapInstancedBucket = true;

  for (const [, b] of buckets) {
    if (b.matrices.length < minInst) continue;
    const im = new THREE.InstancedMesh(b.geo, b.mat, b.matrices.length);
    for (let i = 0; i < b.matrices.length; i++) im.setMatrixAt(i, b.matrices[i]);
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = true;
    im.layers.enable(MAP_STATIC_LAYER);
    freezeMapPropMatrices(im);
    bucketRoot.add(im);
    b.meshes.forEach(m => {
      m.userData._prevVisible = m.visible;
      m.visible = false;
      m.userData.instancedOut = true;
    });
  }

  if (bucketRoot.children.length) propsRoot.add(bucketRoot);
  return bucketRoot.children.length;
}

/**
 * BatchedMesh for unique static sub-meshes sharing one material (r166: addGeometry + addInstance).
 */
export function batchMapPropByMaterial(root, material, meshList, opts = {}) {
  if (!meshList?.length) return null;

  const items = meshList.map(obj => {
    const g = obj.geometry.clone();
    g.applyMatrix4(obj.matrixWorld);
    g.applyMatrix4(_m4.copy(root.matrixWorld).invert());
    return { geometry: g, matrix: new THREE.Matrix4().identity() };
  });

  let verts = 0;
  let inds = 0;
  for (const it of items) {
    const p = it.geometry.getAttribute('position');
    if (p) verts += p.count;
    if (it.geometry.index) inds += it.geometry.index.count;
    else if (p) inds += p.count;
  }

  const batched = new THREE.BatchedMesh(
    items.length,
    Math.ceil(verts * 1.1),
    Math.ceil(inds * 1.1),
    material,
  );

  const geoIds = new Map();
  for (const it of items) {
    let gid = geoIds.get(it.geometry.uuid);
    if (gid == null) {
      gid = batched.addGeometry(it.geometry);
      geoIds.set(it.geometry.uuid, gid);
    }
    const iid = batched.addInstance(gid);
    batched.setMatrixAt(iid, it.matrix);
    batched.setVisibleAt(iid, true);
  }
  batched.computeBoundingBox();
  batched.layers.enable(MAP_STATIC_LAYER);
  freezeMapPropMatrices(batched);
  root.add(batched);
  if (opts.removeSources !== false) meshList.forEach(m => m.parent?.remove(m));
  return batched;
}

/** matrixAutoUpdate off after Map Builder placement — saves CPU traverse. */
export function freezeMapPropMatrices(root) {
  if (!root) return;
  root.traverse(obj => {
    if (obj.isSkinnedMesh) return;
    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
  });
  root.updateMatrixWorld(true);
}

export function unfreezeMapPropMatrices(root) {
  root?.traverse(obj => { obj.matrixAutoUpdate = true; });
}

/** Tag map meshes + ensure main camera sees MAP_STATIC_LAYER. */
export function tagMapPropRenderLayers(root, mainCamera) {
  root?.traverse(obj => {
    if (obj.isMesh || obj.isInstancedMesh || obj.isBatchedMesh) {
      obj.layers.enable(MAP_STATIC_LAYER);
    }
  });
  mainCamera.layers.enable(MAP_STATIC_LAYER);
}

/**
 * Full import pipeline for one placed prop.
 */
export function optimizeImportedMapProp(object3d, opts = {}) {
  if (!object3d) return null;
  const merge = mergeMapPropMeshesByMaterial(object3d, opts);
  tagMapPropRenderLayers(object3d, opts.mainCamera);
  freezeMapPropMatrices(object3d);
  object3d.userData.mapOptimized = true;
  object3d.userData.drawCallsBefore = merge.drawCallsBefore;
  object3d.userData.drawCallsAfter = merge.drawCallsAfter;
  return merge;
}

let _rebuildTimer = null;
export function scheduleMapSceneRebuild(propsRoot, getEntries, opts = {}, delayMs = 400) {
  clearTimeout(_rebuildTimer);
  _rebuildTimer = setTimeout(() => {
    const entries = getEntries();
    if (opts.instancing !== false) rebuildDuplicatePropInstancing(propsRoot, entries, opts);
  }, delayMs);
}

/** Remove instanced buckets and show source meshes (required for live gizmo feedback). */
export function clearMapPropInstancing(propsRoot) {
  if (!propsRoot) return;
  const buckets = propsRoot.children.filter(c => c.userData?.isMapInstancedBucket);
  for (const bucket of buckets) {
    propsRoot.remove(bucket);
    // InstancedMesh shares geometry/material with source meshes — do not dispose GPU buffers.
  }
  propsRoot.traverse(obj => {
    if (!obj.isMesh) return;
    if (obj.userData.instancedOut) {
      obj.visible = obj.userData._prevVisible !== false;
      obj.userData.instancedOut = false;
    }
    delete obj.userData._prevVisible;
  });
}

/**
 * Begin transform gizmo drag — unfreeze matrices + show real meshes (not stale instances).
 */
export function beginMapPropTransformEdit(propsRoot, object3d) {
  clearMapPropInstancing(propsRoot);
  unfreezeMapPropMatrices(object3d);
  object3d.updateMatrixWorld(true);
}

/**
 * End transform gizmo drag — refreeze and rebuild instancing after a short debounce.
 */
export function endMapPropTransformEdit(propsRoot, object3d, getEntries, opts = {}) {
  if (object3d) {
    object3d.updateMatrixWorld(true);
    freezeMapPropMatrices(object3d);
  }
  scheduleMapSceneRebuild(propsRoot, getEntries, opts);
}

/** Call each frame while dragging so children follow the gizmo immediately. */
export function refreshMapPropTransform(object3d) {
  if (!object3d) return;
  object3d.updateMatrix();
  object3d.updateMatrixWorld(true);
}

// =============================================================================
// §2 POST-FX — HALF-RES SSAO (4× fewer pixels in depth/normal + AO passes)
// =============================================================================

export function getScaledPassSize(width, height, scale = 0.5) {
  return {
    w: Math.max(4, Math.floor(width * scale)),
    h: Math.max(4, Math.floor(height * scale)),
  };
}

/**
 * Wrapper: SSAOPass at reduced resolution. Built-in SSAOBlurShader ≈ bilateral blur;
 * upscaling happens when compositing half-res AO onto full-res readBuffer.
 */
export class HalfResSSAOPass extends Pass {
  constructor(scene, camera, width, height, resolutionScale = 0.5) {
    super();
    this.resolutionScale = resolutionScale;
    this.ssaoPass = new SSAOPass(scene, camera, width, height);
    this.ssaoPass.output = SSAOPass.OUTPUT.Default;
    this.ssaoPass.normalMaterial.skinning = false;
    this.enabled = true;
    this.needsSwap = false;
    this.clear = true;
  }

  get kernelRadius() { return this.ssaoPass.kernelRadius; }
  set kernelRadius(v) { this.ssaoPass.kernelRadius = v; }
  get minDistance() { return this.ssaoPass.minDistance; }
  set minDistance(v) { this.ssaoPass.minDistance = v; }
  get maxDistance() { return this.ssaoPass.maxDistance; }
  set maxDistance(v) { this.ssaoPass.maxDistance = v; }

  setSize(fullW, fullH) {
    const { w, h } = getScaledPassSize(fullW, fullH, this.resolutionScale);
    this.ssaoPass.setSize(w, h);
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.ssaoPass.renderToScreen = this.renderToScreen;
    this.ssaoPass.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }

  dispose() {
    this.ssaoPass.dispose();
  }
}

// =============================================================================
// §3 VOLUMETRIC / ENV / REFLECTOR HELPERS
// =============================================================================

/**
 * Patch VolumetricLightPass instance for half-res depth + raymarch (≈4× cheaper).
 * @param {object} pass - VolumetricLightPass from mmd_rtx.html
 * @param {number} [scale=0.5]
 */
export function configureHalfResVolumetricPass(pass, scale = 0.5) {
  pass._volResScale = scale;
  const origSetSize = pass.setSize.bind(pass);
  pass.setSize = (w, h) => {
    const sw = Math.max(4, Math.floor(w * scale));
    const sh = Math.max(4, Math.floor(h * scale));
    origSetSize(sw, sh);
  };
  return pass;
}

/** Clamp raymarch steps under load (fragment shader loops up to 48). */
export function applyVolumetricQualityPreset(pass, preset = 'map') {
  const u = pass.uniforms;
  if (preset === 'map') {
    u.uSamples.value = Math.min(u.uSamples.value, 20);
    u.uGodRays.value = Math.min(u.uGodRays.value, 0.85);
  } else if (preset === 'performance') {
    u.uSamples.value = 12;
    u.uGodRays.value = 0.5;
  }
}

/**
 * Throttled CubeCamera env probe — avoids 6× scene renders per sphere per frame.
 * Layer mask excludes heavy map geometry (MAP_STATIC_LAYER).
 */
export class ThrottledCubeEnvProbe {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.intervalFrames = opts.intervalFrames ?? 8;
    this.resolution = opts.resolution ?? 256;
    this._frame = 0;
    this._dirty = true;

    this.renderTarget = new THREE.WebGLCubeRenderTarget(this.resolution, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.camera = new THREE.CubeCamera(0.1, 500, this.renderTarget);
    this.camera.layers.set(ENV_CAPTURE_LAYERS);
  }

  invalidate() { this._dirty = true; }

  /** Attach one or more glossy meshes; shared cube map, throttled updates. */
  attachToMeshes(meshes, scene) {
    this._meshes = Array.isArray(meshes) ? meshes : [meshes];
    this._scene = scene;
    for (const mesh of this._meshes) {
      if (mesh?.material) {
        mesh.material.envMap = this.renderTarget.texture;
        mesh.material.needsUpdate = true;
      }
    }
  }

  update(mainCamera) {
    if (!this._meshes?.length || !this._scene) return;
    this._frame++;
    const moved = mainCamera && this._lastCamPos && mainCamera.position.distanceToSquared(this._lastCamPos) > 0.04;
    if (!this._dirty && !moved && this._frame % this.intervalFrames !== 0) return;

    this._lastCamPos = mainCamera?.position?.clone?.() ?? null;
    this._meshes[0].getWorldPosition(_pos);
    this.camera.position.copy(_pos);
    this.camera.update(this.renderer, this._scene);
    this._dirty = false;
  }

  dispose() {
    this.renderTarget.dispose();
  }
}

/** Reflector virtual camera: skip map layer + update every N frames. */
export function optimizePlanarReflector(reflector, opts = {}) {
  if (!reflector?.onBeforeRender) return reflector;

  const interval = opts.intervalFrames ?? 4;
  const maxTex = opts.maxTextureSize ?? 1024;
  const origOnBeforeRender = reflector.onBeforeRender;

  if (reflector.getRenderTarget) {
    const rt = reflector.getRenderTarget();
    const w = Math.min(maxTex, rt.width || maxTex);
    const h = Math.min(maxTex, rt.height || maxTex);
    rt.setSize(w, h);
  }

  if (opts.captureLayersOnly) reflector.camera.layers.set(ENV_CAPTURE_LAYERS);

  let frame = 0;
  reflector.onBeforeRender = function onBeforeRenderThrottled(renderer, scene, camera) {
    frame++;
    if (frame % interval !== 0) return;
    if (opts.captureLayersOnly) this.camera.layers.set(ENV_CAPTURE_LAYERS);
    origOnBeforeRender.call(this, renderer, scene, camera);
  };

  return reflector;
}

// =============================================================================
// §4 RENDERER INIT
// =============================================================================

export function createMapOptimizedRenderer(parentEl, opts = {}) {
  const maxDPR = opts.maxPixelRatio ?? 1.5;
  const renderer = new THREE.WebGLRenderer({
    antialias: opts.antialias ?? false,
    alpha: opts.alpha ?? false,
    powerPreference: 'high-performance',
    precision: opts.precision ?? 'mediump',
    preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (parentEl) parentEl.appendChild(renderer.domElement);
  return renderer;
}

export function applyRendererPixelRatioCap(renderer, max = 1.5) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, max));
}

export class DynamicResolutionGovernor {
  constructor(renderer, onResize, opts = {}) {
    this.renderer = renderer;
    this.onResize = onResize;
    this.baseDPR = Math.min(opts.maxPixelRatio ?? 1.5, window.devicePixelRatio || 1);
    this.scales = opts.scales ?? [1, 0.85, 0.72, 0.62];
    this.tier = 0;
    this.lowFps = opts.lowFps ?? 30;
    this.highFps = opts.highFps ?? 55;
    this.cooldownMs = opts.cooldownMs ?? 1100;
    this._last = 0;
  }

  tick(fps, now = performance.now()) {
    if (now - this._last < this.cooldownMs) return;
    let t = this.tier;
    if (fps < this.lowFps && t < this.scales.length - 1) t++;
    else if (fps > this.highFps && t > 0) t--;
    if (t === this.tier) return;
    this.tier = t;
    this._last = now;
    const dpr = Math.max(0.45, this.baseDPR * this.scales[t]);
    this.renderer.setPixelRatio(dpr);
    this.onResize?.();
  }
}
