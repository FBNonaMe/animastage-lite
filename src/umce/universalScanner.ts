import * as THREE from 'three';
import { lookupCanonicalByName } from './boneDictionary';
import { tierToSource, umceLogBoneDetected } from './logger';
import type {
  CanonicalBoneId,
  CanonicalBoneMatch,
  UmceBoneRecord,
  UmceDetectionSource,
  UmceModelContext,
} from './types';

type CandidateMap = Map<CanonicalBoneId, CanonicalBoneMatch>;

function mergeCandidate(map: CandidateMap, match: CanonicalBoneMatch, log = true): void {
  const existing = map.get(match.canonicalId);
  if (!existing || match.confidence > existing.confidence) {
    map.set(match.canonicalId, match);
    if (log) umceLogBoneDetected(match);
  }
}

/** PASS 1–3: Japanese, English, known aliases. */
function scanByName(ctx: UmceModelContext, map: CandidateMap): void {
    for (const bone of ctx.bones) {
    const hit = lookupCanonicalByName(bone.name, bone.englishName);
    if (!hit) continue;
    mergeCandidate(
      map,
      {
        canonicalId: hit.canonicalId,
        boneIndex: bone.index,
        boneName: bone.name,
        confidence: hit.confidence,
        source: tierToSource(hit.tier),
      },
      false
    );
  }
}

/** PASS 5: Hierarchy — child of known parent. */
function scanByHierarchy(ctx: UmceModelContext, map: CandidateMap): void {
  const indexToCanonical = new Map<number, CanonicalBoneId>();
  for (const [, match] of map) {
    indexToCanonical.set(match.boneIndex, match.canonicalId);
  }

  const childRules: Array<{ parent: CanonicalBoneId; child: CanonicalBoneId; nameHints: RegExp }> = [
    { parent: 'center', child: 'spine', nameHints: /上半身|spine/i },
    { parent: 'spine', child: 'chest', nameHints: /上半身2|chest/i },
    { parent: 'chest', child: 'neck', nameHints: /首|neck/i },
    { parent: 'neck', child: 'head', nameHints: /頭|head/i },
    { parent: 'left_shoulder', child: 'left_arm', nameHints: /左腕|leftarm/i },
    { parent: 'left_arm', child: 'left_elbow', nameHints: /左ひじ|forearm/i },
    { parent: 'left_elbow', child: 'left_hand', nameHints: /左手|hand/i },
    { parent: 'right_shoulder', child: 'right_arm', nameHints: /右腕|rightarm/i },
    { parent: 'right_arm', child: 'right_elbow', nameHints: /右ひじ|forearm/i },
    { parent: 'right_elbow', child: 'right_hand', nameHints: /右手|hand/i },
    { parent: 'center', child: 'left_leg', nameHints: /左足(?!首|先)/i },
    { parent: 'left_leg', child: 'left_knee', nameHints: /左ひざ|knee|calf/i },
    { parent: 'left_knee', child: 'left_foot', nameHints: /左足首|foot/i },
    { parent: 'center', child: 'right_leg', nameHints: /右足(?!首|先)/i },
    { parent: 'right_leg', child: 'right_knee', nameHints: /右ひざ|knee|calf/i },
    { parent: 'right_knee', child: 'right_foot', nameHints: /右足首|foot/i },
  ];

  for (const bone of ctx.bones) {
    if (bone.parentIndex < 0) continue;
    const parentCanonical = indexToCanonical.get(bone.parentIndex);
    if (!parentCanonical) continue;

    for (const rule of childRules) {
      if (rule.parent !== parentCanonical) continue;
      if (!rule.nameHints.test(bone.name) && !rule.nameHints.test(bone.englishName ?? '')) continue;
      if (map.has(rule.child)) continue;
      mergeCandidate(
        map,
        {
          canonicalId: rule.child,
          boneIndex: bone.index,
          boneName: bone.name,
          confidence: 78,
          source: 'hierarchy',
        },
        false
      );
    }
  }
}

/** PASS 6: Skin weight analysis — bones that deform vertices. */
export function computeDeformWeights(
  mesh: THREE.SkinnedMesh | null,
  boneCount: number
): Float32Array {
  const weights = new Float32Array(boneCount);
  if (!mesh) return weights;

  const skinIndex = mesh.geometry.getAttribute('skinIndex');
  const skinWeight = mesh.geometry.getAttribute('skinWeight');
  if (!skinIndex || !skinWeight) return weights;

  for (let v = 0; v < skinIndex.count; v++) {
    for (let j = 0; j < 4; j++) {
      const bi = skinIndex.getComponent(v, j);
      const w = skinWeight.getComponent(v, j);
      if (w > 0 && bi < boneCount) weights[bi] += w;
    }
  }
  return weights;
}

function applyDeformWeights(bones: UmceBoneRecord[], weights: Float32Array): UmceBoneRecord[] {
  return bones.map((b) => ({ ...b, deformWeight: weights[b.index] ?? 0 }));
}

/** PASS 7–8: Mark IK / grant bones (metadata for rig analyzer). */
function annotateIkGrant(ctx: UmceModelContext, bones: UmceBoneRecord[]): UmceBoneRecord[] {
  const ikSet = new Set<number>();
  for (const ik of ctx.iks) {
    ikSet.add(ik.target);
    ikSet.add(ik.effector);
    ik.links.forEach((i) => ikSet.add(i));
  }
  const grantSet = new Set(ctx.grants.map((g) => g.boneIndex));
  return bones.map((b) => ({
    ...b,
    isIk: ikSet.has(b.index),
    isGrant: grantSet.has(b.index),
  }));
}

/** PASS 10: Geometry heuristics — position + symmetry. */
function scanByGeometry(ctx: UmceModelContext, map: CandidateMap): void {
  const bones = ctx.bones;
  if (!bones.length) return;

  const byHeight = [...bones].sort((a, b) => b.position[1] - a.position[1]);
  const top = byHeight[0];
  if (top && !map.has('head')) {
    mergeCandidate(
      map,
      {
        canonicalId: 'head',
        boneIndex: top.index,
        boneName: top.name,
        confidence: 61,
        source: 'geometry',
      },
      false
    );
  }

  const centerY = bones.reduce((s, b) => s + b.position[1], 0) / bones.length;
  const lowBones = bones.filter((b) => b.position[1] < centerY - 5);
  const leftLeg = lowBones.filter((b) => b.position[0] > 0).sort((a, b) => b.position[1] - a.position[1])[0];
  const rightLeg = lowBones.filter((b) => b.position[0] < 0).sort((a, b) => b.position[1] - a.position[1])[0];

  if (leftLeg && !map.has('left_leg')) {
    mergeCandidate(
      map,
      {
        canonicalId: 'left_leg',
        boneIndex: leftLeg.index,
        boneName: leftLeg.name,
        confidence: 64,
        source: 'geometry',
      },
      false
    );
  }
  if (rightLeg && !map.has('right_leg')) {
    mergeCandidate(
      map,
      {
        canonicalId: 'right_leg',
        boneIndex: rightLeg.index,
        boneName: rightLeg.name,
        confidence: 64,
        source: 'geometry',
      },
      false
    );
  }

  const rootCandidate = bones.find((b) => b.parentIndex < 0) ?? bones[0];
  if (rootCandidate && !map.has('center') && !map.has('root')) {
    mergeCandidate(
      map,
      {
        canonicalId: 'center',
        boneIndex: rootCandidate.index,
        boneName: rootCandidate.name,
        confidence: 55,
        source: 'geometry',
      },
      false
    );
  }
}

export interface UniversalScanResult {
  canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>>;
  bones: UmceBoneRecord[];
}

export function runUniversalScanner(
  ctx: UmceModelContext,
  mesh?: THREE.SkinnedMesh | null
): UniversalScanResult {
  const map: CandidateMap = new Map();

  scanByName(ctx, map);
  scanByHierarchy(ctx, map);

  let bones = ctx.bones;
  if (mesh) {
    const deform = computeDeformWeights(mesh, bones.length);
    bones = applyDeformWeights(bones, deform);
  }
  bones = annotateIkGrant(ctx, bones);

  scanByGeometry({ ...ctx, bones }, map);

  const canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>> = {};
  for (const [id, match] of map) {
    canonicalMap[id] = match;
    umceLogBoneDetected(match);
  }

  return { canonicalMap, bones };
}

export function buildBoneIdentities(
  bones: UmceBoneRecord[],
  canonicalMap: Partial<Record<CanonicalBoneId, CanonicalBoneMatch>>
): import('./types').UmceBoneIdentity[] {
  const indexToCanonical = new Map<number, { id: CanonicalBoneId; match: CanonicalBoneMatch }>();
  for (const [id, match] of Object.entries(canonicalMap) as [CanonicalBoneId, CanonicalBoneMatch][]) {
    indexToCanonical.set(match.boneIndex, { id, match });
  }

  return bones.map((bone) => {
    const hit = indexToCanonical.get(bone.index);
    if (hit) {
      return {
        index: bone.index,
        name: bone.name,
        internalId: `bone:${bone.index}:${bone.name}`,
        canonicalId: hit.id,
        confidence: hit.match.confidence,
        source: hit.match.source,
      };
    }
    return {
      index: bone.index,
      name: bone.name,
      internalId: `bone:${bone.index}:${bone.name}`,
      canonicalId: null,
      confidence: 0,
      source: 'fallback' as UmceDetectionSource,
    };
  });
}
