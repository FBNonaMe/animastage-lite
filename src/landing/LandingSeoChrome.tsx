import { type ReactNode } from 'react';
import { Play } from 'lucide-react';
import { BRAND_TAGLINE, LITE_AUTHOR, OFFICIAL_PROJECT, PRIVACY_POLICY_URL, PRO_AUTHOR, SEO_LANDING_ROUTES } from './officialProject';

interface LandingSeoChromeProps {
  children: ReactNode;
  /** Highlight current path in footer nav */
  activePath?: string;
  compactNav?: boolean;
}

export function LandingSeoHeader({ compactNav = false }: { compactNav?: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 glass-panel-strong">
      <div className={`mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3 ${compactNav ? 'max-w-4xl' : 'max-w-6xl'}`}>
        <a href="/" className="flex items-center gap-2 shrink-0" title={BRAND_TAGLINE}>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-violet-500/20 border border-white/10 flex items-center justify-center">
            <Play className="w-4 h-4 text-cyan-300 fill-cyan-300" />
          </div>
          <span className="font-display font-bold text-sm sm:text-lg tracking-tight">
            AnimaStage <span className="text-cyan-400 text-xs sm:text-sm font-semibold">Lite</span>
          </span>
        </a>
        <nav className="hidden sm:flex items-center gap-4 text-xs text-zinc-400" aria-label="Site">
          <a href="/roadmap" className="hover:text-white transition-colors font-semibold text-cyan-400/80">
            Full guide
          </a>
          <a href="/about" className="hover:text-white transition-colors">
            About
          </a>
          {SEO_LANDING_ROUTES.map((r) => (
            <a key={r.path} href={r.path} className="hover:text-white transition-colors">
              {r.label}
            </a>
          ))}
          <a href="/app" className="hover:text-cyan-300 text-cyan-400/90 font-semibold transition-colors">
            Studio
          </a>
        </nav>
      </div>
      <p className="text-center text-[10px] text-zinc-600 pb-1.5 px-4 hidden sm:block">{BRAND_TAGLINE}</p>
    </header>
  );
}

export function LandingSeoFooter({ activePath }: { activePath?: string }) {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-xs font-semibold text-zinc-400 mb-3">{BRAND_TAGLINE}</p>
        <p className="text-[11px] text-zinc-600 mb-4 max-w-lg mx-auto">{OFFICIAL_PROJECT.statement}</p>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-zinc-500" aria-label="Footer">
          <a href="/" className={activePath === '/' ? 'text-cyan-400' : 'hover:text-zinc-300'}>
            Home
          </a>
          <a href="/roadmap" className={activePath === '/roadmap' ? 'text-cyan-400' : 'hover:text-zinc-300'}>
            Full guide
          </a>
          <a href="/about" className={activePath === '/about' ? 'text-cyan-400' : 'hover:text-zinc-300'}>
            About
          </a>
          {SEO_LANDING_ROUTES.map((r) => (
            <a
              key={r.path}
              href={r.path}
              className={activePath === r.path ? 'text-cyan-400' : 'hover:text-zinc-300'}
            >
              {r.label}
            </a>
          ))}
          <a href={PRIVACY_POLICY_URL} className="hover:text-zinc-300">
            Privacy
          </a>
          <a href={OFFICIAL_PROJECT.liteRepo} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
            Lite GitHub
          </a>
          <a href={OFFICIAL_PROJECT.proRepo} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
            Pro GitHub
          </a>
        </nav>
        <p className="mt-4 text-[10px] text-zinc-600">
          Lite · {LITE_AUTHOR.name} · Pro · {PRO_AUTHOR.name} · {OFFICIAL_PROJECT.siteUrl}
        </p>
      </div>
    </footer>
  );
}

export default function LandingSeoChrome({ children, activePath, compactNav }: LandingSeoChromeProps) {
  return (
    <div className="w-full overflow-x-hidden landing-mesh text-zinc-100 font-sans antialiased min-h-dvh flex flex-col">
      <LandingSeoHeader compactNav={compactNav} />
      <div className="flex-1">{children}</div>
      <LandingSeoFooter activePath={activePath} />
    </div>
  );
}
