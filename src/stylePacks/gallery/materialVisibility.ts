import * as THREE from 'three';

/** Live show/hide/solo for PMX materials by name. */
export function applyMaterialVisibility(
  root: THREE.Object3D,
  hiddenNames: readonly string[],
  soloName: string | null
): void {
  const hidden = new Set(hiddenNames.map((n) => n.toLowerCase()));
  const solo = soloName?.toLowerCase() ?? null;

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let visible = true;
    for (const mat of mats) {
      const name = (mat?.name ?? '').toLowerCase();
      if (solo && name !== solo && !name.includes(solo)) {
        visible = false;
        break;
      }
      if (hidden.has(name)) {
        visible = false;
        break;
      }
    }
    mesh.visible = visible;
  });
}

export function hideMaterialsMatching(root: THREE.Object3D, pattern: RegExp): string[] {
  const hidden: string[] = [];
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const name = mat?.name ?? '';
      if (pattern.test(name) && !hidden.includes(name)) hidden.push(name);
    }
  });
  return hidden;
}
