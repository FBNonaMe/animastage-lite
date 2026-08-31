import { useRef } from 'react';
import { Music, Pause, Play, Trash2 } from 'lucide-react';
import type { SceneMusicState } from '../../sceneDirector/types';
import { MMD_FPS } from '../../utils/playhead';
import { Button } from '../UI';

interface MusicDirectorTabProps {
  music: SceneMusicState | undefined;
  currentFrame: number;
  maxFrames: number;
  isPlaying: boolean;
  onPatch: (patch: Partial<SceneMusicState>) => void;
}

export default function MusicDirectorTab({
  music,
  currentFrame,
  maxFrames,
  isPlaying,
  onPatch,
}: MusicDirectorTabProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const state = music ?? {
    enabled: false,
    name: '',
    blobUrl: null,
    offsetSec: 0,
    volume: 0.85,
    loop: false,
    markers: [],
  };

  const playheadSec = currentFrame / MMD_FPS;

  return (
    <div className="space-y-3">
      <div className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-2">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <Music className="w-3.5 h-3.5" />
          Timeline sync · frame {currentFrame} / {maxFrames}
          {isPlaying ? (
            <Play className="w-3 h-3 text-cyan-400 ml-auto" />
          ) : (
            <Pause className="w-3 h-3 text-zinc-600 ml-auto" />
          )}
        </div>
        <p className="text-[10px] text-zinc-500 m-0 mt-1">
          Playhead · {playheadSec.toFixed(2)}s
          {state.blobUrl ? ` · track ${state.name || 'untitled'}` : ''}
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
          onPatch({
            blobUrl: URL.createObjectURL(file),
            name: file.name,
            enabled: true,
          });
        }}
      />

      <div className="flex gap-1">
        <Button type="button" className="flex-1 text-[10px]" onClick={() => fileRef.current?.click()}>
          Load audio
        </Button>
        {state.blobUrl ? (
          <Button
            type="button"
            className="text-[10px]"
            onClick={() => {
              if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
              onPatch({ blobUrl: null, name: '', enabled: false });
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
        <input
          type="checkbox"
          checked={state.enabled}
          disabled={!state.blobUrl}
          onChange={(e) => onPatch({ enabled: e.target.checked })}
        />
        Sync with timeline playback
      </label>

      <label className="block text-[10px] text-zinc-500">
        Offset (sec)
        <input
          type="number"
          step={0.05}
          value={state.offsetSec}
          onChange={(e) => onPatch({ offsetSec: Number(e.target.value) || 0 })}
          className="ds-input w-full mt-0.5 text-[11px]"
        />
      </label>

      <label className="block text-[10px] text-zinc-500">
        Volume
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={state.volume}
          onChange={(e) => onPatch({ volume: Number(e.target.value) })}
          className="w-full mt-0.5"
        />
      </label>

      <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
        <input
          type="checkbox"
          checked={state.loop}
          onChange={(e) => onPatch({ loop: e.target.checked })}
        />
        Loop track
      </label>

      <div>
        <p className="text-[10px] text-zinc-500 m-0 mb-1">Beat markers (Effect timeline)</p>
        <Button
          type="button"
          className="w-full text-[10px] mb-1"
          disabled={!state.blobUrl}
          onClick={() => {
            const timeSec = playheadSec;
            const id =
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `mk_${Date.now()}`;
            onPatch({
              markers: [
                ...state.markers,
                { id, label: `Beat @ ${timeSec.toFixed(1)}s`, timeSec },
              ],
            });
          }}
        >
          Add marker at playhead
        </Button>
        {state.markers.length ? (
          <ul className="space-y-0.5 m-0 p-0 list-none max-h-20 overflow-y-auto">
            {state.markers.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-1 rounded border border-zinc-800 px-2 py-0.5 text-[9px] text-zinc-400"
              >
                <span className="truncate">{m.label}</span>
                <button
                  type="button"
                  className="text-zinc-600 hover:text-red-400 cursor-pointer"
                  onClick={() =>
                    onPatch({ markers: state.markers.filter((x) => x.id !== m.id) })
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="text-[9px] text-zinc-600 m-0">
        Audio file is session-only (not saved in .animastage). Re-import after reload.
      </p>
    </div>
  );
}
