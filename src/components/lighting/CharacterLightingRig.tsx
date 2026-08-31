import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneComposerLights } from '../../sceneComposer';
import { findCharacterRig, refreshRigBounds } from '../../sceneStudio/runtime/boneSampler';

interface CharacterLightingRigProps {
  lights: SceneComposerLights;
  followCharacter: boolean;
  characterPosition?: [number, number, number] | null;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _center = new THREE.Vector3();

/**
 * Optional three-point portrait rig. It only reads the live character bounds;
 * it never mutates the skeleton, animation or physics helper.
 */
export default function CharacterLightingRig({
  lights,
  followCharacter,
  characterPosition = null,
}: CharacterLightingRigProps) {
  const { camera, scene } = useThree();
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const sampleAgeRef = useRef(Infinity);
  const sampledCenterRef = useRef(new THREE.Vector3());
  const sampledRadiusRef = useRef(5);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    if (keyRef.current) keyRef.current.target = target;
    if (fillRef.current) fillRef.current.target = target;
    if (rimRef.current) rimRef.current.target = target;
  }, []);

  useFrame((_, delta) => {
    const target = targetRef.current;
    if (!target) return;

    sampleAgeRef.current += delta;
    if (sampleAgeRef.current > 0.5) {
      const hint = characterPosition ? _center.set(...characterPosition) : null;
      const rig = findCharacterRig(scene, hint);
      if (rig) {
        refreshRigBounds(rig);
        sampledCenterRef.current.copy(rig.center);
        sampledRadiusRef.current = Math.max(0.5, rig.radius);
      } else if (characterPosition) {
        sampledCenterRef.current.set(...characterPosition).addScaledVector(_up, 5);
        sampledRadiusRef.current = 5;
      }
      sampleAgeRef.current = 0;
    }

    target.position.copy(sampledCenterRef.current);
    target.updateMatrixWorld();
    if (!followCharacter) return;

    camera.getWorldDirection(_forward).normalize();
    _right.crossVectors(_forward, camera.up).normalize();
    const radius = sampledRadiusRef.current;
    const center = sampledCenterRef.current;

    keyRef.current?.position
      .copy(center)
      .addScaledVector(_right, radius * 2.2)
      .addScaledVector(_up, radius * 1.5)
      .addScaledVector(_forward, -radius * 1.8);
    fillRef.current?.position
      .copy(center)
      .addScaledVector(_right, -radius * 2)
      .addScaledVector(_up, radius * 0.8)
      .addScaledVector(_forward, -radius);
    rimRef.current?.position
      .copy(center)
      .addScaledVector(_right, -radius * 0.4)
      .addScaledVector(_up, radius * 1.7)
      .addScaledVector(_forward, radius * 2.2);
  });

  return (
    <>
      <object3D ref={targetRef} name="CharacterLightTarget" />
      {lights.keyEnabled ? (
        <directionalLight
          ref={keyRef}
          name="CharacterKeyLight"
          position={[8, 12, 10]}
          color={lights.keyColor}
          intensity={lights.keyIntensity}
        />
      ) : null}
      {lights.fillEnabled ? (
        <directionalLight
          ref={fillRef}
          name="CharacterFillLight"
          position={[-8, 8, 6]}
          color={lights.fillColor}
          intensity={lights.fillIntensity}
        />
      ) : null}
      {lights.rimEnabled ? (
        <directionalLight
          ref={rimRef}
          name="CharacterRimLight"
          position={[0, 12, -10]}
          color={lights.rimColor}
          intensity={lights.rimIntensity}
        />
      ) : null}
    </>
  );
}
