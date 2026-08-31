/**
 * Physics Studio — presets, warmup, wind, debug, safe resets.
 * Uses existing Ammo / mmdLite paths (no multi-world rewrite).
 */
import type { MmdLiteConfig, PhysicsMode } from '../../types';
import { isAmmoPhysicsBroken } from '../../utils/mmdCharacterPhysics';
import {
  PHYSICS_PRESETS,
  getPhysicsPreset,
  type PhysicsPresetId,
} from '../../physics/physicsPresets';
import { Button, Panel, Slider, Toggle } from '../../components/UI';

const PHYSICS_OPTIONS: { id: PhysicsMode; label: string; hint: string }[] = [
  { id: 'anytime', label: 'Always on', hint: 'Hair and cloth simulate while editing.' },
  { id: 'playtime', label: 'During playback', hint: 'Physics runs only when the timeline plays.' },
  { id: 'off', label: 'Off', hint: 'Static pose — no cloth or hair simulation.' },
];

export interface PhysicsStudioDockProps {
  physicsMode: PhysicsMode;
  mmdLite: MmdLiteConfig;
  showPhysicsBodies?: boolean;
  onSetPhysicsMode: (mode: PhysicsMode) => void;
  onPatchMmdLite: (patch: Partial<MmdLiteConfig>) => void;
  onSetShowPhysicsBodies?: (show: boolean) => void;
  onRestartPhysics?: () => void;
  onFixPhysics?: () => void;
}

export default function PhysicsStudioDock({
  physicsMode,
  mmdLite,
  showPhysicsBodies = false,
  onSetPhysicsMode,
  onPatchMmdLite,
  onSetShowPhysicsBodies,
  onRestartPhysics,
  onFixPhysics,
}: PhysicsStudioDockProps) {
  const ammoBroken = isAmmoPhysicsBroken();
  const activePreset = (mmdLite.physicsPresetId as PhysicsPresetId) || 'default';
  const warmup = mmdLite.physicsWarmup ?? 20;

  const applyPreset = (id: PhysicsPresetId) => {
    const p = getPhysicsPreset(id);
    onSetPhysicsMode(p.physicsMode);
    onPatchMmdLite({
      ...p.mmdLite,
      physicsWarmup: p.physicsWarmup,
      physicsPresetId: p.id,
    });
  };

  return (
    <div className="p-2 space-y-2">
      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Physics presets</p>
        <div className="grid grid-cols-2 gap-1">
          {PHYSICS_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              onClick={() => applyPreset(p.id)}
              className={`text-left px-2 py-1.5 rounded border text-[9px] cursor-pointer ${
                activePreset === p.id
                  ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              <span className="font-bold block">{p.label}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Simulation mode</p>
        {PHYSICS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSetPhysicsMode(opt.id)}
            className={`w-full text-left px-2 py-1.5 rounded border text-[10px] cursor-pointer ${
              physicsMode === opt.id
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            <span className="font-bold block">{opt.label}</span>
            <span className="text-zinc-500">{opt.hint}</span>
          </button>
        ))}
        {ammoBroken ? (
          <p className="text-[9px] text-amber-400 m-0">Physics unavailable — refresh to retry.</p>
        ) : null}
      </Panel>

      <Panel className="!p-2 space-y-2">
        <Toggle
          label="Stable simulation"
          checked={mmdLite.stablePhys}
          onChange={(e) => onPatchMmdLite({ stablePhys: e.target.checked })}
        />
        {onSetShowPhysicsBodies ? (
          <Toggle
            label="Physics debug (bodies)"
            checked={showPhysicsBodies}
            onChange={(e) => onSetShowPhysicsBodies(e.target.checked)}
          />
        ) : null}
        <Slider
          label="Gravity"
          valueLabel={mmdLite.physicsGravity.toFixed(2)}
          min={0.2}
          max={2}
          step={0.05}
          value={mmdLite.physicsGravity}
          onChange={(e) =>
            onPatchMmdLite({
              physicsGravity: parseFloat(e.target.value),
              physicsPresetId: 'custom',
            })
          }
        />
        <Slider
          label="Hair / cloth swing"
          valueLabel={mmdLite.physicsSwing.toFixed(2)}
          min={0}
          max={0.55}
          step={0.01}
          value={mmdLite.physicsSwing}
          onChange={(e) =>
            onPatchMmdLite({
              physicsSwing: parseFloat(e.target.value),
              physicsPresetId: 'custom',
            })
          }
        />
        <Slider
          label="Wind"
          valueLabel={mmdLite.physicsWind.toFixed(1)}
          min={0}
          max={12}
          step={0.5}
          value={mmdLite.physicsWind}
          onChange={(e) =>
            onPatchMmdLite({
              physicsWind: parseFloat(e.target.value),
              physicsPresetId: 'custom',
            })
          }
        />
        <Slider
          label="Warmup frames"
          valueLabel={String(warmup)}
          min={0}
          max={60}
          step={5}
          value={warmup}
          onChange={(e) =>
            onPatchMmdLite({
              physicsWarmup: parseInt(e.target.value, 10),
              physicsPresetId: 'custom',
            })
          }
        />
        <p className="text-[9px] text-zinc-500 m-0 leading-snug">
          Warmup runs quiet sim before play/export to settle hair & cloth.
        </p>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Reset to safe state</p>
        <div className="grid grid-cols-2 gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onPatchMmdLite({ physicsWind: 0, physicsPresetId: 'custom' })}
          >
            Reset Wind
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              onPatchMmdLite({
                physicsSwing: 0.12,
                physicsGravity: 1,
                physicsWind: 0,
                stablePhys: true,
                physicsWarmup: 20,
                physicsPresetId: 'default',
              })
            }
          >
            Reset Physics
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onRestartPhysics}>
            Restart Sim
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onFixPhysics}>
            Fix / Stabilize
          </Button>
        </div>
      </Panel>
    </div>
  );
}
