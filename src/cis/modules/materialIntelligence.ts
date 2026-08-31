import * as THREE from 'three';
import type { CisMaterialEntry, CisMaterialProfile } from '../types';

function classifyMaterial(mat: THREE.Material): CisMaterialEntry['kind'] {
  const name = mat.name.toLowerCase();
  if (/outline|輪郭|edge/i.test(name)) return 'outline';
  if (/toon|mtoon|cel|shader/i.test(name)) return 'toon';

  const std = mat as THREE.MeshStandardMaterial;
  if (std.emissive?.getHex() && std.emissive.getHex() > 0) return 'emissive';
  if (std.transparent || (std.opacity != null && std.opacity < 0.95)) return 'transparent';
  if (std.metalness != null && std.metalness > 0.1) return 'pbr';
  if (std.roughnessMap || std.metalnessMap || std.normalMap) return 'pbr';
  return 'unknown';
}

function textureResolution(tex: THREE.Texture | null | undefined): number | null {
  const img = tex?.image as { width?: number; height?: number } | undefined;
  if (!img?.width) return null;
  return Math.max(img.width, img.height ?? 0);
}

export function analyzeMaterials(
  mesh: THREE.SkinnedMesh,
  fileMap?: Record<string, string>,
  missingTextures: string[] = []
): CisMaterialProfile {
  const seenTextures = new Map<string, number>();
  const usedMaterialNames = new Set<string>();
  const entries: CisMaterialEntry[] = [];

  mesh.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat) continue;
      usedMaterialNames.add(mat.name);

      const std = mat as THREE.MeshStandardMaterial;
      const mapKey = std.map?.uuid ?? '';
      if (mapKey) seenTextures.set(mapKey, (seenTextures.get(mapKey) ?? 0) + 1);

      const texRes = textureResolution(std.map);
      const missingTexture =
        missingTextures.some((t) => mat.name.includes(t) || t.includes(mat.name)) ||
        (std.map != null && !std.map.image);

      entries.push({
        name: mat.name || 'Material',
        kind: classifyMaterial(mat),
        hasNormalMap: Boolean(std.normalMap),
        hasEmissiveMap: Boolean(std.emissiveMap),
        metallic: typeof std.metalness === 'number' ? std.metalness : null,
        roughness: typeof std.roughness === 'number' ? std.roughness : null,
        textureResolution: texRes,
        missingTexture,
        duplicatedTexture: mapKey ? (seenTextures.get(mapKey) ?? 0) > 1 : false,
        unused: false,
      });
    }
  });

  const mmd = mesh.geometry.userData.MMD as
    | { materials?: Array<{ name?: string; textureIndex?: number }> }
    | undefined;
  let unusedMaterialCount = 0;
  if (mmd?.materials) {
    for (const m of mmd.materials) {
      const n = m.name ?? '';
      if (n && !usedMaterialNames.has(n)) unusedMaterialCount += 1;
    }
  }

  const largeTextureCount = entries.filter(
    (e) => e.textureResolution != null && e.textureResolution > 2048
  ).length;
  const duplicateTextureCount = entries.filter((e) => e.duplicatedTexture).length;

  return {
    materials: entries,
    missingTextureCount: entries.filter((e) => e.missingTexture).length,
    largeTextureCount,
    duplicateTextureCount,
    unusedMaterialCount,
  };
}
