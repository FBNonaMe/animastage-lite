import { useRef } from 'react';
import { Palette, Upload, X } from 'lucide-react';
import type { ColorGradePresetId, PostFxStackOrder, VisualFxSettings } from '../../types';
import { COLOR_GRADES } from '../../visualFx/visualFxPresets';
import { detectLutFileKind, parseLutFile } from '../../utils/lutParser';

interface LutControlsProps {
  visualFx: VisualFxSettings;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  compact?: boolean;
  showBuiltInGrade?: boolean;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-0.5">
      <div className="flex justify-between text-[9px] font-bold text-zinc-500">
        <span>{label}</span>
        <span className="text-zinc-400">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        className="w-full accent-violet-400"
      />
    </label>
  );
}

export default function LutControls({
  visualFx,
  onSetVisualFx,
  compact = false,
  showBuiltInGrade = true,
}: LutControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasCustomLut = Boolean(visualFx.customLutUrl);
  const stackOrder: PostFxStackOrder = visualFx.postFxStackOrder ?? 'bloom_then_grade';

  const importLutFile = async (file: File) => {
    if (!detectLutFileKind(file.name)) {
      alert('Use a .cube or .3dl LUT file.');
      return;
    }
    try {
      await parseLutFile(file);
      if (visualFx.customLutUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(visualFx.customLutUrl);
      }
      onSetVisualFx({
        customLutUrl: URL.createObjectURL(file),
        customLutName: file.name,
        customLutEnabled: true,
        customLutIntensity: visualFx.customLutIntensity ?? 1,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'LUT import failed');
    }
  };

  const clearLut = () => {
    if (visualFx.customLutUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(visualFx.customLutUrl);
    }
    onSetVisualFx({
      customLutUrl: null,
      customLutName: null,
      customLutEnabled: false,
    });
  };

  return (
    <div className={`space-y-2 ${compact ? '' : 'border-t border-zinc-800 pt-2'}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-300 flex items-center gap-1">
          <Palette className="w-3 h-3 text-violet-300" />
          Color grade / LUT
        </span>
        {hasCustomLut && (
          <button
            type="button"
            onClick={clearLut}
            className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500 hover:text-rose-300 hover:border-rose-500/40 cursor-pointer flex items-center gap-0.5"
          >
            <X className="w-2.5 h-2.5" />
            Clear LUT
          </button>
        )}
      </div>

      {showBuiltInGrade && (
        <label className="block space-y-1">
          <span className="text-[9px] font-bold text-zinc-500">Built-in grade</span>
          <select
            value={visualFx.colorGrade}
            disabled={hasCustomLut && visualFx.customLutEnabled !== false}
            onChange={(e) =>
              onSetVisualFx({ colorGrade: e.target.value as ColorGradePresetId })
            }
            className="w-full bg-zinc-900 border border-zinc-700 rounded text-[10px] px-2 py-1 text-zinc-200 disabled:opacity-50"
          >
            {Object.values(COLOR_GRADES).map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex-1 py-1.5 text-[9px] font-bold rounded border border-violet-500/30 text-violet-200 bg-violet-500/10 hover:border-violet-400/50 cursor-pointer flex items-center justify-center gap-1"
        >
          <Upload className="w-3 h-3" />
          Import .cube / .3dl
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".cube,.3dl,application/octet-stream"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importLutFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {hasCustomLut && (
        <>
          <p className="text-[8px] text-zinc-500 truncate" title={visualFx.customLutName ?? ''}>
            LUT: {visualFx.customLutName}
          </p>
          <label className="flex items-center gap-2 text-[9px] font-bold text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={visualFx.customLutEnabled !== false}
              onChange={(e) => onSetVisualFx({ customLutEnabled: e.target.checked })}
              className="accent-violet-400"
            />
            Use custom LUT (overrides built-in grade)
          </label>
          <SliderRow
            label="LUT strength"
            value={visualFx.customLutIntensity ?? 1}
            min={0}
            max={1}
            step={0.02}
            onChange={(v) => onSetVisualFx({ customLutIntensity: v })}
          />
        </>
      )}

      <div className="space-y-1">
        <span className="text-[9px] font-bold text-zinc-500">Effect stack order</span>
        <div className="flex gap-1">
          {(
            [
              ['bloom_then_grade', 'Bloom → Grade'],
              ['grade_then_bloom', 'Grade → Bloom'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onSetVisualFx({ postFxStackOrder: id })}
              className={`flex-1 py-1 text-[8px] font-bold rounded border cursor-pointer ${
                stackOrder === id
                  ? 'border-cyan-500/50 text-cyan-200 bg-cyan-500/10'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[8px] text-zinc-600 leading-relaxed">
          Modoki default: bloom before grade/LUT so glow is graded with the scene.
        </p>
      </div>
    </div>
  );
}
