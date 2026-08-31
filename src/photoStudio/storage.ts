import type { PhotoPresetV1, PhotoStudioSession } from './types';
import { DEFAULT_PHOTO_SESSION } from './types';

const PRESETS_KEY = 'animastage.photoStudio.presets.v1';
const SESSION_KEY = 'animastage.photoStudio.session.v1';

export function loadPhotoPresets(): PhotoPresetV1[] {
  try {
    const value = JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((x) => x?.version === 1) : [];
  } catch {
    return [];
  }
}

export function savePhotoPreset(preset: PhotoPresetV1): PhotoPresetV1[] {
  const next = [preset, ...loadPhotoPresets().filter((x) => x.id !== preset.id)].slice(0, 100);
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  } catch {
    /* storage can be unavailable */
  }
  return next;
}

export function deletePhotoPreset(id: string): PhotoPresetV1[] {
  const next = loadPhotoPresets().filter((x) => x.id !== id);
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  } catch {
    /* storage can be unavailable */
  }
  return next;
}

export function loadPhotoSession(): PhotoStudioSession {
  try {
    return {
      ...DEFAULT_PHOTO_SESSION,
      ...(JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as Partial<PhotoStudioSession>),
    };
  } catch {
    return { ...DEFAULT_PHOTO_SESSION };
  }
}

export function savePhotoSession(patch: Partial<PhotoStudioSession>): PhotoStudioSession {
  const next = { ...loadPhotoSession(), ...patch };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    /* storage can be unavailable */
  }
  return next;
}

export function createPhotoPresetId(): string {
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
