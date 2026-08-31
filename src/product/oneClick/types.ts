import type { QualityMode } from '../scene/types';
import type { SmartGpuTier } from '../../smartStudio/types';
import type { SocialPlatformId } from '../../smartMetadata/types';

export type OneClickStep = 'character' | 'motion' | 'style' | 'export' | 'complete';

export type MotionCategoryId =
  | 'trending'
  | 'popular'
  | 'dance'
  | 'cute'
  | 'idle'
  | 'action'
  | 'concert'
  | 'walk'
  | 'run'
  | 'pose'
  | 'favorites'
  | 'recent';

export type MotionDifficulty = 'easy' | 'medium' | 'hard';
export type MotionCompatibility = 'all' | 'humanoid' | 'mmd';
export type MotionPerfEstimate = 'light' | 'balanced' | 'heavy';

export interface MotionLibraryEntry {
  id: string;
  templateId: string;
  name: string;
  description: string;
  categories: MotionCategoryId[];
  durationSec: number;
  difficulty: MotionDifficulty;
  compatibility: MotionCompatibility;
  perfEstimate: MotionPerfEstimate;
  cameraMode: 'orbit' | 'showcase' | 'dance' | 'portrait';
  featured?: boolean;
}

export interface VisualStyleCard {
  id: string;
  galleryPresetId: string;
  label: string;
  description: string;
  swatch: string;
}

export type DeviceClass = 'desktop' | 'laptop' | 'tablet' | 'phone';

export type ExportPlatformId = SocialPlatformId;

export interface SceneVariation {
  id: string;
  label: string;
  cameraPreset: string;
  styleId: string;
  score: number;
  stars: 1 | 2 | 3 | 4 | 5;
  notes: string[];
}

export interface ThumbnailCandidate {
  frame: number;
  dataUrl: string;
  score: number;
}

export interface OneClickCreatorState {
  active: boolean;
  step: OneClickStep;
  characterReady: boolean;
  selectedMotionId: string | null;
  selectedStyleId: string | null;
  selectedPlatform: ExportPlatformId;
  showcaseCount: 5 | 10 | 20 | 50;
  sceneVariations: SceneVariation[];
  selectedVariationId: string | null;
  thumbnails: ThumbnailCandidate[];
  selectedThumbnailFrame: number | null;
  preparing: boolean;
  exporting: boolean;
  statusMessage: string | null;
  deviceClass: DeviceClass;
  gpuTier: SmartGpuTier;
  qualityMode: QualityMode;
  exportFileName: string | null;
  /** Side panel tucked away so the viewport is fully visible. */
  panelMinimized: boolean;
}

export const ONE_CLICK_STEPS: { id: OneClickStep; label: string; num: number }[] = [
  { id: 'character', label: 'Import Character', num: 1 },
  { id: 'motion', label: 'Choose Motion', num: 2 },
  { id: 'style', label: 'Choose Style', num: 3 },
  { id: 'export', label: 'Export', num: 4 },
];
