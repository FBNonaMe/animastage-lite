import { useRef } from 'react';
import { Clock, Film, Plus, Smartphone, X } from 'lucide-react';
import {
  SHORTS_DURATION_PRESETS_SEC,
  clampShortsDuration,
  formatShortsDurationLabel,
} from '../shorts/shortsConfig';
import {
  MAX_TEMPLATE_DURATION_SEC,
  MIN_TEMPLATE_DURATION_SEC,
} from '../templates/duration';

export interface ShortsSetupModelRow {
  id: string;
  name: string;
  vmdFileNames: string[];
  activeVmdIndex: number;
}

interface ShortsSetupDialogProps {
  open: boolean;
  models: ShortsSetupModelRow[];
  durationSec: number;
  busy?: boolean;
  onDurationChange: (sec: number) => void;
  onSelectVmd: (modelId: string, index: number) => void;
  onAddVmdFiles: (modelId: string, files: FileList) => void;
  onGenerate: () => void;
  onClose: () => void;
}

/** Configure short length and per-character motion before Generate Short. */
export default function ShortsSetupDialog({
  open,
  models,
  durationSec,
  busy = false,
  onDurationChange,
  onSelectVmd,
  onAddVmdFiles,
  onGenerate,
  onClose,
}: ShortsSetupDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addVmdModelIdRef = useRef<string | null>(null);

  if (!open) return null;

  const clamped = clampShortsDuration(durationSec);

  const openVmdPicker = (modelId: string) => {
    addVmdModelIdRef.current = modelId;
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] bg-black/70 backdrop-blur-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept=".vmd"
        multiple
        className="hidden"
        onChange={(e) => {
          const modelId = addVmdModelIdRef.current;
          const files = e.target.files;
          if (modelId && files && files.length > 0) {
            onAddVmdFiles(modelId, files);
          }
          e.target.value = '';
          addVmdModelIdRef.current = null;
        }}
      />

      <div
        role="dialog"
        aria-labelledby="shorts-setup-title"
        className="w-full max-w-md rounded-2xl border border-pink-500/30 bg-[#121418] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-pink-400" />
            <h2 id="shorts-setup-title" className="text-sm font-bold text-white">
              Short settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-5 max-h-[70dvh] overflow-y-auto">
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-pink-400" />
              <span className="text-xs font-bold uppercase text-zinc-400 tracking-wide">
                Duration
              </span>
              <span className="ml-auto text-sm font-bold text-pink-300">
                {formatShortsDurationLabel(clamped)}
              </span>
            </div>
            <input
              type="range"
              min={MIN_TEMPLATE_DURATION_SEC}
              max={MAX_TEMPLATE_DURATION_SEC}
              step={1}
              value={clamped}
              disabled={busy}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>{MIN_TEMPLATE_DURATION_SEC}s</span>
              <span>{MAX_TEMPLATE_DURATION_SEC}s</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SHORTS_DURATION_PRESETS_SEC.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={busy}
                  onClick={() => onDurationChange(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    clamped === preset
                      ? 'bg-pink-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {preset}s
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <span className="shrink-0">Exact</span>
              <input
                type="number"
                min={MIN_TEMPLATE_DURATION_SEC}
                max={MAX_TEMPLATE_DURATION_SEC}
                value={clamped}
                disabled={busy}
                onChange={(e) => onDurationChange(Number(e.target.value))}
                className="w-20 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs"
              />
              <span>seconds (timeline & export)</span>
            </label>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase text-zinc-400 tracking-wide">
                Motion per character
              </span>
            </div>
            {models.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No characters yet — a demo will load when you generate.
              </p>
            ) : (
              <ul className="space-y-3">
                {models.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2"
                  >
                    <p className="text-xs font-semibold text-zinc-200 truncate">{row.name}</p>
                    {row.vmdFileNames.length === 0 ? (
                      <p className="text-[10px] text-zinc-500">No VMD — add motion below</p>
                    ) : (
                      <select
                        value={Math.min(
                          row.activeVmdIndex,
                          Math.max(0, row.vmdFileNames.length - 1)
                        )}
                        disabled={busy}
                        onChange={(e) => onSelectVmd(row.id, Number(e.target.value))}
                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-zinc-200"
                      >
                        {row.vmdFileNames.map((name, idx) => (
                          <option key={`${row.id}-${idx}`} value={idx}>
                            {name}
                          </option>
                        ))}
                      </select>
                    )}
                    {row.vmdFileNames.length > 1 && (
                      <p className="text-[10px] text-zinc-600">
                        {row.vmdFileNames.length} motions loaded — pick which plays
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openVmdPicker(row.id)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add VMD…
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-zinc-800 bg-[#0e1014]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <Smartphone className="w-3.5 h-3.5" />
            {busy ? 'Generating…' : 'Generate Short'}
          </button>
        </div>
      </div>
    </div>
  );
}
