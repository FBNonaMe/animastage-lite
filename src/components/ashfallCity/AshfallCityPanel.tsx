import { Building2, Camera, Image, Sparkles, Mountain } from 'lucide-react';
import type { AppState, CameraSnapshot } from '../../types';
import {
  ASHFALL_CAMERA_SPOTS,
  ASHFALL_CITY_NAME,
  ASHFALL_CITY_TAGLINE,
  ASHFALL_PHOTO_SPOTS,
  ASHFALL_STUDIO_PRESETS,
  ASHFALL_VARIANTS,
  DEFAULT_ASHFALL_CITY,
  applyAshfallCameraSpot,
  applyAshfallCityDisable,
  applyAshfallCityEnable,
  applyAshfallPhotoSpot,
  applyAshfallStudioPreset,
  applyAshfallVariant,
  type AshfallApplyResult,
  type AshfallCityState,
  type AshfallQualityId,
} from '../../ashfallCity';

export interface AshfallCityPanelProps {
  appState: AppState;
  onApplyResult: (result: AshfallApplyResult) => void;
  onPatchAshfall: (patch: Partial<AshfallCityState>) => void;
  onFlyToCamera?: (snapshot: CameraSnapshot) => void;
}

export default function AshfallCityPanel({
  appState,
  onApplyResult,
  onPatchAshfall,
  onFlyToCamera,
}: AshfallCityPanelProps) {
  const ash = appState.ashfallCity ?? DEFAULT_ASHFALL_CITY;

  const run = (result: AshfallApplyResult) => {
    onApplyResult(result);
    if (result.cameraSnapshot) onFlyToCamera?.(result.cameraSnapshot);
  };

  return (
    <div className="p-2 space-y-3 text-zinc-300">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-zinc-100 m-0 flex items-center gap-1.5">
            <Mountain className="w-3.5 h-3.5 text-amber-400" />
            {ASHFALL_CITY_NAME}
          </p>
          <p className="text-[9px] text-zinc-500 m-0 mt-0.5 leading-relaxed">
            {ASHFALL_CITY_TAGLINE}
          </p>
        </div>
        <label className="inline-flex items-center gap-1.5 text-[9px] font-semibold cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={ash.enabled}
            onChange={(e) => {
              run(
                e.target.checked
                  ? applyAshfallCityEnable(appState)
                  : applyAshfallCityDisable(appState)
              );
            }}
          />
          Active
        </label>
      </div>

      <section className="rounded-md border border-amber-500/20 bg-[#0c0f14] p-2 space-y-2">
        <p className="text-[10px] font-bold text-amber-200/90 m-0 flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5" />
          Scene variants
        </p>
        <div className="grid grid-cols-3 gap-1">
          {ASHFALL_VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => run(applyAshfallVariant(appState, v.id))}
              className={`text-[8px] font-bold py-1.5 rounded border cursor-pointer ${
                ash.variantId === v.id && ash.enabled
                  ? 'border-amber-500/50 bg-amber-950/40 text-amber-100'
                  : 'border-zinc-700 text-zinc-400 hover:border-amber-500/30'
              }`}
              title={v.description}
            >
              {v.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-[#2a3140] bg-[#0c0f14] p-2 space-y-2">
        <p className="text-[10px] font-bold text-zinc-300 m-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          Smart Studio
        </p>
        <div className="grid grid-cols-2 gap-1">
          {ASHFALL_STUDIO_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => run(applyAshfallStudioPreset(appState, p.id))}
              className="text-[8px] font-bold py-1.5 rounded border border-zinc-700 text-zinc-300 hover:border-cyan-500/40 cursor-pointer"
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-[#2a3140] bg-[#0c0f14] p-2 space-y-2">
        <p className="text-[10px] font-bold text-zinc-300 m-0 flex items-center gap-1">
          <Camera className="w-3.5 h-3.5" />
          Cinematic cameras
        </p>
        <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto">
          {ASHFALL_CAMERA_SPOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => run(applyAshfallCameraSpot(appState, s.id))}
              className={`text-[8px] font-bold py-1 rounded border cursor-pointer truncate ${
                ash.activeCameraSpotId === s.id
                  ? 'border-cyan-500/45 bg-cyan-950/30 text-cyan-100'
                  : 'border-zinc-700 text-zinc-400'
              }`}
              title={s.description}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-[#2a3140] bg-[#0c0f14] p-2 space-y-2">
        <p className="text-[10px] font-bold text-zinc-300 m-0 flex items-center gap-1">
          <Image className="w-3.5 h-3.5" />
          Photo spots
        </p>
        <div className="grid grid-cols-2 gap-1">
          {ASHFALL_PHOTO_SPOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => run(applyAshfallPhotoSpot(appState, s.id))}
              className={`text-[8px] font-bold py-1 rounded border cursor-pointer ${
                ash.activePhotoSpotId === s.id
                  ? 'border-violet-500/45 bg-violet-950/30 text-violet-100'
                  : 'border-zinc-700 text-zinc-400'
              }`}
              title={s.description}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-[#2a3140] bg-[#0c0f14] p-2 space-y-2">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Performance</p>
        <div className="flex gap-1">
          {(
            [
              ['lite', 'Lite'],
              ['standard', 'Standard'],
              ['high', 'High'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onPatchAshfall({ quality: id as AshfallQualityId })}
              className={`flex-1 text-[8px] font-bold py-1 rounded border cursor-pointer ${
                ash.quality === id
                  ? 'border-emerald-500/45 text-emerald-200'
                  : 'border-zinc-700 text-zinc-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={ash.ambientFx}
            onChange={(e) => onPatchAshfall({ ambientFx: e.target.checked })}
          />
          Ambient FX (ash, smoke, flicker)
        </label>
        <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={ash.showLandmarks}
            onChange={(e) => onPatchAshfall({ showLandmarks: e.target.checked })}
          />
          Signature landmarks
        </label>
        <label className="block space-y-1">
          <div className="flex justify-between text-[9px] text-zinc-500">
            <span>Wind</span>
            <span>{ash.windStrength.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={ash.windStrength}
            onChange={(e) => onPatchAshfall({ windStrength: Number(e.target.value) })}
            className="w-full accent-amber-400"
          />
        </label>
      </section>

      <p className="text-[8px] text-zinc-600 leading-relaxed m-0">
        Original fictional city · 12 districts · Environment Asset mode (auto scale / spawn /
        camera fit). Not a real-world location.
      </p>
    </div>
  );
}
