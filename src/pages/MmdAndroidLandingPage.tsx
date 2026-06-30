import { type ReactNode } from 'react';
import {
  Play,
  ChevronRight,
  Download,
  Smartphone,
  Globe,
  Upload,
  Video,
  Shield,
  Sparkles,
  Check,
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import DemoGalleryGrid from './landing/DemoGalleryGrid';
import LandingSeoChrome from '../landing/LandingSeoChrome';
import GooglePlayButton from '../landing/GooglePlayButton';
import { ANDROID_RELEASE, BRAND_TAGLINE, getGooglePlayUrl, SITE_URL } from '../landing/officialProject';
import { buildSoftwareApplicationSchema, buildWebPageSchema } from '../landing/landingSchema';

const PAGE_URL = `${SITE_URL}/mmd-android`;

const SEO = {
  title: 'Run MMD on Android — AnimaStage Lite on Google Play',
  description:
    'MMD Android studio on Google Play — load PMX & VMD, preview physics, export MP4. Free portrait app. Or run MikuMikuDance mobile in Chrome.',
  keywords:
    'MMD Android, AnimaStage Lite Google Play, MikuMikuDance mobile, run MMD on phone, PMX viewer Android',
} as const;

interface MmdAndroidLandingPageProps {
  onStart: () => void;
  onStartDemo: () => void;
  onStartDemoId: (demoId: string) => void;
}

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

function OutlineBtn({ onClick, children, className = '' }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-100 font-semibold text-sm px-6 py-3.5 transition-all cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

const FEATURES = [
  { icon: Upload, title: 'PMX / PMD + VMD import', desc: 'Drop a model folder on your phone — same workflow as desktop MMD.' },
  { icon: Play, title: 'Real-time playback', desc: 'Watch dances with Bullet physics — MikuMikuDance mobile preview in WebGL.' },
  { icon: Video, title: 'MP4 export', desc: 'Record Shorts or widescreen video; save via Share to Files or Gallery.' },
  { icon: Shield, title: 'Client-side only', desc: 'Models stay on your device. No account, no cloud upload required.' },
  { icon: Sparkles, title: 'Portrait studio UI', desc: 'Scene, Control, Camera, and FX tabs — built for one-hand use.' },
  { icon: Globe, title: 'Browser or app', desc: 'Run MMD in Chrome, or install from Google Play for fullscreen portrait studio.' },
] as const;

export default function MmdAndroidLandingPage({
  onStart,
  onStartDemo,
  onStartDemoId,
}: MmdAndroidLandingPageProps) {
  const jsonLd = [
    buildWebPageSchema(SEO.title, SEO.description, PAGE_URL),
    buildSoftwareApplicationSchema(PAGE_URL, 'MikuMikuDance mobile studio for Android — PMX, VMD, MP4 export.'),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Can I run MMD on Android without installing anything?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Open animastage-lite.app in Chrome on your phone to run MMD in the browser — no install. For the best experience, install AnimaStage Lite from Google Play.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is MMD Android?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'MMD Android means running MikuMikuDance-style workflows on an Android phone: load PMX models, play VMD motion, edit in a timeline, and export MP4 video.',
          },
        },
      ],
    },
  ];

  return (
    <LandingSeoChrome activePath="/mmd-android" compactNav>
      <SeoHead
        title={SEO.title}
        description={SEO.description}
        canonical={PAGE_URL}
        keywords={SEO.keywords}
        ogUrl={PAGE_URL}
        jsonLd={jsonLd}
      />

      <main>
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-16 sm:pb-20">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/90 mb-2">{BRAND_TAGLINE}</p>
          <p className="text-[11px] text-zinc-500 mb-4">MMD Android · MikuMikuDance mobile</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-[1.1] mb-5">
            Run MMD on Android — No Install
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl mb-8">
            <strong className="text-zinc-200 font-semibold">MMD Android</strong> made simple: load PMX and VMD on your phone,
            preview with physics, and export MP4 — in Chrome or from{' '}
            <a href={getGooglePlayUrl()} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 font-semibold">
              Google Play
            </a>
            . The easiest way to{' '}
            <strong className="text-zinc-200 font-semibold">run MMD on phone</strong> without desktop MikuMikuDance.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <PrimaryBtn onClick={onStartDemo}>
              <Play className="w-4 h-4 fill-current" />
              Try demo
            </PrimaryBtn>
            <GooglePlayButton />
            <OutlineBtn onClick={onStart}>
              Open in browser
              <ChevronRight className="w-4 h-4" />
            </OutlineBtn>
          </div>
        </section>

        {/* What is MMD on Android */}
        <section id="what" className="border-t border-white/5 bg-zinc-950/40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-4">What is MMD on Android?</h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              <strong className="text-zinc-200">MikuMikuDance mobile</strong> usually means watching MMD videos — not editing them.
              AnimaStage Lite brings a real studio to Android: import PMX/PMD models, attach VMD motion, scrub a timeline,
              adjust camera and FX, then record MP4 for Shorts or social posts.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              Whether you use the browser tab or the{' '}
              <a href={getGooglePlayUrl()} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                Google Play app
              </a>
              , you get the same WebMMD engine — client-side WebGL,
              no server upload, free to use. Perfect for VTubers, dance covers, and quick previews on the go.
            </p>
          </div>
        </section>

        {/* How it works in browser */}
        <section id="browser" className="border-t border-white/5">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-4">How it works in the browser</h2>
            <p className="text-zinc-400 leading-relaxed mb-8">
              To <strong className="text-zinc-200">run MMD on phone</strong> with zero install, open this site in Chrome (Android 10+).
              Tap <strong className="text-zinc-200">Try demo</strong> for an instant Hatsune Miku scene, or load your own PMX folder.
            </p>
            <ol className="space-y-4">
              {[
                'Open animastage-lite.app in Chrome on your Android phone.',
                'Tap Try demo — or Open studio and drop PMX + textures + VMD.',
                'Play motion, tweak camera in the Control / Camera tabs.',
                'Export video from FX (Live record works best on mobile).',
              ].map((step, i) => (
                <li key={step} className="flex gap-4 items-start">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-sm font-bold text-cyan-300">
                    {i + 1}
                  </span>
                  <span className="text-zinc-300 pt-1">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <PrimaryBtn onClick={onStart}>
                Open MMD studio in browser
                <ChevronRight className="w-4 h-4" />
              </PrimaryBtn>
            </div>
          </div>
        </section>

        {/* Google Play app */}
        <section id="play" className="border-t border-white/5 bg-zinc-950/40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 flex items-center gap-2">
              <Smartphone className="w-7 h-7 text-emerald-400" />
              Get AnimaStage Lite on Google Play
            </h2>
            <p className="text-zinc-400 mb-6">
              Install from{' '}
              <a href={getGooglePlayUrl()} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 font-semibold">
                Google Play
              </a>{' '}
              — portrait studio, opens straight into the editor. Free · Everyone · {ANDROID_RELEASE.minAndroid}.
            </p>
            <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-emerald-500/20 mb-6">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mb-4">
                <span>
                  <span className="text-zinc-500">Version </span>
                  <strong className="text-emerald-300">v{ANDROID_RELEASE.version}</strong>
                </span>
                <span>
                  <span className="text-zinc-500">Package </span>
                  <strong className="text-zinc-200 font-mono text-xs">{ANDROID_RELEASE.packageId}</strong>
                </span>
                <span>
                  <span className="text-zinc-500">Orientation </span>
                  <strong className="text-zinc-200">Portrait</strong>
                </span>
              </div>
              <ul className="space-y-2 mb-6">
                {ANDROID_RELEASE.whatsNew.map((line) => (
                  <li key={line} className="flex gap-2 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {line}
                  </li>
                ))}
              </ul>
              <GooglePlayButton className="w-full sm:w-auto" />
              <p className="text-[11px] text-zinc-500 mt-4">
                <a href={getGooglePlayUrl()} target="_blank" rel="noopener noreferrer" className="text-emerald-400/90 hover:text-emerald-300 break-all">
                  {getGooglePlayUrl()}
                </a>
              </p>
            </div>
            <h3 className="text-lg font-bold text-zinc-200 mb-3">Install from Google Play</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-400 mb-8">
              {ANDROID_RELEASE.installSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>

            <details className="glass-panel rounded-xl border border-white/5 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-400 hover:text-zinc-200">
                Advanced: sideload debug APK (optional)
              </summary>
              <p className="text-sm text-zinc-500 mt-3 mb-3">
                Developers and testers can still install the direct APK ({ANDROID_RELEASE.sizeHint}).
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-500 mb-4">
                {ANDROID_RELEASE.sideloadInstallSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <a
                href={ANDROID_RELEASE.url}
                download={ANDROID_RELEASE.downloadName}
                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-emerald-300"
              >
                <Download className="w-4 h-4" />
                Download {ANDROID_RELEASE.downloadName}
              </a>
            </details>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-white/5">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-8">Features for MikuMikuDance mobile</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <article key={title} className="glass-panel rounded-xl p-5 border border-white/5">
                  <Icon className="w-5 h-5 text-cyan-400 mb-3" aria-hidden />
                  <h3 className="font-bold text-zinc-100 mb-1">{title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/5 px-4 sm:px-6 py-8 max-w-4xl mx-auto">
          <p className="text-sm text-zinc-500">
            More official guides:{' '}
            <a href="/mmd-browser" className="text-cyan-400 hover:text-cyan-300">
              MMD Browser
            </a>
            {' · '}
            <a href="/mmd-online" className="text-cyan-400 hover:text-cyan-300">
              MMD Online
            </a>
            {' · '}
            <a href="/roadmap" className="text-cyan-400 hover:text-cyan-300 font-semibold">
              Full guide
            </a>
            {' · '}
            <a href="/about" className="text-cyan-400 hover:text-cyan-300">
              About
            </a>
          </p>
        </section>

        {/* Demo */}
        <section id="demo" className="border-t border-white/5 bg-zinc-950/40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">Try a demo — no files needed</h2>
            <p className="text-zinc-400 mb-8">
              Tap any scene to <strong className="text-zinc-200">run MMD on phone</strong> instantly. Works in browser and the Play Store app.
            </p>
            <DemoGalleryGrid onSelectDemo={onStartDemoId} />
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <PrimaryBtn onClick={onStartDemo} className="w-full sm:w-auto">
                <Play className="w-4 h-4 fill-current" />
                Try featured demo
              </PrimaryBtn>
              <GooglePlayButton className="w-full sm:w-auto" />
            </div>
          </div>
        </section>
      </main>
    </LandingSeoChrome>
  );
}
