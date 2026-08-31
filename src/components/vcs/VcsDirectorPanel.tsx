import { Clapperboard, Film, Sparkles, Star, Sun, Video, Zap } from 'lucide-react';
import { CINEMATIC_LIGHTING_LABELS } from '../../product/cinematic';
import type { CinematicLightingPresetId } from '../../product/cinematic';
import {
  VCS_DIRECTOR_MODES,
  type VcsApi,
  type VcsDirectorMode,
} from '../../product/vcs';

const VARIATION_COUNTS = [5, 10, 20, 50] as const;

interface VcsDirectorPanelProps {
  api: VcsApi;
  compact?: boolean;
}

export default function VcsDirectorPanel({ api, compact = false }: VcsDirectorPanelProps) {
  const state = api.getState();
  const score = state.lastDirectorScore;

  return (
    <div
      className={`rounded-2xl border border-cyan-500/25 bg-[#0a0d14]/94 backdrop-blur-xl shadow-xl ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-violet-600 flex items-center justify-center">
          <Video className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-bold text-white">Virtual Cinematography</p>
          <p className="text-[9px] text-zinc-500">Procedural camera director</p>
        </div>
        {score != null ? (
          <span className="ml-auto text-[10px] font-bold text-emerald-400 tabular-nums">
            {Math.round(score * 100)}%
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1">
            <Clapperboard className="w-3 h-3" /> Director Modes
          </p>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {VCS_DIRECTOR_MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                title={m.description}
                onClick={() => api.setDirectorMode(m.mode)}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold cursor-pointer border transition-colors ${
                  state.directorMode === m.mode
                    ? 'bg-cyan-500/25 border-cyan-400/40 text-cyan-100'
                    : 'border-zinc-700/80 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-2 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-violet-300 flex items-center gap-1">
            <Film className="w-3 h-3" /> Auto Director
          </p>
          <div className="flex flex-wrap gap-1">
            {VARIATION_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  api.patch({ variationCount: n });
                  api.autoDirector(n);
                }}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold cursor-pointer border transition-colors ${
                  state.variationCount === n
                    ? 'bg-violet-500/25 border-violet-400/40 text-violet-100'
                    : 'border-zinc-700/80 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {n} takes
              </button>
            ))}
          </div>
          {state.variations.length > 0 ? (
            <div className="max-h-28 overflow-y-auto space-y-1">
              {state.variations.slice(0, 8).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => api.selectVariation(v.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left text-[9px] border cursor-pointer ${
                    state.selectedVariationId === v.id
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                      : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="font-bold truncate flex-1">{v.label}</span>
                  <StarRow stars={v.stars} />
                  <span className="text-zinc-500 tabular-nums">{Math.round(v.score * 100)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1">
            <Sun className="w-3 h-3" /> Lighting
          </p>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {(Object.keys(CINEMATIC_LIGHTING_LABELS) as CinematicLightingPresetId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => api.setLighting(id)}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold cursor-pointer border transition-colors ${
                  state.lightingPreset === id
                    ? 'bg-amber-500/15 border-amber-400/35 text-amber-200'
                    : 'border-zinc-700/80 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {CINEMATIC_LIGHTING_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Toggle
            label="Safe Cam"
            on={state.safeCamera}
            onChange={(v) => api.patch({ safeCamera: v, enabled: true })}
          />
          <Toggle
            label="Handheld"
            on={state.handheld}
            onChange={(v) => api.patch({ handheld: v, enabled: true })}
          />
          <Toggle
            label="Composition"
            on={state.composition}
            onChange={(v) => api.patch({ composition: v, enabled: true })}
          />
          <Toggle
            label="Safe Vol"
            on={state.showSafeVolumeGizmo}
            onChange={(v) => api.patch({ showSafeVolumeGizmo: v })}
          />
        </div>

        <button
          type="button"
          onClick={() => api.analyzeQuality()}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/20 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Analyze Scene Quality
        </button>
      </div>
    </div>
  );
}

function StarRow({ stars }: { stars: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <span className="inline-flex gap-0.5 text-amber-400">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-2.5 h-2.5 ${i < stars ? 'fill-amber-400' : 'opacity-25'}`}
        />
      ))}
    </span>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border cursor-pointer ${
        on
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
          : 'border-zinc-700 text-zinc-500'
      }`}
    >
      <Zap className="w-2.5 h-2.5" />
      {label}
    </button>
  );
}
