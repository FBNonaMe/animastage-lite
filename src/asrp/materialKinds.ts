import type { AsrpMaterialKind, AsrpMaterialProfile } from './types';

const PROFILES: Record<AsrpMaterialKind, Omit<AsrpMaterialProfile, 'kind'>> = {
  hair: {
    heightScale: 0.028,
    silhouetteWidth: 0.85,
    softSilhouette: true,
    minLayers: 10,
    maxLayers: 28,
    normalBlend: 0.7,
    reflectionInfluence: 0.55,
    shadowInfluence: 0.4,
  },
  skin: {
    heightScale: 0.006,
    silhouetteWidth: 0.15,
    softSilhouette: true,
    minLayers: 4,
    maxLayers: 12,
    normalBlend: 0.35,
    reflectionInfluence: 0.3,
    shadowInfluence: 0.25,
  },
  eye: {
    heightScale: 0.004,
    silhouetteWidth: 0.1,
    softSilhouette: true,
    minLayers: 4,
    maxLayers: 10,
    normalBlend: 0.5,
    reflectionInfluence: 0.85,
    shadowInfluence: 0.2,
  },
  cloth: {
    heightScale: 0.032,
    silhouetteWidth: 0.55,
    softSilhouette: true,
    minLayers: 8,
    maxLayers: 28,
    normalBlend: 0.85,
    reflectionInfluence: 0.4,
    shadowInfluence: 0.55,
  },
  fabric: {
    heightScale: 0.03,
    silhouetteWidth: 0.5,
    softSilhouette: true,
    minLayers: 8,
    maxLayers: 26,
    normalBlend: 0.8,
    reflectionInfluence: 0.35,
    shadowInfluence: 0.5,
  },
  shoe: {
    heightScale: 0.022,
    silhouetteWidth: 0.4,
    softSilhouette: false,
    minLayers: 8,
    maxLayers: 22,
    normalBlend: 0.75,
    reflectionInfluence: 0.55,
    shadowInfluence: 0.6,
  },
  accessory: {
    heightScale: 0.02,
    silhouetteWidth: 0.45,
    softSilhouette: false,
    minLayers: 8,
    maxLayers: 24,
    normalBlend: 0.8,
    reflectionInfluence: 0.9,
    shadowInfluence: 0.55,
  },
  ground: {
    heightScale: 0.075,
    silhouetteWidth: 0.9,
    softSilhouette: false,
    minLayers: 12,
    maxLayers: 40,
    normalBlend: 1,
    reflectionInfluence: 0.7,
    shadowInfluence: 0.85,
  },
  wall: {
    heightScale: 0.055,
    silhouetteWidth: 0.95,
    softSilhouette: false,
    minLayers: 12,
    maxLayers: 36,
    normalBlend: 1,
    reflectionInfluence: 0.5,
    shadowInfluence: 0.8,
  },
  wood: {
    heightScale: 0.04,
    silhouetteWidth: 0.6,
    softSilhouette: false,
    minLayers: 10,
    maxLayers: 30,
    normalBlend: 0.9,
    reflectionInfluence: 0.45,
    shadowInfluence: 0.7,
  },
  stone: {
    heightScale: 0.05,
    silhouetteWidth: 0.7,
    softSilhouette: false,
    minLayers: 12,
    maxLayers: 34,
    normalBlend: 1,
    reflectionInfluence: 0.4,
    shadowInfluence: 0.75,
  },
  metal: {
    heightScale: 0.012,
    silhouetteWidth: 0.35,
    softSilhouette: false,
    minLayers: 6,
    maxLayers: 18,
    normalBlend: 0.9,
    reflectionInfluence: 1.2,
    shadowInfluence: 0.7,
  },
  plastic: {
    heightScale: 0.018,
    silhouetteWidth: 0.4,
    softSilhouette: false,
    minLayers: 6,
    maxLayers: 20,
    normalBlend: 0.75,
    reflectionInfluence: 0.7,
    shadowInfluence: 0.5,
  },
  glass: {
    heightScale: 0.008,
    silhouetteWidth: 0.25,
    softSilhouette: true,
    minLayers: 4,
    maxLayers: 14,
    normalBlend: 0.6,
    reflectionInfluence: 1.15,
    shadowInfluence: 0.3,
  },
  water: {
    heightScale: 0.045,
    silhouetteWidth: 0.5,
    softSilhouette: true,
    minLayers: 10,
    maxLayers: 32,
    normalBlend: 0.85,
    reflectionInfluence: 1.1,
    shadowInfluence: 0.4,
  },
  default: {
    heightScale: 0.02,
    silhouetteWidth: 0.45,
    softSilhouette: true,
    minLayers: 8,
    maxLayers: 24,
    normalBlend: 0.75,
    reflectionInfluence: 0.65,
    shadowInfluence: 0.55,
  },
};

/** Smart material detection for Silhouette POM profiles. */
export function classifyAsrpMaterial(name: string, meshName = ''): AsrpMaterialKind {
  const n = `${name} ${meshName}`.toLowerCase();
  if (/髪|hair|前髪|毛/.test(n)) return 'hair';
  if (/目|eye|瞳|まぶた|睫毛|球/.test(n)) return 'eye';
  if (/肌|skin|顔|face|体|body|腕|手|脚|首/.test(n)) return 'skin';
  if (/靴|shoe|boot|sneakers|ヒール/.test(n)) return 'shoe';
  if (/金属|metal|chrome|steel|zip|バックル|釦|weapon|刀|剣|銃|jewel|ring/.test(n))
    return 'metal';
  if (/glass|窓|window|透明|acryl/.test(n)) return 'glass';
  if (/water|水面|pool|液|海|川/.test(n)) return 'water';
  if (/wood|木|timber|板/.test(n)) return 'wood';
  if (/stone|岩|石|brick|コンクリート|concrete/.test(n)) return 'stone';
  if (/wall|壁|天井|ceiling/.test(n)) return 'wall';
  if (/floor|地面|床|ground|terrain|stage.?floor|plane/.test(n)) return 'ground';
  if (/plastic|プラ|pvc|rubber/.test(n)) return 'plastic';
  if (/fabric|布|lace|レース|silk|サテン/.test(n)) return 'fabric';
  if (/服|skirt|cloth|衣|pants|dress|shirt|jacket|coat|リボン|tie|sock/.test(n))
    return 'cloth';
  if (/access|飾|アクセ|prop|小物/.test(n)) return 'accessory';
  return 'default';
}

export function getAsrpMaterialProfile(
  name: string,
  meshName = ''
): AsrpMaterialProfile {
  const kind = classifyAsrpMaterial(name, meshName);
  return { kind, ...PROFILES[kind] };
}
