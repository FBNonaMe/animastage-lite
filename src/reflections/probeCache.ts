/**
 * Smart reflection probes — CubeCamera capture with caching / dirty updates.
 */
import * as THREE from 'three';

export interface ProbeCaptureOptions {
  resolution: number;
  near?: number;
  far?: number;
}

export class ReflectionProbeCache {
  private cubeTarget: THREE.WebGLCubeRenderTarget | null = null;
  private cubeCamera: THREE.CubeCamera | null = null;
  private pmrem: THREE.PMREMGenerator | null = null;
  private envMap: THREE.Texture | null = null;
  private lastResolution = 0;
  private lastFingerprint = '';
  captureVersion = 0;

  ensure(renderer: THREE.WebGLRenderer, resolution: number): void {
    if (this.cubeTarget && this.lastResolution === resolution) return;
    this.disposeTargets();
    this.lastResolution = resolution;
    this.cubeTarget = new THREE.WebGLCubeRenderTarget(resolution, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      mapping: THREE.CubeReflectionMapping,
    });
    this.cubeCamera = new THREE.CubeCamera(0.25, 200, this.cubeTarget);
    this.pmrem?.dispose();
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileCubemapShader();
  }

  getEnvMap(): THREE.Texture | null {
    return this.envMap;
  }

  getCubeTarget(): THREE.WebGLCubeRenderTarget | null {
    return this.cubeTarget;
  }

  needsUpdate(fingerprint: string, refreshRate: number, nowSec: number, lastCaptureAt: number): boolean {
    if (fingerprint !== this.lastFingerprint) return true;
    if (refreshRate <= 0) return false;
    return nowSec - lastCaptureAt >= refreshRate;
  }

  /**
   * Capture scene into cubemap. Temporarily hides objects with userData.bpSkipProbe.
   */
  capture(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    position: THREE.Vector3,
    fingerprint: string
  ): THREE.Texture | null {
    if (!this.cubeCamera || !this.cubeTarget || !this.pmrem) return null;

    const hidden: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.userData?.bpSkipProbe && obj.visible) {
        obj.visible = false;
        hidden.push(obj);
      }
    });

    const prevBg = scene.background;
    this.cubeCamera.position.copy(position);
    this.cubeCamera.update(renderer, scene);

    for (const obj of hidden) obj.visible = true;
    scene.background = prevBg;

    const prevEnv = this.envMap;
    this.envMap = this.pmrem.fromCubemap(this.cubeTarget.texture).texture;
    prevEnv?.dispose();

    this.lastFingerprint = fingerprint;
    this.captureVersion += 1;
    return this.envMap;
  }

  private disposeTargets(): void {
    this.cubeTarget?.dispose();
    this.cubeTarget = null;
    this.cubeCamera = null;
    this.envMap?.dispose();
    this.envMap = null;
  }

  dispose(): void {
    this.disposeTargets();
    this.pmrem?.dispose();
    this.pmrem = null;
  }
}

/** Build a stable fingerprint for when probes must refresh. */
export function buildProbeFingerprint(parts: {
  scenePreset?: string;
  skyPreset?: string;
  hdrUrl?: string | null;
  weather?: string;
  fogEnabled?: boolean;
  fogDensity?: number;
  sunAzimuth?: number;
  sunElevation?: number;
  envIntensity?: number;
  sceneKind?: string;
  resolution?: number;
}): string {
  return [
    parts.scenePreset ?? '',
    parts.skyPreset ?? '',
    parts.hdrUrl ? 'hdr' : 'nohdr',
    parts.weather ?? '',
    parts.fogEnabled ? `fog${parts.fogDensity?.toFixed(2)}` : 'nofog',
    `sun${parts.sunAzimuth?.toFixed(0)}_${parts.sunElevation?.toFixed(0)}`,
    `e${parts.envIntensity?.toFixed(2)}`,
    parts.sceneKind ?? '',
    `r${parts.resolution ?? 0}`,
  ].join('|');
}
