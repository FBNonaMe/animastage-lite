import { useCallback, useState } from 'react';
import { Copy, RefreshCw, Sparkles } from 'lucide-react';
import type { SmartVideoMetadata, SmartMetadataLocale, SocialPlatformId } from '../../smartMetadata/types';
import {
  LOCALE_LABELS,
  PLATFORM_LABELS,
  SMART_METADATA_LOCALES,
  getMetadataUi,
  persistAppLocale,
} from '../../smartMetadata/locale';

interface VideoInformationPanelProps {
  metadata: SmartVideoMetadata;
  onRegenerate: () => void;
  onLocaleChange: (locale: SmartMetadataLocale) => void;
  onPlatformChange: (platform: SocialPlatformId) => void;
  onTitleSelect: (index: number) => void;
  onCopyFeedback?: (message: string) => void;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function VideoInformationPanel({
  metadata,
  onRegenerate,
  onLocaleChange,
  onPlatformChange,
  onTitleSelect,
  onCopyFeedback,
}: VideoInformationPanelProps) {
  const ui = getMetadataUi(metadata.locale);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);

  const flash = useCallback(
    (key: string, ok: boolean) => {
      const msg = ok ? ui.copied : ui.copyFailed;
      setCopyFlash(key);
      onCopyFeedback?.(msg);
      window.setTimeout(() => setCopyFlash(null), 1200);
    },
    [ui.copied, ui.copyFailed, onCopyFeedback]
  );

  const handleCopy = async (key: string, text: string) => {
    flash(key, await copyText(text));
  };

  const handleLocaleChange = (locale: SmartMetadataLocale) => {
    persistAppLocale(locale);
    onLocaleChange(locale);
  };

  const handlePlatformChange = (platform: SocialPlatformId) => {
    onPlatformChange(platform);
  };

  const handleTitleSelect = (index: number) => {
    onTitleSelect(index);
  };

  const copyBtnClass = (key: string) =>
    `flex-1 py-1.5 text-[9px] font-bold rounded border cursor-pointer transition-colors ${
      copyFlash === key
        ? 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10'
        : 'border-zinc-600 text-zinc-300 hover:border-violet-500/40 hover:text-violet-200'
    }`;

  return (
    <div className="border border-emerald-500/25 rounded-md p-2 space-y-2 bg-emerald-950/10 mt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {ui.panelTitle}
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded border border-zinc-600 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          {ui.regenerate}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-0.5">
          <span className="text-[8px] font-bold text-zinc-500 uppercase">{ui.platform}</span>
          <select
            value={metadata.platform}
            onChange={(e) => handlePlatformChange(e.target.value as SocialPlatformId)}
            className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-200"
          >
            {(Object.keys(PLATFORM_LABELS) as SocialPlatformId[]).map((id) => (
              <option key={id} value={id}>
                {PLATFORM_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-0.5">
          <span className="text-[8px] font-bold text-zinc-500 uppercase">{ui.language}</span>
          <select
            value={metadata.locale}
            onChange={(e) => handleLocaleChange(e.target.value as SmartMetadataLocale)}
            className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-200"
          >
            {SMART_METADATA_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-[8px] font-bold text-zinc-500 uppercase">{ui.titles}</span>
        <div className="max-h-28 overflow-y-auto space-y-0.5 rounded border border-zinc-800 bg-zinc-950/60 p-1">
          {metadata.titles.map((title, i) => (
            <label
              key={`${i}-${title.slice(0, 12)}`}
              className={`flex items-start gap-2 px-1.5 py-1 rounded cursor-pointer text-[10px] leading-snug ${
                metadata.selectedTitleIndex === i
                  ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-500/30'
                  : 'text-zinc-300 hover:bg-zinc-800/80 border border-transparent'
              }`}
            >
              <input
                type="radio"
                name="metadata-title"
                checked={metadata.selectedTitleIndex === i}
                onChange={() => handleTitleSelect(i)}
                className="mt-0.5 accent-emerald-400 shrink-0"
              />
              <span className="break-words">{title}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="block space-y-0.5">
        <span className="text-[8px] font-bold text-zinc-500 uppercase">{ui.description}</span>
        <textarea
          readOnly
          value={metadata.displayDescription}
          rows={6}
          className="w-full px-2 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-300 font-mono leading-relaxed resize-none"
        />
      </label>

      <div className="space-y-0.5">
        <span className="text-[8px] font-bold text-zinc-500 uppercase">{ui.hashtags}</span>
        <p className="text-[10px] text-violet-200/90 leading-relaxed break-words px-1">
          {metadata.displayHashtags}
        </p>
      </div>

      {metadata.keywords.length > 0 && (
        <div className="space-y-1">
          <span className="text-[8px] font-bold text-zinc-500 uppercase">{ui.keywords}</span>
          <div className="flex flex-wrap gap-1">
            {metadata.keywords.map((kw) => (
              <span
                key={kw}
                className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-[9px] text-zinc-400 border border-zinc-700"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          className={copyBtnClass('title')}
          onClick={() => void handleCopy('title', metadata.displayTitle)}
        >
          <Copy className="w-3 h-3 inline mr-0.5" />
          {ui.copyTitle}
        </button>
        <button
          type="button"
          className={copyBtnClass('desc')}
          onClick={() => void handleCopy('desc', metadata.displayDescription)}
        >
          <Copy className="w-3 h-3 inline mr-0.5" />
          {ui.copyDescription}
        </button>
        <button
          type="button"
          className={copyBtnClass('tags')}
          onClick={() => void handleCopy('tags', metadata.displayHashtags)}
        >
          <Copy className="w-3 h-3 inline mr-0.5" />
          {ui.copyHashtags}
        </button>
        <button
          type="button"
          className={copyBtnClass('all')}
          onClick={() =>
            void handleCopy(
              'all',
              `${metadata.displayTitle}\n\n${metadata.displayDescription}\n\n${metadata.displayHashtags}`
            )
          }
        >
          <Copy className="w-3 h-3 inline mr-0.5" />
          {ui.copyAll}
        </button>
      </div>
    </div>
  );
}
