import * as THREE from 'three';

/** Per-model GPU hints — does not change materials or skeleton. */
export function applyModelRenderPerfPolicy(
  root: THREE.Object3D,
  opts: { castShadow: boolean; frustumCulled?: boolean }
): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    mesh.castShadow = opts.castShadow;
    mesh.receiveShadow = opts.castShadow;
    if (opts.frustumCulled !== undefined) {
      mesh.frustumCulled = opts.frustumCulled;
    }
  });
}
