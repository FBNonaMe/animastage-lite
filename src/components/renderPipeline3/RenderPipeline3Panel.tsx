import {
  Aperture,
  CloudFog,
  Gauge,
  Layers,
  Lightbulb,
  Sparkles,
  Sun,
  Wand2,
  Droplets,
  CheckCircle2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AppState } from '../../types';
import { applyRenderPipeline3 } from '../../renderPipeline3/apply';
import type { RenderPipeline3ApplyResult } from '../../renderPipeline3/apply';
import { mergeRenderPipeline3 } from '../../renderPipeline3/merge';
import {
  RENDER_PIPELINE_3_PRESETS,
  applyPresetToState3,
} from '../../renderPipeline3/presets';
import {
  applyValidatorAutoFix,
  validateRenderPipeline3,
} from '../../renderPipeline3/validator';
import type {
  AoModeId,
  GiModeId,
  RenderPipeline3PresetId,
  RenderPipeline3State,
  TaaModeId,
  WeatherModeId,
} from '../../renderPipeline3/types';

type Tab =
  | 'presets'
  | 'gi'
  | 'ao'
  | 'world'
  | 'look'
  | 'camera'
  | 'graph'
  | 'validate';

export interface RenderPipeline3PanelProps {
  appState: AppState;
  onApply: (result: RenderPipeline3ApplyResult, next: RenderPipeline3State) => void;
  onPatchPipeline: (patch: Partial<RenderPipeline3State>) => void;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'presets', label: 'Presets' },
  { id: 'gi', label: 'GI' },
  { id: 'ao', label: 'AO' },
  { id: 'world', label: 'World' },
  { id: 'look', label: 'Look' },
  { id: 'camera', label: 'Cam' },
  { id: 'graph', label: 'Graph' },
  { id: 'validate', label: 'Check' },
];

const GI_MODES: Array<{ id: GiModeId; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'ssgi', label: 'SSGI' },
  { id: 'ssvgi', label: 'SSVGI' },
  { id: 'hybrid', label: 'Hybrid' },
];

const AO_MODES: Array<{ id: AoModeId; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'ssao', label: 'SSAO' },
  { id: 'hbao', label: 'HBAO' },
  { id: 'gtao', label: 'GTAO' },
  { id: 'ssdo', label: 'SSDO' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'contact', label: 'Contact' },
];

const WEATHER: Array<{ id: WeatherModeId; label: string }> = [
  { id: 'clear', label: 'Clear' },
  { id: 'rain', label: 'Rain' },
  { id: 'storm', label: 'Storm' },
  { id: 'fog', label: 'Fog' },
  { id: 'snow', label: 'Snow' },
];

const TAA: Array<{ id: TaaModeId; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'smaa', label: 'SMAA' },
  { id: 'taa', label: 'TAA' },
  { id: 'txaa', label: 'TXAA' },
];

function Chip({
  active,
  label,
  sub,
  onClick,
}: {
  active?: boolean;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 text-left p-2 border rounded-md transition-colors ${
        active
          ? 'border-violet-400/60 bg-violet-400/10 text-violet-100'
          : 'border-[#283142] bg-[#111722] text-zinc-200 hover:border-[#46536a]'
      }`}
    >
      <span className="block text-[10px] font-bold leading-tight">{label}</span>
      {sub ? <span className="block text-[8px] text-zinc-500 mt-0.5 line-clamp-2">{sub}</span> : null}
    </button>
  );
}

function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[8px] text-zinc-500">
        <span>{label}</span>
        <span className="text-violet-200">{Number.isInteger(step) ? value : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

export default function RenderPipeline3Panel({
  appState,
  onApply,
  onPatchPipeline,
}: RenderPipeline3PanelProps) {
  const [tab, setTab] = useState<Tab>('presets');
  const rp = appState.renderPipeline3;

  const report = useMemo(
    () => (rp ? validateRenderPipeline3(rp) : null),
    [rp]
  );

  if (!rp) {
    return (
      <div className="p-3 text-[10px] text-zinc-500">
        Render Pipeline 3.0 is not initialized.
      </div>
    );
  }

  const commit = (next: RenderPipeline3State) => {
    onPatchPipeline(next);
    onApply(applyRenderPipeline3(next), next);
  };

  const patch = (partial: Partial<RenderPipeline3State>) => {
    commit(mergeRenderPipeline3(rp, { ...partial, activePreset: 'custom' }));
  };

  const applyPreset = (id: RenderPipeline3PresetId) => {
    let next = applyPresetToState3(rp, id);
    if (next.validator.autoFixOnPreset) {
      next = applyValidatorAutoFix(next);
      next = { ...next, activePreset: id };
    }
    commit(next);
  };

  return (
    <div className="text-zinc-200 bg-[#0a0f1a] min-h-full">
      <header className="p-3 border-b border-[#233142] bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.16),transparent_48%)]">
        <div className="flex items-center gap-2">
          <Aperture className="w-4 h-4 text-violet-300" />
          <div>
            <h2 className="text-[12px] font-black tracking-wide m-0">RENDER PIPELINE 3.0</h2>
            <p className="text-[8px] text-zinc-500 m-0">
              Cinematic anime engine · live preview · WebGL/WebGPU
            </p>
          </div>
          <button
            type="button"
            onClick={() => commit({ ...rp, enabled: !rp.enabled })}
            className={`ml-auto px-2 py-1 rounded border text-[9px] font-bold ${
              rp.enabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : 'border-zinc-700 text-zinc-500'
            }`}
          >
            {rp.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="grid grid-cols-8 gap-0.5 mt-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`py-1.5 rounded text-[8px] font-bold ${
                tab === item.id ? 'bg-violet-500/20 text-violet-100' : 'text-zinc-500 hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-3 space-y-3">
        {tab === 'presets' ? (
          <section className="space-y-1.5">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Look Presets
            </h3>
            <div className="grid grid-cols-2 gap-1">
              {RENDER_PIPELINE_3_PRESETS.map((preset) => (
                <Chip
                  key={preset.id}
                  active={rp.activePreset === preset.id}
                  label={preset.label}
                  sub={preset.description}
                  onClick={() => applyPreset(preset.id)}
                />
              ))}
            </div>
            <p className="text-[7px] text-zinc-600 m-0 flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> Applies GI, AO, weather, bloom, materials and grade.
            </p>
          </section>
        ) : null}

        {tab === 'gi' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Global Illumination
            </h3>
            <div className="grid grid-cols-4 gap-1">
              {GI_MODES.map((m) => (
                <Chip
                  key={m.id}
                  active={rp.gi.mode === m.id}
                  label={m.label}
                  onClick={() => patch({ gi: { ...rp.gi, mode: m.id } })}
                />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
                <Chip
                  key={q}
                  active={rp.gi.quality === q}
                  label={q}
                  onClick={() => patch({ gi: { ...rp.gi, quality: q } })}
                />
              ))}
            </div>
            <Slider
              label="Intensity"
              value={rp.gi.intensity}
              onChange={(intensity) => patch({ gi: { ...rp.gi, intensity } })}
            />
            <Slider
              label="Color Bleeding"
              value={rp.gi.colorBleeding}
              onChange={(colorBleeding) => patch({ gi: { ...rp.gi, colorBleeding } })}
            />
            <Slider
              label="Sun Bounce"
              value={rp.gi.sunBounce}
              onChange={(sunBounce) => patch({ gi: { ...rp.gi, sunBounce } })}
            />
            <Slider
              label="Sky Bounce"
              value={rp.gi.skyBounce}
              onChange={(skyBounce) => patch({ gi: { ...rp.gi, skyBounce } })}
            />
          </section>
        ) : null}

        {tab === 'ao' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Ambient Occlusion
            </h3>
            <div className="grid grid-cols-4 gap-1">
              {AO_MODES.map((m) => (
                <Chip
                  key={m.id}
                  active={rp.ao.mode === m.id}
                  label={m.label}
                  onClick={() => patch({ ao: { ...rp.ao, mode: m.id } })}
                />
              ))}
            </div>
            <Slider
              label="Intensity"
              value={rp.ao.intensity}
              max={2}
              onChange={(intensity) => patch({ ao: { ...rp.ao, intensity } })}
            />
            <Slider
              label="Radius"
              value={rp.ao.radius}
              onChange={(radius) => patch({ ao: { ...rp.ao, radius } })}
            />
            <Slider
              label="Contact shadow opacity"
              value={rp.contactShadows.opacity}
              onChange={(opacity) =>
                patch({ contactShadows: { ...rp.contactShadows, opacity, enabled: true } })
              }
            />
            <label className="flex items-center gap-2 text-[9px] text-zinc-400">
              <input
                type="checkbox"
                checked={rp.contactShadows.enabled}
                onChange={(e) =>
                  patch({
                    contactShadows: { ...rp.contactShadows, enabled: e.target.checked },
                  })
                }
              />
              Contact shadows (characters / ground / props)
            </label>
          </section>
        ) : null}

        {tab === 'world' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <CloudFog className="w-3 h-3" /> Weather · Water · Particles
            </h3>
            <div className="grid grid-cols-5 gap-1">
              {WEATHER.map((w) => (
                <Chip
                  key={w.id}
                  active={rp.weather.mode === w.id}
                  label={w.label}
                  onClick={() =>
                    patch({
                      weather: {
                        ...rp.weather,
                        mode: w.id,
                        intensity: w.id === 'clear' ? 0 : Math.max(rp.weather.intensity, 0.55),
                      },
                    })
                  }
                />
              ))}
            </div>
            <Slider
              label="Weather intensity"
              value={rp.weather.intensity}
              onChange={(intensity) => patch({ weather: { ...rp.weather, intensity } })}
            />
            <Slider
              label="Wet ground"
              value={rp.weather.wetGround}
              onChange={(wetGround) => patch({ weather: { ...rp.weather, wetGround } })}
            />
            <Slider
              label="Wind"
              value={rp.weather.wind}
              onChange={(wind) => patch({ weather: { ...rp.weather, wind } })}
            />
            <label className="flex items-center gap-2 text-[9px] text-zinc-400">
              <input
                type="checkbox"
                checked={rp.water.enabled}
                onChange={(e) => patch({ water: { ...rp.water, enabled: e.target.checked } })}
              />
              <Droplets className="w-3 h-3" /> Water reflections / shore fade
            </label>
            {rp.water.enabled ? (
              <>
                <Slider
                  label="Water reflection"
                  value={rp.water.reflection}
                  onChange={(reflection) => patch({ water: { ...rp.water, reflection } })}
                />
                <Slider
                  label="Waves"
                  value={rp.water.waves}
                  onChange={(waves) => patch({ water: { ...rp.water, waves } })}
                />
              </>
            ) : null}
            <label className="flex items-center gap-2 text-[9px] text-zinc-400">
              <input
                type="checkbox"
                checked={rp.particles.enabled}
                onChange={(e) =>
                  patch({
                    particles: {
                      ...rp.particles,
                      enabled: e.target.checked,
                      preset:
                        e.target.checked && rp.particles.preset === 'none'
                          ? 'petals'
                          : rp.particles.preset,
                    },
                  })
                }
              />
              GPU particles
            </label>
            <Slider
              label="Particle count"
              value={rp.particles.count}
              min={1000}
              max={100000}
              step={1000}
              onChange={(count) => patch({ particles: { ...rp.particles, count } })}
            />
            <label className="flex items-center gap-2 text-[9px] text-zinc-400">
              <input
                type="checkbox"
                checked={rp.vegetation.enabled}
                onChange={(e) =>
                  patch({ vegetation: { ...rp.vegetation, enabled: e.target.checked } })
                }
              />
              Vegetation wind / density (procedural budget)
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ['indoor', 'Indoor'],
                  ['outdoor', 'Outdoor'],
                  ['street', 'Street'],
                  ['forest', 'Forest'],
                ] as const
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  active={rp.probes.scene === id}
                  label={label}
                  onClick={() =>
                    patch({ probes: { ...rp.probes, scene: id, enabled: true } })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'look' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Materials · Lights · Bloom
            </h3>
            <div className="grid grid-cols-5 gap-1">
              {(
                [
                  ['anime', 'Anime'],
                  ['toon', 'Toon'],
                  ['pbr', 'PBR'],
                  ['skin', 'Skin'],
                  ['hair', 'Hair'],
                ] as const
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  active={rp.materials.look === id}
                  label={label}
                  onClick={() => patch({ materials: { ...rp.materials, look: id } })}
                />
              ))}
            </div>
            <Slider
              label="Sun"
              value={rp.lights.sunIntensity}
              max={2}
              onChange={(sunIntensity) => patch({ lights: { ...rp.lights, sunIntensity } })}
            />
            <Slider
              label="Moon"
              value={rp.lights.moonIntensity}
              max={2}
              onChange={(moonIntensity) => patch({ lights: { ...rp.lights, moonIntensity } })}
            />
            <Slider
              label="Sky"
              value={rp.lights.skyIntensity}
              max={2}
              onChange={(skyIntensity) => patch({ lights: { ...rp.lights, skyIntensity } })}
            />
            <Slider
              label="Bloom"
              value={rp.bloom.intensity}
              onChange={(intensity) =>
                patch({ bloom: { ...rp.bloom, intensity, enabled: intensity > 0.02 } })
              }
            />
            <Slider
              label="Lens dirt"
              value={rp.bloom.lensDirt}
              onChange={(lensDirt) => patch({ bloom: { ...rp.bloom, lensDirt } })}
            />
            <Slider
              label="Exposure"
              value={rp.color.exposure}
              min={0.5}
              max={1.6}
              onChange={(exposure) => patch({ color: { ...rp.color, exposure } })}
            />
          </section>
        ) : null}

        {tab === 'camera' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Camera · TAA · Lens
            </h3>
            <div className="grid grid-cols-4 gap-1">
              {TAA.map((m) => (
                <Chip
                  key={m.id}
                  active={rp.taa.mode === m.id}
                  label={m.label}
                  onClick={() => patch({ taa: { ...rp.taa, mode: m.id } })}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['24mm', '24mm'],
                  ['35mm', '35mm'],
                  ['50mm', '50mm'],
                  ['85mm', '85mm'],
                  ['135mm', '135mm'],
                  ['ortho', 'Ortho'],
                ] as const
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  active={rp.lens.focal === id}
                  label={label}
                  onClick={() => patch({ lens: { ...rp.lens, focal: id } })}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 text-[9px] text-zinc-400">
              <input
                type="checkbox"
                checked={rp.camera.dof}
                onChange={(e) => patch({ camera: { ...rp.camera, dof: e.target.checked } })}
              />
              Depth of field
            </label>
            <Slider
              label="Bokeh"
              value={rp.camera.bokehScale}
              max={4}
              onChange={(bokehScale) => patch({ camera: { ...rp.camera, bokehScale } })}
            />
            <Slider
              label="Vignette"
              value={rp.camera.vignette}
              onChange={(vignette) => patch({ camera: { ...rp.camera, vignette } })}
            />
            <Slider
              label="Film grain"
              value={rp.camera.filmGrain}
              onChange={(filmGrain) => patch({ camera: { ...rp.camera, filmGrain } })}
            />
          </section>
        ) : null}

        {tab === 'graph' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Render Graph
            </h3>
            {(
              [
                ['sky', 'Sky'],
                ['gi', 'GI'],
                ['ao', 'AO'],
                ['lighting', 'Lighting'],
                ['materials', 'Materials'],
                ['bloom', 'Bloom'],
                ['lut', 'LUT'],
                ['tone', 'Tone'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[9px] text-zinc-400">
                <input
                  type="checkbox"
                  checked={rp.graph[key]}
                  onChange={(e) => patch({ graph: { ...rp.graph, [key]: e.target.checked } })}
                />
                {label}
              </label>
            ))}
            <p className="text-[7px] text-zinc-600 m-0">
              Nodes toggle live pass budgets — no renderer restart.
            </p>
          </section>
        ) : null}

        {tab === 'validate' && report ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Render Validator
            </h3>
            <div className="flex items-center gap-2 p-2 rounded border border-[#283142] bg-[#111722]">
              <CheckCircle2
                className={`w-5 h-5 ${
                  report.score >= 85
                    ? 'text-emerald-400'
                    : report.score >= 65
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }`}
              />
              <div>
                <div className="text-[14px] font-black">{report.score}</div>
                <div className="text-[8px] text-zinc-500">Quality score</div>
              </div>
              <button
                type="button"
                className="ml-auto px-2 py-1 rounded border border-violet-400/40 text-[9px] font-bold text-violet-100"
                onClick={() => commit(applyValidatorAutoFix(rp))}
              >
                Auto Fix
              </button>
            </div>
            {report.issues.length === 0 ? (
              <p className="text-[9px] text-emerald-300/80 m-0">No issues — look is balanced.</p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-1">
                {report.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className="p-2 rounded border border-[#283142] bg-[#0f1520] text-[9px]"
                  >
                    <span
                      className={`font-bold uppercase text-[8px] ${
                        issue.severity === 'critical'
                          ? 'text-rose-400'
                          : issue.severity === 'warn'
                            ? 'text-amber-400'
                            : 'text-sky-400'
                      }`}
                    >
                      {issue.severity} · {issue.area}
                    </span>
                    <p className="m-0 mt-1 text-zinc-300">{issue.message}</p>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex items-center gap-2 text-[9px] text-zinc-400">
              <input
                type="checkbox"
                checked={rp.validator.autoFixOnPreset}
                onChange={(e) =>
                  patch({ validator: { ...rp.validator, autoFixOnPreset: e.target.checked } })
                }
              />
              Auto-fix when applying presets
            </label>
            <div className="flex items-center gap-1 text-[7px] text-zinc-600">
              <Sun className="w-3 h-3" /> Checks lighting, AO, bloom, GI, particles, TAA.
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
