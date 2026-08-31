/** One-click Create Shot pipeline. */
import type { CameraSnapshot, MMDModel, ViewportFormat } from '../types';
import { analyzeComposition, buildShotCameraSnapshot } from './framing';
import { resolveCharacterYawDeg } from './orientation';
import { getShotCameraPreset, getShotPreset } from './presets';
import { resolveCharacterHeight } from './scale';
import type {
  CharacterOrientMode,
  CharacterScaleMode,
  CompositionWarning,
  FramingFocus,
  ShotAnchor,
  ShotCameraPresetId,
  ShotComposerState,
  ShotPresetId,
} from './types';

export interface CreateShotInput {
  character: MMDModel;
  aspect: ViewportFormat;
  shotPreset: ShotPresetId;
  cameraPreset?: ShotCameraPresetId;
  scaleMode: CharacterScaleMode;
  customHeight: number;
  orientMode: CharacterOrientMode;
  framingFocus: FramingFocus;
  keepUpright: boolean;
  measuredHeight?: number | null;
  /** Current live camera position (for face_camera). */
  liveCameraPosition?: [number, number, number];
}

export interface CreateShotResult {
  camera: CameraSnapshot;
  characterRotation: { rotationX: number; rotationY: number; rotationZ: number };
  characterHeight: number;
  warnings: CompositionWarning[];
  aspect: ViewportFormat;
  shotPreset: ShotPresetId;
  feet: [number, number, number];
}

export function createShot(input: CreateShotInput): CreateShotResult {
  const camPreset = input.cameraPreset ? getShotCameraPreset(input.cameraPreset) : null;
  const shotPreset = input.shotPreset || camPreset?.shotPreset || 'full_body';
  const aspect = input.aspect || camPreset?.aspect || '16:9';
  const height = resolveCharacterHeight(
    input.scaleMode,
    input.customHeight,
    input.measuredHeight
  );
  const feet: [number, number, number] = [
    input.character.positionX,
    input.character.positionY,
    input.character.positionZ,
  ];

  const camera = buildShotCameraSnapshot({
    feet,
    height,
    aspect,
    shotPreset,
    framingFocus: input.framingFocus || getShotPreset(shotPreset).framing,
  });

  const characterRotation = resolveCharacterYawDeg(input.orientMode, {
    currentYaw: input.character.rotationY ?? 0,
    cameraPosition: input.liveCameraPosition ?? camera.position,
    characterFeet: feet,
    keepUpright: input.keepUpright,
  });

  const warnings = analyzeComposition({ feet, height, aspect, shotPreset }, camera);

  return {
    camera,
    characterRotation,
    characterHeight: height,
    warnings,
    aspect,
    shotPreset,
    feet,
  };
}

export function makeShotAnchor(
  name: string,
  state: ShotComposerState,
  character: MMDModel,
  camera: CameraSnapshot
): ShotAnchor {
  return {
    id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    createdAt: Date.now(),
    characterId: character.id,
    characterPosition: [character.positionX, character.positionY, character.positionZ],
    characterRotationY: character.rotationY ?? 0,
    characterScale: character.worldScale ?? 1,
    camera,
    target: [...camera.target] as [number, number, number],
    aspect: state.aspect,
    shotPreset: state.shotPreset,
    cameraPreset: state.cameraPreset,
    environmentAnchor: state.envAnalysis?.center,
  };
}
