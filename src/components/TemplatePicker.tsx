import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clapperboard, Camera as CameraIcon, User, Sparkles, ChevronDown, Zap, Music2 } from 'lucide-react';
import type { TemplateApplyMode, TemplateApplyOptions } from '../types';
import {
  ANIMATION_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  DANCE_PICKER_CATEGORIES,
  templateHasCamera,
  type AnimationTemplateCategory,
} from '../templates/animationTemplates';

const CAMERA_PREF_KEY = 'as_template_use_camera';

function loadUseTemplateCameraPref(): boolean {
  try {
    return localStorage.getItem(CAMERA_PREF_KEY) === 'template';
  } catch {
    return false;
  }
}

interface TemplatePickerProps {
  onApplyTemplate: (
    templateId: string,
    mode?: TemplateApplyMode,
    options?: TemplateApplyOptions
  ) => void;
  hasModel: boolean;
  hasVmdActive?: boolean;
  compact?: boolean;
  categories?: AnimationTemplateCategory[];
  label?: string;
  title?: string;
  variant?: 'dance' | 'default';
  applyMode?: TemplateApplyMode;
  /** Where to open the menu — `auto` picks below if clipped above (timeline panel) */
  placement?: 'above' | 'below' | 'auto';
}

const CATEGORY_ICONS: Record<AnimationTemplateCategory, React.ReactNode> = {
  camera: <CameraIcon className="w-3.5 h-3.5" />,
  character: <User className="w-3.5 h-3.5" />,
  combo: <Sparkles className="w-3.5 h-3.5" />,
  emote: <Zap className="w-3.5 h-3.5" />,
  dance: <Music2 className="w-3.5 h-3.5" />,
};

const DEFAULT_CATEGORIES: AnimationTemplateCategory[] = ['character'];
const MENU_EST_HEIGHT = 300;

function templateNeedsModel(category: AnimationTemplateCategory, hasModelKeys: boolean): boolean {
  return (
    category === 'character' ||
    category === 'dance' ||
    category === 'emote' ||
    (category === 'combo' && hasModelKeys)
  );
}

function isDanceHubCategories(categories: AnimationTemplateCategory[]): boolean {
  return (
    categories.length === DANCE_PICKER_CATEGORIES.length &&
    DANCE_PICKER_CATEGORIES.every((c) => categories.includes(c))
  );
}

export default function TemplatePicker({
  onApplyTemplate,
  hasModel,
  hasVmdActive = false,
  compact = false,
  categories,
  label,
  title,
  variant = 'default',
  applyMode = 'merge',
  placement = 'auto',
}: TemplatePickerProps) {
  const visibleCategories = categories ?? DEFAULT_CATEGORIES;
  const isDanceHub =
    variant === 'dance' ||
    isDanceHubCategories(visibleCategories) ||
    visibleCategories.some((c) => c === 'dance' || c === 'camera' || c === 'combo' || c === 'emote');
  const [open, setOpen] = useState(false);
  const [openBelow, setOpenBelow] = useState(true);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [category, setCategory] = useState<AnimationTemplateCategory>(visibleCategories[0]);
  const [useTemplateCamera, setUseTemplateCamera] = useState(loadUseTemplateCameraPref);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonLabel = label ?? (isDanceHub ? 'Dance' : 'Templates');
  const buttonTitle =
    title ??
    (isDanceHub
      ? 'Body dance, camera paths, combos & bloom emotes'
      : 'Character expressions and gestures');

  useEffect(() => {
    if (!visibleCategories.includes(category)) {
      setCategory(visibleCategories[0]);
    }
  }, [category, visibleCategories]);

  const updateMenuPosition = () => {
    const anchor = rootRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const below =
      placement === 'below'
        ? true
        : placement === 'above'
          ? false
          : spaceBelow >= MENU_EST_HEIGHT || spaceBelow >= spaceAbove;

    setOpenBelow(below);
    setMenuPos({
      top: below ? rect.bottom + 4 : rect.top - 4,
      left: Math.min(rect.right, window.innerWidth - 8),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, placement]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const templates = ANIMATION_TEMPLATES.filter(
    (t) => visibleCategories.includes(t.category) && t.category === category
  );

  const handleSelect = (templateId: string, needsModel: boolean) => {
    if (needsModel && !hasModel) return;
    onApplyTemplate(templateId, applyMode, {
      useTemplateCamera: templateHasCamera(templateId) ? useTemplateCamera : false,
    });
    setOpen(false);
  };

  const categoryHasCameraTemplates = templates.some((t) => templateHasCamera(t.id));

  const accentClass = isDanceHub
    ? 'text-teal-200 bg-teal-950/40 border-teal-500/40 hover:bg-teal-950/60'
    : 'text-violet-200 bg-violet-950/40 border-violet-500/40 hover:bg-violet-950/60';

  const accentIconClass = isDanceHub ? 'text-[#39c5bb]' : 'text-[#e879ff]';
  const accentTextClass = isDanceHub ? 'text-[#39c5bb]' : 'text-[#e879ff]';
  const tabActiveClass = isDanceHub
    ? 'bg-teal-950/50 text-[#39c5bb] border-b-2 border-[#39c5bb]'
    : 'bg-[#e879ff]/15 text-[#e879ff] border-b-2 border-[#e879ff]';
  const itemHoverClass = isDanceHub
    ? 'hover:bg-teal-950/40 hover:border-teal-500/30'
    : 'hover:bg-[#e879ff]/10 hover:border-[#e879ff]/20';

  const menuPanel = open ? (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[200] w-80 max-w-[calc(100vw-16px)] bg-[#121418] border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
      style={{
        top: menuPos.top,
        left: menuPos.left,
        transform: openBelow ? 'translateX(-100%)' : 'translate(-100%, -100%)',
      }}
    >
      <div className="px-3 py-2 border-b border-zinc-800 bg-[#1a1d24]">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${accentTextClass}`}>
          {isDanceHub ? 'Dance Studio' : 'Character Templates'}
        </span>
      </div>

      {visibleCategories.length > 1 && (
        <div className="flex flex-wrap border-b border-zinc-800">
          {visibleCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`flex-1 min-w-[20%] flex items-center justify-center gap-0.5 py-2 px-1 text-[8px] font-bold uppercase cursor-pointer transition-colors ${
                category === cat
                  ? tabActiveClass
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {CATEGORY_ICONS[cat]}
              <span className="truncate">{TEMPLATE_CATEGORY_LABELS[cat]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
        {templates.map((tpl) => {
          const needsModel = templateNeedsModel(
            tpl.category,
            Boolean(tpl.generateModelKeyframes)
          );
          const disabled = needsModel && !hasModel;

          return (
            <button
              key={tpl.id}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(tpl.id, needsModel)}
              className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${
                disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : `cursor-pointer border border-transparent ${itemHoverClass}`
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-zinc-100">{tpl.name}</span>
                {tpl.visualFx?.bloom && (
                  <span className="text-[8px] font-bold text-[#e879ff] bg-[#e879ff]/10 px-1.5 py-0.5 rounded shrink-0">
                    BLOOM
                  </span>
                )}
              </div>
              <div className="text-[9px] text-zinc-500 leading-snug mt-0.5">{tpl.description}</div>
              {disabled && (
                <div className="text-[8px] text-amber-500/90 mt-1 font-bold">Load a model first</div>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-zinc-800 text-[8px] text-zinc-500 space-y-1.5">
        {categoryHasCameraTemplates ? (
          <button
            type="button"
            onClick={() => {
              setUseTemplateCamera((v) => {
                const next = !v;
                try {
                  localStorage.setItem(CAMERA_PREF_KEY, next ? 'template' : 'manual');
                } catch {
                  /* ignore */
                }
                return next;
              });
            }}
            className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded border cursor-pointer text-[9px] font-bold ${
              useTemplateCamera
                ? 'border-[#e879ff]/30 text-[#e879ff] bg-[#e879ff]/5'
                : 'border-amber-500/30 text-amber-300 bg-amber-950/20'
            }`}
          >
            <span>{useTemplateCamera ? 'Template camera' : 'My camera (manual fly)'}</span>
            <span className="opacity-70">{useTemplateCamera ? 'auto path' : 'motion only'}</span>
          </button>
        ) : null}
        {applyMode === 'merge'
          ? 'Add layer: stacks with existing body / camera keys'
          : 'Replace: overwrites keys from this template only'}
        {isDanceHub && applyMode === 'merge' && ' · try + Body then + Camera'}
        {hasVmdActive && (
          <div className="text-amber-400/90 font-bold">
            Body templates auto-disable imported VMD to avoid conflicts.
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`cursor-pointer font-bold border rounded flex items-center gap-1.5 transition-all ${accentClass} ${
          compact ? 'text-[10px] px-2.5 py-1.5' : 'text-xs px-3 py-1.5'
        }`}
        title={buttonTitle}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {isDanceHub ? (
          <Music2 className={`w-3.5 h-3.5 ${accentIconClass}`} />
        ) : (
          <Clapperboard className={`w-3.5 h-3.5 ${accentIconClass}`} />
        )}
        {buttonLabel}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {typeof document !== 'undefined' && menuPanel
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
}
