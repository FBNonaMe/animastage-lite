/**
 * Adaptive Studio UI 3.0 — breakpoint tokens for all device classes.
 * Keeps legacy MQ aliases used by useStudioLayout.
 */
export const BP = {
  xs: 320,
  sm: 375,
  phoneLg: 430,
  md: 768,
  lg: 1024,
  laptop: 1280,
  desktop: 1440,
  wide: 1680,
} as const;

export type AdaptiveLayoutId =
  | 'ultra'
  | 'phone_portrait'
  | 'phone_landscape'
  | 'phone_lg'
  | 'tablet_portrait'
  | 'tablet_landscape'
  | 'laptop'
  | 'laptop_lg'
  | 'desktop';

export const MQ = {
  xs: `(max-width: ${BP.sm - 1}px)`,
  sm: `(min-width: ${BP.sm}px) and (max-width: ${BP.md - 1}px)`,
  md: `(min-width: ${BP.md}px) and (max-width: ${BP.lg - 1}px)`,
  lg: `(min-width: ${BP.lg}px)`,
  /** Phone / narrow mobile layout (≤768px) */
  max768: `(max-width: ${BP.md}px)`,
  maxMd: `(max-width: ${BP.md - 1}px)`,
  maxLg: `(max-width: ${BP.lg - 1}px)`,
  phoneLgMax: `(max-width: ${BP.phoneLg}px)`,
  laptop: `(min-width: ${BP.laptop}px) and (max-width: ${BP.desktop - 1}px)`,
  desktop: `(min-width: ${BP.desktop}px)`,
  wide: `(min-width: ${BP.wide}px)`,
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
  reduceMotion: '(prefers-reduced-motion: reduce)',
  highContrast: '(prefers-contrast: more)',
  dark: '(prefers-color-scheme: dark)',
  light: '(prefers-color-scheme: light)',
  touch: '(pointer: coarse)',
  fine: '(pointer: fine)',
  hover: '(hover: hover)',
} as const;

/** UI scale multipliers per layout (icons, type, touch targets). */
export const LAYOUT_SCALE: Record<AdaptiveLayoutId, number> = {
  ultra: 0.92,
  phone_portrait: 1,
  phone_landscape: 0.94,
  phone_lg: 1.05,
  tablet_portrait: 1.08,
  tablet_landscape: 1.05,
  laptop: 1,
  laptop_lg: 1.02,
  desktop: 1.05,
};

/** Minimum touch target in CSS px (before scale). */
export const TOUCH_TARGET_MIN = 44;

export function resolveAdaptiveLayoutId(opts: {
  width: number;
  height: number;
  portrait: boolean;
}): AdaptiveLayoutId {
  const { width, portrait } = opts;
  if (width < BP.sm) return 'ultra';
  if (width <= BP.md) {
    if (width <= BP.phoneLg && portrait) return width < BP.sm + 20 ? 'phone_portrait' : 'phone_lg';
    return portrait ? 'phone_portrait' : 'phone_landscape';
  }
  if (width < BP.lg) {
    return portrait ? 'tablet_portrait' : 'tablet_landscape';
  }
  if (width < BP.laptop) return 'laptop';
  if (width < BP.desktop) return 'laptop_lg';
  return 'desktop';
}
