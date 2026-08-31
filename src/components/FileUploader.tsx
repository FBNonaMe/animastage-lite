import React, { useState, useRef, DragEvent } from 'react';
import {
  FolderOpen,
  FileCheck,
  AlertCircle,
  UploadCloud,
  HelpCircle as QuestionIcon,
} from 'lucide-react';
import { processImportedAssets } from '../utils/assetImport';
import type { ProcessedMMDFiles, ProcessedVmdFiles } from '../utils/mmdFiles';

interface FileUploaderProps {
  onModelLoaded: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  /** When set, VMD-only ZIP/folder imports attach to this character instead of erroring. */
  attachVmdTargetModelId?: string | null;
  onAttachVmd?: (modelId: string, vmd: ProcessedVmdFiles) => void;
  /** Visual Style / MMD shader folder — installed via FX panel pipeline. */
  onInstallStylePack?: (files: File[]) => void | Promise<void>;
}

export default function FileUploader({
  onModelLoaded,
  attachVmdTargetModelId = null,
  onAttachVmd,
  onInstallStylePack,
}: FileUploaderProps) {
  const [activeTab, setActiveTab] = useState<'folder' | 'zip'>('folder');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const emitLoaded = (models: ProcessedMMDFiles[], fileCount: number, textureCount = 0) => {
    const first = models[0];
    const vmdTotal = models.reduce((n, m) => n + m.vmdBlobUrls.length, 0);
    const camNote = models.some((m) => m.hasCameraVmd) ? ' + camera VMD' : '';
    const stageNote = models.some((m) => m.assetKind === 'stage') ? ' · stage at origin' : '';
    const charNote = models.filter((m) => m.assetKind === 'character').length;
    const multiNote =
      models.length > 1
        ? ` (${models.length} assets: ${charNote} char${charNote === 1 ? '' : 's'})`
        : first?.assetKind && first.assetKind !== 'character'
          ? ` (${first.assetKind})`
          : '';
    const vmdNote = vmdTotal > 0 ? ` + ${vmdTotal} VMD` : '';
    const texNote = textureCount > 0 ? ` · ${textureCount} textures linked` : '';
    setSuccess(
      `Loaded "${first?.name ?? 'model'}"${multiNote} — ${fileCount} files${texNote}${vmdNote}${camNote}${stageNote}. Press PLAY if motion did not start.`
    );
    onModelLoaded(models.length === 1 ? models[0]! : models);
  };

  const runImport = async (files: File[], zipSource?: File) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await processImportedAssets(files);
      if ('error' in result) {
        throw new Error(result.error);
      }
      if (result.kind === 'style_pack') {
        if (onInstallStylePack) {
          await onInstallStylePack(files);
          setSuccess('Visual style installed — open FX → Visual Style to switch looks.');
          return;
        }
        throw new Error(
          'This is a shader / style pack. Open FX → Visual Style → import folder or ZIP.'
        );
      }
      if (result.kind === 'hdr_only') {
        throw new Error('HDR only — drop into the 3D viewport for environment lighting.');
      }
      if (result.kind === 'vmd_only') {
        if (!onAttachVmd) {
          throw new Error('Motion import is not available in this view.');
        }
        if (!attachVmdTargetModelId) {
          throw new Error(
            'Motion-only ZIP (.vmd). Load a .pmx/.pmd model first, then import the ZIP again.'
          );
        }
        onAttachVmd(attachVmdTargetModelId, result.vmd);
        const count = result.vmd.vmdFileNames.length;
        setSuccess(
          `Attached ${count} motion${count === 1 ? '' : 's'} to the scene character. Press PLAY if motion did not start.`
        );
        return;
      }
      if (result.skippedFormats.length > 0) {
        console.warn('[Import] Skipped:', result.skippedFormats.join(', '));
      }
      emitLoaded(result.models, files.length, result.stats.textures);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const processFolderFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await runImport(Array.from(files));
  };

  const processZipFile = async (file: File) => {
    if (!file) return;
    await runImport([file], file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);

    if (!e.dataTransfer.files?.length) return;

    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'zip') {
      setActiveTab('zip');
      void processZipFile(file);
    } else if (['fbx', 'glb', 'gltf', 'obj'].includes(ext)) {
      void runImport([file]);
    } else {
      setError("To upload an uncompressed folder, use 'Choose Folder' for browser directory selection.");
    }
  };

  return (
    <div
      className="rounded-lg border border-zinc-700/80 bg-[#12161e] p-3 space-y-3"
      id="mmd-file-uploader"
    >
      <div className="flex gap-1 rounded-md bg-[#0c0f14] p-0.5 border border-zinc-800">
        <button
          type="button"
          onClick={() => {
            setActiveTab('folder');
            setError(null);
          }}
          className={`flex-1 py-1.5 text-[11px] font-semibold border rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            activeTab === 'folder'
              ? 'bg-sky-500/15 border-sky-500/40 text-sky-100'
              : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Directory Folder
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('zip');
            setError(null);
          }}
          className={`flex-1 py-1.5 text-[11px] font-semibold border rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            activeTab === 'zip'
              ? 'bg-sky-500/15 border-sky-500/40 text-sky-100'
              : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          ZIP Archive
        </button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border border-dashed rounded-md p-4 flex flex-col items-center justify-center text-center transition-all min-h-[120px] cursor-pointer ${
          dragging
            ? 'border-sky-400/70 bg-sky-500/10 text-sky-100'
            : 'border-zinc-600 bg-[#0e1218] hover:border-zinc-500 hover:bg-[#141a22]'
        }`}
        onClick={() => {
          if (activeTab === 'folder') folderInputRef.current?.click();
          else zipInputRef.current?.click();
        }}
      >
        <input
          type="file"
          ref={folderInputRef}
          className="hidden"
          onChange={(e) => void processFolderFiles(e.target.files)}
          {...({ webkitdirectory: '', directory: '', multiple: true } as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        <input
          type="file"
          ref={zipInputRef}
          className="hidden"
          accept=".zip,application/zip,application/x-zip-compressed,.fbx,.glb,.gltf,.vrm,.obj,model/gltf-binary,model/gltf+json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
            if (ext === 'zip') void processZipFile(f);
            else if (['fbx', 'glb', 'gltf', 'vrm', 'obj'].includes(ext)) void runImport([f]);
            e.target.value = '';
          }}
        />

        {loading ? (
          <div className="flex flex-col items-center space-y-2">
            <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent animate-spin rounded-full" />
            <p className="text-xs font-semibold text-zinc-300">Processing files…</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="p-2 bg-sky-500/10 rounded-md inline-block border border-sky-500/25">
              {activeTab === 'folder' ? (
                <FolderOpen className="w-6 h-6 text-sky-300" />
              ) : (
                <UploadCloud className="w-6 h-6 text-cyan-300" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-zinc-100">
                {activeTab === 'folder' ? 'Choose model directory' : 'Select .ZIP archive'}
              </p>
              <p className="text-[9px] text-zinc-500 font-medium leading-tight">
                {activeTab === 'folder'
                  ? 'Folder: .pmx .pmd .fbx .glb .gltf .obj + textures (.png .jpg .tga …)'
                  : 'ZIP or single .fbx/.glb/.gltf/.obj — bundle with all textures (Sketchfab-style)'}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2 rounded bg-red-950/50 border border-red-500/30 flex items-start gap-1.5 text-[10px] text-red-200 font-medium">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-1.5 text-[10px] text-emerald-200 font-medium">
          <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="text-[9px] text-zinc-500 leading-normal border-t border-zinc-800 pt-2 flex items-center gap-1">
        <QuestionIcon className="w-3 h-3 text-zinc-600 shrink-0" />
        <span>
          .pmx .pmd .fbx .glb .gltf .obj .vmd .zip · textures .png .jpg .tga .dds …
        </span>
      </div>
    </div>
  );
}
