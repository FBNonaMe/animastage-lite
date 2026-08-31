import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, ScanSearch } from 'lucide-react';
import type { ModelAnalysisReport, AnalyzerSeverity } from '../../analyzer/types';
import type { UmceReport } from '../../umce';
import type { ApisReport } from '../../apis';
import type { CharacterIntelligenceProfile } from '../../cis';
import ApisDevPanel from '../apis/ApisDevPanel';
import CisDevInspector from '../cis/CisDevInspector';

interface ModelAnalyzerPanelProps {
  report: ModelAnalysisReport | null | undefined;
  umceReport?: UmceReport | null;
  apisReport?: ApisReport | null;
  cisProfile?: CharacterIntelligenceProfile | null;
  onReanalyze?: () => void;
  analyzing?: boolean;
}

function SeverityIcon({ severity }: { severity: AnalyzerSeverity }) {
  if (severity === 'error') {
    return <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  }
  if (severity === 'warning') {
    return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  return <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
}

export default function ModelAnalyzerPanel({
  report,
  umceReport,
  apisReport,
  cisProfile,
  onReanalyze,
  analyzing = false,
}: ModelAnalyzerPanelProps) {
  const sortedIssues = useMemo(() => {
    if (!report) return [];
    const order: Record<AnalyzerSeverity, number> = { error: 0, warning: 1, info: 2 };
    return [...report.issues].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [report]);

  if (!report) {
    return (
      <div className="bg-[#121418] border border-zinc-800 rounded-md p-3 text-[10px] text-zinc-500">
        Load a PMX model to run analysis.
      </div>
    );
  }

  const { stats } = report;
  const hasErrors = sortedIssues.some((i) => i.severity === 'error');

  return (
    <div className="bg-[#121418] border border-amber-500/25 rounded-md overflow-hidden">
      <div className="h-7 bg-[#1c1e24] px-2 flex items-center justify-between border-b border-[#2c3240]">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-300">
          <ScanSearch className="w-3.5 h-3.5" />
          Model Analyzer
        </span>
        {onReanalyze && (
          <button
            type="button"
            onClick={onReanalyze}
            disabled={analyzing}
            className="text-[8px] font-bold uppercase text-zinc-400 hover:text-amber-200 disabled:opacity-50 cursor-pointer"
          >
            {analyzing ? '…' : 'Rescan'}
          </button>
        )}
      </div>

      <div className="p-2 space-y-2">
        <div className="grid grid-cols-3 gap-1 text-[9px]">
          {[
            ['Bones', stats.boneCount],
            ['Morphs', stats.morphCount],
            ['Physics', stats.rigidBodyCount],
            ['Materials', stats.materialCount],
            ['Textures', stats.textureCount],
            ['Missing tex', stats.missingTextureCount],
            ['Vertices', stats.vertexCount.toLocaleString()],
            ['Triangles', stats.triangleCount.toLocaleString()],
            ['IK', stats.ikCount],
          ].map(([label, val]) => (
            <div
              key={String(label)}
              className="bg-[#0e1014] border border-zinc-800 rounded px-1.5 py-1 text-center"
            >
              <div className="text-zinc-500 font-bold uppercase text-[7px]">{label}</div>
              <div className="text-zinc-200 font-mono font-bold">{val}</div>
            </div>
          ))}
        </div>

        {umceReport && (
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded px-2 py-1.5 space-y-1">
            <div className="flex items-center justify-between text-[9px]">
              <span className="font-bold uppercase text-cyan-300">UMCE Compatibility</span>
              <span className="font-mono font-bold text-cyan-200">{umceReport.compatibilityPercent}%</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[8px] text-zinc-400">
              <span>Rig: {umceReport.formatHint}</span>
              <span>Mapped: {umceReport.stats.mappedCanonical} bones</span>
              <span>IK: {umceReport.stats.ikChains} chains</span>
              <span>Physics: {umceReport.stats.rigidBodies} bodies</span>
            </div>
            {umceReport.warnings.length > 0 && (
              <div className="text-[8px] text-amber-400/90 truncate" title={umceReport.warnings.join('; ')}>
                {umceReport.warnings[0]}
              </div>
            )}
          </div>
        )}

        {cisProfile && import.meta.env.DEV ? <CisDevInspector profile={cisProfile} /> : null}

        {apisReport && import.meta.env.DEV && !cisProfile ? <ApisDevPanel report={apisReport} /> : null}

        {!hasErrors && sortedIssues.length === 0 && (
          <div className="flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            No issues detected
          </div>
        )}

        {sortedIssues.length > 0 && (
          <div className="max-h-[180px] overflow-y-auto space-y-1">
            {sortedIssues.map((item) => (
              <div
                key={item.id}
                className="flex gap-2 text-[9px] bg-[#0e1014] border border-zinc-800 rounded px-2 py-1.5"
              >
                <SeverityIcon severity={item.severity} />
                <div className="min-w-0">
                  <div className="font-bold text-zinc-200">{item.title}</div>
                  <div className="text-zinc-500 truncate" title={item.detail}>
                    {item.detail}
                  </div>
                  {item.suggestion && (
                    <div className="text-zinc-400 mt-0.5 leading-snug">{item.suggestion}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {report.suggestions.length > 0 && (
          <div className="border-t border-zinc-800 pt-2">
            <div className="text-[8px] font-bold uppercase text-zinc-500 mb-1">Suggestions</div>
            <ul className="text-[9px] text-zinc-400 space-y-0.5 list-disc list-inside">
              {report.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {report.modelFileName && (
          <div className="text-[8px] text-zinc-600 font-mono truncate">
            {report.format?.toUpperCase()} · {report.modelFileName}
          </div>
        )}
      </div>
    </div>
  );
}
