import { Eye, EyeOff, Lock, RotateCcw, Sparkles } from 'lucide-react';
import type { PmxMaterialInfo, AutoLuminousLevel, StyleGalleryRuntimeState } from '../../types';
import { classifyMaterialName, materialKindLabel } from '../../stylePacks/gallery/autoLuminous';

export interface MaterialInspectorPanelProps {
  materials: PmxMaterialInfo[];
  styleGallery: StyleGalleryRuntimeState;
  selectedMaterial: string | null;
  onSelectMaterial: (name: string | null) => void;
  onPatchStyleGallery: (patch: Partial<StyleGalleryRuntimeState>) => void;
  developerMode?: boolean;
}

const AUTO_LEVELS: AutoLuminousLevel[] = ['off', 'low', 'medium', 'high', 'auto'];

export default function MaterialInspectorPanel({
  materials,
  styleGallery,
  selectedMaterial,
  onSelectMaterial,
  onPatchStyleGallery,
  developerMode = false,
}: MaterialInspectorPanelProps) {
  const hidden = new Set(styleGallery.hiddenMaterials.map((n) => n.toLowerCase()));

  const toggleHidden = (name: string) => {
    const key = name.toLowerCase();
    const next = styleGallery.hiddenMaterials.filter((n) => n.toLowerCase() !== key);
    if (!hidden.has(key)) next.push(name);
    onPatchStyleGallery({ hiddenMaterials: next, soloMaterial: null });
  };

  const setSolo = (name: string | null) => {
    onPatchStyleGallery({
      soloMaterial: styleGallery.soloMaterial === name ? null : name,
    });
  };

  const hidePattern = (pattern: RegExp) => {
    const names = materials.filter((m) => pattern.test(m.name)).map((m) => m.name);
    onPatchStyleGallery({
      hiddenMaterials: [...new Set([...styleGallery.hiddenMaterials, ...names])],
      soloMaterial: null,
    });
  };

  const showAll = () => {
    onPatchStyleGallery({ hiddenMaterials: [], soloMaterial: null });
  };

  if (materials.length === 0) {
    return (
      <div className="border border-zinc-700/50 rounded-md p-2 bg-zinc-950/40">
        <p className="text-[9px] text-zinc-500">Material Inspector — load a PMX model first.</p>
      </div>
    );
  }

  return (
    <div className="border border-cyan-500/25 rounded-md p-2 space-y-2 bg-cyan-950/10">
      <div className="text-[10px] font-bold text-cyan-300 flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        Material Inspector
      </div>

      <label className="block space-y-0.5">
        <span className="text-[8px] font-bold text-zinc-500 uppercase">Auto Luminous</span>
        <select
          value={styleGallery.autoLuminousLevel}
          onChange={(e) =>
            onPatchStyleGallery({ autoLuminousLevel: e.target.value as AutoLuminousLevel })
          }
          className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-200"
        >
          {AUTO_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-1">
        {[
          { label: 'Hide Hair', re: /hair|髪/i },
          { label: 'Hide Acc', re: /acc|accessory|リボン|ribbon|hat|帽/i },
          { label: 'Hide Clothes', re: /cloth|服|skirt|dress|pants|jacket/i },
          { label: 'Hide Weapon', re: /weapon|sword|gun|刀/i },
        ].map(({ label, re }) => (
          <button
            key={label}
            type="button"
            onClick={() => hidePattern(re)}
            className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:border-cyan-500/40 cursor-pointer"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={showAll}
          className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-600/40 text-emerald-300 cursor-pointer"
        >
          Show All
        </button>
        <button
          type="button"
          onClick={() => onPatchStyleGallery({ hiddenMaterials: [], soloMaterial: null, lockedMaterials: [] })}
          className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-400 cursor-pointer"
        >
          <RotateCcw className="w-2.5 h-2.5" /> Reset
        </button>
      </div>

      <div className="max-h-36 overflow-y-auto space-y-0.5 rounded border border-zinc-800 bg-zinc-950/60 p-1">
        {materials.map((m) => {
          const isHidden = hidden.has(m.name.toLowerCase());
          const isSolo = styleGallery.soloMaterial === m.name;
          const kind = classifyMaterialName(m.name);
          const active = selectedMaterial === m.name;
          return (
            <div
              key={`${m.index}-${m.name}`}
              className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] ${
                active ? 'bg-cyan-500/15 border border-cyan-500/30' : 'border border-transparent'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectMaterial(active ? null : m.name)}
                className="flex-1 text-left truncate text-zinc-300 cursor-pointer"
                title={m.name}
              >
                {m.name}
                <span className="text-zinc-600 ml-1">· {materialKindLabel(kind)}</span>
              </button>
              <button type="button" onClick={() => toggleHidden(m.name)} className="text-zinc-500 hover:text-zinc-200" title={isHidden ? 'Show' : 'Hide'}>
                {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => setSolo(isSolo ? null : m.name)}
                className={`text-[8px] font-bold px-1 rounded ${isSolo ? 'text-amber-300' : 'text-zinc-600'}`}
                title="Solo"
              >
                S
              </button>
              {developerMode && (
                <span className="text-[7px] text-zinc-600 font-mono">#{m.index}</span>
              )}
            </div>
          );
        })}
      </div>

      {styleGallery.lockedMaterials.length > 0 && (
        <p className="text-[8px] text-zinc-600 flex items-center gap-1">
          <Lock className="w-3 h-3" /> {styleGallery.lockedMaterials.length} locked
        </p>
      )}
    </div>
  );
}
