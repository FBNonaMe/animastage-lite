/** Cached environment analysis — does not modify fog/lights/sky/camera/FX. */
import * as THREE from 'three';
import type { MMDModel } from '../types';
import type { EnvAnalysisCache } from './types';

const analysisCache = new Map<string, EnvAnalysisCache>();

export function getCachedEnvAnalysis(stageModelId: string): EnvAnalysisCache | null {
  return analysisCache.get(stageModelId) ?? null;
}

export function clearEnvAnalysisCache(stageModelId?: string): void {
  if (stageModelId) analysisCache.delete(stageModelId);
  else analysisCache.clear();
}

function isLikelyCharacterMesh(obj: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = obj;
  while (p) {
    if ((p as THREE.SkinnedMesh).isSkinnedMesh) return true;
    const n = (p.name || '').toLowerCase();
    if (n.includes('mmd') || n.includes('character') || n.includes('pmx')) return true;
    if (p.userData?.assetKind === 'character') return true;
    p = p.parent;
  }
  return false;
}

function isStageTagged(obj: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = obj;
  while (p) {
    if (p.userData?.assetKind === 'stage' || p.userData?.shotComposerRole === 'raycast') {
      return true;
    }
    p = p.parent;
  }
  return false;
}

/**
 * Analyze stage meshes in the live scene graph.
 * Prefer meshes under stage-tagged roots; fall back to non-skinned static meshes.
 */
export function analyzeEnvironmentFromScene(
  scene: THREE.Scene,
  stageModel: MMDModel,
  force = false
): EnvAnalysisCache {
  const cached = analysisCache.get(stageModel.id);
  if (!force && cached && Date.now() - cached.analyzedAt < 30_000) {
    return cached;
  }

  const box = new THREE.Box3();
  let meshCount = 0;
  let walkable = 0;
  const floorYs: number[] = [];
  const _n = new THREE.Vector3();
  const _normalMatrix = new THREE.Matrix3();

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (isLikelyCharacterMesh(mesh)) return;
    const stageOnly = isStageTagged(mesh);
    if (!stageOnly && mesh.userData?.shotComposerRole === 'background') return;
    if (!stageOnly && mesh.userData?.shotComposerRole === 'decoration') return;

    mesh.updateWorldMatrix(true, false);
    const geoBox = new THREE.Box3().setFromObject(mesh);
    if (geoBox.isEmpty()) return;
    const size = geoBox.getSize(new THREE.Vector3());
    if (size.length() < 0.05) return;
    if (!stageOnly && size.y < 0.2 && size.x < 2 && size.z < 2) return;

    box.union(geoBox);
    meshCount += 1;

    const pos = mesh.geometry.getAttribute('position');
    const nor = mesh.geometry.getAttribute('normal');
    if (!pos || !nor || pos.count < 3) return;
    _normalMatrix.getNormalMatrix(mesh.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / 80));
    for (let i = 0; i < pos.count; i += step) {
      _n.fromBufferAttribute(nor, i).applyMatrix3(_normalMatrix).normalize();
      if (_n.y < 0.65) continue;
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      floorYs.push(v.y);
      walkable += 1;
    }
  });

  if (box.isEmpty()) {
    const fallback: EnvAnalysisCache = {
      stageModelId: stageModel.id,
      analyzedAt: Date.now(),
      bboxMin: [-20, 0, -20],
      bboxMax: [20, 20, 20],
      center: [stageModel.positionX, stageModel.positionY, stageModel.positionZ],
      size: [40, 20, 40],
      worldScale: stageModel.worldScale ?? 1,
      sceneHeight: 20,
      floorY: stageModel.positionY,
      walkableSampleCount: 0,
      meshCount: 0,
    };
    analysisCache.set(stageModel.id, fallback);
    return fallback;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  floorYs.sort((a, b) => a - b);
  const floorY =
    floorYs.length > 0
      ? floorYs[Math.floor(floorYs.length * 0.15)]!
      : box.min.y;

  const result: EnvAnalysisCache = {
    stageModelId: stageModel.id,
    analyzedAt: Date.now(),
    bboxMin: [box.min.x, box.min.y, box.min.z],
    bboxMax: [box.max.x, box.max.y, box.max.z],
    center: [center.x, center.y, center.z],
    size: [size.x, size.y, size.z],
    worldScale: stageModel.worldScale ?? 1,
    sceneHeight: size.y,
    floorY,
    walkableSampleCount: walkable,
    meshCount,
  };
  analysisCache.set(stageModel.id, result);
  return result;
}

/** Lightweight analysis from model record only (no mesh traverse). */
export function analyzeEnvironmentFromModel(stageModel: MMDModel): EnvAnalysisCache {
  const cached = analysisCache.get(stageModel.id);
  if (cached) return cached;
  const s = stageModel.worldScale ?? 1;
  const result: EnvAnalysisCache = {
    stageModelId: stageModel.id,
    analyzedAt: Date.now(),
    bboxMin: [-15 * s, 0, -15 * s],
    bboxMax: [15 * s, 20 * s, 15 * s],
    center: [stageModel.positionX, stageModel.positionY + 5 * s, stageModel.positionZ],
    size: [30 * s, 20 * s, 30 * s],
    worldScale: s,
    sceneHeight: 20 * s,
    floorY: stageModel.positionY,
    walkableSampleCount: 0,
    meshCount: 0,
  };
  analysisCache.set(stageModel.id, result);
  return result;
}
