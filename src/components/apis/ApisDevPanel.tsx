import type { ApisReport } from '../../apis/types';

interface ApisDevPanelProps {
  report: ApisReport | null | undefined;
}

export default function ApisDevPanel({ report }: ApisDevPanelProps) {
  if (!import.meta.env.DEV || !report?.devDiagnostics) return null;

  const d = report.devDiagnostics;
  const p = d.profile;

  return (
    <details className="border border-violet-500/30 rounded-md bg-violet-950/20 text-[8px] text-zinc-400">
      <summary className="px-2 py-1 cursor-pointer text-violet-300 font-bold">
        APIS Dev Diagnostics
      </summary>
      <div className="p-2 space-y-2 max-h-48 overflow-y-auto font-mono">
        <div>
          <div className="text-violet-200 mb-0.5">Benchmark</div>
          score={p.benchmark.score} stretch={p.benchmark.maxStretch.toFixed(2)} vel=
          {p.benchmark.maxVelocity.toFixed(1)} ms={p.benchmark.avgFrameMs.toFixed(2)}
        </div>
        <div>
          <div className="text-violet-200 mb-0.5">Global tuning</div>
          rate={p.global.physicsRate} sub={p.global.physicsSubsteps} grav=
          {p.global.physicsGravity.toFixed(2)} swing={p.global.physicsSwing.toFixed(2)}
        </div>
        <div>
          <div className="text-violet-200 mb-0.5">Chains ({d.chains.length})</div>
          {d.chains.slice(0, 8).map((c) => (
            <div key={c.id}>
              {c.kind} conf={(c.confidence * 100).toFixed(0)}% bones={c.boneIndices.length}
            </div>
          ))}
        </div>
        <div>
          <div className="text-violet-200 mb-0.5">Repairs</div>
          {p.constraintRepairs.length ? p.constraintRepairs.join(', ') : 'none'}
        </div>
      </div>
    </details>
  );
}
