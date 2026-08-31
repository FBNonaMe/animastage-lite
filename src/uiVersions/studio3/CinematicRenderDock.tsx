/**
 * UI 3.0 Cinematic Rendering System dock —
 * quality presets, sun, weather, styles, export auto-quality.
 */
import type { AppState, WeatherPresetId } from '../../types';
import type { QualityMode } from '../../product/scene/types';
import {
  CINEMATIC_QUALITY_PRESETS,
  CINEMATIC_RENDER_STYLES,
  CINEMATIC_SUN_TIMES,
  DEFAULT_CINEMATIC_RENDER,
  DEFAULT_CINEMA_RENDER,
  CINEMA_OUTPUT_PRESETS,
  type CinematicQualityPresetId,
  type CinematicRenderStyleId,
  type CinematicSunTimeId,
  type CinemaOutputPresetId,
} from '../../cinematicRender';
import { DEFAULT_REFLECTION_SYSTEM } from '../../reflections';
import type { ReflectionSystemSettings } from '../../reflections';
import { DEFAULT_ASRP, renderFlagsToPipeline, ASRP_VISUAL_STYLES, type AsrpPipelineId, type AsrpSettings, type AsrpVisualStyleId } from '../../asrp';
import { Button, Panel, Slider, Toggle } from '../../components/UI';

const WEATHER: { id: WeatherPresetId; label: string }[] = [
  { id: 'clear', label: 'Clear' },
  { id: 'rain', label: 'Rain' },
  { id: 'snow', label: 'Snow' },
  { id: 'fog', label: 'Fog' },
  { id: 'storm', label: 'Storm' },
];

const PIPELINES: { id: AsrpPipelineId; label: string; hint: string }[] = [
  { id: 'classic', label: 'Classic', hint: 'MMD toon fidelity' },
  { id: 'asrp', label: 'ASRP', hint: 'Silhouette POM + PBR' },
  { id: 'rtx_lite', label: 'RTX Lite', hint: 'POM + probes + AO' },
];

export interface CinematicRenderDockProps {
  appState: AppState;
  onApplyQuality: (id: CinematicQualityPresetId) => void;
  onApplySun: (id: CinematicSunTimeId) => void;
  onApplyWeather: (id: WeatherPresetId) => void;
  onApplyStyle: (id: CinematicRenderStyleId) => void;
  onApplyAsrpVisualStyle?: (id: AsrpVisualStyleId) => void;
  onAutoCinematicDirector?: () => void;
  onPatchCinematic: (
    patch: Partial<NonNullable<AppState['cinematicRender']>>,
    rebuild?: boolean
  ) => void;
  onReapply: () => void;
  onPatchReflections: (patch: Partial<ReflectionSystemSettings>) => void;
  onPatchAsrp: (patch: Partial<AsrpSettings>) => void;
  onQualityModeChange?: (mode: QualityMode) => void;
  onCinemaRender?: () => void;
  onPatchCinema?: (patch: Partial<NonNullable<AppState['cinemaRender']>>) => void;
}

export default function CinematicRenderDock({
  appState,
  onApplyQuality,
  onApplySun,
  onApplyWeather,
  onApplyStyle,
  onApplyAsrpVisualStyle,
  onAutoCinematicDirector,
  onPatchCinematic,
  onReapply,
  onPatchReflections,
  onPatchAsrp,
  onCinemaRender,
  onPatchCinema,
}: CinematicRenderDockProps) {
  const cr = appState.cinematicRender ?? DEFAULT_CINEMATIC_RENDER;
  const cinema = appState.cinemaRender ?? DEFAULT_CINEMA_RENDER;
  const rs = appState.reflectionSystem ?? DEFAULT_REFLECTION_SYSTEM;
  const asrp = appState.asrp ?? DEFAULT_ASRP;
  const pipeline = renderFlagsToPipeline(
    appState.visualFx.renderMode,
    appState.rtxModeEnabled
  );

  return (
    <div className="p-2 space-y-2">
      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-200 m-0">Render Pipeline</p>
        <p className="text-[8px] text-zinc-500 m-0 leading-snug">
          ASRP is default — Silhouette POM on every compatible material
        </p>
        <div className="grid grid-cols-3 gap-1">
          {PIPELINES.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={(asrp.pipeline || pipeline) === p.id ? 'primary' : 'secondary'}
              className="w-full !text-[8px]"
              title={p.hint}
              onClick={() => onPatchAsrp({ pipeline: p.id, enabled: p.id !== 'classic' })}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-200 m-0">ASRP Visual Styles</p>
        <p className="text-[8px] text-zinc-500 m-0 leading-snug">
          Single look table — lighting, LUT, bloom, shadows, reflections
        </p>
        <div className="grid grid-cols-2 gap-1">
          {ASRP_VISUAL_STYLES.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant="secondary"
              className="w-full !text-[8px]"
              title={s.description}
              onClick={() => onApplyAsrpVisualStyle?.(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        {onAutoCinematicDirector && (
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="w-full !text-[9px]"
            onClick={onAutoCinematicDirector}
          >
            Auto Cinematic Director
          </Button>
        )}
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Silhouette POM (ASRP)</p>
        <Toggle
          label="Enabled"
          checked={asrp.enabled && asrp.pipeline !== 'classic'}
          onChange={(e) =>
            onPatchAsrp({
              enabled: e.target.checked,
              pipeline: e.target.checked
                ? asrp.pipeline === 'classic'
                  ? 'asrp'
                  : asrp.pipeline
                : 'classic',
            })
          }
        />
        <Toggle
          label="Anime-friendly silhouette"
          checked={asrp.animePreserve}
          onChange={(e) => onPatchAsrp({ animePreserve: e.target.checked })}
        />
        <Toggle
          label="Auto height from textures"
          checked={asrp.autoHeightApprox}
          onChange={(e) => onPatchAsrp({ autoHeightApprox: e.target.checked })}
        />
        <Slider
          label="Depth strength"
          valueLabel={asrp.depthStrength.toFixed(2)}
          min={0}
          max={2}
          step={0.05}
          value={asrp.depthStrength}
          onChange={(e) => onPatchAsrp({ depthStrength: parseFloat(e.target.value) })}
        />
        <Slider
          label="Height / parallax scale"
          valueLabel={asrp.heightScale.toFixed(2)}
          min={0}
          max={2}
          step={0.05}
          value={asrp.heightScale}
          onChange={(e) =>
            onPatchAsrp({
              heightScale: parseFloat(e.target.value),
              parallaxScale: parseFloat(e.target.value),
            })
          }
        />
        <Slider
          label="Silhouette width"
          valueLabel={asrp.silhouetteWidth.toFixed(2)}
          min={0}
          max={2}
          step={0.05}
          value={asrp.silhouetteWidth}
          onChange={(e) => onPatchAsrp({ silhouetteWidth: parseFloat(e.target.value) })}
        />
        <Slider
          label="Normal blend"
          valueLabel={asrp.normalBlend.toFixed(2)}
          min={0}
          max={2}
          step={0.05}
          value={asrp.normalBlend}
          onChange={(e) => onPatchAsrp({ normalBlend: parseFloat(e.target.value) })}
        />
        <div className="grid grid-cols-4 gap-1">
          {([8, 16, 32, 48] as const).map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={asrp.samples === n ? 'primary' : 'secondary'}
              className="w-full !text-[8px]"
              onClick={() => onPatchAsrp({ samples: n })}
            >
              {n} smp
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full !text-[9px]"
          onClick={() => onPatchAsrp({ samples: 'auto', quality: 'auto' })}
        >
          Auto quality / samples
        </Button>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold text-zinc-200 m-0">Cinematic Rendering</p>
            <p className="text-[8px] text-zinc-500 m-0 leading-snug">
              Lighting, atmosphere, weather &amp; post — export-ready looks
            </p>
          </div>
          <Toggle
            label="On"
            checked={cr.enabled}
            onChange={(e) => onPatchCinematic({ enabled: e.target.checked }, e.target.checked)}
          />
        </div>
        <Button type="button" size="sm" variant="secondary" className="w-full" onClick={onReapply}>
          Re-apply full look
        </Button>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Quality presets</p>
        <div className="grid grid-cols-2 gap-1">
          {CINEMATIC_QUALITY_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={cr.qualityPreset === p.id ? 'primary' : 'secondary'}
              className="w-full !text-[9px]"
              title={p.description}
              onClick={() => onApplyQuality(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Sun system</p>
        <div className="grid grid-cols-3 gap-1">
          {CINEMATIC_SUN_TIMES.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={cr.sunTime === s.id ? 'primary' : 'secondary'}
              className="w-full !text-[8px]"
              onClick={() => onApplySun(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <Slider
          label="Sun intensity"
          valueLabel={cr.sunIntensity.toFixed(2)}
          min={0.2}
          max={2}
          step={0.05}
          value={cr.sunIntensity}
          onChange={(e) =>
            onPatchCinematic({ sunIntensity: parseFloat(e.target.value) }, true)
          }
        />
        <Slider
          label="Color temperature"
          valueLabel={`${Math.round(cr.sunColorTempK)}K`}
          min={2200}
          max={10000}
          step={100}
          value={cr.sunColorTempK}
          onChange={(e) =>
            onPatchCinematic({ sunColorTempK: parseFloat(e.target.value) }, true)
          }
        />
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Atmosphere</p>
        <Toggle
          label="Soft shadows"
          checked={cr.softShadows}
          onChange={(e) => onPatchCinematic({ softShadows: e.target.checked }, true)}
        />
        <Toggle
          label="Contact shadows"
          checked={cr.contactShadows}
          onChange={(e) => onPatchCinematic({ contactShadows: e.target.checked }, true)}
        />
        <Toggle
          label="Atmospheric scattering"
          checked={cr.atmosphericScattering}
          onChange={(e) =>
            onPatchCinematic({ atmosphericScattering: e.target.checked }, true)
          }
        />
        <Toggle
          label="Light shafts / god rays"
          checked={cr.lightShafts}
          onChange={(e) => onPatchCinematic({ lightShafts: e.target.checked }, true)}
        />
        <Toggle
          label="Volumetric fog"
          checked={cr.volumetricFog}
          onChange={(e) => onPatchCinematic({ volumetricFog: e.target.checked }, true)}
        />
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Weather</p>
        <div className="grid grid-cols-3 gap-1">
          {WEATHER.map((w) => (
            <Button
              key={w.id}
              type="button"
              size="sm"
              variant={cr.weather === w.id ? 'primary' : 'secondary'}
              className="w-full !text-[9px]"
              onClick={() => onApplyWeather(w.id)}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Render styles</p>
        <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-0.5">
          {CINEMATIC_RENDER_STYLES.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={cr.renderStyle === s.id ? 'primary' : 'secondary'}
              className="w-full !text-[8px]"
              title={s.description}
              onClick={() => onApplyStyle(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Box reflections (built-in)</p>
        <p className="text-[8px] text-zinc-500 m-0 leading-snug">
          Auto probes · box projection · roughness — on by default
        </p>
        <Toggle
          label="Enabled"
          checked={rs.enabled}
          onChange={(e) => onPatchReflections({ enabled: e.target.checked })}
        />
        <Toggle
          label="Box projection"
          checked={rs.boxProjection}
          onChange={(e) => onPatchReflections({ boxProjection: e.target.checked })}
        />
        <Toggle
          label="Contact hardening"
          checked={rs.contactHardening}
          onChange={(e) => onPatchReflections({ contactHardening: e.target.checked })}
        />
        <Toggle
          label="Character reflections"
          checked={rs.characterReflections}
          onChange={(e) => onPatchReflections({ characterReflections: e.target.checked })}
        />
        <Slider
          label="Intensity"
          valueLabel={rs.intensity.toFixed(2)}
          min={0}
          max={2}
          step={0.05}
          value={rs.intensity}
          onChange={(e) => onPatchReflections({ intensity: parseFloat(e.target.value) })}
        />
        <Slider
          label="Roughness influence"
          valueLabel={rs.roughnessInfluence.toFixed(2)}
          min={0}
          max={2}
          step={0.05}
          value={rs.roughnessInfluence}
          onChange={(e) =>
            onPatchReflections({ roughnessInfluence: parseFloat(e.target.value) })
          }
        />
        <Slider
          label="Refresh rate (s)"
          valueLabel={rs.refreshRate.toFixed(1)}
          min={0}
          max={8}
          step={0.5}
          value={rs.refreshRate}
          onChange={(e) => onPatchReflections({ refreshRate: parseFloat(e.target.value) })}
        />
        <div className="grid grid-cols-4 gap-1">
          {([64, 128, 256, 512] as const).map((res) => (
            <Button
              key={res}
              type="button"
              size="sm"
              variant={rs.resolution === res ? 'primary' : 'secondary'}
              className="w-full !text-[8px]"
              onClick={() => onPatchReflections({ resolution: res })}
            >
              {res}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full !text-[9px]"
          onClick={() => onPatchReflections({ resolution: 'auto' })}
        >
          Auto resolution
        </Button>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Export</p>
        <Toggle
          label="Auto quality on video export"
          description="Raises shadows, AA, particles, AO, reflections and post while rendering MP4 — restores after."
          checked={cr.autoExportQuality}
          onChange={(e) => onPatchCinematic({ autoExportQuality: e.target.checked }, false)}
        />
      </Panel>

      {onCinemaRender && (
        <Panel className="!p-2 space-y-1.5">
          <p className="text-[10px] font-bold text-amber-200/90 m-0">Cinema Render</p>
          <p className="text-[8px] text-zinc-500 m-0 leading-snug">
            Offline only — supersample, max ASRP/reflections/post, never skip frames. Slow but cinematic.
          </p>
          {onPatchCinema && cinema && (
            <>
              <label className="block space-y-0.5">
                <span className="text-[8px] text-zinc-500">Output</span>
                <select
                  className="w-full text-[9px] bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-zinc-200"
                  value={cinema.outputPreset}
                  onChange={(e) =>
                    onPatchCinema({
                      outputPreset: e.target.value as CinemaOutputPresetId,
                    })
                  }
                >
                  {CINEMA_OUTPUT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.width}×{p.height})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-0.5">
                <span className="text-[8px] text-zinc-500">Supersample</span>
                <select
                  className="w-full text-[9px] bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-zinc-200"
                  value={cinema.supersample}
                  onChange={(e) =>
                    onPatchCinema({
                      supersample: Number(e.target.value) as 1 | 1.5 | 2 | 3,
                    })
                  }
                >
                  <option value={1}>100%</option>
                  <option value={1.5}>150%</option>
                  <option value={2}>200%</option>
                  <option value={3}>300%</option>
                </select>
              </label>
              <Toggle
                label="Smooth camera (no handheld)"
                checked={cinema.smoothCamera}
                onChange={(e) => onPatchCinema({ smoothCamera: e.target.checked })}
              />
            </>
          )}
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="w-full !text-[9px]"
            onClick={onCinemaRender}
          >
            Start Cinema Render
          </Button>
        </Panel>
      )}
    </div>
  );
}
