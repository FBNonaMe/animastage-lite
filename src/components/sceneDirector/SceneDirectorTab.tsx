import { useMemo, useState } from 'react';
import { Plus, Sparkles, Star } from 'lucide-react';
import type { AppState } from '../../types';
import {
  SCENE_DIRECTOR_PANEL_LINKS,
  type SceneDirectorState,
} from '../../sceneDirector/types';
import {
  createSceneFxInstance,
  type SceneFxCategory,
} from '../../sceneStudio';
import {
  searchSceneEffects,
  toggleLikedEffectIds,
} from '../../sceneDirector/effectRegistry';
import { requestEditorTab, requestStudioPanel } from '../../sceneDirector/panelNavigation';
import { defaultEffectWindow } from '../../sceneDirector/effectTimeline';
import { Button } from '../UI';

interface SceneDirectorTabProps {
  appState: AppState;
  likedEffectIds: string[];
  onPatchDirector: (patch: Partial<SceneDirectorState>) => void;
  onPatchSceneStudio?: (patch: Partial<NonNullable<AppState['sceneStudio']>>) => void;
}

const CATEGORIES: Array<{ id: SceneFxCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'weather', label: 'Weather' },
  { id: 'character', label: 'Character' },
  { id: 'magic', label: 'Magic' },
  { id: 'particles', label: 'Particles' },
  { id: 'cinematic', label: 'Cinematic' },
];

export default function SceneDirectorTab({
  appState,
  likedEffectIds,
  onPatchDirector,
  onPatchSceneStudio,
}: SceneDirectorTabProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SceneFxCategory | 'all'>('all');
  const [likedOnly, setLikedOnly] = useState(false);

  const fxStack = appState.sceneStudio?.fxStack ?? [];
  const results = useMemo(
    () => searchSceneEffects(query, { category, likedIds: likedEffectIds, likedOnly }),
    [query, category, likedEffectIds, likedOnly]
  );

  const addEffect = (effectId: string) => {
    if (!onPatchSceneStudio || !appState.sceneStudio) return;
    const instance = createSceneFxInstance(
      effectId,
      {
        order: fxStack.length,
        window: defaultEffectWindow(appState.maxFrames),
        targetModelId: appState.selectedObjectId,
      },
      appState.maxFrames
    );
    onPatchSceneStudio({
      fxStack: [...fxStack, instance],
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 m-0 mb-1">
          Studio shortcuts
        </p>
        <div className="grid grid-cols-2 gap-1">
          {SCENE_DIRECTOR_PANEL_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              title={link.hint}
              onClick={() => requestStudioPanel(link.id)}
              className="rounded border border-zinc-800 px-2 py-1.5 text-left text-[9px] text-zinc-300 hover:border-cyan-500/30 cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 m-0 mb-1">
          Effect library
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search effects…"
          className="ds-input w-full text-[11px] mb-1"
        />
        <div className="flex flex-wrap gap-1 mb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                category === cat.id ? 'bg-cyan-500/15 text-cyan-100' : 'text-zinc-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLikedOnly((v) => !v)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer inline-flex items-center gap-0.5 ${
              likedOnly ? 'bg-amber-500/15 text-amber-100' : 'text-zinc-600'
            }`}
          >
            <Star className="w-3 h-3" />
            Liked
          </button>
        </div>
        <div className="max-h-36 overflow-y-auto space-y-1">
          {results.map((entry) => {
            const liked = likedEffectIds.includes(entry.id);
            const inStack = fxStack.some((fx) => fx.effectId === entry.id);
            return (
              <div
                key={entry.id}
                className="flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-[10px]"
              >
                <span className="shrink-0">{entry.thumbnail}</span>
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-zinc-200 truncate">{entry.name}</p>
                  <p className="m-0 text-[9px] text-zinc-600 truncate">{entry.description}</p>
                </div>
                <button
                  type="button"
                  title={liked ? 'Unlike' : 'Like'}
                  onClick={() =>
                    onPatchDirector({
                      likedEffectIds: toggleLikedEffectIds(likedEffectIds, entry.id),
                    })
                  }
                  className={`cursor-pointer ${liked ? 'text-amber-300' : 'text-zinc-600'}`}
                >
                  <Star className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  title="Add to stack"
                  disabled={!onPatchSceneStudio}
                  onClick={() => addEffect(entry.id)}
                  className="text-cyan-400 hover:text-cyan-200 cursor-pointer disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {inStack ? (
                  <span title="In stack">
                    <Sparkles className="w-3 h-3 text-cyan-500/60 shrink-0" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {fxStack.length ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 m-0 mb-1">
            Active stack ({fxStack.length})
          </p>
          <Button
            type="button"
            className="w-full mb-2 text-[10px]"
            onClick={() => requestEditorTab('effects')}
          >
            Open Effect Timeline
          </Button>
          <ul className="space-y-1 m-0 p-0 list-none">
            {fxStack.map((fx) => (
              <li
                key={fx.id}
                className="flex items-center justify-between gap-2 rounded border border-zinc-800 px-2 py-1 text-[10px]"
              >
                <span className="truncate text-zinc-300">{fx.name}</span>
                {fx.runtimeError ? (
                  <span className="text-red-400 shrink-0" title={fx.runtimeError.message}>
                    err
                  </span>
                ) : fx.window ? (
                  <span className="text-zinc-600 shrink-0">
                    {fx.window.startFrame}–{fx.window.endFrame ?? '∞'}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            className="w-full mt-2 text-[10px]"
            onClick={() => requestStudioPanel('world')}
          >
            Edit in Scene World
          </Button>
        </div>
      ) : null}

      <div className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-2 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 m-0">
          Advanced runtime
        </p>
        <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={appState.sceneDirector?.rezeEngineEnabled === true}
            onChange={(e) => onPatchDirector({ rezeEngineEnabled: e.target.checked })}
          />
          Reze-engine WebGPU path (experimental MIT runtime flag)
        </label>
        <p className="text-[9px] text-zinc-600 m-0">
          Forces WebGPU FX backend when supported. Does not bundle AGPL reze-design code.
        </p>
      </div>
    </div>
  );
}
