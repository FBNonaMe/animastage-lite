import { useMemo } from 'react';
import type { CompositionGuideId } from '../../referenceCamera';
import { compositionGuideLines } from '../../referenceCamera';

const STROKE: Record<string, string> = {
  third: 'rgba(255,255,255,0.35)',
  golden: 'rgba(251,191,36,0.4)',
  center: 'rgba(57,197,187,0.45)',
  safe: 'rgba(248,113,113,0.4)',
};

interface CompositionGuidesOverlayProps {
  guide: CompositionGuideId;
}

export default function CompositionGuidesOverlay({ guide }: CompositionGuidesOverlayProps) {
  const lines = useMemo(() => compositionGuideLines(guide), [guide]);
  if (guide === 'none' || lines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 z-[14] pointer-events-none w-full h-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={STROKE[l.kind] ?? 'rgba(255,255,255,0.3)'}
          strokeWidth={l.kind === 'safe' ? 0.004 : 0.002}
        />
      ))}
    </svg>
  );
}
