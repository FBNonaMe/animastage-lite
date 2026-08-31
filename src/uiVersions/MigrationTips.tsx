import { useEffect, useState } from 'react';
import { ChevronRight, Sparkles, X } from 'lucide-react';
import { areMigrationTipsDismissed, dismissMigrationTips, hasSeenUi3Tour, markUi3TourSeen } from './storage';
import type { EditorInterfaceId } from './types';

const TIPS = [
  {
    title: 'Dockable studios',
    body: 'Open Camera, Lighting, Cinematic Render and more from the left rail — same engine as Classic.',
  },
  {
    title: 'Camera Studio',
    body: 'Cinematic templates, Smooth Camera and reference matching live under Camera Studio.',
  },
  {
    title: 'Cinema Render',
    body: 'Offline high-quality export with settle frames — open from Cinematic Render dock.',
  },
  {
    title: 'Adaptive layout',
    body: 'On phones and tablets, panels become drawers and sheets so the viewport stays large.',
  },
];

interface MigrationTipsProps {
  editorInterface: EditorInterfaceId;
  onOpenComparison?: () => void;
  onSwitchToUi3?: () => void;
}

/**
 * Non-blocking migration strip — never interrupts the viewport workflow.
 */
export default function MigrationTips({
  editorInterface,
  onOpenComparison,
  onSwitchToUi3,
}: MigrationTipsProps) {
  const [open, setOpen] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (areMigrationTipsDismissed()) return;
    if (editorInterface === 'ui3' && hasSeenUi3Tour()) return;
    const t = window.setTimeout(() => setOpen(true), 1800);
    return () => window.clearTimeout(t);
  }, [editorInterface]);

  if (!open) return null;

  const tip = TIPS[tipIndex % TIPS.length];

  return (
    <aside className="studio-migration-tips" aria-live="polite">
      <Sparkles className="w-4 h-4 text-violet-300 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="studio-migration-tips__title">
          {editorInterface === 'ui3' ? 'UI 3.0 tip' : 'Try UI 3.0 Studio'}
        </p>
        <p className="studio-migration-tips__body">
          <strong>{tip.title}.</strong> {tip.body}
        </p>
        <div className="studio-migration-tips__actions">
          {editorInterface !== 'ui3' && onSwitchToUi3 ? (
            <button type="button" onClick={onSwitchToUi3}>
              Switch to UI 3.0
            </button>
          ) : null}
          {onOpenComparison ? (
            <button type="button" onClick={onOpenComparison}>
              Compare
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setTipIndex((i) => i + 1)}
            className="inline-flex items-center gap-0.5"
          >
            Next <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      <button
        type="button"
        className="studio-migration-tips__dismiss"
        aria-label="Dismiss tips"
        onClick={() => {
          dismissMigrationTips();
          if (editorInterface === 'ui3') markUi3TourSeen();
          setOpen(false);
        }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </aside>
  );
}
