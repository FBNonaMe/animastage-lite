import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import type { ApisReport } from '../../apis/types';

interface ApisStatusPanelProps {
  report: ApisReport | null | undefined;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[9px]">
      <span className="text-zinc-500">{label}</span>
      <span className="text-emerald-300 font-bold tabular-nums">{value}</span>
    </div>
  );
}

export default function ApisStatusPanel({ report }: ApisStatusPanelProps) {
  if (!report) return null;

  const busy = report.status === 'analyzing' || report.status === 'benchmarking';
  const ready = report.status === 'ready' || report.status === 'cached';
  const { userSummary: s } = report;

  return (
    <div className="border border-emerald-500/30 rounded-md overflow-hidden bg-emerald-950/15">
      <div className="px-2 py-1.5 border-b border-emerald-500/20 flex items-center gap-1.5">
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
        ) : ready ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        )}
        <span className="text-[10px] font-bold text-emerald-200">
          {ready ? '✔ Physics Optimized' : 'Adaptive Physics Intelligence'}
        </span>
      </div>

      <div className="p-2 space-y-1">
        {ready ? (
          <>
            <Row label="Hair" value={s.hair} />
            <Row label="Cloth" value={s.cloth} />
            <Row label="Accessories" value={s.accessories} />
            <Row label="Simulation" value={s.simulation} />
            <Row label="Performance" value={s.performance} />
          </>
        ) : (
          <p className="text-[9px] text-zinc-500 leading-relaxed">
            {report.status === 'failed'
              ? report.error ?? 'Analysis failed — using safe defaults.'
              : 'Analyzing skeleton, chains and physics…'}
          </p>
        )}
      </div>
    </div>
  );
}
