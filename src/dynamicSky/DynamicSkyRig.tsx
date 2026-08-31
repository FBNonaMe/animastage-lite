/**
 * Procedural sky dome, sun/moon disks, simple scrolling cloud layer.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DynamicSkyLook, DynamicSkyQuality } from './types';
import { qualitySkySegments } from './applyLook';

/** Like sunPositionFromAngles but allows negative elevation (celestial disks). */
function celestialPosition(
  azimuthDeg: number,
  elevationDeg: number,
  radius: number
): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return [
    radius * Math.cos(el) * Math.sin(az),
    radius * Math.sin(el),
    radius * Math.cos(el) * Math.cos(az),
  ];
}

function SkyDomeMesh({
  look,
  quality,
}: {
  look: DynamicSkyLook;
  quality: DynamicSkyQuality;
}) {
  const seg = qualitySkySegments(quality);
  const geo = useMemo(() => new THREE.SphereGeometry(180, seg, Math.max(12, seg / 2)), [seg]);
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new THREE.Color(look.colors.zenith) },
        horizon: { value: new THREE.Color(look.colors.horizon) },
        ground: { value: new THREE.Color(look.colors.ground) },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunGlow: { value: new THREE.Color(look.colors.sunGlow) },
        brightness: { value: look.skyBrightness },
        density: { value: look.atmosphericDensity },
        mie: { value: look.nightMode ? 0.15 : 0.45 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = normalize(w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 zenith;
        uniform vec3 horizon;
        uniform vec3 ground;
        uniform vec3 sunDir;
        uniform vec3 sunGlow;
        uniform float brightness;
        uniform float density;
        uniform float mie;
        varying vec3 vWorld;
        void main() {
          float h = clamp(vWorld.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(h, 1.15));
          col = mix(ground, col, smoothstep(-0.15, 0.2, vWorld.y));
          float sunDot = max(dot(normalize(vWorld), normalize(sunDir)), 0.0);
          float glow = pow(sunDot, mix(24.0, 8.0, density)) * mie;
          float haze = pow(1.0 - abs(vWorld.y), 2.2) * density * 0.35;
          col += sunGlow * glow;
          col = mix(col, sunGlow * 0.65 + horizon * 0.35, haze);
          col *= brightness;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    return m;
  }, []);

  useFrame(() => {
    const sunPos = celestialPosition(look.sunAzimuth, look.sunElevation, 1);
    mat.uniforms.zenith.value.set(look.colors.zenith);
    mat.uniforms.horizon.value.set(look.colors.horizon);
    mat.uniforms.ground.value.set(look.colors.ground);
    mat.uniforms.sunGlow.value.set(look.colors.sunGlow);
    mat.uniforms.brightness.value = look.skyBrightness;
    mat.uniforms.density.value = look.atmosphericDensity;
    mat.uniforms.mie.value = look.nightMode ? 0.18 : 0.5;
    mat.uniforms.sunDir.value.set(sunPos[0], sunPos[1], sunPos[2]).normalize();
  });

  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
}

function CelestialDisk({
  azimuth,
  elevation,
  color,
  size,
  intensity,
}: {
  azimuth: number;
  elevation: number;
  color: string;
  size: number;
  intensity: number;
}) {
  const pos = celestialPosition(azimuth, elevation, 120);
  if (elevation < -8 || intensity < 0.04) return null;
  return (
    <mesh position={pos} frustumCulled={false}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function CloudBand({
  look,
  animate,
}: {
  look: DynamicSkyLook;
  animate: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame((_, dt) => {
    if (!ref.current || !animate) return;
    ref.current.rotation.y += dt * look.cloudSpeed * 0.04;
    ref.current.position.copy(camera.position);
  });

  if (look.cloudCoverage < 0.08) return null;

  const count = Math.round(4 + look.cloudCoverage * 10);
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = 40 + (i % 3) * 12;
    const y = 18 + (i % 4) * 3;
    clouds.push(
      <mesh
        key={i}
        position={[Math.cos(a) * r, y, Math.sin(a) * r]}
        scale={[6 + look.cloudDensity * 8, 1.2 + look.cloudDensity, 4 + look.cloudDensity * 5]}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial
          color={look.nightMode ? '#3a4458' : '#f2f6ff'}
          transparent
          opacity={look.cloudOpacity * (0.45 + look.cloudCoverage * 0.4)}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
    );
  }

  return <group ref={ref}>{clouds}</group>;
}

export interface DynamicSkyRigProps {
  look: DynamicSkyLook;
  quality: DynamicSkyQuality;
  showDome: boolean;
  showSun: boolean;
  showMoon: boolean;
  showClouds: boolean;
  animateClouds: boolean;
}

export default function DynamicSkyRig({
  look,
  quality,
  showDome,
  showSun,
  showMoon,
  showClouds,
  animateClouds,
}: DynamicSkyRigProps) {
  return (
    <group name="DynamicSkyRig">
      {showDome ? <SkyDomeMesh look={look} quality={quality} /> : null}
      {showSun && !look.nightMode ? (
        <CelestialDisk
          azimuth={look.sunAzimuth}
          elevation={look.sunElevation}
          color={look.sunColor}
          size={2.8}
          intensity={look.sunIntensity}
        />
      ) : null}
      {showMoon && (look.nightMode || look.moonElevation > 10) ? (
        <CelestialDisk
          azimuth={look.moonAzimuth}
          elevation={look.moonElevation}
          color={look.moonColor}
          size={1.6}
          intensity={look.moonIntensity}
        />
      ) : null}
      {showClouds ? <CloudBand look={look} animate={animateClouds} /> : null}
    </group>
  );
}
