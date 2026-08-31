import { Clapperboard, Film, Circle } from 'lucide-react';
import { MMD_FPS } from '../utils/playhead';
import VideoInformationPanel from './smartMetadata/VideoInformationPanel';
import type { SmartVideoMetadata, SmartMetadataLocale, SocialPlatformId } from '../smartMetadata/types';

interface VideoRecordPanelProps {
  busy: boolean;
  mode: 'idle' | 'offline' | 'live';
  exportDurationSec: number;
  maxDurationSec: number;
  onExportDurationSecChange: (sec: number) => void;
  onRenderMp4: () => void;
  onLiveRecord: () => void;
  /** Cinema Render — offline AAA export (supersample, max quality). */
  onCinemaRender?: () => void;
  vertical?: boolean;
  videoMetadata?: SmartVideoMetadata | null;
  showVideoInformation?: boolean;
  onRegenerateMetadata?: () => void;
  onMetadataLocaleChange?: (locale: SmartMetadataLocale) => void;
  onMetadataPlatformChange?: (platform: SocialPlatformId) => void;
  onMetadataTitleSelect?: (index: number) => void;
  onMetadataCopyFeedback?: (message: string) => void;
}

export default function VideoRecordPanel({
  busy,
  mode,
  exportDurationSec,
  maxDurationSec,
  onExportDurationSecChange,
  onRenderMp4,
  onLiveRecord,
  onCinemaRender,
  vertical = false,
  videoMetadata = null,
  showVideoInformation = false,
  onRegenerateMetadata,
  onMetadataLocaleChange,
  onMetadataPlatformChange,
  onMetadataTitleSelect,
  onMetadataCopyFeedback,
}: VideoRecordPanelProps) {
  const liveActive = mode === 'live';
  const clamped = Math.min(maxDurationSec, Math.max(1, exportDurationSec));
  const frameEstimate = Math.min(
    Math.ceil(maxDurationSec * MMD_FPS),
    Math.max(1, Math.ceil(clamped * MMD_FPS))
  );
  const maxFrames = Math.max(1, Math.ceil(maxDurationSec * MMD_FPS));

  return (
    <div className="border border-violet-500/25 rounded-md p-2 space-y-2 bg-violet-950/15">
      <div className="text-[10px] font-bold text-violet-300 flex items-center gap-1">
        <Film className="w-3 h-3" />
        Video recording
      </div>
      <label className="block space-y-1">
        <div className="flex justify-between text-[9px] font-bold text-zinc-400">
          <span>Export length (seconds)</span>
          <span className="text-zinc-500 font-mono">
            {clamped}s · {frameEstimate} frames
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={maxDurationSec}
          step={1}
          value={clamped}
          disabled={busy}
          onChange={(e) => onExportDurationSecChange(parseInt(e.target.value, 10) || 1)}
          className="w-full accent-violet-400"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={1}
            max={maxDurationSec}
            value={clamped}
            disabled={busy}
            title="Duration in seconds"
            onChange={(e) =>
              onExportDurationSecChange(
                Math.min(maxDurationSec, Math.max(1, parseInt(e.target.value, 10) || 1))
              )
            }
            className="w-full px-2 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-[11px] font-mono text-zinc-200"
          />
          <input
            type="number"
            min={1}
            max={maxFrames}
            value={frameEstimate}
            disabled={busy}
            title="Exact frames to record (30 FPS)"
            onChange={(e) => {
              const frames = Math.min(
                maxFrames,
                Math.max(1, parseInt(e.target.value, 10) || 1)
              );
              onExportDurationSecChange(frames / MMD_FPS);
            }}
            className="w-full px-2 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-[11px] font-mono text-zinc-200"
          />
        </div>
        <div className="flex justify-between text-[8px] text-zinc-550 text-zinc-500">
          <span>Seconds</span>
          <span>Frames @ {MMD_FPS} FPS</span>
        </div>
      </label>
      {vertical && (
        <p className="text-[8px] text-zinc-500 leading-relaxed">
          Cinema — offline AAA (supersample, no skip). MP4 HQ — standard offline. Live — real-time.
          On Android, use Share after export to save to Files or Gallery.
        </p>
      )}
      {onCinemaRender && (
        <button
          type="button"
          disabled={busy && mode !== 'offline'}
          onClick={onCinemaRender}
          className={`w-full flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold rounded border cursor-pointer transition-colors ${
            busy && mode === 'offline'
              ? 'border-amber-500/50 text-amber-300 bg-amber-500/10'
              : 'border-amber-500/45 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20'
          }`}
          title="Offline Cinema Render — max quality, supersample, perfect timing"
        >
          <Clapperboard className="w-3.5 h-3.5" />
          {busy && mode === 'offline' ? '⏹ Cancel Cinema' : 'Cinema Render'}
        </button>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy && mode !== 'offline'}
          onClick={onRenderMp4}
          className={`flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-bold rounded border cursor-pointer transition-colors ${
            busy && mode === 'offline'
              ? 'border-red-500/50 text-red-400 bg-red-500/10'
              : 'border-violet-500/40 text-violet-200 hover:bg-violet-500/15'
          }`}
        >
          <Film className="w-3 h-3" />
          {busy && mode === 'offline' ? '⏹ Cancel' : 'MP4 HQ'}
        </button>
        <button
          type="button"
          disabled={busy && mode !== 'live'}
          onClick={onLiveRecord}
          className={`flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-bold rounded border cursor-pointer transition-colors ${
            liveActive
              ? 'border-red-500/50 text-red-400 bg-red-500/10'
              : 'border-zinc-600 text-zinc-300 hover:border-violet-500/40'
          }`}
        >
          <Circle className={`w-3 h-3 ${liveActive ? 'fill-red-500 text-red-500' : ''}`} />
          {liveActive ? '⏹ Stop' : 'Live'}
        </button>
      </div>

      {showVideoInformation && videoMetadata && onRegenerateMetadata && onMetadataLocaleChange && onMetadataPlatformChange && onMetadataTitleSelect && (
        <VideoInformationPanel
          metadata={videoMetadata}
          onRegenerate={onRegenerateMetadata}
          onLocaleChange={onMetadataLocaleChange}
          onPlatformChange={onMetadataPlatformChange}
          onTitleSelect={onMetadataTitleSelect}
          onCopyFeedback={onMetadataCopyFeedback}
        />
      )}
    </div>
  );
}
