import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  createAssetBundleLoadingManager,
  normalizeBlobFetchUrl,
} from '../utils/mmdFiles';
import {
  frameCameraOnImportedModel,
  loadAssetModel,
} from '../utils/assetModelLoad';
import {
  applyImportedMaterialPipeline,
  applyWorldScaleToRoot,
  computeFbxWorldBounds,
  ensureImportedMeshesRenderable,
  findPrimarySkinnedMesh,
  normalizeImportedModel,
} from '../utils/assetModelPrep';
import { applyModelRenderPerfPolicy } from '../utils/modelRenderPerfPolicy';
import type { CharacterQuality, ViewportFormat } from '../types';
import { registerCharacterRoot } from '../scene/characterHeadRegistry';
import { frameToTime } from '../utils/animationSync';
import { MMD_FPS, playheadRef } from '../utils/playhead';
import {
  extractPmxBones,
  extractPmxMaterials,
  extractPmxMorphs,
} from '../editor/pmxMetadata';
import type { MMDModelApi } from './MMDModelWrapper';
import type { CharacterModelFormat, PmxBoneInfo, PmxMaterialInfo, PmxMorphInfo, TimelineKeyframe, AssetModelKind } from '../types';
import {
  applyTemplatePoseToMesh,
  attachSkinnedMeshToHelper,
  createSkinnedAnimationHelper,
  loadVmdClipForSkinnedMesh,
  prepareSkinnedMeshForMotion,
  updateSkinnedVmdPlayback,
} from '../utils/genericSkinnedMotion';
import type { TimelineLiveValues } from './TimelineLogic';
import { getDefaultLiveValues } from './TimelineLogic';
import { isRecordingCapture, isInteractiveRecordingCapture } from '../video/recordingCapture';
import type { MMDAnimationHelper } from 'three-stdlib';

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

interface FbxModelWrapperProps {
  sceneModelId?: string;
  modelVisible?: boolean;
  modelFormat?: CharacterModelFormat;
  modelFileName?: string;
  url: string;
  isPlaying: boolean;
  castShadow?: boolean;
  modelPosition: ModelPosition;
  modelRotation?: ModelRotation;
  customManager?: THREE.LoadingManager;
  fileMap?: Record<string, string>;
  currentFrame?: number;
  playSpeed?: number;
  vmdBlobUrls?: string[];
  hasVmdAnimation?: boolean;
  vmdPlaybackEnabled?: boolean;
  activeVmdIndex?: number;
  activeTemplateId?: string | null;
  timelineKeyframes?: TimelineKeyframe[];
  timelineLive?: TimelineLiveValues;
  vmdBoneRemap?: Record<string, string>;
  rootGizmoDraggingRef?: React.MutableRefObject<boolean>;
  rootManipulatorActive?: boolean;
  transformMode?: 'translate' | 'rotate';
  onModelReady?: (api: MMDModelApi | null) => void;
  onModelMove?: (x: number, y: number, z: number) => void;
  onModelRotate?: (x: number, y: number, z: number) => void;
  onSelectRoot?: () => void;
  onAnimationLoaded?: (frameCount: number) => void;
  onPmxMetadata?: (
    meta: {
      bones: PmxBoneInfo[];
      morphs: PmxMorphInfo[];
      materials: PmxMaterialInfo[];
    },
    mesh: THREE.SkinnedMesh
  ) => void;
  hideStagingChrome?: boolean;
  characterQuality?: CharacterQuality;
  viewportFormat?: ViewportFormat;
  materialDetailing?: boolean;
  materialSmoothing?: number;
  environmentIntensity?: number;
  assetKind?: AssetModelKind;
  /** User scale multiplier applied on top of import normalization. */
  worldScale?: number;
}

function SafeRootTransformControls({
  object,
  mode = 'translate',
  onDragStart,
  onDragEnd,
  onObjectChange,
}: {
  object: THREE.Object3D | null | undefined;
  mode?: 'translate' | 'rotate';
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onObjectChange?: () => void;
}) {
  const { camera, controls } = useThree();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!object) {
      setReady(false);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const wait = () => {
      if (cancelled) return;
      if (object.parent !== null) setReady(true);
      else raf = requestAnimationFrame(wait);
    };
    setReady(false);
    wait();
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
      space="world"
      size={1.1}
      camera={camera}
      onMouseDown={handleDragStart}
      onMouseUp={handleDragEnd}
      onObjectChange={onObjectChange}
    />
  );
}

function RootMarkerVisual({ onSelectRoot }: { onSelectRoot?: () => void }) {
  return (
    <group name="ImportedAssetRootMarker" position={[0, 0.02, 0]}>
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
    </group>
  );
}

function resolveImportFormat(
  modelFormat: CharacterModelFormat | undefined,
  modelFileName?: string,
  url?: string
): CharacterModelFormat {
  if (modelFormat && modelFormat !== 'mmd') return modelFormat;
  const hint = (modelFileName ?? url ?? '').toLowerCase();
  if (hint.includes('.obj')) return 'obj';
  if (hint.includes('.glb') || hint.includes('.gltf')) return 'gltf';
  return 'fbx';
}

export default function FbxModelWrapper({
  sceneModelId,
  modelVisible = true,
  modelFormat = 'fbx',
  modelFileName,
  url,
  isPlaying,
  castShadow = true,
  modelPosition,
  modelRotation = { x: 0, y: 0, z: 0 },
  customManager,
  fileMap,
  currentFrame = 0,
  playSpeed = 30,
  vmdBlobUrls,
  hasVmdAnimation = false,
  vmdPlaybackEnabled = true,
  activeVmdIndex = 0,
  activeTemplateId = null,
  timelineKeyframes = [],
  timelineLive,
  vmdBoneRemap,
  rootGizmoDraggingRef,
  rootManipulatorActive = true,
  transformMode = 'translate',
  onModelReady,
  onModelMove,
  onModelRotate,
  onSelectRoot,
  onAnimationLoaded,
  onPmxMetadata,
  hideStagingChrome = false,
  characterQuality = 'hd',
  viewportFormat = '16:9',
  materialDetailing = true,
  materialSmoothing = 0.55,
  environmentIntensity = 0.72,
  assetKind = 'character',
  worldScale = 1,
}: FbxModelWrapperProps) {
  const { camera, controls, invalidate, gl } = useThree();
  const [modelRoot, setModelRoot] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [rootNode, setRootNode] = useState<THREE.Group | null>(null);

  const rootGroupRef = useRef<THREE.Group>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const skinnedMeshRef = useRef<THREE.SkinnedMesh | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const mmdHelperRef = useRef<MMDAnimationHelper | null>(null);
  const vmdReadyRef = useRef(false);
  const gltfClipRef = useRef<THREE.AnimationClip | null>(null);

  const isPlayingRef = useRef(isPlaying);
  const currentFrameRef = useRef(currentFrame);
  const playSpeedRef = useRef(playSpeed);
  const vmdBlobUrlsRef = useRef(vmdBlobUrls);
  const vmdPlaybackEnabledRef = useRef(vmdPlaybackEnabled);
  const activeTemplateIdRef = useRef(activeTemplateId);
  const timelineKeyframesRef = useRef(timelineKeyframes);
  const timelineLiveRef = useRef<TimelineLiveValues>(
    timelineLive ?? getDefaultLiveValues([], { eyes: 0, mouth: 0, brow: 0 })
  );
  const hasVmdAnimationRef = useRef(hasVmdAnimation);
  const onModelReadyRef = useRef(onModelReady);
  const onAnimationLoadedRef = useRef(onAnimationLoaded);
  const onPmxMetadataRef = useRef(onPmxMetadata);
  const castShadowRef = useRef(castShadow);
  const characterQualityRef = useRef(characterQuality);
  const viewportFormatRef = useRef(viewportFormat);
  const assetKindRef = useRef(assetKind);
  const modelPositionRef = useRef(modelPosition);
  const modelRotationRef = useRef(modelRotation);

  const importFormat = resolveImportFormat(modelFormat, modelFileName, url);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
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
    vmdPlaybackEnabledRef.current = vmdPlaybackEnabled;
  }, [vmdPlaybackEnabled]);
  useEffect(() => {
    activeTemplateIdRef.current = activeTemplateId;
  }, [activeTemplateId]);
  useEffect(() => {
    timelineKeyframesRef.current = timelineKeyframes;
  }, [timelineKeyframes]);
  useEffect(() => {
    if (timelineLive) timelineLiveRef.current = timelineLive;
  }, [timelineLive]);
  useEffect(() => {
    hasVmdAnimationRef.current = hasVmdAnimation;
  }, [hasVmdAnimation]);
  useEffect(() => {
    onModelReadyRef.current = onModelReady;
  }, [onModelReady]);
  useEffect(() => {
    onAnimationLoadedRef.current = onAnimationLoaded;
  }, [onAnimationLoaded]);
  useEffect(() => {
    onPmxMetadataRef.current = onPmxMetadata;
  }, [onPmxMetadata]);
  useEffect(() => {
    castShadowRef.current = castShadow;
  }, [castShadow]);
  useEffect(() => {
    characterQualityRef.current = characterQuality;
    viewportFormatRef.current = viewportFormat;
  }, [characterQuality, viewportFormat]);
  useEffect(() => {
    assetKindRef.current = assetKind;
  }, [assetKind]);
  useEffect(() => {
    modelPositionRef.current = modelPosition;
    modelRotationRef.current = modelRotation;
  }, [modelPosition, modelRotation]);

  const applyMaterialPipeline = useCallback(
    (root: THREE.Object3D) => {
      applyImportedMaterialPipeline(root, {
        quality: characterQualityRef.current,
        renderer: gl,
        viewportFormat: viewportFormatRef.current,
        // MMD detailing on glTF often fights authored PBR and burns VRAM.
        materialDetailing: importFormat === 'gltf' ? false : materialDetailing,
        materialSmoothing,
        environmentIntensity,
        castShadow: castShadowRef.current,
        modelKind: assetKindRef.current,
      });
    },
    [gl, materialDetailing, materialSmoothing, environmentIntensity, importFormat]
  );

  useEffect(() => {
    const root = modelRootRef.current;
    if (!root) return;
    applyMaterialPipeline(root);
  }, [applyMaterialPipeline, modelRoot]);

  useEffect(() => {
    const root = modelRootRef.current;
    if (!root) return;
    applyModelRenderPerfPolicy(root, {
      castShadow,
      frustumCulled: false,
    });
  }, [castShadow, modelRoot]);

  const assignRootGroup = useCallback((node: THREE.Group | null) => {
    rootGroupRef.current = node;
    setRootNode(node);
  }, []);

  useEffect(() => {
    if (!sceneModelId) return;
    return registerCharacterRoot(sceneModelId, () => rootGroupRef.current);
  }, [sceneModelId]);

  useEffect(() => {
    const root = rootGroupRef.current;
    if (!root || rootGizmoDraggingRef?.current) return;
    root.position.set(modelPosition.x, modelPosition.y, modelPosition.z);
    root.rotation.set(
      THREE.MathUtils.degToRad(modelRotation.x),
      THREE.MathUtils.degToRad(modelRotation.y),
      THREE.MathUtils.degToRad(modelRotation.z)
    );
    invalidate();
  }, [modelPosition, modelRotation, rootGizmoDraggingRef, invalidate]);

  useEffect(() => {
    if (!modelRoot) return;
    applyWorldScaleToRoot(modelRoot, worldScale);
    invalidate();
  }, [modelRoot, worldScale, invalidate]);

  const disposeMmdHelper = useCallback(() => {
    const helper = mmdHelperRef.current;
    const mesh = skinnedMeshRef.current;
    if (helper && mesh) {
      try {
        helper.remove(mesh);
      } catch {
        /* already removed */
      }
    }
    mmdHelperRef.current = null;
    vmdReadyRef.current = false;
  }, []);

  const attachVmdAnimation = useCallback(
    async (skinned: THREE.SkinnedMesh, urlsOverride?: string[]) => {
      const urls = urlsOverride ?? vmdBlobUrlsRef.current;
      if (!urls?.length) return;

      disposeMmdHelper();
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      activeActionRef.current = null;

      try {
        prepareSkinnedMeshForMotion(skinned);
        const clip = await loadVmdClipForSkinnedMesh(
          skinned,
          urls,
          fileMap,
          vmdBoneRemap ?? {}
        );
        const helper = createSkinnedAnimationHelper();
        attachSkinnedMeshToHelper(helper, skinned, clip);
        mmdHelperRef.current = helper;
        vmdReadyRef.current = true;
        const frameCount = Math.max(1, Math.ceil(clip.duration * MMD_FPS));
        onAnimationLoadedRef.current?.(frameCount);
        invalidate();
      } catch (err) {
        console.error('[Import] VMD attach failed:', err);
        vmdReadyRef.current = false;
      }
    },
    [disposeMmdHelper, fileMap, vmdBoneRemap, invalidate]
  );

  useEffect(() => {
    if (!url) return;

    setLoading(true);
    setModelRoot(null);
    modelRootRef.current = null;
    skinnedMeshRef.current = null;
    mixerRef.current = null;
    activeActionRef.current = null;
    gltfClipRef.current = null;
    disposeMmdHelper();

    let alive = true;

    const manager =
      fileMap != null
        ? (customManager ?? createAssetBundleLoadingManager(fileMap))
        : (customManager ?? new THREE.LoadingManager());

    void loadAssetModel(importFormat, url, manager, fileMap, modelFileName)
      .then(async ({ root, animations, kind: detectedKind }) => {
        if (!alive) return;

        // Declared role (Environment Builder / Background import) wins over
        // filename heuristics — otherwise FBX warehouses normalize as characters
        // and end up the same height as the avatar.
        const kind = assetKindRef.current || detectedKind;

        const skinned = findPrimarySkinnedMesh(root);
        skinnedMeshRef.current = skinned;

        if (skinned) {
          prepareSkinnedMeshForMotion(skinned);
          skinned.frustumCulled = false;
          skinned.skeleton?.update();
          onPmxMetadataRef.current?.(
            {
              bones: extractPmxBones(skinned),
              morphs: extractPmxMorphs(skinned),
              materials: extractPmxMaterials(skinned),
            },
            skinned
          );
        }

        root.traverse((child) => {
          child.userData.assetKind = kind;
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).frustumCulled = false;
            if (kind === 'stage') {
              child.userData.shotComposerRole = 'raycast';
            }
          }
        });
        root.userData.assetKind = kind;
        if (kind === 'stage') root.userData.shotComposerRole = 'raycast';

        const pendingVmd = (vmdBlobUrlsRef.current?.length ?? 0) > 0;

        if (!pendingVmd && animations.length > 0) {
          gltfClipRef.current = animations[0]!;
          const mixer = new THREE.AnimationMixer(root);
          const action = mixer.clipAction(animations[0]!);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = false;
          action.play();
          action.paused = true;
          // Sample bind/first frame so skinned GLB isn't stuck in a zeroed pose.
          action.time = 0;
          mixer.update(0);
          skinned?.skeleton?.update();
          root.updateMatrixWorld(true);

          mixerRef.current = mixer;
          activeActionRef.current = action;
          const frameCount = Math.max(1, Math.round(animations[0]!.duration * MMD_FPS));
          onAnimationLoadedRef.current?.(frameCount);
        } else {
          skinned?.skeleton?.update();
          root.updateMatrixWorld(true);
        }

        // Scale/center after pose sample — cloth-heavy GLBs need stable skeleton bounds.
        normalizeImportedModel(root, kind);

        if (!alive) return;

        applyMaterialPipeline(root);
        ensureImportedMeshesRenderable(root);

        modelRootRef.current = root;
        setModelRoot(root);
        setLoading(false);

        const debugBox = computeFbxWorldBounds(root);
        if (!debugBox.isEmpty()) {
          const sized = debugBox.getSize(new THREE.Vector3());
          console.info(
            `[Import:${importFormat}] kind=${kind} (assetKind=${assetKindRef.current}, detected=${detectedKind}) ~${sized.y.toFixed(1)}u tall, ${sized.x.toFixed(1)}×${sized.z.toFixed(1)} footprint`
          );
        }

        frameCameraOnImportedModel(camera, controls, root, kind);
        // Orbit/portrait systems can overwrite framing on the same tick — re-apply next frame.
        requestAnimationFrame(() => {
          if (!alive || modelRootRef.current !== root) return;
          frameCameraOnImportedModel(camera, controls, root, kind);
          invalidate();
        });

        onModelReadyRef.current?.({
          getMesh: () => skinnedMeshRef.current,
          resolveBone: (boneId: string) => {
            const mesh = skinnedMeshRef.current;
            if (!mesh?.skeleton) return null;
            return (
              mesh.skeleton.bones.find(
                (b) => b.name === boneId || b.name.toLowerCase() === boneId.toLowerCase()
              ) ?? null
            );
          },
          getPickableBones: () => skinnedMeshRef.current?.skeleton?.bones ?? [],
          isProcedural: () => false,
          syncSkeleton: () => skinnedMeshRef.current?.skeleton?.update(),
          getRootMarker: () => rootGroupRef.current,
          syncPhysicsFromRoot: () => undefined,
          restartPhysics: () => undefined,
          setMaterialHighlight: () => undefined,
        });

        invalidate();
        requestAnimationFrame(() => invalidate());
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : String(err ?? 'Model load failed');
        console.error(`[Import:${importFormat}] Load failed:`, err);
        try {
          window.dispatchEvent(
            new CustomEvent('animastage:toast', {
              detail: { message, durationMs: 7000 },
            })
          );
        } catch {
          /* ignore */
        }
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      disposeMmdHelper();
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      activeActionRef.current = null;
      gltfClipRef.current = null;
      if (modelRootRef.current) {
        modelRootRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => m?.dispose());
          }
        });
      }
      modelRootRef.current = null;
      skinnedMeshRef.current = null;
      onModelReadyRef.current?.(null);
    };
  }, [
    url,
    fileMap,
    customManager,
    camera,
    controls,
    invalidate,
    importFormat,
    modelFileName,
    attachVmdAnimation,
    disposeMmdHelper,
    applyMaterialPipeline,
  ]);

  useEffect(() => {
    const mesh = skinnedMeshRef.current;
    if (!mesh || !modelRoot) return;
    const urls = vmdBlobUrls;
    if (!urls?.length) {
      disposeMmdHelper();
      return;
    }
    const index = Math.min(
      Math.max(0, activeVmdIndex ?? urls.length - 1),
      urls.length - 1
    );
    void attachVmdAnimation(mesh, [urls[index]!]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- join key stabilizes array identity
  }, [
    (vmdBlobUrls ?? []).join('\0'),
    activeVmdIndex,
    modelRoot,
    attachVmdAnimation,
    disposeMmdHelper,
  ]);

  useEffect(() => {
    const mesh = skinnedMeshRef.current;
    if (!mesh || timelineKeyframes.length === 0) return;
    const hasVmd = (vmdBlobUrls?.length ?? 0) > 0 && hasVmdAnimation;
    if (hasVmd && vmdPlaybackEnabled && !activeTemplateId) return;
    const frame = isPlaying ? playheadRef.current : currentFrame;
    applyTemplatePoseToMesh(mesh, timelineKeyframes, frame, timelineLiveRef.current);
    invalidate();
  }, [
    timelineKeyframes,
    activeTemplateId,
    currentFrame,
    isPlaying,
    vmdPlaybackEnabled,
    vmdBlobUrls,
    hasVmdAnimation,
    invalidate,
  ]);

  useFrame((_, delta) => {
    if (isRecordingCapture()) {
      const root = rootGroupRef.current;
      if (root) {
        const pos = modelPositionRef.current;
        const rot = modelRotationRef.current;
        root.position.set(pos.x, pos.y, pos.z);
        root.rotation.set(
          THREE.MathUtils.degToRad(rot.x),
          THREE.MathUtils.degToRad(rot.y),
          THREE.MathUtils.degToRad(rot.z)
        );
      }
    }

    const mesh = skinnedMeshRef.current;
    const mixer = mixerRef.current;
    const action = activeActionRef.current;

    // Static GLB (no skin) still needs mixer updates when playing embedded clips.
    if (!mesh && mixer && action) {
      const playing = isPlayingRef.current;
      action.paused = !playing;
      if (playing) mixer.update(delta);
      else {
        action.time = Math.min(
          frameToTime(currentFrameRef.current, playSpeedRef.current),
          action.getClip().duration
        );
        mixer.update(0);
      }
      invalidate();
      return;
    }

    if (!mesh) return;

    const playing = isPlayingRef.current;
    const capturing = isRecordingCapture();
    const activeFrame = playing || capturing ? playheadRef.current : currentFrameRef.current;
    const templateLocksTimeline = Boolean(activeTemplateIdRef.current);
    const hasTimeline = timelineKeyframesRef.current.length > 0;
    const hasVmd =
      vmdReadyRef.current &&
      (vmdBlobUrlsRef.current?.length ?? 0) > 0 &&
      hasVmdAnimationRef.current;
    const useVmd = hasVmd && vmdPlaybackEnabledRef.current && !templateLocksTimeline;
    const useTimeline = hasTimeline && !useVmd;

    const helper = mmdHelperRef.current;
    if (useVmd && helper) {
      helper.enable('animation', true);
      // Offline encode: scrub. Live + Play: delta (interactive capture).
      const offlineScrub = capturing && !isInteractiveRecordingCapture();
      updateSkinnedVmdPlayback(helper, mesh, {
        playing,
        frame: activeFrame,
        playSpeed: playSpeedRef.current,
        delta,
        scrub: offlineScrub || !playing,
      });
    } else if (helper) {
      helper.enable('animation', false);
    }

    if (useTimeline) {
      if (activeActionRef.current) activeActionRef.current.paused = true;
      applyTemplatePoseToMesh(mesh, timelineKeyframesRef.current, activeFrame, timelineLiveRef.current);
    } else if (!useVmd) {
      const mixer = mixerRef.current;
      const action = activeActionRef.current;
      if (mixer && action) {
        action.paused = !playing;
        if (playing) {
          mixer.update(delta);
        } else {
          const t = frameToTime(activeFrame, playSpeedRef.current);
          action.time = Math.min(t, action.getClip().duration);
          mixer.update(0);
        }
      }
    }

    invalidate();
  });

  const gizmoLayer =
    hideStagingChrome || !rootManipulatorActive ? null : (
      <SafeRootTransformControls
        object={rootNode}
        mode={transformMode}
        onDragStart={() => {
          if (rootGizmoDraggingRef) rootGizmoDraggingRef.current = true;
        }}
        onDragEnd={() => {
          if (rootGizmoDraggingRef) rootGizmoDraggingRef.current = false;
        }}
        onObjectChange={() => {
          if (!rootGroupRef.current) return;
          if (transformMode === 'translate') {
            onModelMove?.(
              rootGroupRef.current.position.x,
              rootGroupRef.current.position.y,
              rootGroupRef.current.position.z
            );
          } else {
            onModelRotate?.(
              THREE.MathUtils.radToDeg(rootGroupRef.current.rotation.x),
              THREE.MathUtils.radToDeg(rootGroupRef.current.rotation.y),
              THREE.MathUtils.radToDeg(rootGroupRef.current.rotation.z)
            );
          }
          invalidate();
        }}
      />
    );

  return (
    <>
      <group
        ref={assignRootGroup}
        visible={modelVisible}
        position={[modelPosition.x, modelPosition.y, modelPosition.z]}
        rotation={[
          THREE.MathUtils.degToRad(modelRotation.x),
          THREE.MathUtils.degToRad(modelRotation.y),
          THREE.MathUtils.degToRad(modelRotation.z),
        ]}
      >
        {!hideStagingChrome && rootManipulatorActive && modelVisible && (
          <RootMarkerVisual onSelectRoot={onSelectRoot} />
        )}
        {loading && (
          <mesh position={[0, 8, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#6366f1" wireframe />
          </mesh>
        )}
        {modelRoot && <primitive object={modelRoot} />}
      </group>
      {gizmoLayer}
    </>
  );
}
