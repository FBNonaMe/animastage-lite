import {
  ChevronRight,
  Compass,
  Download,
  Layers,
  LayoutGrid,
  Map,
  Monitor,
  MousePointerClick,
  Play,
  Smartphone,
  Sparkles,
  Upload,
  Video,
  AlertCircle,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import LandingSeoChrome from '../landing/LandingSeoChrome';
import OfficialProjectBlock from '../landing/OfficialProjectBlock';
import GooglePlayButton from '../landing/GooglePlayButton';
import { ANDROID_RELEASE, BRAND_TAGLINE, getGooglePlayUrl, SITE_URL } from '../landing/officialProject';
import { buildOrganizationSchema, buildWebPageSchema } from '../landing/landingSchema';

const PAGE_URL = `${SITE_URL}/roadmap`;

const SEO = {
  title: 'Full Guide — Web Studio, Browser & Android | AnimaStage Lite',
  description:
    'Complete tutorial for the web studio at /app: every menu, sidebar, timeline, and export button. Plus Android APK install and phone UI.',
  keywords:
    'AnimaStage web studio guide, MMD online tutorial, /app help, PMX browser upload, AnimaStage Android guide',
} as const;

interface RoadmapPageProps {
  onStart: () => void;
  onStartDemo: () => void;
  onStartDemoGallery?: () => void;
}

const TOC = [
  { id: 'landing', label: 'Home page buttons' },
  { id: 'web-open', label: 'Open web studio' },
  { id: 'web-studio-ui', label: 'Web studio — every button' },
  { id: 'web-workflow', label: 'Web — step by step' },
  { id: 'web-mobile-browser', label: 'Phone browser (/app)' },
  { id: 'android-install', label: 'Install Android app' },
  { id: 'android-studio', label: 'Android app UI' },
  { id: 'android-workflow', label: 'Android workflow' },
  { id: 'troubleshooting', label: 'Common problems' },
  { id: 'roadmap', label: 'Product roadmap' },
] as const;

const LANDING_ACTIONS = [
  {
    label: 'Try Demo — Free',
    where: 'Hero, header, bottom CTA',
    does: 'Opens the studio with a ready-made dance — no files. Best first click (~2 seconds).',
    href: '/app?demo=party-dance',
    cta: 'Try demo',
    accent: 'emerald' as const,
  },
  {
    label: 'Upload / Open Studio',
    where: 'Hero “Upload” or “Open Studio”',
    does: 'Empty studio at /app. Drag PMX folder/ZIP onto the viewport, or Sidebar → Load.',
    href: '/app',
    cta: 'Open studio',
    accent: 'zinc' as const,
  },
  {
    label: 'Get on Google Play',
    where: 'Hero, Android section, /mmd-android page',
    does: `AnimaStage Lite v${ANDROID_RELEASE.version} — portrait MMD studio. Install from Google Play (recommended).`,
    href: getGooglePlayUrl(),
    cta: 'Google Play',
    accent: 'emerald' as const,
    external: true,
  },
  {
    label: 'Demo Gallery',
    where: 'Home → Demo section',
    does: 'Pick solo, duo, or camera presets — no file hunting.',
    href: '/app?demo=gallery',
    cta: 'Open gallery',
    accent: 'violet' as const,
  },
] as const;

const WEB_OPEN = [
  'Go to animastage-lite.app and click Try Demo or Open Studio — both open /app in the same tab.',
  'Bookmark https://animastage-lite.app/app to skip the landing page next time.',
  'Works in Chrome or Edge (recommended for MP4 HQ export). Firefox/Safari: use Live export if HQ fails.',
  'No install, no account. Files stay on your device — nothing is uploaded to a server for editing.',
] as const;

const WEB_TOP_MENUS = [
  {
    menu: 'File',
    items:
      'Load Miku/Kizuna presets · Import custom model · New clip · Export VMD · Clear workspace. Start here if you did not drag files onto the viewport.',
  },
  {
    menu: 'Edit',
    items: 'Undo/Redo · Simplify/Clear track · Time stretch · Quick sample keyframes on the timeline.',
  },
  {
    menu: 'Dance / Templates',
    items: 'Built-in motion templates (dance, emote, camera). Applies to the selected character on the timeline.',
  },
  {
    menu: 'Motion',
    items: 'Toggle imported VMD on/off — use when you want timeline templates instead of your .vmd file.',
  },
  {
    menu: 'Physics',
    items: 'Anytime (always sim) · Playtime only (lighter) · Off. Use Playtime with two characters.',
  },
  {
    menu: 'Viewport / View',
    items: 'Show/hide grid, bone pickers, camera helper, physics debug bodies.',
  },
  {
    menu: 'FX',
    items:
      'Opens the FX panel: bloom, DOF, weather, character quality (Standard/HD/4K), export length, MP4 HQ, Live record, Fix Physics, RTX presets.',
  },
] as const;

const WEB_SIDEBAR = [
  {
    section: 'Load',
    detail: 'Miku / Kizuna buttons · Import folder or ZIP (file picker) · Demo gallery cards · Browse all demos.',
  },
  {
    section: 'Scene',
    detail:
      'Character list (click to select) · eye/mouth icons for visibility · morph sliders · bone list · materials highlight.',
  },
  {
    section: 'Controls',
    detail: 'Bone rotation sliders · VMD playback toggle · pose library · register keyframe on current frame.',
  },
  {
    section: 'Advanced',
    detail: 'Model analyzer · animation layers · mocap/AI/collab (Pro modules) · physics lite presets.',
  },
] as const;

const WEB_VIEWPORT = [
  {
    control: 'Drag & drop zone',
    detail: 'Drop PMX/PMD folder, ZIP, VMD, or textures anywhere on the 3D view — fastest way to load on desktop.',
  },
  {
    control: 'Top-right: 16:9 / 9:16',
    detail: 'Switch widescreen vs vertical Shorts preview before export.',
  },
  {
    control: 'Top-right: Free / MMD camera',
    detail: 'Free = orbit with mouse. MMD = VMD camera track or your camera keyframes. Lock icon freezes manual framing.',
  },
  {
    control: 'Background picker',
    detail: 'Upload a custom image backdrop behind the character.',
  },
  {
    control: 'Purple root ring',
    detail: 'When a model is selected (no bone picked): drag to move the whole character on stage.',
  },
  {
    control: 'Mouse / trackpad',
    detail: 'Left-drag orbit · scroll zoom · right-drag pan (orbit controls). Click a bone in the list to pose it.',
  },
] as const;

const WEB_TIMELINE = [
  'Transport: Play ▶ Pause · frame number · speed · loop region.',
  'Track list (left): morphs, bones, camera — click a track to edit keys.',
  'Templates row: Studio / +Body / +Camera / +Combo — quick motion without a VMD file.',
  'Tabs: Timeline · Dopesheet · Curves — keyframe editing like a DAW.',
  'Collapse arrow: hide timeline for a larger viewport (desktop).',
] as const;

const WEB_EXPORT = [
  'Top menu → FX (or FX tab on mobile browser).',
  'Set Export length (seconds) — matches how long MP4 will render.',
  'MP4 HQ — best quality, needs Chrome/Edge + WebCodecs.',
  'Live — MediaRecorder fallback; works on more browsers and Android.',
  'While recording, gizmos and grid hide automatically for a clean video.',
] as const;

const WEB_WORKFLOW = [
  {
    step: 1,
    title: 'Open the web studio',
    body: 'Click Try Demo on the home page (instant scene) or Open Studio for an empty project at /app.',
  },
  {
    step: 2,
    title: 'Load PMX + textures',
    body: 'Drag your model folder or ZIP onto the center view, OR left sidebar → Load → Import folder/ZIP. Wait for textures — the character should appear in a few seconds.',
  },
  {
    step: 3,
    title: 'Add motion',
    body: 'Include .vmd in the same import, OR Timeline → Templates → pick a dance, OR Top menu → Dance. Press Play ▶ on the timeline.',
  },
  {
    step: 4,
    title: 'Tune look & camera',
    body: 'Top menu → FX: bloom, DOF, quality. Viewport top-right: 16:9 vs 9:16, Free vs MMD camera. Sidebar → Scene for morphs.',
  },
  {
    step: 5,
    title: 'Export MP4',
    body: 'FX panel → set length → MP4 HQ or Live. File downloads when rendering finishes. Use 9:16 + vertical length for Shorts/Reels.',
  },
  {
    step: 6,
    title: 'Save motion (optional)',
    body: 'Top menu → File → Export VMD to save timeline edits. File → New clip clears keys but keeps the model.',
  },
] as const;

const WEB_MOBILE_BROWSER = [
  {
    label: 'Menu',
    tap: 'Same as desktop top menu: File, Edit, FX, Physics, templates — opens full-screen sheet.',
  },
  {
    label: 'Scene',
    tap: 'Left sidebar drawer: Load, Scene list, Controls.',
  },
  {
    label: 'Play',
    tap: 'Center teal button — preview animation.',
  },
  {
    label: 'Timeline',
    tap: 'Bottom timeline drawer — scrub frames, templates, dopesheet.',
  },
  {
    label: 'Effects',
    tap: 'FX panel + export (same as desktop FX menu). Prefer Live export on phone browsers.',
  },
] as const;

const ANDROID_INSTALL = ANDROID_RELEASE.installSteps;

const ANDROID_REQUIREMENTS = ANDROID_RELEASE.requirements;

const ANDROID_BOTTOM_BAR = [
  {
    label: 'Scene',
    tap: 'Opens bottom sheet — Load (import PMX), Scene list, morphs.',
    tip: 'Start here to load your first model.',
  },
  {
    label: 'Control',
    tap: 'Timeline, templates, keyframes, dopesheet.',
    tip: 'After loading, pick a dance template or press Play.',
  },
  {
    label: 'Play (center)',
    tap: 'Big teal button — start/stop animation preview.',
    tip: 'If nothing moves, load a VMD or apply a template first.',
  },
  {
    label: 'Camera',
    tap: 'Free orbit vs MMD camera, auto-focus, bookmarks.',
    tip: 'Pinch to orbit in the viewport anytime.',
  },
  {
    label: 'FX',
    tap: 'Visual FX, physics, export length, MP4 HQ / Live, Fix Physics.',
    tip: 'On Android, Live export is more reliable than HQ.',
  },
] as const;

const ANDROID_MENU = [
  '☰ Menu (top-left) — Try demo, save/open project, clear scene, UI mode (Beginner/Pro), quality Perf/Bal/Qual.',
  'Share icon — share scene link (when available).',
  'Camera icon (top) — quick jump to FX / export panel on some layouts.',
] as const;

const ANDROID_WORKFLOW = [
  {
    step: 1,
    title: 'Install the APK',
    body: 'Open Google Play, search AnimaStage Lite, tap Install. Or use the button on /mmd-android.',
  },
  {
    step: 2,
    title: 'First launch',
    body: 'The app opens straight into the studio (portrait). No account, no login. You see the 3D viewport and the bottom bar: Scene · Control · Play · Camera · FX.',
  },
  {
    step: 3,
    title: 'Load PMX without a PC',
    body: 'Tap Scene → Load → “Import folder or ZIP” → Folder tab picks your model folder from phone storage; ZIP tab picks a .zip archive. Include textures in the same folder/ZIP.',
  },
  {
    step: 4,
    title: 'Or try a demo first',
    body: 'Tap ☰ Menu → Try demo, or Scene → Load → pick a demo card. Press the center Play button to watch.',
  },
  {
    step: 5,
    title: 'Export video on phone',
    body: 'Tap FX → set export length (seconds) → Live (recommended on Android) or MP4 HQ. When done, use the system Share sheet to save to Gallery, Files, or Drive.',
  },
  {
    step: 6,
    title: 'Performance tips',
    body: 'Menu → Quality: use Perf on older phones. One character first; add a second only if FPS stays smooth. FX → Fix Physics if hair/cloth explodes.',
  },
] as const;

const TROUBLESHOOTING = [
  {
    q: 'I opened the site but nothing loads',
    a: 'Click Try Demo first. If that works, your browser supports WebGL2. For your own files use Open Studio and drag PMX onto the center view.',
  },
  {
    q: 'Model loaded but does not move',
    a: 'Press Play ▶. Import a .vmd motion file, or Control/Timeline → Templates → pick a dance. Check VMD playback is enabled in Controls.',
  },
  {
    q: 'Android APK will not install',
    a: 'Settings → Security → Install unknown apps → enable for Chrome/Files. Download again if the file was corrupted. Need Android 6.0+ (API 23).',
  },
  {
    q: 'Export failed or app crashed on Android',
    a: 'Use Live export instead of MP4 HQ. Shorten export length (5–15 s). Close other apps. Perf quality mode in the menu.',
  },
  {
    q: 'Where is File / Export on mobile?',
    a: 'In the phone browser: bottom Effects tab. In the Android APK: FX tab. On desktop web: top menu → FX panel.',
  },
  {
    q: 'I only see a blank /app page',
    a: 'Click Try Demo first. If demo works, use Load or drag PMX onto the center. Disable ad-blockers — they can break WebGL.',
  },
  {
    q: 'Where is export on desktop web?',
    a: 'Top menu bar → FX (not File). Inside FX: set export length, then MP4 HQ or Live.',
  },
  {
    q: 'Two models lag badly',
    a: 'Normal on mid-range phones. Hide one in Scene outliner, or select only the active character. Physics runs on both only during Play.',
  },
] as const;

const PRODUCT_ROADMAP = [
  { status: 'live' as const, title: 'Browser + Android APK studio', detail: 'PMX/VMD, timeline, FX, MP4 — animastage-lite.app' },
  { status: 'live' as const, title: 'This full guide page', detail: 'Browser + Android tutorials in one place' },
  { status: 'live' as const, title: 'Google Play listing', detail: 'AnimaStage Lite published on Google Play' },
  { status: 'progress' as const, title: 'In-app first-run highlights', detail: 'Point at Scene → Play → FX inside the live UI' },
  { status: 'planned' as const, title: 'Short video walkthroughs', detail: '30-second clips for load and export' },
  { status: 'planned' as const, title: 'Localized guide (RU/JP)', detail: 'Community-requested translations' },
] as const;

function StatusBadge({ status }: { status: (typeof PRODUCT_ROADMAP)[number]['status'] }) {
  const styles = {
    live: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    progress: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    planned: 'bg-zinc-500/10 text-zinc-400 border-zinc-600/40',
  } as const;
  const labels = { live: 'Live', progress: 'In progress', planned: 'Planned' } as const;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function StepList({ items }: { items: readonly { step: number; title: string; body: string }[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.step} className="glass-panel rounded-xl p-5 border border-cyan-500/10 flex gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-sm">
            {item.step}
          </span>
          <div>
            <h3 className="font-bold text-zinc-100 mb-1">{item.title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function RoadmapPage({ onStart, onStartDemo, onStartDemoGallery }: RoadmapPageProps) {
  const jsonLd = [
    buildWebPageSchema(SEO.title, SEO.description, PAGE_URL),
    buildOrganizationSchema(),
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Use AnimaStage Lite web studio in the browser',
      step: WEB_WORKFLOW.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.title,
        text: s.body,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Install and use AnimaStage Lite on Android',
      step: ANDROID_WORKFLOW.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.title,
        text: s.body,
      })),
    },
  ];

  return (
    <LandingSeoChrome activePath="/roadmap">
      <SeoHead
        title={SEO.title}
        description={SEO.description}
        canonical={PAGE_URL}
        keywords={SEO.keywords}
        ogUrl={PAGE_URL}
        jsonLd={jsonLd}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/90 mb-3 flex items-center gap-2">
          <Compass className="w-4 h-4" aria-hidden />
          Full tutorial · Browser &amp; Android
        </p>
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mb-4">
          Guide &amp; roadmap
        </h1>
        <p className="text-zinc-400 leading-relaxed mb-6 max-w-2xl">
          Everything in one place: home page buttons, the full <strong className="text-zinc-300">web studio at /app</strong>{' '}
          (every menu and panel), phone browser layout, and the native Android app.
        </p>

        <nav
          className="glass-panel rounded-xl p-4 mb-10 border border-white/10"
          aria-label="On this page"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">Jump to section</p>
          <ul className="flex flex-wrap gap-2">
            {TOC.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="inline-block text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/15 text-zinc-300 hover:text-cyan-300 transition-colors"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-14">
          <button
            type="button"
            onClick={onStartDemo}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-zinc-950 font-bold px-6 py-3.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Try demo (browser)
          </button>
          <GooglePlayButton />
          <a href="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/5 text-zinc-500 hover:text-zinc-300 font-medium px-6 py-3.5">
            ← Home
          </a>
        </div>

        {/* Landing */}
        <section id="landing" className="mb-14 scroll-mt-20" aria-labelledby="landing-heading">
          <h2 id="landing-heading" className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <MousePointerClick className="w-5 h-5 text-cyan-400" aria-hidden />
            Home page — what to click first
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            On <a href="/" className="text-cyan-400 hover:text-cyan-300">animastage-lite.app</a>:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {LANDING_ACTIONS.map((action) => (
              <article key={action.label} className="glass-panel rounded-xl p-5 border border-white/10 flex flex-col">
                <h3 className="font-bold text-zinc-100 mb-2">{action.label}</h3>
                <p className="text-xs text-zinc-500 mb-1">
                  <span className="font-semibold uppercase tracking-wide text-zinc-600">Where: </span>
                  {action.where}
                </p>
                <p className="text-sm text-zinc-400 mb-4 flex-1">{action.does}</p>
                {action.href.includes('demo=gallery') && onStartDemoGallery ? (
                  <button type="button" onClick={onStartDemoGallery} className="text-sm font-semibold text-violet-400 hover:text-violet-300 inline-flex items-center gap-1 cursor-pointer">
                    {action.cta} <ChevronRight className="w-4 h-4" />
                  </button>
                ) : action.href.startsWith('/app') ? (
                  <button type="button" onClick={action.href.includes('demo') ? onStartDemo : onStart} className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer">
                    {action.cta} <ChevronRight className="w-4 h-4" />
                  </button>
                ) : 'external' in action && action.external ? (
                  <a
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                  >
                    {action.cta}
                    <ChevronRight className="w-4 h-4" />
                  </a>
                ) : (
                  <a href={action.href} download={ANDROID_RELEASE.downloadName} className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1">
                    <Download className="w-4 h-4" /> {action.cta}
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Web studio — open */}
        <section id="web-open" className="mb-14 scroll-mt-20" aria-labelledby="web-open-heading">
          <h2 id="web-open-heading" className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" aria-hidden />
            Web studio — how to open it
          </h2>
          <p className="text-sm text-zinc-500 mb-4">
            The studio lives at{' '}
            <a href="/app" className="text-cyan-400 hover:text-cyan-300 font-semibold">
              animastage-lite.app/app
            </a>{' '}
            — same app in Chrome, Edge, Firefox, or Safari.
          </p>
          <ul className="glass-panel rounded-xl p-5 border border-cyan-500/15 space-y-3 mb-4">
            {WEB_OPEN.map((line) => (
              <li key={line} className="text-sm text-zinc-400 flex gap-2">
                <span className="text-cyan-500 shrink-0">•</span>
                {line}
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-white/10 bg-[#0a0c12] p-4 font-mono text-[11px] text-zinc-500 leading-relaxed overflow-x-auto">
            <pre className="whitespace-pre">{`┌─────────────────────────────────────────────────────────┐
│ Top menu: File · Edit · Dance · Motion · Physics · FX   │
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  3D Viewport (drag PMX here)                 │
│ Load     │  top-right: 16:9 · Free/MMD camera           │
│ Scene    ├──────────────────────────────────────────────┤
│ Controls │  Timeline · Dopesheet · Curves               │
└──────────┴──────────────────────────────────────────────┘`}</pre>
          </div>
        </section>

        {/* Web studio UI */}
        <section id="web-studio-ui" className="mb-14 scroll-mt-20" aria-labelledby="web-ui-heading">
          <h2 id="web-ui-heading" className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-cyan-400" aria-hidden />
            Web studio — every button explained
          </h2>
          <p className="text-sm text-zinc-500 mb-8">
            Desktop layout at <a href="/app" className="text-cyan-400 hover:text-cyan-300">/app</a> (width ≥ 768px):
          </p>

          <h3 className="font-bold text-zinc-200 mb-3">Top menu bar</h3>
          <div className="grid gap-3 sm:grid-cols-2 mb-10">
            {WEB_TOP_MENUS.map((row) => (
              <div key={row.menu} className="rounded-xl border border-cyan-500/10 bg-cyan-950/10 px-4 py-3">
                <p className="font-bold text-cyan-200 text-sm">{row.menu}</p>
                <p className="text-sm text-zinc-400 mt-1">{row.items}</p>
              </div>
            ))}
          </div>

          <h3 className="font-bold text-zinc-200 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-500" />
            Left sidebar
          </h3>
          <div className="space-y-3 mb-10">
            {WEB_SIDEBAR.map((row) => (
              <div key={row.section} className="flex gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-wide text-cyan-400/80 shrink-0 w-20 pt-0.5">
                  {row.section}
                </span>
                <p className="text-sm text-zinc-400">{row.detail}</p>
              </div>
            ))}
          </div>

          <h3 className="font-bold text-zinc-200 mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-zinc-500" />
            3D viewport (center)
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 mb-10">
            {WEB_VIEWPORT.map((row) => (
              <div key={row.control} className="rounded-xl border border-white/5 px-4 py-3">
                <p className="font-semibold text-zinc-200 text-sm">{row.control}</p>
                <p className="text-sm text-zinc-500 mt-1">{row.detail}</p>
              </div>
            ))}
          </div>

          <h3 className="font-bold text-zinc-200 mb-3 flex items-center gap-2">
            <Video className="w-4 h-4 text-zinc-500" />
            Timeline (bottom)
          </h3>
          <ul className="text-sm text-zinc-400 space-y-2 mb-10 list-disc pl-5">
            {WEB_TIMELINE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <h3 className="font-bold text-zinc-200 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zinc-500" />
            Export video (FX panel)
          </h3>
          <ol className="space-y-2">
            {WEB_EXPORT.map((line, i) => (
              <li key={line} className="text-sm text-zinc-400 flex gap-3">
                <span className="text-cyan-500 font-bold shrink-0">{i + 1}.</span>
                {line}
              </li>
            ))}
          </ol>
        </section>

        {/* Web workflow */}
        <section id="web-workflow" className="mb-14 scroll-mt-20" aria-labelledby="web-flow-heading">
          <h2 id="web-flow-heading" className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-cyan-400" aria-hidden />
            Web studio — full workflow (browser on PC)
          </h2>
          <StepList items={WEB_WORKFLOW} />
          <p className="text-sm text-zinc-500 mt-6 glass-panel rounded-xl p-4 border border-white/5">
            <strong className="text-zinc-300">Two characters in the web studio:</strong> import two PMX in one ZIP.
            Select each in Sidebar → Scene. The non-selected model uses a lighter render profile for smoother FPS.
            Physics on the background character runs only during Play.
          </p>
        </section>

        {/* Mobile browser (not APK) */}
        <section id="web-mobile-browser" className="mb-14 scroll-mt-20" aria-labelledby="web-mobile-heading">
          <h2 id="web-mobile-heading" className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Globe className="w-5 h-5 text-violet-400" aria-hidden />
            Web studio on a phone browser
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            If you open <a href="/app" className="text-cyan-400 hover:text-cyan-300">/app</a> in Chrome on Android{' '}
            <em>without</em> installing the APK, the layout switches to a bottom bar (not the same as the native app):
          </p>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            {WEB_MOBILE_BROWSER.map((item) => (
              <div key={item.label} className="rounded-xl border border-violet-500/10 bg-violet-950/20 px-4 py-3">
                <p className="font-bold text-violet-200 text-sm">{item.label}</p>
                <p className="text-sm text-zinc-400 mt-1">{item.tap}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-zinc-500">
            For the best phone experience, install from{' '}
            <a href={getGooglePlayUrl()} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
              Google Play
            </a>{' '}
            — see sections below. Optional sideload APK on{' '}
            <a href="/mmd-android" className="text-cyan-400 hover:text-cyan-300">/mmd-android</a>.
          </p>
        </section>


        {/* Android install */}
        <section id="android-install" className="mb-14 scroll-mt-20" aria-labelledby="android-install-heading">
          <h2 id="android-install-heading" className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" aria-hidden />
            Install AnimaStage Lite on Android
          </h2>
          <p className="text-sm text-zinc-500 mb-4">
            Version <strong className="text-zinc-300">{ANDROID_RELEASE.version}</strong> · {ANDROID_RELEASE.orientation} ·{' '}
            {ANDROID_RELEASE.sizeHint} · {ANDROID_RELEASE.minAndroid}
          </p>
          <div className="glass-panel rounded-xl p-5 border border-emerald-500/20 mb-6">
            <GooglePlayButton className="mb-4" />
            <ol className="space-y-3">
              {ANDROID_INSTALL.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-zinc-400">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <h3 className="font-semibold text-zinc-300 text-sm mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Requirements
          </h3>
          <ul className="text-sm text-zinc-500 space-y-1 mb-4 list-disc pl-5">
            {ANDROID_REQUIREMENTS.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="text-sm text-zinc-500">
            More detail:{' '}
            <a href="/mmd-android" className="text-cyan-400 hover:text-cyan-300">
              MMD Android landing page
            </a>
            . Privacy:{' '}
            <a href={ANDROID_RELEASE.privacyPolicyUrl} className="text-cyan-400 hover:text-cyan-300">
              privacy policy
            </a>
            .
          </p>
        </section>

        {/* Android UI */}
        <section id="android-studio" className="mb-14 scroll-mt-20" aria-labelledby="android-ui-heading">
          <h2 id="android-ui-heading" className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Map className="w-5 h-5 text-emerald-400" aria-hidden />
            Android app — every button explained
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            After install, the app opens <strong className="text-zinc-300">directly into the studio</strong> (no marketing
            page). Hold the phone upright — portrait only.
          </p>

          <h3 className="font-bold text-zinc-200 mb-3">Bottom bar (main navigation)</h3>
          <div className="grid gap-3 sm:grid-cols-2 mb-8">
            {ANDROID_BOTTOM_BAR.map((item) => (
              <div key={item.label} className="rounded-xl border border-emerald-500/10 bg-emerald-950/20 px-4 py-3">
                <p className="font-bold text-emerald-200 text-sm">{item.label}</p>
                <p className="text-sm text-zinc-400 mt-1">{item.tap}</p>
                <p className="text-xs text-zinc-500 mt-2 italic">{item.tip}</p>
              </div>
            ))}
          </div>

          <h3 className="font-bold text-zinc-200 mb-3">Top bar</h3>
          <ul className="space-y-2 mb-8">
            {ANDROID_MENU.map((line) => (
              <li key={line} className="text-sm text-zinc-400 flex gap-2">
                <span className="text-emerald-500 shrink-0">•</span>
                {line}
              </li>
            ))}
          </ul>

          <div className="glass-panel rounded-xl p-5 border border-white/10">
            <p className="text-sm font-semibold text-zinc-200 mb-2">Scene tab → Load panel</p>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li><strong className="text-zinc-300">Miku / Kizuna</strong> — built-in sample characters</li>
              <li><strong className="text-zinc-300">Import folder or ZIP</strong> — tap Folder or ZIP, then pick from phone storage (not drag-drop)</li>
              <li><strong className="text-zinc-300">Demo cards</strong> — instant scenes without your files</li>
            </ul>
          </div>
        </section>

        {/* Android workflow */}
        <section id="android-workflow" className="mb-14 scroll-mt-20" aria-labelledby="android-flow-heading">
          <h2 id="android-flow-heading" className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-emerald-400" aria-hidden />
            Android — full workflow (start to export)
          </h2>
          <StepList items={ANDROID_WORKFLOW} />
        </section>

        {/* Troubleshooting */}
        <section id="troubleshooting" className="mb-14 scroll-mt-20" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400" aria-hidden />
            Common problems
          </h2>
          <div className="space-y-3">
            {TROUBLESHOOTING.map((item) => (
              <details key={item.q} className="glass-panel rounded-xl border border-white/5 group">
                <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-zinc-200 list-none flex justify-between items-center">
                  {item.q}
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="px-4 pb-4 text-sm text-zinc-500 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="mb-10 scroll-mt-20" aria-labelledby="roadmap-heading">
          <h2 id="roadmap-heading" className="text-xl font-bold text-white mb-2">
            Product roadmap
          </h2>
          <p className="text-sm text-zinc-500 mb-6">What is live today and what comes next.</p>
          <ul className="space-y-3">
            {PRODUCT_ROADMAP.map((item) => (
              <li key={item.title} className="glass-panel rounded-xl px-4 py-3 border border-white/5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <StatusBadge status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-200 text-sm">{item.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-sm text-zinc-500 border-t border-white/5 pt-8">
          Still stuck? Email{' '}
          <a href="mailto:Boyko2005maxim@gmail.com" className="text-cyan-400 hover:text-cyan-300">
            Boyko2005maxim@gmail.com
          </a>{' '}
          with a screenshot (browser or Android) — we update this guide from real feedback.
        </p>
      </main>

      <OfficialProjectBlock />
    </LandingSeoChrome>
  );
}
