import { useRef, useState } from 'react';
import { Box, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { processImportedAssets } from '../../utils/assetImport';
import type { ProcessedMMDFiles } from '../../utils/mmdFiles';
import type { PresetPreviewSource } from '../../sceneComposer/types';

interface PresetBackgroundBarProps {
  previewSource: PresetPreviewSource;
  onPreviewSourceChange: (source: PresetPreviewSource) => void;
  backgroundImageUrl?: string | null;
  modelSnapshotUrl?: string | null;
  backgroundStageName?: string | null;
  hasSceneModel?: boolean;
  onImportBackgroundModel?: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  onUploadPhoto: (file: File) => void;
  onClearPhoto: () => void;
}

export default function PresetBackgroundBar({
  previewSource,
  onPreviewSourceChange,
  backgroundImageUrl,
  modelSnapshotUrl,
  backgroundStageName,
  hasSceneModel,
  onImportBackgroundModel,
  onUploadPhoto,
  onClearPhoto,
}: PresetBackgroundBarProps) {
  const modelInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl =
    previewSource === 'image' && backgroundImageUrl
      ? backgroundImageUrl
      : previewSource === 'model' && modelSnapshotUrl
        ? modelSnapshotUrl
        : previewSource === 'image' && backgroundImageUrl
          ? backgroundImageUrl
          : null;

  const runModelImport = async (files: File[]) => {
    if (!files.length || !onImportBackgroundModel) return;
    setLoading(true);
    setError(null);
    try {
      const result = await processImportedAssets(files);
      if ('error' in result) throw new Error(result.error);
      if (result.kind !== 'characters' || !result.models.length) {
        throw new Error('No 3D model found. Use PMX, FBX, GLB, OBJ or ZIP folder.');
      }
      onImportBackgroundModel(result.models.length === 1 ? result.models[0]! : result.models);
      onPreviewSourceChange('model');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/25 bg-[#0a0c12] overflow-hidden">
      <div className="relative aspect-[2/1] bg-[#050608]">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center">
            <Upload className="w-5 h-5 text-zinc-600" />
            <span className="text-[9px] font-bold text-zinc-500 leading-snug">
              Add your background here
              <br />
              <span className="text-zinc-600 font-normal">3D model or photo — then pick a preset below</span>
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1.5">
          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wide">Your background</span>
          {backgroundStageName ? (
            <p className="text-[9px] text-emerald-300/90 m-0 truncate">{backgroundStageName}</p>
          ) : hasSceneModel && previewSource === 'model' ? (
            <p className="text-[9px] text-sky-300/80 m-0 truncate">Scene model</p>
          ) : backgroundImageUrl && previewSource === 'image' ? (
            <p className="text-[9px] text-sky-300/80 m-0 truncate">Custom photo</p>
          ) : null}
        </div>
      </div>

      <div className="p-2 space-y-1.5 border-t border-zinc-800/80">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            disabled={loading || !onImportBackgroundModel}
            onClick={() => modelInputRef.current?.click()}
            className="flex items-center justify-center gap-1 py-2 rounded-md border border-violet-500/35 bg-violet-950/20 text-[9px] font-bold text-violet-200 hover:bg-violet-950/35 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Box className="w-3 h-3" />}
            3D model
          </button>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex items-center justify-center gap-1 py-2 rounded-md border border-sky-500/35 bg-sky-950/20 text-[9px] font-bold text-sky-200 hover:bg-sky-950/35 cursor-pointer"
          >
            <ImagePlus className="w-3 h-3" />
            Photo
          </button>
        </div>
        <p className="text-[7px] text-zinc-600 m-0 text-center">FBX · PMX · GLB · OBJ · ZIP · JPG · PNG</p>
        {error ? <p className="text-[8px] text-red-400 m-0">{error}</p> : null}
        {backgroundImageUrl && previewSource === 'image' ? (
          <button
            type="button"
            onClick={onClearPhoto}
            className="w-full flex items-center justify-center gap-1 py-1 text-[8px] text-zinc-500 hover:text-red-300 cursor-pointer"
          >
            <X className="w-3 h-3" /> Remove photo
          </button>
        ) : null}
      </div>

      <input
        ref={modelInputRef}
        type="file"
        accept=".pmx,.pmd,.fbx,.glb,.gltf,.vrm,.obj,.zip,application/zip"
        multiple
        className="hidden"
        onChange={(e) => {
          void runModelImport(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onUploadPhoto(f);
            onPreviewSourceChange('image');
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
