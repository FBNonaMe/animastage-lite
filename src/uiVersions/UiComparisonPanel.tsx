import { Check, X } from 'lucide-react';
import { EDITOR_INTERFACE_REGISTRY, type EditorInterfaceId } from './types';

interface UiComparisonPanelProps {
  current: EditorInterfaceId;
  onSelect: (id: EditorInterfaceId) => void;
  onClose?: () => void;
}

/** Side-by-side UI 1.0 vs UI 3.0 comparison. */
export default function UiComparisonPanel({
  current,
  onSelect,
  onClose,
}: UiComparisonPanelProps) {
  const ui1 = EDITOR_INTERFACE_REGISTRY.find((m) => m.id === 'ui1')!;
  const ui3 = EDITOR_INTERFACE_REGISTRY.find((m) => m.id === 'ui3')!;

  return (
    <div className="studio-ui-compare" role="dialog" aria-label="Interface comparison">
      <header className="studio-ui-compare__header">
        <h2 className="studio-ui-compare__title">Compare interfaces</h2>
        {onClose ? (
          <button type="button" className="studio-ui-compare__close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </header>
      <div className="studio-ui-compare__grid">
        {[ui1, ui3].map((opt) => (
          <div
            key={opt.id}
            className={`studio-ui-compare__col ${current === opt.id ? 'is-current' : ''}`}
          >
            <h3>{opt.label}</h3>
            <p className="studio-ui-compare__desc">{opt.description}</p>
            <p className="studio-ui-compare__section">Advantages</p>
            <ul>
              {opt.advantages.map((a) => (
                <li key={a}>
                  <Check className="w-3 h-3 text-emerald-400" /> {a}
                </li>
              ))}
            </ul>
            <p className="studio-ui-compare__section">Includes</p>
            <ul>
              {opt.features.map((f) => (
                <li key={f}>
                  <Check className="w-3 h-3 text-cyan-400" /> {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="studio-ui-compare__btn"
              disabled={current === opt.id}
              onClick={() => onSelect(opt.id)}
            >
              {current === opt.id ? 'Current' : `Switch to ${opt.shortLabel}`}
            </button>
          </div>
        ))}
      </div>
      <p className="studio-ui-compare__note">
        New features target UI 3.0 first. UI 1.0 stays supported for a lighter workflow.
      </p>
    </div>
  );
}
