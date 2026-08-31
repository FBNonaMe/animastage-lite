import { Camera, Lock, Unlock, Move, Clapperboard, Aperture } from 'lucide-react';
import { Button } from '../UI';
import type { AppState } from '../../types';

interface MobileCameraTabProps {
  appState: AppState;
  onSetCameraMode: (mode: AppState['cameraMode']) => void;
  onToggleManualLock: () => void;
  onEnterDirectCameraMode?: () => void;
  onOpenCineStudio?: () => void;
  onOpenReferenceCameraStudio?: () => void;
}

export default function MobileCameraTab({
  appState,
  onSetCameraMode,
  onToggleManualLock,
  onEnterDirectCameraMode,
  onOpenCineStudio,
  onOpenReferenceCameraStudio,
}: MobileCameraTabProps) {
  const manual = appState.cameraStudio.manualCameraLock;

  return (
    <div className="flex flex-col gap-[var(--space-md)] p-[var(--space-md)]">
      <p className="text-[var(--font-size-base)] text-[var(--color-text-secondary)] m-0 leading-relaxed">
        Use the viewport toggles for orbit. MMD mode follows dance templates; Manual lets you drag the
        camera yourself.
      </p>
      <div className="flex flex-col gap-[var(--space-sm)]">
        <Button
          type="button"
          variant={
            appState.cameraMode === 'free' && appState.cameraStudio.directPlacement !== false
              ? 'primary'
              : 'secondary'
          }
          className="w-full"
          onClick={() => onEnterDirectCameraMode?.() ?? onSetCameraMode('free')}
        >
          <Move className="w-4 h-4" />
          Move Cam + Gizmo
        </Button>
        {onOpenCineStudio ? (
          <Button type="button" variant="secondary" className="w-full" onClick={onOpenCineStudio}>
            <Clapperboard className="w-4 h-4" />
            Cine Studio
          </Button>
        ) : null}
        {onOpenReferenceCameraStudio ? (
          <Button type="button" variant="secondary" className="w-full" onClick={onOpenReferenceCameraStudio}>
            <Aperture className="w-4 h-4" />
            Cam Studio
          </Button>
        ) : null}
        <Button
          type="button"
          variant={appState.cameraMode === 'free' ? 'primary' : 'secondary'}
          className="w-full"
          onClick={() => onSetCameraMode('free')}
        >
          <Camera className="w-4 h-4" />
          Free orbit
        </Button>
        <Button
          type="button"
          variant={appState.cameraMode === 'mmd' ? 'primary' : 'secondary'}
          className="w-full"
          onClick={() => onSetCameraMode('mmd')}
        >
          <Camera className="w-4 h-4" />
          MMD director
        </Button>
        {appState.cameraMode === 'mmd' ? (
          <Button type="button" variant="secondary" className="w-full" onClick={onToggleManualLock}>
            {manual ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {manual ? 'Disable manual orbit' : 'Manual orbit (drag view)'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
