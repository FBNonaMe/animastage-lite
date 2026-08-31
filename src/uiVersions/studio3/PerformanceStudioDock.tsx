/**
 * Performance Studio dock — real quality / RTX / character quality controls.
 */
import type { CharacterQuality } from '../../types';
import type { QualityMode } from '../../product/scene/types';
import { Button, Panel, Toggle } from '../../components/UI';

const QUALITY: { id: QualityMode; label: string }[] = [
  { id: 'performance', label: 'Performance' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'quality', label: 'Quality' },
];

const CHAR_Q: { id: CharacterQuality; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'hd', label: 'HD' },
  { id: 'uhd4k', label: 'UHD 4K' },
];

export interface PerformanceStudioDockProps {
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  characterQuality: CharacterQuality;
  onCharacterQualityChange: (q: CharacterQuality) => void;
  rtxModeEnabled: boolean;
  onSetRtxModeEnabled: (enabled: boolean) => void;
  showGrid: boolean;
  onShowGrid: (v: boolean) => void;
  showBones: boolean;
  onShowBones: (v: boolean) => void;
  showPhysicsBodies: boolean;
  onShowPhysicsBodies: (v: boolean) => void;
}

export default function PerformanceStudioDock({
  qualityMode,
  onQualityModeChange,
  characterQuality,
  onCharacterQualityChange,
  rtxModeEnabled,
  onSetRtxModeEnabled,
  showGrid,
  onShowGrid,
  showBones,
  onShowBones,
  showPhysicsBodies,
  onShowPhysicsBodies,
}: PerformanceStudioDockProps) {
  return (
    <div className="p-2 space-y-2">
      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Editor quality</p>
        <div className="grid grid-cols-3 gap-1">
          {QUALITY.map((q) => (
            <Button
              key={q.id}
              type="button"
              size="sm"
              variant={qualityMode === q.id ? 'primary' : 'secondary'}
              className="w-full !text-[9px]"
              onClick={() => onQualityModeChange(q.id)}
            >
              {q.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Character quality</p>
        <div className="grid grid-cols-3 gap-1">
          {CHAR_Q.map((q) => (
            <Button
              key={q.id}
              type="button"
              size="sm"
              variant={characterQuality === q.id ? 'primary' : 'secondary'}
              className="w-full !text-[9px]"
              onClick={() => onCharacterQualityChange(q.id)}
            >
              {q.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel className="!p-2 space-y-2">
        <Toggle
          label="RTX Lite mode"
          checked={rtxModeEnabled}
          onChange={(e) => onSetRtxModeEnabled(e.target.checked)}
        />
        <Toggle
          label="Show grid"
          checked={showGrid}
          onChange={(e) => onShowGrid(e.target.checked)}
        />
        <Toggle
          label="Show bones"
          checked={showBones}
          onChange={(e) => onShowBones(e.target.checked)}
        />
        <Toggle
          label="Physics bodies"
          checked={showPhysicsBodies}
          onChange={(e) => onShowPhysicsBodies(e.target.checked)}
        />
      </Panel>
    </div>
  );
}
