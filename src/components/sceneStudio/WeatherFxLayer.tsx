import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createLayeredWeatherFx,
  weatherColorForKind,
  type WeatherFxAssets,
  type WeatherFxKind,
} from '../../sceneStudio/runtime/weatherFx';
import { reportVqRuntime } from '../../visualQuality/store';

interface WeatherFxLayerProps {
  kind: WeatherFxKind;
  count: number;
  intensity: number;
  speed: number;
  directionDeg: number;
  turbulence: number;
  worldScale: number;
  /** Keeps the volume around the viewer so large stages stay covered. */
  followCamera?: boolean;
  /** Visual Quality 2.0 depth layers (1–3). */
  depthLayers?: 1 | 2 | 3;
}

/**
 * One GPU-animated weather volume (optionally multi-layer for VQ Snow/Rain 2.0).
 */
export default function WeatherFxLayer({
  kind,
  count,
  intensity,
  speed,
  directionDeg,
  turbulence,
  worldScale,
  followCamera = true,
  depthLayers = 1,
}: WeatherFxLayerProps) {
  const { camera } = useThree();
  const assetsRef = useRef<WeatherFxAssets[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const assetsList = useMemo(
    () =>
      createLayeredWeatherFx(
        {
          kind,
          count,
          intensity,
          speed,
          directionDeg,
          turbulence,
          worldScale,
          color: weatherColorForKind(kind),
          gust: turbulence,
        },
        depthLayers
      ),
    [kind, count, intensity, speed, directionDeg, turbulence, worldScale, depthLayers]
  );

  useEffect(() => {
    assetsRef.current = assetsList;
    const group = groupRef.current;
    if (group) {
      for (const a of assetsList) group.add(a.object);
    }
    const total = assetsList.reduce((n, a) => {
      const g = a.object as THREE.Points | THREE.LineSegments;
      return n + ((g.geometry as THREE.BufferGeometry)?.attributes?.aSeed?.count ?? 0);
    }, 0);
    reportVqRuntime({ particleCount: total });
    return () => {
      if (group) {
        for (const a of assetsList) group.remove(a.object);
      }
      for (const a of assetsList) a.dispose();
      assetsRef.current = [];
    };
  }, [assetsList]);

  useFrame((_, delta) => {
    const list = assetsRef.current;
    if (!list.length) return;
    timeRef.current += delta;
    for (const current of list) {
      current.material.uniforms.uTime!.value = timeRef.current;
      if (!followCamera) continue;
      const origin = current.material.uniforms.uOrigin!.value as THREE.Vector3;
      const height = current.material.uniforms.uHeight!.value as number;
      origin.set(camera.position.x, camera.position.y - height * 0.35, camera.position.z);
    }
  });

  return <group ref={groupRef} name={`SceneFxWeatherHost_${kind}`} />;
}
