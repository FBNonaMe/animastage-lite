import * as THREE from 'three';
import type { MMDAnimationHelper } from 'three-stdlib';
import type { SkinnedMesh } from 'three';
import { compileMmdSkinnedMeshWebGPU } from './mmdSkinnedWebGPUBinder';
import { runWorkInSlices } from './sceneOptim/mainThreadScheduler';
import { yieldToMain } from '../utils/yieldMainThread';

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'emissiveMap',
  'specularMap',
  'alphaMap',
  'gradientMap',
  'matcap',
  'lightMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'roughnessMap',
  'metalnessMap',
] as const;

function collectMeshTextures(mesh: THREE.SkinnedMesh): THREE.Texture[] {
  const out: THREE.Texture[] = [];
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of mats) {
    if (!mat) continue;
    for (const key of TEXTURE_KEYS) {
      const tex = (mat as Record<string, unknown>)[key];
      if (tex instanceof THREE.Texture) out.push(tex);
    }
  }
  return out;
}

async function initTexturesWebGL(
  renderer: THREE.WebGLRenderer,
  textures: readonly THREE.Texture[]
): Promise<void> {
  if (textures.length === 0) return;
  await runWorkInSlices(
    textures.map((tex) => () => renderer.initTexture(tex)),
    8
  );
}

export interface AssetWarmupOptions {
  mesh: THREE.SkinnedMesh;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  helper?: MMDAnimationHelper | null;
  animationClip?: THREE.AnimationClip | null;
  onProgress?: (message: string) => void;
}

/**
 * Hidden skeleton + shader compile pass before first visible frame.
 */
export async function runAssetWarmupPipeline(options: AssetWarmupOptions): Promise<void> {
  const { mesh, renderer, scene, camera, helper, animationClip, onProgress } = options;

  onProgress?.('Warming up shaders and textures…');

  if (helper && animationClip) {
    onProgress?.('Warming up skeleton (frame 0)…');
    helper.enable('animation', true);
    helper.update(0.001);
    await yieldToMain();
  }

  mesh.updateMatrixWorld(true);
  if (mesh.skeleton) {
    for (const bone of mesh.skeleton.bones) {
      bone.updateMatrixWorld(true);
    }
    mesh.skeleton.update();
  }

    onProgress?.('Uploading textures to GPU…');
    await initTexturesWebGL(renderer, collectMeshTextures(mesh));
    await yieldToMain();

    onProgress?.('Compiling shaders…');
    const isWebGpu = Boolean(
      (renderer as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer
    );

    if (isWebGpu) {
      await compileMmdSkinnedMeshWebGPU(
        renderer as unknown as import('three/webgpu').WebGPURenderer,
        mesh,
        scene,
        camera
      );
      await yieldToMain();
    }

    renderer.compile(mesh, camera, scene);
    await yieldToMain();
    renderer.render(scene, camera);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
