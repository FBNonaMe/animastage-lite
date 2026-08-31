import { useRef, useState, type DragEvent } from 'react';
import { Download, FolderOpen, Package, Upload } from 'lucide-react';
import { BUILTIN_STYLES } from '../../stylePacks/builtins';
import { readImportFilesFromDrop } from '../../stylePacks/importInput';
import type { InstalledStylePack, StylePackUpdateInfo } from '../../stylePacks/types';

export interface VisualStylePanelProps {
  activeStyleId: string;
  installed: InstalledStylePack[];
  updates: StylePackUpdateInfo[];
  busy?: boolean;
  status?: string | null;
  error?: string | null;
  onSelectStyle: (styleId: string) => void;
  onInstallImport: (files: File[]) => void | Promise<void>;
  onInstallUrl: (url: string) => void | Promise<void>;
  onInstallUpdate: (info: StylePackUpdateInfo) => void | Promise<void>;
  onRemovePack?: (packId: string) => void;
}

const SHADER_ACCEPT = '.zip,.fx,.fxsub,.fxh,.conf,.x,application/zip';

function StyleTile({
  label,
  active,
  swatch,
  previewUrl,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  swatch?: string;
  previewUrl?: string | null;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`relative overflow-hidden rounded-md border text-left transition-all cursor-pointer min-h-[52px] ${
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
        <span className="text-[9px] font-bold text-white drop-shadow">{label}</span>
      </div>
    </button>
  );
}

export default function VisualStylePanel({
  activeStyleId,
  installed,
  updates,
  busy = false,
  status,
  error,
  onSelectStyle,
  onInstallImport,
  onInstallUrl,
  onInstallUpdate,
  onRemovePack,
}: VisualStylePanelProps) {
  const [url, setUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const zipRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const submitFiles = (files: FileList | File[] | null | undefined) => {
    if (!files?.length) return;
    void onInstallImport(Array.from(files));
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = await readImportFilesFromDrop(e.dataTransfer);
    submitFiles(files);
  };

  return (
    <div className="border border-violet-500/30 rounded-md p-2 space-y-2 bg-violet-950/15">
      <div className="text-[10px] font-bold text-violet-200 flex items-center gap-1">
        <Package className="w-3 h-3" />
        Visual Style
      </div>
      <p className="text-[8px] text-zinc-500 leading-relaxed">
        Import ZIP, a shader folder (Ray-MMD / Plug-In Shader), or loose .fx / .fxsub / .fxh files.
      </p>

      <div className="grid grid-cols-3 gap-1">
        {BUILTIN_STYLES.map((style) => (
          <StyleTile
            key={style.id}
            label={style.name}
            swatch={style.swatch}
            title={style.description}
            active={activeStyleId === `builtin:${style.id}`}
            onClick={() => onSelectStyle(`builtin:${style.id}`)}
          />
        ))}
        {installed.map((pack) => (
          <StyleTile
            key={pack.manifest.id}
            label={pack.manifest.name}
            previewUrl={pack.previewDataUrl}
            title={pack.manifest.description ?? pack.manifest.name}
            active={activeStyleId === `pack:${pack.manifest.id}`}
            onClick={() => onSelectStyle(`pack:${pack.manifest.id}`)}
          />
        ))}
      </div>

      {installed.length > 0 && onRemovePack && (
        <div className="flex flex-wrap gap-1">
          {installed.map((pack) => (
            <button
              key={`rm-${pack.manifest.id}`}
              type="button"
              onClick={() => onRemovePack(pack.manifest.id)}
              className="text-[8px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500 hover:text-rose-300 hover:border-rose-500/40 cursor-pointer"
            >
              Remove {pack.manifest.name}
            </button>
          ))}
        </div>
      )}

      {updates.length > 0 && (
        <div className="space-y-1 rounded border border-amber-500/30 bg-amber-950/20 p-1.5">
          {updates.map((info) => {
            const pack = installed.find((p) => p.manifest.id === info.packId);
            return (
              <div key={info.packId} className="flex items-center justify-between gap-2">
                <span className="text-[8px] text-amber-200">
                  Update available — {pack?.manifest.name ?? info.packId} v{info.newVersion}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onInstallUpdate(info)}
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-500/50 text-amber-100 hover:bg-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  Install Update
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
        <input
          ref={zipRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            submitFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            submitFiles(e.target.files);
            e.target.value = '';
          }}
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        <input
          ref={filesRef}
          type="file"
          accept={SHADER_ACCEPT}
          className="hidden"
          multiple
          onChange={(e) => {
            submitFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => zipRef.current?.click()}
            className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-200 hover:text-white cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            ZIP
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => folderRef.current?.click()}
            className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-200 hover:text-white cursor-pointer disabled:opacity-50"
          >
            <FolderOpen className="w-3 h-3" />
            Folder
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => filesRef.current?.click()}
            className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-200 hover:text-white cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            .fx / .fxsub
          </button>
        </div>
        <p className="text-[8px] text-zinc-600 mt-1">
          Drop a folder, ZIP, or shader files here
        </p>
      </div>

      <p className="text-[8px] text-zinc-600 leading-relaxed">
        URL: direct .zip or GitHub repo (ray-cast/ray-mmd). MMD shaders are adapted to WebGL post-FX.
      </p>

      <div className="flex gap-1">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ZIP URL or github.com/user/repo"
          className="flex-1 min-w-0 text-[9px] px-2 py-1 rounded border border-zinc-700 bg-zinc-900/80 text-zinc-300 placeholder:text-zinc-600"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          disabled={busy || !url.trim()}
          onClick={() => {
            void onInstallUrl(url.trim());
            setUrl('');
          }}
          className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded border border-violet-500/40 text-violet-100 hover:bg-violet-500/20 cursor-pointer disabled:opacity-50"
        >
          <Download className="w-3 h-3" />
          Install
        </button>
      </div>

      {busy && <p className="text-[8px] text-violet-300 animate-pulse">Working…</p>}
      {status && !busy && <p className="text-[8px] text-emerald-400">{status}</p>}
      {installed.find((p) => `pack:${p.manifest.id}` === activeStyleId)?.mmdShader ? (
        <p className="text-[8px] text-amber-300/90 leading-relaxed">
          MMD shader → lighting, color & bloom in AnimaStage. Skin/hair use WebGL toon — not desktop .fx
          materials. Compare with <strong className="text-amber-100">Anime</strong> vs{' '}
          <strong className="text-amber-100">Default</strong> to see the shift.
        </p>
      ) : null}
      {error && <p className="text-[8px] text-rose-400">{error}</p>}
    </div>
  );
}
