/**
 * ASRP V2 Visual Styles — single source of truth for cinematic looks.
 * Old cinematicRender / sceneComposer styles alias into these IDs.
 */
import type { AsrpVisualStyleId } from './types';

export interface AsrpVisualStyleDef {
  id: AsrpVisualStyleId;
  label: string;
  description: string;
  colorGrade: string;
  bloomIntensity: number;
  exposureBias: number;
  fogDensity: number;
  rimBoost: number;
  reflectionIntensity: number;
  ssao: boolean;
  softShadows: boolean;
  lightShafts: number;
  animeShadingStrength: number;
  materialShading: 'classic_toon' | 'hybrid' | 'pbr_detail';
}

export const ASRP_VISUAL_STYLES: AsrpVisualStyleDef[] = [
  {
    id: 'anime_soft',
    label: 'Anime Soft',
    description: 'Soft bloom · gentle rim · warm grade',
    colorGrade: 'anime',
    bloomIntensity: 0.36,
    exposureBias: 0.05,
    fogDensity: 0.012,
    rimBoost: 0.7,
    reflectionIntensity: 0.85,
    ssao: true,
    softShadows: true,
    lightShafts: 0.2,
    animeShadingStrength: 0.85,
    materialShading: 'hybrid',
  },
  {
    id: 'anime_bright',
    label: 'Anime Bright',
    description: 'Clean highlights · crisp outline feel',
    colorGrade: 'anime',
    bloomIntensity: 0.42,
    exposureBias: 0.12,
    fogDensity: 0.006,
    rimBoost: 0.85,
    reflectionIntensity: 0.7,
    ssao: false,
    softShadows: true,
    lightShafts: 0.35,
    animeShadingStrength: 0.95,
    materialShading: 'classic_toon',
  },
  {
    id: 'anime_cinematic',
    label: 'Anime Cinematic',
    description: 'Studio grade · DOF-ready · rich bloom',
    colorGrade: 'cinematic',
    bloomIntensity: 0.48,
    exposureBias: 0.02,
    fogDensity: 0.02,
    rimBoost: 0.9,
    reflectionIntensity: 1.15,
    ssao: true,
    softShadows: true,
    lightShafts: 0.45,
    animeShadingStrength: 0.8,
    materialShading: 'hybrid',
  },
  {
    id: 'stylized',
    label: 'Stylized',
    description: 'Punchy contrast · stylized grade',
    colorGrade: 'anime',
    bloomIntensity: 0.4,
    exposureBias: 0.08,
    fogDensity: 0.01,
    rimBoost: 1,
    reflectionIntensity: 0.9,
    ssao: true,
    softShadows: true,
    lightShafts: 0.3,
    animeShadingStrength: 0.7,
    materialShading: 'hybrid',
  },
  {
    id: 'realistic',
    label: 'Realistic',
    description: 'PBR detail · softer anime steps',
    colorGrade: 'neutral',
    bloomIntensity: 0.28,
    exposureBias: 0,
    fogDensity: 0.015,
    rimBoost: 0.45,
    reflectionIntensity: 1.25,
    ssao: true,
    softShadows: true,
    lightShafts: 0.25,
    animeShadingStrength: 0.25,
    materialShading: 'pbr_detail',
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    description: 'Neon bloom · cool grade · strong rim',
    colorGrade: 'vaporwave',
    bloomIntensity: 0.55,
    exposureBias: -0.05,
    fogDensity: 0.035,
    rimBoost: 1.15,
    reflectionIntensity: 1.35,
    ssao: true,
    softShadows: true,
    lightShafts: 0.55,
    animeShadingStrength: 0.55,
    materialShading: 'hybrid',
  },
  {
    id: 'warm_sunset',
    label: 'Warm Sunset',
    description: 'Warm grade · golden shafts · soft fog',
    colorGrade: 'warm',
    bloomIntensity: 0.4,
    exposureBias: 0.06,
    fogDensity: 0.028,
    rimBoost: 0.8,
    reflectionIntensity: 1,
    ssao: true,
    softShadows: true,
    lightShafts: 0.7,
    animeShadingStrength: 0.65,
    materialShading: 'hybrid',
  },
  {
    id: 'night',
    label: 'Night',
    description: 'Low key · cool grade · subtle bloom',
    colorGrade: 'cold',
    bloomIntensity: 0.32,
    exposureBias: -0.15,
    fogDensity: 0.04,
    rimBoost: 0.95,
    reflectionIntensity: 1.1,
    ssao: true,
    softShadows: true,
    lightShafts: 0.15,
    animeShadingStrength: 0.7,
    materialShading: 'hybrid',
  },
  {
    id: 'studio',
    label: 'Studio',
    description: 'Clean studio light · balanced reflections',
    colorGrade: 'neutral',
    bloomIntensity: 0.3,
    exposureBias: 0.04,
    fogDensity: 0.004,
    rimBoost: 0.55,
    reflectionIntensity: 1.05,
    ssao: true,
    softShadows: true,
    lightShafts: 0.1,
    animeShadingStrength: 0.5,
    materialShading: 'hybrid',
  },
  {
    id: 'dramatic',
    label: 'Dramatic',
    description: 'High contrast · deep shadows · strong rim',
    colorGrade: 'cinematic',
    bloomIntensity: 0.38,
    exposureBias: -0.08,
    fogDensity: 0.022,
    rimBoost: 1.2,
    reflectionIntensity: 1.2,
    ssao: true,
    softShadows: true,
    lightShafts: 0.5,
    animeShadingStrength: 0.6,
    materialShading: 'hybrid',
  },
];

export function getAsrpVisualStyle(id: AsrpVisualStyleId): AsrpVisualStyleDef {
  return ASRP_VISUAL_STYLES.find((s) => s.id === id) ?? ASRP_VISUAL_STYLES[0];
}

/** Map legacy cinematic / sceneComposer style ids → ASRP V2. */
export function aliasLegacyStyleId(legacy: string | undefined | null): AsrpVisualStyleId {
  switch (legacy) {
    case 'classic_mmd':
    case 'anime':
    case 'soft_anime':
    case 'anime_soft':
      return 'anime_soft';
    case 'anime_ultra':
    case 'anime_bright':
    case 'bright':
      return 'anime_bright';
    case 'cinematic':
    case 'anime_cinematic':
    case 'film':
      return 'anime_cinematic';
    case 'stylized':
    case 'vibrant':
      return 'stylized';
    case 'realistic':
    case 'pbr':
    case 'photoreal':
      return 'realistic';
    case 'cyber':
    case 'cyberpunk':
      return 'cyberpunk';
    case 'sunset':
    case 'warm_sunset':
    case 'golden_hour':
      return 'warm_sunset';
    case 'night':
    case 'noir':
      return 'night';
    case 'studio':
    case 'stage':
      return 'studio';
    case 'dramatic':
    case 'contrast':
      return 'dramatic';
    default:
      return 'anime_soft';
  }
}
