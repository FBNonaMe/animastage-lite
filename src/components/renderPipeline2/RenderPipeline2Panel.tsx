import { useMemo, useState } from 'react';
import {
  Aperture,
  CloudFog,
  Cpu,
  Layers,
  Lightbulb,
  Sparkles,
  Sun,
  Wand2,
} from 'lucide-react';
import type { AppState } from '../../types';
import { applyRenderPipeline2, mergeRenderPipeline2 } from '../../renderPipeline2/apply';
import type { RenderPipeline2ApplyResult } from '../../renderPipeline2/apply';
import {
  RENDER_PIPELINE_2_PRESETS,
  applyPresetToState,
} from '../../renderPipeline2/presets';
import type {
  AoModeId,
  GiModeId,
  RenderPipeline2PresetId,
  RenderPipeline2State,
} from '../../renderPipeline2/types';

type Tab =
  | 'presets'
  | 'gi'
  | 'ao'
  | 'look'
  | 'lights'
  | 'camera'
  | 'perf';

export interface RenderPipeline2PanelProps {
  appState: AppState;
  onApply: (result: RenderPipeline2ApplyResult, next: RenderPipeline2State) => void;
  onPatchPipeline: (patch: Partial<RenderPipeline2State>) => void;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'presets', label: 'Presets' },
  { id: 'gi', label: 'GI' },
  { id: 'ao', label: 'AO' },
  { id: 'look', label: 'Look' },
  { id: 'lights', label: 'Lights' },
  { id: 'camera', label: 'Camera' },
  { id: 'perf', label: 'Perf' },
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
          ? 'border-sky-400/60 bg-sky-400/10 text-sky-100'
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
        <span className="text-sky-200">{value.toFixed(2)}</span>
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

export default function RenderPipeline2Panel({
  appState,
  onApply,
  onPatchPipeline,
}: RenderPipeline2PanelProps) {
  const [tab, setTab] = useState<Tab>('presets');
  const rp = appState.renderPipeline2;

  const backendLabel = useMemo(() => {
    const b = rp?.performance.backend ?? 'auto';
    return b === 'auto' ? 'Auto (WebGL)' : b.toUpperCase();
  }, [rp?.performance.backend]);

  if (!rp) {
    return (
      <div className="p-3 text-[10px] text-zinc-500">
        Render Pipeline 2.0 is not initialized.
      </div>
    );
  }

  const commit = (next: RenderPipeline2State) => {
    onPatchPipeline(next);
    onApply(applyRenderPipeline2(next), next);
  };

  const patch = (partial: Partial<RenderPipeline2State>) => {
    commit(mergeRenderPipeline2(rp, { ...partial, activePreset: 'custom' }));
  };

  const applyPreset = (id: RenderPipeline2PresetId) => {
    commit(applyPresetToState(rp, id));
  };

  return (
    <div className="text-zinc-200 bg-[#0b1220] min-h-full">
      <header className="p-3 border-b border-[#233142] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_48%)]">
        <div className="flex items-center gap-2">
          <Aperture className="w-4 h-4 text-sky-300" />
          <div>
            <h2 className="text-[12px] font-black tracking-wide m-0">RENDER PIPELINE 2.0</h2>
            <p className="text-[8px] text-zinc-500 m-0">
              Anime realtime · {backendLabel} · live preview
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
        <div className="grid grid-cols-7 gap-0.5 mt-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`py-1.5 rounded text-[8px] font-bold ${
                tab === item.id ? 'bg-sky-500/20 text-sky-100' : 'text-zinc-500 hover:bg-white/5'
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
              {RENDER_PIPELINE_2_PRESETS.map((preset) => (
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
              <Wand2 className="w-3 h-3" /> One click applies lighting, GI, AO, bloom and grade.
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
            <label className="flex items-center gap-2 text-[9px] text-zinc-400">
              <input
                type="checkbox"
                checked={rp.gi.halfResolution}
                onChange={(e) =>
                  patch({ gi: { ...rp.gi, halfResolution: e.target.checked } })
                }
              />
              Half resolution + temporal accumulation
            </label>
          </section>
        ) : null}

        {tab === 'ao' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Ambient Occlusion + Contact
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
            <Slider
              label="Contact scale"
              value={rp.contactShadows.scale}
              min={4}
              max={40}
              step={0.5}
              onChange={(scale) =>
                patch({ contactShadows: { ...rp.contactShadows, scale } })
              }
            />
          </section>
        ) : null}

        {tab === 'look' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <CloudFog className="w-3 h-3" /> Bloom · Fog · Color
            </h3>
            <Slider
              label="Bloom"
              value={rp.bloom.intensity}
              max={1.5}
              onChange={(intensity) =>
                patch({ bloom: { ...rp.bloom, intensity, enabled: intensity > 0.02 } })
              }
            />
            <Slider
              label="Bloom threshold"
              value={rp.bloom.threshold}
              onChange={(threshold) => patch({ bloom: { ...rp.bloom, threshold } })}
            />
            <Slider
              label="Distance fog"
              value={rp.volumetrics.distanceFog}
              onChange={(distanceFog) =>
                patch({
                  volumetrics: {
                    ...rp.volumetrics,
                    distanceFog,
                    fogEnabled: distanceFog > 0.05 || rp.volumetrics.heightFog > 0.05,
                  },
                })
              }
            />
            <Slider
              label="God rays"
              value={rp.volumetrics.godRaysIntensity}
              onChange={(godRaysIntensity) =>
                patch({
                  volumetrics: {
                    ...rp.volumetrics,
                    godRaysIntensity,
                    godRays: godRaysIntensity > 0.05,
                  },
                })
              }
            />
            <Slider
              label="Exposure"
              value={rp.color.exposure}
              min={0.5}
              max={1.8}
              onChange={(exposure) => patch({ color: { ...rp.color, exposure } })}
            />
            <div className="grid grid-cols-3 gap-1">
              {(['aces', 'agx', 'anime', 'filmic', 'neutral'] as const).map((t) => (
                <Chip
                  key={t}
                  active={rp.color.toneMapper === t}
                  label={t.toUpperCase()}
                  onClick={() => patch({ color: { ...rp.color, toneMapper: t } })}
                />
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'lights' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <Sun className="w-3 h-3" /> Light Mixer
            </h3>
            <Slider
              label="Sun"
              value={rp.lights.sunIntensity}
              max={2}
              onChange={(sunIntensity) => patch({ lights: { ...rp.lights, sunIntensity } })}
            />
            <Slider
              label="Sky"
              value={rp.lights.skyIntensity}
              max={2}
              onChange={(skyIntensity) => patch({ lights: { ...rp.lights, skyIntensity } })}
            />
            <Slider
              label="Ambient"
              value={rp.lights.ambientIntensity}
              max={2}
              onChange={(ambientIntensity) =>
                patch({ lights: { ...rp.lights, ambientIntensity } })
              }
            />
            <Slider
              label="Temperature (K proxy)"
              value={(rp.lights.temperature - 3000) / 5000}
              onChange={(t) =>
                patch({ lights: { ...rp.lights, temperature: 3000 + t * 5000 } })
              }
            />
            <p className="text-[7px] text-zinc-600 m-0 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Dynamic Sky continues to drive time-of-day.
            </p>
          </section>
        ) : null}

        {tab === 'camera' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Cinematic Camera
            </h3>
            <label className="flex items-center gap-2 text-[9px] text-zinc-300">
              <input
                type="checkbox"
                checked={rp.camera.dof}
                onChange={(e) => patch({ camera: { ...rp.camera, dof: e.target.checked } })}
              />
              Depth of Field
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
              label="Chromatic aberration"
              value={rp.camera.chromaticAberration}
              max={0.01}
              step={0.0001}
              onChange={(chromaticAberration) =>
                patch({ camera: { ...rp.camera, chromaticAberration } })
              }
            />
          </section>
        ) : null}

        {tab === 'perf' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Performance
            </h3>
            <div className="grid grid-cols-3 gap-1">
              {(['auto', 'webgl', 'webgpu'] as const).map((b) => (
                <Chip
                  key={b}
                  active={rp.performance.backend === b}
                  label={b.toUpperCase()}
                  onClick={() => patch({ performance: { ...rp.performance, backend: b } })}
                />
              ))}
            </div>
            {(
              [
                ['autoQualityScale', 'Auto quality scale'],
                ['dynamicResolution', 'Dynamic resolution'],
                ['lod', 'LOD'],
                ['frustumCulling', 'Frustum culling'],
                ['gpuInstancing', 'GPU instancing'],
              ] as Array<[keyof typeof rp.performance, string]>
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[9px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={Boolean(rp.performance[key])}
                  onChange={(e) =>
                    patch({
                      performance: { ...rp.performance, [key]: e.target.checked },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
