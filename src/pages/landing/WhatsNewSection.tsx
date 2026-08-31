/**
 * What's New showcase — AnimaStage Lite 1.4 / UI 3.0 Studio.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Clapperboard,
  Sparkles,
  Layers,
  Wand2,
  LayoutDashboard,
  Sun,
  Film,
  Palette,
  Bookmark,
  ScanLine,
} from 'lucide-react';

export interface WhatsNewFeature {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  desc: string;
  bullets: string[];
  accent: string;
}

export const WHATS_NEW_FEATURES: WhatsNewFeature[] = [
  {
    id: 'ui3',
    icon: LayoutDashboard,
    eyebrow: 'UI 3.0 Studio',
    title: 'Cinematic shell redesign',
    desc: 'New layout built for production — Scene Studio on the left, FX inspector on the right, multi-tab timeline below, and a live performance HUD in the viewport.',
    bullets: [
      'Aspect ratios: 16:9, 9:16, 1:1, 4:3, 21:9',
      'Showcase Orbit + Wave camera mode',
      'Dopesheet, Curves, Effects timeline tabs',
    ],
    accent: 'cyan',
  },
  {
    id: 'scene-studio',
    icon: Sun,
    eyebrow: 'Scene Studio 2.0',
    title: 'Mood, weather & scene FX',
    desc: 'One-click atmosphere presets — sunset, rain, cyberpunk, anime, classic MMD — plus time-of-day slider, weather, and a stackable scene FX library.',
    bullets: [
      '14+ mood presets with live preview',
      'Rain, snow, mist, fireworks, god rays, aura…',
      'Per-shot state capture for Director clips',
    ],
    accent: 'amber',
  },
  {
    id: 'cinematic-fx',
    icon: Film,
    eyebrow: 'Cinematic FX',
    title: 'HDR bloom & post stack',
    desc: 'Professional post-processing passes wired into the live viewport — toggle and tune from the FX panel without leaving the session.',
    bullets: [
      'HDR Bloom · Color Grading · SSR',
      'Vignette · Lens dispersion · SMAA',
      'Replaces built-in bloom when active',
    ],
    accent: 'violet',
  },
  {
    id: 'anime-npr',
    icon: Palette,
    eyebrow: 'Anime NPR',
    title: 'Stylized render mode',
    desc: 'Switch characters to clean anime-style non-photoreal shading — works alongside scene lighting, moods, and the cinematic FX stack.',
    bullets: ['Enable from FX panel', 'Pairs with Lighting Studio', 'Export-ready look'],
    accent: 'pink',
  },
  {
    id: 'path-tracer',
    icon: ScanLine,
    eyebrow: 'Path Tracer Lab',
    title: 'Ray-traced preview + OIDN',
    desc: 'Experimental path-traced overlay for still-quality lighting. Adaptive quality governor and optional AI denoise for cleaner results at lower samples.',
    bullets: ['Samples, bounces, resolution control', 'OIDN neural denoise toggle', 'Scene fingerprint caching'],
    accent: 'sky',
  },
  {
    id: 'director',
    icon: Clapperboard,
    eyebrow: 'Director Workflow',
    title: 'Cast, clips, music, FX',
    desc: 'Plan full performances inside the studio — character cast, shot list, audio sync, effect timeline with keyframes, and global undo.',
    bullets: ['Effect Timeline + Curve Editor', 'Scene FX windows on dedicated track', 'Document-level undo / redo'],
    accent: 'emerald',
  },
  {
    id: 'pose',
    icon: Bookmark,
    eyebrow: 'Smart Pose',
    title: 'IK-style pose presets',
    desc: 'Pose Library now includes Smart presets — neutral, action, wave, sit, dance-ready — alongside built-in and custom saved poses.',
    bullets: ['Apply while paused', 'Capture & JSON export', 'Merged with custom library'],
    accent: 'cyan',
  },
  {
    id: 'mocap',
    icon: Clapperboard,
    eyebrow: 'Motion Capture 2.0',
    title: 'Video → motion keys',
    desc: 'WHAM-style capture from video with confidence gating, foot lock, auto-clean, and BVH / keyframe export.',
    bullets: ['Local MediaPipe or optional server', 'Bake to timeline without blocking UI', 'Reuse on any character'],
    accent: 'amber',
  },
  {
    id: 'ai-sky-mobile',
    icon: Sparkles,
    eyebrow: 'AI · Sky · Android',
    title: 'OpenRouter + Dynamic Sky + phone dock',
    desc: 'OpenRouter AI with free-model catalog, continuous 24h Dynamic Sky, and a CapCut-style Android bottom dock for Shorts-first editing.',
    bullets: ['OpenRouter — free models, connection test', 'Environment Studio time & weather', 'Android v1.4 · targetSdk 36 · portrait 9:16'],
    accent: 'violet',
  },
];

const ACCENT: Record<string, string> = {
  cyan: 'border-cyan-500/25 hover:border-cyan-400/40 text-cyan-300',
  amber: 'border-amber-500/25 hover:border-amber-400/40 text-amber-300',
  emerald: 'border-emerald-500/25 hover:border-emerald-400/40 text-emerald-300',
  violet: 'border-violet-500/25 hover:border-violet-400/40 text-violet-300',
  sky: 'border-sky-500/25 hover:border-sky-400/40 text-sky-300',
  pink: 'border-pink-500/25 hover:border-pink-400/40 text-pink-300',
};

interface WhatsNewSectionProps {
  onOpenStudio: () => void;
}

export default function WhatsNewSection({ onOpenStudio }: WhatsNewSectionProps) {
  return (
    <section id="whats-new" className="py-16 md:py-24 border-t border-white/5 scroll-mt-16 relative">
      <div className="absolute inset-0 pointer-events-none landing-whats-new-glow" aria-hidden />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
        <div className="text-center mb-12 md:mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/90 mb-3">
            New in 1.4 · UI 3.0 Studio
          </p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-white mb-4 tracking-tight">
            Built for cinematic MMD production
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Scene Studio moods, cinematic post-FX, anime NPR, path-traced preview, director workflow,
            and a redesigned timeline — all client-side in one open studio.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-10">
          {WHATS_NEW_FEATURES.map((f, i) => (
            <article
              key={f.id}
              className={`glass-panel rounded-2xl p-5 sm:p-6 border transition-colors landing-reveal ${ACCENT[f.accent] ?? ACCENT.cyan}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 m-0">
                    {f.eyebrow}
                  </p>
                  <h3 className="font-display font-bold text-lg text-white m-0 mt-0.5">{f.title}</h3>
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-3">{f.desc}</p>
              <ul className="space-y-1.5">
                {f.bullets.map((b) => (
                  <li key={b} className="text-xs text-zinc-500 flex items-start gap-2">
                    <Layers className="w-3 h-3 mt-0.5 shrink-0 opacity-60" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={onOpenStudio}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-zinc-950 font-bold text-sm sm:text-base px-7 py-3.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Wand2 className="w-4 h-4" />
            Open UI 3.0 Studio
          </button>
          <p className="text-[11px] text-zinc-600 mt-3 m-0">
            Scene Studio → FX → Timeline · Path Tracer Lab in FX panel
          </p>
        </div>
      </div>
    </section>
  );
}
