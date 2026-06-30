import { ChevronRight, ExternalLink, Github, Globe } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import LandingSeoChrome from '../landing/LandingSeoChrome';
import OfficialProjectBlock from '../landing/OfficialProjectBlock';
import {
  BRAND_TAGLINE,
  LITE_AUTHOR,
  OFFICIAL_PROJECT,
  PRO_AUTHOR,
  SITE_URL,
} from '../landing/officialProject';
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
} from '../landing/landingSchema';

const PAGE_URL = `${SITE_URL}/about`;

const SEO = {
  title: 'About AnimaStage — Official WebGL MMD Studio | AnimaStage Lite',
  description:
    'About AnimaStage: official browser MMD studio with WebGL + WASM physics. Lite by FBNonaMe. Pro by gtausa197.',
  keywords:
    'About AnimaStage, AnimaStage Lite, MMD browser studio, WebMMD official, MikuMikuDance online author',
} as const;

interface AboutPageProps {
  onStart: () => void;
}

export default function AboutPage({ onStart }: AboutPageProps) {
  const jsonLd = [
    buildWebPageSchema(SEO.title, SEO.description, PAGE_URL),
    buildSoftwareApplicationSchema(
      PAGE_URL,
      'Official AnimaStage Lite — browser-native MikuMikuDance studio with WebGL and WASM Bullet physics.'
    ),
    buildOrganizationSchema(),
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: LITE_AUTHOR.name,
      url: LITE_AUTHOR.url,
      sameAs: [OFFICIAL_PROJECT.liteRepo, LITE_AUTHOR.url],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: PRO_AUTHOR.name,
      url: PRO_AUTHOR.url,
      sameAs: [OFFICIAL_PROJECT.proRepo, PRO_AUTHOR.url],
    },
  ];

  return (
    <LandingSeoChrome activePath="/about">
      <SeoHead
        title={SEO.title}
        description={SEO.description}
        canonical={PAGE_URL}
        keywords={SEO.keywords}
        ogUrl={PAGE_URL}
        jsonLd={jsonLd}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/90 mb-3">{BRAND_TAGLINE}</p>
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mb-6">About AnimaStage</h1>

        <div className="prose prose-invert prose-zinc max-w-none space-y-5 text-zinc-400 leading-relaxed">
          <p>
            <strong className="text-zinc-200">AnimaStage</strong> is a browser-native{' '}
            <strong className="text-zinc-200">MikuMikuDance (MMD)</strong> production stack built with{' '}
            <strong className="text-zinc-200">WebGL</strong> and <strong className="text-zinc-200">WASM</strong> (Bullet
            physics). Load PMX/PMD models and VMD motion, edit on a timeline, tune camera and FX, and export MP4 — without
            desktop MMD or Windows-only tools.
          </p>

          <h2 className="text-xl font-bold text-white mt-10 mb-3">Project structure</h2>
          <div className="grid sm:grid-cols-2 gap-4 not-prose">
            <article className="glass-panel rounded-xl p-5 border border-cyan-500/20">
              <h3 className="font-bold text-cyan-300 mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" aria-hidden />
                AnimaStage Lite
              </h3>
              <p className="text-sm text-zinc-400 mb-3">
                The <strong className="text-zinc-300">browser version</strong> — free, open source, runs at{' '}
                {OFFICIAL_PROJECT.siteUrl}. Includes Android APK for portrait mobile studio.
              </p>
              <a
                href={OFFICIAL_PROJECT.liteRepo}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                <Github className="w-4 h-4" />
                Lite GitHub
              </a>
            </article>
            <article className="glass-panel rounded-xl p-5 border border-violet-500/20">
              <h3 className="font-bold text-violet-300 mb-2 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" aria-hidden />
                AnimaStage Pro
              </h3>
              <p className="text-sm text-zinc-400 mb-3">
                The <strong className="text-zinc-300">advanced GitHub edition</strong> — path tracing, heavier pipelines,
                and pro tooling at animastagepro.dev.
              </p>
              <a
                href={OFFICIAL_PROJECT.proRepo}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-300 hover:text-violet-200 inline-flex items-center gap-1"
              >
                <Github className="w-4 h-4" />
                Pro GitHub
              </a>
            </article>
          </div>

          <h2 className="text-xl font-bold text-white mt-10 mb-3">Official links</h2>
          <ul className="list-none space-y-2 not-prose text-sm">
            <li>
              <span className="text-zinc-500">Website: </span>
              <a href={OFFICIAL_PROJECT.siteUrl} className="text-cyan-400 hover:text-cyan-300">
                {OFFICIAL_PROJECT.siteUrl}
              </a>
            </li>
            <li>
              <span className="text-zinc-500">Lite repo: </span>
              <a href={OFFICIAL_PROJECT.liteRepo} className="text-cyan-400 hover:text-cyan-300">
                {OFFICIAL_PROJECT.liteRepo}
              </a>
            </li>
            <li>
              <span className="text-zinc-500">Pro repo: </span>
              <a href={OFFICIAL_PROJECT.proRepo} className="text-violet-300 hover:text-violet-200">
                {OFFICIAL_PROJECT.proRepo}
              </a>
            </li>
            <li>
              <span className="text-zinc-500">Pro demo: </span>
              <a href={OFFICIAL_PROJECT.proSite} className="text-violet-300 hover:text-violet-200">
                {OFFICIAL_PROJECT.proSite}
              </a>
            </li>
          </ul>

          <h2 className="text-xl font-bold text-white mt-10 mb-3">Authors</h2>
          <ul className="list-none space-y-3 not-prose text-sm">
            <li>
              <strong className="text-cyan-300">AnimaStage Lite</strong> —{' '}
              <a href={LITE_AUTHOR.url} className="text-cyan-400 hover:text-cyan-300 font-semibold">
                {LITE_AUTHOR.name}
              </a>
              {' '}
              (browser studio, this site, open-source repo)
            </li>
            <li>
              <strong className="text-violet-300">AnimaStage Pro</strong> —{' '}
              <a href={PRO_AUTHOR.url} className="text-violet-300 hover:text-violet-200 font-semibold">
                {PRO_AUTHOR.name}
              </a>
              {' '}
              (advanced edition, animastagepro.dev)
            </li>
          </ul>
          <p className="mt-4">{OFFICIAL_PROJECT.statement}.</p>

          <h2 className="text-xl font-bold text-white mt-10 mb-3">SEO guides</h2>
          <p>
            <a href="/roadmap" className="text-cyan-400 hover:text-cyan-300 font-semibold">
              Full guide (browser + Android)
            </a>
            {' — '}
            where to click on the landing page and how to use the studio.
          </p>
          <p className="mt-3">
            Topic pages:{' '}
            <a href="/mmd-android" className="text-cyan-400 hover:text-cyan-300">
              MMD Android
            </a>
            ,{' '}
            <a href="/mmd-browser" className="text-cyan-400 hover:text-cyan-300">
              MMD Browser
            </a>
            ,{' '}
            <a href="/mmd-online" className="text-cyan-400 hover:text-cyan-300">
              MMD Online
            </a>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-10 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-zinc-950 font-bold px-6 py-3.5 cursor-pointer"
        >
          Open official studio
          <ChevronRight className="w-4 h-4" />
        </button>
      </main>

      <OfficialProjectBlock />
    </LandingSeoChrome>
  );
}
