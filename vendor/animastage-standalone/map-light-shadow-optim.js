/**
 * map-light-shadow-optim.js — Map Builder + global shadow quality (Three.js r166)
 */

import * as THREE from 'three';

const _v = new THREE.Vector3();

/** Built-in quality presets — user can pick one or switch to Custom. */
export const SHADOW_QUALITY_PRESETS = Object.freeze({
  low: {
    label: 'Low (fastest)',
    sunMap: 512,
    moonMap: 256,
    mapPoint: 256,
    mapSpot: 512,
    maxCasters: 2,
    maxPoint: 0,
    updatesPerFrame: 1,
    softness: 1,
    type: 'basic',
  },
  medium: {
    label: 'Medium (balanced)',
    sunMap: 1024,
    moonMap: 512,
    mapPoint: 512,
    mapSpot: 1024,
    maxCasters: 3,
    maxPoint: 1,
    updatesPerFrame: 2,
    softness: 2,
    type: 'pcfsoft',
  },
  high: {
    label: 'High',
    sunMap: 2048,
    moonMap: 1024,
    mapPoint: 768,
    mapSpot: 1536,
    maxCasters: 4,
    maxPoint: 1,
    updatesPerFrame: 2,
    softness: 3,
    type: 'pcfsoft',
  },
  ultra: {
    label: 'Ultra (slow)',
    sunMap: 4096,
    moonMap: 2048,
    mapPoint: 1024,
    mapSpot: 2048,
    maxCasters: 6,
    maxPoint: 2,
    updatesPerFrame: 3,
    softness: 4,
    type: 'pcfsoft',
  },
});

/** Live settings (updated from UI / presets). */
export let shadowQualitySettings = {
  preset: 'medium',
  ...SHADOW_QUALITY_PRESETS.medium,
};

const SHADOW_TYPE_MAP = Object.freeze({
  basic: THREE.BasicShadowMap,
  pcf: THREE.PCFShadowMap,
  pcfsoft: THREE.PCFSoftShadowMap,
  vsm: THREE.VSMShadowMap,
});

export function getShadowQualitySettings() {
  return shadowQualitySettings;
}

export function applyShadowQualityPreset(presetName) {
  const p = SHADOW_QUALITY_PRESETS[presetName];
  if (!p) return shadowQualitySettings;
  shadowQualitySettings = { preset: presetName, ...p };
  return shadowQualitySettings;
}

export function patchShadowQualitySettings(partial) {
  shadowQualitySettings = { ...shadowQualitySettings, ...partial, preset: 'custom' };
  return shadowQualitySettings;
}

/**
 * Apply global shadow quality to renderer, sun/moon, and map-light budget.
 * @param {object} ctx
 * @param {THREE.WebGLRenderer} ctx.renderer
 * @param {THREE.DirectionalLight} [ctx.sun]
 * @param {THREE.DirectionalLight} [ctx.moon]
 * @param {MapLightShadowManager} [ctx.mapShadowMgr]
 * @param {object} [ctx.settings]
 */
export function applyGlobalShadowQuality(ctx) {
  const s = ctx.settings ?? shadowQualitySettings;
  shadowQualitySettings = { ...s };

  if (ctx.renderer) {
    ctx.renderer.shadowMap.type = SHADOW_TYPE_MAP[s.type] ?? THREE.PCFSoftShadowMap;
  }

  if (ctx.sun?.shadow) {
    ctx.sun.shadow.mapSize.set(s.sunMap, s.sunMap);
    ctx.sun.shadow.radius = s.softness;
    ctx.sun.shadow.needsUpdate = true;
  }
  if (ctx.moon?.shadow) {
    ctx.moon.shadow.mapSize.set(s.moonMap, s.moonMap);
    ctx.moon.shadow.radius = s.softness + 1;
    ctx.moon.shadow.needsUpdate = true;
  }

  if (ctx.mapShadowMgr) {
    ctx.mapShadowMgr.setBudget({
      maxCasters: s.maxCasters,
      maxPointCasters: s.maxPoint,
      updatesPerFrame: s.updatesPerFrame,
    });
    ctx.mapShadowMgr.invalidate();
  }

  return s;
}

/**
 * Tight, type-aware shadow setup for one map light (uses global quality settings).
 */
export function configureMapLightShadowsOptimized(light, getBounds, settings = shadowQualitySettings) {
  if (!light?.castShadow) return light;

  const box = getBounds();
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 8);

  let mapSize = settings.mapSpot ?? 1024;
  if (light.isPointLight) mapSize = settings.mapPoint ?? 512;
  else if (light.isDirectionalLight) mapSize = settings.mapSpot ?? 1024;

  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = light.isPointLight ? -0.003 : -0.00025;
  light.shadow.normalBias = light.isPointLight ? 0.05 : 0.025;
  light.shadow.radius = light.isSpotLight ? settings.softness ?? 2 : (settings.softness ?? 2) * 0.6;

  const cam = light.shadow.camera;
  if (light.isSpotLight && cam?.isPerspectiveCamera) {
    cam.near = 0.4;
    const far = Math.min((light.distance > 0 ? light.distance : 80) * 1.05, span * 1.5 + 12);
    cam.far = Math.max(cam.near + 1, far);
    cam.fov = THREE.MathUtils.radToDeg((light.angle || Math.PI / 6) * 2.05);
    cam.aspect = 1;
    cam.updateProjectionMatrix();
  } else if (light.isDirectionalLight && cam?.isOrthographicCamera) {
    const pad = Math.max(Math.max(size.x, size.z) * 0.35 + 3, 10);
    cam.near = 0.5;
    cam.far = Math.max(span + pad, pad * 4);
    cam.left = -pad;
    cam.right = pad;
    cam.top = pad;
    cam.bottom = -pad;
    cam.updateProjectionMatrix();
    if (light.target) light.target.position.copy(center);
  } else if (light.isPointLight && cam?.isPerspectiveCamera) {
    cam.near = 0.4;
    const dist = light.distance > 0 ? light.distance : 50;
    cam.far = Math.min(dist * 1.1, span * 0.75 + dist * 0.5);
    cam.far = Math.max(cam.near + 2, cam.far);
    cam.fov = 90;
    cam.aspect = 1;
    cam.updateProjectionMatrix();
  }

  return light;
}

export class MapLightShadowManager {
  constructor(opts = {}) {
    this.maxCasters = opts.maxCasters ?? 3;
    this.maxPointCasters = opts.maxPointCasters ?? 1;
    this.updatesPerFrame = opts.updatesPerFrame ?? 2;
    this._rotate = 0;
    this._dirty = true;
    this._activeIds = new Set();
  }

  setBudget(opts = {}) {
    if (opts.maxCasters != null) this.maxCasters = opts.maxCasters;
    if (opts.maxPointCasters != null) this.maxPointCasters = opts.maxPointCasters;
    if (opts.updatesPerFrame != null) this.updatesPerFrame = opts.updatesPerFrame;
    this._dirty = true;
  }

  setShadowDesired(entry, on) {
    if (!entry) return;
    entry.shadowDesired = !!on;
    if (!on && entry.light) entry.light.castShadow = false;
    this._dirty = true;
  }

  invalidate() {
    this._dirty = true;
    this._activeCasters?.forEach(e => {
      if (e.light?.shadow) e.light.shadow.needsUpdate = true;
    });
  }

  applyBudget(camera, entries, getBounds, priorityLightId) {
    const getBox = () => (typeof getBounds === 'function' ? getBounds() : getBounds);
    const settings = shadowQualitySettings;

    for (const e of entries) {
      if (!e.light) continue;
      e._getBounds = getBox;
      if (e.shadowDesired == null) e.shadowDesired = !!e.light.castShadow;
    }

    const desired = entries.filter(e => e.shadowDesired && e.visible !== false && e.light);
    desired.sort((a, b) => {
      if (a.id === priorityLightId) return -1;
      if (b.id === priorityLightId) return 1;
      a.light.getWorldPosition(_v);
      const da = camera.position.distanceToSquared(_v);
      b.light.getWorldPosition(_v);
      const db = camera.position.distanceToSquared(_v);
      return da - db;
    });

    const active = [];
    let points = 0;
    for (const e of desired) {
      if (active.length >= this.maxCasters) break;
      const isPoint = e.light.isPointLight;
      if (isPoint && points >= this.maxPointCasters) continue;
      active.push(e);
      if (isPoint) points++;
    }

    this._activeCasters = active;
    const activeSet = new Set(active.map(e => e.id));

    for (const e of entries) {
      if (!e.light) continue;
      const shouldCast = activeSet.has(e.id);
      if (e.light.castShadow !== shouldCast) e.light.castShadow = shouldCast;
      if (shouldCast) configureMapLightShadowsOptimized(e.light, getBox, settings);
      if (e.light.shadow) e.light.shadow.autoUpdate = false;
    }

    this._dirty = false;
    this._activeIds = activeSet;
    return active.length;
  }

  tick(entries) {
    const casters = entries.filter(e => e.light?.castShadow && e.visible !== false);
    if (!casters.length) return;

    casters.forEach(e => { if (e.light.shadow) e.light.shadow.autoUpdate = false; });

    const n = Math.min(this.updatesPerFrame, casters.length);
    for (let i = 0; i < n; i++) {
      const idx = (this._rotate + i) % casters.length;
      const sh = casters[idx].light.shadow;
      if (sh) sh.needsUpdate = true;
    }
    this._rotate = (this._rotate + n) % Math.max(casters.length, 1);
  }
}
