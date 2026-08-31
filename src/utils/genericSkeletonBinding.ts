/**
 * Auto-map timeline bone tracks onto generic GLB/FBX/VRM skeletons (non-PMX names).
 */
import * as THREE from 'three';
import type { TimelineTrackId } from '../types';

export type TimelineBoneTrack = Exclude<
  TimelineTrackId,
  'morph_eyes' | 'morph_mouth' | 'morph_brow'
>;

export type TimelineBoneMap = Partial<Record<TimelineBoneTrack, string>>;

type SkeletonRole =
  | 'head'
  | 'neck'
  | 'spine'
  | 'waist'
  | 'l_shoulder'
  | 'r_shoulder'
  | 'l_arm'
  | 'r_arm';

const ROLE_PATTERNS: Record<SkeletonRole, { positive: RegExp[]; negative: RegExp[] }> = {
  head: {
    positive: [/^head$/i, /(^|[_.-])head($|[_.-])/i, /頭/, /skull/i],
    negative: [/eye/i, /目/, /hair/i, /髪/, /jaw/i, /end/i, /twist/i, /finger/i, /toe/i],
  },
  neck: {
    positive: [/neck/i, /首/, /cervical/i],
    negative: [/twist/i, /end/i],
  },
  spine: {
    positive: [/spine/i, /chest/i, /upperchest/i, /torso/i, /上半身/, /thoracic/i, /spine[12]/i],
    negative: [/hip/i, /leg/i, /arm/i, /肩/, /腕/],
  },
  waist: {
    positive: [/hips/i, /pelvis/i, /waist/i, /下半身/, /root/i, /hip$/i],
    negative: [/shoulder/i, /arm/i, /leg/i, /toe/i, /肩/, /腕/],
  },
  l_shoulder: {
    positive: [/left.*shoulder/i, /shoulder.*left/i, /l[_\-.]?shoulder/i, /左肩/, /shoulder_l/i],
    negative: [/right|r[_\-.]|migi|右/],
  },
  r_shoulder: {
    positive: [/right.*shoulder/i, /shoulder.*right/i, /r[_\-.]?shoulder/i, /右肩/, /shoulder_r/i],
    negative: [/left|l[_\-.]|hidari|左/],
  },
  l_arm: {
    positive: [
      /left.*arm/i,
      /arm.*left/i,
      /l[_\-.]?arm/i,
      /左腕/,
      /upperarm_l/i,
      /mixamorig:leftarm/i,
      /leftupperarm/i,
      /joint.*left.*arm/i,
      /joint_l_/i,
    ],
    negative: [/right|r[_\-.]|migi|右/, /forearm/i, /hand/i, /finger/i, /肩/, /eye|目|leg|足/],
  },
  r_arm: {
    positive: [
      /right.*arm/i,
      /arm.*right/i,
      /r[_\-.]?arm/i,
      /右腕/,
      /upperarm_r/i,
      /mixamorig:rightarm/i,
      /rightupperarm/i,
      /joint.*right.*arm/i,
      /joint_r_/i,
    ],
    negative: [/left|l[_\-.]|hidari|左/, /forearm/i, /hand/i, /finger/i, /肩/, /eye|目|leg|足/],
  },
};

const TRACK_TO_ROLE: Record<TimelineBoneTrack, SkeletonRole> = {
  bone_head_y: 'head',
  bone_neck_x: 'neck',
  bone_spine_y: 'spine',
  bone_spine_z: 'spine',
  bone_waist_y: 'waist',
  bone_l_arm_x: 'l_shoulder',
  bone_l_arm_z: 'l_arm',
  bone_r_arm_x: 'r_shoulder',
  bone_r_arm_z: 'r_arm',
};

function scoreBoneName(name: string, role: SkeletonRole): number {
  let score = 0;
  for (const pattern of ROLE_PATTERNS[role].positive) {
    if (pattern.test(name)) score += 12;
  }
  for (const pattern of ROLE_PATTERNS[role].negative) {
    if (pattern.test(name)) score -= 18;
  }

  const lower = name.toLowerCase();
  if (role === 'l_arm' || role === 'l_shoulder') {
    if (/left|l[_\-.]|hidari|左/.test(lower)) score += 4;
    if (/right|r[_\-.]|migi|右/.test(lower)) score -= 12;
  }
  if (role === 'r_arm' || role === 'r_shoulder') {
    if (/right|r[_\-.]|migi|右/.test(lower)) score += 4;
    if (/left|l[_\-.]|hidari|左/.test(lower)) score -= 12;
  }

  if (role === 'head' && /joint/i.test(name) && /head|頭/i.test(name)) score += 6;
  if (role === 'neck' && /joint/i.test(name) && /neck|首/i.test(name)) score += 6;

  return score;
}

function boneDepth(bone: THREE.Bone): number {
  let depth = 0;
  let parent = bone.parent;
  while (parent && parent.type === 'Bone') {
    depth += 1;
    parent = parent.parent;
  }
  return depth;
}

function pickBoneForRole(bones: THREE.Bone[], role: SkeletonRole): THREE.Bone | null {
  let best: { bone: THREE.Bone; score: number } | null = null;

  for (const bone of bones) {
    const score = scoreBoneName(bone.name, role);
    if (score <= 0) continue;

    let adjusted = score;
    const depth = boneDepth(bone);
    if (role === 'head' && depth >= 3 && depth <= 8) adjusted += 2;
    if (role === 'waist' && depth <= 2) adjusted += 2;
    if (role === 'l_arm' || role === 'r_arm') {
      if (depth >= 4 && depth <= 10) adjusted += 1;
    }

    if (!best || adjusted > best.score) {
      best = { bone, score: adjusted };
    }
  }

  return best?.bone ?? null;
}

function pickHeadFromEyeParent(bones: THREE.Bone[]): THREE.Bone | null {
  for (const bone of bones) {
    if (!/eye|目|migime|hidarim/i.test(bone.name)) continue;
    const parent = bone.parent;
    if (parent && parent.type === 'Bone') {
      const head = parent as THREE.Bone;
      if (!/neck|首|spine|髪|hair/i.test(head.name)) return head;
    }
  }
  return null;
}

function pickHeadFallback(bones: THREE.Bone[]): THREE.Bone | null {
  const scored = bones
    .map((bone) => {
      const childBones = bone.children.filter((c) => c.type === 'Bone').length;
      const depth = boneDepth(bone);
      const name = bone.name.toLowerCase();
      let score = childBones * 2;
      if (/eye|目|hair|髪|jaw|neck|首/.test(name)) score -= 8;
      if (depth >= 3 && depth <= 7) score += 3;
      return { bone, score };
    })
    .filter((entry) => entry.score > 2)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.bone ?? null;
}

/** Build timeline track → bone name map for a generic skinned mesh. */
export function buildTimelineBoneMap(skeleton: THREE.Skeleton): TimelineBoneMap {
  const bones = skeleton.bones;
  const map: TimelineBoneMap = {};

  for (const [track, role] of Object.entries(TRACK_TO_ROLE) as Array<
    [TimelineBoneTrack, SkeletonRole]
  >) {
    const picked = pickBoneForRole(bones, role);
    if (picked) map[track] = picked.name;
  }

  if (!map.bone_head_y) {
    const fromEyes = pickHeadFromEyeParent(bones);
    if (fromEyes) map.bone_head_y = fromEyes.name;
  }

  if (!map.bone_head_y) {
    const fallback = pickHeadFallback(bones);
    if (fallback) map.bone_head_y = fallback.name;
  }

  if (!map.bone_spine_y && !map.bone_spine_z) {
    const spine = pickBoneForRole(bones, 'spine');
    if (spine) {
      map.bone_spine_y = spine.name;
      map.bone_spine_z = spine.name;
    }
  } else if (map.bone_spine_y && !map.bone_spine_z) {
    map.bone_spine_z = map.bone_spine_y;
  } else if (!map.bone_spine_y && map.bone_spine_z) {
    map.bone_spine_y = map.bone_spine_z;
  }

  return map;
}

export function getTimelineBoneMap(mesh: THREE.SkinnedMesh): TimelineBoneMap {
  const cached = mesh.userData.timelineBoneMap as TimelineBoneMap | undefined;
  if (cached && Object.keys(cached).length > 0) return cached;
  if (!mesh.skeleton) return {};
  const built = buildTimelineBoneMap(mesh.skeleton);
  mesh.userData.timelineBoneMap = built;
  return built;
}
