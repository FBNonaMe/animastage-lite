import { useMemo, type RefObject } from 'react';
import { resolveMobileSelectionContext } from './resolveContext';
import { useMobileGestures } from './useMobileGestures';
import type { MobileCameraMode } from './MobileCameraModeBar';
import type {
  MobileTransformMode,
  MobileWorkspaceTool,
} from './types';
import { Move, RotateCw } from 'lucide-react';
import { cn } from '../../components/UI/cn';

export interface MobileViewportChromeProps {
  enabled?: boolean;
  stageRef: RefObject<HTMLElement | null>;
  selectedObjectId: string | null;
  selectedBoneId: string | null;
  highlightMaterial: string | null;
  cameraMode: string;
  directPlacement?: boolean;
  models: Array<{ id: string; name: string; assetKind?: string | null }>;
  isPlaying: boolean;
  transformMode: MobileTransformMode;
  onTransformMode: (mode: MobileTransformMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePlay: () => void;
  onOpenCamera: () => void;
  onOpenRender: () => void;
  onOpenWorkspaceTool: (tool: MobileWorkspaceTool) => void;
  onSetCameraMode?: (mode: MobileCameraMode) => void;
  onEnterDirectCameraMode?: () => void;
  /** @deprecated quiet home — ignored */
  hideToolbox?: boolean;
  showContextStrip?: boolean;
  showCameraModes?: boolean;
}

/**
 * Quiet phone home chrome: gestures + bone Move/Rotate segment (no popup).
 * Camera modes / tools live in bottom sheets — not on the main viewport.
 */
export default function MobileViewportChrome({
  enabled = true,
  stageRef,
  selectedObjectId,
  selectedBoneId,
  highlightMaterial,
  cameraMode,
  models,
  transformMode,
  onTransformMode,
  onUndo,
  onRedo,
  onTogglePlay,
}: MobileViewportChromeProps) {
  const context = useMemo(
    () =>
      resolveMobileSelectionContext({
        selectedObjectId,
        selectedBoneId,
        highlightMaterial,
        cameraMode,
        models,
      }),
    [selectedObjectId, selectedBoneId, highlightMaterial, cameraMode, models]
  );

  useMobileGestures(
    stageRef,
    {
      onThreeFingerUndo: onUndo,
      onThreeFingerRedo: onRedo,
      onDoubleTap: () => onTogglePlay(),
    },
    enabled
  );

  if (!enabled) return null;

  const showBoneEdit = context.kind === 'bone' && Boolean(selectedBoneId);

  return (
    <div className="am-viewport-chrome pointer-events-none absolute inset-0 z-[28]">
      {showBoneEdit ? (
        <div
          className="pointer-events-auto absolute inset-x-0 flex justify-center px-3 am-bone-edit-bar"
          role="group"
          aria-label="Bone transform"
        >
          <div className="am-bone-segment">
            <button
              type="button"
              className={cn(
                'am-bone-segment__btn',
                transformMode === 'translate' && 'am-bone-segment__btn--on'
              )}
              aria-pressed={transformMode === 'translate'}
              onClick={() => onTransformMode('translate')}
            >
              <Move className="am-bone-segment__icon" aria-hidden />
              Move
            </button>
            <button
              type="button"
              className={cn(
                'am-bone-segment__btn',
                transformMode === 'rotate' && 'am-bone-segment__btn--on'
              )}
              aria-pressed={transformMode === 'rotate'}
              onClick={() => onTransformMode('rotate')}
            >
              <RotateCw className="am-bone-segment__icon" aria-hidden />
              Rotate
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
