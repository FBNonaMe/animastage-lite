import { useMemo } from 'react';
import { MQ } from '../layout/breakpoints';
import { isNativeApp } from '../utils/platform';
import { useMediaQuery } from './useMediaQuery';

export type MobilePanelTab = 'scene' | 'composer' | 'control' | 'camera' | 'fx';

export interface StudioLayout {
  /** iPhone SE width */
  isXs: boolean;
  /** 375px+ phone */
  isSmUp: boolean;
  /** 768–1023 tablet */
  isTablet: boolean;
  /** 1024+ desktop */
  isDesktop: boolean;
  /** ≤768px — dedicated mobile layout (drawers, bottom sheet) */
  isMobileLayout: boolean;
  /** @deprecated Alias for isMobileLayout (CSS class studio-mobile-column) */
  isMobileColumn: boolean;
  /** Landscape on phone / native — sidebar + timeline like desktop */
  isMobileLandscape: boolean;
  /** Any compact studio (not desktop) */
  isCompactStudio: boolean;
  /** Apply SAFE perf caps (DPR, FX, physics, textures) */
  applyMobileSafeMode: boolean;
  /** Immersive Pro Mobile shell (≤768px portrait-style) */
  isProMobile: boolean;
}

export function useStudioLayout(): StudioLayout {
  const isXs = useMediaQuery(MQ.xs);
  const isMax768 = useMediaQuery(MQ.max768);
  const isMaxMd = useMediaQuery(MQ.maxMd);
  const isMaxLg = useMediaQuery(MQ.maxLg);
  const isMd = useMediaQuery(MQ.md);
  const isLg = useMediaQuery(MQ.lg);
  const isPortrait = useMediaQuery(MQ.portrait);
  const isLandscape = useMediaQuery(MQ.landscape);

  return useMemo(() => {
    const native = isNativeApp();
    const nativeLandscape = native && isLandscape;

    const isDesktop = isLg || (nativeLandscape && !isPortrait);
    const isTablet = isMd && !isLg && !nativeLandscape;
    /** Mobile layout only ≤768px — tablets keep desktop shell */
    const isMobileLayout = isMax768;
    const isMobileColumn = isMobileLayout;
    const isMobileLandscape =
      !isDesktop && !isMobileLayout && isLandscape && (isMaxMd || isTablet);
    const isCompactStudio = !isDesktop;
    const applyMobileSafeMode = isMobileLayout;

    return {
      isXs,
      isSmUp: !isXs,
      isTablet,
      isDesktop,
      isMobileLayout,
      isMobileColumn,
      isMobileLandscape,
      isCompactStudio,
      applyMobileSafeMode,
      isProMobile: isMobileLayout,
    };
  }, [isXs, isMax768, isMaxMd, isMaxLg, isMd, isLg, isPortrait, isLandscape]);
}

/** Mobile layout breakpoint (≤768px). */
export function useIsMobileStudio(): boolean {
  return useStudioLayout().isMobileLayout;
}
