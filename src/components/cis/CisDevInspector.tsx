import type { ReactNode } from 'react';
import type { CharacterIntelligenceProfile } from '../../cis/types';

interface CisDevInspectorProps {
  profile: CharacterIntelligenceProfile;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-zinc-800 rounded px-2 py-1.5 space-y-1">
      <div className="text-[8px] font-bold uppercase text-violet-300">{title}</div>
      {children}
    </div>
  );
}

export default function CisDevInspector({ profile }: CisDevInspectorProps) {
  const { skeleton, morphs, physics, materials, capabilities, health, performance, fingerprint } =
    profile;

  return (
    <div className="bg-violet-950/20 border border-violet-500/25 rounded-md p-2 space-y-2 text-[9px]">
      <div className="flex items-center justify-between">
        <span className="font-bold uppercase text-violet-200">CIS Developer Inspector</span>
        <span className="font-mono text-violet-300">{health.overall}%</span>
      </div>

      <Section title="Fingerprint">
        <div className="font-mono text-zinc-500 break-all">{fingerprint.combined}</div>
      </Section>

      <Section title="Skeleton Graph">
        <div className="grid grid-cols-2 gap-1 text-zinc-400">
          <span>Bones: {skeleton.boneCount}</span>
          <span>IK: {skeleton.ikChainCount}</span>
          <span>Helpers: {skeleton.helperBoneCount}</span>
          <span>Symmetry: {skeleton.symmetryScore}%</span>
        </div>
        <div className="max-h-16 overflow-y-auto text-zinc-500 font-mono text-[8px]">
          {skeleton.bones.slice(0, 24).map((b) => (
            <div key={b.name}>
              {'·'.repeat(Math.min(b.depth, 6))}
              {b.name} [{b.region}]
            </div>
          ))}
          {skeleton.bones.length > 24 ? <div>…+{skeleton.bones.length - 24}</div> : null}
        </div>
      </Section>

      <Section title="Morph Tree">
        {morphs.categories.map((c) => (
          <div key={c.id} className="text-zinc-400">
            {c.detected ? '✓' : '○'} {c.label} ({c.morphNames.length})
          </div>
        ))}
      </Section>

      <Section title="Physics Graph">
        {physics.chains.map((c) => (
          <div key={c.kind} className="text-zinc-400">
            {c.label}: {c.count} · {c.stable ? 'stable' : 'fair'}
          </div>
        ))}
        <div className="text-zinc-500">
          Bodies {physics.rigidBodyCount} · Constraints {physics.constraintCount} ·{' '}
          {physics.physicsCost} cost
        </div>
      </Section>

      <Section title="Material / Texture Report">
        <div className="text-zinc-400">
          Materials {materials.materials.length} · Missing tex {materials.missingTextureCount} ·
          Large {materials.largeTextureCount}
        </div>
      </Section>

      <Section title="Performance Timeline">
        <div className="grid grid-cols-2 gap-1 text-zinc-400">
          <span>CPU: {performance.cpuCost}</span>
          <span>GPU: {performance.gpuCost}</span>
          <span>Mem: {performance.memoryMb} MB</span>
          <span>Tex: {performance.textureMemoryMb} MB</span>
          <span>Est FPS: {performance.expectedFps}</span>
          <span>Tier: {performance.recommendedTier}</span>
        </div>
      </Section>

      <Section title="Capabilities">
        <div className="flex flex-wrap gap-1">
          {capabilities.map((c) => (
            <span
              key={c.id}
              className={`px-1 py-0.5 rounded text-[8px] ${
                c.supported
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-zinc-800 text-zinc-600'
              }`}
            >
              {c.supported ? '✓' : '–'} {c.label}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}
