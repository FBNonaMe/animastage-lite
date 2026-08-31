import { Settings, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { AppState, MMDModel, MmdLiteConfig, PhysicsMode } from '../../types';
import type { AnimationLayerDef, TimelineKeyframe } from '../../types';
import { isAmmoPhysicsBroken } from '../../utils/mmdCharacterPhysics';
import AdvancedStudioPanel from '../editor/AdvancedStudioPanel';
import BoneHierarchyPanel from '../editor/BoneHierarchyPanel';
import MaterialsPanel from '../editor/MaterialsPanel';
import ModelAnalyzerPanel from '../editor/ModelAnalyzerPanel';
import ApisStatusPanel from '../apis/ApisStatusPanel';
import CisStatusPanel from '../cis/CisStatusPanel';
import { CollapsibleSection, Panel, Slider, Toggle } from '../UI';

interface AdvancedSectionProps {
  appState: AppState;
  selectedModel: MMDModel | undefined;
  lite: MmdLiteConfig;
  beginnerMode: boolean;
  maxFrames: number;
  highlightMaterial: string | null;
  analyzingModel: boolean;
  collabConnected: boolean;
  collabRoom: string;
  collabPeers: number;
  collabStatus: string;
  onCollabJoin?: (room: string, mode: import('../../collab/collabSync').CollabMode) => void;
  onCollabLeave?: () => void;
  setPhysicsMode: (mode: PhysicsMode) => void;
  onPatchMmdLite: (patch: Partial<MmdLiteConfig>) => void;
  onApplyKeyframes?: (keyframes: TimelineKeyframe[], mode: 'merge' | 'replace') => void;
  onUpdateAnimLayers?: (layers: AnimationLayerDef[]) => void;
  onToggleGroupSolo?: (groupId: string) => void;
  onToggleGroupMute?: (groupId: string) => void;
  onReanalyzeModel?: () => void;
  onSelectPmxBone?: (boneName: string) => void;
  onSelectMaterial?: (name: string | null) => void;
}

const PHYSICS_OPTIONS: { id: PhysicsMode; label: string; hint: string }[] = [
  { id: 'anytime', label: 'Always on', hint: 'Hair and cloth simulate while editing.' },
  { id: 'playtime', label: 'During playback', hint: 'Physics runs only when the timeline plays.' },
  { id: 'off', label: 'Off', hint: 'Static pose — no cloth or hair simulation.' },
];

export default function AdvancedSection({
  appState,
  selectedModel,
  lite,
  beginnerMode,
  maxFrames,
  highlightMaterial,
  analyzingModel,
  collabConnected,
  collabRoom,
  collabPeers,
  collabStatus,
  onCollabJoin,
  onCollabLeave,
  setPhysicsMode,
  onPatchMmdLite,
  onApplyKeyframes,
  onUpdateAnimLayers,
  onToggleGroupSolo,
  onToggleGroupMute,
  onReanalyzeModel,
  onSelectPmxBone,
  onSelectMaterial,
}: AdvancedSectionProps) {
  const ammoBroken = isAmmoPhysicsBroken();

  return (
    <>
      <CollapsibleSection title="Physics" defaultOpen={false} icon={<ShieldAlert className="w-4 h-4" />}>
        <div className="ds-stack ds-stack--sm">
          {PHYSICS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPhysicsMode(opt.id)}
              className={`w-full text-left rounded-[var(--radius-sm)] border p-[var(--space-sm)] cursor-pointer transition-colors ${
                appState.physicsMode === opt.id
                  ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-subtle)]'
              }`}
            >
              <div className="flex items-center justify-between text-[var(--font-size-base)] font-medium text-[var(--color-text-main)]">
                <span>{opt.label}</span>
                {appState.physicsMode === opt.id ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                ) : null}
              </div>
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] m-0 mt-0.5">{opt.hint}</p>
            </button>
          ))}
          {ammoBroken ? (
            <p className="text-[var(--font-size-sm)] text-[var(--color-warning)] m-0">
              Physics unavailable — refresh the page to retry.
            </p>
          ) : null}
          <Panel className="!p-[var(--space-md)]">
            <p className="flex items-center gap-1.5 text-[var(--font-size-sm)] font-medium text-[var(--color-text-main)] m-0 mb-[var(--space-md)]">
              <Settings className="w-3.5 h-3.5" />
              Simulation tuning
            </p>
            <Toggle
              label="Stable simulation"
              checked={lite.stablePhys}
              onChange={(e) => onPatchMmdLite({ stablePhys: e.target.checked })}
            />
            <Slider
              label="Gravity"
              valueLabel={lite.physicsGravity.toFixed(2)}
              min={0.2}
              max={2}
              step={0.05}
              value={lite.physicsGravity}
              onChange={(e) => onPatchMmdLite({ physicsGravity: parseFloat(e.target.value) })}
            />
            <Slider
              label="Hair swing"
              valueLabel={lite.physicsSwing.toFixed(2)}
              min={0}
              max={0.55}
              step={0.01}
              value={lite.physicsSwing}
              onChange={(e) => onPatchMmdLite({ physicsSwing: parseFloat(e.target.value) })}
            />
            <Slider
              label="Wind"
              valueLabel={lite.physicsWind.toFixed(1)}
              min={0}
              max={12}
              step={0.5}
              value={lite.physicsWind}
              onChange={(e) => onPatchMmdLite({ physicsWind: parseFloat(e.target.value) })}
            />
          </Panel>
        </div>
      </CollapsibleSection>

      {selectedModel ? (
        <CollapsibleSection title="Model details" defaultOpen={false}>
          {selectedModel.cisReport ? (
            <div className="mb-[var(--space-sm)]">
              <CisStatusPanel report={selectedModel.cisReport} />
            </div>
          ) : selectedModel.apisReport ? (
            <div className="mb-[var(--space-sm)]">
              <ApisStatusPanel report={selectedModel.apisReport} />
            </div>
          ) : null}
          {!beginnerMode && onReanalyzeModel ? (
            <ModelAnalyzerPanel
              report={selectedModel.modelAnalysis}
              umceReport={selectedModel.umceReport}
              apisReport={selectedModel.apisReport}
              cisProfile={selectedModel.cisReport?.profile}
              onReanalyze={onReanalyzeModel}
              analyzing={analyzingModel}
            />
          ) : null}
          <Panel className="!p-[var(--space-md)]">
            <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-main)] m-0 mb-[var(--space-sm)]">
              Bone hierarchy
            </p>
            <BoneHierarchyPanel
              bones={selectedModel.pmxBones ?? []}
              selectedBoneName={appState.selectedBoneId}
              boneGroups={selectedModel.boneGroups ?? []}
              mutedGroups={new Set()}
              onSelectBone={(name) => onSelectPmxBone?.(name)}
              onToggleGroupMute={() => {}}
            />
          </Panel>
          <Panel className="!p-[var(--space-md)]">
            <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-main)] m-0 mb-[var(--space-sm)]">
              Materials
            </p>
            <MaterialsPanel
              materials={selectedModel.pmxMaterials ?? []}
              selectedMaterial={highlightMaterial ?? null}
              onSelectMaterial={(n) => onSelectMaterial?.(n)}
            />
          </Panel>
        </CollapsibleSection>
      ) : null}

      {!beginnerMode && onApplyKeyframes && onUpdateAnimLayers && onCollabJoin && onCollabLeave ? (
        <CollapsibleSection title="Pro tools" defaultOpen={false}>
          <AdvancedStudioPanel
            selectedModel={selectedModel}
            maxFrames={maxFrames}
            collabConnected={collabConnected}
            collabRoom={collabRoom}
            collabPeers={collabPeers}
            collabStatus={collabStatus}
            onCollabJoin={onCollabJoin}
            onCollabLeave={onCollabLeave}
            onApplyKeyframes={onApplyKeyframes}
            onUpdateLayers={onUpdateAnimLayers}
            onToggleGroupSolo={(id) => onToggleGroupSolo?.(id)}
            onToggleGroupMute={(id) => onToggleGroupMute?.(id)}
          />
        </CollapsibleSection>
      ) : null}
    </>
  );
}
