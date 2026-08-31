/**
 * Landing scroll chrome — progress bar + “scroll” cue for Codrops long-form.
 */
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface LandingScrollProgressProps {
  /** First in-page section id for the scroll cue */
  nextSectionId?: string;
}

export default function LandingScrollProgress({
  nextSectionId = 'whats-new',
}: LandingScrollProgressProps) {
  const [progress, setProgress] = useState(0);
  const [showCue, setShowCue] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? el.scrollTop / max : 0;
      setProgress(Math.min(1, Math.max(0, p)));
      setShowCue(el.scrollTop < 80);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollNext = () => {
    document.getElementById(nextSectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <div
        className="landing-scroll-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Page scroll progress"
      >
        <div className="landing-scroll-progress__bar" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {showCue ? (
        <button
          type="button"
          onClick={scrollNext}
          className="landing-scroll-cue"
          aria-label="Scroll to explore"
        >
          <span className="landing-scroll-cue__label">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" aria-hidden />
        </button>
      ) : null}
    </>
  );
}
