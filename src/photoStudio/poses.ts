/** Photo-oriented pose catalog and deterministic pose mixing. */
import type { PoseBoneRotation } from '../pose/poseTypes';
import type { PhotoPoseCategory, PhotoPoseEntry } from './types';

const D = (x: number, y: number, z: number): PoseBoneRotation => ({ x, y, z });

type PoseSeed = [
  PhotoPoseCategory,
  string,
  string,
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

const SEEDS: PoseSeed[] = [
  ['Cute', 'Cute Step', 'CU', [-5, 12, 5], [-18, 5, -45], [-22, -5, 48]],
  ['Elegant', 'Elegant Turn', 'EL', [-2, -18, 4], [-5, 0, -28], [-12, 4, 32]],
  ['Relaxed', 'Relaxed Lean', 'RL', [4, 8, -3], [-8, 0, -18], [-6, 0, 22]],
  ['Happy', 'Happy Jump', 'HP', [-8, 0, 0], [-18, 0, -72], [-18, 0, 72]],
  ['Angry', 'Angry Stance', 'AN', [3, 0, 0], [-22, 4, -40], [-22, -4, 40]],
  ['Sad', 'Sad Fold', 'SD', [12, -5, 2], [-25, 8, -25], [-25, -8, 25]],
  ['Magic', 'Magic Cast', 'MG', [-5, 18, -5], [-35, 15, -68], [5, -10, 55]],
  ['Combat', 'Combat Ready', 'CB', [2, -12, 0], [-35, 12, -55], [-18, -5, 62]],
  ['School', 'School Greeting', 'SC', [-2, 10, 0], [-5, 0, -18], [-32, 10, 65]],
  ['Idol', 'Idol Heart', 'ID', [-6, 0, 0], [-38, 12, -52], [-38, -12, 52]],
  ['Concert', 'Concert Sing', 'CO', [-8, -10, 0], [-25, 0, -48], [-48, 20, 50]],
  ['Fantasy', 'Fantasy Hero', 'FA', [-3, 15, -4], [-12, 0, -50], [-25, 12, 55]],
  ['Cyberpunk', 'Cyber Stance', 'CY', [1, -18, 2], [-8, 5, -38], [-28, -10, 45]],
  ['Selfie', 'Selfie Angle', 'SE', [-8, -22, 6], [-5, 0, -20], [-45, -15, 72]],
  ['Sitting', 'Sitting Portrait', 'SI', [1, 12, 0], [-8, 0, -20], [-8, 0, 20]],
  ['Jump', 'Jump Action', 'JP', [-8, 8, 0], [-25, 0, -62], [-15, 0, 70]],
  ['Running', 'Running Action', 'RN', [-2, 4, 0], [-45, 0, -48], [35, 0, 42]],
  ['Walking', 'Walking Grace', 'WK', [-2, 8, 0], [-18, 0, -24], [16, 0, 28]],
  ['Looking Back', 'Looking Back', 'LB', [-2, 42, 2], [-12, 0, -20], [-18, 8, 35]],
  ['Victory', 'Victory Sign', 'VC', [-6, -8, 0], [-12, 0, -24], [-42, 10, 72]],
  ['Smile', 'Smile Portrait', 'SM', [-3, 8, 2], [-10, 0, -25], [-10, 0, 25]],
  ['Cry', 'Crying Kneel', 'CR', [15, 0, 0], [-48, 15, -45], [-48, -15, 45]],
  ['Thinking', 'Thinking', 'TH', [5, -12, 8], [-8, 0, -20], [-35, 20, 48]],
  ['Anime Intro', 'Anime Intro', 'AI', [-4, 22, -3], [-15, 0, -55], [-25, 0, 50]],
  ['Wallpaper Pose', 'Wallpaper Hero', 'WP', [-2, -10, 0], [-18, 0, -35], [-8, 0, 50]],
  ['Poster Pose', 'Poster Lead', 'PS', [-5, 12, -2], [-12, 0, -42], [-22, 0, 55]],
];

export const PHOTO_POSES: PhotoPoseEntry[] = SEEDS.map(
  ([category, name, thumbnail, head, armL, armR], index) => ({
    version: 1,
    id: `photo_${category.toLowerCase().replace(/\W+/g, '_')}_${index}`,
    name,
    thumbnail,
    category,
    tags: [category.toLowerCase(), name.toLowerCase(), 'photo'],
    morphs:
      category === 'Sad' || category === 'Cry'
        ? { eyes: 0.42, mouth: 0.08, brow: 0.52 }
        : category === 'Angry' || category === 'Combat'
          ? { eyes: 0.04, mouth: 0.15, brow: 0.62 }
          : { eyes: 0.1, mouth: 0.42, brow: 0.12 },
    bones: {
      head: D(...head),
      neck: D(head[0] * 0.4, head[1] * 0.35, head[2] * 0.2),
      spine: D(0, index % 2 ? 7 : -5, index % 3 ? 2 : -3),
      waist: D(0, index % 2 ? -7 : 6, 0),
      arm_L: D(...armL),
      arm_R: D(...armR),
    },
  })
);

function blendRotation(
  a: PoseBoneRotation | undefined,
  b: PoseBoneRotation | undefined,
  amount: number
): PoseBoneRotation {
  const av = a ?? D(0, 0, 0);
  const bv = b ?? av;
  return D(
    av.x + (bv.x - av.x) * amount,
    av.y + (bv.y - av.y) * amount,
    av.z + (bv.z - av.z) * amount
  );
}

export function mixPhotoPoses(
  a: PhotoPoseEntry,
  b: PhotoPoseEntry,
  amount = 0.5
): PhotoPoseEntry {
  const t = Math.max(0, Math.min(1, amount));
  const keys = new Set([...Object.keys(a.bones), ...Object.keys(b.bones)]);
  return {
    ...a,
    id: `photo_mix_${a.id}_${b.id}_${Math.round(t * 100)}`,
    name: `${a.name} × ${b.name}`,
    thumbnail: 'MX',
    tags: [...new Set([...a.tags, ...b.tags, 'mixed'])],
    bones: Object.fromEntries(
      [...keys].map((key) => [key, blendRotation(a.bones[key], b.bones[key], t)])
    ),
    morphs: {
      eyes: a.morphs.eyes + (b.morphs.eyes - a.morphs.eyes) * t,
      mouth: a.morphs.mouth + (b.morphs.mouth - a.morphs.mouth) * t,
      brow: a.morphs.brow + (b.morphs.brow - a.morphs.brow) * t,
    },
  };
}

export function searchPhotoPoses(
  query: string,
  category: PhotoPoseCategory | 'All',
  favoriteIds: string[] = []
): PhotoPoseEntry[] {
  const q = query.trim().toLowerCase();
  return PHOTO_POSES.filter((pose) => {
    if (category !== 'All' && pose.category !== category) return false;
    if (!q) return true;
    return (
      pose.name.toLowerCase().includes(q) ||
      pose.category.toLowerCase().includes(q) ||
      pose.tags.some((tag) => tag.includes(q)) ||
      (q === 'favorite' && favoriteIds.includes(pose.id))
    );
  });
}
