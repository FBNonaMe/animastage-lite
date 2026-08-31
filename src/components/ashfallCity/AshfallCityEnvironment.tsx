/**
 * Ashfall City — procedural signature Environment Asset (AnimaStage original).
 * Stylized abandoned metropolis; not a real-world location.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ASHFALL_DISTRICTS, ASHFALL_LANDMARKS } from '../../ashfallCity/catalog';
import {
  createAshfallTexturePack,
  type AshfallTexturePack,
} from '../../ashfallCity/textures';
import type { AshfallCityState, AshfallQualityId } from '../../ashfallCity/types';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildingBudget(quality: AshfallQualityId): number {
  if (quality === 'lite') return 48;
  if (quality === 'high') return 140;
  return 90;
}

function debrisBudget(quality: AshfallQualityId): number {
  if (quality === 'lite') return 12;
  if (quality === 'high') return 48;
  return 28;
}

interface AshfallCityEnvironmentProps {
  state: AshfallCityState;
}

export default function AshfallCityEnvironment({ state }: AshfallCityEnvironmentProps) {
  const flickerRef = useRef<THREE.Mesh[]>([]);
  const smokeRef = useRef<THREE.Mesh[]>([]);
  const wind = state.windStrength;

  const layout = useMemo(() => buildCityLayout(state.quality), [state.quality]);
  const tex = useMemo(() => createAshfallTexturePack(state.quality), [state.quality]);

  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < flickerRef.current.length; i++) {
      const m = flickerRef.current[i];
      if (!m) continue;
      const mat = m.material as THREE.MeshStandardMaterial;
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (3 + i * 0.37) + i));
      mat.emissiveIntensity =
        pulse * (state.variantId === 'night' || state.variantId === 'cyber' ? 1.4 : 0.55);
    }
    for (let i = 0; i < smokeRef.current.length; i++) {
      const m = smokeRef.current[i];
      if (!m) continue;
      m.position.y = 14 + Math.sin(t * 0.35 + i) * 0.6;
      m.rotation.y = t * 0.08 * wind;
      const s = 1 + 0.15 * Math.sin(t * 0.5 + i);
      m.scale.setScalar(s);
    }
  });

  const showLandmarks = state.showLandmarks;
  const neon = state.variantId === 'night' || state.variantId === 'cyber';

  return (
    <group name="AshfallCity" userData={{ ashfallCity: true, environmentAsset: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[160, 160, 1, 1]} />
        <meshStandardMaterial
          map={tex.asphalt}
          roughnessMap={tex.asphaltRough}
          color="#c8c8c8"
          roughness={0.94}
          metalness={0.08}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial
          map={tex.concrete}
          color="#d0d0d0"
          roughness={0.9}
          metalness={0.12}
        />
      </mesh>

      {layout.roads.map((r, i) => (
        <mesh key={`road-${i}`} position={r.position} rotation={r.rotation} receiveShadow>
          <boxGeometry args={r.size} />
          <meshStandardMaterial map={tex.road} color="#b0b0b0" roughness={0.92} metalness={0.05} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, -0.35, 22]} receiveShadow>
        <planeGeometry args={[56, 10]} />
        <meshStandardMaterial
          map={tex.water}
          color="#a8c0d0"
          roughness={0.18}
          metalness={0.65}
          transparent
          opacity={0.9}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-14, 0.02, 22]} receiveShadow>
        <circleGeometry args={[9, 28]} />
        <meshStandardMaterial map={tex.park} color="#c8d0c0" roughness={0.98} metalness={0.02} />
      </mesh>

      <InstancedBuildings
        key={`bld-${layout.buildings.length}-${state.quality}`}
        items={layout.buildings}
        neon={neon}
        tex={tex}
      />

      {layout.debris.map((d, i) => (
        <mesh key={`debris-${i}`} position={d.position} rotation={d.rotation} castShadow>
          <boxGeometry args={d.size} />
          <meshStandardMaterial map={tex.metal} color="#c8b8a8" roughness={0.95} metalness={0.25} />
        </mesh>
      ))}

      {showLandmarks && (
        <>
          <group position={[0, 0, -6]}>
            <mesh position={[0, 10, 0]} castShadow>
              <cylinderGeometry args={[1.2, 2.4, 20, 8]} />
              <meshStandardMaterial map={tex.metal} color="#d0c0b8" roughness={0.85} metalness={0.35} />
            </mesh>
            <mesh position={[0.6, 18, 0]} rotation={[0, 0, 0.35]} castShadow>
              <boxGeometry args={[1.4, 8, 1.4]} />
              <meshStandardMaterial map={tex.metal} color="#e0c8b0" roughness={0.8} metalness={0.4} />
            </mesh>
          </group>

          <group position={[0, 0, 16]}>
            <mesh position={[-5, 5, 0]} castShadow>
              <boxGeometry args={[1.2, 10, 1.2]} />
              <meshStandardMaterial map={tex.concrete} color="#c8c8c8" roughness={0.88} />
            </mesh>
            <mesh position={[5, 5, 0]} castShadow>
              <boxGeometry args={[1.2, 10, 1.2]} />
              <meshStandardMaterial map={tex.concrete} color="#c8c8c8" roughness={0.88} />
            </mesh>
            <mesh position={[0, 10.2, 0]} castShadow>
              <boxGeometry args={[12, 1.4, 1.4]} />
              <meshStandardMaterial
                map={tex.metal}
                color="#e8d0c0"
                emissive={neon ? '#ff6a3a' : '#402820'}
                emissiveIntensity={neon ? 0.8 : 0.15}
                roughness={0.7}
                metalness={0.35}
              />
            </mesh>
          </group>

          <group position={[18, 0, 18]}>
            <mesh position={[0, 3, 0]} rotation={[0, Math.PI / 5, 0]} castShadow>
              <boxGeometry args={[18, 0.6, 3.2]} />
              <meshStandardMaterial map={tex.concrete} color="#c0c0c0" roughness={0.9} />
            </mesh>
            <mesh position={[-4, 1.5, 1]} rotation={[0, 0, 0.5]} castShadow>
              <boxGeometry args={[5, 0.5, 2]} />
              <meshStandardMaterial map={tex.metal} color="#d0b8a8" roughness={0.92} />
            </mesh>
          </group>

          <group position={[34, 0, 30]}>
            {[0, 3.5].map((x, i) => (
              <group key={i} position={[x, 0, 0]}>
                <mesh position={[0, 7, 0]} castShadow>
                  <cylinderGeometry args={[0.9, 1.3, 14, 10]} />
                  <meshStandardMaterial map={tex.metal} color="#b8b8b8" roughness={0.9} metalness={0.4} />
                </mesh>
                {state.ambientFx && (
                  <mesh
                    ref={(el) => {
                      if (el) smokeRef.current[i] = el;
                    }}
                    position={[0, 14.5, 0]}
                  >
                    <sphereGeometry args={[2.2, 10, 10]} />
                    <meshStandardMaterial color="#6a6a6a" transparent opacity={0.28} depthWrite={false} />
                  </mesh>
                )}
              </group>
            ))}
          </group>

          <group position={[-8, 0, -22]}>
            <mesh position={[0, 2.5, 0]} castShadow>
              <boxGeometry args={[10, 5, 6]} />
              <meshStandardMaterial map={tex.concrete} color="#b8bcc4" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.6, 3.2]}>
              <boxGeometry args={[4, 3.2, 0.4]} />
              <meshStandardMaterial color="#101218" roughness={1} />
            </mesh>
            <mesh
              ref={(el) => {
                if (el) flickerRef.current[0] = el;
              }}
              position={[0, 4.6, 3.4]}
            >
              <boxGeometry args={[1.2, 0.4, 0.3]} />
              <meshStandardMaterial color="#222" emissive="#ffaa33" emissiveIntensity={0.6} />
            </mesh>
          </group>

          <group position={[8, 0, 34]}>
            <mesh position={[-4, 5, 0]} rotation={[0, 0, -0.25]} castShadow>
              <boxGeometry args={[16, 0.7, 5]} />
              <meshStandardMaterial map={tex.asphalt} color="#c0c0c0" roughness={0.9} />
            </mesh>
            <mesh position={[8, 2.2, 1]} rotation={[0.1, 0.2, 0.8]} castShadow>
              <boxGeometry args={[7, 0.6, 4]} />
              <meshStandardMaterial map={tex.metal} color="#d0b8a0" roughness={0.92} />
            </mesh>
          </group>
        </>
      )}

      {layout.billboards.map((b, i) => (
        <mesh
          key={`ad-${i}`}
          position={b.position}
          rotation={b.rotation}
          ref={(el) => {
            if (el) flickerRef.current[i + 2] = el;
          }}
        >
          <boxGeometry args={b.size} />
          <meshStandardMaterial
            map={tex.billboard}
            color="#ffffff"
            emissiveMap={tex.billboard}
            emissive={neon ? b.emissive : '#2a2030'}
            emissiveIntensity={neon ? 1.1 : 0.35}
            roughness={0.45}
            metalness={0.2}
          />
        </mesh>
      ))}

      {layout.lamps.map((l, i) => (
        <mesh key={`lamp-${i}`} position={l.position} rotation={l.rotation} castShadow>
          <cylinderGeometry args={[0.12, 0.18, l.length, 6]} />
          <meshStandardMaterial map={tex.metal} color="#c0c0c0" roughness={0.85} metalness={0.55} />
        </mesh>
      ))}

      {state.ambientFx && (
        <AshParticles
          key={`ash-${state.quality}-${layout.ashPositions.length}`}
          positions={layout.ashPositions}
          wind={wind}
          active={state.ambientFx}
        />
      )}

      {ASHFALL_DISTRICTS.map((d) => (
        <group key={d.id} position={d.center} userData={{ ashfallDistrict: d.id }} />
      ))}
      {ASHFALL_LANDMARKS.map((lm) => (
        <group key={lm.id} position={lm.position} userData={{ ashfallLandmark: lm.id }} />
      ))}
    </group>
  );
}

/** Ash particles with a fixed GPU buffer for this mount — never resize attributes. */
function AshParticles({
  positions,
  wind,
  active,
}: {
  positions: Float32Array;
  wind: number;
  active: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const buffer = useMemo(() => {
    const copy = new Float32Array(positions.length);
    copy.set(positions);
    return copy;
  }, [positions]);

  useFrame(({ clock }) => {
    if (!active || !pointsRef.current) return;
    const t = clock.elapsedTime;
    const attr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i]! += Math.sin(t * 0.4 + i) * 0.004 * wind;
      arr[i + 1]! -= 0.012 + 0.008 * wind;
      arr[i + 2]! += Math.cos(t * 0.35 + i) * 0.004 * wind;
      if (arr[i + 1]! < 0) {
        arr[i + 1] = 18 + (i % 7);
        arr[i] = ((i * 17) % 80) - 40;
        arr[i + 2] = ((i * 13) % 80) - 40;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffer, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color="#c8c2b8"
        transparent
        opacity={0.55}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function InstancedBuildings({
  items,
  neon,
  tex,
}: {
  items: Array<{
    position: [number, number, number];
    scale: [number, number, number];
    color: string;
  }>;
  neon: boolean;
  tex: AshfallTexturePack;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = Math.max(1, items.length);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      dummy.position.set(...item.position);
      dummy.scale.set(...item.scale);
      dummy.rotation.set(0, (i % 5) * 0.05, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, dummy]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        map={tex.facade}
        emissiveMap={tex.facadeEmissive}
        emissive={neon ? '#88aaff' : '#221808'}
        emissiveIntensity={neon ? 0.55 : 0.12}
        color="#c8ccd0"
        roughness={0.88}
        metalness={neon ? 0.28 : 0.12}
      />
    </instancedMesh>
  );
}

type CityLayout = {
  buildings: Array<{
    position: [number, number, number];
    scale: [number, number, number];
    color: string;
  }>;
  roads: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
    size: [number, number, number];
  }>;
  debris: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
    size: [number, number, number];
  }>;
  billboards: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
    size: [number, number, number];
    emissive: string;
  }>;
  lamps: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
    length: number;
  }>;
  ashPositions: Float32Array;
};

function buildCityLayout(quality: AshfallQualityId): CityLayout {
  const rand = mulberry32(0xa5f4111);
  const colors = ['#3e424a', '#4a4650', '#353840', '#524840', '#2e343c', '#454038'];
  const buildings: CityLayout['buildings'] = [];
  const n = buildingBudget(quality);

  for (const d of ASHFALL_DISTRICTS) {
    if (d.id === 'river' || d.id === 'tunnel' || d.id === 'rooftops') continue;
    const localN = Math.max(3, Math.floor(n / 9));
    for (let i = 0; i < localN; i++) {
      const ox = (rand() - 0.5) * d.extent[0] * 1.6;
      const oz = (rand() - 0.5) * d.extent[1] * 1.6;
      if (d.id === 'central_plaza' && Math.hypot(ox, oz) < 7) continue;
      const h =
        d.id === 'business'
          ? 8 + rand() * 22
          : d.id === 'industrial'
            ? 5 + rand() * 10
            : d.id === 'residential'
              ? 6 + rand() * 12
              : 4 + rand() * 9;
      const w = 2.2 + rand() * 3.5;
      const depth = 2.2 + rand() * 3.2;
      buildings.push({
        position: [d.center[0] + ox, h / 2, d.center[2] + oz],
        scale: [w, h, depth],
        color: colors[Math.floor(rand() * colors.length)]!,
      });
      if (buildings.length >= n) break;
    }
    if (buildings.length >= n) break;
  }

  const roads: CityLayout['roads'] = [
    { position: [0, 0.03, 0], rotation: [0, 0, 0], size: [6, 0.08, 90] },
    { position: [0, 0.03, 0], rotation: [0, Math.PI / 2, 0], size: [6, 0.08, 90] },
    { position: [18, 0.03, 18], rotation: [0, Math.PI / 5, 0], size: [5, 0.08, 40] },
    { position: [-20, 0.03, -8], rotation: [0, -0.4, 0], size: [4.5, 0.08, 36] },
  ];

  const debris: CityLayout['debris'] = [];
  const dn = debrisBudget(quality);
  for (let i = 0; i < dn; i++) {
    debris.push({
      position: [(rand() - 0.5) * 70, 0.25 + rand() * 0.4, (rand() - 0.5) * 70],
      rotation: [rand() * 0.6, rand() * Math.PI, rand() * 0.6],
      size: [0.6 + rand() * 1.8, 0.3 + rand() * 0.7, 0.5 + rand() * 1.4],
    });
  }

  const billboards: CityLayout['billboards'] = [
    {
      position: [12, 8, -4],
      rotation: [0, -0.5, 0],
      size: [6, 3.2, 0.25],
      emissive: '#ff3d7a',
    },
    {
      position: [-16, 7, 6],
      rotation: [0, 0.8, 0],
      size: [5, 2.6, 0.25],
      emissive: '#3dd0ff',
    },
    {
      position: [22, 10, 8],
      rotation: [0, 2.2, 0],
      size: [7, 3.5, 0.25],
      emissive: '#b46bff',
    },
  ];

  const lamps: CityLayout['lamps'] = [];
  for (let i = 0; i < (quality === 'lite' ? 6 : 14); i++) {
    lamps.push({
      position: [(rand() - 0.5) * 50, 0.4, (rand() - 0.5) * 50],
      rotation: [1.1 + rand() * 0.5, rand() * Math.PI, 0.2],
      length: 3 + rand() * 2,
    });
  }

  const ashCount = quality === 'lite' ? 120 : quality === 'high' ? 420 : 260;
  const ashPositions = new Float32Array(ashCount * 3);
  for (let i = 0; i < ashCount; i++) {
    ashPositions[i * 3] = (rand() - 0.5) * 80;
    ashPositions[i * 3 + 1] = rand() * 20;
    ashPositions[i * 3 + 2] = (rand() - 0.5) * 80;
  }

  return { buildings, roads, debris, billboards, lamps, ashPositions };
}
