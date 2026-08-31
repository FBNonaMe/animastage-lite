import { ContactShadows, Environment, MeshReflectorMaterial } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import type { VisualFxSettings } from '../types';
import type { SceneComposerState } from '../sceneComposer/types';
import { sunPositionFromAngles, normalizeSceneComposerLights } from '../sceneComposer/defaults';
import {
  getLightPreset,
  getScenePreset,
  isCinematicVisualsActive,
} from '../visualFx/visualFxPresets';
import { getRenderTierConfig } from '../render/renderTierConfig';
import type { RenderTier } from '../types';
import { isWebGpuRenderer } from '../utils/webgpuSupport';
import CharacterLightingRig from './lighting/CharacterLightingRig';

interface SceneEnvironmentProps {
  visualFx: VisualFxSettings;
  ultraPhoto: boolean;
  rtxActive: boolean;
  shadowMapSize: number;
  renderTier?: import('../types').RenderTier;
  /** Hide studio floor when an imported stage/environment is in the scene. */
  hideBuiltinFloor?: boolean;
  /** Scene Composer sun / fog overrides (live preview). */
  sceneComposer?: SceneComposerState;
  /** Soft directional shadows (PCF soft) from Cinematic Render System. */
  softShadows?: boolean;
  /** ContactShadows under characters / floor. */
  contactShadows?: boolean;
  /** Override contact shadow map resolution (VQ budget). */
  contactShadowResolution?: number;
  /** Render Pipeline 2.0 contact shadow tuning. */
  contactShadowTuning?: {
    opacity: number;
    scale: number;
    blur: number;
    far: number;
  };
  /** When true, AtmosphereFogBridge owns scene.fog — skip local Fog. */
  atmosphereFogOwned?: boolean;
  /** When dynamic sky dome is active, use soft horizon fill instead of solid preset bg. */
  skyDomeActive?: boolean;
  skyBackground?: string;
  autoCharacterLights?: boolean;
  characterPosition?: [number, number, number] | null;
  /** When CSM is active, disable key directional shadow maps. */
  csmActive?: boolean;
}

function ComposerFog({
  enabled,
  density,
  color,
}: {
  enabled: boolean;
  density: number;
  color: string;
}) {
  const { scene: threeScene } = useThree();

  useEffect(() => {
    if (!enabled) {
      threeScene.fog = null;
      return;
    }
    const near = 8 + (1 - density) * 24;
    const far = 28 + density * 72;
    threeScene.fog = new THREE.Fog(color, near, far);
    return () => {
      threeScene.fog = null;
    };
  }, [enabled, density, color, threeScene]);

  return null;
}

function SceneFog({ visualFx }: { visualFx: VisualFxSettings }) {
  const scene = getScenePreset(visualFx.scenePreset);
  const { scene: threeScene } = useThree();

  useEffect(() => {
    if (!scene.fog) {
      threeScene.fog = null;
      return;
    }
    threeScene.fog = new THREE.Fog(
      scene.fog.color,
      scene.fog.near,
      scene.fog.far
    );
    return () => {
      threeScene.fog = null;
    };
  }, [scene, threeScene]);

  return null;
}

function SceneLighting({
  visualFx,
  ultraPhoto,
  shadowMapSize,
  sceneComposer,
  softShadows = true,
  autoCharacterLights = false,
  characterPosition = null,
  csmActive = false,
}: {
  visualFx: VisualFxSettings;
  ultraPhoto: boolean;
  shadowMapSize: number;
  sceneComposer?: SceneComposerState;
  softShadows?: boolean;
  autoCharacterLights?: boolean;
  characterPosition?: [number, number, number] | null;
  csmActive?: boolean;
}) {
  const light = getLightPreset(visualFx.lightPreset);
  const boost = ultraPhoto ? 1.12 : 1;
  const lights = sceneComposer?.lights;
  const sunPos =
    lights?.sunEnabled !== false
      ? sunPositionFromAngles(lights?.sunAzimuth ?? 135, lights?.sunElevation ?? 42)
      : light.key.position;
  const cascadePad = softShadows ? 36 : 30;
  const bias = softShadows ? -0.00035 : -0.0005;
  const normalBias = softShadows ? 0.028 : 0.02;
  const sunCastShadow =
    !csmActive && (lights?.sunShadows ?? light.key.castShadow);

  return (
    <>
      {lights?.ambientEnabled !== false ? (
        <ambientLight
          intensity={(lights?.ambientIntensity ?? light.ambient.intensity) * boost}
          color={lights?.ambientColor ?? light.ambient.color}
        />
      ) : null}

      {lights?.sunEnabled !== false ? (
        <directionalLight
          castShadow={sunCastShadow}
          position={sunPos}
          intensity={light.key.intensity * (lights?.sunIntensity ?? 1) * boost}
          color={lights?.sunColor ?? light.key.color}
          shadow-mapSize={[shadowMapSize, shadowMapSize]}
          shadow-camera-near={0.5}
          shadow-camera-far={140}
          shadow-camera-left={-cascadePad}
          shadow-camera-right={cascadePad}
          shadow-camera-top={cascadePad}
          shadow-camera-bottom={-cascadePad}
          shadow-bias={bias}
          shadow-normalBias={normalBias}
        />
      ) : null}

      <directionalLight
        position={light.fill.position}
        intensity={light.fill.intensity * boost}
        color={light.fill.color}
      />

      {light.rim && (
        <directionalLight
          position={light.rim.position}
          intensity={light.rim.intensity * boost}
          color={light.rim.color}
        />
      )}

      {light.spot && (
        <spotLight
          castShadow={ultraPhoto}
          position={light.spot.position}
          intensity={light.spot.intensity * boost}
          angle={light.spot.angle}
          penumbra={light.spot.penumbra}
          color={light.spot.color}
          distance={80}
          shadow-mapSize={[2048, 2048]}
        />
      )}

      {lights?.hemisphereEnabled !== false ? (
        <hemisphereLight
          intensity={(lights?.hemisphereIntensity ?? light.hemisphere.intensity) * boost}
          color={light.hemisphere.sky}
          groundColor={light.hemisphere.ground}
        />
      ) : null}

      {lights?.characterRigEnabled ? (
        <CharacterLightingRig
          lights={normalizeSceneComposerLights(lights)}
          followCharacter={autoCharacterLights}
          characterPosition={characterPosition}
        />
      ) : null}
    </>
  );
}

function SimpleFloor({ webgpu = false }: { webgpu?: boolean }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      userData={{ pathTracerSkip: true }}
    >
      <planeGeometry args={[60, 60]} />
      {webgpu ? (
        <meshStandardMaterial color="#c8ccd8" roughness={0.92} metalness={0.05} />
      ) : (
        <shadowMaterial opacity={0.35} color="#000000" />
      )}
    </mesh>
  );
}

/** WebGPU-safe floor — ContactShadows / MeshReflectorMaterial use legacy depth & shader passes. */
function WebGpuFloor({
  visualFx,
  mirror,
}: {
  visualFx: VisualFxSettings;
  mirror: boolean;
}) {
  const scene = getScenePreset(visualFx.scenePreset);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
      userData={{ pathTracerSkip: true }}
    >
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial
        color={scene.floorColor}
        metalness={mirror ? scene.floorMetalness : scene.floorMetalness * 0.5}
        roughness={scene.floorRoughness}
      />
    </mesh>
  );
}

function CinematicFloor({
  visualFx,
  mirror,
  renderTier = 'lite',
  webgpu = false,
  contactShadows = true,
  contactShadowResolution,
  contactShadowTuning,
}: {
  visualFx: VisualFxSettings;
  mirror: boolean;
  renderTier?: RenderTier;
  webgpu?: boolean;
  contactShadows?: boolean;
  contactShadowResolution?: number;
  contactShadowTuning?: {
    opacity: number;
    scale: number;
    blur: number;
    far: number;
  };
}) {
  if (webgpu) {
    return <WebGpuFloor visualFx={visualFx} mirror={mirror} />;
  }

  const scene = getScenePreset(visualFx.scenePreset);
  const tierGpu = getRenderTierConfig(renderTier).gpu;
  const contactRes = contactShadowResolution ?? tierGpu.contactShadowResolution;
  const csOpacity = contactShadowTuning?.opacity ?? 0.55;
  const csScale = contactShadowTuning?.scale ?? 28;
  const csBlur = contactShadowTuning?.blur ?? 2.4;
  const csFar = contactShadowTuning?.far ?? 14;

  if (mirror) {
    return (
      <>
        {contactShadows ? (
          <ContactShadows
            position={[0, 0.002, 0]}
            opacity={csOpacity}
            scale={csScale}
            blur={csBlur}
            far={csFar}
            resolution={contactRes}
            frames={1}
            color="#050508"
          />
        ) : null}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
          <planeGeometry args={[60, 60]} />
          <MeshReflectorMaterial
            blur={[256, 64]}
            resolution={tierGpu.mirrorFloorResolution}
            mixBlur={1}
            mixStrength={visualFx.floorReflection}
            roughness={scene.floorRoughness}
            depthScale={1.1}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.6}
            color={scene.floorColor}
            metalness={scene.floorMetalness}
            mirror={0.75 + visualFx.floorReflection * 0.12}
            reflectorOffset={0.02}
          />
        </mesh>
      </>
    );
  }

  return (
    <>
      {contactShadows ? (
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={csOpacity}
          scale={Math.min(csScale, 24)}
          blur={csBlur}
          far={csFar}
          resolution={contactRes}
          frames={1}
          color="#080810"
        />
      ) : null}
      <mesh
        name="CinematicFloor"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          name="floor"
          color={scene.floorColor}
          metalness={scene.floorMetalness * 0.5}
          roughness={Math.min(0.55, scene.floorRoughness * 0.7)}
          envMapIntensity={1.1}
        />
      </mesh>
    </>
  );
}

/**
 * Scene IBL, lighting rig, floor and fog driven by Visual FX presets.
 */
export default function SceneEnvironment({
  visualFx,
  ultraPhoto,
  rtxActive,
  shadowMapSize,
  renderTier = 'lite',
  hideBuiltinFloor = false,
  sceneComposer,
  softShadows = true,
  contactShadows = true,
  contactShadowResolution,
  contactShadowTuning,
  atmosphereFogOwned = false,
  skyDomeActive = false,
  skyBackground,
  autoCharacterLights = false,
  characterPosition = null,
  csmActive = false,
}: SceneEnvironmentProps) {
  const { gl } = useThree();
  const webgpu = isWebGpuRenderer(gl);
  const cinematic = isCinematicVisualsActive(visualFx, rtxActive);
  const scene = getScenePreset(visualFx.scenePreset);
  const tierGpu = getRenderTierConfig(renderTier).gpu;
  const contactRes =
    contactShadowResolution ?? tierGpu.contactShadowResolution;
  const [iblReady, setIblReady] = useState(false);

  useEffect(() => {
    setIblReady(false);
  }, [visualFx.scenePreset, ultraPhoto]);

  useFrame((state) => {
    if (iblReady) return;
    if (state.clock.elapsedTime > 0.35 && state.gl.getContext()?.getContextAttributes()) {
      setIblReady(true);
    }
  });

  if (!cinematic) {
    return (
      <>
        <color attach="background" args={['#e8ecf4']} />
        <SceneLighting
          visualFx={visualFx}
          ultraPhoto={ultraPhoto}
          shadowMapSize={shadowMapSize}
          sceneComposer={sceneComposer}
          softShadows={softShadows}
          autoCharacterLights={autoCharacterLights}
          characterPosition={characterPosition}
          csmActive={csmActive}
        />
        {!hideBuiltinFloor ? <SimpleFloor webgpu={webgpu} /> : null}
      </>
    );
  }

  const bgColor = skyDomeActive
    ? skyBackground ?? '#10182c'
    : sceneComposer?.bgMode === 'solid_white'
      ? '#f4f4f6'
      : sceneComposer?.bgMode === 'solid_black'
        ? '#080810'
        : sceneComposer?.bgMode === 'transparent'
          ? '#000000'
          : scene.background;

  return (
    <>
      <color attach="background" args={[bgColor]} />
      {!atmosphereFogOwned ? (
        sceneComposer?.fogEnabled ? (
          <ComposerFog
            enabled
            density={sceneComposer.fogDensity}
            color={sceneComposer.fogColor}
          />
        ) : (
          <SceneFog visualFx={visualFx} />
        )
      ) : null}

      {!webgpu && iblReady && (
        <Environment
          preset={scene.environment}
          environmentIntensity={visualFx.environmentIntensity}
          background={false}
          resolution={ultraPhoto ? tierGpu.environmentResolution : Math.min(tierGpu.environmentResolution, 128)}
        />
      )}

      <SceneLighting
        visualFx={visualFx}
        ultraPhoto={ultraPhoto}
        shadowMapSize={shadowMapSize}
        sceneComposer={sceneComposer}
        softShadows={softShadows}
        autoCharacterLights={autoCharacterLights}
        characterPosition={characterPosition}
        csmActive={csmActive}
      />

      {!hideBuiltinFloor ? (
        <CinematicFloor
          visualFx={visualFx}
          mirror={ultraPhoto}
          renderTier={renderTier}
          webgpu={webgpu}
          contactShadows={contactShadows}
          contactShadowResolution={contactRes}
          contactShadowTuning={contactShadowTuning}
        />
      ) : contactShadows && !webgpu ? (
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={contactShadowTuning?.opacity ?? 0.55}
          scale={contactShadowTuning?.scale ?? 28}
          blur={contactShadowTuning?.blur ?? 2.4}
          far={contactShadowTuning?.far ?? 14}
          resolution={contactRes}
          frames={1}
          color="#050508"
        />
      ) : null}
    </>
  );
}
