import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BoneTrailTracker,
  boneWorldPosition,
  findCharacterRig,
  refreshRigBounds,
  type CharacterRig,
} from '../../sceneStudio/runtime/boneSampler';

export type CharacterFxKind = 'aura' | 'magic_circle' | 'trail';

interface CharacterFxLayerProps {
  kind: CharacterFxKind;
  intensity: number;
  color?: string;
  /** Canonical bone id for trail effects (e.g. `right_hand`). */
  boneId?: string | null;
  /** Character position hint from app state, used to pick the right rig. */
  nearPosition?: [number, number, number] | null;
}

const TRAIL_POINTS = 48;

const AURA_VERTEX = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const AURA_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    float fresnel = 1.0 - abs(dot(normalize(vNormalView), normalize(vViewDir)));
    float shell = pow(fresnel, 2.4);
    float pulse = 0.85 + 0.15 * sin(uTime * 2.4);
    gl_FragColor = vec4(uColor, shell * uOpacity * pulse);
  }
`;

const CIRCLE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CIRCLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    float angle = atan(p.y, p.x) + uTime * 0.6;
    float ring1 = smoothstep(0.02, 0.0, abs(r - 0.94));
    float ring2 = smoothstep(0.02, 0.0, abs(r - 0.72));
    float ring3 = smoothstep(0.015, 0.0, abs(r - 0.42));
    float spokes = smoothstep(0.75, 1.0, abs(sin(angle * 8.0))) * smoothstep(0.9, 0.5, r) * 0.55;
    float glow = (1.0 - smoothstep(0.0, 1.0, r)) * 0.18;

    float mask = ring1 + ring2 + ring3 + spokes + glow;
    gl_FragColor = vec4(uColor, clamp(mask, 0.0, 1.0) * uOpacity);
  }
`;

const TRAIL_VERTEX = /* glsl */ `
  attribute float aAge;
  varying float vAge;
  void main() {
    vAge = aAge;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const TRAIL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAge;
  void main() {
    float fade = pow(1.0 - vAge, 1.6);
    gl_FragColor = vec4(uColor, fade * uOpacity);
  }
`;

function buildTrailGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertexCount = TRAIL_POINTS * 2;
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3)
  );
  const ages = new Float32Array(vertexCount);
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const age = i / (TRAIL_POINTS - 1);
    ages[i * 2] = age;
    ages[i * 2 + 1] = age;
  }
  geometry.setAttribute('aAge', new THREE.BufferAttribute(ages, 1));

  const indices: number[] = [];
  for (let i = 0; i < TRAIL_POINTS - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return geometry;
}

/** Aura, floor circle and bone ribbon trails driven by the live character rig. */
export default function CharacterFxLayer({
  kind,
  intensity,
  color = '#7be5ff',
  boneId = 'right_hand',
  nearPosition = null,
}: CharacterFxLayerProps) {
  const { scene, camera } = useThree();
  const rigRef = useRef<CharacterRig | null>(null);
  const rigAgeRef = useRef(0);
  const timeRef = useRef(0);
  const trackerRef = useRef(new BoneTrailTracker(TRAIL_POINTS));

  const auraRef = useRef<THREE.Mesh>(null);
  const circleRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);

  const nearVec = useMemo(
    () => (nearPosition ? new THREE.Vector3(...nearPosition) : null),
    [nearPosition]
  );

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: Math.min(1, Math.max(0, intensity)) },
      uTime: { value: 0 },
    }),
    [color, intensity]
  );

  const trailGeometry = useMemo(() => (kind === 'trail' ? buildTrailGeometry() : null), [kind]);

  useEffect(() => {
    trackerRef.current.reset();
  }, [boneId, kind]);

  useEffect(() => () => trailGeometry?.dispose(), [trailGeometry]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    uniforms.uTime.value = timeRef.current;

    rigAgeRef.current += delta;
    if (!rigRef.current || rigAgeRef.current > 0.5) {
      rigRef.current = findCharacterRig(scene, nearVec);
      rigAgeRef.current = 0;
    }
    const rig = rigRef.current;
    if (!rig) return;
    if (kind !== 'trail') refreshRigBounds(rig);

    if (kind === 'aura' && auraRef.current) {
      auraRef.current.position.copy(rig.center);
      auraRef.current.scale.setScalar(rig.radius * 1.06);
      auraRef.current.visible = true;
    }

    if (kind === 'magic_circle' && circleRef.current) {
      circleRef.current.position.set(rig.center.x, rig.floorY + rig.height * 0.01, rig.center.z);
      circleRef.current.scale.setScalar(rig.radius * 1.15);
      circleRef.current.visible = true;
    }

    if (kind === 'trail' && trailGeometry && trailRef.current) {
      const bonePos = boneWorldPosition(rig, boneId ?? 'right_hand');
      if (!bonePos) {
        trailRef.current.visible = false;
        return;
      }
      trackerRef.current.push(bonePos, delta);
      const { points } = trackerRef.current.sample();
      if (points.length < 2) {
        trailRef.current.visible = false;
        return;
      }

      const attr = trailGeometry.getAttribute('position') as THREE.BufferAttribute;
      const array = attr.array as Float32Array;
      const width = rig.height * 0.02 * (0.5 + intensity);
      const dir = new THREE.Vector3();
      const side = new THREE.Vector3();
      const toCamera = new THREE.Vector3();

      for (let i = 0; i < TRAIL_POINTS; i++) {
        const srcIndex = Math.min(points.length - 1, points.length - 1 - i);
        const point = points[Math.max(0, srcIndex)]!;
        const next = points[Math.max(0, srcIndex - 1)] ?? point;

        dir.copy(next).sub(point);
        if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
        toCamera.copy(camera.position).sub(point).normalize();
        side.crossVectors(dir, toCamera);
        if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
        side.normalize().multiplyScalar(width * (1 - i / TRAIL_POINTS));

        const base = i * 6;
        array[base] = point.x + side.x;
        array[base + 1] = point.y + side.y;
        array[base + 2] = point.z + side.z;
        array[base + 3] = point.x - side.x;
        array[base + 4] = point.y - side.y;
        array[base + 5] = point.z - side.z;
      }
      attr.needsUpdate = true;
      trailRef.current.visible = true;
    }
  });

  if (kind === 'aura') {
    return (
      <mesh ref={auraRef} visible={false} renderOrder={3}>
        <sphereGeometry args={[1, 32, 24]} />
        <shaderMaterial
          vertexShader={AURA_VERTEX}
          fragmentShader={AURA_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    );
  }

  if (kind === 'magic_circle') {
    return (
      <mesh ref={circleRef} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={1}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          vertexShader={CIRCLE_VERTEX}
          fragmentShader={CIRCLE_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    );
  }

  if (!trailGeometry) return null;

  return (
    <mesh ref={trailRef} geometry={trailGeometry} visible={false} frustumCulled={false} renderOrder={3}>
      <shaderMaterial
        vertexShader={TRAIL_VERTEX}
        fragmentShader={TRAIL_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
