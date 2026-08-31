import type { ApisPhysicsProfile } from './types';

export interface ApisRuntimeState {
  modelId: string;
  profile: ApisPhysicsProfile;
  physicsFrameMs: number;
  fpsEstimate: number;
  instabilityCount: number;
  optimizationLevel: number;
  frozen: boolean;
  lastHealAt: number;
}

const runtime = new Map<string, ApisRuntimeState>();

export function initApisRuntime(modelId: string, profile: ApisPhysicsProfile): void {
  runtime.set(modelId, {
    modelId,
    profile,
    physicsFrameMs: profile.benchmark.avgFrameMs,
    fpsEstimate: 60,
    instabilityCount: 0,
    optimizationLevel: profile.optimizationLevel,
    frozen: false,
    lastHealAt: 0,
  });
}

export function getApisRuntime(modelId: string): ApisRuntimeState | undefined {
  return runtime.get(modelId);
}

export function recordApisPhysicsFrame(
  modelId: string,
  frameMs: number,
  fps?: number
): ApisRuntimeState | undefined {
  const state = runtime.get(modelId);
  if (!state) return undefined;
  state.physicsFrameMs = state.physicsFrameMs * 0.85 + frameMs * 0.15;
  if (fps !== undefined && fps > 0) {
    state.fpsEstimate = state.fpsEstimate * 0.9 + fps * 0.1;
  }
  return state;
}

export function recordApisInstability(modelId: string): number {
  const state = runtime.get(modelId);
  if (!state) return 0;
  state.instabilityCount++;
  return state.instabilityCount;
}

export function shouldReduceApisCost(modelId: string): boolean {
  const state = runtime.get(modelId);
  if (!state) return false;
  return state.fpsEstimate < 28 || state.physicsFrameMs > 12;
}

export function bumpApisOptimizationLevel(modelId: string): number {
  const state = runtime.get(modelId);
  if (!state) return 0;
  state.optimizationLevel = Math.min(5, state.optimizationLevel + 1);
  state.profile = {
    ...state.profile,
    optimizationLevel: state.optimizationLevel,
  };
  return state.optimizationLevel;
}

export function setApisFrozen(modelId: string, frozen: boolean): void {
  const state = runtime.get(modelId);
  if (state) state.frozen = frozen;
}

export function clearApisRuntime(modelId: string): void {
  runtime.delete(modelId);
}
