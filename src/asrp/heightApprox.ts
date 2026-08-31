/**
 * Lightweight height-map approximation when no displacement/height/bump map exists.
 * Uses albedo luminance (or normal-map Z) — cached per source texture.
 */
import * as THREE from 'three';

const CACHE = new WeakMap<THREE.Texture, THREE.CanvasTexture>();

function luminanceFromImageData(data: Uint8ClampedArray, i: number): number {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return (0.299 * r + 0.587 * g + 0.114 * b) | 0;
}

function buildHeightCanvas(source: THREE.Texture, size = 256): THREE.CanvasTexture | null {
  const img = source.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | undefined;
  if (!img) return null;

  const w =
    'naturalWidth' in img
      ? img.naturalWidth || (img as HTMLImageElement).width
      : (img as ImageBitmap).width || size;
  const h =
    'naturalHeight' in img
      ? img.naturalHeight || (img as HTMLImageElement).height
      : (img as ImageBitmap).height || size;
  if (!w || !h) return null;

  const dim = Math.min(size, Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img as CanvasImageSource, 0, 0, dim, dim);
  } catch {
    return null;
  }

  const imageData = ctx.getImageData(0, 0, dim, dim);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = luminanceFromImageData(d, i);
    // Soft contrast curve — anime-friendly, not harsh relief
    const soft = Math.pow(y / 255, 0.85) * 255;
    d[i] = soft;
    d[i + 1] = soft;
    d[i + 2] = soft;
    d[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = source.wrapS;
  tex.wrapT = source.wrapT;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Resolve a height texture for Silhouette POM.
 * Priority: displacementMap → bumpMap → approx from map/normalMap.
 */
export function resolveAsrpHeightMap(
  material: THREE.MeshStandardMaterial,
  autoApprox: boolean
): THREE.Texture | null {
  if (material.displacementMap) return material.displacementMap;
  if (material.bumpMap) return material.bumpMap;
  if (material.userData.asrpHeightMap instanceof THREE.Texture) {
    return material.userData.asrpHeightMap as THREE.Texture;
  }
  if (!autoApprox) return null;

  const source = material.map ?? material.normalMap;
  if (!source) return null;

  const cached = CACHE.get(source);
  if (cached) {
    material.userData.asrpHeightMap = cached;
    return cached;
  }

  const built = buildHeightCanvas(source, 256);
  if (!built) return null;
  CACHE.set(source, built);
  material.userData.asrpHeightMap = built;
  return built;
}
