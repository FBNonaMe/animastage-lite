import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  analyzeEnvironmentFromScene,
  raycastPlacement,
  resolveFloorY,
  type PlacementHit,
  type ShotComposerMode,
} from '../../shotComposer';
import type { MMDModel } from '../../types';

interface ShotComposerViewportLayerProps {
  mode: ShotComposerMode;
  stageModel: MMDModel | null;
  floorYOverride: number | null;
  characterHeight: number;
  ghostHit: PlacementHit | null;
  onGhostHit: (hit: PlacementHit | null) => void;
  onConfirmPlace: (hit: PlacementHit) => void;
  onCancel: () => void;
  onEnvAnalyzed?: (stageId: string) => void;
}

/**
 * Desktop: left click place, right click cancel.
 * Touch: tap place (pointer up without much move).
 */
export default function ShotComposerViewportLayer({
  mode,
  stageModel,
  floorYOverride,
  characterHeight,
  ghostHit,
  onGhostHit,
  onConfirmPlace,
  onCancel,
  onEnvAnalyzed,
}: ShotComposerViewportLayerProps) {
  const { camera, scene, gl } = useThree();
  const active = mode === 'place_character' || mode === 'place_camera' || mode === 'create_shot';
  const analyzedRef = useRef<string | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // Handlers arrive as fresh identities each render; keep them out of effect deps
  // so pointer listeners are not torn down and re-attached on every render.
  const handlersRef = useRef({ onGhostHit, onConfirmPlace, onCancel, onEnvAnalyzed });
  handlersRef.current = { onGhostHit, onConfirmPlace, onCancel, onEnvAnalyzed };

  useEffect(() => {
    if (!active || !stageModel) return;
    if (analyzedRef.current === stageModel.id) return;
    analyzeEnvironmentFromScene(scene, stageModel, true);
    const stageId = stageModel.id;
    analyzedRef.current = stageId;
    // This component lives in the r3f root while the callback updates app state in
    // the DOM root; defer so the two roots never commit inside each other.
    queueMicrotask(() => handlersRef.current.onEnvAnalyzed?.(stageId));
  }, [active, stageModel, scene]);

  const floorY = useMemo(() => {
    if (!stageModel) return floorYOverride ?? 0;
    const analysis = analyzeEnvironmentFromScene(scene, stageModel, false);
    return resolveFloorY(analysis, floorYOverride);
  }, [stageModel, scene, floorYOverride]);

  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;

    const sample = (clientX: number, clientY: number) =>
      raycastPlacement(camera, scene, clientX, clientY, el, floorY);

    let moveFrame = 0;
    const onMove = (e: PointerEvent) => {
      const { clientX, clientY } = e;
      if (moveFrame) return;
      moveFrame = requestAnimationFrame(() => {
        moveFrame = 0;
        handlersRef.current.onGhostHit(sample(clientX, clientY));
      });
    };

    const onDown = (e: PointerEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        handlersRef.current.onCancel();
        return;
      }
      if (e.button !== 0) return;
      pointerDownRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    };

    const onUp = (e: PointerEvent) => {
      if (e.button === 2) return;
      const down = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!down) return;
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (dist > 14) return; // drag = orbit, not place
      const hit = sample(e.clientX, e.clientY);
      if (hit?.walkable) handlersRef.current.onConfirmPlace(hit);
    };

    const onContext = (e: Event) => e.preventDefault();

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('contextmenu', onContext);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('contextmenu', onContext);
      if (moveFrame) cancelAnimationFrame(moveFrame);
      pointerDownRef.current = null;
    };
  }, [active, camera, scene, gl, floorY]);

  if (!active || !ghostHit) return null;

  const [x, y, z] = ghostHit.position;
  const h = Math.max(4, characterHeight);

  return (
    <group position={[x, y, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.35, 0.55, 48]} />
        <meshBasicMaterial color="#39c5bb" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh position={[0, h * 0.5, 0]}>
        <cylinderGeometry args={[0.28, 0.35, h, 16]} />
        <meshBasicMaterial color="#39c5bb" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <GhostNormal normal={ghostHit.normal} />
    </group>
  );
}

function GhostNormal({ normal }: { normal: [number, number, number] }) {
  const dir = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return (
    <mesh position={[0, 0.6, 0]} quaternion={quat}>
      <cylinderGeometry args={[0.03, 0.03, 1.1, 6]} />
      <meshBasicMaterial color="#7dd3fc" transparent opacity={0.75} depthWrite={false} />
    </mesh>
  );
}
