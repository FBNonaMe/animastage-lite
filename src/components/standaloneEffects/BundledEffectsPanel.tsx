import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { VisualFxSettings } from '../../types';
import {
  getRuntimeCompatibleEffects,
  loadStandaloneEffectsCatalog,
  RAY_MMD_GRADE_PRESETS,
  RAY_MMD_BLOOM_PRESETS,
  RAY_MMD_SSR_PRESETS,
  RAY_MMD_VIGNETTE_PRESETS,
  RAY_MMD_LENS_PRESETS,
  RAY_MMD_TONE_OPERATORS,
  RAY_MMD_COLOR_GRADE_NEUTRAL,
  RAY_MMD_BLOOM_NEUTRAL,
  RAY_MMD_SSR_NEUTRAL,
  RAY_MMD_VIGNETTE_NEUTRAL,
  RAY_MMD_LENS_NEUTRAL,
  DEFAULT_ANIME_NPR_SETTINGS,
  type RayMmdColorGradeSettings,
  type RayMmdBloomSettings,
  type RayMmdSsrSettings,
  type RayMmdVignetteSettings,
  type RayMmdLensSettings,
  type AnimeNprSettings,
  type StandaloneEffectCatalogEntry,
} from '../../standaloneEffects';

interface BundledEffectsPanelProps {
  visualFx: VisualFxSettings;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
}

function patchRayGrade(
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void,
  current: RayMmdColorGradeSettings | undefined,
  patch: Partial<RayMmdColorGradeSettings>
) {
  onSetVisualFx({
    rayMmdColorGrade: { ...RAY_MMD_COLOR_GRADE_NEUTRAL, ...current, ...patch },
    colorGrade: 'neutral',
    customLutEnabled: false,
  });
}

function patchRayBloom(
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void,
  current: RayMmdBloomSettings | undefined,
  patch: Partial<RayMmdBloomSettings>
) {
  onSetVisualFx({
    rayMmdBloom: { ...RAY_MMD_BLOOM_NEUTRAL, ...current, ...patch },
  });
}

function patchRaySsr(
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void,
  current: RayMmdSsrSettings | undefined,
  patch: Partial<RayMmdSsrSettings>
) {
  onSetVisualFx({
    rayMmdSsr: { ...RAY_MMD_SSR_NEUTRAL, ...current, ...patch },
  });
}

function patchRayVignette(
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void,
  current: RayMmdVignetteSettings | undefined,
  patch: Partial<RayMmdVignetteSettings>
) {
  onSetVisualFx({
    rayMmdVignette: { ...RAY_MMD_VIGNETTE_NEUTRAL, ...current, ...patch },
  });
}

function patchRayLens(
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void,
  current: RayMmdLensSettings | undefined,
  patch: Partial<RayMmdLensSettings>
) {
  onSetVisualFx({
    rayMmdLens: { ...RAY_MMD_LENS_NEUTRAL, ...current, ...patch },
  });
}

function patchAnimeNpr(
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void,
  current: AnimeNprSettings | undefined,
  patch: Partial<AnimeNprSettings>
) {
  onSetVisualFx({
    animeNpr: { ...DEFAULT_ANIME_NPR_SETTINGS, ...current, ...patch },
  });
}

const BLOOM_MODES = [
  { value: 1, label: 'Linear HDR' },
  { value: 2, label: 'Clamped' },
  { value: 3, label: 'Luminance' },
  { value: 4, label: 'Luminance HDR' },
] as const;

export default function BundledEffectsPanel({
  visualFx,
  onSetVisualFx,
}: BundledEffectsPanelProps) {
  const [catalog, setCatalog] = useState<StandaloneEffectCatalogEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStandaloneEffectsCatalog().then((data) => {
      if (cancelled) return;
      if (!data) {
        setLoadError('Catalog unavailable — run npm run sync:standalone');
        return;
      }
      setCatalog(getRuntimeCompatibleEffects(data));
      setLoadError(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ray = visualFx.rayMmdColorGrade ?? RAY_MMD_COLOR_GRADE_NEUTRAL;
  const bloom = visualFx.rayMmdBloom ?? RAY_MMD_BLOOM_NEUTRAL;
  const ssr = visualFx.rayMmdSsr ?? RAY_MMD_SSR_NEUTRAL;
  const vignette = visualFx.rayMmdVignette ?? RAY_MMD_VIGNETTE_NEUTRAL;
  const lens = visualFx.rayMmdLens ?? RAY_MMD_LENS_NEUTRAL;
  const npr = visualFx.animeNpr ?? DEFAULT_ANIME_NPR_SETTINGS;
  const bundled = useMemo(() => catalog.filter((e) => e.bundled), [catalog]);

  return (
    <div className="space-y-2 rounded border border-violet-500/20 bg-violet-500/5 px-2 py-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
        <span className="text-[9px] font-bold uppercase tracking-wide text-violet-200">
          Standalone effects
        </span>
      </div>

      {loadError ? (
        <p className="text-[9px] text-amber-400/90 m-0">{loadError}</p>
      ) : (
        <p className="text-[8px] text-zinc-500 m-0">
          {bundled.length} bundled · {catalog.length} runtime-ready from Pro bundle
        </p>
      )}

      <div className="space-y-1.5 border-b border-zinc-800/80 pb-2">
        <p className="text-[8px] font-bold uppercase text-zinc-500 m-0">Ray-MMD Color Grading (MIT)</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(RAY_MMD_GRADE_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              title={preset.hint}
              onClick={() => onSetVisualFx({ rayMmdColorGrade: preset.settings, colorGrade: 'neutral' })}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[9px] text-zinc-300 hover:border-violet-400/40 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={ray.enabled}
            onChange={(e) => patchRayGrade(onSetVisualFx, visualFx.rayMmdColorGrade, { enabled: e.target.checked })}
          />
          Enable color grading
        </label>

        {ray.enabled ? (
          <div className="space-y-1.5 pl-1 border-l border-zinc-800">
            <label className="block text-[9px] text-zinc-500">
              Mix
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={ray.amount}
                onChange={(e) =>
                  patchRayGrade(onSetVisualFx, visualFx.rayMmdColorGrade, {
                    amount: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Tone operator
              <select
                value={ray.operator}
                onChange={(e) =>
                  patchRayGrade(onSetVisualFx, visualFx.rayMmdColorGrade, {
                    operator: Number(e.target.value),
                  })
                }
                className="ds-select w-full mt-0.5 text-[10px]"
              >
                {RAY_MMD_TONE_OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[9px] text-zinc-500">
              Exposure (EV)
              <input
                type="range"
                min={-2}
                max={2}
                step={0.05}
                value={ray.exposure}
                onChange={(e) =>
                  patchRayGrade(onSetVisualFx, visualFx.rayMmdColorGrade, {
                    exposure: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Temperature (K)
              <input
                type="range"
                min={3000}
                max={12000}
                step={100}
                value={ray.temperature}
                onChange={(e) =>
                  patchRayGrade(onSetVisualFx, visualFx.rayMmdColorGrade, {
                    temperature: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Vignette
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={ray.vignette}
                onChange={(e) =>
                  patchRayGrade(onSetVisualFx, visualFx.rayMmdColorGrade, {
                    vignette: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5 border-b border-zinc-800/80 pb-2">
        <p className="text-[8px] font-bold uppercase text-zinc-500 m-0">
          Ray-MMD HDR Bloom · 2nd pass (MIT)
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(RAY_MMD_BLOOM_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              title={preset.hint}
              onClick={() => onSetVisualFx({ rayMmdBloom: preset.settings })}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[9px] text-zinc-300 hover:border-violet-400/40 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={bloom.enabled}
            onChange={(e) => patchRayBloom(onSetVisualFx, visualFx.rayMmdBloom, { enabled: e.target.checked })}
          />
          Enable HDR bloom (replaces built-in bloom)
        </label>
        {bloom.enabled ? (
          <div className="space-y-1.5 pl-1 border-l border-zinc-800">
            <label className="block text-[9px] text-zinc-500">
              Intensity
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={bloom.amount}
                onChange={(e) =>
                  patchRayBloom(onSetVisualFx, visualFx.rayMmdBloom, {
                    amount: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Threshold
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={bloom.threshold}
                onChange={(e) =>
                  patchRayBloom(onSetVisualFx, visualFx.rayMmdBloom, {
                    threshold: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Radius
              <input
                type="range"
                min={0.5}
                max={6}
                step={0.1}
                value={bloom.radius}
                onChange={(e) =>
                  patchRayBloom(onSetVisualFx, visualFx.rayMmdBloom, {
                    radius: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Extract mode
              <select
                value={bloom.mode}
                onChange={(e) =>
                  patchRayBloom(onSetVisualFx, visualFx.rayMmdBloom, {
                    mode: Number(e.target.value),
                  })
                }
                className="ds-select w-full mt-0.5 text-[10px]"
              >
                {BLOOM_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5 border-b border-zinc-800/80 pb-2">
        <p className="text-[8px] font-bold uppercase text-zinc-500 m-0">
          Ray-MMD SSR · screen reflections (MIT)
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(RAY_MMD_SSR_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              title={preset.hint}
              onClick={() => onSetVisualFx({ rayMmdSsr: preset.settings })}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[9px] text-zinc-300 hover:border-violet-400/40 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={ssr.enabled}
            onChange={(e) => patchRaySsr(onSetVisualFx, visualFx.rayMmdSsr, { enabled: e.target.checked })}
          />
          Enable SSR (needs depth · best on floor)
        </label>
        {ssr.enabled ? (
          <div className="space-y-1.5 pl-1 border-l border-zinc-800">
            <label className="block text-[9px] text-zinc-500">
              Intensity
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.01}
                value={ssr.amount}
                onChange={(e) =>
                  patchRaySsr(onSetVisualFx, visualFx.rayMmdSsr, { amount: Number(e.target.value) })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Threshold
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={ssr.threshold}
                onChange={(e) =>
                  patchRaySsr(onSetVisualFx, visualFx.rayMmdSsr, {
                    threshold: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Range scale
              <input
                type="range"
                min={0.2}
                max={1.5}
                step={0.01}
                value={ssr.rangeScale}
                onChange={(e) =>
                  patchRaySsr(onSetVisualFx, visualFx.rayMmdSsr, {
                    rangeScale: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5 border-b border-zinc-800/80 pb-2">
        <p className="text-[8px] font-bold uppercase text-zinc-500 m-0">
          Ray-MMD Vignette (MIT)
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(RAY_MMD_VIGNETTE_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              title={preset.hint}
              onClick={() => onSetVisualFx({ rayMmdVignette: preset.settings, vignetteEnabled: false })}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[9px] text-zinc-300 hover:border-violet-400/40 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={vignette.enabled}
            onChange={(e) =>
              patchRayVignette(onSetVisualFx, visualFx.rayMmdVignette, {
                enabled: e.target.checked,
              })
            }
          />
          Enable Ray vignette (replaces built-in)
        </label>
        {vignette.enabled ? (
          <label className="block text-[9px] text-zinc-500 pl-1 border-l border-zinc-800">
            Strength
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.01}
              value={vignette.amount}
              onChange={(e) =>
                patchRayVignette(onSetVisualFx, visualFx.rayMmdVignette, {
                  amount: Number(e.target.value),
                })
              }
              className="w-full"
            />
          </label>
        ) : null}
      </div>

      <div className="space-y-1.5 border-b border-zinc-800/80 pb-2">
        <p className="text-[8px] font-bold uppercase text-zinc-500 m-0">
          Ray-MMD Lens dispersion (MIT)
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(RAY_MMD_LENS_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              title={preset.hint}
              onClick={() => onSetVisualFx({ rayMmdLens: preset.settings })}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[9px] text-zinc-300 hover:border-violet-400/40 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={lens.enabled}
            onChange={(e) => patchRayLens(onSetVisualFx, visualFx.rayMmdLens, { enabled: e.target.checked })}
          />
          Enable radial lens (replaces chromatic aberration)
        </label>
        {lens.enabled ? (
          <div className="space-y-1.5 pl-1 border-l border-zinc-800">
            <label className="block text-[9px] text-zinc-500">
              Dispersion
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.01}
                value={lens.dispersion}
                onChange={(e) =>
                  patchRayLens(onSetVisualFx, visualFx.rayMmdLens, {
                    dispersion: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Edge radius
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={lens.radius}
                onChange={(e) =>
                  patchRayLens(onSetVisualFx, visualFx.rayMmdLens, {
                    radius: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="text-[8px] font-bold uppercase text-amber-500/90 m-0">
          Star Rail NPR · render mode (GPL-3.0)
        </p>
        <p className="text-[8px] text-zinc-600 leading-relaxed m-0">
          Separate render path — not mixed with ASRP. Acknowledge GPL before enabling.
        </p>
        <label className="flex items-start gap-2 text-[9px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={npr.acknowledged}
            onChange={(e) =>
              patchAnimeNpr(onSetVisualFx, visualFx.animeNpr, {
                acknowledged: e.target.checked,
              })
            }
          />
          I accept GPL-3.0 terms for Star Rail NPR (Stalo / StarRailNPRShader port)
        </label>
        {npr.acknowledged ? (
          <div className="space-y-1.5 pl-1 border-l border-amber-900/40">
            <button
              type="button"
              onClick={() =>
                onSetVisualFx({
                  renderMode: 'anime_npr',
                  animeNpr: { ...npr, acknowledged: true },
                  materialDetailing: false,
                })
              }
              className={`w-full py-1.5 text-[9px] font-bold rounded border cursor-pointer ${
                visualFx.renderMode === 'anime_npr'
                  ? 'border-amber-500/50 text-amber-200 bg-amber-500/10'
                  : 'border-zinc-700 text-zinc-400 hover:border-amber-500/40'
              }`}
            >
              Use Anime NPR render mode
            </button>
            <label className="block text-[9px] text-zinc-500">
              Strength
              <input
                type="range"
                min={0.2}
                max={1.4}
                step={0.02}
                value={npr.strength}
                onChange={(e) =>
                  patchAnimeNpr(onSetVisualFx, visualFx.animeNpr, {
                    strength: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </label>
            <label className="block text-[9px] text-zinc-500">
              Preset
              <select
                value={npr.preset}
                onChange={(e) =>
                  patchAnimeNpr(onSetVisualFx, visualFx.animeNpr, {
                    preset: e.target.value,
                  })
                }
                className="ds-select w-full mt-0.5 text-[10px]"
              >
                <option value="starrail">Star Rail</option>
                <option value="soft">Soft Character</option>
                <option value="contrast">High Contrast</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {bundled.length ? (
        <ul className="m-0 p-0 list-none max-h-24 overflow-y-auto space-y-0.5">
          {bundled.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded border border-zinc-800/80 px-1.5 py-0.5 text-[8px] text-zinc-500"
            >
              <span className="truncate text-zinc-400">{entry.name}</span>
              <span className="shrink-0 text-emerald-500/80">{entry.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
