import type { CameraSnapshot, VisualFxSettings } from '../types';
import type * as THREE from 'three';

/** Full MMD toon material for path tracing. */
export interface BakedMaterial {
  color: [number, number, number];
  emissive: [number, number, number];
  emissiveIntensity: number;
  /** 0 = diffuse/toon, 1 = metal, 4 = skin SSS */
  matType: number;
  mapIndex: number;
  /** envMap — .sph multiply / .spa add */
  sphereIndex: number;
  gradientIndex: number;
  normalIndex: number;
  emissiveMapIndex: number;
  alphaIndex: number;
  /** true = .sph (multiply), false = .spa (add) */
  sphereMultiply: boolean;
  alphaTest: boolean;
  alphaCutoff: number;
  normalScale: number;
  /** 0..1 — how strongly toon gradient affects direct light */
  toonStrength: number;
}

/** One world-space triangle for GPU path tracing. */
export interface BakedTriangle {
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
  uv0: [number, number];
  uv1: [number, number];
  uv2: [number, number];
  matIndex: number;
}

export interface PathTracerLight {
  position: [number, number, number];
  radius: number;
  color: [number, number, number];
  intensity: number;
}

export interface PathTracerSceneData {
  triangles: BakedTriangle[];
  materials: BakedMaterial[];
  /** All unique textures (diffuse, sphere, toon, normal, emissive, alpha). */
  textures: THREE.Texture[];
  lights: PathTracerLight[];
  floorY?: number;
}

export interface PathTracerCamera {
  position: [number, number, number];
  /** Legacy look-at; prefer right/up/forward from Three.js matrix. */
  target: [number, number, number];
  right: [number, number, number];
  up: [number, number, number];
  forward: [number, number, number];
  fov: number;
  aperture?: number;
  focusDist?: number;
}

export interface PathTracerRenderSettings {
  visualFx: VisualFxSettings;
  bounces?: number;
  samplesPerFrame?: number;
  denoise?: boolean;
  bloom?: boolean;
  bloomThreshold?: number;
  bloomStrength?: number;
  exposure?: number;
  vignetteStrength?: number;
  floorY?: number;
  /** 0..1 internal resolution scale */
  resolutionScale?: number;
  textureSize?: number;
  maxTextures?: number;
  maxInternalWidth?: number;
  maxInternalHeight?: number;
  denoiseMaxRadius?: number;
  sunIntensityScale?: number;
  enableNEE?: boolean;
  /** Sun elevation in degrees (path tracer lab). */
  sunAltDeg?: number;
  /** Sun azimuth radians; default ≈ −0.7. */
  sunAzimuth?: number;
}

export interface PathTracerLabHudStats {
  spp: number;
  fps: number;
  bounces: number;
  mode: string;
  triangleCount: number;
  qualityHint?: string;
}

export interface PathTracerCaptureOptions {
  camera: PathTracerCamera;
  scene: PathTracerSceneData;
  settings: PathTracerRenderSettings;
  width: number;
  height: number;
  targetSamples: number;
  onProgress?: (samples: number, target: number) => void;
}

export const PATH_TRACER_MAX_TRIANGLES = 48_000;
export const PATH_TRACER_MAX_MATERIALS = 512;
export const PATH_TRACER_MAX_OBJECTS = 32;
export const PATH_TRACER_MAX_TEXTURES = 128;
export const NO_TEXTURE_INDEX = 0xffffffff;
/** @deprecated use NO_TEXTURE_INDEX */
export const PATH_TRACER_NO_TEXTURE = NO_TEXTURE_INDEX;
export const PHOTO_TARGET_SAMPLES = 96;
export const VIDEO_SAMPLES_PER_FRAME = 2;

/** Material flags for WGSL */
export const MMD_FLAG_SPHERE_MULTIPLY = 1;
export const MMD_FLAG_ALPHA_TEST = 2;
export const MMD_FLAG_TOON = 4;
