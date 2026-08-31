/** Hero frame — real UI 3.0 Studio screenshot with light chrome. */
const STUDIO_SHOT = '/images/studio-ui3-update.png';

export default function LandingHeroMockup() {
  return (
    <div className="relative w-full max-w-[720px] mx-auto lg:mx-0">
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-amber-500/10 to-violet-500/15 blur-3xl rounded-full pointer-events-none landing-glow-pulse" />

      <div className="relative rounded-2xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-zinc-950/80">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 text-[10px] font-mono text-zinc-500">AnimaStage Lite — UI 3.0 Studio</span>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-cyan-400/90 bg-cyan-500/10 border border-cyan-500/25 rounded px-2 py-0.5">
            v1.4.0
          </span>
        </div>

        <div className="relative aspect-[16/10] sm:aspect-[16/9] bg-[#0d0e11] overflow-hidden">
          <img
            src={STUDIO_SHOT}
            alt="AnimaStage Lite UI 3.0 — Scene Studio 2.0, FX panel, timeline with morph and bone tracks"
            className="absolute inset-0 w-full h-full object-cover object-top landing-ken-burns"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e11]/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
            <span className="text-[9px] font-semibold text-emerald-200 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded">
              Bloom FX active
            </span>
            <span className="text-[9px] font-semibold text-amber-200 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded">
              Sunset mood
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none">
            <span className="text-[9px] font-mono text-cyan-400/90 bg-black/60 px-2 py-0.5 rounded border border-cyan-500/20">
              Scene Studio 2.0 · 9:16
            </span>
            <span className="text-[9px] font-mono text-zinc-400 bg-black/60 px-2 py-0.5 rounded border border-white/10">
              61 FPS · GPU
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
