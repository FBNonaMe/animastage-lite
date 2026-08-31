/**
 * Apply ASRP (Silhouette POM + smart profiles) to a scene object / model root.
 */
import * as THREE from 'three';
import type { AsrpQualityProfile, AsrpSettings } from './types';
import { getAsrpMaterialProfile } from './materialKinds';
import { resolveAsrpHeightMap } from './heightApprox';
import { patchMaterialSilhouettePom } from './silhouettePom';
import { getAsrpQualityProfile } from './quality';

/**
 * Three.js computeTangents() requires index + position + normal + uv.
 * Many MMD / helper meshes are non-indexed — skip silently (POM falls back to view-Z).
 */
function ensureTangents(mesh: THREE.Mesh): boolean {
  const geo = mesh.geometry as THREE.BufferGeometry | undefined;
  if (!geo?.isBufferGeometry) return false;
  if (geo.getAttribute('tangent')) return true;
  if (geo.userData.asrpTangentsFailed) return false;

  const index = geo.index;
  const position = geo.getAttribute('position');
  const normal = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');

  if (
    !index ||
    index.count < 3 ||
    !position ||
    position.count < 3 ||
    !normal ||
    normal.count < 3 ||
    !uv ||
    uv.count < 3
  ) {
    geo.userData.asrpTangentsFailed = true;
    return false;
  }

  try {
    geo.computeTangents();
    return Boolean(geo.getAttribute('tangent'));
  } catch {
    geo.userData.asrpTangentsFailed = true;
    return false;
  }
}

export function isAsrpActive(settings: AsrpSettings): boolean {
  if (!settings.enabled) return false;
  return settings.pipeline === 'asrp' || settings.pipeline === 'rtx_lite';
}

export function applyAsrpToObject(
  root: THREE.Object3D,
  settings: AsrpSettings,
  opts?: { exporting?: boolean; rtxLite?: boolean }
): number {
  if (!isAsrpActive(settings)) return 0;

  const quality = getAsrpQualityProfile(settings, {
    exporting: opts?.exporting,
    rtxLite: opts?.rtxLite || settings.pipeline === 'rtx_lite',
  });

  let count = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let needsPom = false;
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (!mat.map && !mat.normalMap && !mat.displacementMap && !mat.bumpMap) continue;
      needsPom = true;
      break;
    }
    if (!needsPom) return;

    // Tangents optional — POM shader already falls back when USE_TANGENT is undefined.
    ensureTangents(mesh);

    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (!mat.map && !mat.normalMap && !mat.displacementMap && !mat.bumpMap) continue;

      const profile = getAsrpMaterialProfile(mat.name || '', mesh.name || '');
      const heightMap = resolveAsrpHeightMap(mat, settings.autoHeightApprox);
      if (!heightMap) continue;

      patchMaterialSilhouettePom(mat, heightMap, profile, quality, {
        depthStrength: settings.depthStrength * settings.heightScale * settings.parallaxScale,
        silhouetteWidth: settings.silhouetteWidth,
        normalBlend: settings.normalBlend,
        animePreserve: settings.animePreserve,
      });

      // Kind-specific PBR polish (works with box reflections)
      if (profile.kind === 'hair') {
        mat.roughness = Math.min(mat.roughness, 0.45);
        mat.envMapIntensity = Math.max(mat.envMapIntensity, 0.7);
      } else if (profile.kind === 'eye') {
        mat.roughness = Math.min(mat.roughness, 0.25);
        mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.05);
      } else if (profile.kind === 'skin') {
        mat.roughness = THREE.MathUtils.clamp(mat.roughness, 0.4, 0.62);
      } else if (profile.kind === 'metal') {
        mat.metalness = Math.max(mat.metalness, 0.6);
        mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.1);
      } else if (profile.kind === 'cloth' || profile.kind === 'fabric') {
        mat.roughness = Math.max(mat.roughness, 0.55);
      }

      count += 1;
    }
  });

  return count;
}

export function buildPomBagFromSettings(
  settings: AsrpSettings,
  quality: AsrpQualityProfile,
  fade = 1
): import('./silhouettePom').PomUniformBag {
  return {
    enabled: isAsrpActive(settings) ? 1 : 0,
    heightScale: quality.depthScale,
    minLayers: quality.minLayers,
    maxLayers: quality.maxLayers,
    minViewZ: 0.05,
    silhouette: quality.silhouette ? settings.silhouetteWidth : 0,
    softSilhouette: settings.animePreserve ? 1 : 0,
    normalBlend: settings.normalBlend,
    fade,
    heightMap: null,
  };
}
