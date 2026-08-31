import { Camera, Clapperboard, Move } from 'lucide-react';
import { cn } from '../../components/UI/cn';
import MobileDropdownMenu from './MobileDropdownMenu';

export type MobileCameraMode = 'free' | 'mmd';

export interface MobileCameraModeBarProps {
  cameraMode: MobileCameraMode | string;
  directPlacement?: boolean;
  onSetCameraMode: (mode: MobileCameraMode) => void;
  onEnterDirectCameraMode?: () => void;
  className?: string;
}

type CamChoice = 'move' | 'free' | 'mmd';

function resolveChoice(
  cameraMode: string,
  directPlacement: boolean
): CamChoice {
  if (cameraMode === 'mmd') return 'mmd';
  if (cameraMode === 'free' && directPlacement !== false) return 'move';
  return 'free';
}

const LABELS: Record<CamChoice, string> = {
  move: 'Move Cam',
  free: 'Free orbit',
  mmd: 'MMD camera',
};

/**
 * Camera mode as a phone dropdown (same options as desktop HUD).
 */
export default function MobileCameraModeBar({
  cameraMode,
  directPlacement = true,
  onSetCameraMode,
  onEnterDirectCameraMode,
  className,
}: MobileCameraModeBarProps) {
  const current = resolveChoice(cameraMode, directPlacement);
  const TriggerIcon =
    current === 'mmd' ? Clapperboard : current === 'move' ? Move : Camera;

  return (
    <div className={cn('am-camera-modes am-camera-modes--dropdown', className)}>
      <MobileDropdownMenu
        label={LABELS[current]}
        icon={<TriggerIcon className="w-4 h-4" />}
        align="center"
        items={[
          {
            id: 'move',
            label: 'Move Cam + Gizmo',
            icon: <Move className="w-4 h-4" />,
            active: current === 'move',
          },
          {
            id: 'free',
            label: 'Free orbit',
            icon: <Camera className="w-4 h-4" />,
            active: current === 'free',
          },
          {
            id: 'mmd',
            label: 'MMD director',
            icon: <Clapperboard className="w-4 h-4" />,
            active: current === 'mmd',
          },
        ]}
        onSelect={(id) => {
          if (id === 'move') {
            onEnterDirectCameraMode?.() ?? onSetCameraMode('free');
            return;
          }
          if (id === 'free') onSetCameraMode('free');
          if (id === 'mmd') onSetCameraMode('mmd');
        }}
      />
    </div>
  );
}
