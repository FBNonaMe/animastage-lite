import type { AppState, CameraSnapshot, CharacterQuality, PhysicsMode } from '../types';

export type SmartStudioMode = 'showcase' | 'photo' | 'video';

export type SmartGpuTier = 'ultra' | 'high' | 'medium' | 'balanced' | 'performance';

export type SmartCameraPreset =
  | 'portrait'
  | 'half_body'
  | 'full_body'
  | 'hero'
  | 'close_face'
  | 'anime'
  | 'orbit'
  | 'dynamic';

export type SmartPhotoPreset =
  | 'portrait'
  | 'anime_poster'
  | 'wallpaper'
  | 'full_body'
  | 'close_face'
  | 'album_cover'
  | 'vertical'
  | 'horizontal'
  | 'square';

export type SmartVideoPreset =
  | 'tiktok'
  | 'youtube_shorts'
  | 'instagram_reels'
  | 'youtube'
  | 'x'
  | 'discord'
  | 'landscape'
  | 'portrait'
  | 'square';

export type SmartVideoPath =
  | 'hero_orbit'
  | 'face_reveal'
  | 'vertical_lift'
  | 'slow_dolly'
  | 'circle_shot'
  | 'shoulder'
  | 'side_tracking'
  | 'orbit_360'
  | 'anime_intro'
  | 'game_trailer';

export type SmartExpressionId =
  | 'smile'
  | 'neutral'
  | 'cute'
  | 'happy'
  | 'serious'
  | 'idle';

export type SmartBackgroundId =
  | 'studio'
  | 'temple'
  | 'cyberpunk'
  | 'night'
  | 'sunset'
  | 'transparent'
  | 'white_studio';

export interface SceneProfile {
  modelCount: number;
  hasAnimation: boolean;
  hasCameraVmd: boolean;
  hasPhysics: boolean;
  hasClothPhysics: boolean;
  hasHairPhysics: boolean;
  morphCount: number;
  boneCount: number;
  umceCompatibility: number | null;
  formatHint: string | null;
  characterHeightHint: 'short' | 'average' | 'tall';
  stageSize: 'solo' | 'duo' | 'group';
  gpuTier: SmartGpuTier;
  selectedModelId: string | null;
  selectedModelName: string | null;
}

export interface SmartReportLine {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'info';
}

export interface SmartStudioReport {
  readyAt: number;
  mode: SmartStudioMode;
  lines: SmartReportLine[];
  cameraPreset: SmartCameraPreset;
  background: SmartBackgroundId;
  expression: SmartExpressionId;
  qualityLabel: string;
  fpsTarget: number;
}

export interface SmartStudioSnapshot {
  visualFx: AppState['visualFx'];
  characterQuality: CharacterQuality;
  physicsMode: PhysicsMode;
  cameraMode: AppState['cameraMode'];
  cameraStudio: AppState['cameraStudio'];
  cameraKeyframes: AppState['cameraKeyframes'];
  isPlaying: boolean;
  currentFrame: number;
  rtxModeEnabled: boolean;
  models: Array<{
    id: string;
    morphs: AppState['models'][number]['morphs'];
    poseHold: AppState['models'][number]['poseHold'];
    vmdPlaybackEnabled: AppState['models'][number]['vmdPlaybackEnabled'];
    activeTemplateId: AppState['models'][number]['activeTemplateId'];
  }>;
}

export interface SmartStudioPatch {
  visualFx: AppState['visualFx'];
  characterQuality: CharacterQuality;
  physicsMode: PhysicsMode;
  cameraMode: AppState['cameraMode'];
  cameraStudio: Partial<AppState['cameraStudio']>;
  cameraKeyframes?: AppState['cameraKeyframes'];
  isPlaying: boolean;
  currentFrame: number;
  rtxModeEnabled: boolean;
  modelMorphs?: Record<string, AppState['models'][number]['morphs']>;
  applyIdleTemplate?: boolean;
  cameraSnapshot?: CameraSnapshot;
  productCameraMode?: 'follow' | 'duo' | 'orbit' | 'closeUp';
  videoPath?: SmartVideoPath;
  photoPreset?: SmartPhotoPreset;
  videoPreset?: SmartVideoPreset;
  viewportFormat?: '16:9' | '9:16';
}

export type SmartStudioPhase =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'photo'
  | 'recording'
  | 'settings'
  | 'animations';

export interface SmartStudioState {
  active: boolean;
  mode: SmartStudioMode | null;
  phase: SmartStudioPhase;
  profile: SceneProfile | null;
  report: SmartStudioReport | null;
  /** When false, readiness card is hidden (OK dismissed). */
  reportVisible: boolean;
  cameraPreset: SmartCameraPreset;
  photoPreset: SmartPhotoPreset;
  videoPreset: SmartVideoPreset;
  videoPath: SmartVideoPath;
  expression: SmartExpressionId;
  background: SmartBackgroundId;
  hideEditorChrome: boolean;
  activeAnimationId: string | null;
  activeAnimationLabel: string | null;
  statusMessage: string | null;
}
