import { Clapperboard, Gauge, HardDrive, Timer } from 'lucide-react';
import { useMemo } from 'react';
import type { AppState, ViewportFormat } from '../../types';
import { MMD_FPS } from '../../utils/playhead';
import {
  DEFAULT_RENDER_PIPELINE_4,
  estimateRp4Export,
  formatEstimateDuration,
  mergeRenderPipeline4,
  RP4_AA_LABELS,
  RP4_BITRATE_LABELS,
  RP4_CODEC_LABELS,
  RP4_FPS_PRESETS,
  RP4_QUALITY_BUDGETS,
  RP4_QUALITY_LABELS,
  RP4_RESOLUTION_PRESETS,
  type Rp4AntiAliasingId,
  type Rp4BitrateModeId,
  type Rp4CodecId,
  type Rp4FpsPresetId,
  type Rp4QualityPresetId,
  type Rp4RenderPassId,
  type Rp4ResolutionPresetId,
  type RenderPipeline4State,
} from '../../renderPipeline4';

export interface RenderPipeline4PanelProps {
  appState: AppState;
  exportDurationSec: number;
  maxDurationSec?: number;
  busy?: boolean;
  viewportFormat?: ViewportFormat;
  onPatch: (patch: Partial<RenderPipeline4State>) => void;
  onStartExport: () => void;
  onExportDurationSecChange?: (sec: number) => void;
}

const QUALITY_IDS = Object.keys(RP4_QUALITY_LABELS) as Rp4QualityPresetId[];
const RES_IDS = [...Object.keys(RP4_RESOLUTION_PRESETS), 'custom'] as Rp4ResolutionPresetId[];
const FPS_IDS = [...Object.keys(RP4_FPS_PRESETS), 'custom'] as Rp4FpsPresetId[];
const AA_IDS = Object.keys(RP4_AA_LABELS) as Rp4AntiAliasingId[];
const CODEC_IDS = Object.keys(RP4_CODEC_LABELS) as Rp4CodecId[];
const BITRATE_IDS = Object.keys(RP4_BITRATE_LABELS) as Rp4BitrateModeId[];
const PASS_IDS: Rp4RenderPassId[] = [
  'beauty',
  'depth',
  'normal',
  'ao',
  'shadow',
  'reflection',
  'emission',
  'mask',
];

function SelectRow<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  labels: Record<string, string>;
  onChange: (v: T) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200"
      >
        {options.map((id) => (
          <option key={id} value={id}>
            {labels[id] ?? id}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function RenderPipeline4Panel({
  appState,
  exportDurationSec,
  maxDurationSec = 120,
  busy = false,
  viewportFormat = '16:9',
  onPatch,
  onStartExport,
  onExportDurationSecChange,
}: RenderPipeline4PanelProps) {
  const rp = appState.renderPipeline4 ?? DEFAULT_RENDER_PIPELINE_4;
  const budgets = RP4_QUALITY_BUDGETS[rp.quality];
  const preview = useMemo(
    () => estimateRp4Export(rp, exportDurationSec, viewportFormat),
    [rp, exportDurationSec, viewportFormat]
  );
  const maxFrames = Math.max(1, Math.ceil(maxDurationSec * MMD_FPS));
  const exportFrames = Math.max(1, Math.round(exportDurationSec * MMD_FPS));

  const set = (patch: Partial<RenderPipeline4State>) => {
    onPatch(mergeRenderPipeline4(rp, patch));
  };

  const togglePass = (id: Rp4RenderPassId) => {
    const has = rp.passes.includes(id);
    const next = has
      ? rp.passes.filter((p) => p !== id)
      : [...rp.passes, id];
    set({ passes: next.length ? next : ['beauty'] });
  };

  return (
    <div className="space-y-3 p-2 text-zinc-200">
      <div className="flex items-center gap-2">
        <Clapperboard className="h-4 w-4 text-amber-300" />
        <div>
          <div className="text-[12px] font-bold">Render Pipeline 4.0</div>
          <p className="text-[10px] text-zinc-500">
            Professional export — viewport Smart Render never lowers final quality.
          </p>
        </div>
      </div>

      <SelectRow
        label="Resolution"
        value={rp.resolution.preset}
        options={RES_IDS}
        labels={{
          ...Object.fromEntries(
            Object.entries(RP4_RESOLUTION_PRESETS).map(([k, v]) => [k, v.label])
          ),
          custom: 'Custom Resolution',
        }}
        onChange={(preset) => {
          if (preset === 'custom') {
            set({ resolution: { ...rp.resolution, preset } });
            return;
          }
          const p = RP4_RESOLUTION_PRESETS[preset];
          set({
            resolution: { preset, width: p.width, height: p.height },
          });
        }}
      />
      <p className="text-[9px] text-zinc-500 -mt-1">
        Export size follows viewport {viewportFormat}:{' '}
        <span className="font-mono text-zinc-300">
          {preview.width}×{preview.height}
        </span>
        {viewportFormat === '9:16' ? ' (portrait)' : null}
      </p>
      {rp.resolution.preset === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-[10px] text-zinc-500">Width</span>
            <input
              type="number"
              min={64}
              max={15360}
              value={rp.resolution.width}
              onChange={(e) =>
                set({
                  resolution: {
                    ...rp.resolution,
                    width: parseInt(e.target.value, 10) || 1920,
                  },
                })
              }
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] text-zinc-500">Height</span>
            <input
              type="number"
              min={64}
              max={8640}
              value={rp.resolution.height}
              onChange={(e) =>
                set({
                  resolution: {
                    ...rp.resolution,
                    height: parseInt(e.target.value, 10) || 1080,
                  },
                })
              }
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] font-mono"
            />
          </label>
        </div>
      ) : null}

      <SelectRow
        label="Frame Rate"
        value={rp.fps.preset}
        options={FPS_IDS}
        labels={{
          ...Object.fromEntries(
            Object.entries(RP4_FPS_PRESETS).map(([k, v]) => [k, v.label])
          ),
          custom: 'Custom FPS',
        }}
        onChange={(preset) => {
          if (preset === 'custom') {
            set({ fps: { ...rp.fps, preset } });
            return;
          }
          set({ fps: { preset, fps: RP4_FPS_PRESETS[preset].fps } });
        }}
      />

      {rp.fps.preset === 'custom' ? (
        <label className="block space-y-1">
          <span className="text-[10px] text-zinc-500">Custom FPS</span>
          <input
            type="number"
            min={1}
            max={240}
            value={rp.fps.fps}
            onChange={(e) =>
              set({ fps: { ...rp.fps, fps: parseInt(e.target.value, 10) || 30 } })
            }
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] font-mono"
          />
        </label>
      ) : null}

      <SelectRow
        label="Render Quality"
        value={rp.quality}
        options={QUALITY_IDS}
        labels={RP4_QUALITY_LABELS}
        onChange={(quality) => {
          const b = RP4_QUALITY_BUDGETS[quality];
          set({ quality, antiAliasing: b.antiAliasing });
        }}
      />

      <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2 text-[10px] text-zinc-400 grid grid-cols-2 gap-x-3 gap-y-1">
        <span>Shadows {budgets.shadowResolution}</span>
        <span>SSR {(budgets.ssrQuality * 100).toFixed(0)}%</span>
        <span>SSAO {(budgets.ssaoQuality * 100).toFixed(0)}%</span>
        <span>Bloom {(budgets.bloomQuality * 100).toFixed(0)}%</span>
        <span>DOF {(budgets.dofQuality * 100).toFixed(0)}%</span>
        <span>Volumetric {budgets.volumetricSamples}</span>
        <span>AA {RP4_AA_LABELS[budgets.antiAliasing]}</span>
        <span>SS ×{budgets.supersample}</span>
      </div>

      <SelectRow
        label="Anti Aliasing"
        value={rp.antiAliasing}
        options={AA_IDS}
        labels={RP4_AA_LABELS}
        onChange={(antiAliasing) => set({ antiAliasing })}
      />

      <SelectRow
        label="Video Codec"
        value={rp.codec}
        options={CODEC_IDS}
        labels={RP4_CODEC_LABELS}
        onChange={(codec) => set({ codec })}
      />

      <SelectRow
        label="Bitrate"
        value={rp.bitrate.mode}
        options={BITRATE_IDS}
        labels={RP4_BITRATE_LABELS}
        onChange={(mode) => set({ bitrate: { ...rp.bitrate, mode } })}
      />

      {rp.bitrate.mode === 'manual' ? (
        <label className="block space-y-1">
          <span className="text-[10px] text-zinc-500">Manual Mbps</span>
          <input
            type="number"
            min={1}
            max={250}
            value={rp.bitrate.manualMbps}
            onChange={(e) =>
              set({
                bitrate: {
                  ...rp.bitrate,
                  manualMbps: parseFloat(e.target.value) || 40,
                },
              })
            }
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] font-mono"
          />
        </label>
      ) : null}

      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
          Audio
        </div>
        {(
          [
            ['backgroundMusic', 'Background Music'],
            ['voice', 'Voice'],
            ['soundEffects', 'Sound Effects'],
            ['normalizeVolume', 'Volume normalization'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              checked={rp.audio[key]}
              onChange={() =>
                set({ audio: { ...rp.audio, [key]: !rp.audio[key] } })
              }
              className="accent-amber-500"
            />
            {label}
          </label>
        ))}
      </div>

      <SelectRow
        label="Background Export"
        value={rp.background}
        options={['solid', 'transparent', 'alpha', 'hdr']}
        labels={{
          solid: 'Solid Color',
          transparent: 'Transparent (PNG Sequence)',
          alpha: 'Alpha Rendering',
          hdr: 'HDR Rendering',
        }}
        onChange={(background) => {
          const next: Partial<RenderPipeline4State> = { background };
          if (background === 'transparent' || background === 'alpha') {
            next.codec = 'png_sequence';
          }
          set(next);
        }}
      />

      {rp.background === 'solid' ? (
        <label className="block space-y-1">
          <span className="text-[10px] text-zinc-500">Solid color</span>
          <input
            type="color"
            value={rp.solidBackgroundColor}
            onChange={(e) => set({ solidBackgroundColor: e.target.value })}
            className="h-8 w-full cursor-pointer rounded border border-zinc-700 bg-zinc-900"
          />
        </label>
      ) : null}

      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
          Render Passes
        </div>
        <div className="grid grid-cols-2 gap-1">
          {PASS_IDS.map((id) => (
            <label
              key={id}
              className="flex items-center gap-1.5 text-[10px] text-zinc-300 capitalize"
            >
              <input
                type="checkbox"
                checked={rp.passes.includes(id)}
                onChange={() => togglePass(id)}
                className="accent-amber-500"
              />
              {id}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded border border-amber-500/25 bg-amber-950/20 p-2.5 space-y-1.5">
        <div className="text-[10px] font-bold text-amber-200/90">Render Preview</div>
        {onExportDurationSecChange ? (
          <div className="grid grid-cols-2 gap-2 mb-1">
            <label className="block space-y-0.5">
              <span className="text-[9px] text-zinc-500">Seconds</span>
              <input
                type="number"
                min={0.1}
                max={maxDurationSec}
                step={0.1}
                value={Math.round(exportDurationSec * 10) / 10}
                disabled={busy}
                onChange={(e) =>
                  onExportDurationSecChange(
                    Math.min(
                      maxDurationSec,
                      Math.max(0.1, parseFloat(e.target.value) || 1)
                    )
                  )
                }
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-mono"
              />
            </label>
            <label className="block space-y-0.5">
              <span className="text-[9px] text-zinc-500">Frames to record</span>
              <input
                type="number"
                min={1}
                max={maxFrames}
                value={exportFrames}
                disabled={busy}
                onChange={(e) => {
                  const frames = Math.min(
                    maxFrames,
                    Math.max(1, parseInt(e.target.value, 10) || 1)
                  );
                  onExportDurationSecChange(frames / MMD_FPS);
                }}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-mono"
              />
            </label>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-zinc-300">
          <span>
            {preview.width}×{preview.height}
          </span>
          <span>
            {preview.fps} FPS · {preview.frameCount} fr · {preview.durationSec.toFixed(1)}s
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3 text-zinc-500" />
            ~{preview.estimatedFileSizeMb} MB
          </span>
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3 text-zinc-500" />
            {formatEstimateDuration(preview.estimatedRenderTimeSec)}
          </span>
          <span className="flex items-center gap-1">
            <Gauge className="h-3 w-3 text-zinc-500" />
            GPU ~{preview.estimatedGpuUsagePct}%
          </span>
          <span>Mem ~{preview.estimatedMemoryMb} MB</span>
        </div>
      </div>

      <label className="flex items-center gap-2 text-[11px] text-zinc-300">
        <input
          type="checkbox"
          checked={rp.smartRender.enabled}
          onChange={() =>
            set({
              smartRender: {
                ...rp.smartRender,
                enabled: !rp.smartRender.enabled,
              },
            })
          }
          className="accent-amber-500"
        />
        Smart Render (viewport only — never reduces final quality)
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={onStartExport}
        className="w-full rounded border border-amber-500/45 bg-amber-500/15 py-2.5 text-[11px] font-bold text-amber-50 hover:bg-amber-500/25 disabled:opacity-50"
      >
        {busy ? 'Rendering…' : 'Start Professional Export'}
      </button>
    </div>
  );
}
