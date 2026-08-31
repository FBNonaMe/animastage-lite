import { Play, Rocket, X } from 'lucide-react';
import { Button } from '../UI';

interface ViewportEmptyStateProps {
  onTryDemo?: () => void;
  onCreateFirstVideo?: () => void;
  onDismiss?: () => void;
}

/** Centered empty state — compact on mobile, dismissable. */
export default function ViewportEmptyState({
  onTryDemo,
  onCreateFirstVideo,
  onDismiss,
}: ViewportEmptyStateProps) {
  return (
    <div className="viewport-empty-overlay absolute inset-0 z-20 flex items-end sm:items-center justify-center pointer-events-none p-3 sm:p-[var(--space-xl)] pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-[var(--space-xl)]">
      <div className="viewport-empty-card pointer-events-auto relative max-w-sm w-full text-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-panel)_88%,transparent)] backdrop-blur-md shadow-lg">
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-2 right-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] active:bg-[var(--color-panel-raised)] cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
        <div className="p-[var(--space-md)] sm:p-[var(--space-lg)]">
          <h2 className="text-[var(--font-size-md)] sm:text-[var(--font-size-lg)] font-semibold text-[var(--color-text-main)] m-0 mb-1">
            Create your first video
          </h2>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)] m-0 mb-[var(--space-md)] leading-snug">
            Guided in 4 steps — character, motion, style, export.
          </p>
          {onCreateFirstVideo ? (
            <Button
              type="button"
              variant="primary"
              className="viewport-empty-card__cta w-full min-h-[52px] text-sm font-bold mb-2"
              onClick={onCreateFirstVideo}
            >
              <Rocket className="w-5 h-5" />
              Create My First Video
            </Button>
          ) : null}
          {onTryDemo ? (
            <Button
              type="button"
              variant="secondary"
              className="viewport-empty-card__cta w-full min-h-[44px] text-sm font-semibold"
              onClick={onTryDemo}
            >
              <Play className="w-4 h-4 fill-current" />
              Play demo
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
