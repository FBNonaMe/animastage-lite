import type { ViewportFormat } from '../../../types';
import type { CinematicExportProfile, CinematicExportProfileId } from '../types';

export const CINEMATIC_EXPORT_PROFILES: CinematicExportProfile[] = [
  {
    id: 'shorts_1080',
    label: 'Shorts 1080×1920 · 60 FPS',
    viewportFormat: '9:16',
    width: 1080,
    height: 1920,
    fps: 60,
    bitrateMbps: 28,
    qualityMode: 'balanced',
    fxBudget: 'medium',
  },
  {
    id: 'shorts_4k',
    label: 'Shorts 4K · 30 FPS',
    viewportFormat: '9:16',
    width: 2160,
    height: 3840,
    fps: 30,
    bitrateMbps: 40,
    qualityMode: 'quality',
    fxBudget: 'high',
  },
  {
    id: 'landscape_1080',
    label: 'YouTube 1080p · 60 FPS',
    viewportFormat: '16:9',
    width: 1920,
    height: 1080,
    fps: 60,
    bitrateMbps: 35,
    qualityMode: 'balanced',
    fxBudget: 'high',
  },
  {
    id: 'landscape_4k',
    label: 'YouTube 4K · 30 FPS',
    viewportFormat: '16:9',
    width: 3840,
    height: 2160,
    fps: 30,
    bitrateMbps: 45,
    qualityMode: 'quality',
    fxBudget: 'high',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    viewportFormat: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    bitrateMbps: 20,
    qualityMode: 'balanced',
    fxBudget: 'medium',
  },
  {
    id: 'fast',
    label: 'Fast export',
    viewportFormat: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    bitrateMbps: 14,
    qualityMode: 'performance',
    fxBudget: 'low',
  },
];

export function resolveExportProfile(
  id: CinematicExportProfileId,
  viewportFormat?: ViewportFormat
): CinematicExportProfile {
  const found = CINEMATIC_EXPORT_PROFILES.find((p) => p.id === id);
  if (found) return found;
  const fallback =
    viewportFormat === '16:9'
      ? CINEMATIC_EXPORT_PROFILES.find((p) => p.id === 'landscape_1080')!
      : CINEMATIC_EXPORT_PROFILES.find((p) => p.id === 'shorts_1080')!;
  return fallback;
}

export function pickExportProfileForPlatform(
  platform: 'youtube_shorts' | 'tiktok' | 'instagram_reels' | 'youtube',
  prefer4k = false
): CinematicExportProfileId {
  if (platform === 'youtube') {
    return prefer4k ? 'landscape_4k' : 'landscape_1080';
  }
  return prefer4k ? 'shorts_4k' : 'shorts_1080';
}
