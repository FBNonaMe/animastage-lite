import type { CameraSnapshot } from '../types';

const STORAGE_KEY = 'webmmd_camera_bookmarks_v1';
const MAX_SLOTS = 12;

export interface CameraBookmark {
  id: string;
  name: string;
  snapshot: CameraSnapshot;
  createdAt: number;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Keep stored snapshots compact — avoids blowing localStorage quota. */
export function compactCameraSnapshot(snapshot: CameraSnapshot): CameraSnapshot {
  return {
    position: snapshot.position.map(round3) as [number, number, number],
    rotation: snapshot.rotation.map(round3) as [number, number, number],
    fov: round3(snapshot.fov),
    target: snapshot.target.map(round3) as [number, number, number],
  };
}

function compactBookmark(b: CameraBookmark): CameraBookmark {
  return {
    id: b.id,
    name: (b.name || 'Cam').slice(0, 48),
    snapshot: compactCameraSnapshot(b.snapshot),
    createdAt: b.createdAt,
  };
}

function isQuotaExceeded(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === 'QuotaExceededError' ||
    e.code === 22 ||
    e.code === 1014 ||
    /quota/i.test(e.message ?? '')
  );
}

export function loadCameraBookmarks(): CameraBookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CameraBookmark[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(compactBookmark).slice(0, MAX_SLOTS);
  } catch {
    return [];
  }
}

export type SaveCameraBookmarksResult = {
  ok: boolean;
  bookmarks: CameraBookmark[];
  trimmed: boolean;
  message?: string;
};

/**
 * Persist bookmarks. On QuotaExceeded, drop oldest entries until it fits
 * (or clear the key). Never throws QuotaExceededError to the UI.
 */
export function saveCameraBookmarks(bookmarks: CameraBookmark[]): SaveCameraBookmarksResult {
  let next = bookmarks.map(compactBookmark).slice(0, MAX_SLOTS);
  let trimmed = false;

  const tryWrite = (list: CameraBookmark[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      if (!isQuotaExceeded(err)) {
        console.warn('[CameraBookmarks] save failed:', err);
        return false;
      }
      return false;
    }
  };

  if (tryWrite(next)) {
    return { ok: true, bookmarks: next, trimmed: false };
  }

  // Quota exceeded — peel oldest bookmarks until write succeeds.
  trimmed = true;
  while (next.length > 0) {
    next = next.slice(1);
    if (tryWrite(next)) {
      return {
        ok: true,
        bookmarks: next,
        trimmed: true,
        message: 'Storage full — kept newest camera bookmarks only.',
      };
    }
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }

  return {
    ok: false,
    bookmarks: [],
    trimmed: true,
    message: 'Browser storage is full — could not save camera bookmarks.',
  };
}

export function addCameraBookmark(
  name: string,
  snapshot: CameraSnapshot,
  bookmarks: CameraBookmark[]
): CameraBookmark[] {
  const entry: CameraBookmark = {
    id: `cam_${Date.now()}`,
    name: (name.trim() || `Cam ${bookmarks.length + 1}`).slice(0, 48),
    snapshot: compactCameraSnapshot(snapshot),
    createdAt: Date.now(),
  };
  return [...bookmarks, entry].slice(-MAX_SLOTS);
}

export function removeCameraBookmark(
  id: string,
  bookmarks: CameraBookmark[]
): CameraBookmark[] {
  return bookmarks.filter((b) => b.id !== id);
}

export function exportBookmarksJson(bookmarks: CameraBookmark[]): string {
  return JSON.stringify(bookmarks.map(compactBookmark), null, 2);
}

export function importBookmarksJson(json: string): CameraBookmark[] {
  const parsed = JSON.parse(json) as CameraBookmark[];
  if (!Array.isArray(parsed)) throw new Error('Invalid bookmark file');
  return parsed.map(compactBookmark).slice(0, MAX_SLOTS);
}
