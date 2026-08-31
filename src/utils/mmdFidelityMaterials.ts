/**
 * MMD Fidelity — preserve MeshToonMaterial + MMD-style presets (cel, luminous, alpha).
 * Inspired by classic MMD / babylon-mmd shader modes; stays on Three.js toon shading.
 */
import * as THREE from 'three';
import type { ViewportFormat } from '../types';
import type { AutoLuminousLevel } from '../stylePacks/gallery/types';
import { classifyMaterialName } from '../stylePacks/gallery/autoLuminous';
import type { RenderMode } from '../types';

export type MmdMaterialPreset = 'cel' | 'luminous' | 'alpha_cutoff' | 'gloss' | 'default';

const LUMINOUS_RE = /光|glow|led|neon|luminous|autoluminous|発光|emissive/i;

let sharedCelGradient: THREE.Texture | null = null;
let sharedSharpGradient: THREE.Texture | null = null;
let sharedSoftGradient: THREE.Texture | null = null;

function makeGradientTexture(stops: Array<[number, string]>): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 16, 0);
  for (const [t, color] of stops) grad.addColorStop(t, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function getCelGradient(): THREE.Texture {
  if (!sharedCelGradient) {
    sharedCelGradient = makeGradientTexture([
      [0, '#3a3a48'],
      [0.45, '#9a9aaa'],
      [1, '#f2f2f8'],
    ]);
  }
  return sharedCelGradient;
}

function getSharpCelGradient(): THREE.Texture {
  if (!sharedSharpGradient) {
    sharedSharpGradient = makeGradientTexture([
      [0, '#282830'],
      [0.35, '#707080'],
      [0.36, '#e8e8f0'],
      [1, '#ffffff'],
    ]);
  }
  return sharedSharpGradient;
}

function getSoftGradient(): THREE.Texture {
  if (!sharedSoftGradient) {
    sharedSoftGradient = makeGradientTexture([
      [0, '#505058'],
      [0.55, '#b0b0bc'],
      [1, '#fefefe'],
    ]);
  }
  return sharedSoftGradient;
}

export function isMmdFidelityMode(renderMode?: RenderMode): boolean {
  return renderMode === 'mmd_fidelity';
}

function resolvePreset(matName: string, meshName: string): MmdMaterialPreset {
  const label = `${matName} ${meshName}`;
  if (LUMINOUS_RE.test(label)) return 'luminous';
  const kind = classifyMaterialName(label);
  if (kind === 'eyes' || kind === 'metal') return 'gloss';
  if (kind === 'hair') return 'cel';
  if (kind === 'magic' || kind === 'glass') return 'luminous';
  return 'default';
}

function luminousStrength(level: AutoLuminousLevel, preset: MmdMaterialPreset): number {
  if (level === 'off') return 0;
  if (preset !== 'luminous' && preset !== 'gloss') return 0;
  const base =
    level === 'low' ? 0.18 : level === 'medium' ? 0.38 : level === 'high' ? 0.62 : 0.42;
  return preset === 'gloss' ? base * 0.85 : base;
}

function restoreToonMaterials(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = materials.map((material) => {
      if (!material) return material;
      const snapshot = material.userData?.mmdToonSnapshot as THREE.MeshToonMaterial | undefined;
      if (snapshot && material instanceof THREE.MeshStandardMaterial) {
        const restored = snapshot.clone();
        restored.userData.mmdToonSnapshot = snapshot;
        material.dispose();
        return restored;
      }
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
  });
}

function applyPresetToToon(
  mat: THREE.MeshToonMaterial,
  meshName: string,
  preset: MmdMaterialPreset,
  luminousLevel: AutoLuminousLevel,
  viewportFormat: ViewportFormat
): void {
  const portrait = viewportFormat === '9:16';

  if (!mat.gradientMap || !mat.gradientMap.image) {
    mat.gradientMap =
      preset === 'cel' || preset === 'gloss' ? getSharpCelGradient() : getCelGradient();
  }

  if (preset === 'cel') {
    mat.gradientMap = getSharpCelGradient();
  } else if (preset === 'gloss') {
    mat.gradientMap = getSharpCelGradient();
  } else if (preset === 'default') {
    mat.gradientMap = portrait ? getSoftGradient() : getCelGradient();
  }

  if (mat.map) {
    mat.map.colorSpace = THREE.SRGBColorSpace;
  }
  if (mat.gradientMap) {
    mat.gradientMap.colorSpace = THREE.NoColorSpace;
    mat.gradientMap.needsUpdate = true;
  }

  const glow = luminousStrength(luminousLevel, preset);
  if (glow > 0) {
    if (!mat.emissive) mat.emissive = new THREE.Color(0x000000);
    const base = mat.color?.clone() ?? new THREE.Color(0xffffff);
    mat.emissive.copy(base).lerp(new THREE.Color(0xffffff), glow);
    mat.emissiveIntensity = 0.65 + glow * 1.4;
  }

  if (preset === 'luminous' || LUMINOUS_RE.test(mat.name)) {
    mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 1, 1.1 + glow);
  }

  if (mat.transparent || mat.opacity < 0.99) {
    mat.alphaTest = 0.45;
    mat.transparent = true;
    mat.depthWrite = true;
  }

  mat.side = THREE.DoubleSide;
  mat.userData.mmdFidelityPreset = preset;
  mat.userData.mmdFidelityApplied = true;
  mat.needsUpdate = true;
}

/** Keep / restore toon materials and apply MMD-style shading presets. */
export function applyMmdFidelityMaterials(
  root: THREE.Object3D,
  opts: {
    viewportFormat?: ViewportFormat;
    autoLuminousLevel?: AutoLuminousLevel;
  } = {}
): void {
  const viewportFormat = opts.viewportFormat ?? '16:9';
  const luminousLevel = opts.autoLuminousLevel ?? 'auto';

  restoreToonMaterials(root);

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const meshName = mesh.name || '';
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshToonMaterial)) return;
      const preset = resolvePreset(material.name || '', meshName);
      applyPresetToToon(material, meshName, preset, luminousLevel, viewportFormat);
    });
  });
}

/** Snapshot toon before PBR conversion so fidelity mode can restore. */
export function snapshotToonForFidelity(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshToonMaterial)) return;
  if (material.userData.mmdToonSnapshot) return;
  material.userData.mmdToonSnapshot = material.clone();
}
