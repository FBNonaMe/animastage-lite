import { type ReactNode, useEffect, useState } from 'react';
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
  Share2,
  RotateCcw,
  Flame,
  Check,
  Clapperboard,
  Monitor,
  CloudSun,
  LayoutDashboard,
  Sun,
  Film,
  Bookmark,
} from 'lucide-react';
import LandingHeroMockup from './landing/LandingHeroMockup';
import FlowDiagram from './landing/FlowDiagram';
import DemoGalleryGrid from './landing/DemoGalleryGrid';
import ConversionBridge from './landing/ConversionBridge';
import WhatsNewSection from './landing/WhatsNewSection';
import LandingScrollProgress from './landing/LandingScrollProgress';

interface LandingPageProps {
  onStart: () => void;
  onStartDemo: () => void;
  onStartCreator?: () => void;
  onStartDemoGallery?: () => void;
  onStartDemoId?: (demoId: string) => void;
}

/** Features shipping on both browser and Android. */
const SHARED_PLATFORM = [
  {
    icon: Upload,
    title: 'PMX / PMD / VMD',
    desc: 'Load characters and motion — folder, ZIP, or drag & drop.',
  },
  {
    icon: LayoutDashboard,
    title: 'UI 3.0 Studio',
    desc: 'Redesigned shell — Scene Studio, FX inspector, multi-tab timeline.',
  },
  {
    icon: Sun,
    title: 'Scene Studio 2.0',
    desc: 'Mood presets, time of day, weather, and stackable scene FX.',
  },
  {
    icon: Film,
    title: 'Cinematic FX',
    desc: 'HDR bloom, color grade, SSR, vignette, and lens dispersion.',
  },
  {
    icon: Clapperboard,
    title: 'Director Workflow',
    desc: 'Cast, clips, music sync, effect timeline with keyframes.',
  },
  {
    icon: Bookmark,
    title: 'Smart Pose',
    desc: 'IK-style pose presets merged into the Pose Library.',
  },
  {
    icon: CloudSun,
    title: 'Dynamic Sky',
    desc: '24h environment — time of day, weather, Environment Studio.',
  },
  {
    icon: Video,
    title: 'MP4 export',
    desc: 'Shorts 1080×1920 or widescreen — same pipeline on phone.',
  },
] as const;

const FAQ = [
  {
    q: 'Is this a demo or a full studio?',
    a: 'Full studio. Open Studio on the web or install the Android app — import models, edit motion/FX/camera, run mocap, bake physics-aware looks, and export MP4. Sample scenes are optional starter packs, not the product limit.',
  },
  {
    q: 'What is new in v1.4?',
    a: 'UI 3.0 Studio with Scene Studio 2.0, Cinematic FX (HDR bloom, grade, SSR, vignette, lens), Anime NPR, Path Tracer Lab with OIDN denoise, Director Workflow, Smart Pose presets, WHAM mocap, OpenRouter AI, Dynamic Sky, and a CapCut-style Android dock.',
  },
  {
    q: 'Is the Android app the same as the website?',
    a: `Yes — same AnimaStage Lite engine. Web is landscape-friendly; Android v${ANDROID_RELEASE.version} is portrait (vertical) for Shorts. UI 3.0, Scene Studio, Cinematic FX, Director, mocap, and MP4 export ship on both.`,
  },
  {
    q: 'Are files uploaded to a server?',
    a: 'Core editing is client-side. Your models stay on your device — browser or phone. Optional OpenRouter / WHAM server URLs are only used if you configure them.',
  },
  {
    q: 'Where do I get Android?',
    a: `Google Play (recommended) or optional sideload APK. Min ${ANDROID_RELEASE.minAndroid}.`,
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
  onStartCreator,
  onStartDemoGallery,
  onStartDemoId,
}: LandingPageProps) {
  const [activeNav, setActiveNav] = useState<string>('hero');
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    document.documentElement.classList.add('landing-scroll-root');
    const ids = ['whats-new', 'features', 'platforms', 'samples', 'flow', 'android', 'faq'];
    const onScroll = () => {
      const y = window.scrollY + 120;
      let current = 'hero';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= y) current = id;
      }
      setActiveNav(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.documentElement.classList.remove('landing-scroll-root');
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const navCls = (id: string) =>
    `hover:text-white cursor-pointer transition-colors ${
      activeNav === id ? 'text-cyan-300 font-semibold' : ''
    }`;

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
      'Official AnimaStage Lite — full MMD studio for browser and Android. UI 3.0, Scene Studio 2.0, Cinematic FX, Director Workflow, PMX/VMD, MP4 export.'
    ),
    buildOrganizationSchema(),
  ];

  return (
    <div className="w-full min-h-screen overflow-x-hidden overflow-y-visible landing-mesh text-zinc-100 font-sans antialiased">
      <SeoHead
        title="AnimaStage Lite — UI 3.0 MMD Studio for Web & Android"
        description="Full browser + Android MMD studio. UI 3.0, Scene Studio 2.0, Cinematic FX, Anime NPR, Path Tracer Lab, Director Workflow, Dynamic Sky, WHAM mocap, OpenRouter AI. Free · client-side · not a demo."
        canonical={SITE_URL}
        keywords="MMD studio, UI 3.0, Scene Studio, Cinematic FX, MikuMikuDance browser, AnimaStage Lite, Path Tracer"
        ogUrl={SITE_URL}
        jsonLd={homeJsonLd}
      />

      <LandingScrollProgress nextSectionId="whats-new" />

      <header className="sticky top-0 z-50 border-b border-white/5 glass-panel-strong">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-teal-500/20 border border-white/10 flex items-center justify-center">
              <Play className="w-4 h-4 text-cyan-300 fill-cyan-300" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              AnimaStage <span className="text-cyan-400 text-sm font-semibold">Lite</span>
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-5 text-sm text-zinc-400">
            <a href="/roadmap" className="hover:text-cyan-300 text-cyan-400/90 font-semibold transition-colors">
              Guide
            </a>
            <button type="button" onClick={() => scrollTo('whats-new')} className={navCls('whats-new')}>
              New in 1.4
            </button>
            <button type="button" onClick={() => scrollTo('features')} className={navCls('features')}>
              Features
            </button>
            <button type="button" onClick={() => scrollTo('platforms')} className={navCls('platforms')}>
              Web &amp; Android
            </button>
            <button type="button" onClick={() => scrollTo('samples')} className={navCls('samples')}>
              Samples
            </button>
            <button type="button" onClick={() => scrollTo('android')} className={navCls('android')}>
              Download
            </button>
            <a href="/about" className="hover:text-white transition-colors">
              About
            </a>
            <a href="https://github.com/FBNonaMe/animastage-lite" target="_blank" rel="noreferrer" className="hover:text-white inline-flex items-center gap-1 transition-colors">
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0 lg:hidden">
            <GooglePlayButton size="compact" className="!text-xs !py-2 !px-3" />
            <PrimaryBtn onClick={onStart} className="!text-sm !py-2 !px-4">
              Open Studio
            </PrimaryBtn>
          </div>
          <div className="hidden lg:block">
            <PrimaryBtn onClick={onStart} className="!text-sm !py-2 !px-4">
              Open Studio
            </PrimaryBtn>
          </div>
        </div>
        <p className="text-center text-[10px] text-zinc-600 pb-1.5 px-4 hidden md:block">{BRAND_TAGLINE}</p>
      </header>

      <main>
        <section id="hero" className="relative pt-10 pb-14 md:pt-16 md:pb-20 overflow-hidden min-h-[min(92vh,880px)] flex items-center">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="text-center lg:text-left">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-3">
                  <SectionLabel>Full studio · Web + Android · v{ANDROID_RELEASE.version}</SectionLabel>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2.5 py-0.5 -mt-3">
                    Not a demo
                  </span>
                </div>

                <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-[3.35rem] leading-[1.05] tracking-tight text-white mb-5">
                  AnimaStage Lite
                </h1>
                <p className="font-display text-xl sm:text-2xl text-cyan-100/90 mb-4 tracking-tight">
                  UI 3.0 — MMD Studio for browser &amp; phone
                </p>

                <p className="text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-4">
                  Scene Studio moods, cinematic post-FX, anime NPR, director workflow,
                  WHAM mocap, and MP4 Shorts — same product on the{' '}
                  <button type="button" onClick={onStart} className="text-cyan-400 hover:text-cyan-300 font-medium underline-offset-2 hover:underline cursor-pointer">
                    web
                  </button>{' '}
                  and{' '}
                  <a href="/mmd-android" className="text-emerald-400/90 hover:text-emerald-300 font-medium underline-offset-2 hover:underline">
                    Google Play
                  </a>
                  .
                </p>

                <a
                  href="/roadmap"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400/90 hover:text-cyan-300 mb-8 mx-auto lg:mx-0 transition-colors"
                >
                  Browser &amp; Android guide →
                </a>

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center lg:justify-start mb-5">
                  {onStartCreator ? (
                    <button
                      type="button"
                      onClick={onStartCreator}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-400 hover:from-teal-400 hover:via-cyan-400 hover:to-sky-300 text-zinc-950 font-bold text-base sm:text-lg px-8 py-4 shadow-xl shadow-cyan-500/20 transition-all cursor-pointer w-full sm:w-auto"
                    >
                      <Sparkles className="w-5 h-5" />
                      Create My First Video
                    </button>
                  ) : null}
                  <PrimaryBtn onClick={onStart}>
                    <Play className="w-4 h-4 fill-current" />
                    Open Studio — Free
                  </PrimaryBtn>
                  <GhostBtn onClick={() => scrollTo('whats-new')}>
                    <Clapperboard className="w-4 h-4 text-cyan-400" />
                    See what&apos;s new
                  </GhostBtn>
                  <GooglePlayButton size="compact" />
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  <p className="text-sm text-zinc-300 flex items-center justify-center lg:justify-start gap-2">
                    <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                    Runs locally — no account, no upload to our servers
                  </p>
                  <p className="text-xs text-zinc-500 flex items-center justify-center lg:justify-start gap-2 flex-wrap">
                    <Monitor className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
                    Web · landscape / desktop
                    <span className="text-zinc-700">·</span>
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                    Android · portrait Shorts
                    <span className="text-zinc-700">·</span>
                    Open source on GitHub
                  </p>
                </div>
              </div>

              <LandingHeroMockup />
            </div>
          </div>
        </section>

        <OfficialProjectBlock />

        <WhatsNewSection onOpenStudio={onStart} />

        {/* Shared Web + Android features */}
        <section id="features" className="py-16 md:py-20 scroll-mt-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionLabel>What ships today</SectionLabel>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
                Same studio on Web &amp; Android
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto">
                UI 3.0 Studio, Scene Studio 2.0, Cinematic FX, Director Workflow, and CapCut-style mobile UI —
                available in the browser and the Play app.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {SHARED_PLATFORM.map((f) => (
                <div key={f.title} className="glass-panel rounded-2xl p-6">
                  <f.icon className="w-6 h-6 text-cyan-400 mb-4" strokeWidth={1.5} />
                  <h3 className="font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="glass-panel rounded-2xl p-5 sm:p-6 border-cyan-500/20 mb-8">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300/90 mb-3">
                Latest across platforms · v{ANDROID_RELEASE.version}
              </p>
              <ul className="grid sm:grid-cols-2 gap-2">
                {ANDROID_RELEASE.whatsNew.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Check className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <PrimaryBtn onClick={onStart}>Open Studio</PrimaryBtn>
              <GooglePlayButton size="compact" />
            </div>
          </div>
        </section>

        {/* Platform split */}
        <section id="platforms" className="py-16 md:py-20 border-t border-white/5 bg-zinc-950/40 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <SectionLabel>Two surfaces · one product</SectionLabel>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white">
                Pick Web or Android — same tools
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-6 border-cyan-500/20">
                <Monitor className="w-8 h-8 text-cyan-400 mb-4" />
                <h3 className="font-display font-bold text-xl text-white mb-2">Web studio</h3>
                <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                  Full UI 3.0 layout for desktop &amp; landscape. Scene Studio moods, Lighting Studio,
                  Cinematic FX stack, Path Tracer Lab, and multi-track timeline.
                </p>
                <ul className="space-y-2 text-sm text-zinc-500 mb-6">
                  <li className="flex gap-2"><Check className="w-4 h-4 text-cyan-400 shrink-0" /> Chrome / Edge · WebGL2</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-cyan-400 shrink-0" /> 16:9 + 9:16 export</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-cyan-400 shrink-0" /> No install</li>
                </ul>
                <PrimaryBtn onClick={onStart} className="w-full sm:w-auto">
                  Open in browser
                </PrimaryBtn>
              </div>
              <div className="glass-panel rounded-2xl p-6 border-emerald-500/25">
                <Smartphone className="w-8 h-8 text-emerald-400 mb-4" />
                <h3 className="font-display font-bold text-xl text-white mb-2">Android app</h3>
                <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                  Portrait shell for Shorts. CapCut-style bottom dock — Scene, FX, Camera, Timeline.
                  Same Scene Studio, Cinematic FX, import, and MP4 share sheet as the site.
                </p>
                <ul className="space-y-2 text-sm text-zinc-500 mb-6">
                  <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Google Play · v{ANDROID_RELEASE.version}</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> {ANDROID_RELEASE.orientation}</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> {ANDROID_RELEASE.minAndroid}</li>
                </ul>
                <GooglePlayButton />
              </div>
            </div>
          </div>
        </section>

        {/* Sample scenes — secondary */}
        <section id="samples" className="py-16 md:py-20 scroll-mt-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <SectionLabel>Optional sample scenes</SectionLabel>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
                Peek at the studio with built-in packs
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base mb-1">
                Starter scenes if you want a quick look — not required. Your own models are the main path.
              </p>
            </div>

            <DemoGalleryGrid
              onSelectDemo={(id) => (onStartDemoId ? onStartDemoId(id) : onStartDemo())}
            />

            <div className="mt-8 space-y-4">
              <div className="flex flex-wrap justify-center gap-3">
                <GhostBtn onClick={onStartDemo}>Load sample scene</GhostBtn>
                {onStartDemoGallery && (
                  <GhostBtn onClick={onStartDemoGallery}>Browse samples in studio</GhostBtn>
                )}
                <PrimaryBtn onClick={onStart}>Open empty studio</PrimaryBtn>
              </div>

              <div className="glass-panel rounded-xl p-4 sm:p-5 border-amber-500/20 text-center">
                <p className="text-base font-semibold text-zinc-100 mb-3 flex items-center justify-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" aria-hidden />
                  Already have PMX / GLB?
                </p>
                <GhostBtn onClick={onStart} className="mx-auto">
                  <Upload className="w-4 h-4 text-amber-400" />
                  Import now
                </GhostBtn>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-12 px-4 sm:px-6 border-t border-white/5 bg-zinc-950/50">
          <div className="max-w-3xl mx-auto">
            <ConversionBridge onUpload={onStart} variant="prominent" />
          </div>
        </section>

        <section className="py-12 border-t border-white/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <SectionLabel>Get started</SectionLabel>
            <h2 className="font-display font-bold text-2xl text-white mb-8">Three steps to your first clip</h2>
            <div className="grid sm:grid-cols-3 gap-4 text-left">
              {[
                { step: '1', title: 'Open Studio', desc: 'UI 3.0 — browser or Android app', action: onStart, cta: 'Launch' },
                { step: '2', title: 'Scene & motion', desc: 'Scene Studio mood + VMD or WHAM mocap', action: onStart, cta: 'Build scene' },
                { step: '3', title: 'Look & export', desc: 'Cinematic FX / NPR → MP4 Shorts', action: onStart, cta: 'Go export' },
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

        <section id="flow" className="py-16 md:py-20 border-t border-white/5 bg-zinc-950/40 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <SectionLabel>Production flow</SectionLabel>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">
              From import to Shorts in one session
            </h2>
            <p className="text-zinc-500 text-sm mb-10 max-w-lg mx-auto">
              Studio → Scene Studio mood → motion → Cinematic FX → Director clips → MP4 → share
            </p>
            <FlowDiagram />
            <div className="mt-10 max-w-md mx-auto">
              <ConversionBridge onUpload={onStart} variant="compact" />
            </div>
          </div>
        </section>

        <section id="why" className="py-16 md:py-20 border-t border-white/5 scroll-mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <SectionLabel>Why we built this</SectionLabel>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white">
                Full MMD workflow — without the install maze
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
                <h3 className="font-semibold text-cyan-100 mb-4">AnimaStage Lite</h3>
                <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                  A <strong className="text-white">real studio</strong> in the browser and on Android —
                  Scene Studio moods, cinematic FX, director workflow, and MP4 export in one product.
                </p>
                <PrimaryBtn onClick={onStart} className="!text-sm w-full sm:w-auto">
                  Open Studio
                </PrimaryBtn>
              </div>
            </div>
          </div>
        </section>

        <section id="export" className="py-16 md:py-20 border-t border-white/5 bg-zinc-950/30 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <SectionLabel>Export &amp; share</SectionLabel>
                <h2 className="font-display font-bold text-3xl text-white mb-4">
                  Create and share animations anywhere
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                  Record MP4 from the viewport. Clean frame — no gizmos in the final clip. Same export path on Web and Android Share.
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
                  <span className="text-xs text-zinc-500 mt-2">YouTube · Web</span>
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
                    <p className="text-[9px] text-violet-200 mt-0.5">Android + Web</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 border-t border-white/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <SectionLabel>Growth loop</SectionLabel>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
              Create → Export → Share → Repeat
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8 max-w-lg mx-auto">
              Make a clip on Web or Android, post it, send friends the same link. One product, two apps.
            </p>
            <div className="grid sm:grid-cols-4 gap-3 text-left mb-8">
              {[
                { icon: Sparkles, title: 'Create', desc: 'Your PMX / GLB' },
                { icon: Video, title: 'Export', desc: 'MP4 in studio' },
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
          </div>
        </section>

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
                  Full tutorial →
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
                    Opens into UI 3.0: Scene Studio, timeline, Cinematic FX, Path Tracer Lab, MP4 via Share —
                    100% client-side.
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
                  What&apos;s new (Web + Android)
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

        <section className="py-20 md:py-28 border-t border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-violet-500/10 pointer-events-none" />
          <div className="max-w-2xl mx-auto px-4 text-center relative">
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-4">
              Open the studio — Web or Android
            </h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Scene Studio, Cinematic FX, Director, mocap, MP4. Free. Client-side.
              Built for real Shorts production.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <PrimaryBtn onClick={onStart}>
                <Play className="w-4 h-4 fill-current" />
                Open Studio
              </PrimaryBtn>
              <GhostBtn onClick={onStart}>
                Import model
                <ChevronRight className="w-5 h-5" />
              </GhostBtn>
            </div>
            <GooglePlayButton className="mt-8" />
            <p className="mt-2 text-xs text-zinc-600">
              <button type="button" onClick={() => scrollTo('android')} className="hover:text-zinc-400 cursor-pointer">
                Install guide &amp; sideload APK
              </button>
              {' · '}
              <button type="button" onClick={onStartDemo} className="hover:text-zinc-400 cursor-pointer">
                Optional sample scene
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
            Guide
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
