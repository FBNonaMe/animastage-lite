import { useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Download,
  FolderOpen,
  Heart,
  Package,
  Shuffle,
  Star,
  Upload,
  Save,
  Copy,
  Trash2,
} from 'lucide-react';
import {
  GALLERY_CATEGORY_LABELS,
  GALLERY_PRESETS,
  galleryStyleKey,
  galleryPresetCount,
  type GalleryCategoryId,
} from '../../stylePacks/gallery';
import { readImportFilesFromDrop } from '../../stylePacks/importInput';
import { packStyleKey } from '../../stylePacks/builtins';
import type { InstalledStylePack, StylePackUpdateInfo } from '../../stylePacks/types';
import type { StyleGalleryExtras, UserVisualPreset } from '../../stylePacks/gallery/types';
import type { useVisualStyles } from '../../stylePacks/useVisualStyles';

type VisualStylesApi = ReturnType<typeof useVisualStyles>;

const SHADER_ACCEPT = '.zip,.fx,.fxsub,.fxh,.conf,.x,application/zip';

const TAB_ORDER: GalleryCategoryId[] = [
  'classic_mmd',
  'anime',
  'game_inspired',
  'cinematic',
  'neon',
  'fantasy',
  'natural',
  'photography',
  'stylized',
  'favorites',
  'downloaded',
  'creator',
];

function StyleTile({
  label,
  active,
  swatch,
  previewUrl,
  favorite,
  onClick,
  onFavorite,
  title,
}: {
  label: string;
  active: boolean;
  swatch?: string;
  previewUrl?: string | null;
  favorite?: boolean;
  onClick: () => void;
  onFavorite?: () => void;
  title?: string;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`relative w-full overflow-hidden rounded-md border text-left transition-all cursor-pointer min-h-[52px] ${
          active
            ? 'border-violet-400/70 ring-1 ring-violet-400/40'
            : 'border-zinc-700 hover:border-violet-500/35'
        }`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${swatch ?? 'from-zinc-700 to-zinc-900'}`} />
        )}
        <div className="relative px-2 py-2 bg-black/45 backdrop-blur-[1px]">
          <span className="text-[9px] font-bold text-white drop-shadow line-clamp-2">{label}</span>
        </div>
      </button>
      {onFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFavorite();
          }}
          className={`absolute top-1 right-1 p-0.5 rounded bg-black/50 ${
            favorite ? 'text-rose-400' : 'text-zinc-500 opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart className={`w-3 h-3 ${favorite ? 'fill-current' : ''}`} />
        </button>
      )}
    </div>
  );
}

export interface ShaderGalleryPanelProps {
  visualStyles: VisualStylesApi;
  developerMode?: boolean;
}

export default function ShaderGalleryPanel({ visualStyles, developerMode = false }: ShaderGalleryPanelProps) {
  const {
    activeStyleId,
    installed,
    extras,
    updates,
    busy,
    status,
    error,
    selectStyle,
    applyRandomStyle,
    saveCurrentStyle,
    exportCurrentVisualPreset,
    toggleFavoriteStyle,
    selectUserPreset,
    deleteUserPreset,
    duplicateUserPresetById,
    installImport,
    installUrl,
    installUpdate,
    removePack,
    exportPack,
  } = visualStyles;

  const [tab, setTab] = useState<GalleryCategoryId>('classic_mmd');
  const [url, setUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const zipRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const tiles = useMemo(() => {
    if (tab === 'favorites') {
      return [
        ...GALLERY_PRESETS.filter((p) => extras.favorites.includes(galleryStyleKey(p.id))),
        ...extras.userPresets
          .filter((u) => extras.favorites.includes(`user:${u.id}`))
          .map(userToTile),
      ];
    }
    if (tab === 'downloaded') {
      return installed.map((pack) => ({
        id: packStyleKey(pack.manifest.id),
        name: pack.manifest.name,
        description: pack.manifest.description,
        swatch: 'from-violet-700 to-fuchsia-900',
        previewUrl: pack.previewDataUrl,
        pack,
      }));
    }
    if (tab === 'creator') {
      return extras.userPresets.map(userToTile);
    }
    return GALLERY_PRESETS.filter((p) => p.category === tab).map((p) => ({
      id: galleryStyleKey(p.id),
      name: p.name,
      description: p.description,
      swatch: p.swatch,
      previewUrl: null as string | null,
      presetId: p.id,
    }));
  }, [tab, extras, installed]);

  const submitFiles = (files: FileList | File[] | null | undefined) => {
    if (!files?.length) return;
    void installImport(Array.from(files));
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    submitFiles(await readImportFilesFromDrop(e.dataTransfer));
  };

  return (
    <div className="border border-violet-500/30 rounded-md p-2 space-y-2 bg-violet-950/15">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold text-violet-200 flex items-center gap-1">
          <Package className="w-3 h-3" />
          Visual Styles
        </div>
        <span className="text-[8px] text-zinc-500 font-mono">{galleryPresetCount()}+ presets</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {TAB_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setTab(cat)}
            className={`px-1.5 py-0.5 text-[8px] font-bold rounded border cursor-pointer transition-colors ${
              tab === cat
                ? 'border-violet-400/60 text-violet-100 bg-violet-500/15'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
            }`}
          >
            {GALLERY_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 max-h-44 overflow-y-auto pr-0.5">
        {tiles.map((tile) => {
          const styleId = tile.id;
          const isUser = styleId.startsWith('user:');
          return (
            <StyleTile
              key={styleId}
              label={tile.name}
              swatch={tile.swatch}
              previewUrl={tile.previewUrl}
              title={tile.description ?? tile.name}
              active={activeStyleId === styleId}
              favorite={extras.favorites.includes(styleId)}
              onClick={() => {
                if (isUser) selectUserPreset(styleId.slice(5));
                else selectStyle(styleId);
              }}
              onFavorite={() => toggleFavoriteStyle(styleId)}
            />
          );
        })}
      </div>

      {tab === 'downloaded' && installed.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {installed.map((pack) => (
            <div key={pack.manifest.id} className="flex items-center gap-1 text-[8px]">
              <span className="text-zinc-500 truncate max-w-[80px]">{pack.manifest.name}</span>
              <button
                type="button"
                onClick={() => exportPack(pack.manifest.id)}
                className="text-zinc-400 hover:text-violet-200"
                title="Export"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => removePack(pack.manifest.id)}
                className="text-zinc-400 hover:text-rose-300"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'creator' && extras.userPresets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {extras.userPresets.map((p) => (
            <div key={p.id} className="flex items-center gap-1 text-[8px]">
              <span className="text-zinc-500">{p.name}</span>
              <button type="button" onClick={() => duplicateUserPresetById(p.id)} title="Duplicate">
                <Copy className="w-3 h-3 text-zinc-400" />
              </button>
              <button type="button" onClick={() => deleteUserPreset(p.id)} title="Delete">
                <Trash2 className="w-3 h-3 text-zinc-400 hover:text-rose-300" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={applyRandomStyle}
          className="flex-1 min-w-[45%] flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold rounded border border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-500/10 cursor-pointer disabled:opacity-50"
        >
          <Shuffle className="w-3 h-3" />
          Random Style
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => saveCurrentStyle(`Style ${new Date().toLocaleTimeString()}`)}
          className="flex-1 min-w-[45%] flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold rounded border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          Save Current
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => exportCurrentVisualPreset('My Visual Preset')}
          className="flex-1 min-w-[45%] flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold rounded border border-zinc-600 text-zinc-300 hover:border-violet-500/40 cursor-pointer disabled:opacity-50"
        >
          <Star className="w-3 h-3" />
          Export .visualpreset
        </button>
      </div>

      {updates.length > 0 && (
        <div className="space-y-1 rounded border border-amber-500/30 bg-amber-950/20 p-1.5">
          {updates.map((info) => {
            const pack = installed.find((p) => p.manifest.id === info.packId);
            return (
              <div key={info.packId} className="flex items-center justify-between gap-2">
                <span className="text-[8px] text-amber-200">
                  Update — {pack?.manifest.name ?? info.packId} v{info.newVersion}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void installUpdate(info)}
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-500/50 text-amber-100 cursor-pointer disabled:opacity-50"
                >
                  Install
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`rounded border border-dashed p-2 text-center transition-colors ${
          dragOver ? 'border-violet-400 bg-violet-500/10' : 'border-zinc-700'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => void handleDrop(e)}
      >
        <input ref={zipRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { submitFiles(e.target.files); e.target.value = ''; }} />
        <input ref={folderRef} type="file" className="hidden" multiple onChange={(e) => { submitFiles(e.target.files); e.target.value = ''; }} {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)} />
        <input ref={filesRef} type="file" accept={SHADER_ACCEPT} className="hidden" multiple onChange={(e) => { submitFiles(e.target.files); e.target.value = ''; }} />
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" disabled={busy} onClick={() => zipRef.current?.click()} className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-200 cursor-pointer disabled:opacity-50">
            <Upload className="w-3 h-3" /> ZIP
          </button>
          <button type="button" disabled={busy} onClick={() => folderRef.current?.click()} className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-200 cursor-pointer disabled:opacity-50">
            <FolderOpen className="w-3 h-3" /> Folder
          </button>
        </div>
        <p className="text-[8px] text-zinc-600 mt-1">Import style pack — manifest.json + config + preview</p>
      </div>

      <div className="flex gap-1">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Style pack ZIP URL"
          className="flex-1 min-w-0 text-[9px] px-2 py-1 rounded border border-zinc-700 bg-zinc-900/80 text-zinc-300"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          disabled={busy || !url.trim()}
          onClick={() => { void installUrl(url.trim()); setUrl(''); }}
          className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded border border-violet-500/40 text-violet-100 cursor-pointer disabled:opacity-50"
        >
          <Download className="w-3 h-3" />
        </button>
      </div>

      {developerMode && (
        <p className="text-[8px] text-amber-400/80 font-mono">
          Dev: style id {activeStyleId} · {installed.length} packs · {extras.favorites.length} favorites
        </p>
      )}

      {busy && <p className="text-[8px] text-violet-300 animate-pulse">Working…</p>}
      {status && !busy && <p className="text-[8px] text-emerald-400">{status}</p>}
      {error && <p className="text-[8px] text-rose-400">{error}</p>}
    </div>
  );
}

function userToTile(preset: UserVisualPreset) {
  return {
    id: `user:${preset.id}`,
    name: preset.name,
    description: preset.config.description,
    swatch: 'from-teal-600 to-violet-800',
    previewUrl: null as string | null,
  };
}
