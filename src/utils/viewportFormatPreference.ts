import type { ViewportFormat } from '../types';
import { isNativeApp } from './platform';

const STORAGE_KEY = 'as_viewport_format_v1';

/** Formats users can pick on phone (export aspect). */
export const MOBILE_ASPECT_CHOICES: ViewportFormat[] = ['9:16', '16:9'];

/**
 * Default aspect:
 * - Android / Capacitor → 9:16 (Shorts / Reels)
 * - Desktop web → 16:9
 * Persisted once the user picks an option.
 */
export function defaultViewportFormat(): ViewportFormat {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ViewportFormat | null;
    if (saved === '9:16' || saved === '16:9' || saved === '1:1' || saved === '4:5' || saved === '21:9' || saved === '4:3') {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return isNativeApp() ? '9:16' : '16:9';
}

export function persistViewportFormat(format: ViewportFormat): void {
  try {
    localStorage.setItem(STORAGE_KEY, format);
  } catch {
    /* ignore */
  }
}
