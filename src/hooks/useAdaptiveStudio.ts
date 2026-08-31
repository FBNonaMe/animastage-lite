/**
 * Adaptive Studio UI 3.0 — layout + scale resolution for all devices.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  LAYOUT_SCALE,
  MQ,
  TOUCH_TARGET_MIN,
  resolveAdaptiveLayoutId,
  type AdaptiveLayoutId,
} from '../layout/breakpoints';
import { isNativeApp } from '../utils/platform';
import { useMediaQuery } from './useMediaQuery';
import { useStudioLayout, type StudioLayout } from './useStudioLayout';

export type PanelChromeMode = 'docked' | 'collapsible' | 'drawer' | 'sheet';
export type ToolbarMode = 'full' | 'grouped' | 'compact';
export type TimelineMode = 'full' | 'adaptive' | 'collapsible' | 'floating';

export interface AdaptiveStudioState extends StudioLayout {
  layoutId: AdaptiveLayoutId;
  /** CSS --studio-ui-scale */
  uiScale: number;
  touchTargetMin: number;
  isTouchPrimary: boolean;
  prefersReducedMotion: boolean;
  prefersHighContrast: boolean;
  panelChrome: PanelChromeMode;
  toolbarMode: ToolbarMode;
  timelineMode: TimelineMode;
  /** Collapse secondary docks to prioritize viewport */
  prioritizeViewport: boolean;
  /** Show bottom navigation (phone) */
  useBottomNav: boolean;
  /** Safe-area padding class helpers */
  safeAreaClass: string;
}

function panelChromeFor(id: AdaptiveLayoutId): PanelChromeMode {
  switch (id) {
    case 'ultra':
    case 'phone_portrait':
    case 'phone_lg':
    case 'phone_landscape':
      return 'sheet';
    case 'tablet_portrait':
      return 'drawer';
    case 'tablet_landscape':
      return 'collapsible';
    default:
      return 'docked';
  }
}

function toolbarFor(id: AdaptiveLayoutId): ToolbarMode {
  if (id === 'ultra' || id === 'phone_portrait' || id === 'phone_landscape') return 'compact';
  if (id.startsWith('tablet') || id === 'phone_lg') return 'grouped';
  return 'full';
}

function timelineFor(id: AdaptiveLayoutId): TimelineMode {
  if (id === 'ultra' || id === 'phone_portrait') return 'floating';
  if (id === 'phone_landscape' || id === 'phone_lg') return 'collapsible';
  if (id.startsWith('tablet')) return 'adaptive';
  return 'full';
}

export function useAdaptiveStudio(): AdaptiveStudioState {
  const base = useStudioLayout();
  const isTouchPrimary = useMediaQuery(MQ.touch);
  const prefersReducedMotion = useMediaQuery(MQ.reduceMotion);
  const prefersHighContrast = useMediaQuery(MQ.highContrast);
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const syncAppHeight = () => {
      const vv = window.visualViewport;
      const h = vv?.height ?? window.innerHeight;
      const next = {
        width: Math.round(vv?.width ?? window.innerWidth),
        height: Math.round(h),
      };
      document.documentElement.style.setProperty('--app-height', `${next.height}px`);
      setSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next
      );
    };
    syncAppHeight();
    window.addEventListener('resize', syncAppHeight);
    window.visualViewport?.addEventListener('resize', syncAppHeight);
    window.visualViewport?.addEventListener('scroll', syncAppHeight);
    return () => {
      window.removeEventListener('resize', syncAppHeight);
      window.visualViewport?.removeEventListener('resize', syncAppHeight);
      window.visualViewport?.removeEventListener('scroll', syncAppHeight);
    };
  }, []);

  const layoutId = useMemo(
    () =>
      resolveAdaptiveLayoutId({
        width: size.width,
        height: size.height,
        portrait: size.height >= size.width,
      }),
    [size.height, size.width]
  );

  const uiScale = LAYOUT_SCALE[layoutId];
  const panelChrome = panelChromeFor(layoutId);
  const toolbarMode = toolbarFor(layoutId);
  const timelineMode = timelineFor(layoutId);
  const prioritizeViewport =
    layoutId.startsWith('phone') || layoutId === 'ultra' || layoutId === 'tablet_portrait';
  const useBottomNav = base.isProMobile || layoutId === 'phone_portrait' || layoutId === 'ultra';

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.studioLayout = layoutId;
    root.dataset.studioTouch = isTouchPrimary || isNativeApp() ? '1' : '0';
    root.style.setProperty('--studio-ui-scale', String(uiScale));
    root.style.setProperty('--studio-touch-min', `${Math.round(TOUCH_TARGET_MIN * uiScale)}px`);
    root.style.setProperty(
      '--studio-font-scale',
      String(Math.max(0.9, Math.min(1.15, uiScale)))
    );
    root.style.setProperty(
      '--studio-space-scale',
      String(Math.max(0.88, Math.min(1.12, uiScale)))
    );
  }, [isTouchPrimary, layoutId, uiScale]);

  return {
    ...base,
    layoutId,
    uiScale,
    touchTargetMin: Math.round(TOUCH_TARGET_MIN * uiScale),
    isTouchPrimary: isTouchPrimary || isNativeApp(),
    prefersReducedMotion,
    prefersHighContrast,
    panelChrome,
    toolbarMode,
    timelineMode,
    prioritizeViewport,
    useBottomNav,
    safeAreaClass: 'studio-safe-area',
  };
}
