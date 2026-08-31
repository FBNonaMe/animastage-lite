import { useState } from 'react';
import { Check, Monitor, Sparkles, Zap } from 'lucide-react';
import {
  EDITOR_INTERFACE_REGISTRY,
  type EditorInterfaceId,
} from './types';
import { markEditorInterfaceChosen, saveEditorInterface } from './storage';

interface InterfaceSelectionScreenProps {
  onSelect: (id: EditorInterfaceId) => void;
  /** Optional: show as overlay later (Settings → Compare) */
  embedded?: boolean;
  onClose?: () => void;
}

/**
 * First-run interface selection — UI 1.0 vs UI 3.0 with overview cards.
 */
export default function InterfaceSelectionScreen({
  onSelect,
  embedded = false,
  onClose,
}: InterfaceSelectionScreenProps) {
  const [hover, setHover] = useState<EditorInterfaceId | null>(null);

  const pick = (id: EditorInterfaceId) => {
    saveEditorInterface(id);
    markEditorInterfaceChosen();
    onSelect(id);
  };

  return (
    <div
      className={`studio-iface-select ${embedded ? 'studio-iface-select--embedded' : ''}`}
      role="dialog"
      aria-labelledby="iface-select-title"
    >
      <div className="studio-iface-select__card">
        <header className="studio-iface-select__header">
          <p className="studio-iface-select__eyebrow">AnimaStage Lite</p>
          <h1 id="iface-select-title" className="studio-iface-select__title">
            Choose your interface
          </h1>
          <p className="studio-iface-select__sub">
            You can switch anytime in Settings. New features ship primarily for UI 3.0.
          </p>
        </header>

        <div className="studio-iface-select__grid">
          {EDITOR_INTERFACE_REGISTRY.map((opt) => {
            const Icon = opt.id === 'ui3' ? Sparkles : Zap;
            const active = hover === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`studio-iface-select__option ${
                  opt.recommended ? 'studio-iface-select__option--rec' : ''
                } ${active ? 'is-active' : ''}`}
                onMouseEnter={() => setHover(opt.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(opt.id)}
                onClick={() => pick(opt.id)}
              >
                {opt.recommended ? (
                  <span className="studio-iface-select__badge">Recommended</span>
                ) : null}
                <div className="studio-iface-select__preview" aria-hidden>
                  <Monitor className="w-8 h-8 opacity-40" />
                  <span className="studio-iface-select__preview-label">{opt.shortLabel}</span>
                  <div className={`studio-iface-select__mock studio-iface-select__mock--${opt.id}`}>
                    <div className="mock-bar" />
                    <div className="mock-body">
                      {opt.id === 'ui3' ? (
                        <>
                          <div className="mock-rail" />
                          <div className="mock-vp" />
                          <div className="mock-dock" />
                        </>
                      ) : (
                        <>
                          <div className="mock-side" />
                          <div className="mock-vp" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="studio-iface-select__meta">
                  <Icon className="w-4 h-4 text-cyan-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="studio-iface-select__name">{opt.label}</p>
                    <p className="studio-iface-select__level">
                      {opt.level === 'pro' ? 'Professional' : 'Beginner-friendly'}
                    </p>
                  </div>
                </div>
                <p className="studio-iface-select__desc">{opt.description}</p>
                <ul className="studio-iface-select__list">
                  {opt.advantages.map((a) => (
                    <li key={a}>
                      <Check className="w-3 h-3 shrink-0 text-emerald-400" />
                      {a}
                    </li>
                  ))}
                </ul>
                <span className="studio-iface-select__cta">
                  {opt.id === 'ui3' ? 'Start with Studio' : 'Start with Classic'}
                </span>
              </button>
            );
          })}
        </div>

        {embedded && onClose ? (
          <button type="button" className="studio-iface-select__skip" onClick={onClose}>
            Close
          </button>
        ) : (
          <p className="studio-iface-select__foot">
            Tip: UI 3.0 keeps the same engine — only the workspace chrome changes.
          </p>
        )}
      </div>
    </div>
  );
}
