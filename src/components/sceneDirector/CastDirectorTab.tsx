import { useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Trash2,
  User,
} from 'lucide-react';
import type { AppState } from '../../types';
import { Button } from '../UI';

interface CastDirectorTabProps {
  appState: AppState;
  castSoloId: string | null;
  lockedObjectIds: Set<string>;
  onSelectModel: (id: string | null) => void;
  onRenameModel: (id: string, name: string) => void;
  onDuplicateModel: (id: string) => void;
  onToggleVisibility: (id: string, type: 'model' | 'other') => void;
  onToggleLock: (objectId: string) => void;
  onDeleteModel: (id: string) => void;
  onSetCastSolo: (id: string | null) => void;
}

export default function CastDirectorTab({
  appState,
  castSoloId,
  lockedObjectIds,
  onSelectModel,
  onRenameModel,
  onDuplicateModel,
  onToggleVisibility,
  onToggleLock,
  onDeleteModel,
  onSetCastSolo,
}: CastDirectorTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const characters = appState.models.filter(
    (m) => m.assetKind !== 'stage' && m.assetKind !== 'prop'
  );
  const list = characters.length ? characters : appState.models;

  if (!list.length) {
    return (
      <p className="text-[11px] text-zinc-500 m-0">
        Load a character from Assets to build your cast.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-zinc-500 m-0">
        Cast · {list.length} member{list.length === 1 ? '' : 's'}
        {castSoloId ? ' · solo active' : ''}
      </p>
      <ul className="space-y-1 m-0 p-0 list-none">
        {list.map((model) => {
          const selected = model.id === appState.selectedObjectId;
          const locked = lockedObjectIds.has(model.id);
          const solo = castSoloId === model.id;
          const clipLabel = model.libraryAssetId
            ? `Library · ${model.libraryAssetId}`
            : model.vmdFileNames?.length
              ? `VMD · ${model.vmdFileNames[model.activeVmdIndex ?? 0] ?? 'motion'}`
              : model.activeTemplateId
                ? `Template · ${model.activeTemplateId}`
                : 'No clip';

          return (
            <li
              key={model.id}
              className={`rounded border px-2 py-1.5 ${
                selected ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-zinc-800 bg-zinc-950/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Select"
                  onClick={() => onSelectModel(model.id)}
                  className="shrink-0 text-zinc-400 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                </button>
                {editingId === model.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => {
                      if (draftName.trim()) onRenameModel(model.id, draftName.trim());
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (draftName.trim()) onRenameModel(model.id, draftName.trim());
                        setEditingId(null);
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 min-w-0 ds-input text-[11px] py-0.5"
                  />
                ) : (
                  <button
                    type="button"
                    title="Rename"
                    onClick={() => {
                      setEditingId(model.id);
                      setDraftName(model.name);
                    }}
                    className="flex-1 min-w-0 text-left text-[11px] font-medium text-zinc-200 truncate cursor-pointer"
                  >
                    {model.name}
                  </button>
                )}
                <button
                  type="button"
                  title={solo ? 'Clear solo' : 'Solo'}
                  onClick={() => onSetCastSolo(solo ? null : model.id)}
                  className={`text-[9px] font-bold px-1 rounded cursor-pointer ${
                    solo ? 'bg-amber-500/20 text-amber-200' : 'text-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  S
                </button>
                <button
                  type="button"
                  title={model.visible ? 'Hide' : 'Show'}
                  onClick={() => onToggleVisibility(model.id, 'model')}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {model.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  title={locked ? 'Unlock' : 'Lock'}
                  onClick={() => onToggleLock(model.id)}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  title="Duplicate"
                  onClick={() => onDuplicateModel(model.id)}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => onDeleteModel(model.id)}
                  className="text-zinc-500 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[9px] text-zinc-600 m-0 mt-1 truncate">{clipLabel}</p>
            </li>
          );
        })}
      </ul>
      {castSoloId ? (
        <Button type="button" className="w-full text-[10px]" onClick={() => onSetCastSolo(null)}>
          Clear solo
        </Button>
      ) : null}
    </div>
  );
}
