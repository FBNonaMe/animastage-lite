import { Loader2 } from 'lucide-react';
import type { CisReport } from '../../cis/types';
import CisImportReadyCard from './CisImportReadyCard';

interface CisStatusPanelProps {
  report: CisReport | null | undefined;
  compact?: boolean;
}

export default function CisStatusPanel({ report, compact = false }: CisStatusPanelProps) {
  if (!report) return null;

  const busy =
    report.status === 'pending' ||
    report.status === 'validating' ||
    report.status === 'analyzing' ||
    report.status === 'optimizing';

  if (busy) {
    return (
      <div className="border border-emerald-500/25 rounded-md px-2 py-2 flex items-center gap-2 text-[10px] text-zinc-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
        Character Intelligence analyzing…
      </div>
    );
  }

  if (report.status === 'failed') {
    return (
      <div className="border border-amber-500/30 rounded-md px-2 py-2 text-[10px] text-amber-300">
        {report.error ?? 'Analysis failed — safe defaults applied.'}
      </div>
    );
  }

  if (compact) {
    return <CisImportReadyCard summary={report.userSummary} />;
  }

  return <CisImportReadyCard summary={report.userSummary} />;
}
