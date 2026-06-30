import { type ReactNode } from 'react';
import SeoHead from '../components/SeoHead';
import OfficialProjectBlock from '../landing/OfficialProjectBlock';
import GooglePlayButton from '../landing/GooglePlayButton';
import {
  ANDROID_RELEASE,
  BRAND_TAGLINE,
  LITE_AUTHOR,
  OFFICIAL_PROJECT,
  PRIVACY_POLICY_URL,
  PRO_AUTHOR,
  SEO_LANDING_ROUTES,
  SITE_URL,
} from '../landing/officialProject';
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
} from '../landing/landingSchema';
import {
  Play,
  ChevronRight,
  Upload,
  Video,
  Smartphone,
  Github,
  Shield,
  Sparkles,
  ExternalLink,
  Download,
  Spline,
  Library,
  ScanSearch,
  LayoutGrid,
  Share2,
  RotateCcw,
  Flame,
  Check,
} from 'lucide-react';
import LandingHeroMockup from './landing/LandingHeroMockup';
import FlowDiagram from './landing/FlowDiagram';
import DemoGalleryGrid from './landing/DemoGalleryGrid';
import ConversionBridge from './landing/ConversionBridge';
interface LandingPageProps {
  onStart: () => void;
  onStartDemo: () => void;
  onStartDemoGallery?: () => void;
  onStartDemoId?: (demoId: string) => void;
}

const CORE_FEATURES = [
  { icon: Upload, title: 'Load PMX / PMD + VMD', desc: 'Drop your folder — see your character move in one step.' },
  { icon: Play, title: 'Real-time playback', desc: 'Watch dances instantly — no desktop MMD required.' },
  { icon: Video, title: 'MP4 export', desc: 'Ship Shorts or widescreen video from the same tab.' },
  { icon: Smartphone, title: 'Android app', desc: 'On Google Play — portrait studio on your phone, same PMX/VMD tools as the browser.' },
] as const;

const ADVANCED_FEATURES = [
  { icon: Spline, title: 'Curve Editor', desc: 'Edit motion like pro tools — smooth curves, precise timing.' },
  { icon: Library, title: 'Pose Library', desc: 'Strike a pose in one click — great for thumbnails and streams.' },
  { icon: ScanSearch, title: 'Model Analyzer', desc: 'Catch broken textures and lag before you hit record.' },
  { icon: LayoutGrid, title: 'Demo Gallery', desc: 'Try a full scene instantly — zero files to hunt down.' },
] as const;

const FAQ = [
  {
    q: 'What is MMD online?',
    a: 'Run MikuMikuDance-style workflows in the browser — PMX, VMD, timeline, and export without installing desktop MMD.',
  },
  {
    q: 'Is this a PMX viewer or a full studio?',
    a: 'Both. Preview instantly, then edit with curves, poses, analyzer, and MP4 export — MMD without install.',
  },
  {
    q: 'Are files uploaded to a server?',
    a: 'Core editing is client-side. Your models stay on your device.',
  },
  {
    q: 'Is there an Android app?',
    a: `Yes — v${ANDROID_RELEASE.version} on Google Play (${ANDROID_RELEASE.orientation.toLowerCase()}). Same PMX/VMD studio as the browser. Optional sideload APK on this site for advanced users.`,
  },
] as const;

function PrimaryBtn({ onClick, children, className = '' }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-zinc-950 font-bold text-sm sm:text-base px-6 py-3.5 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children, className = '' }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/30 text-zinc-100 font-semibold text-sm sm:text-base px-6 py-3.5 transition-all cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/90 mb-3">{children}</p>
  );
}

export default function LandingPage({
  onStart,
  onStartDemo,
  onStartDemoGallery,
  onStartDemoId,
}: LandingPageProps) {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const homeJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
    buildSoftwareApplicationSchema(
      SITE_URL,
      'Official AnimaStage Lite — MMD online browser studio with WebGL, WASM physics, PMX/VMD, MP4 export.'
    ),
    buildOrganizationSchema(),
  ];

  return (
    <div className="w-full overflow-x-hidden landing-mesh text-zinc-100 font-sans antialiased">
      <SeoHead
        title="Run MMD in Your Browser — No Install | AnimaStage Lite"
        description="Official AnimaStage Lite — MMD online in your browser. PMX viewer, VMD player, WebGL + WASM physics, MP4 export. Google Play Android app. Free · client-side."
        canonical={SITE_URL}
        keywords="MMD online, MMD Android, MikuMikuDance browser, run MMD on phone, PMX viewer online, WebMMD official"
        ogUrl={SITE_URL}
        jsonLd={homeJsonLd}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 glass-panel-strong">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-violet-500/20 border border-white/10 flex items-center justify-center">
              <Play className="w-4 h-4 text-cyan-300 fill-cyan-300" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              AnimaStage <span className="text-cyan-400 text-sm font-semibold">Lite</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <a href="/roadmap" className="hover:text-cyan-300 text-cyan-400/90 font-semibold transition-colors">
              Full guide
            </a>
            <button type="button" onClick={() => scrollTo('demo')} className="hover:text-white cursor-pointer transition-colors">
              Demo
            </button>
            <button type="button" onClick={() => scrollTo('flow')} className="hover:text-white cursor-pointer transition-colors">
              Flow
            </button>
            <button type="button" onClick={() => scrollTo('features')} className="hover:text-white cursor-pointer transition-colors">
              Features
            </button>
            <button type="button" onClick={() => scrollTo('android')} className="hover:text-white cursor-pointer transition-colors">
              Android
            </button>
            <a href="/about" className="hover:text-white transition-colors">
              About
            </a>
            {SEO_LANDING_ROUTES.map((r) => (
              <a key={r.path} href={r.path} className="hover:text-white transition-colors">
                {r.label}
              </a>
            ))}
            <button type="button" onClick={() => scrollTo('official')} className="hover:text-white cursor-pointer transition-colors">
              Official
            </button>
            <a href="https://github.com/FBNonaMe/animastage-lite" target="_blank" rel="noreferrer" className="hover:text-white inline-flex items-center gap-1 transition-colors">
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0 md:hidden">
            <GooglePlayButton size="compact" className="!text-xs !py-2 !px-3" />
            <PrimaryBtn onClick={onStartDemo} className="!text-sm !py-2 !px-4">
              Try Demo
            </PrimaryBtn>
          </div>
          <div className="hidden md:block">
            <PrimaryBtn onClick={onStartDemo} className="!text-sm !py-2 !px-4">
              Try Demo
            </PrimaryBtn>
          </div>
        </div>
        <p className="text-center text-[10px] text-zinc-600 pb-1.5 px-4 hidden md:block">{BRAND_TAGLINE}</p>
      </header>

      <main>
        {/* §1 Hero */}
        <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="text-center lg:text-left">
                <SectionLabel>MMD online · WebGL + WASM</SectionLabel>

                <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-[3.25rem] leading-[1.05] tracking-tight text-white mb-5">
                  Run MMD in Your Browser — No Install
                </h1>

                <p className="text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-4">
                  Load PMX + VMD, preview animations instantly, and export video — in the browser or on{' '}
                  <a
                    href="/mmd-android"
                    className="text-emerald-400/90 hover:text-emerald-300 font-medium underline-offset-2 hover:underline"
                  >
                    Google Play
                  </a>
                  .
                </p>

                <a
                  href="/roadmap"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400/90 hover:text-cyan-300 mb-8 mx-auto lg:mx-0 transition-colors"
                >
                  New here? Read the full browser &amp; Android guide →
                </a>

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center lg:justify-start mb-5">
                  <PrimaryBtn onClick={onStartDemo}>
                    <Sparkles className="w-4 h-4" />
                    Try Demo — Free
                  </PrimaryBtn>
                  <GhostBtn onClick={onStart}>
                    <Upload className="w-4 h-4 text-cyan-400" />
                    Upload Your Model
                  </GhostBtn>
                  <GooglePlayButton size="compact" />
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  <p className="text-sm text-zinc-300 flex items-center justify-center lg:justify-start gap-2">
                    <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                    Runs locally in your browser — no upload to our servers
                  </p>
                  <p className="text-xs text-cyan-400/90 font-medium flex items-center justify-center lg:justify-start gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 landing-pulse-dot" />
                    Instant animation in ~2 seconds
                  </p>
                </div>
              </div>

              <LandingHeroMockup />
            </div>
          </div>
        </section>

        <OfficialProjectBlock />

        {/* §2 Instant Demo */}
        <section id="demo" className="py-16 md:py-20 scroll-mt-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <SectionLabel>Demo Gallery</SectionLabel>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
                See it in action in seconds
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base mb-1">
                No setup. No files needed. Just click and watch.
              </p>
              <p className="text-cyan-400/90 text-sm font-medium">
                Click any demo → see animation instantly in the studio
              </p>
            </div>

            <DemoGalleryGrid
              onSelectDemo={(id) => (onStartDemoId ? onStartDemoId(id) : onStartDemo())}
            />

            <div className="mt-8 space-y-4">
              <div className="flex flex-wrap justify-center gap-3">
                <PrimaryBtn onClick={onStartDemo}>Try featured demo</PrimaryBtn>
                {onStartDemoGallery && (
                  <GhostBtn onClick={onStartDemoGallery}>Browse all in studio</GhostBtn>
                )}
              </div>

              <div className="glass-panel rounded-xl p-4 sm:p-5 border-amber-500/20 text-center">
                <p className="text-base font-semibold text-zinc-100 mb-3 flex items-center justify-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" aria-hidden />
                  Your turn — try your own model
                </p>
                <GhostBtn onClick={onStart} className="mx-auto">
                  <Upload className="w-4 h-4 text-amber-400" />
                  Upload PMX/VMD
                </GhostBtn>
              </div>
            </div>
          </div>
        </section>

        {/* Conversion bridge — primary funnel */}
        <section className="py-10 md:py-12 px-4 sm:px-6 border-t border-white/5 bg-zinc-950/50">
          <div className="max-w-3xl mx-auto">
            <ConversionBridge onUpload={onStart} variant="prominent" />
          </div>
        </section>

        {/* New to MMD? */}
        <section className="py-12 border-t border-white/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <SectionLabel>New to MMD?</SectionLabel>
            <h2 className="font-display font-bold text-2xl text-white mb-8">Start here — three steps</h2>
            <div className="grid sm:grid-cols-3 gap-4 text-left">
              {[
                { step: '1', title: 'Try demo', desc: 'Pick a scene — motion plays in ~2s', action: onStartDemo, cta: 'Open demo' },
                { step: '2', title: 'Upload model', desc: 'Drop PMX + VMD when you are ready', action: onStart, cta: 'Upload files' },
                { step: '3', title: 'Export video', desc: 'MP4 for Shorts or YouTube', action: onStart, cta: 'Go to studio' },
              ].map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={item.action}
                  className="glass-panel rounded-xl p-5 text-left hover:border-cyan-500/30 transition-colors cursor-pointer group"
                >
                  <span className="text-[10px] font-mono text-cyan-500">STEP {item.step}</span>
                  <p className="font-semibold text-white mt-2 mb-1">{item.title}</p>
                  <p className="text-xs text-zinc-500 mb-3">{item.desc}</p>
                  <span className="text-xs font-bold text-cyan-400 group-hover:text-cyan-300">{item.cta} →</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* §3 User flow */}
        <section id="flow" className="py-16 md:py-20 border-t border-white/5 bg-zinc-950/40 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <SectionLabel>Perfect user flow</SectionLabel>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">
              From idea to video in under a minute
            </h2>
            <p className="text-zinc-500 text-sm mb-10 max-w-lg mx-auto">
              Demo → upload → analyze → edit → preview → export → share
            </p>
            <FlowDiagram />
            <div className="mt-10 max-w-md mx-auto">
              <ConversionBridge onUpload={onStart} variant="compact" />
            </div>
          </div>
        </section>

        {/* §4 Features */}
        <section id="features" className="py-16 md:py-20 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionLabel>Features</SectionLabel>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white">
                Everything for MMD without install
              </h2>
            </div>

            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Core</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {CORE_FEATURES.map((f) => (
                <div key={f.title} className="glass-panel rounded-2xl p-6">
                  <f.icon className="w-6 h-6 text-cyan-400 mb-4" strokeWidth={1.5} />
                  <h4 className="font-semibold text-white mb-1.5">{f.title}</h4>
                  <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-bold text-violet-400/90 uppercase tracking-wider mb-4">Advanced</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ADVANCED_FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="glass-panel rounded-2xl p-6 border-violet-500/10 hover:border-violet-500/25 transition-colors"
                >
                  <f.icon className="w-6 h-6 text-violet-400 mb-4" strokeWidth={1.5} />
                  <h4 className="font-semibold text-white mb-1.5">{f.title}</h4>
                  <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-10">
              <PrimaryBtn onClick={onStartDemo}>Try Demo — Free</PrimaryBtn>
            </div>
          </div>
        </section>

        {/* §5 Why */}
        <section id="why" className="py-16 md:py-20 border-t border-white/5 scroll-mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <SectionLabel>Why we built this</SectionLabel>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white">
                MMD is powerful, but difficult to set up
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-6 border-red-500/10">
                <h3 className="font-semibold text-zinc-300 mb-4">The old way</h3>
                <ul className="space-y-3 text-sm text-zinc-500">
                  <li>· Desktop install and Windows-first tooling</li>
                  <li>· Plugins, paths, and locale before your first frame</li>
                  <li>· No path on Mac, Chromebook, or phone</li>
                </ul>
              </div>
              <div className="glass-panel rounded-2xl p-6 border-cyan-500/20 bg-cyan-950/10">
                <h3 className="font-semibold text-cyan-100 mb-4">Our approach</h3>
                <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                  We made MikuMikuDance workflows run <strong className="text-white">entirely in the browser</strong> —
                  PMX viewer online, VMD player browser, timeline, and Shorts export in one tab.
                </p>
                <PrimaryBtn onClick={onStart} className="!text-sm w-full sm:w-auto">
                  Open Studio
                </PrimaryBtn>
              </div>
            </div>
          </div>
        </section>

        {/* §6 Export & Share */}
        <section id="export" className="py-16 md:py-20 border-t border-white/5 bg-zinc-950/30 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <SectionLabel>Export &amp; share</SectionLabel>
                <h2 className="font-display font-bold text-3xl text-white mb-4">
                  Create and share animations anywhere
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                  Record MP4 from the viewport. Clean frame — no gizmos in the final clip.
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-300 bg-violet-500/15 border border-violet-500/30 rounded-full px-3 py-1 mb-6">
                  Perfect for Shorts / Reels
                </span>
                <ul className="space-y-2 text-sm text-zinc-500 mb-6">
                  <li className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-cyan-400" />
                    16:9 landscape or 9:16 vertical (1080×1920)
                  </li>
                  <li className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-violet-400" />
                    Download and post from your phone or PC
                  </li>
                </ul>
                <GhostBtn onClick={onStart}>
                  Export from studio
                  <ChevronRight className="w-4 h-4" />
                </GhostBtn>
              </div>

              <div className="flex gap-4 justify-center lg:justify-end items-end">
                <div className="glass-panel rounded-2xl p-4 w-40 sm:w-48 aspect-video flex flex-col items-center justify-center opacity-80">
                  <span className="text-[10px] font-mono text-zinc-500 mb-2">16:9</span>
                  <Video className="w-9 h-9 text-cyan-400/50" />
                  <span className="text-xs text-zinc-500 mt-2">YouTube</span>
                </div>
                <div className="relative glass-panel rounded-2xl w-[120px] sm:w-[132px] aspect-[9/16] border-violet-500/40 shadow-lg shadow-violet-950/50 overflow-hidden">
                  <div className="absolute top-2 left-2 right-2 z-10 flex justify-between items-start">
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-500 text-white">
                      9:16
                    </span>
                  </div>
                  <img
                    src="./demos/thumbs/party-dance.svg"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
                    <Smartphone className="w-6 h-6 text-white mx-auto mb-1 opacity-90" />
                    <p className="text-[10px] font-semibold text-white">TikTok · Reels</p>
                    <p className="text-[9px] text-violet-200 mt-0.5">Vertical MP4</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* §7 Growth loop */}
        <section className="py-16 md:py-20 border-t border-white/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <SectionLabel>Growth loop</SectionLabel>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
              Create → Export → Share → Repeat
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8 max-w-lg mx-auto">
              Make a clip, post it, send friends to AnimaStage Lite. Optional end-card watermark helps others discover
              MMD online — your dance, your model, one link to try it themselves.
            </p>
            <div className="grid sm:grid-cols-4 gap-3 text-left mb-8">
              {[
                { icon: Sparkles, title: 'Create', desc: 'Demo or your PMX' },
                { icon: Video, title: 'Export', desc: 'MP4 in one tab' },
                { icon: Share2, title: 'Share', desc: 'Shorts, Discord, X' },
                { icon: RotateCcw, title: 'Repeat', desc: 'Back to studio' },
              ].map((item) => (
                <div key={item.title} className="glass-panel rounded-xl p-4 text-center sm:text-left">
                  <item.icon className="w-5 h-5 text-cyan-400 mb-2 mx-auto sm:mx-0" />
                  <p className="font-semibold text-sm text-white">{item.title}</p>
                  <p className="text-xs text-zinc-500 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 glass-panel inline-block rounded-lg px-4 py-2 border border-white/5">
              Tip: mention <strong className="text-zinc-400">animastage-lite.app</strong> in your description — optional
              &quot;Made with AnimaStage Lite&quot; watermark coming to export settings.
            </p>
          </div>
        </section>

        {/* § Android download */}
        <section id="android" className="py-16 md:py-20 border-t border-white/5 bg-emerald-950/10 scroll-mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <SectionLabel>Android app</SectionLabel>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
                Full MMD Studio on your phone
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto">
                Install from{' '}
                <strong className="text-zinc-200 font-semibold">Google Play</strong> — the same
                editor as animastage-lite.app, packaged for portrait WebView.{' '}
                <a href="/roadmap" className="text-emerald-400 hover:text-emerald-300 font-semibold">
                  Full tutorial (browser + Android) →
                </a>
                {' · '}
                <a href="/mmd-android" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                  MMD Android page →
                </a>
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 sm:p-8 border-emerald-500/25 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1">
                      <Smartphone className="w-3.5 h-3.5" />
                      Latest release
                    </span>
                    <span className="text-xs font-mono text-zinc-400">
                      v{ANDROID_RELEASE.version} (build {ANDROID_RELEASE.versionCode})
                    </span>
                    <span className="text-xs text-zinc-600 hidden sm:inline">·</span>
                    <span className="text-xs text-zinc-500">{ANDROID_RELEASE.buildLabel}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      'Google Play',
                      ANDROID_RELEASE.minAndroid,
                      ANDROID_RELEASE.orientation,
                    ].map((chip) => (
                      <span
                        key={chip}
                        className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-900/80 border border-white/5 rounded-md px-2 py-1"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                  <h3 className="font-display font-bold text-xl text-white mb-2">
                    AnimaStage Lite — portrait studio
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                    Available on Google Play. Opens directly into the editor: PMX/PMD/VMD import, timeline,
                    Camera Studio, and MP4 export — 100% client-side.
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                  <GooglePlayButton />
                  <a
                    href="/mmd-android"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-200/90 font-semibold text-xs px-4 py-2.5 transition-all"
                  >
                    MMD Android guide
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/15 bg-emerald-950/20 p-4 sm:p-5 mb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300/90 mb-3">
                  What&apos;s new in v{ANDROID_RELEASE.version}
                </p>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {ANDROID_RELEASE.whatsNew.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <ul className="grid sm:grid-cols-2 gap-2 mb-6">
                {ANDROID_RELEASE.highlights.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>

              <div className="rounded-xl border border-white/5 bg-zinc-950/50 p-4 sm:p-5 mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Requirements</p>
                <ul className="space-y-2 text-sm text-zinc-400">
                  {ANDROID_RELEASE.requirements.map((req) => (
                    <li key={req} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" aria-hidden />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-white/5 bg-zinc-950/50 p-4 sm:p-5 mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Install from Google Play</p>
                <ol className="space-y-2 text-sm text-zinc-400 list-decimal list-inside">
                  {ANDROID_RELEASE.installSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>

              <details className="rounded-xl border border-white/5 bg-zinc-950/50 p-4 sm:p-5">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Optional sideload APK
                </summary>
                <p className="text-[11px] text-zinc-500 mt-3 mb-2 break-all">
                  File: <code className="text-zinc-400">{ANDROID_RELEASE.downloadName}</code>
                  {' · '}
                  <a href={ANDROID_RELEASE.url} download={ANDROID_RELEASE.downloadName} className="text-emerald-400/90 hover:text-emerald-300">
                    {ANDROID_RELEASE.directUrl}
                  </a>
                </p>
                <ol className="space-y-2 text-sm text-zinc-500 list-decimal list-inside">
                  {ANDROID_RELEASE.sideloadInstallSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </details>
            </div>

            <p className="text-center text-xs text-zinc-500">
              Prefer the browser?{' '}
              <button type="button" onClick={onStart} className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer">
                Open Studio in Chrome
              </button>
              {' '}— no install needed.
            </p>
          </div>
        </section>

        {/* FAQ compact */}
        <section id="faq" className="py-12 border-t border-white/5 scroll-mt-16">
          <div className="max-w-xl mx-auto px-4 sm:px-6 space-y-3">
            <h2 className="font-display font-bold text-xl text-center text-white mb-6">FAQ</h2>
            {FAQ.map((item) => (
              <details key={item.q} className="glass-panel rounded-lg open:border-cyan-500/20">
                <summary className="p-4 cursor-pointer text-sm font-medium text-zinc-200 list-none flex justify-between">
                  {item.q}
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </summary>
                <p className="px-4 pb-4 text-sm text-zinc-500">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* §8 Final CTA */}
        <section className="py-20 md:py-28 border-t border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-violet-500/10 pointer-events-none" />
          <div className="max-w-2xl mx-auto px-4 text-center relative">
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-4">
              Start creating in seconds — no install required
            </h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Try a demo in ~2 seconds, or upload PMX/VMD when you are ready. Free in the browser.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <PrimaryBtn onClick={onStartDemo}>
                <Sparkles className="w-4 h-4" />
                Try Demo
              </PrimaryBtn>
              <GhostBtn onClick={onStart}>
                Open Studio
                <ChevronRight className="w-5 h-5" />
              </GhostBtn>
            </div>
            <GooglePlayButton className="mt-8" />
            <p className="mt-2 text-xs text-zinc-600">
              <button type="button" onClick={() => scrollTo('android')} className="hover:text-zinc-400 cursor-pointer">
                Install guide &amp; sideload APK
              </button>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-600">
        <p className="text-zinc-400 font-semibold mb-2">{BRAND_TAGLINE}</p>
        <p className="text-[11px] text-zinc-600 mb-4 max-w-md mx-auto">{OFFICIAL_PROJECT.statement}</p>
        <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1 mb-3" aria-label="Footer">
          <a href="/roadmap" className="text-cyan-400/90 hover:text-cyan-300 font-semibold">
            Full guide
          </a>
          <a href="/about" className="text-zinc-400 hover:text-cyan-400">
            About
          </a>
          {SEO_LANDING_ROUTES.map((r) => (
            <a key={r.path} href={r.path} className="text-zinc-400 hover:text-cyan-400">
              {r.label}
            </a>
          ))}
          <a href="/mmd-android" className="text-zinc-400 hover:text-emerald-400">
            Google Play
          </a>
          <a href={PRIVACY_POLICY_URL} className="text-zinc-400 hover:text-cyan-400">
            Privacy
          </a>
          <a href={OFFICIAL_PROJECT.liteRepo} className="text-zinc-400 hover:text-cyan-400">
            Lite GitHub
          </a>
          <a href={OFFICIAL_PROJECT.proRepo} className="text-zinc-400 hover:text-violet-300">
            Pro GitHub
          </a>
          <a href={OFFICIAL_PROJECT.proSite} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-cyan-400">
            Pro <ExternalLink className="w-3 h-3 inline" />
          </a>
        </nav>
        <p className="text-[10px] text-zinc-600">
          Lite · {LITE_AUTHOR.name} · Pro · {PRO_AUTHOR.name} · {OFFICIAL_PROJECT.siteUrl}
        </p>
      </footer>
    </div>
  );
}
