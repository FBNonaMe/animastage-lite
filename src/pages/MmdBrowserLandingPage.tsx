import { type ReactNode } from 'react';
import { Play, ChevronRight, Upload, Globe, Shield, Sparkles } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import DemoGalleryGrid from './landing/DemoGalleryGrid';
import LandingSeoChrome from '../landing/LandingSeoChrome';
import { BRAND_TAGLINE, SITE_URL } from '../landing/officialProject';
import { buildSoftwareApplicationSchema, buildWebPageSchema } from '../landing/landingSchema';

const PAGE_URL = `${SITE_URL}/mmd-browser`;

const SEO = {
  title: 'MMD Browser — Run MikuMikuDance in Chrome | AnimaStage Lite',
  description:
    'MMD browser studio — run MikuMikuDance in Chrome, Edge, or Firefox. WebGL + WASM physics, PMX/VMD import, MP4 export. Official WebMMD browser, no install.',
  keywords:
    'MMD browser, MMD in browser, WebMMD, MikuMikuDance browser, run MMD in Chrome, browser MMD studio',
} as const;

interface Props {
  onStart: () => void;
  onStartDemo: () => void;
  onStartDemoId: (id: string) => void;
}

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-zinc-950 font-bold px-6 py-3.5 cursor-pointer"
    >
      {children}
    </button>
  );
}

export default function MmdBrowserLandingPage({ onStart, onStartDemo, onStartDemoId }: Props) {
  const jsonLd = [
    buildWebPageSchema(SEO.title, SEO.description, PAGE_URL),
    buildSoftwareApplicationSchema(PAGE_URL, SEO.description),
  ];

  return (
    <LandingSeoChrome activePath="/mmd-browser" compactNav>
      <SeoHead title={SEO.title} description={SEO.description} canonical={PAGE_URL} keywords={SEO.keywords} ogUrl={PAGE_URL} jsonLd={jsonLd} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/90 mb-3">{BRAND_TAGLINE}</p>
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mb-5">
          MMD Browser — Run MikuMikuDance Without Installing
        </h1>
        <p className="text-zinc-400 leading-relaxed mb-8 max-w-2xl">
          The official <strong className="text-zinc-200">MMD browser</strong> studio at {SITE_URL}. WebGL rendering,
          WASM Bullet physics, PMX/VMD workflow — the same engine as our Android APK, tuned for desktop and mobile
          browsers.
        </p>
        <div className="flex flex-wrap gap-3 mb-12">
          <PrimaryBtn onClick={onStartDemo}>
            <Sparkles className="w-4 h-4" />
            Try demo
          </PrimaryBtn>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 text-zinc-200 font-semibold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Open browser studio
          </button>
        </div>

        <h2 className="text-2xl font-bold text-white mb-4">Why use the MMD browser edition?</h2>
        <ul className="space-y-3 text-zinc-400 mb-10">
          <li className="flex gap-2">
            <Globe className="w-5 h-5 text-cyan-400 shrink-0" />
            Works in Chrome, Edge, Firefox — no DirectX or Windows MMD required.
          </li>
          <li className="flex gap-2">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
            Client-side processing — models stay on your device.
          </li>
          <li className="flex gap-2">
            <Play className="w-5 h-5 text-violet-400 shrink-0" />
            Instant demo scenes — see motion in seconds.
          </li>
        </ul>

        <h2 className="text-2xl font-bold text-white mb-3">Also available</h2>
        <p className="text-sm text-zinc-500 mb-8">
          <a href="/mmd-android" className="text-cyan-400 hover:text-cyan-300">
            MMD Android APK
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
            About official project
          </a>
        </p>

        <h2 className="text-2xl font-bold text-white mb-6">Demo — no files needed</h2>
        <DemoGalleryGrid onSelectDemo={onStartDemoId} />
        <div className="mt-8">
          <PrimaryBtn onClick={onStartDemo}>
            <Play className="w-4 h-4 fill-current" />
            Try featured demo
            <ChevronRight className="w-4 h-4" />
          </PrimaryBtn>
        </div>
      </main>
    </LandingSeoChrome>
  );
}
