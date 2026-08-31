/** Ground hit validation + raycast helpers for placement. */
import * as THREE from 'three';
import type { PlacementHit } from './types';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _worldNormal = new THREE.Vector3();
const _normalMatrix = new THREE.Matrix3();

export function isWalkableNormal(worldNormalY: number, minY = 0.55): boolean {
  return worldNormalY >= minY;
}

function isCharacterMesh(obj: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = obj;
  while (p) {
    if ((p as THREE.SkinnedMesh).isSkinnedMesh) return true;
    if (p.userData?.assetKind === 'character') return true;
    if (p.userData?.shotComposerIgnore) return true;
    p = p.parent;
  }
  return false;
}

function surfaceRoleBlocks(obj: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = obj;
  while (p) {
    const role = p.userData?.shotComposerRole;
    if (role === 'background' || role === 'decoration') return true;
    p = p.parent;
  }
  return false;
}

export function raycastPlacement(
  camera: THREE.Camera,
  scene: THREE.Scene,
  clientX: number,
  clientY: number,
  dom: HTMLElement,
  floorYFallback = 0
): PlacementHit | null {
  const rect = dom.getBoundingClientRect();
  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_ndc, camera);
  _raycaster.far = 5000;

  const hits = _raycaster.intersectObjects(scene.children, true);
  for (const hit of hits) {
    if (!hit.object || isCharacterMesh(hit.object)) continue;
    if (surfaceRoleBlocks(hit.object)) continue;
    if (hit.face) {
      _normalMatrix.getNormalMatrix(hit.object.matrixWorld);
      _worldNormal.copy(hit.face.normal).applyMatrix3(_normalMatrix).normalize();
    } else {
      _worldNormal.set(0, 1, 0);
    }
    const walkable = isWalkableNormal(_worldNormal.y);
    if (!walkable) continue;
    return {
      position: [hit.point.x, hit.point.y, hit.point.z],
      normal: [_worldNormal.x, _worldNormal.y, _worldNormal.z],
      distance: hit.distance,
      walkable: true,
    };
  }

  // Fallback: infinite ground plane at floorY
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorYFallback);
  const point = new THREE.Vector3();
  if (_raycaster.ray.intersectPlane(plane, point)) {
    return {
      position: [point.x, floorYFallback, point.z],
      normal: [0, 1, 0],
      distance: _raycaster.ray.origin.distanceTo(point),
      walkable: true,
    };
  }
  return null;
}
