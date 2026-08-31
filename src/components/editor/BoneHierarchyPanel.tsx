import { useMemo, useState } from 'react';
import type { PmxBoneInfo } from '../../types';
import { ChevronDown, ChevronRight, Bone } from 'lucide-react';

interface BoneHierarchyPanelProps {
  bones: PmxBoneInfo[];
  selectedBoneName: string | null;
  mutedGroups: Set<string>;
  onSelectBone: (boneName: string) => void;
  onToggleGroupMute: (groupId: string) => void;
  boneGroups: { id: string; name: string; boneNames: string[]; muted: boolean }[];
}

const MAX_BONE_DEPTH = 64;

export default function BoneHierarchyPanel({
  bones,
  selectedBoneName,
  onSelectBone,
  boneGroups,
  onToggleGroupMute,
}: BoneHierarchyPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const tree = useMemo(() => {
    const names = new Set(bones.map((b) => b.name));
    const roots = bones.filter((b) => !b.parentName || !names.has(b.parentName));
    if (roots.length > 0) return roots;
    return bones.length > 0 ? [bones[0]!] : [];
  }, [bones]);

  const childrenOf = (parent: string) => bones.filter((b) => b.parentName === parent);

  const renderBone = (bone: PmxBoneInfo, depth: number, visited: Set<string>) => {
    if (visited.has(bone.name) || depth > MAX_BONE_DEPTH) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(bone.name);

    const kids = childrenOf(bone.name).filter((k) => !nextVisited.has(k.name));
    const hasKids = kids.length > 0;
    const isCollapsed = collapsed.has(bone.name);
    const selected = selectedBoneName === bone.name;

    return (
      <div key={`${bone.name}@${depth}`}>
        <div
          className={`flex items-center gap-1 py-0.5 pr-1 text-[10px] cursor-pointer rounded ${
            selected ? 'bg-teal-950/50 text-[#39c5bb]' : 'text-zinc-400 hover:bg-zinc-800'
          }`}
          style={{ paddingLeft: 4 + depth * 12 }}
          onClick={() => onSelectBone(bone.name)}
        >
          {hasKids ? (
            <button
              type="button"
              className="p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed((s) => {
                  const n = new Set(s);
                  if (n.has(bone.name)) n.delete(bone.name);
                  else n.add(bone.name);
                  return n;
                });
              }}
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Bone className="w-3 h-3 shrink-0" />
          <span className="truncate">{bone.name}</span>
        </div>
        {hasKids && !isCollapsed && kids.map((k) => renderBone(k, depth + 1, nextVisited))}
      </div>
    );
  };

  if (bones.length === 0) {
    return <p className="text-[10px] text-zinc-500 p-2">Load a PMX to show the bone hierarchy</p>;
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {boneGroups.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {boneGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onToggleGroupMute(g.id)}
              className={`text-[8px] px-1.5 py-0.5 rounded border cursor-pointer ${
                g.muted
                  ? 'border-zinc-600 text-zinc-600 line-through'
                  : 'border-[#39c5bb]/40 text-[#39c5bb]'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}
      {tree.map((b) => renderBone(b, 0, new Set()))}
    </div>
  );
}
