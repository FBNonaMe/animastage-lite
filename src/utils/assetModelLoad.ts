import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader, OBJLoader, MTLLoader } from 'three-stdlib';
import {
  buildAssetIndex,
  createAssetBundleLoadingManager,
  lookupInFileMap,
  normalizeBlobFetchUrl,
  resolveAssetUrl,
  type CharacterModelFormat,
} from './mmdFiles';
import {
  humanizeGltfLoadError,
} from './gltfFormatGuard';
import {
  computeFbxWorldBounds,
  detectAssetModelKind,
  getFbxFocusPoint,
  prepareFbxMaterials,
  prepareGltfMaterials,
  repairModelTextures,
} from './assetModelPrep';

export interface LoadedAssetModel {
  root: THREE.Group;
  animations: THREE.AnimationClip[];
  kind: ReturnType<typeof detectAssetModelKind>;
}

function resolveModelFetchUrl(
  url: string,
  fileMap?: Record<string, string>
): string {
  const base = normalizeBlobFetchUrl(url);
  if (!fileMap) return base;
  const resolved = resolveAssetUrl(url, fileMap);
  return resolved ? normalizeBlobFetchUrl(resolved) : base;
}

function findMtlUrl(modelUrl: string, fileMap: Record<string, string>): string | null {
  const index = buildAssetIndex(fileMap);
  const stem = modelUrl
    .replace(/#.*$/, '')
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.obj$/i, '');
  if (!stem) return null;

  for (const suffix of [`${stem}.mtl`, `${stem.toLowerCase()}.mtl`]) {
    const hit = lookupInFileMap(suffix, fileMap, index);
    if (hit) return `${hit}#${suffix.split('/').pop()}`;
  }

  for (const [key, val] of Object.entries(fileMap)) {
    if (key.toLowerCase().endsWith('.mtl')) {
      return `${val}#${key.split(/[\\/]/).pop()}`;
    }
  }
  return null;
}

export function loadAssetModel(
  format: CharacterModelFormat,
  url: string,
  manager: THREE.LoadingManager,
  fileMap?: Record<string, string>,
  modelFileName?: string
): Promise<LoadedAssetModel> {
  const fetchUrl = resolveModelFetchUrl(url, fileMap);

  return new Promise((resolve, reject) => {
    const finish = async (object: THREE.Object3D, animations: THREE.AnimationClip[] = []) => {
      const root = new THREE.Group();
      root.name = 'ImportedAssetRoot';
      root.add(object);

      if (format === 'gltf') {
        prepareGltfMaterials(root, true);
        if (fileMap) {
          await repairModelTextures(root, fileMap, modelFileName);
        }
      } else {
        prepareFbxMaterials(root, true);
        if (fileMap) {
          await repairModelTextures(root, fileMap, modelFileName);
          prepareFbxMaterials(root, true);
        }
      }

      const bounds = computeFbxWorldBounds(root);
      let kind = detectAssetModelKind(modelFileName ?? url, bounds);
      if (kind === 'prop' && animations.length > 0) {
        kind = 'character';
      }
      // Normalize after the viewer samples the first animation/bind pose —
      // many GLBs have crumpled bind-pose geom until skeleton is updated.

      resolve({ root, animations, kind });
    };

    if (format === 'fbx') {
      const loader = new FBXLoader(manager);
      loader.load(
        fetchUrl,
        (object) => {
          void finish(object, object.animations ?? []).catch(reject);
        },
        undefined,
        (err) => {
          const msg = err instanceof Error ? err.message : String(err ?? 'FBX load failed');
          // Orphaned AnimationCurve nodes (common in Maya/Max exports).
          if (/curves/i.test(msg) || /Cannot read propert/i.test(msg)) {
            reject(
              new Error(
                `FBX animation data is corrupted/unsupported (${msg}). Re-export without bake errors or as GLB.`
              )
            );
            return;
          }
          reject(err instanceof Error ? err : new Error(msg));
        }
      );
      return;
    }

    if (format === 'gltf') {
      const loader = new GLTFLoader(manager);
      loader.load(
        fetchUrl,
        (gltf) => {
          void finish(gltf.scene, gltf.animations ?? []).catch(reject);
        },
        undefined,
        (err) => {
          reject(humanizeGltfLoadError(err));
        }
      );
      return;
    }

    if (format === 'obj') {
      const objLoader = new OBJLoader(manager);
      const mtlUrl = fileMap ? findMtlUrl(url, fileMap) : null;

      const loadObj = () => {
        objLoader.load(
          fetchUrl,
          (object) => {
            void finish(object, []).catch(reject);
          },
          undefined,
          reject
        );
      };

      if (mtlUrl && fileMap) {
        const mtlLoader = new MTLLoader(manager);
        mtlLoader.load(
          resolveModelFetchUrl(mtlUrl, fileMap),
          (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            loadObj();
          },
          undefined,
          () => loadObj()
        );
        return;
      }

      loadObj();
      return;
    }

    reject(new Error(`Unsupported model format: ${format}`));
  });
}

export function frameCameraOnImportedModel(
  camera: THREE.Camera,
  controls: unknown,
  root: THREE.Object3D,
  kind: ReturnType<typeof detectAssetModelKind>
): void {
  if (!(camera instanceof THREE.PerspectiveCamera)) return;

  const focus = getFbxFocusPoint(root);
  const bounds = computeFbxWorldBounds(root);
  const size = bounds.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 8);
  const portrait = camera.aspect > 0 && camera.aspect < 0.85;
  const distMul = portrait
    ? kind === 'stage'
      ? 1.45
      : 2.15
    : kind === 'stage'
      ? 1.2
      : 1.85;

  const distance = maxDim * distMul;
  const heightBias = kind === 'stage' ? maxDim * 0.38 : maxDim * 0.22;
  // Aim a bit lower than center so feet stay in frame (esp. 9:16).
  const aim = focus.clone();
  if (portrait) aim.y -= maxDim * 0.08;

  camera.position.set(aim.x, aim.y + heightBias, aim.z + distance);
  camera.lookAt(aim);
  camera.updateProjectionMatrix();

  const orbit = controls as { target?: THREE.Vector3; update?: () => void } | null;
  if (orbit?.target) {
    orbit.target.copy(aim);
    orbit.update?.();
  }
}

export { createAssetBundleLoadingManager } from './mmdFiles';
