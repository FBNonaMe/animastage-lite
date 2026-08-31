import type { MMDLoader } from 'three-stdlib';
import type * as THREE from 'three';
import { applyVmdBoneRemap, parseVmdBuffer } from './vmdLoader';
import type { VmdMotionData } from './types';

type AnimationBuilder = {
  build: (vmd: unknown, mesh: THREE.SkinnedMesh) => THREE.AnimationClip;
};

export function buildUmceAnimationClip(
  loader: MMDLoader,
  vmd: VmdMotionData,
  mesh: THREE.SkinnedMesh,
  remapTable: Record<string, string>
): THREE.AnimationClip {
  const cloned: VmdMotionData = {
    ...vmd,
    motions: vmd.motions.map((m) => ({ ...m })),
  };
  applyVmdBoneRemap(cloned, remapTable);
  const builder = (loader as unknown as { animationBuilder: AnimationBuilder }).animationBuilder;
  if (!builder) {
    throw new Error('MMDLoader animationBuilder unavailable');
  }
  return builder.build(cloned, mesh);
}

/**
 * Load VMD with UMCE bone remapping before AnimationClip build.
 */
export async function loadUmceVmdAnimation(
  loader: MMDLoader,
  url: string,
  mesh: THREE.SkinnedMesh,
  remapTable: Record<string, string>,
  onLoad: (clip: THREE.AnimationClip) => void,
  onError?: (err: unknown) => void
): Promise<void> {
  try {
    const buffer = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`VMD fetch failed: ${r.status}`);
      return r.arrayBuffer();
    });
    const vmd = await parseVmdBuffer(buffer);
    onLoad(buildUmceAnimationClip(loader, vmd, mesh, remapTable));
  } catch (err) {
    console.warn('[UMCE] VMD remap load failed, falling back:', err);
    onError?.(err);
    loader.loadAnimation(url, mesh, onLoad, undefined, onError);
  }
}
