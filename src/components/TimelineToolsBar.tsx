import { useState } from 'react';
import { Layers, Key, Music2 } from 'lucide-react';
import type { TemplateApplyMode } from '../types';
import TemplatePicker from './TemplatePicker';
import MobileTemplateSheet from './MobileTemplateSheet';
import { DANCE_PICKER_CATEGORIES, CHARACTER_PICKER_CATEGORIES } from '../templates/animationTemplates';

interface TimelineToolsBarProps {
  applyMode: TemplateApplyMode;
  onToggleApplyMode: () => void;
  applyWithMode: (templateId: string) => void;
  hasModel: boolean;
  vmdActive: boolean;
  modelKeyCount: number;
  cameraKeyCount: number;
  onClearAllKeyframes: () => void;
  timelineActiveTrack: string | null;
  onRegisterKeyframe: () => void;
  /** `desktop` = dropdown pickers (md+). `mobile` = one bottom sheet. */
  variant: 'desktop' | 'mobile';
}

export default function TimelineToolsBar({
  applyMode,
  onToggleApplyMode,
  applyWithMode,
  hasModel,
  vmdActive,
  modelKeyCount,
  cameraKeyCount,
  onClearAllKeyframes,
  timelineActiveTrack,
  onRegisterKeyframe,
  variant,
}: TimelineToolsBarProps) {
  const isCamera = timelineActiveTrack === 'camera';
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 min-w-min">
      <button
        type="button"
        onClick={onToggleApplyMode}
        className={`cursor-pointer text-[10px] font-bold border rounded px-1.5 py-1 flex items-center gap-1 transition-all shrink-0 ${
          applyMode === 'merge'
            ? 'text-teal-200 bg-teal-950/40 border-teal-500/40'
            : 'text-amber-200 bg-amber-950/30 border-amber-500/40'
        }`}
        title={
          applyMode === 'merge'
            ? 'Add layer: stack body + camera without erasing'
            : 'Replace: overwrite keys from the picked template'
        }
      >
        <Layers className="w-3 h-3" />
        {applyMode === 'merge' ? 'Layer' : 'Replace'}
      </button>

      {variant === 'mobile' ? (
        <>
          <button
            type="button"
            onClick={() => setMobileSheetOpen(true)}
            className="cursor-pointer text-[10px] font-bold border rounded px-2 py-1 flex items-center gap-1.5 transition-all shrink-0 text-teal-200 bg-teal-950/40 border-teal-500/40 hover:bg-teal-950/60"
          >
            <Music2 className="w-3.5 h-3.5 text-[#39c5bb]" />
            Templates
          </button>
          <MobileTemplateSheet
            open={mobileSheetOpen}
            onClose={() => setMobileSheetOpen(false)}
            onApplyTemplate={applyWithMode}
            hasModel={hasModel}
            hasVmdActive={vmdActive}
            applyMode={applyMode}
          />
        </>
      ) : (
        <>
          <TemplatePicker
            onApplyTemplate={applyWithMode}
            hasModel={hasModel}
            hasVmdActive={vmdActive}
            compact
            variant="dance"
            categories={DANCE_PICKER_CATEGORIES}
            label="Add"
            title="Body, camera, combo & emote clips"
            applyMode={applyMode}
            placement="below"
          />
          <TemplatePicker
            onApplyTemplate={applyWithMode}
            hasModel={hasModel}
            hasVmdActive={vmdActive}
            compact
            categories={CHARACTER_PICKER_CATEGORIES}
            label="Pose"
            title="Character poses & expressions"
            applyMode={applyMode}
            placement="below"
          />
        </>
      )}

      {(modelKeyCount > 0 || cameraKeyCount > 0) && (
        <span className="text-[9px] font-mono text-zinc-500 shrink-0 px-0.5">
          {modelKeyCount > 0 && `${modelKeyCount}b`}
          {modelKeyCount > 0 && cameraKeyCount > 0 && '·'}
          {cameraKeyCount > 0 && `${cameraKeyCount}c`}
        </span>
      )}

      <button
        type="button"
        onClick={onClearAllKeyframes}
        className="cursor-pointer text-[10px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-700 hover:border-red-500/50 hover:text-red-400 px-1.5 py-1 rounded transition-all shrink-0"
        title="Remove all camera and model keyframes"
      >
        Clear
      </button>

      {(hasModel || isCamera) && (
        <button
          type="button"
          onClick={onRegisterKeyframe}
          className="cursor-pointer text-[10px] font-bold text-teal-300 bg-[#39c5bb]/15 border border-[#39c5bb]/40 hover:bg-[#39c5bb]/20 p-1 px-1.5 flex items-center gap-1 rounded transition-all shrink-0"
          title={
            isCamera
              ? 'Register camera keyframe'
              : vmdActive
                ? 'Add keyframe and switch to timeline (disables imported VMD)'
                : 'Register model keyframes'
          }
        >
          <Key className="w-3.5 h-3.5 text-[#39c5bb]" />
          {isCamera ? 'Cam' : 'Key'}
        </button>
      )}
    </div>
  );
}
