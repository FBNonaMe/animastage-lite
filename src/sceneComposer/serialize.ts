import type { SceneBackgroundSettings, SceneHdrSettings, VisualFxSettings } from '../types';
import type { SceneComposerBundle, SceneComposerState } from './types';
import { DEFAULT_SCENE_COMPOSER } from './defaults';

const FILE_VERSION = 1;

export function serializeScenePreset(
  name: string,
  visualFx: VisualFxSettings,
  sceneComposer: SceneComposerState,
  sceneBackground?: SceneBackgroundSettings,
  sceneHdr?: SceneHdrSettings
): string {
  const bundle: SceneComposerBundle = {
    version: FILE_VERSION,
    name,
    visualFx,
    sceneComposer,
    sceneBackground,
    sceneHdr: sceneHdr
      ? { intensity: sceneHdr.intensity, showBackground: sceneHdr.showBackground }
      : undefined,
  };
  return JSON.stringify(bundle, null, 2);
}

export function parseScenePreset(json: string): SceneComposerBundle | { error: string } {
  try {
    const raw = JSON.parse(json) as SceneComposerBundle;
    if (!raw || raw.version !== FILE_VERSION || !raw.visualFx || !raw.sceneComposer) {
      return { error: 'Invalid .scenepreset file' };
    }
    return {
      version: 1,
      name: raw.name || 'Imported',
      visualFx: raw.visualFx,
      sceneComposer: { ...DEFAULT_SCENE_COMPOSER, ...raw.sceneComposer },
      sceneBackground: raw.sceneBackground,
      sceneHdr: raw.sceneHdr,
    };
  } catch {
    return { error: 'Could not parse preset file' };
  }
}

export function downloadScenePreset(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.scenepreset') ? filename : `${filename}.scenepreset`;
  a.click();
  URL.revokeObjectURL(url);
}
