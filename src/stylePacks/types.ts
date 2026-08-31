import type { CharacterQuality, VisualFxSettings } from '../types';

/** Whitelisted FX keys a style pack config may set — everything else is ignored. */
export type StylePackFxConfig = Partial<
  Pick<
    VisualFxSettings,
    | 'bloomEnabled'
    | 'bloomIntensity'
    | 'bloomThreshold'
    | 'bloomRadius'
    | 'vignetteEnabled'
    | 'vignetteIntensity'
    | 'dofEnabled'
    | 'dofFocusDistance'
    | 'dofBokehScale'
    | 'chromaticAberration'
    | 'colorGrade'
    | 'scenePreset'
    | 'lightPreset'
    | 'particlesEnabled'
    | 'particlePreset'
    | 'particleIntensity'
    | 'environmentIntensity'
    | 'floorReflection'
    | 'aoIntensity'
    | 'toneExposure'
    | 'ssaoEnabled'
    | 'ssaoIntensity'
    | 'godRaysEnabled'
    | 'smaaEnabled'
    | 'materialDetailing'
    | 'materialSmoothing'
    | 'weatherPreset'
  >
>;

export interface StylePackManifest {
  /** Unique id, e.g. "sakura-dream". */
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  /** Optional JSON endpoint: { "version": "...", "zipUrl": "..." } */
  updateUrl?: string;
  /** Minimum app compat marker (informational). */
  minAppVersion?: string;
}

/** Parsed config.json — flat FX keys or nested { fx, characterQuality }. */
export interface StylePackConfigFile {
  fx?: StylePackFxConfig;
  characterQuality?: CharacterQuality;
}

export interface StylePackAppliedConfig {
  fx: StylePackFxConfig;
  characterQuality?: CharacterQuality;
}

export interface InstalledStylePack {
  manifest: StylePackManifest;
  config: StylePackAppliedConfig;
  /** preview.webp as data URL (small, stored locally). */
  previewDataUrl: string | null;
  /** Raw shader sources kept for future custom-pass support (validated, not compiled). */
  shaderVert: string | null;
  shaderFrag: string | null;
  installedAt: number;
  sourceUrl?: string;
  /** Present when imported from Ray-MMD, Plug-In Shader, or other MME .fx pack. */
  mmdShader?: import('./mmdShaderAdapter').MmdShaderAdaptationInfo;
}

export interface BuiltinStyle {
  id: string;
  name: string;
  description: string;
  /** Tailwind gradient classes for the tile. */
  swatch: string;
  config: StylePackAppliedConfig;
}

export type StyleSource =
  | { kind: 'builtin'; style: BuiltinStyle }
  | { kind: 'pack'; pack: InstalledStylePack }
  | { kind: 'gallery'; preset: import('./gallery/types').GalleryPresetDef }
  | { kind: 'user'; preset: import('./gallery/types').UserVisualPreset };

export interface StylePackUpdateInfo {
  packId: string;
  currentVersion: string;
  newVersion: string;
  zipUrl: string;
}

export interface StyleInstallResult {
  ok: boolean;
  pack?: InstalledStylePack;
  error?: string;
}
