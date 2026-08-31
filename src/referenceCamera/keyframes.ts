import type { CameraKeyframe } from '../types';
import { catmullRom3 } from './cinematicInterp';

/** Sample positions along keyframe path for viewport spline drawing. */
export function sampleCameraPath(
  keyframes: CameraKeyframe[],
  samplesPerSegment = 12
): [number, number, number][] {
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  if (sorted.length === 0) return [];
  if (sorted.length === 1) return [[...sorted[0].position]];

  const points: [number, number, number][] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i].position;
    const b = sorted[i + 1].position;
    const p0 = sorted[Math.max(0, i - 1)].position;
    const p3 = sorted[Math.min(sorted.length - 1, i + 2)].position;
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      points.push(catmullRom3(p0, a, b, p3, t));
    }
  }
  points.push([...sorted[sorted.length - 1].position]);
  return points;
}

export function duplicateCameraKeyframe(
  keyframes: CameraKeyframe[],
  id: string,
  frameOffset = 10
): CameraKeyframe[] {
  const src = keyframes.find((k) => k.id === id);
  if (!src) return keyframes;
  const copy: CameraKeyframe = {
    ...src,
    id: `cam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    frame: src.frame + frameOffset,
    position: [...src.position],
    rotation: [...src.rotation],
    target: src.target ? [...src.target] : undefined,
  };
  return [...keyframes, copy].sort((a, b) => a.frame - b.frame);
}

export function moveCameraKeyframe(
  keyframes: CameraKeyframe[],
  id: string,
  toFrame: number
): CameraKeyframe[] {
  return keyframes
    .map((k) => (k.id === id ? { ...k, frame: Math.max(0, Math.round(toFrame)) } : k))
    .sort((a, b) => a.frame - b.frame);
}

export function patchCameraKeyframe(
  keyframes: CameraKeyframe[],
  id: string,
  patch: Partial<CameraKeyframe>
): CameraKeyframe[] {
  return keyframes
    .map((k) => (k.id === id ? { ...k, ...patch, id: k.id } : k))
    .sort((a, b) => a.frame - b.frame);
}
