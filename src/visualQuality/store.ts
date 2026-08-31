/**
 * Visual Quality 2.0 preference + debug store (localStorage).
 */
import type { VqBudget, VqQualityPreset } from './types';

const PRESET_KEY = 'animastage.vqPreset';
const AB_KEY = 'animastage.vqLegacyCompare';
const DEBUG_KEY = 'animastage.vqDebug';
const PHOTO_KEY = 'animastage.vqPhotoMode';

export interface VqStoreSnapshot {
  preferredPreset: VqQualityPreset | null;
  legacyCompare: boolean;
  debugHud: boolean;
  photoMode: boolean;
  /** Last resolved budget (for HUD). */
  lastBudget: VqBudget | null;
  fogOwner: string;
  particleCount: number;
  frameMs: number;
  activePasses: string[];
}

type Listener = () => void;

let preferredPreset: VqQualityPreset | null = null;
let legacyCompare = false;
let debugHud = false;
let photoMode = false;
let lastBudget: VqBudget | null = null;
let fogOwner = 'none';
let particleCount = 0;
let frameMs = 0;
let activePasses: string[] = [];
const listeners = new Set<Listener>();

function buildSnapshot(): VqStoreSnapshot {
  return {
    preferredPreset,
    legacyCompare,
    debugHud,
    photoMode,
    lastBudget,
    fogOwner,
    particleCount,
    frameMs,
    activePasses,
  };
}

/** Stable reference for useSyncExternalStore — must not allocate on every read. */
let snapshot: VqStoreSnapshot = buildSnapshot();

function refreshSnapshot(): void {
  snapshot.preferredPreset = preferredPreset;
  snapshot.legacyCompare = legacyCompare;
  snapshot.debugHud = debugHud;
  snapshot.photoMode = photoMode;
  snapshot.lastBudget = lastBudget;
  snapshot.fogOwner = fogOwner;
  snapshot.particleCount = particleCount;
  snapshot.frameMs = frameMs;
  snapshot.activePasses = activePasses;
}

function load(): void {
  try {
    const p = localStorage.getItem(PRESET_KEY);
    if (
      p === 'preview' ||
      p === 'fast' ||
      p === 'balanced' ||
      p === 'high' ||
      p === 'ultra' ||
      p === 'cinematic' ||
      p === 'photo'
    ) {
      preferredPreset = p;
    }
    legacyCompare = localStorage.getItem(AB_KEY) === '1';
    debugHud = localStorage.getItem(DEBUG_KEY) === '1';
    photoMode = localStorage.getItem(PHOTO_KEY) === '1';
  } catch {
    /* ignore */
  }
}

load();
refreshSnapshot();

function emit(): void {
  refreshSnapshot();
  listeners.forEach((l) => l());
}

export function subscribeVqStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVqStoreSnapshot(): VqStoreSnapshot {
  return snapshot;
}

export function getVqStoreServerSnapshot(): VqStoreSnapshot {
  return snapshot;
}

export function setVqPreferredPreset(preset: VqQualityPreset | null): void {
  preferredPreset = preset;
  try {
    if (preset) localStorage.setItem(PRESET_KEY, preset);
    else localStorage.removeItem(PRESET_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export function setVqLegacyCompare(on: boolean): void {
  legacyCompare = on;
  try {
    localStorage.setItem(AB_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  emit();
}

export function setVqDebugHud(on: boolean): void {
  debugHud = on;
  try {
    localStorage.setItem(DEBUG_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  emit();
}

export function setVqPhotoMode(on: boolean): void {
  photoMode = on;
  try {
    localStorage.setItem(PHOTO_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  emit();
}

/** Temporary photo lock for still capture (not persisted). */
export function withVqPhotoCapture<T>(fn: () => Promise<T>): Promise<T> {
  const prev = photoMode;
  photoMode = true;
  emit();
  return fn().finally(() => {
    photoMode = prev;
    emit();
  });
}

export function reportVqRuntime(patch: {
  budget?: VqBudget;
  fogOwner?: string;
  particleCount?: number;
  frameMs?: number;
  activePasses?: string[];
}): void {
  if (patch.budget) lastBudget = patch.budget;
  if (patch.fogOwner != null) fogOwner = patch.fogOwner;
  if (patch.particleCount != null) particleCount = patch.particleCount;
  if (patch.frameMs != null) frameMs = patch.frameMs;
  if (patch.activePasses) activePasses = patch.activePasses;
  if (debugHud) emit();
}
