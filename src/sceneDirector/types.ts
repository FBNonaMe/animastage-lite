import type { Studio3PanelId } from '../uiVersions/studio3/workspaceLayout';

export type SceneDirectorTab = 'cast' | 'clips' | 'music' | 'scene';

export interface SceneMusicMarker {
  id: string;
  label: string;
  timeSec: number;
}

export interface SceneMusicState {
  enabled: boolean;
  name: string;
  blobUrl: string | null;
  /** Trim / sync offset applied when playback starts. */
  offsetSec: number;
  volume: number;
  loop: boolean;
  markers: SceneMusicMarker[];
}

export interface SceneDirectorState {
  version: 1;
  activeTab: SceneDirectorTab;
  /** When set, only this cast member is shown (solo mode). */
  castSoloId: string | null;
  likedEffectIds: string[];
  music: SceneMusicState;
  /** Selected Scene FX instance in the effect timeline editor. */
  selectedEffectInstanceId: string | null;
  /** Export timeline/VMD with MMD-native bezier interpolation bytes. */
  vmdNativeBezier: boolean;
  /** Experimental reze-engine WebGPU path (MIT dependency — feature flag). */
  rezeEngineEnabled: boolean;
}

export const DEFAULT_SCENE_MUSIC: SceneMusicState = {
  enabled: false,
  name: '',
  blobUrl: null,
  offsetSec: 0,
  volume: 0.85,
  loop: false,
  markers: [],
};

export const DEFAULT_SCENE_DIRECTOR: SceneDirectorState = {
  version: 1,
  activeTab: 'cast',
  castSoloId: null,
  likedEffectIds: [],
  music: { ...DEFAULT_SCENE_MUSIC },
  selectedEffectInstanceId: null,
  vmdNativeBezier: true,
  rezeEngineEnabled: false,
};

/** Quick links from Director → existing Studio 3 panels. */
export const SCENE_DIRECTOR_PANEL_LINKS: Array<{
  id: Studio3PanelId;
  label: string;
  hint: string;
}> = [
  { id: 'world', label: 'Scene World', hint: 'Mood presets, weather, FX stack' },
  { id: 'lighting', label: 'Environment / Lighting', hint: 'Sun, sky, cinematic lights' },
  { id: 'camera', label: 'Camera Studio', hint: 'Orbit, framing, aspect' },
  { id: 'fx', label: 'FX Studio', hint: 'Post FX, bloom, grade' },
  { id: 'physics', label: 'Physics Studio', hint: 'Hair, cloth, warmup presets' },
  { id: 'shots', label: 'Shot Composer', hint: 'Placement and shot presets' },
];
