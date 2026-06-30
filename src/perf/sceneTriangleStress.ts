import { setPerfGovernorTriangleFloor } from './controller/perfGovernor';

let sceneTriangles = 0;
let visibleModelCount = 1;

export function setSceneTriangleCount(count: number): void {
  sceneTriangles = Math.max(0, count | 0);
}

export function getSceneTriangleCount(): number {
  return sceneTriangles;
}

export function setVisibleModelCount(count: number): void {
  visibleModelCount = Math.max(1, count | 0);
}

export function getVisibleModelCount(): number {
  return visibleModelCount;
}

/** Soft pre-scale: trim FX via tier, avoid slamming DPR on heavy imports. */
export function syncTriangleStressGovernor(): void {
  const n = sceneTriangles;
  let floor = 0;
  if (n >= 900_000) floor = 3;
  else if (n >= 600_000) floor = 2;
  else if (n >= 400_000) floor = 1;
  if (visibleModelCount >= 2) floor = Math.max(floor, 1);
  if (visibleModelCount >= 3) floor = Math.max(floor, 2);
  setPerfGovernorTriangleFloor(floor);
}
