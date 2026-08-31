import React, { useEffect, useState, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { MMDLoader, MMDAnimationHelper, MMDPhysics } from 'three-stdlib';
import * as MMDParserModule from 'mmd-parser';
import '../utils/mmdCharsetPatch';
import { initAmmo, isAmmoInitialized } from '../utils/ammoLoader';
import {
  createMMDTextureManager,
  normalizeBlobFetchUrl,
  resolveAssetUrl,
} from '../utils/mmdFiles';
import { fetchVmdArrayBuffer } from '../utils/vmdBlobCache';
import {
  evaluateTimelineAtFrame,
  evaluateTimelineWithLayers,
  applyTimelineToSkinnedMesh,
  snapshotMmdRestPose,
  type TimelineLiveValues,
} from './TimelineLogic';
import {
  applyPoseSnapshotToMesh,
  collectDynamicBoneNames,
} from '../pose/poseApply';
import type { PoseSnapshotV1 } from '../pose/poseTypes';
import type {
  AutoLuminousLevel,
  CharacterQuality,
  MmdLiteConfig,
  RenderMode,
  TimelineKeyframe,
  ViewportFormat,
} from '../types';
import { isMmdFidelityMode } from '../utils/mmdFidelityMaterials';
import { isAnimeNprMode } from '../utils/animeNprMode';
import { registerAnimeNprModel, unregisterAnimeNprModel } from '../render/animeNpr/animeNprRuntime';
import {
  applyModelOpacity,
  freezeTwistBones,
  installMeshAnimation,
  resetMeshBindPose,
  scrubMmdHelperToTime,
  syncMmdLitePhysicsConfig,
} from '../utils/mmdMotionLite';
import { restartMeshPhysics, safeRemoveMeshFromHelper } from '../utils/mmdPhysicsLifecycle';
import {
  evaluatePhysicsEligibility,
  isAmmoOomError,
} from '../physics/physicsEligibility';
import {
  registerPhysicsModel,
  unregisterPhysicsModel,
  updatePhysicsModelVisibility,
  allocateCollisionGroupBit,
} from '../physics/physicsStabilityRegistry';
import {
  applyDuplicateCollisionIsolation,
  applyStabilitySafetyLayer,
  setModelPhysicsHidden,
  sleepSoftBodiesWhenIdle,
} from '../physics/physicsStabilitySystem';
import { applyAutoLuminous } from '../stylePacks/gallery/autoLuminous';
import { applyMaterialVisibility } from '../stylePacks/gallery/materialVisibility';
import { enhanceMmdMaterials } from '../utils/enhanceMmdMaterials';
import { applyCharacterMaterialQuality } from '../utils/applyCharacterMaterialQuality';
import { frameToTime } from '../utils/animationSync';
import { playheadRef, MMD_FPS, setPlayheadFrame } from '../utils/playhead';
import { isRecordingCapture, isInteractiveRecordingCapture } from '../video/recordingCapture';
import {
  extractPmxBones,
  extractPmxMaterials,
  extractPmxMorphs,
} from '../editor/pmxMetadata';
import type {
  AnimationLayerDef,
  BoneGroupDef,
  PmxBoneInfo,
  PmxMaterialInfo,
  PmxMorphInfo,
} from '../types';
import {
  applyIkFixOnly,
  applyPhysicsLiveSettings,
  applyWindForce,
  configureArmPhysicsForAnimation,
  getPhysicsAddParams,
  isAmmoPhysicsBroken,
  markAmmoPhysicsBroken,
  repairStretchedPhysicsBones,
  syncAllPhysicsBodiesFromBones,
  updateMmdPoseSolvers,
} from '../utils/mmdCharacterPhysics';
import {
  completeApisPhysicsSetup,
  apisSelfHealCheck,
  apisRuntimeCostPass,
  recordApisPhysicsFrame,
} from '../apis';
import {
  captureOriginalMaterialOpacity,
  sanitizeMeshMorphAttributes,
} from '../utils/mmdModelDetailing';
import { applyMaterialDetailingAndSmoothing } from '../utils/mmdMaterialDetailing';
import { applyBoxReflectionsToObject } from '../reflections/materialPatch';
import { applyAsrpToObject, DEFAULT_ASRP } from '../asrp';
import { registerCharacterRoot } from '../scene/characterHeadRegistry';
import { registerScenePhysics } from '../scene/scenePhysicsRegistry';
import { applyModelRenderPerfPolicy } from '../utils/modelRenderPerfPolicy';
import { runSafeMeshLoadOptimizationsAsync } from '../render/meshLoadOptimizations';
import {
  buildMotionCompatibilityMap,
  buildUmceAnimationClip,
  extractUmceContextFromMesh,
  extractVmdBoneNames,
  parseVmdBuffer,
  runUniversalScanner,
} from '../umce';

if (typeof window !== 'undefined') {
  (window as Window & { MMDParser?: unknown }).MMDParser =
    (MMDParserModule as { Parser?: unknown; default?: { Parser?: unknown } }).Parser ||
    (MMDParserModule as { default?: { Parser?: unknown } }).default?.Parser ||
    MMDParserModule;
}

export interface BoneTransformUpdate {
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
}

export interface MMDModelApi {
  getMesh: () => THREE.SkinnedMesh | null;
  resolveBone: (boneId: string) => THREE.Object3D | null;
  getPickableBones: () => THREE.Bone[];
  isProcedural: () => boolean;
  syncSkeleton: () => void;
  getRootMarker: () => THREE.Object3D | null;
  syncPhysicsFromRoot: () => void;
  /** mmd_rtx «Reload physics» */
  restartPhysics: () => void;
  /** Highlight PMX material by name (materials panel). */
  setMaterialHighlight: (materialName: string | null) => void;
}

const BONE_ALIASES: Record<string, string[]> = {
  head: ['頭', 'head', 'Head', 'HEAD', '頭点'],
  neck: ['首', 'neck', 'Neck', 'NECK'],
  arm_L: ['左肩', '左腕', 'left shoulder', 'LeftShoulder', '左ひじ', '左肘'],
  arm_R: ['右肩', '右腕', 'right shoulder', 'RightShoulder', '右ひじ', '右肘'],
  spine: ['上半身', '上半身2', 'spine', 'センター', 'center', 'Center'],
  hip: ['下半身', 'hip', 'Hips', 'hips'],
};

interface SafeTransformControlsProps {
  object: THREE.Object3D | null | undefined;
  mode: 'translate' | 'rotate';
  space?: 'world' | 'local';
  size?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onObjectChange?: () => void;
}

/** Mount TransformControls only after `object` is attached to the scene graph. */
function SafeTransformControls({
  object,
  mode,
  space = 'local',
  size = 0.85,
  onDragStart,
  onDragEnd,
  onObjectChange,
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
      space={space}
      size={size}
      camera={camera}
      onMouseDown={handleDragStart}
      onMouseUp={handleDragEnd}
      onObjectChange={onObjectChange}
    />
  );
}

interface ModelTransformGizmosProps {
  rootNode: THREE.Group | null;
  boneTarget: THREE.Object3D | null;
  rootManipulatorActive: boolean;
  transformMode: 'translate' | 'rotate';
  selectedBone: string;
  rootGizmoDraggingRef?: React.MutableRefObject<boolean>;
  gizmoDraggingRef?: React.MutableRefObject<boolean>;
  onModelMove?: (x: number, y: number, z: number) => void;
  onModelRotate?: (x: number, y: number, z: number) => void;
  onBoneTransform?: (boneId: string, update: BoneTransformUpdate) => void;
  syncPhysicsFromRoot: () => void;
  syncSkeleton: () => void;
}

function ModelTransformGizmos({
  rootNode,
  boneTarget,
  rootManipulatorActive,
  transformMode,
  selectedBone,
  rootGizmoDraggingRef,
  gizmoDraggingRef,
  onModelMove,
  onModelRotate,
  onBoneTransform,
  syncPhysicsFromRoot,
  syncSkeleton,
}: ModelTransformGizmosProps) {
  const boneIdRef = useRef(selectedBone);
  useLayoutEffect(() => {
    boneIdRef.current = selectedBone;
  }, [selectedBone]);

  if (rootManipulatorActive) {
    return (
      <SafeTransformControls
        object={rootNode}
        mode={transformMode}
        space="world"
        size={1.1}
        onDragStart={() => {
          if (rootGizmoDraggingRef) rootGizmoDraggingRef.current = true;
        }}
        onDragEnd={() => {
          if (rootGizmoDraggingRef) rootGizmoDraggingRef.current = false;
        }}
        onObjectChange={() => {
          if (!rootNode) return;
          syncPhysicsFromRoot();
          if (transformMode === 'translate') {
            onModelMove?.(rootNode.position.x, rootNode.position.y, rootNode.position.z);
          } else {
            onModelRotate?.(
              THREE.MathUtils.radToDeg(rootNode.rotation.x),
              THREE.MathUtils.radToDeg(rootNode.rotation.y),
              THREE.MathUtils.radToDeg(rootNode.rotation.z)
            );
          }
        }}
      />
    );
  }

  if (!boneTarget || !selectedBone) return null;

  return (
    <SafeTransformControls
      object={boneTarget}
      mode={transformMode}
      space="local"
      size={0.85}
      onDragStart={() => {
        if (gizmoDraggingRef) gizmoDraggingRef.current = true;
      }}
      onDragEnd={() => {
        if (gizmoDraggingRef) gizmoDraggingRef.current = false;
      }}
      onObjectChange={() => {
        syncSkeleton();
        onBoneTransform?.(boneIdRef.current, {
          rotationX: THREE.MathUtils.radToDeg(boneTarget.rotation.x),
          rotationY: THREE.MathUtils.radToDeg(boneTarget.rotation.y),
          rotationZ: THREE.MathUtils.radToDeg(boneTarget.rotation.z),
          positionX: boneTarget.position.x,
          positionY: boneTarget.position.y,
          positionZ: boneTarget.position.z,
        });
      }}
    />
  );
}

function isTextureReady(tex: THREE.Texture): boolean {
  const img = tex.image;
  if (!img) return false;
  if (img instanceof HTMLImageElement) {
    return img.complete && img.naturalWidth > 0;
  }
  if (img instanceof HTMLCanvasElement) {
    return img.width > 0 && img.height > 0;
  }
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    return img.width > 0 && img.height > 0;
  }
  if (typeof (img as { data?: unknown }).data !== 'undefined') {
    return true;
  }
  return false;
}

function fixTexture(tex: THREE.Texture) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;

  if (isTextureReady(tex)) {
    tex.needsUpdate = true;
    return;
  }

  const img = tex.image;
  if (img instanceof HTMLImageElement && !img.complete) {
    img.addEventListener(
      'load',
      () => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.needsUpdate = true;
      },
      { once: true }
    );
  }
}

function stripLegacyMaterialProps(
  mat: THREE.MeshToonMaterial & {
    envMap?: THREE.Texture | null;
    combine?: number;
    specularMap?: THREE.Texture | null;
  }
) {
  if (mat.envMap) {
    if (!isTextureReady(mat.envMap)) {
      mat.envMap.dispose();
    }
    mat.envMap = null;
  }
  delete (mat as { combine?: number }).combine;
  if (mat.specularMap && !isTextureReady(mat.specularMap)) {
    mat.specularMap.dispose();
    mat.specularMap = null;
  }
}

function fixMMDMaterials(root: THREE.Object3D) {
  root.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      const skinned = child as THREE.SkinnedMesh;
      skinned.castShadow = true;
      skinned.receiveShadow = true;
      skinned.frustumCulled = false;
      skinned.bindMode = 'detached';
      if (typeof skinned.normalizeSkinWeights === 'function') {
        skinned.normalizeSkinWeights();
      }
    }

    if (!(child as THREE.Mesh).isMesh) return;

    const mesh = child as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((material) => {
      if (!material) return;

      if ('color' in material && (material as THREE.MeshStandardMaterial).color) {
        (material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
      }

      const mat = material as THREE.MeshToonMaterial & {
        map?: THREE.Texture;
        alphaMap?: THREE.Texture;
        gradientMap?: THREE.Texture;
        emissiveMap?: THREE.Texture;
        specularMap?: THREE.Texture;
        normalMap?: THREE.Texture;
        envMap?: THREE.Texture | null;
        combine?: number;
        opacity: number;
        transparent: boolean;
        alphaTest: number;
        depthWrite: boolean;
        side: THREE.Side;
      };

      stripLegacyMaterialProps(mat);

      if (mat.map) fixTexture(mat.map);
      if (mat.alphaMap) fixTexture(mat.alphaMap);
      if (mat.emissiveMap) fixTexture(mat.emissiveMap);
      if (mat.specularMap && isTextureReady(mat.specularMap)) fixTexture(mat.specularMap);
      if (mat.normalMap) fixTexture(mat.normalMap);
      if (mat.gradientMap) {
        if (isTextureReady(mat.gradientMap)) {
          mat.gradientMap.colorSpace = THREE.NoColorSpace;
          mat.gradientMap.needsUpdate = true;
        } else {
          fixTexture(mat.gradientMap);
          mat.gradientMap.colorSpace = THREE.NoColorSpace;
        }
      }

      const needsAlpha = mat.transparent || mat.opacity < 0.999;
      mat.transparent = needsAlpha;
      mat.alphaTest = needsAlpha ? 0.4 : 0.01;
      mat.depthWrite = true;
      mat.depthTest = true;
      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;
    });
  });
}

interface MMDUserData {
  format?: string;
  rigidBodies?: Array<{
    boneIndex: number;
    position: number[];
    rotation: number[];
    type: number;
  }>;
  constraints?: unknown[];
  iks?: unknown[];
  bones?: Array<{ name: string; index: number; rigidBodyType?: number }>;
}

interface HelperMeshState {
  physics?: MMDPhysics;
  ikSolver?: { update: () => void };
  grantSolver?: { update: () => void };
  mixer?: THREE.AnimationMixer;
  looped?: boolean;
}

type HelperWithObjects = MMDAnimationHelper & {
  objects: WeakMap<THREE.SkinnedMesh, HelperMeshState>;
};

function getHelperMeshState(
  helper: MMDAnimationHelper,
  targetMesh: THREE.SkinnedMesh
): HelperMeshState | undefined {
  return (helper as HelperWithObjects).objects.get(targetMesh);
}

function getMMDUserData(mesh: THREE.SkinnedMesh): MMDUserData | undefined {
  return mesh.geometry.userData.MMD as MMDUserData | undefined;
}

function syncSkeletonBeforePhysics(targetMesh: THREE.SkinnedMesh) {
  targetMesh.updateMatrixWorld(true);
  targetMesh.skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));
  targetMesh.skeleton.update();
}

function bindRigidBodiesToSkeleton(targetMesh: THREE.SkinnedMesh) {
  const mmd = getMMDUserData(targetMesh);
  if (!mmd?.rigidBodies || !mmd.bones) return;

  const boneNameToIndex = new Map<string, number>();
  targetMesh.skeleton.bones.forEach((bone, index) => {
    boneNameToIndex.set(bone.name, index);
  });

  mmd.rigidBodies.forEach((body) => {
    const metaBone = mmd.bones![body.boneIndex];
    if (!metaBone) return;
    const liveIndex = boneNameToIndex.get(metaBone.name);
    if (liveIndex !== undefined) {
      body.boneIndex = liveIndex;
    }
  });
}

function syncPhysicsAfterRootMove(mesh: THREE.SkinnedMesh, physics: MMDPhysics) {
  syncSkeletonBeforePhysics(mesh);
  physics.bodies.forEach((body) => {
    body.updateFromBone();
  });
}

function alignMeshFeetToRoot(mesh: THREE.SkinnedMesh) {
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  if (box.isEmpty()) return;
  mesh.position.y -= box.min.y;
  mesh.updateMatrixWorld(true);
}

function configureAnimationHelper(helper: MMDAnimationHelper, targetMesh: THREE.SkinnedMesh) {
  helper.onBeforePhysics = (physicsMesh: THREE.SkinnedMesh) => {
    if (physicsMesh !== targetMesh) return;
    syncSkeletonBeforePhysics(physicsMesh);
    const meshState = getHelperMeshState(helper, physicsMesh);
    applyWindForce(physicsMesh, meshState?.physics, performance.now() * 0.001);
  };
}

function findBoneInSkeleton(skeleton: THREE.Skeleton, boneId: string): THREE.Bone | null {
  if (!boneId) return null;

  const direct = skeleton.bones.find(
    (b) => b.name === boneId || b.name.toLowerCase() === boneId.toLowerCase()
  );
  if (direct) return direct;

  const aliases = BONE_ALIASES[boneId];
  if (aliases) {
    for (const alias of aliases) {
      const found = skeleton.bones.find(
        (b) =>
          b.name === alias ||
          b.name.toLowerCase() === alias.toLowerCase() ||
          b.name.includes(alias)
      );
      if (found) return found;
    }
  }

  return (
    skeleton.bones.find(
      (b) =>
        b.name.toLowerCase().includes(boneId.toLowerCase()) ||
        boneId.toLowerCase().includes(b.name.toLowerCase())
    ) ?? null
  );
}

function getPickableSkeletonBones(mesh: THREE.SkinnedMesh): THREE.Bone[] {
  const picked = new Set<THREE.Bone>();
  for (const aliasList of Object.values(BONE_ALIASES)) {
    for (const alias of aliasList) {
      const bone = mesh.skeleton.bones.find(
        (b) => b.name === alias || b.name.includes(alias)
      );
      if (bone) picked.add(bone);
    }
  }
  if (picked.size === 0) {
    mesh.skeleton.bones.slice(0, 24).forEach((b) => picked.add(b));
  }
  return Array.from(picked);
}

interface MorphValues {
  eyesBlink: number;
  mouthOpen: number;
  browSad: number;
}

interface BoneRotationValues {
  x: number;
  y: number;
  z: number;
}

interface ModelPosition {
  x: number;
  y: number;
  z: number;
}

interface ModelRotation {
  x: number;
  y: number;
  z: number;
}

interface RootMarkerVisualProps {
  onSelectRoot?: () => void;
}

function RootMarkerVisual({ onSelectRoot }: RootMarkerVisualProps) {
  return (
    <group name="MMDRootMarker" position={[0, 0.02, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectRoot?.();
        }}
      >
        <torusGeometry args={[1.15, 0.07, 16, 64]} />
        <meshBasicMaterial color="#9d27ff" transparent opacity={0.92} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.42, 32]} />
        <meshBasicMaterial color="#e879ff" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.25, 48]} />
        <meshBasicMaterial color="#6f42c1" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#f0abfc" />
      </mesh>
    </group>
  );
}

interface MMDModelWrapperProps {
  /** Registers root for duo camera framing (Scene outliner id). */
  sceneModelId?: string;
  /** Scene outliner visibility — physics stays registered when hidden. */
  modelVisible?: boolean;
  /** Duplicate detection / collision isolation hash. */
  contentFingerprint?: string;
  url: string;
  isPlaying: boolean;
  physicsMode: 'anytime' | 'playtime' | 'off';
  /** When false, skip Bullet sim (multi-char background while paused). */
  physicsSimulation?: boolean;
  /** Shadow cast/receive for skinned meshes — off for background duo characters. */
  castShadow?: boolean;
  displayBodies?: boolean;
  morphs: MorphValues;
  selectedBone: string;
  boneRotation: BoneRotationValues;
  modelPosition: ModelPosition;
  modelRotation?: ModelRotation;
  customManager?: THREE.LoadingManager;
  fileMap?: Record<string, string>;
  vmdBlobUrls?: string[];
  activeVmdIndex?: number;
  hasVmdAnimation?: boolean;
  vmdPlaybackEnabled?: boolean;
  /** When set, motion template keyframes drive the model (not imported VMD). */
  activeTemplateId?: string | null;
  currentFrame?: number;
  playSpeed?: number;
  timelineKeyframes?: TimelineKeyframe[];
  animLayers?: AnimationLayerDef[];
  boneGroups?: BoneGroupDef[];
  timelineLive?: TimelineLiveValues;
  gizmoDraggingRef?: React.MutableRefObject<boolean>;
  rootGizmoDraggingRef?: React.MutableRefObject<boolean>;
  transformMode?: 'translate' | 'rotate';
  rootManipulatorActive?: boolean;
  onModelReady?: (api: MMDModelApi | null) => void;
  onPmxMetadata?: (
    meta: {
      bones: PmxBoneInfo[];
      morphs: PmxMorphInfo[];
      materials: PmxMaterialInfo[];
    },
    mesh: THREE.SkinnedMesh
  ) => void;
  highlightMaterialName?: string | null;
  onSelectBone?: (boneId: string) => void;
  onSelectRoot?: () => void;
  onBoneTransform?: (boneId: string, update: BoneTransformUpdate) => void;
  onModelMove?: (x: number, y: number, z: number) => void;
  onModelRotate?: (x: number, y: number, z: number) => void;
  showBonePickers?: boolean;
  onAnimationLoaded?: (frameCount: number, fileNames: string[]) => void;
  characterQuality?: CharacterQuality;
  viewportFormat?: ViewportFormat;
  mmdLite?: MmdLiteConfig;
  materialDetailing?: boolean;
  materialSmoothing?: number;
  autoLuminousLevel?: AutoLuminousLevel;
  hiddenMaterialNames?: string[];
  soloMaterialName?: string | null;
  renderMode?: RenderMode;
  /** Hide root marker / gizmos for clean video capture. */
  hideStagingChrome?: boolean;
  /** Pose library hold — applied when paused (before physics). */
  poseHold?: PoseSnapshotV1 | null;
  /** UMCE VMD bone remap table (motion bone → model bone). */
  vmdBoneRemap?: Record<string, string>;
  /** APIS generated physics profile (from import analysis). */
  apisProfile?: import('../apis').ApisPhysicsProfile | null;
  onApisReportUpdate?: (patch: Partial<import('../apis').ApisReport>) => void;
}

function applyCharacterMaterialPipeline(
  root: THREE.Object3D,
  quality: CharacterQuality,
  renderer?: THREE.WebGLRenderer,
  viewportFormat: ViewportFormat = '16:9',
  materialDetailing = true,
  materialSmoothing = 0.55,
  autoLuminousLevel: AutoLuminousLevel = 'auto',
  hiddenMaterialNames: string[] = [],
  soloMaterialName: string | null = null,
  renderMode: RenderMode = 'pbr_cinematic'
) {
  const animeNpr = isAnimeNprMode(renderMode);
  const fidelity = isMmdFidelityMode(renderMode);
  fixMMDMaterials(root);
  if (animeNpr) {
    applyMaterialVisibility(root, hiddenMaterialNames, soloMaterialName);
    return;
  }
  enhanceMmdMaterials(
    root,
    quality,
    viewportFormat,
    materialDetailing,
    renderMode,
    autoLuminousLevel
  );
  applyCharacterMaterialQuality(root, quality, renderer, viewportFormat);
  if (materialDetailing && !fidelity) {
    applyMaterialDetailingAndSmoothing(root, {
      smoothing: materialSmoothing,
      viewportFormat,
    });
  }
  if (!fidelity) {
    applyAutoLuminous(root, autoLuminousLevel);
  }
  applyMaterialVisibility(root, hiddenMaterialNames, soloMaterialName);
  if (!fidelity) {
    applyBoxReflectionsToObject(root, {
      character: true,
      environment: true,
      animeFriendly: true,
    });
    // ASRP Silhouette POM — skipped for Classic (mmd_fidelity) via `!fidelity` guard above
    applyAsrpToObject(root, {
      ...DEFAULT_ASRP,
      pipeline: 'asrp',
      enabled: true,
    });
  }
}

function MMDModelWrapper({
  sceneModelId,
  modelVisible = true,
  contentFingerprint = '',
  url,
  isPlaying,
  physicsMode,
  physicsSimulation = true,
  castShadow = true,
  displayBodies = false,
  morphs,
  selectedBone,
  boneRotation,
  modelPosition,
  modelRotation = { x: 0, y: 0, z: 0 },
  customManager,
  fileMap,
  vmdBlobUrls,
  activeVmdIndex = 0,
  hasVmdAnimation,
  vmdPlaybackEnabled = true,
  activeTemplateId = null,
  currentFrame = 0,
  playSpeed = 30,
  timelineKeyframes = [],
  animLayers = [],
  boneGroups = [],
  timelineLive,
  gizmoDraggingRef,
  rootGizmoDraggingRef,
  transformMode = 'rotate',
  rootManipulatorActive = true,
  onModelReady,
  onPmxMetadata,
  highlightMaterialName = null,
  onSelectBone,
  onSelectRoot,
  onBoneTransform,
  onModelMove,
  onModelRotate,
  showBonePickers = false,
  onAnimationLoaded,
  characterQuality = 'hd',
  viewportFormat = '16:9',
  mmdLite,
  materialDetailing = true,
  materialSmoothing = 0.55,
  autoLuminousLevel = 'auto',
  hiddenMaterialNames = [],
  soloMaterialName = null,
  renderMode = 'pbr_cinematic',
  hideStagingChrome = false,
  poseHold = null,
  vmdBoneRemap,
  apisProfile = null,
  onApisReportUpdate,
}: MMDModelWrapperProps) {
  function mergeVmdMotions(vmds: import('../umce/types').VmdMotionData[]) {
    const base = { ...vmds[0]!, motions: [...(vmds[0]!.motions ?? [])] };
    for (let i = 1; i < vmds.length; i++) {
      base.motions.push(...(vmds[i]?.motions ?? []));
    }
    return base;
  }

  const vmdBoneRemapRef = useRef(vmdBoneRemap);
  vmdBoneRemapRef.current = vmdBoneRemap;

  const loadVmdOntoMesh = useCallback(
    (
      loader: MMDLoader,
      vmdFetchUrls: string[],
      mmdMesh: THREE.SkinnedMesh,
      onClip: (clip: THREE.AnimationClip) => void,
      onErr?: (err: unknown) => void
    ) => {
      const primaryUrl = vmdFetchUrls[0];
      if (!primaryUrl) {
        onErr?.(new Error('No VMD URL'));
        return;
      }

      void (async () => {
        try {
          const buffers = await Promise.all(
            vmdFetchUrls.map((u) => {
              const fetchUrl = normalizeBlobFetchUrl(u);
              return fetchVmdArrayBuffer(fetchUrl);
            })
          );
          const vmds = await Promise.all(buffers.map((b) => parseVmdBuffer(b)));
          const vmd = vmds.length === 1 ? vmds[0]! : mergeVmdMotions(vmds);

          const ctx = extractUmceContextFromMesh(mmdMesh);
          const { canonicalMap, bones } = runUniversalScanner(ctx, mmdMesh);
          const vmdNames = extractVmdBoneNames(vmd);
          const motion = buildMotionCompatibilityMap(vmdNames, bones, canonicalMap);

          const remap = { ...motion.remapTable, ...vmdBoneRemapRef.current };
          // Always build from cached buffers — never re-fetch blob: URLs via
          // MMDLoader.loadAnimation (9:16 remounts revoke / break those fetches).
          const clip = buildUmceAnimationClip(loader, vmd, mmdMesh, remap);
          onClip(clip);
        } catch (err) {
          console.error('[MMD] VMD load error:', err);
          onErr?.(err);
        }
      })();
    },
    []
  );

  const { gl } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  const [mesh, setMesh] = useState<THREE.SkinnedMesh | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animationReady, setAnimationReady] = useState(false);
  const [ammoReady, setAmmoReady] = useState(isAmmoInitialized());
  const [useProcedural, setUseProcedural] = useState(false);
  const [rootNode, setRootNode] = useState<THREE.Group | null>(null);
  const [proceduralReady, setProceduralReady] = useState(false);

  const helperRef = useRef<MMDAnimationHelper | null>(null);
  const loaderRef = useRef<MMDLoader | null>(null);
  const physicsDebugRef = useRef<THREE.Object3D | null>(null);
  const meshRef = useRef<THREE.SkinnedMesh | null>(null);
  const rootGroupRef = useRef<THREE.Group>(null);
  const proceduralApiRef = useRef<MMDModelApi | null>(null);
  const prevRootPositionRef = useRef(new THREE.Vector3());
  const modelPositionRef = useRef(modelPosition);
  const modelRotationRef = useRef(modelRotation);
  const collisionGroupBitRef = useRef<number | null>(null);
  const modelVisibleRef = useRef(modelVisible);

  const morphsRef = useRef(morphs);
  const boneRotationRef = useRef(boneRotation);
  const selectedBoneRef = useRef(selectedBone);
  const physicsModeRef = useRef(physicsMode);
  const physicsSimulationRef = useRef(physicsSimulation);
  const castShadowRef = useRef(castShadow);
  const isPlayingRef = useRef(isPlaying);
  const animationReadyRef = useRef(animationReady);
  const hasVmdRef = useRef(hasVmdAnimation);
  const vmdPlaybackEnabledRef = useRef(vmdPlaybackEnabled);
  const activeTemplateIdRef = useRef(activeTemplateId);
  const currentFrameRef = useRef(currentFrame);
  const playSpeedRef = useRef(playSpeed);
  const vmdBlobUrlsRef = useRef(vmdBlobUrls);
  const characterQualityRef = useRef(characterQuality);
  const viewportFormatRef = useRef(viewportFormat);
  const activeVmdIndexRef = useRef(activeVmdIndex);
  const prevVmdIndexRef = useRef(activeVmdIndex);
  const lastInstalledVmdKeyRef = useRef<string | null>(null);
  const mmdLiteRef = useRef(mmdLite);
  const initialVmdAppliedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const ammoReadyRef = useRef(isAmmoInitialized());
  const poseHoldRef = useRef(poseHold);
  const timelineKeyframesRef = useRef(timelineKeyframes);
  const animLayersRef = useRef(animLayers);
  const boneGroupsRef = useRef(boneGroups);
  const timelineLiveRef = useRef<TimelineLiveValues>(
    timelineLive ?? {
      morphs: {
        eyes: morphs.eyesBlink,
        mouth: morphs.mouthOpen,
        brow: morphs.browSad,
      },
      boneHeadY: 0,
      boneNeckX: 0,
      boneSpineY: 0,
      boneSpineZ: 0,
      boneWaistY: 0,
      boneArmLX: 0,
      boneArmLZ: 0,
      boneArmRX: 0,
      boneArmRZ: 0,
    }
  );

  useEffect(() => {
    morphsRef.current = morphs;
  }, [morphs]);

  useEffect(() => {
    boneRotationRef.current = boneRotation;
  }, [boneRotation]);

  useEffect(() => {
    selectedBoneRef.current = selectedBone;
  }, [selectedBone]);

  useEffect(() => {
    physicsModeRef.current = physicsMode;
  }, [physicsMode]);

  useEffect(() => {
    physicsSimulationRef.current = physicsSimulation;
  }, [physicsSimulation]);

  useEffect(() => {
    castShadowRef.current = castShadow;
    const m = meshRef.current;
    if (!m) return;
    applyModelRenderPerfPolicy(m, {
      castShadow,
      frustumCulled: !castShadow,
    });
  }, [castShadow, mesh]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    animationReadyRef.current = animationReady;
  }, [animationReady]);

  useEffect(() => {
    hasVmdRef.current = hasVmdAnimation;
  }, [hasVmdAnimation]);

  useEffect(() => {
    vmdPlaybackEnabledRef.current = vmdPlaybackEnabled;
  activeTemplateIdRef.current = activeTemplateId;
    wasPlayingRef.current = false;
  }, [vmdPlaybackEnabled]);

  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  useEffect(() => {
    playSpeedRef.current = playSpeed;
  }, [playSpeed]);

  useEffect(() => {
    vmdBlobUrlsRef.current = vmdBlobUrls;
  }, [vmdBlobUrls]);

  useEffect(() => {
    characterQualityRef.current = characterQuality;
    viewportFormatRef.current = viewportFormat;
  }, [characterQuality, viewportFormat]);

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    if (isAnimeNprMode(renderMode)) {
      registerAnimeNprModel(m);
      return () => unregisterAnimeNprModel(m);
    }
    unregisterAnimeNprModel(m);
    return undefined;
  }, [renderMode]);

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    applyCharacterMaterialPipeline(
      m,
      characterQuality,
      gl,
      viewportFormat,
      materialDetailing,
      materialSmoothing,
      autoLuminousLevel,
      hiddenMaterialNames,
      soloMaterialName,
      renderMode
    );
  }, [
    characterQuality,
    viewportFormat,
    gl,
    materialDetailing,
    materialSmoothing,
    autoLuminousLevel,
    hiddenMaterialNames,
    soloMaterialName,
    renderMode,
  ]);

  // useFrame runs before effects — mirror critical props every render.
  isPlayingRef.current = isPlaying;
  animationReadyRef.current = animationReady;
  currentFrameRef.current = currentFrame;
  vmdBlobUrlsRef.current = vmdBlobUrls;
  vmdPlaybackEnabledRef.current = vmdPlaybackEnabled;
  activeTemplateIdRef.current = activeTemplateId;
  timelineKeyframesRef.current = timelineKeyframes;
  animLayersRef.current = animLayers;
  boneGroupsRef.current = boneGroups;
  poseHoldRef.current = poseHold;

  const evaluatePoseAtFrame = useCallback(
    (frame: number) => {
      const live = timelineLiveRef.current;
      const layers = animLayersRef.current;
      if (layers && layers.length > 0) {
        return evaluateTimelineWithLayers(
          timelineKeyframesRef.current,
          layers,
          frame,
          live,
          boneGroupsRef.current
        );
      }
      return evaluateTimelineAtFrame(timelineKeyframesRef.current, frame, live);
    },
    []
  );

  useEffect(() => {
    if (timelineLive) {
      timelineLiveRef.current = timelineLive;
    }
  }, [timelineLive]);

  useEffect(() => {
    modelPositionRef.current = modelPosition;
    modelRotationRef.current = modelRotation;
  }, [modelPosition, modelRotation]);

  // Apply template pose as soon as keyframes land (before / without waiting for useFrame).
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !animationReady || timelineKeyframes.length === 0) return;
    if (vmdPlaybackEnabled && !activeTemplateId) return;

    const frame = isPlaying ? playheadRef.current : currentFrame;
    const evaluated = evaluatePoseAtFrame(frame);
    applyTimelineToSkinnedMesh(mesh, evaluated);
    syncSkeletonBeforePhysics(mesh);
  }, [
    timelineKeyframes,
    animLayers,
    boneGroups,
    activeTemplateId,
    animationReady,
    currentFrame,
    isPlaying,
    vmdPlaybackEnabled,
    evaluatePoseAtFrame,
  ]);

  const syncPhysicsFromRoot = useCallback(() => {
    const currentMesh = meshRef.current;
    const helper = helperRef.current;
    if (!currentMesh || !helper) return;

    syncSkeletonBeforePhysics(currentMesh);
    const meshState = getHelperMeshState(helper, currentMesh);
    if (meshState?.physics) {
      syncPhysicsAfterRootMove(currentMesh, meshState.physics);
    }
  }, []);

  useEffect(() => {
    const root = rootGroupRef.current;
    if (!root || rootGizmoDraggingRef?.current) return;
    root.position.set(modelPosition.x, modelPosition.y, modelPosition.z);
    root.rotation.set(
      THREE.MathUtils.degToRad(modelRotation.x),
      THREE.MathUtils.degToRad(modelRotation.y),
      THREE.MathUtils.degToRad(modelRotation.z)
    );
    prevRootPositionRef.current.copy(root.position);
    syncPhysicsFromRoot();
  }, [modelPosition, modelRotation, rootGizmoDraggingRef, syncPhysicsFromRoot]);

  const assignRootGroup = useCallback((node: THREE.Group | null) => {
    rootGroupRef.current = node;
    setRootNode(node);
  }, []);

  useEffect(() => {
    if (!sceneModelId) return;
    return registerCharacterRoot(sceneModelId, () => rootGroupRef.current);
  }, [sceneModelId]);

  const boneTarget = useMemo(() => {
    if (rootManipulatorActive || !selectedBone) return null;
    if (meshRef.current) {
      return findBoneInSkeleton(meshRef.current.skeleton, selectedBone);
    }
    if (proceduralReady && proceduralApiRef.current) {
      return proceduralApiRef.current.resolveBone(selectedBone);
    }
    return null;
  }, [rootManipulatorActive, selectedBone, mesh, proceduralReady, useProcedural]);

  const gizmoLayer =
    hideStagingChrome ? null : (
      <ModelTransformGizmos
        rootNode={rootNode}
        boneTarget={boneTarget}
        rootManipulatorActive={rootManipulatorActive}
        transformMode={transformMode}
        selectedBone={selectedBone}
        rootGizmoDraggingRef={rootGizmoDraggingRef}
        gizmoDraggingRef={gizmoDraggingRef}
        onModelMove={onModelMove}
        onModelRotate={onModelRotate}
        onBoneTransform={onBoneTransform}
        syncPhysicsFromRoot={syncPhysicsFromRoot}
        syncSkeleton={() => {
          if (meshRef.current) syncSkeletonBeforePhysics(meshRef.current);
          else rootNode?.updateMatrixWorld(true);
        }}
      />
    );

  const buildMeshApi = useCallback((): MMDModelApi | null => {
    const currentMesh = meshRef.current;
    if (!currentMesh) return proceduralApiRef.current;

    return {
      getMesh: () => meshRef.current,
      resolveBone: (boneId: string) => findBoneInSkeleton(currentMesh.skeleton, boneId),
      getPickableBones: () => getPickableSkeletonBones(currentMesh),
      isProcedural: () => false,
      syncSkeleton: () => {
        if (meshRef.current) syncSkeletonBeforePhysics(meshRef.current);
      },
      getRootMarker: () => rootGroupRef.current,
      syncPhysicsFromRoot,
      restartPhysics: () => {
        const mesh = meshRef.current;
        const helper = helperRef.current;
        if (!mesh || !helper) return;
        try {
          const state = getHelperMeshState(helper, mesh);
          let animTime: number | null = null;
          const mixer = state?.mixer;
          if (mixer) {
            const acts = (mixer as THREE.AnimationMixer & { _actions?: THREE.AnimationAction[] })
              ._actions;
            if (acts?.[0]) animTime = acts[0].time;
          }
          const clip = (state as { activeClip?: THREE.AnimationClip } | undefined)?.activeClip;
          const physOn =
            isAmmoInitialized() &&
            !isAmmoPhysicsBroken() &&
            physicsModeRef.current !== 'off';
          restartMeshPhysics({
            helper,
            mesh,
            clip: clip ?? undefined,
            physicsEnabled: physOn,
            wasPlaying: isPlayingRef.current,
            animTime,
          });
          if (mmdLiteRef.current) syncMmdLitePhysicsConfig(mmdLiteRef.current);
        } catch (err) {
          console.warn('[MMD] restartPhysics failed:', err);
          try {
            window.dispatchEvent(
              new CustomEvent('animastage:toast', {
                detail: {
                  message: 'Physics restart failed — try Reload model or disable physics.',
                  durationMs: 5000,
                },
              })
            );
          } catch {
            /* ignore */
          }
        }
      },
      setMaterialHighlight: (materialName: string | null) => {
        const root = meshRef.current;
        if (!root) return;
        root.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of mats) {
            const m = mat as THREE.MeshStandardMaterial;
            if (!m.emissive) continue;
            const match = materialName && (m.name === materialName || m.name.includes(materialName));
            if (match) {
              m.emissive.setHex(0x5533aa);
              m.emissiveIntensity = 0.35;
            } else {
              m.emissive.setHex(0x000000);
              m.emissiveIntensity = 0;
            }
          }
        });
      },
    };
  }, [syncPhysicsFromRoot]);

  const onPmxMetadataRef = useRef(onPmxMetadata);
  onPmxMetadataRef.current = onPmxMetadata;
  const pmxMetadataMeshIdRef = useRef<string | null>(null);
  const apisProfileRef = useRef(apisProfile);
  apisProfileRef.current = apisProfile;
  const onApisReportUpdateRef = useRef(onApisReportUpdate);
  onApisReportUpdateRef.current = onApisReportUpdate;
  const apisSetupDoneRef = useRef(false);
  const apisHealFrameRef = useRef(0);

  const tryCompleteApisSetup = useCallback(() => {
    const profile = apisProfileRef.current;
    const mmdMesh = meshRef.current;
    const helper = helperRef.current;
    if (!profile || !mmdMesh || !helper || apisSetupDoneRef.current) return;
    const physics = getHelperMeshState(helper, mmdMesh)?.physics;
    if (!physics) return;
    apisSetupDoneRef.current = true;
    void completeApisPhysicsSetup(sceneModelId, mmdMesh, helper, profile, (patch) => {
      onApisReportUpdateRef.current?.(patch);
    });
  }, [sceneModelId]);

  useEffect(() => {
    apisSetupDoneRef.current = false;
  }, [sceneModelId, apisProfile?.modelHash]);

  useEffect(() => {
    tryCompleteApisSetup();
  }, [apisProfile, animationReady, tryCompleteApisSetup]);

  useEffect(() => {
    modelVisibleRef.current = modelVisible;
  }, [modelVisible]);

  useEffect(() => {
    onModelReady?.(mesh ? buildMeshApi() : useProcedural ? proceduralApiRef.current : null);
  }, [mesh, useProcedural, buildMeshApi, onModelReady]);

  useEffect(() => {
    if (!sceneModelId || !meshRef.current || !helperRef.current) return;

    if (collisionGroupBitRef.current === null) {
      collisionGroupBitRef.current = allocateCollisionGroupBit();
    }

    const meshForReg = meshRef.current;
    const helperForReg = helperRef.current;
    const groupBit = collisionGroupBitRef.current;
    const hash = contentFingerprint || sceneModelId;

    registerPhysicsModel({
      sceneModelId,
      mesh: meshForReg,
      helper: helperForReg,
      visible: modelVisibleRef.current,
      contentHash: hash,
      collisionGroupBit: groupBit,
      getPhysics: () => getHelperMeshState(helperForReg, meshForReg)?.physics,
      syncSkeleton: () => {
        if (meshRef.current) syncSkeletonBeforePhysics(meshRef.current);
      },
      restartPhysicsFull: () => buildMeshApi()?.restartPhysics(),
      ensurePhysicsEnabled: () => {
        helperForReg.enable('physics', true);
      },
    });

    applyDuplicateCollisionIsolation();
    if (!modelVisibleRef.current) {
      const reg = {
        sceneModelId,
        mesh: meshForReg,
        helper: helperForReg,
        visible: false,
        contentHash: hash,
        collisionGroupBit: groupBit,
        getPhysics: () => getHelperMeshState(helperForReg, meshForReg)?.physics,
        syncSkeleton: () => {
          if (meshRef.current) syncSkeletonBeforePhysics(meshRef.current);
        },
      };
      setModelPhysicsHidden(reg, true);
    }

    return () => unregisterPhysicsModel(sceneModelId);
  }, [sceneModelId, mesh, animationReady, contentFingerprint, buildMeshApi]);

  useEffect(() => {
    if (!sceneModelId || !meshRef.current || !helperRef.current) return;
    const currentMesh = meshRef.current;
    const helper = helperRef.current;
    const physics = getHelperMeshState(helper, currentMesh)?.physics;
    if (!physics) return;
    return registerScenePhysics(physics, sceneModelId);
  }, [sceneModelId, mesh, animationReady]);

  useEffect(() => {
    if (!sceneModelId) return;
    updatePhysicsModelVisibility(sceneModelId, modelVisible);
    if (meshRef.current) meshRef.current.visible = modelVisible;

    const helper = helperRef.current;
    const currentMesh = meshRef.current;
    if (!helper || !currentMesh) return;

    const reg = {
      sceneModelId,
      mesh: currentMesh,
      helper,
      visible: modelVisible,
      contentHash: contentFingerprint || sceneModelId,
      collisionGroupBit: collisionGroupBitRef.current ?? 1,
      getPhysics: () => getHelperMeshState(helper, currentMesh)?.physics,
      syncSkeleton: () => syncSkeletonBeforePhysics(currentMesh),
    };
    setModelPhysicsHidden(reg, !modelVisible);
    if (modelVisible) {
      helper.enable('physics', physicsModeRef.current !== 'off');
    }
  }, [modelVisible, sceneModelId, contentFingerprint]);

  useEffect(() => {
    if (!mesh) {
      pmxMetadataMeshIdRef.current = null;
      return;
    }
    if (pmxMetadataMeshIdRef.current === mesh.uuid) return;
    pmxMetadataMeshIdRef.current = mesh.uuid;

    onPmxMetadataRef.current?.(
      {
        bones: extractPmxBones(mesh),
        morphs: extractPmxMorphs(mesh),
        materials: extractPmxMaterials(mesh),
      },
      mesh
    );
  }, [mesh]);

  useEffect(() => {
    buildMeshApi()?.setMaterialHighlight(highlightMaterialName ?? null);
  }, [highlightMaterialName, buildMeshApi, mesh]);

  useEffect(() => {
    helperRef.current = new MMDAnimationHelper({
      afterglow: 0,
      resetPhysicsOnLoop: true,
      pmxAnimation: true,
    } as ConstructorParameters<typeof MMDAnimationHelper>[0]);
    return () => {
      helperRef.current = null;
    };
  }, []);

  const onAnimationLoadedRef = useRef(onAnimationLoaded);
  useEffect(() => {
    onAnimationLoadedRef.current = onAnimationLoaded;
  }, [onAnimationLoaded]);

  useEffect(() => {
    if (!url) return;

    if (url.startsWith('models/') && !customManager && !fileMap) {
      setLoadError(true);
      setLoading(false);
      setUseProcedural(true);
      return;
    }

    setLoading(true);
    setLoadError(false);
    setAnimationReady(false);
    setUseProcedural(false);
    setProceduralReady(false);
    setMesh(null);
    meshRef.current = null;

    let isCurrent = true;
    let loadedMesh: THREE.SkinnedMesh | null = null;
    let meshAttachedToHelper = false;

    void initAmmo()
      .then(() => {
        ammoReadyRef.current = isAmmoInitialized();
        if (isCurrent) setAmmoReady(ammoReadyRef.current);
      })
      .catch((error) => {
        console.error('[MMD] Ammo.js failed to initialize — physics disabled:', error);
        ammoReadyRef.current = false;
        if (isCurrent) setAmmoReady(false);
      });

    void (() => {
      if (!isCurrent) return;

      let manager: THREE.LoadingManager;
      if (fileMap) {
        manager = customManager ?? createMMDTextureManager(fileMap);
      } else {
        manager = customManager ?? new THREE.LoadingManager();
        const tgaLoader = new TGALoader(manager);
        manager.addHandler(/\.tga$/i, tgaLoader);
      }

      const previousOnLoad = manager.onLoad;
      manager.onLoad = () => {
        previousOnLoad?.();
        if (loadedMesh && isCurrent) {
          applyCharacterMaterialPipeline(
            loadedMesh,
            characterQualityRef.current,
            gl,
            viewportFormatRef.current,
            materialDetailing,
            materialSmoothing,
            autoLuminousLevel,
            hiddenMaterialNames,
            soloMaterialName,
            renderMode
          );
        }
      };

      const loader = new MMDLoader(manager);
      loaderRef.current = loader;

      const attachMeshToHelper = (
        mmdMesh: THREE.SkinnedMesh,
        animation?: THREE.AnimationClip
      ) => {
        if (!helperRef.current || meshAttachedToHelper) return;

        bindRigidBodiesToSkeleton(mmdMesh);
        configureAnimationHelper(helperRef.current, mmdMesh);

        const eligibility = evaluatePhysicsEligibility(mmdMesh);
        const physicsWanted =
          isAmmoInitialized() &&
          !isAmmoPhysicsBroken() &&
          physicsModeRef.current !== 'off' &&
          physicsSimulationRef.current &&
          eligibility.allowed;

        if (!eligibility.allowed && physicsModeRef.current !== 'off') {
          console.info(
            `[MMD] Physics skipped (${eligibility.reason}, ${eligibility.rigidBodyCount} bodies) — animation/IK only`
          );
        }

        try {
          helperRef.current.add(
            mmdMesh,
            getPhysicsAddParams(false, undefined, { animation }) as unknown as Parameters<
              MMDAnimationHelper['add']
            >[1]
          );
          meshAttachedToHelper = true;
        } catch (err) {
          if (isAmmoOomError(err)) markAmmoPhysicsBroken(err);
          console.warn('[MMD] helper.add failed:', err);
          return;
        }

        applyIkFixOnly(mmdMesh, helperRef.current);

        if (animation) {
          // Stay on bind pose until Play — do not leave mixer driving frame-0 dance pose.
          helperRef.current.enable('animation', false);
        }

        helperRef.current.enable('ik', true);
        helperRef.current.enable('grant', true);
        helperRef.current.enable('physics', false);

        let physicsLive = false;
        if (physicsWanted) {
          try {
            restartMeshPhysics({
              helper: helperRef.current,
              mesh: mmdMesh,
              clip: animation ?? null,
              physicsEnabled: true,
            });
            physicsLive = Boolean(getHelperMeshState(helperRef.current, mmdMesh)?.physics);
          } catch (err) {
            if (isAmmoOomError(err)) markAmmoPhysicsBroken(err);
            console.warn('[MMD] Physics bootstrap OOM — continuing without simulation:', err);
            helperRef.current.enable('physics', false);
          }
        }

        helperRef.current.enable(
          'physics',
          physicsLive &&
            (physicsModeRef.current === 'anytime' ||
              (physicsModeRef.current === 'playtime' && isPlayingRef.current))
        );

        const meshState = getHelperMeshState(helperRef.current, mmdMesh);
        if (meshState?.physics) {
          applyPhysicsLiveSettings(meshState.physics);
          configureArmPhysicsForAnimation(mmdMesh, helperRef.current);
          syncAllPhysicsBodiesFromBones(mmdMesh, meshState.physics);
          meshState.physics.reset();
          tryCompleteApisSetup();
        }

        syncSkeletonBeforePhysics(mmdMesh);
      };

      const revealMesh = (mmdMesh: THREE.SkinnedMesh) => {
        if (!isCurrent) {
          mmdMesh.geometry?.dispose();
          const mats = Array.isArray(mmdMesh.material) ? mmdMesh.material : [mmdMesh.material];
          mats.forEach((m) => m?.dispose());
          return;
        }

        sanitizeMeshMorphAttributes(mmdMesh);
        captureOriginalMaterialOpacity(mmdMesh);
        if (mmdLiteRef.current?.freezeTwistBones) freezeTwistBones(mmdMesh);
        if (mmdLiteRef.current) {
          syncMmdLitePhysicsConfig(mmdLiteRef.current);
          applyModelOpacity(mmdMesh, mmdLiteRef.current.modelOpacity);
        }
        applyCharacterMaterialPipeline(
          mmdMesh,
          characterQualityRef.current,
          gl,
          viewportFormatRef.current,
          materialDetailing,
          materialSmoothing,
          autoLuminousLevel,
          hiddenMaterialNames,
          soloMaterialName,
          renderMode
        );
        alignMeshFeetToRoot(mmdMesh);
        snapshotMmdRestPose(mmdMesh);
        loadedMesh = mmdMesh;
        meshRef.current = mmdMesh;
        if (isAnimeNprMode(renderMode)) {
          registerAnimeNprModel(mmdMesh);
        }
        setMesh(mmdMesh);
        setLoading(false);
        setUseProcedural(false);

        void runSafeMeshLoadOptimizationsAsync(mmdMesh).then(() => {
          if (!isCurrent || meshRef.current !== mmdMesh) return;
          const helper = helperRef.current;
          const meshState = helper ? getHelperMeshState(helper, mmdMesh) : undefined;
          meshState?.physics?.reset?.();
          mmdMesh.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              (o as THREE.Mesh).matrixAutoUpdate = true;
            }
          });
        });
      };

      const finishAnimation = (mmdMesh: THREE.SkinnedMesh, animation?: THREE.AnimationClip) => {
        if (!isCurrent) return;

        void initAmmo()
          .catch((error) => {
            console.warn('[MMD] Ammo unavailable — physics disabled:', error);
          })
          .finally(() => {
            if (!isCurrent) return;

            ammoReadyRef.current = isAmmoInitialized();
            setAmmoReady(ammoReadyRef.current);

            try {
              attachMeshToHelper(mmdMesh, animation);
            } catch (err) {
              console.error('[MMD] Failed to attach animation helper:', err);
            }

            if (animation) {
              hasVmdRef.current = true;
              animationReadyRef.current = true;
              helperRef.current?.enable('animation', false);
              setAnimationReady(true);

              const urlsAtLoad = vmdBlobUrlsRef.current;
              if (urlsAtLoad?.length) {
                const idx = Math.min(
                  Math.max(0, activeVmdIndexRef.current),
                  urlsAtLoad.length - 1
                );
                lastInstalledVmdKeyRef.current = `${idx}|${urlsAtLoad[idx] ?? ''}`;
              }

              const frameCount = Math.max(1, Math.ceil(animation.duration * MMD_FPS));
              const notifyLoaded = () => onAnimationLoadedRef.current?.(frameCount, []);
              notifyLoaded();
              requestAnimationFrame(notifyLoaded);
            } else {
              hasVmdRef.current = false;
              // Mesh is attached without a clip — still "ready", otherwise a VMD
              // attached later can never install and template poses never apply.
              animationReadyRef.current = true;
              helperRef.current?.enable('animation', false);
              setAnimationReady(true);
            }
          });
      };

      const onModelLoaded = (mmdMesh: THREE.SkinnedMesh, animation?: THREE.AnimationClip) => {
        revealMesh(mmdMesh);
        finishAnimation(mmdMesh, animation);
      };

      loader.load(
        url,
        (mmdMesh) => {
          if (vmdBlobUrls && vmdBlobUrls.length > 0) {
            revealMesh(mmdMesh);

            const vmdFetchUrls = vmdBlobUrls.map((u) =>
              fileMap ? resolveAssetUrl(u, fileMap) : normalizeBlobFetchUrl(u)
            );
            loadVmdOntoMesh(
              loader,
              vmdFetchUrls,
              mmdMesh,
              (animation) => finishAnimation(mmdMesh, animation),
              (err) => {
                console.error('[MMD] VMD load error:', err);
                finishAnimation(mmdMesh);
              }
            );
          } else {
            onModelLoaded(mmdMesh);
          }
        },
        undefined,
        (err) => {
          console.warn('[MMD] Model load error:', err);
          if (isCurrent) {
            setLoadError(true);
            setLoading(false);
            setUseProcedural(true);
          }
        }
      );
    })();

    return () => {
      isCurrent = false;
      meshAttachedToHelper = false;
      initialVmdAppliedRef.current = false;
      lastInstalledVmdKeyRef.current = null;
      loaderRef.current = null;
      if (physicsDebugRef.current && loadedMesh) {
        loadedMesh.remove(physicsDebugRef.current);
        physicsDebugRef.current = null;
      }
      if (loadedMesh && helperRef.current) {
        safeRemoveMeshFromHelper(helperRef.current, loadedMesh);
      }
      if (loadedMesh) {
        loadedMesh.geometry?.dispose();
        const mats = Array.isArray(loadedMesh.material)
          ? loadedMesh.material
          : [loadedMesh.material];
        mats.forEach((m) => m?.dispose());
      }
      meshRef.current = null;
      onModelReady?.(null);
    };
  }, [url, customManager, fileMap, onModelReady]);

  const restoreBindPose = useCallback((mesh: THREE.SkinnedMesh) => {
    const rest = mesh.userData.mmdRestPose as
      | Record<string, [number, number, number]>
      | undefined;
    if (rest) {
      for (const bone of mesh.skeleton.bones) {
        const base = rest[bone.name];
        if (base) bone.rotation.set(base[0], base[1], base[2]);
      }
      mesh.skeleton.update();
    } else {
      resetMeshBindPose(mesh);
    }
  }, []);

  useEffect(() => {
    if (!animationReady || !meshRef.current || !helperRef.current) return;
    wasPlayingRef.current = false;
    const helper = helperRef.current;
    const mesh = meshRef.current;
    // VMD wins while enabled — timeline keys must not mute the motion clip.
    const useVmd =
      (vmdBlobUrlsRef.current?.length ?? 0) > 0 &&
      vmdPlaybackEnabledRef.current &&
      !activeTemplateIdRef.current;
    if (!useVmd) {
      helper.enable('animation', false);
      return;
    }
    // Demand frameloop: do not leave animation on while paused — restore T-pose at 0.
    const playing = isPlayingRef.current;
    const frame = playing ? playheadRef.current : currentFrameRef.current;
    if (!playing && frame <= 0.05) {
      helper.enable('animation', false);
      restoreBindPose(mesh);
    } else if (!playing) {
      helper.enable('animation', true);
      scrubMmdHelperToTime(helper, mesh, frameToTime(frame, MMD_FPS));
      helper.enable('animation', false);
    } else {
      helper.enable('animation', true);
      scrubMmdHelperToTime(helper, mesh, frameToTime(frame, MMD_FPS));
    }
  }, [animationReady, restoreBindPose]);

  // When a template is applied / removed, sync the helper animation flag immediately
  // so VMD and timeline never fight each other.
  useEffect(() => {
    const helper = helperRef.current;
    const mesh = meshRef.current;
    if (!helper || !mesh || !animationReady) return;

    const useVmd =
      (vmdBlobUrlsRef.current?.length ?? 0) > 0 &&
      vmdPlaybackEnabledRef.current &&
      !activeTemplateId;

    // If switching to timeline mode, also rewind mixer to frame 0 to prevent
    // VMD pose leaking into the first timeline frame.
    if (!useVmd) {
      helper.enable('animation', false);
      scrubMmdHelperToTime(helper, mesh, 0);
      restoreBindPose(mesh);
      return;
    }

    const playing = isPlayingRef.current;
    const frame = playing ? playheadRef.current : currentFrameRef.current;
    if (!playing && frame <= 0.05) {
      helper.enable('animation', false);
      restoreBindPose(mesh);
    } else {
      helper.enable('animation', playing);
      if (!playing) {
        scrubMmdHelperToTime(helper, mesh, frameToTime(frame, MMD_FPS));
        helper.enable('animation', false);
      }
    }
  }, [activeTemplateId, animationReady, vmdPlaybackEnabled, restoreBindPose]);

  // STOP / scrub to 0 while paused: demand frameloop may not run useFrame — force T-pose.
  useEffect(() => {
    const helper = helperRef.current;
    const mesh = meshRef.current;
    if (!helper || !mesh || !animationReady) return;
    const useVmd =
      (vmdBlobUrls?.length ?? 0) > 0 &&
      vmdPlaybackEnabled &&
      !activeTemplateId;
    if (!useVmd || isPlaying) return;
    if (currentFrame > 0.05) {
      helper.enable('animation', true);
      scrubMmdHelperToTime(helper, mesh, frameToTime(currentFrame, MMD_FPS));
      helper.enable('animation', false);
      invalidate();
      return;
    }
    helper.enable('animation', false);
    restoreBindPose(mesh);
    invalidate();
  }, [
    activeTemplateId,
    animationReady,
    currentFrame,
    invalidate,
    isPlaying,
    restoreBindPose,
    vmdBlobUrls,
    vmdPlaybackEnabled,
  ]);

  useEffect(() => {
    activeVmdIndexRef.current = activeVmdIndex;
  }, [activeVmdIndex]);

  useEffect(() => {
    mmdLiteRef.current = mmdLite;
    if (mmdLite) syncMmdLitePhysicsConfig(mmdLite);
  }, [mmdLite]);

  useEffect(() => {
    if (!mesh || !mmdLite) return;
    applyModelOpacity(mesh, mmdLite.modelOpacity);
  }, [mesh, mmdLite?.modelOpacity]);

  useEffect(() => {
    if (!mesh || !mmdLite?.freezeTwistBones) return;
    freezeTwistBones(mesh);
  }, [mesh, mmdLite?.freezeTwistBones, animationReady]);

  useEffect(() => {
    const helper = helperRef.current;
    const currentMesh = meshRef.current;
    if (!helper || !currentMesh || !mmdLite) return;
    syncMmdLitePhysicsConfig(mmdLite);
    const meshState = getHelperMeshState(helper, currentMesh);
    if (meshState?.physics) {
      applyPhysicsLiveSettings(meshState.physics);
    }
  }, [mmdLite, mesh]);

  useEffect(() => {
    const mesh = meshRef.current;
    const loader = loaderRef.current;
    const urls = vmdBlobUrls;
    if (!mesh || !loader || !urls?.length || !animationReady) return;

    const index = Math.min(Math.max(0, activeVmdIndex), urls.length - 1);
    const activeUrl = urls[index] ?? '';
    const activeKey = `${index}|${activeUrl}`;

    if (lastInstalledVmdKeyRef.current === activeKey) return;
    lastInstalledVmdKeyRef.current = activeKey;
    prevVmdIndexRef.current = activeVmdIndex;

    const vmdUrl = fileMap
      ? resolveAssetUrl(activeUrl, fileMap)
      : normalizeBlobFetchUrl(activeUrl);

    setAnimationReady(false);
    hasVmdRef.current = true;

    // Pause physics while the new clip is installed so bodies don't explode mid-swap.
    const helperDuringLoad = helperRef.current;
    if (helperDuringLoad) {
      helperDuringLoad.enable('physics', false);
    }

    loadVmdOntoMesh(
      loader,
      [vmdUrl],
      mesh,
      (clip) => {
        const helper = helperRef.current;
        if (!helper || !meshRef.current) return;

        if (mmdLiteRef.current) syncMmdLitePhysicsConfig(mmdLiteRef.current);
        const physOn =
          isAmmoInitialized() && !isAmmoPhysicsBroken() && physicsModeRef.current !== 'off';
        installMeshAnimation(helper, mesh, clip, false);
        configureAnimationHelper(helper, mesh);
        scrubMmdHelperToTime(helper, mesh, 0);
        setPlayheadFrame(0);

        const settlePhysics = () => {
          if (!helperRef.current || !meshRef.current) return;
          if (physOn) {
            helperRef.current.enable('physics', true);
            const meshState = getHelperMeshState(helperRef.current, meshRef.current);
            try {
              meshState?.physics?.reset?.();
            } catch {
              /* ignore */
            }
            if (meshState?.physics) {
              applyPhysicsLiveSettings(meshState.physics);
              configureArmPhysicsForAnimation(meshRef.current, helperRef.current);
            }
          }
          setAnimationReady(true);
          animationReadyRef.current = true;
        };

        // Two frames so skeleton + mixer pose settle before Bullet reset.
        requestAnimationFrame(() => requestAnimationFrame(settlePhysics));

        const frameCount = Math.max(1, Math.ceil(clip.duration * MMD_FPS));
        onAnimationLoadedRef.current?.(frameCount, []);
      },
      (err) => {
        console.error('[MMD] VMD switch error:', err);
        setAnimationReady(true);
      }
    );
  }, [activeVmdIndex, animationReady, fileMap, vmdBlobUrls, loadVmdOntoMesh]);

  useEffect(() => {
    if (!helperRef.current || !meshRef.current) return;
    const physicsEnabled =
      isAmmoInitialized() &&
      !isAmmoPhysicsBroken() &&
      physicsMode !== 'off' &&
      physicsSimulation &&
      (physicsMode === 'anytime' ||
        (physicsMode === 'playtime' && isPlaying));
    helperRef.current.enable('physics', physicsEnabled);
    if (physicsEnabled && meshRef.current) {
      const meshState = getHelperMeshState(helperRef.current, meshRef.current);
      if (meshState?.physics) {
        applyPhysicsLiveSettings(meshState.physics);
        configureArmPhysicsForAnimation(meshRef.current, helperRef.current);
      }
    }
  }, [physicsMode, isPlaying, physicsSimulation]);

  useEffect(() => {
    if (!mesh || !helperRef.current) return;

    if (physicsDebugRef.current) {
      mesh.remove(physicsDebugRef.current);
      physicsDebugRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
      physicsDebugRef.current = null;
    }

    if (!displayBodies) return;

    const meshState = getHelperMeshState(helperRef.current, mesh);
    if (!meshState?.physics) return;

    const debugHelper = meshState.physics.createHelper();
    mesh.add(debugHelper);
    physicsDebugRef.current = debugHelper;
  }, [mesh, displayBodies]);

  useFrame((_, delta) => {
    const currentMesh = meshRef.current;
    if (!currentMesh || !helperRef.current) return;

    const helper = helperRef.current;
    const meshState = getHelperMeshState(helper, currentMesh);
    const hasLayerKeys = (animLayersRef.current ?? []).some((l) => l.keyframes.length > 0);
    const hasManualTimeline =
      timelineKeyframesRef.current.length > 0 || hasLayerKeys;
    const hasVmd =
      animationReadyRef.current && (vmdBlobUrlsRef.current?.length ?? 0) > 0;
    const templateLocksTimeline = Boolean(activeTemplateIdRef.current);
    const useVmdAnimation =
      hasVmd && vmdPlaybackEnabledRef.current && !templateLocksTimeline;
    const useTimelinePose = hasManualTimeline && !useVmdAnimation;
    const playing = isPlayingRef.current;
    const capturing = isRecordingCapture();
    const activeFrame = playing || capturing ? playheadRef.current : currentFrameRef.current;

    // When timeline owns the pose, make sure helper animation is off to prevent
    // VMD ghost pose blending with timeline keys.
    if (useTimelinePose && !useVmdAnimation) {
      helper.enable('animation', false);
    }

    const runPhysics =
      ammoReadyRef.current &&
      !isAmmoPhysicsBroken() &&
      physicsModeRef.current !== 'off' &&
      physicsSimulationRef.current &&
      (physicsModeRef.current === 'anytime' ||
        (physicsModeRef.current === 'playtime' && (playing || capturing)));
    // Cloth / hair / skirt — Bullet rigid bodies.
    const enablePhysics = runPhysics;

    helper.enable('physics', enablePhysics);
    helper.enable('ik', useVmdAnimation || !hasManualTimeline);
    helper.enable(
      'grant',
      useVmdAnimation || !hasManualTimeline || enablePhysics
    );

    if (useVmdAnimation) {
      const atStartRest =
        !playing && !capturing && activeFrame <= 0.05;
      if (atStartRest) {
        // STOP / idle at frame 0 → bind pose (T-pose), not VMD frame-0 dance pose.
        helper.enable('animation', false);
        restoreBindPose(currentMesh);
      } else {
        helper.enable('animation', true);
        const speedFactor = Math.max(0.001, playSpeedRef.current / MMD_FPS);
        const time = frameToTime(activeFrame, MMD_FPS);
        // Offline MP4 / paused scrub: helper-safe absolute seek.
        // Live (interactive) + Play: delta only — seek+update(0) freezes MMD pose.
        const offlineOrPausedScrub =
          (capturing && !isInteractiveRecordingCapture()) || (!playing && !capturing);
        if (offlineOrPausedScrub) {
          scrubMmdHelperToTime(helper, currentMesh, time);
        } else {
          helper.update(delta * speedFactor);
          currentMesh.skeleton?.update();
        }
      }
    } else {
      helper.enable('animation', false);
      // Don't call helper.update() — it leaves the mesh in the last VMD pose.
      // Timeline will apply its own pose below if useTimelinePose is true.
    }

    const root = rootGroupRef.current;
    if (root && capturing) {
      // Hold authored stage position/rotation while encoding — gizmos unmount
      // and camera systems must not leave the root at origin mid-render.
      const pos = modelPositionRef.current;
      root.position.set(pos.x, pos.y, pos.z);
      const rot = modelRotationRef.current;
      if (rot) {
        root.rotation.set(
          THREE.MathUtils.degToRad(rot.x),
          THREE.MathUtils.degToRad(rot.y),
          THREE.MathUtils.degToRad(rot.z)
        );
      }
    }
    if (root && !prevRootPositionRef.current.equals(root.position)) {
      prevRootPositionRef.current.copy(root.position);
      syncSkeletonBeforePhysics(currentMesh);
      if (meshState?.physics) {
        syncPhysicsAfterRootMove(currentMesh, meshState.physics);
      }
    }

    const vmdOwnsPose = useVmdAnimation;

    if (useTimelinePose) {
      const evaluated = evaluatePoseAtFrame(activeFrame);
      applyTimelineToSkinnedMesh(currentMesh, evaluated);
      syncSkeletonBeforePhysics(currentMesh);
    } else if (!useVmdAnimation && !playing && poseHoldRef.current) {
      const physWithDynamics = meshState?.physics as
        | { getDynamicBoneNames?: () => ReadonlySet<string> }
        | undefined;
      const skipBones = physWithDynamics?.getDynamicBoneNames
        ? collectDynamicBoneNames(currentMesh, () =>
            new Set(physWithDynamics.getDynamicBoneNames!())
          )
        : collectDynamicBoneNames(currentMesh);
      const holdPose: PoseSnapshotV1 = {
        ...poseHoldRef.current,
        morphs: {
          eyes: morphsRef.current.eyesBlink,
          mouth: morphsRef.current.mouthOpen,
          brow: morphsRef.current.browSad,
        },
      };
      applyPoseSnapshotToMesh(currentMesh, holdPose, {
        skipBoneNames: skipBones,
      });
      syncSkeletonBeforePhysics(currentMesh);
    } else if (!useVmdAnimation && !playing) {
      // No VMD, no timeline, not playing → restore rest pose so T-pose ghost disappears.
      const rest = currentMesh.userData.mmdRestPose as Record<string, [number, number, number]> | undefined;
      if (rest) {
        for (const bone of currentMesh.skeleton.bones) {
          const base = rest[bone.name];
          if (base) bone.rotation.set(base[0], base[1], base[2]);
        }
        currentMesh.skeleton.update();
      }
      if (enablePhysics) {
        updateMmdPoseSolvers(helper, currentMesh, {
          ik: !hasManualTimeline,
          grant: true,
        });
      }
    }

    // Pose first, then cloth sim (timeline or idle). VMD uses helper.update() above.
    if (enablePhysics && meshState?.physics && modelVisibleRef.current) {
      const simCloth =
        playing || physicsModeRef.current === 'anytime';
      if (simCloth && !useVmdAnimation) {
        updateMmdPoseSolvers(helper, currentMesh, {
          ik: !hasManualTimeline,
          grant: true,
        });
        syncSkeletonBeforePhysics(currentMesh);
        syncAllPhysicsBodiesFromBones(currentMesh, meshState.physics);
        const physT0 = performance.now();
        meshState.physics.update(delta);
        recordApisPhysicsFrame(sceneModelId, performance.now() - physT0);
        repairStretchedPhysicsBones(currentMesh, meshState.physics);
        applyStabilitySafetyLayer(meshState.physics);
        currentMesh.skeleton.update();
        apisRuntimeCostPass(
          sceneModelId,
          currentMesh,
          meshState.physics,
          playing,
          modelVisibleRef.current
        );
      } else if (!playing && !capturing && physicsModeRef.current === 'playtime') {
        sleepSoftBodiesWhenIdle(meshState.physics);
      }
    } else if (enablePhysics && meshState?.physics && useVmdAnimation) {
      applyStabilitySafetyLayer(meshState.physics);
    }

    apisHealFrameRef.current++;
    if (enablePhysics && meshState?.physics && apisHealFrameRef.current % 45 === 0) {
      const reg = {
        sceneModelId,
        mesh: currentMesh,
        helper,
        visible: modelVisibleRef.current,
        contentHash: contentFingerprint || sceneModelId,
        collisionGroupBit: collisionGroupBitRef.current ?? 1,
        getPhysics: () => meshState.physics,
        syncSkeleton: () => syncSkeletonBeforePhysics(currentMesh),
        restartPhysicsFull: () => buildMeshApi()?.restartPhysics(),
        ensurePhysicsEnabled: () => helper.enable('physics', true),
      };
      apisSelfHealCheck(sceneModelId, currentMesh, meshState.physics, reg);
    }

    const isGizmoDragging = gizmoDraggingRef?.current ?? false;
    const boneId = selectedBoneRef.current;
    const vmdPlaying = vmdOwnsPose && playing;
    if (isGizmoDragging && boneId && !vmdPlaying) {
      const bone = findBoneInSkeleton(currentMesh.skeleton, boneId);
      const rot = boneRotationRef.current;
      if (bone) {
        bone.rotation.x = (rot.x * Math.PI) / 180;
        bone.rotation.y = (rot.y * Math.PI) / 180;
        bone.rotation.z = (rot.z * Math.PI) / 180;
        syncSkeletonBeforePhysics(currentMesh);
        meshState?.ikSolver?.update();
      }
    }

    wasPlayingRef.current = playing;
  });

  if (loading) {
    return (
      <>
        <group
          ref={assignRootGroup}
          position={[modelPosition.x, modelPosition.y, modelPosition.z]}
          rotation={[THREE.MathUtils.degToRad(modelRotation.x), THREE.MathUtils.degToRad(modelRotation.y), THREE.MathUtils.degToRad(modelRotation.z)]}
        >
          {!hideStagingChrome && rootManipulatorActive && (
            <RootMarkerVisual onSelectRoot={onSelectRoot} />
          )}
          <mesh position={[0, 8, 0]}>
            <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#39c5bb" wireframe />
      </mesh>
        </group>
        {gizmoLayer}
      </>
    );
  }

  if (mesh && !loadError) {
    return (
      <>
        <group
          ref={assignRootGroup}
          visible={modelVisible}
          position={[modelPosition.x, modelPosition.y, modelPosition.z]}
          rotation={[THREE.MathUtils.degToRad(modelRotation.x), THREE.MathUtils.degToRad(modelRotation.y), THREE.MathUtils.degToRad(modelRotation.z)]}
        >
          {!hideStagingChrome && rootManipulatorActive && modelVisible && (
            <RootMarkerVisual onSelectRoot={onSelectRoot} />
          )}
          <primitive object={mesh} visible={modelVisible} />
          {showBonePickers && (
            <SkeletonBonePickers
              mesh={mesh}
              selectedBone={selectedBone}
              onSelectBone={onSelectBone}
            />
          )}
        </group>
        {gizmoLayer}
      </>
    );
  }

  return (
    <>
      <group
        ref={assignRootGroup}
        position={[modelPosition.x, modelPosition.y, modelPosition.z]}
          rotation={[THREE.MathUtils.degToRad(modelRotation.x), THREE.MathUtils.degToRad(modelRotation.y), THREE.MathUtils.degToRad(modelRotation.z)]}
      >
        {!hideStagingChrome && rootManipulatorActive && (
          <RootMarkerVisual onSelectRoot={onSelectRoot} />
        )}
    <ProceduralRig 
      fallbackUrl={url} 
      morphs={morphs} 
      selectedBone={selectedBone} 
      boneRotation={boneRotation} 
      fileMap={fileMap}
          gizmoDraggingRef={gizmoDraggingRef}
          onReady={(api) => {
            proceduralApiRef.current = {
              ...api,
              getRootMarker: () => rootGroupRef.current,
              syncPhysicsFromRoot: () => undefined,
              restartPhysics: () => undefined,
              setMaterialHighlight: () => undefined,
            };
            setProceduralReady(true);
            onModelReady?.(proceduralApiRef.current);
          }}
          showBonePickers={showBonePickers}
          onSelectBone={onSelectBone}
        />
      </group>
      {gizmoLayer}
    </>
  );
}

interface SkeletonBonePickersProps {
  mesh: THREE.SkinnedMesh;
  selectedBone: string;
  onSelectBone?: (boneId: string) => void;
}

function SkeletonBonePickers({ mesh, selectedBone, onSelectBone }: SkeletonBonePickersProps) {
  const bones = useMemo(() => getPickableSkeletonBones(mesh), [mesh]);
  const selectedTarget = useMemo(
    () => (selectedBone ? findBoneInSkeleton(mesh.skeleton, selectedBone) : null),
    [mesh, selectedBone]
  );

  return (
    <group>
      {bones.map((bone) => (
        <BonePickerSphere
          key={bone.uuid}
          bone={bone}
          isSelected={bone === selectedTarget || bone.name === selectedBone}
          onSelect={() => onSelectBone?.(bone.name)}
        />
      ))}
    </group>
  );
}

interface BonePickerSphereProps {
  bone: THREE.Bone;
  isSelected: boolean;
  onSelect: () => void;
}

function BonePickerSphere({ bone, isSelected, onSelect }: BonePickerSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      bone.getWorldPosition(meshRef.current.position);
    }
  });

  return (
    <mesh
      ref={meshRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <sphereGeometry args={[isSelected ? 0.45 : 0.28, 12, 12]} />
      <meshBasicMaterial
        color={isSelected ? '#fbbf24' : '#3b82f6'}
        wireframe
        transparent
        opacity={0.85}
        depthTest={false}
      />
    </mesh>
  );
}

interface ProceduralRigProps {
  fallbackUrl: string;
  morphs: MorphValues;
  selectedBone: string;
  boneRotation: BoneRotationValues;
  fileMap?: Record<string, string>;
  gizmoDraggingRef?: React.MutableRefObject<boolean>;
  onReady?: (api: MMDModelApi) => void;
  showBonePickers?: boolean;
  onSelectBone?: (boneId: string) => void;
}

function ProceduralRig({
  fallbackUrl,
  morphs,
  selectedBone,
  boneRotation,
  fileMap,
  gizmoDraggingRef,
  onReady,
  showBonePickers = false,
  onSelectBone,
}: ProceduralRigProps) {
  const isKizuna = fallbackUrl.toLowerCase().includes('kizuna');
  const isCustom = fallbackUrl.toLowerCase().includes('custom') || fallbackUrl.startsWith('blob:');
  
  const baseColor = isKizuna ? '#ff85a2' : isCustom ? '#b45309' : '#39c5bb';
  const hairColor = isKizuna ? '#ffa3ba' : isCustom ? '#1e1b4b' : '#1fb3a8';

  const morphsRef = useRef(morphs);
  const boneRotationRef = useRef(boneRotation);
  const selectedBoneRef = useRef(selectedBone);

  useEffect(() => {
    morphsRef.current = morphs;
  }, [morphs]);
  useEffect(() => {
    boneRotationRef.current = boneRotation;
  }, [boneRotation]);
  useEffect(() => {
    selectedBoneRef.current = selectedBone;
  }, [selectedBone]);

  const customTextures = React.useMemo(() => {
    if (!fileMap) return { hair: null as THREE.Texture | null, body: null as THREE.Texture | null };
    const loader = new THREE.TextureLoader();
    let hairTxt: THREE.Texture | null = null;
    let bodyTxt: THREE.Texture | null = null;

    for (const [key, val] of Object.entries(fileMap)) {
      const lower = key.toLowerCase();
      if (
        !hairTxt &&
        (lower.includes('hair') ||
          lower.includes('髪') ||
          lower.includes('face') ||
          lower.includes('head'))
      ) {
          hairTxt = loader.load(val);
        fixTexture(hairTxt);
      }
      if (
        !bodyTxt &&
        (lower.includes('body') ||
          lower.includes('clothes') ||
          lower.includes('服') ||
          lower.includes('cloth'))
      ) {
          bodyTxt = loader.load(val);
        fixTexture(bodyTxt);
      }
    }
    return { hair: hairTxt, body: bodyTxt };
  }, [fileMap]);

  const lTailRef = useRef<THREE.Group>(null);
  const rTailRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const lArmRef = useRef<THREE.Group>(null);
  const rArmRef = useRef<THREE.Group>(null);
  const neckRef = useRef<THREE.Group>(null);
  const rootRef = useRef<THREE.Group>(null);

  const boneMapRef = useRef<Record<string, THREE.Object3D>>({});

  useEffect(() => {
    boneMapRef.current = {
      head: headRef.current!,
      neck: neckRef.current!,
      arm_L: lArmRef.current!,
      arm_R: rArmRef.current!,
    };

    const api: MMDModelApi = {
      getMesh: () => null,
      resolveBone: (boneId: string) => boneMapRef.current[boneId] ?? null,
      getPickableBones: () => [],
      isProcedural: () => true,
      syncSkeleton: () => {
        rootRef.current?.updateMatrixWorld(true);
      },
      getRootMarker: () => rootRef.current,
      syncPhysicsFromRoot: () => {
        rootRef.current?.updateMatrixWorld(true);
      },
      restartPhysics: () => undefined,
      setMaterialHighlight: () => undefined,
    };
    onReady?.(api);
  }, [onReady]);

  useFrame((state) => {
    const cycle = state.clock.getElapsedTime() * 2.0;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const isGizmoDragging = gizmoDraggingRef?.current ?? false;

    if (lTailRef.current) lTailRef.current.rotation.z = Math.sin(cycle) * 0.12 + 0.28;
    if (rTailRef.current) rTailRef.current.rotation.z = -Math.sin(cycle) * 0.12 - 0.28;

    if (!isGizmoDragging) {
      const rot = boneRotationRef.current;
      const boneId = selectedBoneRef.current;

      if (boneId === 'head' && headRef.current) {
        headRef.current.rotation.set(toRad(rot.x), toRad(rot.y), toRad(rot.z));
      } else if (headRef.current && boneId !== 'head') {
      headRef.current.rotation.set(0, 0, 0);
    }

      if (boneId === 'neck' && neckRef.current) {
        neckRef.current.rotation.set(toRad(rot.x), toRad(rot.y), toRad(rot.z));
      } else if (neckRef.current && boneId !== 'neck') {
      neckRef.current.rotation.set(0, 0, 0);
    }

      if (boneId === 'arm_L' && lArmRef.current) {
        lArmRef.current.rotation.set(toRad(rot.x), toRad(rot.y), toRad(rot.z));
      } else if (lArmRef.current && boneId !== 'arm_L') {
      lArmRef.current.rotation.set(0, 0, -0.26);
    }

      if (boneId === 'arm_R' && rArmRef.current) {
        rArmRef.current.rotation.set(toRad(rot.x), toRad(rot.y), toRad(rot.z));
      } else if (rArmRef.current && boneId !== 'arm_R') {
      rArmRef.current.rotation.set(0, 0, 0.26);
      }
    }

    const currentMorphs = morphsRef.current;
    const scaleYEye = THREE.MathUtils.lerp(1.0, 0.08, currentMorphs.eyesBlink);
    const scaleYMouth = THREE.MathUtils.lerp(0.15, 1.8, currentMorphs.mouthOpen);
    const offsetBrow = THREE.MathUtils.lerp(0, -0.12, currentMorphs.browSad);

    if (headRef.current) {
      headRef.current.userData.__morphScaleEye = scaleYEye;
      headRef.current.userData.__morphScaleMouth = scaleYMouth;
      headRef.current.userData.__morphOffsetBrow = offsetBrow;
    }
  });

  const scaleYEye = THREE.MathUtils.lerp(1.0, 0.08, morphs.eyesBlink);
  const scaleYMouth = THREE.MathUtils.lerp(0.15, 1.8, morphs.mouthOpen);
  const offsetBrow = THREE.MathUtils.lerp(0, -0.12, morphs.browSad);

  const proceduralJoints: Array<{ id: string; ref: React.RefObject<THREE.Group>; pos: [number, number, number] }> = [
    { id: 'head', ref: headRef, pos: [0, 12.3, 0] },
    { id: 'neck', ref: neckRef, pos: [0, 10.5, 0] },
    { id: 'arm_L', ref: lArmRef, pos: [-1.8, 9.5, 0] },
    { id: 'arm_R', ref: rArmRef, pos: [1.8, 9.5, 0] },
  ];

  return (
    <group ref={rootRef} position={[0, 0, 0]}>
      <mesh castShadow receiveShadow position={[0, 8, 0]}>
        <cylinderGeometry args={[1.5, 2.5, 4, 16]} />
        <meshToonMaterial
          color={customTextures.body ? '#ffffff' : '#334455'}
          map={customTextures.body ?? undefined}
        />
      </mesh>
      
      <group ref={neckRef} position={[0, 10.5, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.5, 0.5, 1, 12]} />
          <meshToonMaterial color="#ffd8bd" />
        </mesh>

        <group ref={headRef} position={[0, 1.8, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[1.8, 32, 24]} />
            <meshToonMaterial color="#ffd9bd" />
          </mesh>

          <mesh position={[-0.6, 0.3, 1.6]} scale={[1, scaleYEye, 1]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshToonMaterial color={baseColor} />
          </mesh>
          <mesh position={[0.6, 0.3, 1.6]} scale={[1, scaleYEye, 1]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshToonMaterial color={baseColor} />
          </mesh>

          <mesh position={[0, -0.6, 1.65]} scale={[1, scaleYMouth, 1]}>
            <boxGeometry args={[0.4, 0.14, 0.1]} />
            <meshToonMaterial color="#f43f5e" />
          </mesh>

          <mesh position={[-0.65, 0.9 + offsetBrow, 1.6]} rotation={[0, 0, -0.06]}>
            <boxGeometry args={[0.5, 0.08, 0.08]} />
            <meshToonMaterial
              color={customTextures.hair ? '#ffffff' : hairColor}
              map={customTextures.hair ?? undefined}
            />
          </mesh>
          <mesh position={[0.65, 0.9 + offsetBrow, 1.6]} rotation={[0, 0, 0.06]}>
            <boxGeometry args={[0.5, 0.08, 0.08]} />
            <meshToonMaterial
              color={customTextures.hair ? '#ffffff' : hairColor}
              map={customTextures.hair ?? undefined}
            />
          </mesh>

          <group ref={lTailRef} position={[-1.7, 0.8, -0.4]}>
            <mesh position={[-1.2, -4, -0.6]} rotation={[0, 0, 0.25]}>
              <cylinderGeometry args={[0.3, 1, 8, 12]} />
              <meshToonMaterial
                color={customTextures.hair ? '#ffffff' : hairColor}
                map={customTextures.hair ?? undefined}
              />
            </mesh>
          </group>
          <group ref={rTailRef} position={[1.7, 0.8, -0.4]}>
            <mesh position={[1.2, -4, -0.6]} rotation={[0, 0, -0.25]}>
              <cylinderGeometry args={[0.3, 1, 8, 12]} />
              <meshToonMaterial
                color={customTextures.hair ? '#ffffff' : hairColor}
                map={customTextures.hair ?? undefined}
              />
            </mesh>
          </group>
        </group>
      </group>

      <group ref={lArmRef} position={[-1.8, 9.5, 0]} rotation={[0, 0, -0.26]}>
        <mesh position={[0, -1.8, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.28, 3.2, 12]} />
          <meshToonMaterial color="#ffd9bd" />
        </mesh>
      </group>
      <group ref={rArmRef} position={[1.8, 9.5, 0]} rotation={[0, 0, 0.26]}>
        <mesh position={[0, -1.8, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.28, 3.2, 12]} />
          <meshToonMaterial color="#ffd9bd" />
        </mesh>
      </group>

      {showBonePickers &&
        proceduralJoints.map((joint) => {
          const isSelected = joint.id === selectedBone;
          return (
            <mesh
              key={joint.id}
              position={joint.pos}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBone?.(joint.id);
              }}
            >
              <sphereGeometry args={[isSelected ? 0.45 : 0.28, 12, 12]} />
              <meshBasicMaterial
                color={isSelected ? '#fbbf24' : '#3b82f6'}
                wireframe
                transparent
                opacity={0.85}
                depthTest={false}
              />
        </mesh>
          );
        })}
    </group>
  );
}

export default React.memo(MMDModelWrapper);
