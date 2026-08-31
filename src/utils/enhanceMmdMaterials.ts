import * as THREE from 'three';
import type { ViewportFormat, RenderMode } from '../types';
import type { CharacterQuality } from './characterQuality';
import { getCharacterQualityGpu } from './characterQuality';
import { applyMmdFidelityMaterials, isMmdFidelityMode, snapshotToonForFidelity } from './mmdFidelityMaterials';
import { isAnimeNprMode } from './animeNprMode';
import type { AutoLuminousLevel } from '../stylePacks/gallery/types';

type MaterialKind = 'skin' | 'hair' | 'eye' | 'cloth' | 'metal' | 'default';

function classifyMaterial(name: string): MaterialKind {
  const n = name.toLowerCase();
  if (/肌|skin|顔|face|体|body/.test(n)) return 'skin';
  if (/髪|hair|前髪/.test(n)) return 'hair';
  if (/目|eye|瞳|まぶた|睫毛/.test(n)) return 'eye';
  if (/服|skirt|cloth|衣|skirt|pants|靴|shoe|袜|tie|リボン|accessory/.test(n)) return 'cloth';
  if (/金属|metal|zip|バックル|釦|ring|jewel/.test(n)) return 'metal';
  return 'default';
}

function pbrParams(kind: MaterialKind): { roughness: number; metalness: number } {
  switch (kind) {
    case 'skin':
      return { roughness: 0.52, metalness: 0.035 };
    case 'hair':
      return { roughness: 0.38, metalness: 0.1 };
    case 'eye':
      return { roughness: 0.22, metalness: 0.04 };
    case 'cloth':
      return { roughness: 0.68, metalness: 0.02 };
    case 'metal':
      return { roughness: 0.32, metalness: 0.65 };
    default:
      return { roughness: 0.65, metalness: 0.05 };
  }
}

function toStandardMaterial(
  src: THREE.MeshToonMaterial,
  meshName: string
): THREE.MeshStandardMaterial {
  const kind = classifyMaterial(src.name || meshName);
  const { roughness, metalness } = pbrParams(kind);

  const std = new THREE.MeshStandardMaterial({
    name: src.name,
    map: src.map,
    alphaMap: src.alphaMap,
    normalMap: src.normalMap,
    emissive: src.emissive?.clone() ?? new THREE.Color(0x000000),
    emissiveMap: src.emissiveMap,
    emissiveIntensity: src.emissiveIntensity ?? 1,
    transparent: src.transparent,
    opacity: src.opacity,
    alphaTest: src.alphaTest,
    side: src.side,
    depthWrite: src.depthWrite,
    depthTest: src.depthTest,
    roughness,
    metalness,
  });

  if (src.map) {
    std.map!.colorSpace = THREE.SRGBColorSpace;
  }

  return std;
}

/**
 * Replaces harsh toon shading with MeshStandardMaterial for a less cartoon look.
 * Safe to call multiple times — recalculates when viewport format changes.
 */
export function enhanceMmdMaterials(
  root: THREE.Object3D,
  quality: CharacterQuality,
  viewportFormat: ViewportFormat = '16:9',
  materialDetailing = false,
  renderMode: RenderMode = 'pbr_cinematic',
  autoLuminousLevel: AutoLuminousLevel = 'auto'
): void {
  if (isAnimeNprMode(renderMode)) return;
  if (isMmdFidelityMode(renderMode)) {
    applyMmdFidelityMaterials(root, { viewportFormat, autoLuminousLevel });
    return;
  }

  const { enhanceMaterials } = getCharacterQualityGpu(quality, viewportFormat);
  if (!enhanceMaterials && !materialDetailing) return;

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const meshName = mesh.name || '';
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    const next = materials.map((material) => {
      if (!material) return material;
      
      // Recalculate if viewport format changed
      const lastViewport = (material as any).userData?.mmdEnhancedViewport;
      const isStandardAndEnhanced = 
        material instanceof THREE.MeshStandardMaterial && 
        material.userData.mmdEnhanced &&
        lastViewport === viewportFormat;
      
      if (isStandardAndEnhanced) {
        return material;
      }
      
      if (!(material instanceof THREE.MeshToonMaterial)) {
        return material;
      }

      snapshotToonForFidelity(material);
      const std = toStandardMaterial(material, meshName);
      std.userData.mmdEnhanced = true;
      std.userData.mmdEnhancedViewport = viewportFormat;
      material.dispose();
      return std;
    });

    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}
