import type { VcsDirectorMode, VcsDirectorRules } from '../types';

export const VCS_DIRECTOR_MODES: VcsDirectorRules[] = [
  {
    mode: 'character_showcase',
    label: 'Character Showcase',
    description: 'Wide arc highlighting full character silhouette.',
    focusTarget: 'com',
    distanceMode: 'wide',
    motionIntensity: 0.45,
    fovBias: 1,
    preferPortraitFraming: false,
  },
  {
    mode: 'dance_performance',
    label: 'Dance Performance',
    description: 'Dynamic arc tracking dance motion with face priority.',
    focusTarget: 'face',
    distanceMode: 'wide',
    motionIntensity: 0.85,
    fovBias: 1.05,
    preferPortraitFraming: true,
  },
  {
    mode: 'concert',
    label: 'Concert',
    description: 'Stage fly-cam with energetic push-ins.',
    focusTarget: 'chest',
    distanceMode: 'wide',
    motionIntensity: 0.9,
    fovBias: 1.08,
    preferPortraitFraming: false,
  },
  {
    mode: 'portrait',
    label: 'Portrait',
    description: 'Tight face framing for vertical shorts.',
    focusTarget: 'face',
    distanceMode: 'close',
    motionIntensity: 0.2,
    fovBias: 0.88,
    preferPortraitFraming: true,
  },
  {
    mode: 'cinematic',
    label: 'Cinematic',
    description: 'Mixed angles with film-style pacing.',
    focusTarget: 'face',
    distanceMode: 'medium',
    motionIntensity: 0.55,
    fovBias: 0.98,
    preferPortraitFraming: false,
  },
  {
    mode: 'hero_shot',
    label: 'Hero Shot',
    description: 'Low-angle power framing with slow push.',
    focusTarget: 'chest',
    distanceMode: 'medium',
    motionIntensity: 0.4,
    fovBias: 0.95,
    preferPortraitFraming: false,
  },
  {
    mode: 'orbit',
    label: 'Orbit',
    description: 'Smooth operator orbit with anticipation.',
    focusTarget: 'com',
    distanceMode: 'medium',
    motionIntensity: 0.5,
    fovBias: 1,
    preferPortraitFraming: false,
  },
  {
    mode: 'drone',
    label: 'Drone',
    description: 'High-angle descending reveal.',
    focusTarget: 'com',
    distanceMode: 'wide',
    motionIntensity: 0.35,
    fovBias: 1.1,
    preferPortraitFraming: false,
  },
  {
    mode: 'tracking',
    label: 'Tracking',
    description: 'Lateral follow with lead room.',
    focusTarget: 'head',
    distanceMode: 'medium',
    motionIntensity: 0.6,
    fovBias: 1.02,
    preferPortraitFraming: false,
  },
  {
    mode: 'action',
    label: 'Action',
    description: 'Fast cuts of angle with COM tracking on jumps.',
    focusTarget: 'com',
    distanceMode: 'wide',
    motionIntensity: 0.95,
    fovBias: 1.12,
    preferPortraitFraming: false,
  },
  {
    mode: 'close_up',
    label: 'Close-Up',
    description: 'Intimate face close-up with micro drift.',
    focusTarget: 'eyes',
    distanceMode: 'close',
    motionIntensity: 0.15,
    fovBias: 0.86,
    preferPortraitFraming: true,
  },
  {
    mode: 'wide_shot',
    label: 'Wide Shot',
    description: 'Full-body environmental framing.',
    focusTarget: 'com',
    distanceMode: 'wide',
    motionIntensity: 0.3,
    fovBias: 1.15,
    preferPortraitFraming: false,
  },
  {
    mode: 'random_professional',
    label: 'Random Pro',
    description: 'Picks a rated professional mode automatically.',
    focusTarget: 'face',
    distanceMode: 'medium',
    motionIntensity: 0.55,
    fovBias: 1,
    preferPortraitFraming: false,
  },
];

const MODE_MAP: Record<
  Exclude<VcsDirectorMode, 'random_professional'>,
  import('../../cinematic/types').CinematicCameraMode
> = {
  character_showcase: 'showcase',
  dance_performance: 'dance',
  concert: 'dynamic',
  portrait: 'face',
  cinematic: 'dynamic',
  hero_shot: 'hero',
  orbit: 'orbit',
  drone: 'drone',
  tracking: 'tracking',
  action: 'dynamic',
  close_up: 'close_up',
  wide_shot: 'showcase',
};

export function getDirectorRules(mode: VcsDirectorMode): VcsDirectorRules {
  if (mode === 'random_professional') {
    const pool = VCS_DIRECTOR_MODES.filter((m) => m.mode !== 'random_professional');
    return pool[Math.floor(Math.random() * pool.length)]!;
  }
  return VCS_DIRECTOR_MODES.find((m) => m.mode === mode) ?? VCS_DIRECTOR_MODES[0]!;
}

export function resolveCinematicMode(mode: VcsDirectorMode): import('../../cinematic/types').CinematicCameraMode {
  if (mode === 'random_professional') {
    return resolveCinematicMode(
      VCS_DIRECTOR_MODES.filter((m) => m.mode !== 'random_professional')[
        Math.floor(Math.random() * 11)
      ]!.mode
    );
  }
  return MODE_MAP[mode] ?? 'showcase';
}

export const PROFESSIONAL_MODE_POOL: VcsDirectorMode[] = VCS_DIRECTOR_MODES.filter(
  (m) => m.mode !== 'random_professional'
).map((m) => m.mode);

/** Map motion energy + aspect to a director mode for auto pipelines. */
export function pickVcsDirectorMode(
  motionIntensity: number,
  viewportFormat: import('../../../types').ViewportFormat
): VcsDirectorMode {
  if (viewportFormat === '9:16') {
    return motionIntensity > 0.65 ? 'dance_performance' : 'portrait';
  }
  if (motionIntensity > 0.82) return 'action';
  if (motionIntensity > 0.62) return 'dance_performance';
  if (motionIntensity < 0.32) return 'character_showcase';
  if (motionIntensity < 0.48) return 'orbit';
  return 'cinematic';
}
