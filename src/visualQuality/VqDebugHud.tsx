import { useSyncExternalStore } from 'react';
import {
  getVqStoreSnapshot,
  getVqStoreServerSnapshot,
  setVqDebugHud,
  setVqLegacyCompare,
  setVqPreferredPreset,
  subscribeVqStore,
  type VqStoreSnapshot,
} from './store';
import { VQ_PRESET_LABELS } from './resolveBudget';
import type { VqQualityPreset } from './types';

const PRESETS: VqQualityPreset[] = [
  'preview',
  'fast',
  'balanced',
  'high',
  'ultra',
  'cinematic',
  'photo',
];

/**
 * Lightweight Visual Quality 2.0 debug / A/B HUD (viewport overlay).
 */
export default function VqDebugHud() {
  const snap = useSyncExternalStore(
    subscribeVqStore,
    getVqStoreSnapshot,
    getVqStoreServerSnapshot
  );
  if (!snap.debugHud) return null;

  const b = snap.lastBudget;

  return (
    <div
      className="pointer-events-auto absolute bottom-14 left-2 z-[40] max-w-[220px] rounded border border-cyan-500/30 bg-black/75 p-2 text-[9px] text-zinc-200 shadow-lg backdrop-blur-sm"
      style={{ fontFamily: 'ui-monospace, monospace' }}
    >
      <p className="mb-1 font-bold uppercase tracking-wide text-cyan-300">VQ 2.0 Debug</p>
      <label className="mb-1 flex items-center gap-1">
        <span className="text-zinc-500">Preset</span>
        <select
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
          value={snap.preferredPreset ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setVqPreferredPreset(v ? (v as VqQualityPreset) : null);
          }}
        >
          <option value="">Auto</option>
          {PRESETS.map((id) => (
            <option key={id} value={id}>
              {VQ_PRESET_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-1 flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={snap.legacyCompare}
          onChange={(e) => setVqLegacyCompare(e.target.checked)}
        />
        A/B Legacy
      </label>
      <label className="mb-1 flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={snap.debugHud}
          onChange={(e) => setVqDebugHud(e.target.checked)}
        />
        HUD
      </label>
      {b ? (
        <div className="mt-1 space-y-0.5 text-zinc-400">
          <p>
            Active · {VQ_PRESET_LABELS[b.preset]}
            {b.legacyCompare ? ' (legacy)' : ''}
          </p>
          <p>
            Shadow {b.shadowMapSize}
            {b.csm ? ` · CSM×${b.csmCascades}` : ''}
          </p>
          <p>
            Fog {b.fogQuality}
            {b.heightFog ? '+H' : ''}
            {b.fogNoise ? '+N' : ''}
          </p>
          <p>
            Particles ×{b.particleScale.toFixed(2)} · L{b.weatherLayers}
          </p>
          <p>Owner · {snap.fogOwner}</p>
          <p>
            Frame {snap.frameMs.toFixed(1)}ms · PX {snap.particleCount}
          </p>
          {snap.activePasses.length ? (
            <p className="truncate">Pass · {snap.activePasses.join(' › ')}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-zinc-500">Waiting for viewport…</p>
      )}
    </div>
  );
}

export function useVqStore(): VqStoreSnapshot {
  return useSyncExternalStore(
    subscribeVqStore,
    getVqStoreSnapshot,
    getVqStoreServerSnapshot
  );
}
