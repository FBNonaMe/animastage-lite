import { useRef, useState } from 'react';
import { Box, Loader2 } from 'lucide-react';
import { processImportedAssets } from '../../utils/assetImport';
import type { ProcessedMMDFiles } from '../../utils/mmdFiles';

interface BackgroundModelImportProps {
  onImport: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  loadedName?: string | null;
  disabled?: boolean;
}

export default function BackgroundModelImport({
  onImport,
  loadedName,
  disabled = false,
}: BackgroundModelImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runFiles = async (files: File[]) => {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    try {
      const result = await processImportedAssets(files);
      if ('error' in result) throw new Error(result.error);
      if (result.kind === 'style_pack') {
        throw new Error('This is a shader pack — use Load or FX → Visual Style.');
      }
      if (result.kind === 'hdr_only') {
        throw new Error('HDR file — drop it on the 3D viewport for lighting.');
      }
      if (result.kind === 'vmd_only') {
        throw new Error('VMD motion only — attach it from the Load panel.');
      }
      if (!result.models.length) {
        throw new Error('No 3D model found. Use PMX, FBX, GLB, OBJ or a ZIP folder.');
      }
      onImport(result.models.length === 1 ? result.models[0]! : result.models);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept=".pmx,.pmd,.fbx,.glb,.gltf,.vrm,.obj,.zip,application/zip"
        multiple
        className="hidden"
        disabled={disabled || loading}
        onChange={(e) => {
          void runFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-violet-500/35 bg-violet-950/15 text-[9px] font-bold text-violet-200 hover:border-violet-400/50 hover:bg-violet-950/25 cursor-pointer disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Box className="w-3.5 h-3.5" />}
        Import 3D background (FBX · PMX · GLB · OBJ · ZIP)
      </button>
      {loadedName ? (
        <p className="text-[8px] text-emerald-400/90 truncate m-0" title={loadedName}>
          Background model: {loadedName}
        </p>
      ) : null}
      {error ? <p className="text-[8px] text-red-400/90 m-0 leading-snug">{error}</p> : null}
    </div>
  );
}
