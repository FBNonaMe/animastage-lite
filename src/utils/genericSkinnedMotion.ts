import * as THREE from 'three';
import { MMDAnimationHelper, MMDLoader } from 'three-stdlib';
import '../utils/mmdCharsetPatch';
import {
  buildMotionCompatibilityMap,
  buildUmceAnimationClip,
  extractUmceContextFromMesh,
  extractVmdBoneNames,
  parseVmdBuffer,
  runUniversalScanner,
} from '../umce';
import type { VmdMotionData } from '../umce/types';
import { buildTimelineBoneMap } from './genericSkeletonBinding';
import { normalizeBlobFetchUrl, resolveAssetUrl } from './mmdFiles';
import { fetchVmdArrayBuffer } from './vmdBlobCache';
import { getPhysicsAddParams } from './mmdCharacterPhysics';
import { frameToTime } from './animationSync';
import { MMD_FPS } from './playhead';
import { scrubMmdHelperToTime } from './mmdMotionLite';
import {
  applyTimelineToSkinnedMesh,
  evaluateTimelineAtFrame,
  getDefaultLiveValues,
  snapshotMmdRestPose,
  type TimelineKeyframe,
  type TimelineLiveValues,
} from '../components/TimelineLogic';

function mergeVmdMotions(vmds: VmdMotionData[]): VmdMotionData {
  const base = { ...vmds[0]!, motions: [...(vmds[0]!.motions ?? [])] };
  for (let i = 1; i < vmds.length; i++) {
    base.motions.push(...(vmds[i]?.motions ?? []));
  }
  return base;
}

export async function loadVmdClipForSkinnedMesh(
  mesh: THREE.SkinnedMesh,
  vmdBlobUrls: string[],
  fileMap?: Record<string, string>,
  vmdBoneRemap: Record<string, string> = {}
): Promise<THREE.AnimationClip> {
  const loader = new MMDLoader();
  const fetchUrls = vmdBlobUrls.map((u) =>
    fileMap ? (resolveAssetUrl(u, fileMap) ?? normalizeBlobFetchUrl(u)) : normalizeBlobFetchUrl(u)
  );

  const buffers = await Promise.all(fetchUrls.map((url) => fetchVmdArrayBuffer(url)));

  const vmds = await Promise.all(buffers.map((b) => parseVmdBuffer(b)));
  const vmd = vmds.length === 1 ? vmds[0]! : mergeVmdMotions(vmds);

  const ctx = extractUmceContextFromMesh(mesh);
  const { canonicalMap, bones } = runUniversalScanner(ctx, mesh);
  const motion = buildMotionCompatibilityMap(extractVmdBoneNames(vmd), bones, canonicalMap);
  const remap = { ...motion.remapTable, ...vmdBoneRemap };
  const isMmdMesh = Boolean((mesh.userData as { MMD?: unknown })?.MMD);
  const needsUmce =
    !isMmdMesh ||
    motion.mappedCount === 0 ||
    motion.unmappedBones.length > 0 ||
    Object.entries(remap).some(([k, v]) => k !== v);

  if (needsUmce) {
    if (motion.mappedCount === 0) {
      console.warn(
        '[VMD] No bones mapped to this skeleton — open Retarget Editor or use a humanoid/MMD-compatible rig.'
      );
    }
    return buildUmceAnimationClip(loader, vmd, mesh, remap);
  }

  return buildUmceAnimationClip(loader, vmd, mesh, remap);
}

export function createSkinnedAnimationHelper(): MMDAnimationHelper {
  return new MMDAnimationHelper();
}

export function attachSkinnedMeshToHelper(
  helper: MMDAnimationHelper,
  mesh: THREE.SkinnedMesh,
  clip?: THREE.AnimationClip
): void {
  helper.add(
    mesh,
    getPhysicsAddParams(false, undefined, { animation: clip }) as unknown as Parameters<
      MMDAnimationHelper['add']
    >[1]
  );
  helper.enable('animation', Boolean(clip));
  helper.enable('ik', true);
  helper.enable('grant', Boolean(clip));
  helper.enable('physics', false);
}

export function updateSkinnedVmdPlayback(
  helper: MMDAnimationHelper,
  mesh: THREE.SkinnedMesh,
  opts: {
    playing: boolean;
    frame: number;
    playSpeed: number;
    delta: number;
    /** Offline encode / paused scrub — exact frame pose via helper-safe seek. */
    scrub?: boolean;
  }
): void {
  const speedFactor = Math.max(0.001, opts.playSpeed / MMD_FPS);
  const scrub = Boolean(opts.scrub);
  const time = frameToTime(opts.frame, MMD_FPS);

  helper.enable('animation', true);

  if (scrub || !opts.playing) {
    scrubMmdHelperToTime(helper, mesh, time);
    return;
  }

  // Live / viewport play — delta only. Never seek+update(0) (freezes MMD pose).
  helper.update(opts.delta * speedFactor);
  mesh.skeleton?.update();
}

export function applyTemplatePoseToMesh(
  mesh: THREE.SkinnedMesh,
  keyframes: TimelineKeyframe[],
  frame: number,
  live?: TimelineLiveValues
): void {
  if (keyframes.length === 0) return;
  const liveValues =
    live ??
    getDefaultLiveValues([], { eyes: 0, mouth: 0, brow: 0 });
  const evaluated = evaluateTimelineAtFrame(keyframes, frame, liveValues);
  applyTimelineToSkinnedMesh(mesh, evaluated);
}

export function prepareSkinnedMeshForMotion(mesh: THREE.SkinnedMesh): void {
  snapshotMmdRestPose(mesh);
  if (mesh.skeleton) {
    mesh.userData.timelineBoneMap = buildTimelineBoneMap(mesh.skeleton);
  }
}
