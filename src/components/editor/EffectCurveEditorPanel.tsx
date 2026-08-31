import { useMemo } from 'react';
import type { AppState } from '../../types';
import type { SceneDirectorState } from '../../sceneDirector/types';
import type { SceneFxInstance, SceneStudioState } from '../../sceneStudio/types';
import CurveEditorView from './CurveEditorView';
import { patchFxStack, upsertEffectKeyframe } from '../../sceneDirector/effectKeyframes';
import type { TimelineKeyframe, TimelineTrackId } from '../../types';

interface EffectCurveEditorPanelProps {
  appState: AppState;
  parameterId?: string;
  setCurrentFrame: (frame: number) => void;
  onPatchSceneStudio: (patch: Partial<SceneStudioState>) => void;
}

const DUMMY_TRACK = 'morph_eyes' as TimelineTrackId;

function toTimelineKeyframes(
  fx: SceneFxInstance,
  parameterId: string
): TimelineKeyframe[] {
  return (fx.keyframes ?? [])
    .filter((k) => k.parameterId === parameterId)
    .map((k) => ({
      id: `efx_${fx.id}_${k.frame}_${k.parameterId}`,
      frame: k.frame,
      track: DUMMY_TRACK,
      value: k.value,
      interpolation: k.interpolation,
      easeIn: k.easeIn,
      easeOut: k.easeOut,
    }));
}

export default function EffectCurveEditorPanel({
  appState,
  parameterId = 'intensity',
  setCurrentFrame,
  onPatchSceneStudio,
}: EffectCurveEditorPanelProps) {
  const fxStack = appState.sceneStudio?.fxStack ?? [];
  const selectedId = appState.sceneDirector?.selectedEffectInstanceId ?? null;
  const selectedFx = fxStack.find((fx) => fx.id === selectedId) ?? null;

  const timelineKeys = useMemo(
    () => (selectedFx ? toTimelineKeyframes(selectedFx, parameterId) : []),
    [selectedFx, parameterId]
  );

  if (!selectedFx) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center p-4 text-[10px] text-zinc-500">
        Select an effect strip to edit parameter curves
      </div>
    );
  }

  if (timelineKeys.length < 1) {
    return (
      <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-4 text-[10px] text-zinc-500">
        <span>No keyframes on «{selectedFx.name}».</span>
        <span className="text-zinc-600">Use ◆ Key in Timeline view, then switch to Curves.</span>
      </div>
    );
  }

  const patchFx = (nextFx: SceneFxInstance) => {
    onPatchSceneStudio({
      fxStack: patchFxStack(fxStack, selectedFx.id, nextFx),
    });
  };

  return (
    <div className="flex h-full min-h-[180px] flex-col border-t border-zinc-800 bg-[#0e1014] p-2">
      <p className="mb-1 text-[9px] font-bold uppercase text-zinc-500">
        {selectedFx.name} · {parameterId} curve
      </p>
      <CurveEditorView
        keyframes={timelineKeys}
        track={DUMMY_TRACK}
        maxFrames={appState.maxFrames}
        currentFrame={appState.currentFrame}
        onScrubFrame={setCurrentFrame}
        onMoveKeyframe={(from, to) => {
          const moved = (selectedFx.keyframes ?? []).map((k) =>
            k.parameterId === parameterId && k.frame === from ? { ...k, frame: to } : k
          );
          patchFx({ ...selectedFx, keyframes: moved });
        }}
        onPatchKeyframe={(frame, patch) => {
          const existing = (selectedFx.keyframes ?? []).find(
            (k) => k.parameterId === parameterId && k.frame === frame
          );
          const value = patch.value ?? existing?.value ?? selectedFx.intensity;
          let next = upsertEffectKeyframe(selectedFx, frame, parameterId, value);
          const keyframes = (next.keyframes ?? []).map((k) =>
            k.parameterId === parameterId && k.frame === frame
              ? {
                  ...k,
                  interpolation: patch.interpolation ?? k.interpolation,
                  easeIn: patch.easeIn ?? k.easeIn,
                  easeOut: patch.easeOut ?? k.easeOut,
                  value: patch.value ?? k.value,
                }
              : k
          );
          patchFx({ ...next, keyframes });
        }}
      />
    </div>
  );
}
