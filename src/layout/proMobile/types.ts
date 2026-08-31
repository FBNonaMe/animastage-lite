/** Bottom nav + sheet tabs (Play is action-only, not a sheet). */
export type ProMobileTab = 'scene' | 'control' | 'camera' | 'fx';

export type ProSnapLevel = 0 | 1 | 2 | 3;

export const PRO_SNAP_VH: Record<ProSnapLevel, number> = {
  0: 0,
  1: 28,
  2: 52,
  /** Leave a viewport peek so the sheet never feels full-screen takeover. */
  3: 85,
};
