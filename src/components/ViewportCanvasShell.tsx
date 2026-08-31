import React from 'react';
import type { ViewportFormat } from '../types';
import {
  VIEWPORT_916_HEIGHT,
  VIEWPORT_916_WIDTH,
  isFramedViewportFormat,
  viewportAspectCss,
} from '../utils/viewportFormat';
import { useStudioLayout } from '../hooks/useStudioLayout';

interface ViewportCanvasShellProps {
  format: ViewportFormat;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps the R3F canvas.
 * Phone / Pro Mobile: always full-bleed (no 16:9 letterbox void).
 * Desktop: full-bleed in 16:9, framed preview for other aspects.
 */
export default function ViewportCanvasShell({
  format,
  children,
  className = '',
}: ViewportCanvasShellProps) {
  const { isMobileColumn, isProMobile, isMobileLayout } = useStudioLayout();
  /** Any phone shell — fill the stage; never leave a black letterbox half-screen. */
  const mobileFill = isProMobile || isMobileLayout || isMobileColumn;
  const is916 = format === '9:16';
  const framed = is916 || isFramedViewportFormat(format);

  let outerClass =
    'flex-1 relative min-h-0 overflow-hidden w-full ' +
    (isMobileColumn && !mobileFill ? 'flex items-center justify-center ' : '') +
    className;

  let outerExtra: React.CSSProperties | undefined;
  let innerClass = isMobileColumn && !framed && !mobileFill ? 'w-full max-h-full aspect-video' : 'absolute inset-0';
  let innerStyle: React.CSSProperties | undefined;

  if (mobileFill) {
    // Edit on phone: canvas fills the available stage edge-to-edge.
    outerClass = `absolute inset-0 w-full h-full overflow-hidden bg-[#0d0e11] ${className}`;
    innerClass = 'absolute inset-0 w-full h-full';
    innerStyle = undefined;
  } else if (is916) {
    outerClass = `flex-1 flex items-center justify-center min-h-0 overflow-hidden w-full bg-[#060608] ${className}`;
    innerClass =
      'relative overflow-hidden shrink-0 shadow-[0_0_60px_rgba(57,197,187,0.08)] ring-1 ring-zinc-800/80';
    innerStyle = { width: VIEWPORT_916_WIDTH, height: VIEWPORT_916_HEIGHT };
  } else if (framed) {
    const aspect = viewportAspectCss(format);
    outerClass = `flex-1 flex items-center justify-center min-h-0 overflow-hidden w-full bg-[#060608] ${className}`;
    innerClass = 'relative overflow-hidden shrink-0 ring-1 ring-zinc-800/80';
    innerStyle = {
      aspectRatio: aspect,
      maxHeight: '100%',
      maxWidth: '100%',
      width: format === '21:9' ? '100%' : undefined,
      height: format === '21:9' ? 'auto' : '100%',
    };
  }

  return (
    <div className={outerClass} style={outerExtra} data-viewport-format={format}>
      <div className={innerClass} style={innerStyle}>
        {children}
      </div>
    </div>
  );
}
