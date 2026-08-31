import * as THREE from 'three';
import type { ViewportFormat } from '../types';
import type { CharacterQuality } from './characterQuality';
import { applyCharacterMaterialQuality } from './applyCharacterMaterialQuality';
import { applyMaterialDetailingAndSmoothing } from './mmdMaterialDetailing';
import { applyBoxReflectionsToObject } from '../reflections/materialPatch';
import { applyAsrpToObject, DEFAULT_ASRP } from '../asrp';
import {
  buildAssetIndex,
  lookupInFileMap,
  normalizeBlobFetchUrl,
  resolveAssetUrl,
} from './mmdFiles';
import { loadFlexibleTextureFromUrl } from './mmdTextureLoader';

/** Stage characters are ~18 units tall (MMD convention). */
export const FBX_TARGET_HEIGHT = 18;
/**
 * Environments must dwarf the character so they read as a walkable set,
 * not a toy prop. ~14× character height ≈ room / street / warehouse scale.
 */
export const STAGE_TARGET_SIZE = FBX_TARGET_HEIGHT * 14;

import type { AssetModelKind } from '../types';

const SAFE_MAP_KEYS = ['map', 'normalMap', 'emissiveMap'] as const;
const PBR_MAP_KEYS = ['roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'] as const;

export function findPrimarySkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let best: THREE.SkinnedMesh | null = null;
  let bestVerts = 0;

  root.traverse((child) => {
    if (!(child as THREE.SkinnedMesh).isSkinnedMesh) return;
    const skinned = child as THREE.SkinnedMesh;
    const verts = skinned.geometry?.attributes?.position?.count ?? 0;
    if (verts >= bestVerts) {
      bestVerts = verts;
      best = skinned;
    }
  });

  return best;
}

const _geomSize = new THREE.Vector3();
const _centroid = new THREE.Vector3();

function updateAllSkeletons(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child as THREE.SkinnedMesh).isSkinnedMesh) return;
    const skinned = child as THREE.SkinnedMesh;
    skinned.skeleton?.update();
    skinned.updateMatrixWorld(true);
  });
}

/** Bone AABB with outlier rejection (cloth/weapon helpers far from the body). */
function computeSkinnedBoneCoreBounds(skinned: THREE.SkinnedMesh): THREE.Box3 | null {
  const bones = skinned.skeleton?.bones;
  if (!bones?.length) return null;

  const points: THREE.Vector3[] = [];
  for (const bone of bones) {
    points.push(bone.getWorldPosition(new THREE.Vector3()));
  }

  _centroid.set(0, 0, 0);
  for (const p of points) _centroid.add(p);
  _centroid.multiplyScalar(1 / points.length);

  const dists = points.map((p) => p.distanceTo(_centroid)).sort((a, b) => a - b);
  const median = dists[Math.floor(dists.length / 2)] ?? 0;
  const maxDist = Math.max(median * 2.75, 0.05);

  const box = new THREE.Box3();
  let any = false;
  for (const p of points) {
    if (p.distanceTo(_centroid) > maxDist) continue;
    if (any) box.expandByPoint(p);
    else {
      box.min.copy(p);
      box.max.copy(p);
      any = true;
    }
  }
  return any && !box.isEmpty() ? box : null;
}

function expandBoxFromMeshGeometry(
  box: THREE.Box3,
  mesh: THREE.Mesh,
  seeded: boolean
): boolean {
  mesh.geometry.computeBoundingBox();
  const geomBox = mesh.geometry.boundingBox;
  if (!geomBox || geomBox.isEmpty()) return seeded;

  const worldBox = geomBox.clone().applyMatrix4(mesh.matrixWorld);
  worldBox.getSize(_geomSize);
  if (_geomSize.lengthSq() < 1e-12) return seeded;

  if (seeded) box.union(worldBox);
  else box.copy(worldBox);
  return true;
}

/**
 * World AABB for import normalize/framing.
 * Geometry first; bone-core fallback when bind-pose geom is crumpled at origin.
 * Cloth/helper bones are filtered so they cannot crush auto-scale.
 */
export function computeFbxWorldBounds(root: THREE.Object3D): THREE.Box3 {
  updateAllSkeletons(root);
  root.updateMatrixWorld(true);

  const geomBox = new THREE.Box3();
  let hasGeom = false;
  const boneBox = new THREE.Box3();
  let hasBone = false;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.visible) return;

    hasGeom = expandBoxFromMeshGeometry(geomBox, mesh, hasGeom);

    const skinned = child as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    const core = computeSkinnedBoneCoreBounds(skinned);
    if (!core) return;
    if (hasBone) boneBox.union(core);
    else {
      boneBox.copy(core);
      hasBone = true;
    }
  });

  const box = new THREE.Box3();
  if (hasGeom && hasBone) {
    const gSize = geomBox.getSize(new THREE.Vector3());
    const bSize = boneBox.getSize(new THREE.Vector3());
    // Bind-pose geom stuck at origin while bones place the character in world.
    if (gSize.y > 1e-4 && gSize.y >= bSize.y * 0.15) {
      box.copy(geomBox);
    } else {
      box.copy(boneBox);
    }
  } else if (hasGeom) {
    box.copy(geomBox);
  } else if (hasBone) {
    box.copy(boneBox);
  } else {
    try {
      box.setFromObject(root, true);
    } catch {
      box.setFromObject(root);
    }
  }

  return box;
}

export function detectAssetModelKind(fileName: string, bounds: THREE.Box3): AssetModelKind {
  const name = fileName.toLowerCase();
  if (
    /stage|scene|background|environment|room|platform|set\b|moonlight|concert|arena|city|street|urban|warehouse|hangar|shed|building|interior|exterior|map\b|terrain|plaza|temple|shrine|forest|beach|castle/i.test(
      name
    )
  ) {
    return 'stage';
  }

  if (bounds.isEmpty()) return 'prop';

  const size = bounds.getSize(new THREE.Vector3());
  const footprint = Math.max(size.x, size.z);
  if (footprint > Math.max(size.y * 2, 6) && footprint / Math.max(size.y, 0.001) > 2.2) {
    return 'stage';
  }

  return 'character';
}

export function textureLooksBroken(tex: THREE.Texture | null | undefined): boolean {
  if (!tex) return true;
  const img = tex.image as { width?: number; height?: number; data?: unknown } | undefined;
  if (!img) {
    // glTF / compressed textures may populate image asynchronously — trust the texture object.
    return false;
  }
  if (typeof img.width === 'number' && img.width <= 0) return true;
  if (typeof img.data !== 'undefined') return false;
  if (img instanceof HTMLImageElement) return !img.complete || img.naturalWidth <= 0;
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    return img.width <= 0;
  }
  return false;
}

type AnyPbrMaterial = THREE.MeshStandardMaterial &
  THREE.MeshPhongMaterial &
  THREE.MeshPhysicalMaterial;

function readColor(source: THREE.Material): THREE.Color {
  const mat = source as AnyPbrMaterial;
  if (mat.color?.isColor) return mat.color.clone();
  return new THREE.Color(0xbcbcc4);
}

function readEmissive(source: THREE.Material): THREE.Color {
  const mat = source as AnyPbrMaterial;
  if (mat.emissive?.isColor) return mat.emissive.clone();
  return new THREE.Color(0x000000);
}

function readValidMap(
  source: THREE.Material,
  key: (typeof SAFE_MAP_KEYS)[number] | (typeof PBR_MAP_KEYS)[number]
): THREE.Texture | null {
  const tex = (source as AnyPbrMaterial)[key] as THREE.Texture | null | undefined;
  return textureLooksBroken(tex) ? null : tex!;
}

function materialHasBrokenTextures(source: THREE.Material): boolean {
  const mat = source as AnyPbrMaterial;
  const keys = [...SAFE_MAP_KEYS, ...PBR_MAP_KEYS] as const;
  for (const key of keys) {
    const tex = mat[key] as THREE.Texture | null | undefined;
    if (tex && textureLooksBroken(tex)) return true;
  }
  return false;
}

/** Keep glTF PBR materials when safe; rebuild only broken FBX/legacy materials. */
export function normalizeImportedMaterial(source: THREE.Material): THREE.Material {
  if (
    (source instanceof THREE.MeshStandardMaterial ||
      source instanceof THREE.MeshPhysicalMaterial) &&
    !materialHasBrokenTextures(source)
  ) {
    source.side = THREE.DoubleSide;
    if ((source.envMapIntensity ?? 0) < 0.5) {
      source.envMapIntensity = 1.0;
    }
    return source;
  }
  return createSafeStandardMaterial(source);
}

/** Fresh MeshStandardMaterial — avoids broken FBX/Physical uniforms crashing the renderer. */
export function createSafeStandardMaterial(source: THREE.Material): THREE.MeshStandardMaterial {
  const src = source as AnyPbrMaterial;
  const emissiveIntensity = Math.min(
    typeof src.emissiveIntensity === 'number' ? src.emissiveIntensity : 0,
    1.2
  );

  const standard = new THREE.MeshStandardMaterial({
    name: source.name || 'imported',
    color: readColor(source),
    emissive: readEmissive(source),
    emissiveIntensity,
    transparent: Boolean(source.transparent),
    opacity: typeof source.opacity === 'number' ? source.opacity : 1,
    side: THREE.DoubleSide,
    roughness:
      typeof src.roughness === 'number' ? Math.min(Math.max(src.roughness, 0.08), 1) : 0.62,
    metalness:
      typeof src.metalness === 'number' ? Math.min(Math.max(src.metalness, 0), 1) : 0.08,
    depthWrite: source.transparent ? false : true,
  });

  const diffuse = readValidMap(source, 'map');
  if (diffuse) {
    standard.map = diffuse;
    standard.map.colorSpace = THREE.SRGBColorSpace;
  } else if (standard.color.getHex() === 0xffffff) {
    standard.color.setHex(0xbcbcc4);
  }

  const normal = readValidMap(source, 'normalMap');
  if (normal) {
    standard.normalMap = normal;
    standard.normalMap.colorSpace = THREE.LinearSRGBColorSpace;
  }

  const emissiveMap = readValidMap(source, 'emissiveMap');
  if (emissiveMap) {
    standard.emissiveMap = emissiveMap;
    standard.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  }

  for (const key of PBR_MAP_KEYS) {
    const tex = readValidMap(source, key);
    if (!tex) continue;
    (standard as THREE.MeshStandardMaterial)[key] = tex;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
  }

  if (typeof src.aoMapIntensity === 'number') {
    standard.aoMapIntensity = src.aoMapIntensity;
  }

  if (source !== standard) {
    source.dispose();
  }

  return standard;
}

function textureCandidates(materialName: string, mapKey: string, modelStem: string): string[] {
  const clean = materialName.replace(/[^a-z0-9_\-]+/gi, '_');
  const stem = clean || modelStem;
  const mapSuffix = mapKey.replace(/Map$/, '').toLowerCase();

  return [
    `${stem}.png`,
    `${stem}.jpg`,
    `${stem}.jpeg`,
    `${stem}.bmp`,
    `${stem}.tga`,
    `${stem}.dds`,
    `${stem}_${mapSuffix}.png`,
    `${stem}_${mapSuffix}.jpg`,
    `${stem}_${mapSuffix}.bmp`,
    `${stem}_${mapSuffix}.dds`,
    `${modelStem}.png`,
    `${modelStem}.jpg`,
    `${modelStem}.bmp`,
    `${modelStem}.dds`,
    `textures/${stem}.png`,
    `textures/${stem}.jpg`,
    `textures/${stem}.bmp`,
    `textures/${stem}.dds`,
    `Textures/${stem}.png`,
    `Textures/${stem}.bmp`,
  ];
}

function loadTextureAsync(
  url: string,
  colorSpace: THREE.ColorSpace
): Promise<THREE.Texture | null> {
  return loadFlexibleTextureFromUrl(url).then((tex) => {
    if (!tex) return null;
    tex.colorSpace = colorSpace;
    tex.needsUpdate = true;
    return tex;
  });
}

export async function repairModelTextures(
  root: THREE.Object3D,
  fileMap: Record<string, string>,
  modelFileName?: string
): Promise<number> {
  const index = buildAssetIndex(fileMap);
  const modelStem = modelFileName?.replace(/\.[^.]+$/, '').toLowerCase() ?? 'model';
  const tasks: Promise<void>[] = [];
  let repaired = 0;

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      const matName = material.name || mesh.name || modelStem;

      if (!textureLooksBroken(material.map)) continue;

      for (const candidate of textureCandidates(matName, 'map', modelStem)) {
        const resolvedUrl = lookupInFileMap(candidate, fileMap, index);
        if (!resolvedUrl) continue;

        const url = normalizeBlobFetchUrl(resolveAssetUrl(resolvedUrl, fileMap, index));
        tasks.push(
          loadTextureAsync(url, THREE.SRGBColorSpace).then((tex) => {
            if (!tex) return;
            material.map = tex;
            material.needsUpdate = true;
            repaired += 1;
          })
        );
        break;
      }
    }
  });

  await Promise.all(tasks);
  return repaired;
}

export function prepareFbxMaterials(root: THREE.Object3D, castShadow: boolean): void {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    mesh.frustumCulled = false;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = materials.map((material) => {
      if (!material) {
        return createSafeStandardMaterial(new THREE.MeshStandardMaterial({ name: 'fallback' }));
      }
      return normalizeImportedMaterial(material);
    });

    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
  });
}

const GLTF_COLOR_SPACE_KEYS = [
  'map',
  'emissiveMap',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'alphaMap',
] as const;

function fixImportedMaterialColorSpaces(material: THREE.Material): void {
  if (
    !(
      material instanceof THREE.MeshStandardMaterial ||
      material instanceof THREE.MeshPhysicalMaterial ||
      material instanceof THREE.MeshBasicMaterial
    )
  ) {
    return;
  }

  const mat = material as THREE.MeshStandardMaterial;
  for (const key of GLTF_COLOR_SPACE_KEYS) {
    const tex = mat[key];
    if (!tex || textureLooksBroken(tex)) continue;
    tex.colorSpace =
      key === 'map' || key === 'emissiveMap'
        ? THREE.SRGBColorSpace
        : THREE.LinearSRGBColorSpace;
    tex.needsUpdate = true;
  }
  material.needsUpdate = true;
}

/** glTF/GLB from Blender — keep authored materials, only shadows + color spaces. */
export function prepareGltfMaterials(root: THREE.Object3D, castShadow = true): void {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      fixImportedMaterialColorSpaces(material);
    }
  });
}

/** GLB/FBX/OBJ material polish — PBR env response, anisotropy, sun shadow cast. */
export function applyImportedMaterialPipeline(
  root: THREE.Object3D,
  opts: {
    quality: CharacterQuality;
    renderer?: THREE.WebGLRenderer;
    viewportFormat?: ViewportFormat;
    materialDetailing?: boolean;
    materialSmoothing?: number;
    environmentIntensity?: number;
    castShadow?: boolean;
    modelKind?: AssetModelKind;
  }
): void {
  const {
    quality,
    renderer,
    viewportFormat = '16:9',
    materialDetailing = true,
    materialSmoothing = 0.55,
    environmentIntensity = 0.72,
    castShadow = true,
    modelKind = 'character',
  } = opts;
  const isStage = modelKind === 'stage';

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    // Skinned GLB bind-pose spheres are unreliable — never frustum-cull imports.
    mesh.frustumCulled = false;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (!material || !(material instanceof THREE.MeshStandardMaterial)) return;
      material.side = THREE.DoubleSide;
      if (isStage) {
        // Blender stages are authored with their own exposure — avoid washing out.
        material.envMapIntensity = Math.min(material.envMapIntensity ?? 1, 0.55);
      } else {
        material.envMapIntensity = Math.min(
          Math.max(material.envMapIntensity ?? 1, environmentIntensity * 0.85),
          1.0
        );
      }
      material.needsUpdate = true;
    });

    if (mesh.geometry && viewportFormat !== '9:16') {
      const geo = mesh.geometry as THREE.BufferGeometry;
      if (!geo.attributes.normal && geo.attributes.position) {
        geo.computeVertexNormals();
      }
    }
  });

  applyCharacterMaterialQuality(root, quality, renderer, viewportFormat);
  if (materialDetailing && !isStage) {
    applyMaterialDetailingAndSmoothing(root, {
      smoothing: materialSmoothing,
      viewportFormat,
      envIntensity: environmentIntensity,
    });
  }
  applyBoxReflectionsToObject(root, {
    character: !isStage,
    environment: true,
    animeFriendly: true,
  });
  applyAsrpToObject(root, {
    ...DEFAULT_ASRP,
    pipeline: 'asrp',
    enabled: true,
  });
}

export function normalizeImportedModel(root: THREE.Object3D, kind: AssetModelKind): void {
  const box = computeFbxWorldBounds(root);
  if (box.isEmpty()) {
    console.warn('[Import] Empty world bounds — skipping auto-scale');
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const height = size.y;

  if (maxDim > 0.001) {
    let target = FBX_TARGET_HEIGHT;
    // Prefer height for characters — footprint/maxDim blows up on wide dresses/cloth.
    let basis = height > 0.001 ? height : maxDim;
    let forceScale = false;

    if (kind === 'stage') {
      // Always normalize stages. Medium FBX warehouses (~20–40u) used to skip
      // the band check and stayed character-sized — character couldn't fit inside.
      target = STAGE_TARGET_SIZE;
      basis = maxDim;
      forceScale = true;
    } else if (kind === 'prop') {
      target = 24;
      basis = maxDim;
    }

    const needsScale =
      forceScale || basis > target * 1.35 || basis < target * 0.18;
    if (needsScale && basis > 0.001) {
      const factor = THREE.MathUtils.clamp(target / basis, 0.0005, 500);
      root.scale.multiplyScalar(factor);
    }
  }

  root.updateMatrixWorld(true);
  const aligned = computeFbxWorldBounds(root);
  if (!aligned.isEmpty()) {
    const center = aligned.getCenter(new THREE.Vector3());
    // Sketchfab/GLB often sit far from origin — center XZ onto the root gizmo.
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= aligned.min.y;
    root.updateMatrixWorld(true);
  }

  // Baseline for user-driven world scale (Environment Builder).
  root.userData.baseScale = [root.scale.x, root.scale.y, root.scale.z];

  ensureImportedMeshesRenderable(root);
}

/**
 * Multiply the normalized import scale by a user factor, keeping the model
 * centered on XZ and its lowest point on the floor.
 */
export function applyWorldScaleToRoot(root: THREE.Object3D, multiplier: number): void {
  const base = (root.userData.baseScale as [number, number, number] | undefined) ?? [
    root.scale.x,
    root.scale.y,
    root.scale.z,
  ];
  if (!root.userData.baseScale) root.userData.baseScale = base;

  const k = THREE.MathUtils.clamp(multiplier, 0.05, 100);
  root.scale.set(base[0] * k, base[1] * k, base[2] * k);
  root.updateMatrixWorld(true);

  const aligned = computeFbxWorldBounds(root);
  if (!aligned.isEmpty()) {
    const center = aligned.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= aligned.min.y;
    root.updateMatrixWorld(true);
  }
}

/** Keep imported meshes drawable after normalize / material passes. */
export function ensureImportedMeshesRenderable(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.visible = true;
    mesh.frustumCulled = false;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of mats) {
      if (!material) continue;
      material.visible = true;
      if (
        'opacity' in material &&
        typeof (material as THREE.Material & { opacity: number }).opacity === 'number' &&
        (material as THREE.Material & { opacity: number }).opacity < 0.02
      ) {
        (material as THREE.Material & { opacity: number }).opacity = 1;
        material.transparent = false;
      }
    }
  });
}

export function getFbxFocusPoint(root: THREE.Object3D): THREE.Vector3 {
  const box = computeFbxWorldBounds(root);
  const center = new THREE.Vector3();
  if (box.isEmpty()) {
    return center.set(0, FBX_TARGET_HEIGHT * 0.55, 0);
  }
  box.getCenter(center);
  const height = box.max.y - box.min.y;
  center.y = box.min.y + height * 0.45;
  return center;
}
