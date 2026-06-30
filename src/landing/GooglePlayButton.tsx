import { ExternalLink } from 'lucide-react';
import { getGooglePlayUrl } from './androidRelease';

type GooglePlayButtonProps = {
  className?: string;
  /** full = hero CTA, compact = inline */
  size?: 'full' | 'compact';
};

export default function GooglePlayButton({ className = '', size = 'full' }: GooglePlayButtonProps) {
  const base =
    size === 'full'
      ? 'inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-zinc-950 font-bold text-sm sm:text-base px-6 py-3.5 shadow-lg shadow-emerald-500/25 transition-all'
      : 'inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 font-bold text-sm px-5 py-3 transition-all';

  return (
    <a
      href={getGooglePlayUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${className}`}
    >
      <svg
        className={size === 'full' ? 'w-5 h-5 shrink-0' : 'w-4 h-4 shrink-0'}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M3.609 1.814L13.792 12 3.61 22.186a1.003 1.003 0 0 1-.601-.92V2.734a1 1 0 0 1 .601-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.302 2.302-8.636-8.634z" />
      </svg>
      Get it on Google Play
      <ExternalLink className={size === 'full' ? 'w-4 h-4 opacity-70' : 'w-3.5 h-3.5 opacity-70'} aria-hidden />
    </a>
  );
}
