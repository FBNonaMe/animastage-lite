/**
 * GPU-animated weather geometry for Scene FX (Visual Quality 2.0).
 * Supports FG / MG / BG depth layers for snow & rain atmospheric depth.
 */
import * as THREE from 'three';

export type WeatherFxKind = 'rain' | 'snow' | 'ash' | 'dust' | 'mist';

export type WeatherDepthLayer = 'foreground' | 'midground' | 'background';

export interface WeatherFxTuning {
  kind: WeatherFxKind;
  count: number;
  intensity: number;
  speed: number;
  directionDeg: number;
  turbulence: number;
  /** Scene scale multiplier (MMD scenes are ~20 units per character). */
  worldScale: number;
  color: string;
  /** Depth layer — affects size, speed, opacity, blur. */
  layer?: WeatherDepthLayer;
  /** Extra wind gust strength 0–1. */
  gust?: number;
}

export interface WeatherFxAssets {
  object: THREE.Object3D;
  material: THREE.ShaderMaterial;
  dispose: () => void;
}

const VERTEX_COMMON = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uHeight;
  uniform float uRadius;
  uniform float uTurbulence;
  uniform vec2 uWind;
  uniform float uGust;
  uniform vec3 uOrigin;
  uniform float uSize;
  uniform float uStretch;
  uniform float uSizeJitter;

  attribute vec3 aSeed;
  attribute float aEnd;

  varying float vFade;
  varying float vDepthSoft;

  vec3 particlePosition(float t) {
    float span = uHeight;
    float phase = fract(aSeed.y + t * uSpeed / max(span, 0.001));
    float y = span - phase * span;

    float gust = sin(t * (0.35 + aSeed.z * 0.55) + aSeed.x * 6.2831) * uGust;
    float sway = sin((t * (0.6 + aSeed.z * 1.4)) + aSeed.x * 12.5663) * uTurbulence;
    float swayZ = cos((t * (0.5 + aSeed.x * 1.1)) + aSeed.z * 9.4247) * uTurbulence;

    float x = (aSeed.x - 0.5) * 2.0 * uRadius + sway + (uWind.x + gust) * phase * span;
    float z = (aSeed.z - 0.5) * 2.0 * uRadius + swayZ + (uWind.y + gust * 0.7) * phase * span;

    vFade = smoothstep(0.0, 0.12, phase) * (1.0 - smoothstep(0.86, 1.0, phase));
    vDepthSoft = mix(0.55, 1.0, aSeed.z);
    return uOrigin + vec3(x, y, z);
  }
`;

const POINT_VERTEX = /* glsl */ `
  ${VERTEX_COMMON}
  void main() {
    vec3 world = particlePosition(uTime);
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float sizeMul = mix(1.0 - uSizeJitter, 1.0 + uSizeJitter, aSeed.x);
    gl_PointSize = uSize * sizeMul * (300.0 / max(-mv.z, 1.0));
  }
`;

const POINT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uSoftness;
  varying float vFade;
  varying float vDepthSoft;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float edge = mix(0.22, 0.42, uSoftness);
    float soft = 1.0 - smoothstep(edge * 0.5, 0.5, d);
    float alpha = uOpacity * vFade * soft * vDepthSoft;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const LINE_VERTEX = /* glsl */ `
  ${VERTEX_COMMON}
  void main() {
    vec3 world = particlePosition(uTime);
    world += aEnd * vec3(-(uWind.x), 1.0, -(uWind.y)) * uStretch;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const LINE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying float vDepthSoft;

  void main() {
    gl_FragColor = vec4(uColor, uOpacity * vFade * vDepthSoft);
  }
`;

function seedAttributes(count: number, verticesPerParticle: number) {
  const total = count * verticesPerParticle;
  const seeds = new Float32Array(total * 3);
  const ends = new Float32Array(total);
  const positions = new Float32Array(total * 3);

  for (let i = 0; i < count; i++) {
    const sx = Math.random();
    const sy = Math.random();
    const sz = Math.random();
    for (let v = 0; v < verticesPerParticle; v++) {
      const idx = i * verticesPerParticle + v;
      seeds[idx * 3] = sx;
      seeds[idx * 3 + 1] = sy;
      seeds[idx * 3 + 2] = sz;
      ends[idx] = v === 1 ? 1 : 0;
    }
  }

  return { seeds, ends, positions };
}

function kindDefaults(kind: WeatherFxKind) {
  switch (kind) {
    case 'rain':
      return { speed: 55, size: 1.4, opacity: 0.42, turbulence: 0.4, stretch: 1.6 };
    case 'snow':
      return { speed: 6, size: 2.6, opacity: 0.75, turbulence: 2.2, stretch: 0 };
    case 'ash':
      return { speed: 4, size: 2.2, opacity: 0.5, turbulence: 3.0, stretch: 0 };
    case 'dust':
      return { speed: 2.5, size: 1.8, opacity: 0.32, turbulence: 3.5, stretch: 0 };
    case 'mist':
      return { speed: 1.2, size: 6.0, opacity: 0.14, turbulence: 4.0, stretch: 0 };
  }
}

function layerMods(layer: WeatherDepthLayer) {
  switch (layer) {
    case 'foreground':
      return {
        size: 1.45,
        speed: 1.1,
        opacity: 1.05,
        height: 0.75,
        radius: 0.55,
        soft: 0.85,
        count: 0.28,
        blur: 0.55,
      };
    case 'midground':
      return {
        size: 1,
        speed: 1,
        opacity: 1,
        height: 1,
        radius: 1,
        soft: 0.45,
        count: 0.42,
        blur: 0.35,
      };
    case 'background':
      return {
        size: 0.55,
        speed: 0.75,
        opacity: 0.55,
        height: 1.25,
        radius: 1.35,
        soft: 0.2,
        count: 0.3,
        blur: 0.15,
      };
  }
}

export function createWeatherFx(tuning: WeatherFxTuning): WeatherFxAssets {
  const defaults = kindDefaults(tuning.kind);
  const layer = tuning.layer ?? 'midground';
  const lm = layerMods(layer);
  const scale = Math.max(0.05, tuning.worldScale);
  const streaks = tuning.kind === 'rain';
  const verticesPerParticle = streaks ? 2 : 1;
  const count = Math.max(1, Math.floor(tuning.count));
  const { seeds, ends, positions } = seedAttributes(count, verticesPerParticle);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const windRad = (tuning.directionDeg * Math.PI) / 180;
  const windStrength = 0.25 + tuning.turbulence * 0.5;
  const gust = Math.max(0, Math.min(1, tuning.gust ?? tuning.turbulence * 0.45));

  const material = new THREE.ShaderMaterial({
    vertexShader: streaks ? LINE_VERTEX : POINT_VERTEX,
    fragmentShader: streaks ? LINE_FRAGMENT : POINT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: tuning.kind === 'mist' ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: {
        value: defaults.speed * scale * Math.max(0.05, tuning.speed) * lm.speed,
      },
      uHeight: { value: 45 * scale * lm.height },
      uRadius: { value: 55 * scale * lm.radius },
      uTurbulence: {
        value: defaults.turbulence * scale * (0.4 + tuning.turbulence) * (layer === 'foreground' ? 1.2 : 1),
      },
      uWind: {
        value: new THREE.Vector2(
          Math.sin(windRad) * windStrength,
          Math.cos(windRad) * windStrength
        ),
      },
      uGust: { value: gust * scale * 2.5 },
      uOrigin: { value: new THREE.Vector3() },
      uSize: { value: defaults.size * scale * 0.5 * lm.size },
      uStretch: { value: defaults.stretch * scale * 0.9 },
      uSizeJitter: { value: tuning.kind === 'snow' ? 0.45 : 0.2 },
      uSoftness: { value: lm.soft },
      uColor: { value: new THREE.Color(tuning.color) },
      uOpacity: {
        value: Math.min(
          1,
          defaults.opacity * Math.max(0.1, tuning.intensity) * lm.opacity
        ),
      },
    },
  });

  const object = streaks
    ? new THREE.LineSegments(geometry, material)
    : new THREE.Points(geometry, material);
  object.frustumCulled = false;
  object.renderOrder = layer === 'foreground' ? 4 : layer === 'midground' ? 2 : 1;
  object.name = `SceneFxWeather_${tuning.kind}_${layer}`;

  return {
    object,
    material,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

/** Split a particle budget across FG/MG/BG layers. */
export function createLayeredWeatherFx(
  tuning: Omit<WeatherFxTuning, 'layer' | 'count'> & { count: number },
  layerCount: 1 | 2 | 3
): WeatherFxAssets[] {
  const layers: WeatherDepthLayer[] =
    layerCount >= 3
      ? ['foreground', 'midground', 'background']
      : layerCount === 2
        ? ['midground', 'background']
        : ['midground'];

  return layers.map((layer) => {
    const lm = layerMods(layer);
    return createWeatherFx({
      ...tuning,
      layer,
      count: Math.max(32, Math.floor(tuning.count * lm.count * (3 / layers.length))),
    });
  });
}

export function weatherColorForKind(kind: WeatherFxKind): string {
  switch (kind) {
    case 'rain':
      return '#a8c8ff';
    case 'snow':
      return '#eef6ff';
    case 'ash':
      return '#b0a496';
    case 'dust':
      return '#d8c8a8';
    case 'mist':
      return '#cfd8e6';
  }
}

export function weatherKindFromEffectId(effectId: string): WeatherFxKind | null {
  if (effectId.includes('rain')) return 'rain';
  if (effectId.includes('snow')) return 'snow';
  if (effectId.includes('ash')) return 'ash';
  if (effectId.includes('dust')) return 'dust';
  if (effectId.includes('mist') || effectId.includes('fog')) return 'mist';
  return null;
}
