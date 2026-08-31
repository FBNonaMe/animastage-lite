import type { AnimationLibraryAsset } from './types';
import { MOTION_LIBRARY } from '../product/oneClick/motionLibrary';

/** Seed library with One Click / template motions (no file binding). */
export function buildReadyMadeAssets(): AnimationLibraryAsset[] {
  const now = Date.now();
  return MOTION_LIBRARY.map((entry, i) => ({
    id: `ready_${entry.id}`,
    name: entry.name,
    format: 'template' as const,
    durationSec: entry.durationSec,
    fps: 30,
    skeletonType: 'universal' as const,
    loop: true,
    tags: [...entry.categories, 'ready-made'],
    author: 'AnimaStage',
    compatibility: 'compatible' as const,
    thumbnail: entry.featured ? '⭐' : '🎬',
    createdAt: now - i,
    updatedAt: now - i,
    templateId: entry.templateId,
    favorite: Boolean(entry.featured),
  }));
}
