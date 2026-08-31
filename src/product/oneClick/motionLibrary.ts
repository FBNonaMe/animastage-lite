import { getAnimationTemplate } from '../../templates/animationTemplates';
import type { MotionCategoryId, MotionLibraryEntry } from './types';

export const MOTION_CATEGORIES: { id: MotionCategoryId; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'popular', label: 'Popular' },
  { id: 'dance', label: 'Dance' },
  { id: 'cute', label: 'Cute' },
  { id: 'idle', label: 'Idle' },
  { id: 'action', label: 'Action' },
  { id: 'concert', label: 'Concert' },
  { id: 'walk', label: 'Walk' },
  { id: 'run', label: 'Run' },
  { id: 'pose', label: 'Pose' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recently Used' },
];

const FAVORITES_KEY = 'as_oneclick_motion_favorites';
const RECENT_KEY = 'as_oneclick_motion_recent';

const RAW_MOTIONS: Omit<MotionLibraryEntry, 'id'>[] = [
  {
    templateId: 'emote_party_dance',
    name: 'Party Dance',
    description: 'Energetic full-body dance loop.',
    categories: ['trending', 'popular', 'dance'],
    durationSec: 8,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'balanced',
    cameraMode: 'dance',
    featured: true,
  },
  {
    templateId: 'char_full_dance',
    name: 'Full Dance',
    description: 'Classic idol dance with orbit cam.',
    categories: ['trending', 'dance', 'popular'],
    durationSec: 10,
    difficulty: 'medium',
    compatibility: 'humanoid',
    perfEstimate: 'balanced',
    cameraMode: 'dance',
    featured: true,
  },
  {
    templateId: 'emote_concert_finale',
    name: 'Concert Finale',
    description: 'Stage fly-cam with hype bounce.',
    categories: ['concert', 'action', 'popular'],
    durationSec: 9,
    difficulty: 'medium',
    compatibility: 'all',
    perfEstimate: 'heavy',
    cameraMode: 'showcase',
  },
  {
    templateId: 'emote_roller_dance',
    name: 'Roller Dance',
    description: 'Rollercoaster camera with side swing.',
    categories: ['dance', 'action'],
    durationSec: 10,
    difficulty: 'medium',
    compatibility: 'all',
    perfEstimate: 'balanced',
    cameraMode: 'dance',
  },
  {
    templateId: 'char_hype_bounce',
    name: 'Hype Bounce',
    description: 'Short energetic bounce emote.',
    categories: ['cute', 'dance', 'popular'],
    durationSec: 6,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'light',
    cameraMode: 'portrait',
  },
  {
    templateId: 'char_wave',
    name: 'Friendly Wave',
    description: 'Cute greeting wave for intros.',
    categories: ['cute', 'idle', 'pose'],
    durationSec: 5,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'light',
    cameraMode: 'portrait',
  },
  {
    templateId: 'char_greeting',
    name: 'Stream Greeting',
    description: 'Wide greeting pose for VTuber style.',
    categories: ['cute', 'pose', 'idle'],
    durationSec: 6,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'light',
    cameraMode: 'showcase',
  },
  {
    templateId: 'char_idle_blink',
    name: 'Idle Blink',
    description: 'Subtle idle loop — great for thumbnails.',
    categories: ['idle', 'pose'],
    durationSec: 8,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'light',
    cameraMode: 'portrait',
  },
  {
    templateId: 'char_look_around',
    name: 'Look Around',
    description: 'Gentle head movement idle.',
    categories: ['idle', 'cute'],
    durationSec: 7,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'light',
    cameraMode: 'portrait',
  },
  {
    templateId: 'char_victory_flex',
    name: 'Victory Flex',
    description: 'Action pose with hero camera.',
    categories: ['action', 'pose'],
    durationSec: 7,
    difficulty: 'easy',
    compatibility: 'humanoid',
    perfEstimate: 'light',
    cameraMode: 'showcase',
  },
  {
    templateId: 'emote_victory_royale',
    name: 'Victory Royale',
    description: 'Epic sky sweep highlight.',
    categories: ['action', 'trending'],
    durationSec: 9,
    difficulty: 'medium',
    compatibility: 'all',
    perfEstimate: 'balanced',
    cameraMode: 'showcase',
  },
  {
    templateId: 'emote_battle_highlight',
    name: 'Battle Highlight',
    description: 'Lobby groove with drone orbit.',
    categories: ['action', 'dance'],
    durationSec: 8,
    difficulty: 'medium',
    compatibility: 'all',
    perfEstimate: 'balanced',
    cameraMode: 'orbit',
  },
  {
    templateId: 'combo_showcase',
    name: 'Showcase Combo',
    description: 'Cinematic orbit + character motion.',
    categories: ['popular', 'pose'],
    durationSec: 12,
    difficulty: 'medium',
    compatibility: 'all',
    perfEstimate: 'balanced',
    cameraMode: 'showcase',
  },
  {
    templateId: 'combo_cinematic',
    name: 'Cinematic Combo',
    description: 'Movie-style camera sweep.',
    categories: ['popular', 'concert'],
    durationSec: 12,
    difficulty: 'hard',
    compatibility: 'all',
    perfEstimate: 'heavy',
    cameraMode: 'showcase',
  },
  {
    templateId: 'char_side_swing',
    name: 'Side Swing',
    description: 'Rhythmic side-to-side dance.',
    categories: ['dance', 'walk'],
    durationSec: 8,
    difficulty: 'easy',
    compatibility: 'humanoid',
    perfEstimate: 'light',
    cameraMode: 'dance',
  },
  {
    templateId: 'char_groove_emote',
    name: 'Groove Emote',
    description: 'Smooth groove loop.',
    categories: ['dance', 'run'],
    durationSec: 8,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'light',
    cameraMode: 'dance',
  },
  {
    templateId: 'char_corner_pose',
    name: 'Corner Pose',
    description: 'Stylish corner spotlight pose.',
    categories: ['pose', 'cute'],
    durationSec: 6,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'light',
    cameraMode: 'portrait',
  },
  {
    templateId: 'emote_corner_spotlight',
    name: 'Spotlight Pose',
    description: 'Dramatic corner spotlight.',
    categories: ['pose', 'concert'],
    durationSec: 8,
    difficulty: 'medium',
    compatibility: 'all',
    perfEstimate: 'balanced',
    cameraMode: 'showcase',
  },
  {
    templateId: 'char_nod',
    name: 'Nod',
    description: 'Quick acknowledgment nod.',
    categories: ['idle', 'cute'],
    durationSec: 4,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'light',
    cameraMode: 'portrait',
  },
  {
    templateId: 'char_surprised',
    name: 'Surprised',
    description: 'Expressive surprised reaction.',
    categories: ['cute', 'pose'],
    durationSec: 5,
    difficulty: 'easy',
    compatibility: 'all',
    perfEstimate: 'light',
    cameraMode: 'portrait',
  },
];

export const MOTION_LIBRARY: MotionLibraryEntry[] = RAW_MOTIONS.filter((m) =>
  Boolean(getAnimationTemplate(m.templateId))
).map((m) => ({ ...m, id: m.templateId }));

export function getMotionEntry(id: string): MotionLibraryEntry | undefined {
  return MOTION_LIBRARY.find((m) => m.id === id);
}

export function getMotionsForCategory(
  category: MotionCategoryId,
  favorites: string[],
  recent: string[]
): MotionLibraryEntry[] {
  if (category === 'favorites') {
    return MOTION_LIBRARY.filter((m) => favorites.includes(m.id));
  }
  if (category === 'recent') {
    return recent
      .map((id) => getMotionEntry(id))
      .filter((m): m is MotionLibraryEntry => Boolean(m));
  }
  if (category === 'trending') {
    return MOTION_LIBRARY.filter((m) => m.featured || m.categories.includes('trending'));
  }
  if (category === 'popular') {
    return MOTION_LIBRARY.filter((m) => m.categories.includes('popular') || m.featured);
  }
  if (category === 'walk' || category === 'run') {
    return MOTION_LIBRARY.filter(
      (m) => m.categories.includes('dance') || m.categories.includes('idle')
    );
  }
  return MOTION_LIBRARY.filter((m) => m.categories.includes(category));
}

export function loadMotionFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function toggleMotionFavorite(id: string): string[] {
  const current = loadMotionFavorites();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function pushMotionRecent(id: string): string[] {
  const current = loadMotionRecent();
  const next = [id, ...current.filter((x) => x !== id)].slice(0, 12);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function loadMotionRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
