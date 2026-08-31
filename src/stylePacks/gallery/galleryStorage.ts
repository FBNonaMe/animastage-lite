import type { StyleGalleryExtras, UserVisualPreset } from './types';

const EXTRAS_KEY = 'as_style_gallery_extras_v1';

const DEFAULT_EXTRAS: StyleGalleryExtras = {
  favorites: [],
  userPresets: [],
};

export function loadGalleryExtras(): StyleGalleryExtras {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY);
    if (!raw) return { ...DEFAULT_EXTRAS };
    const parsed = JSON.parse(raw) as Partial<StyleGalleryExtras>;
    return {
      favorites: Array.isArray(parsed.favorites)
        ? parsed.favorites.filter((x): x is string => typeof x === 'string')
        : [],
      userPresets: Array.isArray(parsed.userPresets)
        ? (parsed.userPresets as UserVisualPreset[])
        : [],
    };
  } catch {
    return { ...DEFAULT_EXTRAS };
  }
}

export function saveGalleryExtras(extras: StyleGalleryExtras): void {
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
}

export function toggleFavorite(extras: StyleGalleryExtras, styleId: string): StyleGalleryExtras {
  const set = new Set(extras.favorites);
  if (set.has(styleId)) set.delete(styleId);
  else set.add(styleId);
  return { ...extras, favorites: [...set] };
}

export function addUserPreset(
  extras: StyleGalleryExtras,
  preset: UserVisualPreset
): StyleGalleryExtras {
  const next = extras.userPresets.filter((p) => p.id !== preset.id);
  next.push(preset);
  next.sort((a, b) => b.savedAt - a.savedAt);
  return { ...extras, userPresets: next };
}

export function removeUserPreset(extras: StyleGalleryExtras, id: string): StyleGalleryExtras {
  return {
    ...extras,
    userPresets: extras.userPresets.filter((p) => p.id !== id),
  };
}

export function duplicateUserPreset(extras: StyleGalleryExtras, id: string): StyleGalleryExtras {
  const src = extras.userPresets.find((p) => p.id === id);
  if (!src) return extras;
  const copy: UserVisualPreset = {
    ...src,
    id: `${src.id}-copy-${Date.now()}`,
    name: `${src.name} (copy)`,
    savedAt: Date.now(),
    config: JSON.parse(JSON.stringify(src.config)),
  };
  return addUserPreset(extras, copy);
}
