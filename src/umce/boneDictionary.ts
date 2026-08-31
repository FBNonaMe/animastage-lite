import type { CanonicalBoneId } from './types';

export type BoneAliasTier = 'jp' | 'en' | 'alias' | 'pattern';

export interface BoneAliasEntry {
  canonicalId: CanonicalBoneId;
  tier: BoneAliasTier;
  /** Exact match candidates (case-sensitive first, then case-insensitive). */
  exact: string[];
  /** Regex patterns tested against normalized bone name. */
  patterns?: RegExp[];
}

/**
 * Universal bone dictionary — MMD JP/EN, Mixamo, VRM, ValveBiped, PMX Editor variants.
 * Modular: future formats add entries here without changing scanner logic.
 */
export const BONE_ALIAS_REGISTRY: BoneAliasEntry[] = [
  {
    canonicalId: 'root',
    tier: 'jp',
    exact: ['全ての親', 'すべての親', 'root', 'Root', 'ROOT'],
    patterns: [/^root$/i, /:root$/i, /^Bip001$/i],
  },
  {
    canonicalId: 'center',
    tier: 'jp',
    exact: ['センター', '中心', 'center', 'Center', 'CENTER', 'Hips', 'hips', 'pelvis', 'Pelvis'],
    patterns: [/^mixamorig:hips$/i, /^mixamorigHips$/i, /^Bip001 Pelvis$/i, /^J_Bip_C_Hips$/i],
  },
  {
    canonicalId: 'hips',
    tier: 'jp',
    exact: ['腰', '下半身', 'hip', 'Hip'],
    patterns: [/^mixamorig:spine$/i, /^下半身$/],
  },
  {
    canonicalId: 'waist',
    tier: 'jp',
    exact: ['腰', '下半身', 'waist', 'Waist', 'lower_body'],
  },
  {
    canonicalId: 'spine',
    tier: 'jp',
    exact: ['上半身', '上半身2', 'spine', 'Spine', 'spine1', 'Spine1', 'spine2', 'Spine2'],
    patterns: [/^mixamorig:spine\d*$/i, /^Bip001 Spine$/i, /^J_Bip_C_Spine$/i, /^上半身\d*$/],
  },
  {
    canonicalId: 'chest',
    tier: 'jp',
    exact: ['上半身2', '胸', 'chest', 'Chest', 'upper_body', 'UpperBody'],
    patterns: [/^mixamorig:spine1$/i, /^上半身2$/],
  },
  {
    canonicalId: 'neck',
    tier: 'jp',
    exact: ['首', 'neck', 'Neck', 'NECK'],
    patterns: [/^mixamorig:neck$/i, /^Bip001 Neck$/i, /^J_Bip_C_Neck$/i],
  },
  {
    canonicalId: 'head',
    tier: 'jp',
    exact: ['頭', '頭点', 'head', 'Head', 'HEAD'],
    patterns: [/^mixamorig:head$/i, /^Bip001 Head$/i, /^J_Bip_C_Head$/i, /^Head_/i],
  },
  {
    canonicalId: 'left_shoulder',
    tier: 'jp',
    exact: ['左肩', 'left shoulder', 'LeftShoulder', 'L_Shoulder', 'shoulder_L'],
    patterns: [/^mixamorig:leftshoulder$/i, /^Bip001 L Clavicle$/i, /^左肩$/],
  },
  {
    canonicalId: 'left_arm',
    tier: 'jp',
    exact: ['左腕', 'left arm', 'LeftArm', 'L_UpperArm', 'arm_L', '左腕捩'],
    patterns: [/^mixamorig:leftarm$/i, /^Bip001 L UpperArm$/i, /^左腕/],
  },
  {
    canonicalId: 'left_elbow',
    tier: 'jp',
    exact: ['左ひじ', '左肘', 'left elbow', 'LeftElbow', 'L_ForeArm', 'elbow_L'],
    patterns: [/^mixamorig:leftforearm$/i, /^Bip001 L Forearm$/i, /^左ひじ/],
  },
  {
    canonicalId: 'left_wrist',
    tier: 'jp',
    exact: ['左手首', 'left wrist', 'LeftWrist', 'L_Hand', 'wrist_L'],
    patterns: [/^mixamorig:leftforearm$/i],
  },
  {
    canonicalId: 'left_hand',
    tier: 'jp',
    exact: ['左手', '左手先', 'left hand', 'LeftHand', 'L_Hand', 'hand_L'],
    patterns: [/^mixamorig:lefthand$/i, /^Bip001 L Hand$/i, /^左手/],
  },
  {
    canonicalId: 'right_shoulder',
    tier: 'jp',
    exact: ['右肩', 'right shoulder', 'RightShoulder', 'R_Shoulder', 'shoulder_R'],
    patterns: [/^mixamorig:rightshoulder$/i, /^Bip001 R Clavicle$/i, /^右肩$/],
  },
  {
    canonicalId: 'right_arm',
    tier: 'jp',
    exact: ['右腕', 'right arm', 'RightArm', 'R_UpperArm', 'arm_R', '右腕捩'],
    patterns: [/^mixamorig:rightarm$/i, /^Bip001 R UpperArm$/i, /^右腕/],
  },
  {
    canonicalId: 'right_elbow',
    tier: 'jp',
    exact: ['右ひじ', '右肘', 'right elbow', 'RightElbow', 'R_ForeArm', 'elbow_R'],
    patterns: [/^mixamorig:rightforearm$/i, /^Bip001 R Forearm$/i, /^右ひじ/],
  },
  {
    canonicalId: 'right_wrist',
    tier: 'jp',
    exact: ['右手首', 'right wrist', 'RightWrist', 'R_Hand', 'wrist_R'],
    patterns: [/^mixamorig:rightforearm$/i],
  },
  {
    canonicalId: 'right_hand',
    tier: 'jp',
    exact: ['右手', '右手先', 'right hand', 'RightHand', 'R_Hand', 'hand_R'],
    patterns: [/^mixamorig:righthand$/i, /^Bip001 R Hand$/i, /^右手/],
  },
  {
    canonicalId: 'left_leg',
    tier: 'jp',
    exact: ['左足', '左もも', 'left leg', 'LeftLeg', 'L_Thigh', 'leg_L', '左足D'],
    patterns: [/^mixamorig:leftupleg$/i, /^Bip001 L Thigh$/i, /^左足(?!首|先|IK)/],
  },
  {
    canonicalId: 'left_knee',
    tier: 'jp',
    exact: ['左ひざ', '左膝', 'left knee', 'LeftKnee', 'L_Calf', 'knee_L'],
    patterns: [/^mixamorig:leftleg$/i, /^Bip001 L Calf$/i, /^左ひざ/],
  },
  {
    canonicalId: 'left_ankle',
    tier: 'jp',
    exact: ['左足首', 'left ankle', 'LeftAnkle', 'L_Foot', 'ankle_L'],
    patterns: [/^mixamorig:leftfoot$/i, /^Bip001 L Foot$/i],
  },
  {
    canonicalId: 'left_foot',
    tier: 'jp',
    exact: ['左足首', '左足', 'left foot', 'LeftFoot', 'L_Foot', 'foot_L'],
    patterns: [/^mixamorig:leftfoot$/i, /^左足首$/],
  },
  {
    canonicalId: 'left_toe',
    tier: 'jp',
    exact: ['左足先', 'left toe', 'LeftToe', 'L_Toe', 'toe_L'],
    patterns: [/^mixamorig:lefttoebase$/i, /^左足先/],
  },
  {
    canonicalId: 'right_leg',
    tier: 'jp',
    exact: ['右足', '右もも', 'right leg', 'RightLeg', 'R_Thigh', 'leg_R', '右足D'],
    patterns: [/^mixamorig:rightupleg$/i, /^Bip001 R Thigh$/i, /^右足(?!首|先|IK)/],
  },
  {
    canonicalId: 'right_knee',
    tier: 'jp',
    exact: ['右ひざ', '右膝', 'right knee', 'RightKnee', 'R_Calf', 'knee_R'],
    patterns: [/^mixamorig:rightleg$/i, /^Bip001 R Calf$/i, /^右ひざ/],
  },
  {
    canonicalId: 'right_ankle',
    tier: 'jp',
    exact: ['右足首', 'right ankle', 'RightAnkle', 'R_Foot', 'ankle_R'],
    patterns: [/^mixamorig:rightfoot$/i, /^Bip001 R Foot$/i],
  },
  {
    canonicalId: 'right_foot',
    tier: 'jp',
    exact: ['右足首', '右足', 'right foot', 'RightFoot', 'R_Foot', 'foot_R'],
    patterns: [/^mixamorig:rightfoot$/i, /^右足首$/],
  },
  {
    canonicalId: 'right_toe',
    tier: 'jp',
    exact: ['右足先', 'right toe', 'RightToe', 'R_Toe', 'toe_R'],
    patterns: [/^mixamorig:righttoebase$/i, /^右足先/],
  },
];

/** Legacy pose editor IDs → canonical (for backward compat). */
export const POSE_ID_TO_CANONICAL: Record<string, CanonicalBoneId> = {
  head: 'head',
  neck: 'neck',
  spine: 'spine',
  waist: 'waist',
  arm_L: 'left_arm',
  arm_R: 'right_arm',
};

export function normalizeBoneName(name: string): string {
  return name.replace(/[:|]/g, '').replace(/\s+/g, '').toLowerCase();
}

export function lookupCanonicalByName(
  name: string,
  englishName?: string
): { canonicalId: CanonicalBoneId; tier: BoneAliasTier; confidence: number } | null {
  const candidates = [name, englishName].filter(Boolean) as string[];

  for (const candidate of candidates) {
    for (const entry of BONE_ALIAS_REGISTRY) {
      if (entry.exact.some((e) => e === candidate)) {
        const conf = entry.tier === 'jp' ? 99 : entry.tier === 'en' ? 97 : 92;
        return { canonicalId: entry.canonicalId, tier: entry.tier, confidence: conf };
      }
    }
  }

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    for (const entry of BONE_ALIAS_REGISTRY) {
      const exactCi = entry.exact.find((e) => e.toLowerCase() === lower);
      if (exactCi) {
        return { canonicalId: entry.canonicalId, tier: entry.tier, confidence: 94 };
      }
    }
  }

  for (const candidate of candidates) {
    const norm = normalizeBoneName(candidate);
    for (const entry of BONE_ALIAS_REGISTRY) {
      if (entry.patterns) {
        for (const pat of entry.patterns) {
          if (pat.test(candidate) || pat.test(norm)) {
            return { canonicalId: entry.canonicalId, tier: 'pattern', confidence: 85 };
          }
        }
      }
    }
  }

  return null;
}

/** Flat alias list for legacy findBoneByAlias consumers. */
export function getAliasesForPoseId(poseId: string): string[] {
  const canonical = POSE_ID_TO_CANONICAL[poseId];
  if (!canonical) return [];
  const entry = BONE_ALIAS_REGISTRY.find((e) => e.canonicalId === canonical);
  return entry?.exact ?? [];
}

export function detectRigFormatHint(boneNames: string[]): 'mmd' | 'mixamo' | 'vrm' | 'valvebiped' | 'unknown' {
  const joined = boneNames.join(' ');
  if (/mixamorig/i.test(joined)) return 'mixamo';
  if (/J_Bip_|J_Sec_|VRM/i.test(joined)) return 'vrm';
  if (/Bip001|ValveBiped/i.test(joined)) return 'valvebiped';
  if (/[頭首腕足ひざ]|センター|上半身/.test(joined)) return 'mmd';
  return 'unknown';
}
