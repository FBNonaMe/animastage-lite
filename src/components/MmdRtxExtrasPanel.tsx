import { useCallback, useEffect, useState } from 'react';
import { Bookmark, CloudRain, RotateCcw, Wrench } from 'lucide-react';
import type { CameraSnapshot, MmdLiteConfig, VisualFxSettings, WeatherPresetId } from '../types';
import {
  addCameraBookmark,
  exportBookmarksJson,
  importBookmarksJson,
  loadCameraBookmarks,
  removeCameraBookmark,
  saveCameraBookmarks,
  type CameraBookmark,
} from '../utils/mmdCameraBookmarks';
import {
  applyMmdPhysicsQualityPreset,
  applyMmdPhysicsRatePreset,
  type MmdPhysicsQualityPreset,
} from '../utils/mmdPhysicsPresets';
import { MMD_WEATHER_PRESETS, applyMmdWeatherPreset } from '../visualFx/mmdWeatherPresets';
import { shouldSuggestFixPhysics } from '../physics/physicsStabilitySystem';

interface MmdRtxExtrasPanelProps {
  visualFx: VisualFxSettings;
  mmdLite: MmdLiteConfig;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onPatchMmdLite: (patch: Partial<MmdLiteConfig>) => void;
  captureCamera: () => CameraSnapshot | null;
  onFlyToBookmark?: (snapshot: CameraSnapshot) => void;
  onRestartPhysics?: () => void;
  onFixPhysics?: () => void;
}

export default function MmdRtxExtrasPanel({
  visualFx,
  mmdLite,
  onSetVisualFx,
  onPatchMmdLite,
  captureCamera,
  onFlyToBookmark,
  onRestartPhysics,
  onFixPhysics,
}: MmdRtxExtrasPanelProps) {
  const [bookmarks, setBookmarks] = useState<CameraBookmark[]>(() => loadCameraBookmarks());
  const [suggestFix, setSuggestFix] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSuggestFix(shouldSuggestFixPhysics());
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  const persistBookmarks = useCallback((next: CameraBookmark[]) => {
    const result = saveCameraBookmarks(next);
    setBookmarks(result.bookmarks);
    if (result.message) {
      try {
        window.dispatchEvent(
          new CustomEvent('animastage:toast', {
            detail: { message: result.message, durationMs: 4500 },
          })
        );
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleWeather = (id: WeatherPresetId) => {
    onSetVisualFx(applyMmdWeatherPreset(id));
  };

  const handlePhysPreset = (preset: MmdPhysicsQualityPreset) => {
    if (preset !== 'safe') {
      applyMmdPhysicsRatePreset(
        preset === 'cinematic' ? 'cinematic' : preset === 'smooth' ? 'smooth' : 'default'
      );
    }
    onPatchMmdLite(applyMmdPhysicsQualityPreset(preset));
  };

  const handleSaveBookmark = () => {
    const snap = captureCamera();
    if (!snap) return;
    persistBookmarks(addCameraBookmark(`View ${bookmarks.length + 1}`, snap, bookmarks));
  };

  return (
    <div className="space-y-3 border-t border-zinc-800 pt-2">
      <div className="text-[9px] font-bold uppercase text-cyan-500/90 tracking-wide flex items-center gap-1">
        <CloudRain className="w-3 h-3" />
        MMD RTX — weather
      </div>
      <div className="flex flex-wrap gap-1">
        {MMD_WEATHER_PRESETS.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => handleWeather(w.id)}
            className={`text-[9px] font-bold px-2 py-1 rounded border cursor-pointer ${
              visualFx.weatherPreset === w.id
                ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
                : 'border-zinc-700 text-zinc-400 hover:border-cyan-500/30'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>
      <label className="block space-y-1">
        <div className="flex justify-between text-[9px] font-bold text-zinc-400">
          <span>Precipitation</span>
          <span className="font-mono">{(visualFx.precipIntensity ?? 0).toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={visualFx.precipIntensity ?? 0}
          onChange={(e) => onSetVisualFx({ precipIntensity: parseFloat(e.target.value) })}
          className="w-full accent-cyan-500"
          onClick={(e) => e.stopPropagation()}
        />
      </label>

      <div className="text-[9px] font-bold uppercase text-purple-400/90 tracking-wide">
        Cloth physics — presets
      </div>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ['safe', 'Safe'],
            ['default', 'Default'],
            ['smooth', 'Smooth'],
            ['cinematic', 'Cine'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => handlePhysPreset(id)}
            className="text-[9px] font-bold px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:border-purple-500/40 cursor-pointer"
          >
            {label}
          </button>
        ))}
      </div>
      {onFixPhysics && (
        <button
          type="button"
          onClick={onFixPhysics}
          className="w-full flex items-center justify-center gap-1.5 text-[9px] font-bold py-1.5 rounded border border-emerald-500/40 bg-emerald-950/25 text-emerald-200 hover:bg-emerald-950/40 cursor-pointer"
        >
          <Wrench className="w-3 h-3" />
          Fix Physics
        </button>
      )}
      {suggestFix && onFixPhysics && (
        <p className="text-[8px] text-amber-400/90 leading-relaxed">
          Physics instability detected — try Fix Physics.
        </p>
      )}
      {onRestartPhysics && (
        <button
          type="button"
          onClick={onRestartPhysics}
          className="w-full flex items-center justify-center gap-1.5 text-[9px] font-bold py-1.5 rounded border border-purple-500/35 text-purple-300 hover:bg-purple-950/30 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          Reload physics (full)
        </button>
      )}

      <div className="text-[9px] font-bold uppercase text-amber-500/90 tracking-wide flex items-center gap-1">
        <Bookmark className="w-3 h-3" />
        Camera bookmarks
      </div>
      <button
        type="button"
        onClick={handleSaveBookmark}
        className="w-full text-[9px] font-bold py-1.5 rounded border border-amber-500/35 text-amber-200 hover:bg-amber-950/25 cursor-pointer"
      >
        Save current view
      </button>
      {bookmarks.length > 0 && (
        <ul className="max-h-24 overflow-y-auto space-y-1">
          {bookmarks.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-1 text-[9px] bg-zinc-900/80 rounded px-1.5 py-1"
            >
              <button
                type="button"
                className="text-zinc-300 hover:text-amber-200 truncate flex-1 text-left cursor-pointer"
                onClick={() => onFlyToBookmark?.(b.snapshot)}
              >
                {b.name}
              </button>
              <button
                type="button"
                className="text-red-400/80 hover:text-red-300 cursor-pointer px-1"
                onClick={() => persistBookmarks(removeCameraBookmark(b.id, bookmarks))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1">
        <button
          type="button"
          className="flex-1 text-[8px] font-bold py-1 border border-zinc-700 rounded text-zinc-500 hover:text-zinc-300 cursor-pointer"
          onClick={() => {
            const json = exportBookmarksJson(bookmarks);
            void navigator.clipboard?.writeText(json);
          }}
        >
          Copy JSON
        </button>
        <label className="flex-1 text-[8px] font-bold py-1 border border-zinc-700 rounded text-zinc-500 hover:text-zinc-300 text-center cursor-pointer">
          Import
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((t) => {
                try {
                  persistBookmarks(importBookmarksJson(t));
                } catch {
                  /* invalid */
                }
              });
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {mmdLite.stablePhys && (
        <p className="text-[8px] text-zinc-600 leading-relaxed">
          Stable 65 Hz active — rate/substeps from RTX preset apply when stable is off.
        </p>
      )}
    </div>
  );
}
