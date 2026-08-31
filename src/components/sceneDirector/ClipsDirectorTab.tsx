import { useMemo, useRef } from 'react';
import { Clapperboard, Play, Upload } from 'lucide-react';
import type { AppState } from '../../types';
import type { ProcessedVmdFiles } from '../../utils/mmdFiles';
import { Button } from '../UI';
import { requestStudioPanel } from '../../sceneDirector/panelNavigation';

interface ClipsDirectorTabProps {
  appState: AppState;
  vmdNativeBezier?: boolean;
  onSelectModel: (id: string | null) => void;
  onAttachVmd?: (modelId: string, vmd: ProcessedVmdFiles) => void;
  onPatchDirector?: (patch: { vmdNativeBezier?: boolean }) => void;
}

export default function ClipsDirectorTab({
  appState,
  vmdNativeBezier = true,
  onSelectModel,
  onAttachVmd,
  onPatchDirector,
}: ClipsDirectorTabProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const targetId = appState.selectedObjectId ?? appState.models[0]?.id ?? null;
  const target = appState.models.find((m) => m.id === targetId);

  const libraryAssets = useMemo(
    () => appState.animationLibrary?.assets ?? [],
    [appState.animationLibrary?.assets]
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] text-zinc-500 mb-1">Target character</label>
        <select
          value={targetId ?? ''}
          onChange={(e) => onSelectModel(e.target.value || null)}
          className="ds-select w-full text-[11px]"
        >
          <option value="">Select cast member…</option>
          {appState.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {target ? (
        <div className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1.5 text-[10px] text-zinc-400">
          <div className="flex items-center gap-1 text-zinc-300 font-medium">
            <Clapperboard className="w-3.5 h-3.5" />
            Active clip
          </div>
          <p className="m-0 mt-1">
            {target.libraryAssetId
              ? `Library asset · ${target.libraryAssetId}`
              : target.vmdFileNames?.length
                ? `VMD · ${target.vmdFileNames[target.activeVmdIndex ?? 0]}`
                : target.activeTemplateId
                  ? `Template · ${target.activeTemplateId}`
                  : 'None — assign from Animation Library or attach VMD'}
          </p>
          {target.motionSpeed != null && target.motionSpeed !== 1 ? (
            <p className="m-0 mt-0.5 text-zinc-600">Speed · {target.motionSpeed.toFixed(2)}×</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="text-[10px] text-zinc-500 m-0 mb-1">Quick attach VMD</p>
        <input
          ref={fileRef}
          type="file"
          accept=".vmd"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !targetId || !onAttachVmd) return;
            const { processVmdFiles } = await import('../../utils/mmdFiles');
            const result = await processVmdFiles([file]);
            if ('error' in result) return;
            onAttachVmd(targetId, result);
          }}
        />
        <Button
          type="button"
          className="w-full text-[10px]"
          disabled={!targetId || !onAttachVmd}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5 mr-1 inline" />
          Attach .vmd to selected
        </Button>
      </div>

      <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
        <input
          type="checkbox"
          checked={vmdNativeBezier}
          onChange={(e) => onPatchDirector?.({ vmdNativeBezier: e.target.checked })}
        />
        VMD native bezier export (64-byte curves)
      </label>

      <div>
        <p className="text-[10px] text-zinc-500 m-0 mb-1">
          Library ({libraryAssets.length})
        </p>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {libraryAssets.slice(0, 12).map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between gap-2 rounded border border-zinc-800 px-2 py-1 text-[10px]"
            >
              <span className="truncate text-zinc-300">{asset.name}</span>
              <span className="shrink-0 text-zinc-600">
                {Math.round(asset.durationSec)}s
              </span>
            </div>
          ))}
          {!libraryAssets.length ? (
            <p className="text-[10px] text-zinc-600 m-0">Open Animation Library to import motions.</p>
          ) : null}
        </div>
        <p className="text-[9px] text-zinc-600 m-0 mt-1">
          Full assign / retarget tools live in the Animation Library panel.
        </p>
        <Button
          type="button"
          className="w-full mt-2 text-[10px]"
          onClick={() => requestStudioPanel('animlib')}
        >
          <Play className="w-3.5 h-3.5 mr-1 inline" />
          Open Animation Library
        </Button>
      </div>
    </div>
  );
}
