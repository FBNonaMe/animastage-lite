import type { SmartStudioReport } from './types';

interface SmartReportCardProps {
  report: SmartStudioReport;
  onDismiss?: () => void;
}

export default function SmartReportCard({ report, onDismiss }: SmartReportCardProps) {
  return (
    <div className="pointer-events-auto w-full max-w-xs rounded-xl border border-violet-400/30 bg-[#0c0e14]/92 backdrop-blur-md shadow-xl overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs font-bold text-violet-200 tracking-wide">
          ✨ Smart Studio Ready
        </span>
        {onDismiss ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDismiss();
            }}
            className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-violet-500/25 border border-violet-400/40 text-violet-100 hover:bg-violet-500/40 cursor-pointer"
          >
            OK
          </button>
        ) : null}
      </div>
      <div className="px-3.5 py-2.5 space-y-1 font-mono text-[10px]">
        {report.lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-3 text-zinc-300">
            <span className="text-zinc-500">{line.label}</span>
            <span className="text-emerald-300/90">{line.value}</span>
          </div>
        ))}
      </div>
      <div className="px-3.5 py-2 border-t border-white/5 text-[9px] text-zinc-500 flex justify-between">
        <span>{report.cameraPreset.replace(/_/g, ' ')}</span>
        <span>{report.background.replace(/_/g, ' ')}</span>
      </div>
    </div>
  );
}
