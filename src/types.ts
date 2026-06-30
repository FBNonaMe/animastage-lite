import type { RtxSettings } from './utils/rtxSettings';
import type { PoseSnapshotV1 } from './pose/poseTypes';

export type PhysicsMode = 'anytime' | 'playtime' | 'off';

export type CameraMode = 'free' | 'mmd';

/** Single character vs center-framed duo/group. */
export type CameraFramingMode = 'single' | 'duo';

export interface CameraKeyframe {
  id: string;
  frame: number;
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
}

export interface CameraSnapshot {
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
  target: [number, number, number];
}

/** Timeline tracks for morphs + simplified body bones. */
export type TimelineTrackId =
  | 'morph_eyes'
  | 'morph_mouth'
  | 'morph_brow'
  | 'bone_head_y'
  | 'bone_neck_x'
  | 'bone_spine_y'
  | 'bone_spine_z'
  | 'bone_waist_y'
  | 'bone_l_arm_x'
  | 'bone_l_arm_z'
  | 'bone_r_arm_x'
  | 'bone_r_arm_z';

export type TimelineActiveTrack = TimelineTrackId | 'camera' | null;

/** How applying a template affects existing timeline keys. */
export type TemplateApplyMode = 'merge' | 'replace';

export type KeyframeInterpolation = 'linear' | 'bezier';

export interface TimelineKeyframe {
  id: string;
  frame: number;
  track: TimelineTrackId;
  value: number;
  /** Easing between this key and the next (reze-style curve editor). */
  interpolation?: KeyframeInterpolation;
  /** Bézier handle strength 0–1 (outgoing). */
  easeOut?: number;
  /** Bézier handle strength 0–1 (incoming on next segment). */
  easeIn?: number;
}

export interface PmxBoneInfo {
  name: string;
  parentName: string | null;
  depth: number;
}

export interface PmxMorphInfo {
  name: string;
  index: number;
  kind: 'vertex' | 'bone' | 'uv' | 'material' | 'flip' | 'group' | 'other';
}

export interface PmxMaterialInfo {
  name: string;
  index: number;
}

export interface BoneGroupDef {
  id: string;
  name: string;
  boneNames: string[];
  muted: boolean;
  solo: boolean;
}

export interface AnimationLayerDef {
  id: string;
  name: string;
  weight: number;
  keyframes: TimelineKeyframe[];
  muted: boolean;
  boneMask: string[] | null;
}

/** @deprecated Use TimelineKeyframe[] on MMDModel instead. */
export interface KeyframeData {
  frame: number;
  value: number;
}

export interface MorphState {
  eyes: number; // 0 to 1
  mouth: number; // 0 to 1
  brow: number;  // 0 to 1
}

export interface BoneState {
  id: string;
  name: string;
  rotationX: number; // degrees or radians
  rotationY: number;
  rotationZ: number;
}

export interface MMDModel {
  id: string;
  name: string;
  type: 'pmx' | 'pmd' | 'miku' | 'kizuna' | 'custom';
  visible: boolean;
  morphs: MorphState;
  bones: BoneState[];
  positionX: number;
  positionY: number;
  positionZ: number;
  keyframes: TimelineKeyframe[];
  blobUrl?: string;
  modelFileName?: string;
  customManager?: any; // THREE.LoadingManager
  fileMap?: Record<string, string>; // Maps file paths (e.g. textures/hair.png) to Blob URLs
  vmdBlobUrls?: string[];
  vmdFileNames?: string[];
  /** Which loaded .vmd drives motion (index into vmdBlobUrls). */
  activeVmdIndex?: number;
  /** Last applied timeline motion template (animationTemplates). */
  activeTemplateId?: string | null;
  hasVmdAnimation?: boolean;
  /** When false, timeline templates / keyframes drive the model instead of loaded .vmd */
  vmdPlaybackEnabled?: boolean;
  /** PMX skeleton / morphs (filled after load). */
  pmxBones?: PmxBoneInfo[];
  pmxMorphs?: PmxMorphInfo[];
  pmxMaterials?: PmxMaterialInfo[];
  /** Reze-style layers (top layer weight blends over base keyframes). */
  animLayers?: AnimationLayerDef[];
  boneGroups?: BoneGroupDef[];
  /** Editor document changed since last export/save. */
  clipDirty?: boolean;
  /** Pose library preview — held while paused (does not override VMD/timeline during play). */
  poseHold?: PoseSnapshotV1 | null;
  activePoseId?: string | null;
  /** PMX/PMD validation report (textures, performance). */
  modelAnalysis?: import('./analyzer/types').ModelAnalysisReport | null;
  /** Fingerprint for duplicate detection (filename + byte size). */
  contentFingerprint?: string;
}

export interface SceneObject {
  id: string;
  name: string;
  type: 'model' | 'camera' | 'light';
  visible: boolean;
}

/** Viewport framing for landscape editor vs vertical Shorts/TikTok capture. */
export type ViewportFormat = '16:9' | '9:16';

/** Custom image plate behind the character (Shorts / TikTok). */
export interface SceneBackgroundSettings {
  imageUrl: string | null;
  opacity: number;
}

/** Character mesh / texture fidelity (viewport + export). */
export type CharacterQuality = 'standard' | 'hd' | 'uhd4k';

export type RenderTier = 'lite' | 'pro';

export type ScenePresetId =
  | 'studio'
  | 'warehouse'
  | 'sunset'
  | 'nightclub'
  | 'cyber'
  | 'stage'
  | 'outdoor';

export type LightPresetId =
  | 'natural'
  | 'rim'
  | 'concert'
  | 'spotlight'
  | 'neon'
  | 'anime';

export type ColorGradePresetId =
  | 'neutral'
  | 'cinematic'
  | 'anime'
  | 'vaporwave'
  | 'warm'
  | 'cold'
  | 'noir';

export type LookPresetId =
  | 'cinematic'
  | 'anime'
  | 'neon_club'
  | 'portrait'
  | 'concert'
  | 'cyber';

export type ParticlePresetId =
  | 'none'
  | 'snow'
  | 'sparkles'
  | 'petals'
  | 'confetti'
  | 'dust'
  | 'fireflies';

/** mmd_rtx.html weather presets */
export type WeatherPresetId = 'clear' | 'rain' | 'storm' | 'fog' | 'snow';

export type CameraOrbitPresetId =
  | 'manual'
  | 'orbit360'
  | 'orbit180'
  | 'orbit180_slow'
  | 'face_portrait'
  | 'full_body'
  | 'dramatic_bloom'
  | 'hero_low';

export type CameraFocusTarget = 'face' | 'body' | 'full';

export interface CameraStudioSettings {
  autoFocus: boolean;
  focusTarget: CameraFocusTarget;
  modestAngle: boolean;
  orbitPreset: CameraOrbitPresetId;
  orbitSpeed: number;
  backgroundImageUrl: string | null;
  backgroundOpacity: number;
  backgroundBlur: number;
  liveOrbit: boolean;
  /** When true, auto-framing is off — orbit controls stay where you place them. */
  manualCameraLock?: boolean;
}

export interface VisualFxSettings {
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  vignetteEnabled: boolean;
  vignetteIntensity: number;
  dofEnabled: boolean;
  dofFocusDistance: number;
  dofFocalLength?: number;
  dofBokehScale: number;
  chromaticAberration: number;
  colorGrade: ColorGradePresetId;
  scenePreset: ScenePresetId;
  lightPreset: LightPresetId;
  particlesEnabled: boolean;
  particlePreset: ParticlePresetId;
  particleIntensity: number;
  environmentIntensity: number;
  floorReflection: number;
  aoIntensity: number;
  /** Renderer exposure multiplier (lower = less white blow-out). */
  toneExposure?: number;
  /** mmd_rtx weather */
  weatherPreset?: WeatherPresetId;
  precipIntensity?: number;
  wetness?: number;
  snowGround?: number;
  /** Master switch for lite EffectComposer stack */
  postFxStackEnabled?: boolean;
  /** SSAO lite (half-res by default) */
  ssaoEnabled?: boolean;
  ssaoIntensity?: number;
  ssaoRadius?: number;
  ssaoHalfRes?: boolean;
  /** SMAA as TAA-lite */
  smaaEnabled?: boolean;
  /** God rays / volumetric lite */
  godRaysEnabled?: boolean;
  godRaysSamples?: number;
  godRaysDensity?: number;
  godRaysDecay?: number;
  bloomRadius?: number;
  rtxBloomLite?: number;
  /** 2.39:1 cinematic bars */
  letterbox239?: boolean;
  /** Skin smoothing + env detailing pass */
  materialDetailing?: boolean;
  materialSmoothing?: number;
}

export interface SceneHdrSettings {
  blobUrl: string | null;
  fileName?: string | null;
  intensity: number;
  showBackground: boolean;
}

/** Path tracer lab sliders (UI + PathTracerBridge). */
export interface PathTracerSettings {
  bounces: number;
  sunAltDeg: number;
  exposure: number;
  aperture: number;
}

export const DEFAULT_PATH_TRACER_SETTINGS: PathTracerSettings = {
  bounces: 3,
  sunAltDeg: 25,
  exposure: 1,
  aperture: 0,
};

/** Lite tuning from mmd_rtx / mmd-character-motion (Bullet hair/skirt, wind, opacity). */
export interface MmdLiteConfig {
  stablePhys: boolean;
  physicsGravity: number;
  physicsSwing: number;
  physicsWind: number;
  modelOpacity: number;
  freezeTwistBones: boolean;
}

export const DEFAULT_MMD_LITE_CONFIG: MmdLiteConfig = {
  stablePhys: true,
  physicsGravity: 1.0,
  physicsSwing: 0,
  physicsWind: 0,
  modelOpacity: 1,
  freezeTwistBones: false,
};

export interface AppState {
  objects: SceneObject[];
  models: MMDModel[];
  selectedObjectId: string | null;
  selectedBoneId: string | null; // e.g., "head", "arm_L", "arm_R"
  currentFrame: number;
  maxFrames: number;
  isPlaying: boolean;
  physicsMode: PhysicsMode;
  mmdLite: MmdLiteConfig;
  playSpeed: number; // frames per second or ratio
  timelineActiveTrack: TimelineActiveTrack;
  cameraMode: CameraMode;
  cameraKeyframes: CameraKeyframe[];
  /** Orbit center when camera keyframes were applied — paths track live focus from this point. */
  cameraOrbitAnchor?: [number, number, number];
  cameraVmdBlobUrl?: string | null;
  cameraVmdFileName?: string | null;
  hasCameraVmd?: boolean;
  visualFx: VisualFxSettings;
  sceneBackground: SceneBackgroundSettings;
  /** Default HD — sharper than anime outline without full RTX stack. */
  characterQuality: CharacterQuality;
  /** RTX-style stack: AO + grade (no heavy DOF by default). */
  rtxModeEnabled: boolean;
  rtxSettings: RtxSettings;
  /** WebGL lite vs path-tracer pro (optional panels / export). */
  renderTier: RenderTier;
  cameraStudio: CameraStudioSettings;
  sceneHdr: SceneHdrSettings;
  pathTracerLabEnabled?: boolean;
  pathTracer?: PathTracerSettings;
}

export type { RtxSettings, RtxAoQuality } from './utils/rtxSettings';
