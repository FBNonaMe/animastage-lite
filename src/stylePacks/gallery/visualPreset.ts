import type { VisualPresetFile, GalleryStyleConfig } from './types';

export function serializeVisualPreset(name: string, config: GalleryStyleConfig, styleId?: string): VisualPresetFile {
  return {
    format: 'visualpreset',
    version: 1,
    name,
    savedAt: Date.now(),
    styleId,
    config,
  };
}

export function parseVisualPreset(raw: string): VisualPresetFile {
  const parsed = JSON.parse(raw) as Partial<VisualPresetFile>;
  if (parsed.format !== 'visualpreset' || parsed.version !== 1) {
    throw new Error('Invalid .visualpreset file.');
  }
  if (!parsed.config?.fx || typeof parsed.config.fx !== 'object') {
    throw new Error('.visualpreset missing config.fx');
  }
  return {
    format: 'visualpreset',
    version: 1,
    name: parsed.name?.trim() || 'My Preset',
    savedAt: parsed.savedAt ?? Date.now(),
    styleId: parsed.styleId,
    config: parsed.config,
  };
}

export function downloadVisualPreset(file: VisualPresetFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${file.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'style'}.visualpreset`;
  a.click();
  URL.revokeObjectURL(url);
}
