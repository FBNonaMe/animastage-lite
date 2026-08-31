import { CheckCircle2, Sparkles } from 'lucide-react';
import type { CisUserSummary } from '../../cis/types';

interface CisImportReadyCardProps {
  summary: CisUserSummary;
  onDismiss?: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[11px]">
      <span className="text-zinc-500">{label}</span>
      <span className="text-emerald-300 font-bold tabular-nums">{value}</span>
    </div>
  );
}

export default function CisImportReadyCard({ summary, onDismiss }: CisImportReadyCardProps) {
  if (!summary.imported && !summary.ready) return null;

  return (
    <div className="pointer-events-auto w-full max-w-xs rounded-xl border border-emerald-400/35 bg-[#0c0e14]/94 backdrop-blur-md shadow-xl overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-200 tracking-wide">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Character Imported
        </span>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/35 text-emerald-100 hover:bg-emerald-500/35 cursor-pointer"
          >
            OK
          </button>
        ) : null}
      </div>

      <div className="px-3.5 py-2.5 space-y-1.5">
        <Row label="Health" value={`${summary.healthPercent}%`} />
        <Row label="Physics" value={summary.physicsLabel} />
        <Row label="Performance" value={summary.performanceLabel} />
        <Row label="Visual Quality" value={summary.visualQualityLabel} />
      </div>

      <div className="px-3.5 py-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-emerald-300/90">
        <Sparkles className="w-3.5 h-3.5" />
        <span>{summary.headline}</span>
      </div>
    </div>
  );
}
