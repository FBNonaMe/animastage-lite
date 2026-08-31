import type { ComposerPresetDef } from '../../sceneComposer/presets';
import { getPresetPreviewLook } from '../../sceneComposer/previewGradient';
import type { PresetPreviewSource } from '../../sceneComposer/types';

interface PresetPreviewCardProps {
  preset: ComposerPresetDef;
  previewSource: PresetPreviewSource;
  modelSnapshotUrl?: string | null;
  backgroundImageUrl?: string | null;
  active?: boolean;
  onClick: () => void;
}

export default function PresetPreviewCard({
  preset,
  previewSource,
  modelSnapshotUrl,
  backgroundImageUrl,
  active,
  onClick,
}: PresetPreviewCardProps) {
  const look = getPresetPreviewLook(preset);
  const useImage = previewSource === 'image' && backgroundImageUrl;
  const useModel = previewSource === 'model' && modelSnapshotUrl;
  const hasMedia = Boolean(useImage || useModel);

  return (
    <button
      type="button"
      onClick={onClick}
      title={preset.label}
      className={`relative aspect-[16/10] w-full overflow-hidden rounded-lg border text-left transition-all cursor-pointer bg-[#0a0c10] ${
        active
          ? 'border-violet-400/70 ring-1 ring-violet-400/35'
          : 'border-zinc-800 hover:border-violet-500/45'
      }`}
    >
      {useImage ? (
        <img
          src={backgroundImageUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{ filter: look.filter, opacity: 0.92 }}
          draggable={false}
        />
      ) : useModel ? (
        <img
          src={modelSnapshotUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{ filter: 'saturate(1.02) contrast(1.04) brightness(0.98)' }}
          draggable={false}
        />
      ) : previewSource === 'minimal' ? null : (
        <div className="absolute inset-0 flex items-center justify-center px-2">
          <span className="text-[7px] font-bold uppercase tracking-wide text-zinc-600 text-center leading-snug">
            Load model or upload photo below
          </span>
        </div>
      )}

      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent ${
          hasMedia ? '' : 'opacity-60'
        }`}
      />

      <div className="absolute bottom-0 inset-x-0 px-1.5 py-1.5">
        <span className="text-[9px] font-bold text-white drop-shadow-md leading-tight block truncate">
          {preset.label}
        </span>
      </div>
    </button>
  );
}
