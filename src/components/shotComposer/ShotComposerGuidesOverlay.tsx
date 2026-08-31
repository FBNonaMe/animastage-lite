/** Composition guide overlay for Shot Composer. */
import type { CompositionGuideId } from '../../shotComposer';

interface ShotComposerGuidesOverlayProps {
  guides: CompositionGuideId[];
  aspectLabel?: string;
}

export default function ShotComposerGuidesOverlay({
  guides,
  aspectLabel,
}: ShotComposerGuidesOverlayProps) {
  if (!guides.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
      {guides.includes('thirds') ? (
        <svg className="absolute inset-0 w-full h-full" aria-hidden>
          <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="rgba(57,197,187,0.35)" strokeWidth="1" />
          <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="rgba(57,197,187,0.35)" strokeWidth="1" />
          <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="rgba(57,197,187,0.35)" strokeWidth="1" />
          <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="rgba(57,197,187,0.35)" strokeWidth="1" />
        </svg>
      ) : null}
      {guides.includes('center') ? (
        <svg className="absolute inset-0 w-full h-full" aria-hidden>
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
        </svg>
      ) : null}
      {guides.includes('golden') ? (
        <svg className="absolute inset-0 w-full h-full" aria-hidden>
          <line x1="38.2%" y1="0" x2="38.2%" y2="100%" stroke="rgba(251,191,36,0.3)" strokeWidth="1" />
          <line x1="61.8%" y1="0" x2="61.8%" y2="100%" stroke="rgba(251,191,36,0.3)" strokeWidth="1" />
          <line x1="0" y1="38.2%" x2="100%" y2="38.2%" stroke="rgba(251,191,36,0.3)" strokeWidth="1" />
          <line x1="0" y1="61.8%" x2="100%" y2="61.8%" stroke="rgba(251,191,36,0.3)" strokeWidth="1" />
        </svg>
      ) : null}
      {guides.includes('safe') || guides.includes('safe_v') || guides.includes('safe_h') ? (
        <div
          className="absolute border border-teal-400/30 rounded-sm"
          style={{
            left: guides.includes('safe_h') || guides.includes('safe') ? '6%' : '2%',
            right: guides.includes('safe_h') || guides.includes('safe') ? '6%' : '2%',
            top: guides.includes('safe_v') || guides.includes('safe') || guides.includes('headroom') ? '8%' : '2%',
            bottom: guides.includes('safe_v') || guides.includes('safe') ? '8%' : '2%',
          }}
        />
      ) : null}
      {guides.includes('headroom') ? (
        <div className="absolute left-[8%] right-[8%] top-[6%] h-px bg-amber-300/40" />
      ) : null}
      {aspectLabel ? (
        <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider text-teal-200/70 bg-black/40 px-1.5 py-0.5 rounded">
          {aspectLabel}
        </span>
      ) : null}
    </div>
  );
}
