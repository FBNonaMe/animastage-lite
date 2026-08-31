import { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import type { CameraKeyframe } from '../../types';
import { sampleCameraPath } from '../../referenceCamera';
import { evaluateCameraAtFrame } from '../CameraLogic';

interface CameraPathVisualizationProps {
  keyframes: CameraKeyframe[];
  currentFrame: number;
  showPath: boolean;
  showFrustum: boolean;
  showGhosts: boolean;
}

/**
 * Draws camera spline, key markers, ghosts, and travel direction in the 3D viewport.
 */
export default function CameraPathVisualization({
  keyframes,
  currentFrame,
  showPath,
  showFrustum,
  showGhosts,
}: CameraPathVisualizationProps) {
  const sorted = useMemo(
    () => [...keyframes].sort((a, b) => a.frame - b.frame),
    [keyframes]
  );

  const pathLine = useMemo(() => {
    const pts = sampleCameraPath(sorted, 10);
    if (pts.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    );
    const points = curve.getPoints(Math.max(24, pts.length * 4));
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x39c5bb,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
    });
    return new THREE.Line(geom, mat);
  }, [sorted]);

  const current = useMemo(() => {
    if (sorted.length === 0) return null;
    const fallback = {
      position: [...sorted[0].position] as [number, number, number],
      rotation: [...sorted[0].rotation] as [number, number, number],
      fov: sorted[0].fov,
      target: (sorted[0].target
        ? [...sorted[0].target]
        : [0, 10, 0]) as [number, number, number],
    };
    return evaluateCameraAtFrame(sorted, currentFrame, fallback);
  }, [sorted, currentFrame]);

  const frustumRef = useRef<THREE.Mesh>(null);
  useLayoutEffect(() => {
    if (!frustumRef.current || !current) return;
    frustumRef.current.lookAt(current.target[0], current.target[1], current.target[2]);
  }, [current]);

  if (sorted.length === 0) return null;

  return (
    <group>
      {showPath && pathLine ? <primitive object={pathLine} /> : null}

      {showPath &&
        sorted.map((kf, i) => {
          const next = sorted[i + 1];
          let arrow: THREE.ArrowHelper | null = null;
          if (next) {
            const dir = new THREE.Vector3(
              next.position[0] - kf.position[0],
              next.position[1] - kf.position[1],
              next.position[2] - kf.position[2]
            );
            if (dir.lengthSq() > 1e-6) {
              dir.normalize();
              arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 1.2, 0xff6ba8, 0.35, 0.25);
            }
          }
          return (
            <group key={kf.id} position={kf.position}>
              <mesh>
                <octahedronGeometry args={[0.35, 0]} />
                <meshBasicMaterial color="#22d3ee" />
              </mesh>
              {arrow ? <primitive object={arrow} /> : null}
            </group>
          );
        })}

      {showGhosts &&
        sorted.map((kf) => (
          <mesh key={`ghost-${kf.id}`} position={kf.position}>
            <boxGeometry args={[0.5, 0.35, 0.7]} />
            <meshBasicMaterial color="#64748b" wireframe transparent opacity={0.45} />
          </mesh>
        ))}

      {current ? (
        <group position={current.position}>
          <mesh>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshBasicMaterial color="#f472b6" />
          </mesh>
          {showFrustum ? (
            <mesh ref={frustumRef} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.55, 1.1, 4, 1, true]} />
              <meshBasicMaterial color="#39c5bb" wireframe transparent opacity={0.5} />
            </mesh>
          ) : null}
        </group>
      ) : null}
    </group>
  );
}
