import { useCallback, useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

interface CameraDirectGizmoProps {
  enabled: boolean;
}

interface SafeTransformControlsProps {
  object: THREE.Object3D | null | undefined;
  mode: 'translate';
  size?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/** Mount TransformControls only after `object` is part of the scene graph. */
function SafeTransformControls({
  object,
  mode,
  size = 0.85,
  onDragStart,
  onDragEnd,
}: SafeTransformControlsProps) {
  const { camera, controls } = useThree();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!object) {
      setReady(false);
      return;
    }

    let raf = 0;
    let cancelled = false;

    const waitForParent = () => {
      if (cancelled) return;
      if (object.parent !== null) {
        setReady(true);
      } else {
        raf = requestAnimationFrame(waitForParent);
      }
    };

    setReady(false);
    waitForParent();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      setReady(false);
    };
  }, [object]);

  const handleDragStart = useCallback(() => {
    if (controls) {
      (controls as THREE.EventDispatcher & { enabled: boolean }).enabled = false;
    }
    onDragStart?.();
  }, [controls, onDragStart]);

  const handleDragEnd = useCallback(() => {
    if (controls) {
      (controls as THREE.EventDispatcher & { enabled: boolean }).enabled = true;
    }
    onDragEnd?.();
  }, [controls, onDragEnd]);

  if (!object || !ready) return null;

  return (
    <TransformControls
      object={object}
      mode={mode}
      size={size}
      camera={camera}
      onMouseDown={handleDragStart}
      onMouseUp={handleDragEnd}
    />
  );
}

/**
 * Drag the cyan camera handle (like the character root gizmo) to place the camera.
 * Pink sphere = look-at target. Orbit still works with LMB when not dragging.
 */
export default function CameraDirectGizmo({ enabled }: CameraDirectGizmoProps) {
  const { camera, controls } = useThree();
  const [camMesh, setCamMesh] = useState<THREE.Mesh | null>(null);
  const [targetMesh, setTargetMesh] = useState<THREE.Mesh | null>(null);
  const draggingCam = useRef(false);
  const draggingTarget = useRef(false);

  useEffect(() => {
    if (!enabled) {
      draggingCam.current = false;
      draggingTarget.current = false;
    }
  }, [enabled]);

  useFrame(() => {
    if (!enabled) return;
    const cam = camera as THREE.PerspectiveCamera;
    const orbit = controls as OrbitControlsImpl | null;

    if (camMesh && !draggingCam.current) {
      camMesh.position.copy(cam.position);
    }
    if (targetMesh && orbit?.target && !draggingTarget.current) {
      targetMesh.position.copy(orbit.target);
    }

    if (draggingCam.current && camMesh) {
      cam.position.copy(camMesh.position);
      if (orbit?.target) cam.lookAt(orbit.target);
      cam.updateProjectionMatrix();
      orbit?.update();
    }

    if (draggingTarget.current && targetMesh && orbit?.target) {
      orbit.target.copy(targetMesh.position);
      cam.lookAt(orbit.target);
      cam.updateProjectionMatrix();
      orbit.update();
    }
  });

  if (!enabled) return null;

  return (
    <group>
      <mesh ref={setCamMesh}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.9} />
      </mesh>
      <SafeTransformControls
        object={camMesh}
        mode="translate"
        size={0.85}
        onDragStart={() => {
          draggingCam.current = true;
        }}
        onDragEnd={() => {
          draggingCam.current = false;
        }}
      />

      <mesh ref={setTargetMesh}>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshBasicMaterial color="#e879ff" wireframe transparent opacity={0.85} />
      </mesh>
      <SafeTransformControls
        object={targetMesh}
        mode="translate"
        size={0.7}
        onDragStart={() => {
          draggingTarget.current = true;
        }}
        onDragEnd={() => {
          draggingTarget.current = false;
        }}
      />
    </group>
  );
}
