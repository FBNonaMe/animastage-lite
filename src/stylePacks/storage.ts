import type { InstalledStylePack } from './types';
import { builtinStyleKey } from './builtins';

const STORAGE_KEY = 'as_style_packs_v1';

export interface StylePackStorageState {
  activeStyleId: string;
  installed: InstalledStylePack[];
}

const DEFAULT_STATE: StylePackStorageState = {
  activeStyleId: builtinStyleKey('default'),
  installed: [],
};

export function loadStylePackState(): StylePackStorageState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<StylePackStorageState>;
    const installed = Array.isArray(parsed.installed)
      ? parsed.installed.filter(
          (p): p is InstalledStylePack =>
            typeof p === 'object' &&
            p !== null &&
            typeof (p as InstalledStylePack).manifest?.id === 'string' &&
            typeof (p as InstalledStylePack).config?.fx === 'object'
        )
      : [];
    const activeStyleId =
      typeof parsed.activeStyleId === 'string' && parsed.activeStyleId.trim()
        ? parsed.activeStyleId
        : DEFAULT_STATE.activeStyleId;
    return { activeStyleId, installed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveStylePackState(state: StylePackStorageState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function upsertInstalledPack(
  installed: InstalledStylePack[],
  pack: InstalledStylePack
): InstalledStylePack[] {
  const next = installed.filter((p) => p.manifest.id !== pack.manifest.id);
  next.push(pack);
  next.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  return next;
}

export function removeInstalledPack(installed: InstalledStylePack[], packId: string): InstalledStylePack[] {
  return installed.filter((p) => p.manifest.id !== packId);
}
