import { useCallback, useMemo, useRef, useState } from 'react';
import { Bookmark, Download, Trash2, Upload } from 'lucide-react';
import type { PoseSnapshotV1 } from '../../pose/poseTypes';
import { PRESET_POSES } from '../../pose/presetPoses';
import { SMART_POSE_PRESETS } from '../../pose/smartPosePresets';
import {
  addCustomPose,
  downloadPoseJson,
  loadCustomPoses,
  parsePoseJsonFile,
  removeCustomPose,
} from '../../pose/poseStorage';

interface PoseLibraryPanelProps {
  activePoseId: string | null;
  disabled?: boolean;
  onApplyPose: (pose: PoseSnapshotV1) => void;
  onCapturePose: () => void;
  onClearPose: () => void;
}

export default function PoseLibraryPanel({
  activePoseId,
  disabled,
  onApplyPose,
  onCapturePose,
  onClearPose,
}: PoseLibraryPanelProps) {
  const [custom, setCustom] = useState<PoseSnapshotV1[]>(() => loadCustomPoses());
  const fileRef = useRef<HTMLInputElement>(null);

  const allPoses = useMemo(() => [...PRESET_POSES, ...SMART_POSE_PRESETS, ...custom], [custom]);

  const refreshCustom = useCallback(() => {
    setCustom(loadCustomPoses());
  }, []);

  const handleImport = useCallback(
    async (file: File) => {
      const text = await file.text();
      const pose = parsePoseJsonFile(text);
      setCustom(addCustomPose(pose));
    },
    []
  );

  return (
    <div className="border-[#c084fc]/25 border bg-[#121418] p-3 rounded-md shadow-md space-y-3">
      <div className="h-7 bg-[#1c1e24] -mx-3 -mt-3 mb-1 px-2 flex items-center justify-between text-zinc-200 text-[10px] font-bold uppercase rounded-t-md border-b border-[#2c3240]">
        <span className="flex items-center text-[#c084fc]">
          <Bookmark className="w-3.5 h-3.5 mr-1" /> Pose Library
        </span>
        <span className="text-zinc-500 text-[8px]">Instant · JSON</span>
      </div>

      <p className="text-[9px] text-zinc-500 leading-snug">
        Applies to paused model (VMD off). Physics hair/skirt bones are skipped. Smart Pose presets use IK-friendly angles. Use Register Keyframe to bake into timeline.
      </p>

      <p className="text-[8px] font-bold uppercase text-zinc-600 m-0">Built-in · Smart Pose · Custom</p>

      <div className="grid grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto pr-0.5">
        {allPoses.map((pose) => {
          const isActive = activePoseId === pose.id;
          const isCustom = !pose.id.startsWith('preset_') && !pose.id.startsWith('smart_');
          const isSmart = pose.id.startsWith('smart_');
          return (
            <button
              key={pose.id}
              type="button"
              disabled={disabled}
              onClick={() => onApplyPose(pose)}
              className={`relative flex flex-col items-center justify-center gap-0.5 p-2 min-h-[56px] rounded border text-center transition-all cursor-pointer disabled:opacity-40 ${
                isActive
                  ? 'border-[#c084fc] bg-[#c084fc]/15 text-[#e9d5ff]'
                  : 'border-zinc-800 bg-[#1a1d24] text-zinc-300 hover:border-[#c084fc]/40 hover:bg-[#1e212a]'
              }`}
              title={pose.name}
            >
              <span className="text-xl leading-none">{pose.thumbnail}</span>
              <span className="text-[8px] font-bold uppercase truncate w-full">{pose.name}</span>
              {isSmart && (
                <span className="text-[7px] text-violet-400/80 uppercase">Smart</span>
              )}
              {isCustom && (
                <span
                  role="button"
                  tabIndex={0}
                  className="absolute top-0.5 right-0.5 p-0.5 text-zinc-500 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustom(removeCustomPose(pose.id));
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
                  title="Delete custom pose"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onCapturePose}
          className="flex-1 min-w-[100px] cursor-pointer py-1.5 text-[9px] font-bold uppercase rounded border border-[#c084fc]/30 bg-[#c084fc]/10 text-[#e9d5ff] hover:bg-[#c084fc]/20 disabled:opacity-40"
        >
          Capture current
        </button>
        <button
          type="button"
          disabled={disabled || !activePoseId}
          onClick={onClearPose}
          className="flex-1 min-w-[80px] cursor-pointer py-1.5 text-[9px] font-bold uppercase rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
        >
          Clear hold
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1 flex-1 cursor-pointer py-1.5 text-[9px] font-bold uppercase rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
        >
          <Upload className="w-3 h-3" /> Load JSON
        </button>
        <button
          type="button"
          disabled={!activePoseId}
          onClick={() => {
            const p = allPoses.find((x) => x.id === activePoseId);
            if (p) downloadPoseJson(p);
          }}
          className="flex items-center justify-center gap-1 flex-1 cursor-pointer py-1.5 text-[9px] font-bold uppercase rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
        >
          <Download className="w-3 h-3" /> Save JSON
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImport(f).then(refreshCustom);
          e.target.value = '';
        }}
      />
    </div>
  );
}
