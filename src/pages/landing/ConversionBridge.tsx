import { Upload, ChevronRight } from 'lucide-react';

interface ConversionBridgeProps {
  onUpload: () => void;
  variant?: 'prominent' | 'compact';
}

/** Studio → upload your own model */
export default function ConversionBridge({ onUpload, variant = 'prominent' }: ConversionBridgeProps) {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onUpload}
        className="w-full text-left glass-panel rounded-xl p-4 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-950/10 transition-all cursor-pointer group"
      >
        <p className="text-sm font-semibold text-zinc-100 group-hover:text-cyan-100">
          Ready with your files? <span className="text-cyan-400">Import PMX / GLB</span>
        </p>
        <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-cyan-400">
          Open studio &amp; load
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </button>
    );
  }

  return (
    <div className="relative rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-950/40 via-zinc-900/80 to-emerald-950/30 p-6 sm:p-8 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="max-w-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-400/90 mb-2">
            Your models
          </p>
          <h3 className="font-display font-bold text-xl sm:text-2xl text-white mb-2">
            Import PMX, PMD, GLB or FBX — same studio on Web &amp; Android
          </h3>
          <p className="text-sm text-zinc-400">
            Drop files on the viewport. VMD motion, FX, camera, MP4 export — everything stays on your device.
          </p>
        </div>
        <button
          type="button"
          onClick={onUpload}
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-zinc-950 font-bold text-base px-6 py-3.5 shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
        >
          <Upload className="w-5 h-5" />
          Open Studio
        </button>
      </div>
    </div>
  );
}
