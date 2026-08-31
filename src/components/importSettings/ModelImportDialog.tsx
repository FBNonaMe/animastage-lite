import { useEffect, useState } from 'react';
import {
  DEFAULT_MODEL_IMPORT_SETTINGS,
  loadModelImportSettings,
  saveModelImportSettings,
  type ModelImportSettings,
} from '../../importSettings';

export interface ModelImportDialogProps {
  open: boolean;
  fileLabel?: string;
  onConfirm: (settings: ModelImportSettings) => void;
  onCancel: () => void;
}

const ROWS: Array<{ key: keyof ModelImportSettings; label: string; hint?: string }> = [
  { key: 'importMaterials', label: 'Materials' },
  { key: 'importAnimations', label: 'Animations' },
  { key: 'importPhysics', label: 'Physics' },
  { key: 'importMorphs', label: 'Morphs' },
  { key: 'importTextures', label: 'Textures' },
  { key: 'importLights', label: 'Lights', hint: 'Keeps project lighting' },
  { key: 'importCameras', label: 'Cameras', hint: 'Off by default' },
  { key: 'applyEnvironment', label: 'Environment', hint: 'Don’t overwrite sky / FX' },
  { key: 'enableFog', label: 'Fog', hint: 'Keep project fog' },
];

export default function ModelImportDialog({
  open,
  fileLabel,
  onConfirm,
  onCancel,
}: ModelImportDialogProps) {
  const [settings, setSettings] = useState<ModelImportSettings>(() =>
    loadModelImportSettings()
  );

  useEffect(() => {
    if (open) setSettings(loadModelImportSettings());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const toggle = (key: keyof ModelImportSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-sm flex flex-col rounded-t-xl sm:rounded-xl border border-zinc-700/90 bg-[#12161e] shadow-2xl
          max-h-[min(58dvh,var(--app-height,100dvh))] sm:max-h-[min(72dvh,var(--app-height,100dvh))]
          mb-[var(--am-dock-h,0px)] sm:mb-0"
        role="dialog"
        aria-modal="true"
        aria-label="Import settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-1.5 shrink-0" aria-hidden>
          <span className="block w-8 h-0.5 rounded-full bg-zinc-600" />
        </div>

        <div className="border-b border-zinc-800 px-3 py-2 shrink-0 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-zinc-100">Import Settings</div>
            {fileLabel ? (
              <p className="mt-0.5 text-[11px] text-sky-200/90 truncate" title={fileLabel}>
                {fileLabel}
              </p>
            ) : (
              <p className="mt-0.5 text-[10px] text-zinc-500">
                Mesh only by default — fog / FX stay as in project
              </p>
            )}
          </div>
          <button
            type="button"
            className="shrink-0 text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 px-1 py-0.5"
            onClick={() => setSettings({ ...DEFAULT_MODEL_IMPORT_SETTINGS })}
          >
            Reset
          </button>
        </div>

        <div
          className="min-h-0 overflow-y-auto overscroll-contain px-2 py-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {ROWS.map((row) => (
            <label
              key={row.key}
              className="flex items-center gap-2.5 cursor-pointer rounded-md px-2 py-1.5 min-h-[36px] hover:bg-zinc-900/80 active:bg-zinc-800/80"
            >
              <input
                type="checkbox"
                checked={settings[row.key]}
                onChange={() => toggle(row.key)}
                className="size-4 shrink-0 accent-sky-500"
              />
              <span className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-zinc-100 font-medium">{row.label}</span>
                {row.hint ? (
                  <span className="text-[9px] text-zinc-500 truncate text-right">{row.hint}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 px-3 py-2.5 shrink-0 bg-[#12161e]">
          <button
            type="button"
            className="min-h-[40px] rounded-lg border border-zinc-700 py-2 text-[12px] font-semibold text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-[40px] rounded-lg border border-sky-500/50 bg-sky-500/20 py-2 text-[12px] font-bold text-sky-50 hover:bg-sky-500/30 active:bg-sky-500/40"
            onClick={() => {
              saveModelImportSettings(settings);
              onConfirm(settings);
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
