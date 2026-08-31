import { useMemo } from 'react';
import type { AppState } from '../../types';
import type { SceneDirectorState } from '../../sceneDirector/types';
import CastDirectorTab from './CastDirectorTab';
import ClipsDirectorTab from './ClipsDirectorTab';
import MusicDirectorTab from './MusicDirectorTab';
import SceneDirectorTab from './SceneDirectorTab';

export interface SceneDirectorWorkflowPanelProps {
  appState: AppState;
  lockedObjectIds: Set<string>;
  onPatchDirector: (patch: Partial<SceneDirectorState>) => void;
  onSelectModel: (id: string | null) => void;
  onRenameModel: (id: string, name: string) => void;
  onDuplicateModel: (id: string) => void;
  onToggleVisibility: (id: string, type: 'model' | 'other') => void;
  onToggleLock: (objectId: string) => void;
  onDeleteModel: (id: string) => void;
  onAttachVmd?: (modelId: string, vmd: import('../../utils/mmdFiles').ProcessedVmdFiles) => void;
  onPatchSceneStudio?: (patch: Partial<NonNullable<AppState['sceneStudio']>>) => void;
}

const TABS = [
  { id: 'cast' as const, label: 'CAST' },
  { id: 'clips' as const, label: 'CLIPS' },
  { id: 'music' as const, label: 'MUSIC' },
  { id: 'scene' as const, label: 'SCENE' },
];

export default function SceneDirectorWorkflowPanel({
  appState,
  lockedObjectIds,
  onPatchDirector,
  onSelectModel,
  onRenameModel,
  onDuplicateModel,
  onToggleVisibility,
  onToggleLock,
  onDeleteModel,
  onAttachVmd,
  onPatchSceneStudio,
}: SceneDirectorWorkflowPanelProps) {
  const director = appState.sceneDirector;
  const activeTab = director?.activeTab ?? 'cast';

  const body = useMemo(() => {
    switch (activeTab) {
      case 'clips':
        return (
          <ClipsDirectorTab
            appState={appState}
            vmdNativeBezier={director?.vmdNativeBezier !== false}
            onSelectModel={onSelectModel}
            onAttachVmd={onAttachVmd}
            onPatchDirector={onPatchDirector}
          />
        );
      case 'music':
        return (
          <MusicDirectorTab
            music={director?.music}
            currentFrame={appState.currentFrame}
            maxFrames={appState.maxFrames}
            isPlaying={appState.isPlaying}
            onPatch={(music) => onPatchDirector({ music: { ...director?.music, ...music } })}
          />
        );
      case 'scene':
        return (
          <SceneDirectorTab
            appState={appState}
            likedEffectIds={director?.likedEffectIds ?? []}
            onPatchDirector={onPatchDirector}
            onPatchSceneStudio={onPatchSceneStudio}
          />
        );
      case 'cast':
      default:
        return (
          <CastDirectorTab
            appState={appState}
            castSoloId={director?.castSoloId ?? null}
            lockedObjectIds={lockedObjectIds}
            onSelectModel={onSelectModel}
            onRenameModel={onRenameModel}
            onDuplicateModel={onDuplicateModel}
            onToggleVisibility={onToggleVisibility}
            onToggleLock={onToggleLock}
            onDeleteModel={onDeleteModel}
            onSetCastSolo={(castSoloId) => onPatchDirector({ castSoloId })}
          />
        );
    }
  }, [
    activeTab,
    appState,
    director,
    lockedObjectIds,
    onAttachVmd,
    onDeleteModel,
    onDuplicateModel,
    onPatchDirector,
    onPatchSceneStudio,
    onRenameModel,
    onSelectModel,
    onToggleLock,
    onToggleVisibility,
  ]);

  return (
    <div className="space-y-2">
      <div className="flex rounded border border-zinc-800 overflow-hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onPatchDirector({ activeTab: tab.id })}
            className={`flex-1 px-1 py-1.5 text-[9px] font-bold tracking-wide cursor-pointer ${
              activeTab === tab.id
                ? 'bg-cyan-500/15 text-cyan-100'
                : 'bg-zinc-950/50 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {body}
    </div>
  );
}
