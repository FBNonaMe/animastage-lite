import { useCallback, useState } from 'react';
import { Clapperboard, Camera, Video } from 'lucide-react';
import {
  MOTION_TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  getMotionTemplatesByCategory,
  templateHasCamera,
} from '../templates/animationTemplates';
import type { TemplateApplyMode, TemplateApplyOptions } from '../types';

const CAMERA_PREF_KEY = 'as_template_use_camera';

function loadUseTemplateCameraPref(): boolean {
  try {
    return localStorage.getItem(CAMERA_PREF_KEY) === 'template';
  } catch {
    return false;
  }
}

function saveUseTemplateCameraPref(useTemplate: boolean): void {
  try {
    localStorage.setItem(CAMERA_PREF_KEY, useTemplate ? 'template' : 'manual');
  } catch {
    /* ignore */
  }
}

interface AnimationTemplateSelectorProps {
  activeTemplateId: string | null | undefined;
  onSelect: (templateId: string, mode?: TemplateApplyMode, options?: TemplateApplyOptions) => void;
  disabled?: boolean;
  className?: string;
}

export default function AnimationTemplateSelector({
  activeTemplateId,
  onSelect,
  disabled = false,
  className = '',
}: AnimationTemplateSelectorProps) {
  const [useTemplateCamera, setUseTemplateCamera] = useState(loadUseTemplateCameraPref);
  const activeHasCamera = activeTemplateId ? templateHasCamera(activeTemplateId) : false;

  const toggleCameraSource = useCallback(() => {
    setUseTemplateCamera((prev) => {
      const next = !prev;
      saveUseTemplateCameraPref(next);
      return next;
    });
  }, []);

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      onSelect(templateId, 'replace', {
        useTemplateCamera: templateHasCamera(templateId) ? useTemplateCamera : false,
        preserveCameraKeyframes: useTemplateCamera,
      });
    },
    [onSelect, useTemplateCamera]
  );

  return (
    <div
      className={`flex items-center gap-1.5 bg-[#121418]/85 border border-zinc-800 rounded-md px-2 py-1 shadow-md backdrop-blur-sm ${className}`}
    >
      <Clapperboard className="w-3 h-3 text-[#39c5bb] shrink-0" />
      <label className="sr-only" htmlFor="motion-template-select">
        Motion template
      </label>
      <select
        id="motion-template-select"
        value={activeTemplateId ?? ''}
        disabled={disabled}
        onChange={(e) => {
          const id = e.target.value;
          if (id) handleTemplateSelect(id);
        }}
        className="bg-transparent text-[10px] font-bold text-zinc-200 max-w-[180px] truncate cursor-pointer focus:outline-none focus:text-[#39c5bb] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="" className="bg-[#121418] text-zinc-400">
          — Motion template —
        </option>
        {MOTION_TEMPLATE_CATEGORIES.map((category) => {
          const templates = getMotionTemplatesByCategory(category);
          if (templates.length === 0) return null;
          return (
            <optgroup
              key={category}
              label={TEMPLATE_CATEGORY_LABELS[category]}
              className="bg-[#121418]"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id} className="bg-[#121418] text-zinc-100">
                  {tpl.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={toggleCameraSource}
        className={`shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide cursor-pointer transition-colors disabled:opacity-40 ${
          useTemplateCamera
            ? 'border-[#e879ff]/40 text-[#e879ff] bg-[#e879ff]/10'
            : 'border-amber-500/40 text-amber-300 bg-amber-950/30'
        }`}
        title={
          useTemplateCamera
            ? 'Template camera ON — auto path from template'
            : 'My camera (default) — motion only; orbit and place keys yourself'
        }
      >
        {useTemplateCamera ? (
          <Video className="w-2.5 h-2.5" />
        ) : (
          <Camera className="w-2.5 h-2.5" />
        )}
        <span className="hidden md:inline">{useTemplateCamera ? 'Tpl cam' : 'My cam'}</span>
      </button>

      {!useTemplateCamera ? (
        <span className="hidden lg:inline text-[8px] text-amber-400/90 font-semibold max-w-[100px] leading-tight">
          Your camera stays put
        </span>
      ) : activeHasCamera ? (
          <span className="hidden lg:inline text-[8px] text-amber-400/90 font-semibold max-w-[88px] leading-tight">
          MMD path + keys
        </span>
      ) : null}
    </div>
  );
}
