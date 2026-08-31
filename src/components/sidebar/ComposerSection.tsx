import { Clapperboard } from 'lucide-react';
import type { AppState, SceneBackgroundSettings, VisualFxSettings } from '../../types';
import type { SceneComposerState } from '../../sceneComposer';
import { CollapsibleSection } from '../UI';
import SceneComposerPanel from '../sceneComposer/SceneComposerPanel';

interface ComposerSectionProps {
  appState: AppState;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onPatchComposer: (patch: Partial<SceneComposerState>) => void;
  onReplaceComposer: (next: SceneComposerState) => void;
  onPatchSceneBackground?: (patch: Partial<SceneBackgroundSettings>) => void;
  onImportBackgroundModel?: (data: import('../../utils/mmdFiles').ProcessedMMDFiles | import('../../utils/mmdFiles').ProcessedMMDFiles[]) => void;
  getViewportCanvas?: () => HTMLCanvasElement | null;
  captureViewportFrame?: () => string | null;
  invalidateViewport?: () => void;
}

export default function ComposerSection({
  appState,
  onSetVisualFx,
  onPatchComposer,
  onReplaceComposer,
  onPatchSceneBackground,
  onImportBackgroundModel,
  getViewportCanvas,
  captureViewportFrame,
  invalidateViewport,
}: ComposerSectionProps) {
  return (
    <CollapsibleSection title="🎬 Scene" defaultOpen icon={<Clapperboard className="w-4 h-4" />}>
      <SceneComposerPanel
        appState={appState}
        onSetVisualFx={onSetVisualFx}
        onPatchComposer={onPatchComposer}
        onReplaceComposer={onReplaceComposer}
        onPatchSceneBackground={onPatchSceneBackground}
        onImportBackgroundModel={onImportBackgroundModel}
        getViewportCanvas={getViewportCanvas}
        captureViewportFrame={captureViewportFrame}
        invalidateViewport={invalidateViewport}
      />
    </CollapsibleSection>
  );
}
