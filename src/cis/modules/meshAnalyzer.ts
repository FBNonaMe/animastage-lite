import * as THREE from 'three';
import type { CisMeshStats } from '../types';

export function analyzeMesh(mesh: THREE.SkinnedMesh): CisMeshStats {
  let vertexCount = 0;
  let triangleCount = 0;
  let submeshCount = 0;
  let materialCount = 0;
  let transparentMaterialCount = 0;
  let doubleSidedMaterialCount = 0;
  let alphaMaterialCount = 0;
  const uvSets = new Set<number>();

  const box = new THREE.Box3();

  mesh.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;

    submeshCount += 1;
    m.geometry.computeBoundingBox();
    if (m.geometry.boundingBox) {
      const wb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      box.union(wb);
    }

    const pos = m.geometry.getAttribute('position');
    vertexCount += pos?.count ?? 0;
    const index = m.geometry.getIndex();
    triangleCount += index
      ? Math.floor(index.count / 3)
      : pos
        ? Math.floor(pos.count / 3)
        : 0;

    if (m.geometry.getAttribute('uv')) uvSets.add(0);
    if (m.geometry.getAttribute('uv2')) uvSets.add(1);

    const mats = Array.isArray(m.material) ? m.material : [m.material];
    materialCount += mats.length;

    for (const mat of mats) {
      if (!mat) continue;
      const std = mat as THREE.MeshStandardMaterial;
      if (std.transparent || (std.opacity != null && std.opacity < 0.99)) {
        transparentMaterialCount += 1;
      }
      if (std.alphaTest != null && std.alphaTest > 0) alphaMaterialCount += 1;
      if (std.side === THREE.DoubleSide) doubleSidedMaterialCount += 1;
    }
  });

  if (box.isEmpty()) box.setFromObject(mesh);

  const size = box.getSize(new THREE.Vector3());
  const volume = Math.max(size.x * size.y * size.z, 0.001);
  const meshDensity = triangleCount / Math.cbrt(volume);

  return {
    vertexCount,
    triangleCount,
    submeshCount,
    materialCount,
    uvSetCount: uvSets.size,
    boundingBox: {
      min: box.min.toArray() as [number, number, number],
      max: box.max.toArray() as [number, number, number],
    },
    meshDensity: Math.round(meshDensity),
    transparentMaterialCount,
    doubleSidedMaterialCount,
    alphaMaterialCount,
  };
}
