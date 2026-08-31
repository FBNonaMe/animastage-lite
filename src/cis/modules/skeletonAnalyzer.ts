import * as THREE from 'three';
import type { CisBoneEntry, CisSkeletonMap, CisSkeletonRegion } from '../types';

const REGION_PATTERNS: Array<{ region: CisSkeletonRegion; re: RegExp }> = [
  { region: 'root', re: /^(全て|すべて|root|center|センター|center$)/i },
  { region: 'center', re: /center|センター|groove|グルーブ/i },
  { region: 'spine', re: /spine|上半身|upper.?body|waist|腰|abdomen|腹/i },
  { region: 'chest', re: /chest|胸|torso|thorax/i },
  { region: 'neck', re: /neck|首|くび/i },
  { region: 'head', re: /head|頭|atama|顔|face(?!.*morph)/i },
  { region: 'shoulder_l', re: /左.*肩|shoulder.*l|l.*shoulder|shoulder_l/i },
  { region: 'shoulder_r', re: /右.*肩|shoulder.*r|r.*shoulder|shoulder_r/i },
  { region: 'arm_l', re: /左.*腕|左.*ひじ|l.*arm|arm.*l|elbow.*l|hand.*l|left.*arm/i },
  { region: 'arm_r', re: /右.*腕|右.*ひじ|r.*arm|arm.*r|elbow.*r|hand.*r|right.*arm/i },
  { region: 'hand_l', re: /左.*手|l.*hand|hand.*l|left.*hand|親指.*左|小指.*左/i },
  { region: 'hand_r', re: /右.*手|r.*hand|hand.*r|right.*hand|親指.*右|小指.*右/i },
  { region: 'finger', re: /指|finger|thumb|親指|人差|中指|薬指|小指/i },
  { region: 'leg_l', re: /左.*足|左.*腿|左.*ひざ|l.*leg|leg.*l|thigh.*l|knee.*l|left.*leg/i },
  { region: 'leg_r', re: /右.*足|右.*腿|右.*ひざ|r.*leg|leg.*r|thigh.*r|knee.*r|right.*leg/i },
  { region: 'foot_l', re: /左.*足首|左.*つま|l.*foot|foot.*l|toe.*l|left.*foot|ankle.*l/i },
  { region: 'foot_r', re: /右.*足首|右.*つま|r.*foot|foot.*r|toe.*r|right.*foot|ankle.*r/i },
  { region: 'ik', re: /ik|ＩＫ|target|effector|ターゲット/i },
  { region: 'helper', re: /補助|helper|dummy|dum|_|\.|twist|捩/i },
  { region: 'hidden', re: /非表示|hidden|invisible|display.?off/i },
  { region: 'physics', re: /物理|physics|rigid|cloth|skirt|hair|skirt|スカート|髪/i },
  { region: 'morph', re: /morph|モーフ|blend/i },
];

function classifyBone(name: string, mmd?: { flag?: number }): CisSkeletonRegion {
  if (mmd?.flag != null && (mmd.flag & 0x08) !== 0) return 'hidden';
  for (const { region, re } of REGION_PATTERNS) {
    if (re.test(name)) return region;
  }
  return 'unknown';
}

function boneLength(bone: THREE.Bone): number {
  let max = 0;
  for (const child of bone.children) {
    if (child.type === 'Bone') {
      max = Math.max(max, child.position.length());
    }
  }
  return max;
}

function computeSymmetry(bones: CisBoneEntry[]): number {
  const left = bones.filter((b) => /左|l_|_l|left/i.test(b.name)).length;
  const right = bones.filter((b) => /右|r_|_r|right/i.test(b.name)).length;
  if (left === 0 && right === 0) return 85;
  const ratio = Math.min(left, right) / Math.max(left, right, 1);
  return Math.round(50 + ratio * 50);
}

export function analyzeSkeleton(mesh: THREE.SkinnedMesh): CisSkeletonMap {
  const mmd = mesh.geometry.userData.MMD as
    | { bones?: Array<{ name?: string; parentIndex?: number; flag?: number }>; iks?: unknown[] }
    | undefined;

  const skeletonBones = mesh.skeleton?.bones ?? [];
  const mmdBones = mmd?.bones ?? [];
  const nameToParent = new Map<string, string | null>();

  if (mmdBones.length > 0) {
    mmdBones.forEach((b, i) => {
      const parentIdx = b.parentIndex ?? -1;
      const parentName =
        parentIdx >= 0 && parentIdx < mmdBones.length
          ? (mmdBones[parentIdx]?.name ?? null)
          : null;
      nameToParent.set(b.name ?? `bone_${i}`, parentName);
    });
  } else {
    skeletonBones.forEach((bone) => {
      const parent = bone.parent?.type === 'Bone' ? bone.parent.name : null;
      nameToParent.set(bone.name, parent);
    });
  }

  const depthCache = new Map<string, number>();
  function depth(name: string): number {
    if (depthCache.has(name)) return depthCache.get(name)!;
    const parent = nameToParent.get(name);
    const d = parent ? depth(parent) + 1 : 0;
    depthCache.set(name, d);
    return d;
  }

  const boneMap = new Map(skeletonBones.map((b) => [b.name, b]));
  const entries: CisBoneEntry[] = skeletonBones.map((bone, i) => {
    const mmdBone = mmdBones[i];
    const name = bone.name;
    const region = classifyBone(name, mmdBone);
    return {
      name,
      parentName: nameToParent.get(name) ?? null,
      depth: depth(name),
      region,
      length: boneLength(bone),
      isIk: region === 'ik' || /ik/i.test(name),
      isHelper: region === 'helper',
      isPhysics: region === 'physics',
      isHidden: region === 'hidden',
    };
  });

  const regions: Partial<Record<CisSkeletonRegion, string[]>> = {};
  for (const entry of entries) {
    if (!regions[entry.region]) regions[entry.region] = [];
    regions[entry.region]!.push(entry.name);
  }

  const ikChainCount = mmd?.iks?.length ?? entries.filter((b) => b.isIk).length;
  const hierarchyDepth = Math.max(0, ...entries.map((b) => b.depth));

  return {
    bones: entries,
    boneCount: entries.length,
    ikChainCount,
    helperBoneCount: entries.filter((b) => b.isHelper).length,
    physicsBoneCount: entries.filter((b) => b.isPhysics).length,
    symmetryScore: computeSymmetry(entries),
    hierarchyDepth,
    regions,
  };
}
