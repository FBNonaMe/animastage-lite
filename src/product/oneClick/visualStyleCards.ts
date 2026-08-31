import { getGalleryPreset } from '../../stylePacks/gallery/catalog';
import { galleryStyleKey } from '../../stylePacks/gallery/types';
import type { VisualStyleCard } from './types';

const CARD_DEFS: { label: string; presetSlug: string; description: string }[] = [
  { label: 'Default', presetSlug: 'default', description: 'Clean studio look — works everywhere.' },
  { label: 'Anime', presetSlug: 'anime-bright', description: 'Bright cel-shaded anime colors.' },
  { label: 'Soft Anime', presetSlug: 'anime-soft', description: 'Pastel tones with soft bloom.' },
  { label: 'Genshin', presetSlug: 'genshin-style', description: 'Game-inspired painterly lighting.' },
  { label: 'Honkai', presetSlug: 'honkai-style', description: 'Fantasy rim light and glow.' },
  { label: 'Cyberpunk', presetSlug: 'cyberpunk', description: 'Neon city night atmosphere.' },
  { label: 'Fantasy', presetSlug: 'fantasy-world', description: 'Magical stage with dreamy fog.' },
  { label: 'Studio', presetSlug: 'studio-portrait', description: 'Professional portrait lighting.' },
  { label: 'Movie', presetSlug: 'movie', description: 'Cinematic film grade and contrast.' },
  { label: 'Sketch', presetSlug: 'sketch', description: 'Hand-drawn stylized outline look.' },
];

export const VISUAL_STYLE_CARDS: VisualStyleCard[] = CARD_DEFS.flatMap((def) => {
  const preset = getGalleryPreset(def.presetSlug);
  if (!preset) return [];
  return [
    {
      id: galleryStyleKey(preset.id),
      galleryPresetId: preset.id,
      label: def.label,
      description: def.description,
      swatch: preset.swatch,
    },
  ];
});

export function getDefaultStyleCard(): VisualStyleCard {
  return (
    VISUAL_STYLE_CARDS[0] ?? {
      id: 'gallery:default',
      galleryPresetId: 'default',
      label: 'Default',
      description: 'Clean studio look.',
      swatch: 'from-slate-500 to-zinc-900',
    }
  );
}
