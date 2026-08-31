/**
 * Motion Capture Studio 2.0 — engine select, capture modes, cleanup, export, library.
 * Builds on WHAM; does not remove the existing pipeline.
 */
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  Clapperboard,
  Download,
  Film,
  Library,
  Loader2,
  Sparkles,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import type { TimelineKeyframe } from '../types';
import {
  WHAM_VIDEO_ACCEPT,
  downloadBvh,
  downloadWhamJson,
  getWhamServerUrl,
  isWhamVideoFile,
  probeWhamServer,
  setWhamServerUrl,
  type WhamProgress,
} from './wham';
import {
  MOCAP_ENGINES,
  MOCAP_QUALITY_LABELS,
  runMocapEngine,
  rebakeCachedResult,
  type MocapEngineId,
  type MocapEngineResult,
  type MocapQualityMode,
  type MocapCaptureMode,
  type MocapSmoothingMode,
} from './engine';
import { autoCleanMotion } from './pipeline/autoCleanup';
import { buildAsMdDocument, downloadAsMd } from './normalized/motionDocument';
import { generateTimelineKeysFromSpec } from './wham/keyframeGen';
import { sequenceToMotionSpec, finalizeWhamMotionSpec } from './wham/toMotionSpec';
import { getWhamQualityPreset } from './wham/qualityPresets';
import { resolveWhamQuality } from './engine/types';
import { averageJointConfidence } from './wham/temporalSmooth';

export interface MotionCaptureStudioProps {
  maxFrames: number;
  onApplyKeyframes: (keyframes: TimelineKeyframe[], mode: 'merge' | 'replace') => void;
  onSaveToLibrary?: (payload: {
    name: string;
    keyframes: TimelineKeyframe[];
    durationSec: number;
    fps: number;
    tags: string[];
    author: string;
  }) => void;
  onStatus?: (msg: string) => void;
  disabled?: boolean;
}

type TabId = 'capture' | 'preview' | 'cleanup' | 'export';

const TABS: { id: TabId; label: string }[] = [
  { id: 'capture', label: 'Capture' },
  { id: 'preview', label: 'Preview' },
  { id: 'cleanup', label: 'Cleanup' },
  { id: 'export', label: 'Export' },
];

const QUALITIES = Object.keys(MOCAP_QUALITY_LABELS) as MocapQualityMode[];

export default function MotionCaptureStudio({
  maxFrames,
  onApplyKeyframes,
  onSaveToLibrary,
  onStatus,
  disabled = false,
}: MotionCaptureStudioProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [tab, setTab] = useState<TabId>('capture');
  const [engine, setEngine] = useState<MocapEngineId>('auto');
  const [quality, setQuality] = useState<MocapQualityMode>('balanced');
  const [mode, setMode] = useState<MocapCaptureMode>('video');
  const [smoothing, setSmoothing] = useState<MocapSmoothingMode>('medium');
  const [rootMotion, setRootMotion] = useState(true);
  const [footLock, setFootLock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<WhamProgress | null>(null);
  const [result, setResult] = useState<MocapEngineResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [serverUrl, setServerUrlState] = useState(() => getWhamServerUrl() ?? '');
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const cancel = () => {
    abortRef.current?.abort();
    setBusy(false);
    setProgress({ phase: 'error', progress: 0, message: 'Cancelled' });
    onStatus?.('Motion capture cancelled');
  };

  const runFile = useCallback(
    async (file: File) => {
      if (mode === 'live') {
        onStatus?.(
          'Live mocap UI is ready — use Video mode for file import. Webcam stream lands in a follow-up pass.'
        );
        return;
      }
      if (mode === 'photo' && file.type.startsWith('image/')) {
        onStatus?.(
          'Photo Pose: import a short video clip for now, or convert the still to MP4. Full still→pose is next.'
        );
        return;
      }
      if (!isWhamVideoFile(file)) {
        onStatus?.('Unsupported video — use MP4 / MOV / AVI / MKV / WEBM');
        return;
      }
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setBusy(true);
      setResult(null);
      setTab('preview');
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreviewUrl(url);

      try {
        const res = await runMocapEngine(
          file,
          {
            engine,
            quality,
            captureMode: mode,
            smoothing,
            footLock: { enabled: footLock },
            rootMotion: { enabled: rootMotion },
            preferServer: engine !== 'landmark',
            maxFrames,
            signal: ac.signal,
          },
          setProgress
        );
        setResult(res);
        onApplyKeyframes(res.keyframes, 'merge');
        onStatus?.(
          `Mocap 2.0 (${res.engine}${res.fromCache ? ' · cache' : ''}): ${res.meta.keyCount} keys · ${res.qualityReport.trackingQuality}`
        );
        setTab('preview');
      } catch (e) {
        const err = e as Error;
        if (err.name === 'AbortError') {
          onStatus?.('Cancelled');
        } else {
          setProgress({ phase: 'error', progress: 0, message: err.message });
          onStatus?.(err.message);
        }
      } finally {
        setBusy(false);
      }
    },
    [
      engine,
      quality,
      mode,
      smoothing,
      footLock,
      rootMotion,
      maxFrames,
      onApplyKeyframes,
      onStatus,
    ]
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void runFile(f);
  };

  const autoClean = () => {
    if (!result) {
      onStatus?.('Capture a video first');
      return;
    }
    const cleaned = autoCleanMotion(result.sequence, { intensity: 'high' });
    const whamQ = resolveWhamQuality(quality);
    const preset = getWhamQualityPreset(whamQ);
    const spec = finalizeWhamMotionSpec(
      sequenceToMotionSpec(cleaned.sequence, result.motionSpec.name)
    );
    const keys = generateTimelineKeysFromSpec(
      spec,
      Math.min(maxFrames, Math.ceil(cleaned.sequence.duration * 30) + 1),
      preset.keyReduceTol
    );
    const next: MocapEngineResult = {
      ...result,
      sequence: cleaned.sequence,
      motionSpec: spec,
      keyframes: keys,
      jointConfidence: averageJointConfidence(cleaned.sequence.frames),
      meta: { ...result.meta, keyCount: keys.length },
      qualityReport: {
        ...result.qualityReport,
        correctedFrames:
          result.qualityReport.correctedFrames +
          cleaned.correctedJoints +
          cleaned.correctedRoot,
        suggestions: ['Auto Clean applied — review feet and hands on timeline.'],
      },
      fromCache: true,
    };
    setResult(next);
    onApplyKeyframes(keys, 'replace');
    onStatus?.(`AUTO CLEAN · ${keys.length} keys · −jitter / feet / outliers`);
  };

  const reprocessFromCache = () => {
    if (!result) return;
    const next = rebakeCachedResult(result, {
      engine,
      quality,
      smoothing,
      footLock: { enabled: footLock },
      rootMotion: { enabled: rootMotion },
      maxFrames,
    });
    setResult(next);
    onApplyKeyframes(next.keyframes, 'replace');
    onStatus?.(`Rebaked from cache · ${next.meta.keyCount} keys (no re-detect)`);
  };

  const saveLibrary = () => {
    if (!result || !onSaveToLibrary) {
      onStatus?.(onSaveToLibrary ? 'Nothing to save' : 'Library save not wired');
      return;
    }
    const doc = buildAsMdDocument(result, {
      engine: result.engine,
      qualityReport: result.qualityReport,
      tags: ['mocap', result.engine, quality],
    });
    onSaveToLibrary({
      name: doc.name,
      keyframes: doc.keyframes,
      durationSec: doc.duration,
      fps: doc.fps,
      tags: doc.tags,
      author: doc.author,
    });
    onStatus?.(`Saved “${doc.name}” to Animation Library`);
  };

  const probe = async () => {
    setWhamServerUrl(serverUrl || null);
    const ok = await probeWhamServer(serverUrl || undefined);
    setServerOk(ok);
    onStatus?.(ok ? 'WHAM server online' : 'WHAM server offline — Landmark / local WHAM');
  };

  const pct = Math.round((progress?.progress ?? 0) * 100);
  const report = result?.qualityReport;

  return (
    <section className="border border-cyan-500/30 rounded-md p-2.5 bg-cyan-950/15 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-200">
        <Clapperboard className="w-3.5 h-3.5" />
        Motion Capture Studio 2.0
      </div>
      <p className="text-[9px] text-zinc-500 leading-relaxed m-0">
        Video → pose → stabilize → retarget keys. Engines: WHAM · Landmark · Auto. Physics runs after bake.
      </p>

      <div className="grid grid-cols-4 gap-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`py-1.5 rounded text-[8px] font-bold ${
              tab === t.id ? 'bg-cyan-500/20 text-cyan-100' : 'text-zinc-500 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'capture' ? (
        <div className="space-y-2">
          <div>
            <div className="text-[8px] font-bold text-zinc-500 mb-1">Mocap Engine</div>
            <div className="grid grid-cols-3 gap-1">
              {MOCAP_ENGINES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  title={e.hint}
                  disabled={busy || disabled}
                  onClick={() => setEngine(e.id)}
                  className={`px-1 py-1.5 text-[8px] font-bold rounded border cursor-pointer disabled:opacity-40 ${
                    engine === e.id
                      ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                      : 'border-zinc-700 text-zinc-500'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[8px] font-bold text-zinc-500 mb-1">Mode</div>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ['video', 'Video'],
                  ['live', 'Live'],
                  ['photo', 'Photo'],
                  ['edit', 'Edit'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => setMode(id)}
                  className={`px-1 py-1 text-[8px] font-bold rounded border cursor-pointer disabled:opacity-40 ${
                    mode === id
                      ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                      : 'border-zinc-700 text-zinc-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[8px] font-bold text-zinc-500 mb-1">Quality</div>
            <div className="grid grid-cols-5 gap-0.5">
              {QUALITIES.map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => setQuality(id)}
                  className={`px-0.5 py-1.5 text-[7px] font-bold rounded border cursor-pointer disabled:opacity-40 ${
                    quality === id
                      ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                      : 'border-zinc-700 text-zinc-500'
                  }`}
                >
                  {MOCAP_QUALITY_LABELS[id]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[8px] text-zinc-400">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={rootMotion}
                onChange={(e) => setRootMotion(e.target.checked)}
              />
              Root motion
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={footLock}
                onChange={(e) => setFootLock(e.target.checked)}
              />
              Foot lock
            </label>
          </div>

          <div>
            <div className="text-[8px] font-bold text-zinc-500 mb-1">Smoothing</div>
            <div className="grid grid-cols-5 gap-0.5">
              {(
                ['none', 'light', 'medium', 'strong', 'cinematic'] as MocapSmoothingMode[]
              ).map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => setSmoothing(id)}
                  className={`px-0.5 py-1 text-[7px] font-bold rounded border cursor-pointer disabled:opacity-40 ${
                    smoothing === id
                      ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
                      : 'border-zinc-700 text-zinc-500'
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`relative rounded-md border border-dashed px-2 py-4 text-center transition-colors ${
              dragOver ? 'border-cyan-400 bg-cyan-500/10' : 'border-cyan-500/35 bg-black/20'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={mode === 'photo' ? 'image/*,.jpg,.jpeg,.png,.webp' : WHAM_VIDEO_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex flex-col items-center gap-1 w-full cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
                  <span className="text-[9px] text-cyan-200 font-semibold">
                    {progress?.message ?? 'Processing…'} ({pct}%)
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-cyan-300/80" />
                  <span className="text-[9px] font-bold text-cyan-100">
                    {mode === 'photo' ? 'Drop photo / still' : 'Drop video or click'}
                  </span>
                  <span className="text-[8px] text-zinc-500">
                    Engine {engine.toUpperCase()} · non-blocking UI · cancel anytime
                  </span>
                </>
              )}
            </button>
            {busy ? (
              <>
                <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400/80 transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={cancel}
                  className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[8px] font-bold rounded border border-rose-500/40 text-rose-200 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </>
            ) : null}
          </div>

          <details className="text-[8px] text-zinc-500">
            <summary className="cursor-pointer text-zinc-400 font-semibold">
              WHAM server (optional)
            </summary>
            <div className="mt-1 flex gap-1">
              <input
                value={serverUrl}
                onChange={(e) => setServerUrlState(e.target.value)}
                placeholder="http://localhost:8765"
                className="flex-1 min-w-0 px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-[9px]"
              />
              <button
                type="button"
                onClick={() => void probe()}
                className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 cursor-pointer"
              >
                Probe
              </button>
            </div>
            {serverOk != null ? (
              <p className="mt-1 m-0">
                {serverOk ? 'Online — WHAM primary' : 'Offline — Landmark / local'}
              </p>
            ) : (
              <p className="mt-1 m-0">POST /reconstruct · GET /health · VITE_WHAM_URL</p>
            )}
          </details>
        </div>
      ) : null}

      {tab === 'preview' ? (
        <div className="space-y-2">
          {previewUrl ? (
            <div className="rounded-md overflow-hidden border border-zinc-800 bg-black">
              <div className="flex items-center gap-1 px-2 py-1 text-[8px] text-zinc-500 border-b border-zinc-800">
                <Film className="w-3 h-3" />
                Reference
                {result ? (
                  <span className="ml-auto text-cyan-500/80">
                    {result.engine} · {result.source} · {result.meta.frameCount}f
                    {result.fromCache ? ' · cache' : ''}
                  </span>
                ) : null}
              </div>
              <video
                src={previewUrl}
                controls
                playsInline
                muted
                className="w-full max-h-36 object-contain bg-black"
              />
            </div>
          ) : (
            <p className="text-[9px] text-zinc-600 m-0">Capture a video to preview.</p>
          )}

          {result ? (
            <div className="text-[8px] text-zinc-500 flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="text-zinc-400 font-semibold">Confidence</span>
              {(['leftHand', 'rightHand', 'leftFoot', 'rightFoot', 'hips', 'head'] as const).map(
                (id) => {
                  const c = result.jointConfidence[id];
                  if (c == null) return null;
                  return (
                    <span key={id}>
                      {id}: {(c * 100).toFixed(0)}%
                    </span>
                  );
                }
              )}
            </div>
          ) : null}

          {report ? (
            <div className="rounded border border-zinc-800 bg-black/30 p-2 space-y-1">
              <div className="text-[9px] font-bold text-zinc-300 flex items-center gap-1">
                <Video className="w-3 h-3" /> Quality report
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8px] text-zinc-500">
                <span>Tracking: {report.trackingQuality}</span>
                <span>Avg conf: {(report.averageConfidence * 100).toFixed(0)}%</span>
                <span>Dropped: {report.droppedFrames}</span>
                <span>Corrected: {report.correctedFrames}</span>
                <span>Foot slide: {(report.footSlidingScore * 100).toFixed(0)}%</span>
                <span>Time: {report.processingTimeMs}ms</span>
              </div>
              <ul className="m-0 pl-3 text-[8px] text-zinc-500 space-y-0.5">
                {report.suggestions.slice(0, 3).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'cleanup' ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy || disabled || !result}
            onClick={autoClean}
            className="w-full flex items-center justify-center gap-1 py-2 rounded border border-amber-400/40 bg-amber-400/10 text-[9px] font-bold text-amber-100 cursor-pointer disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AUTO CLEAN MOTION
          </button>
          <p className="text-[8px] text-zinc-500 m-0">
            Removes jitter, outliers, foot sliding, fills gaps, anatomical limits, optimizes keys.
          </p>
          <button
            type="button"
            disabled={busy || !result}
            onClick={reprocessFromCache}
            className="w-full py-1.5 rounded border border-zinc-700 text-[8px] font-bold text-zinc-300 cursor-pointer disabled:opacity-40"
          >
            Rebake from cache (no re-detect)
          </button>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                ['smooth', () => result && onApplyKeyframes(result.keyframes, 'replace')],
              ] as const
            ).map(([label]) => (
              <button
                key={label}
                type="button"
                disabled={!result}
                onClick={autoClean}
                className="px-1.5 py-1 text-[8px] font-semibold rounded border border-zinc-700 text-zinc-300 cursor-pointer disabled:opacity-35"
              >
                <Wand2 className="w-3 h-3 inline mr-0.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'export' ? (
        <div className="space-y-2">
          {result ? (
            <>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => downloadWhamJson(result)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 text-[8px] font-bold rounded border border-zinc-700 text-zinc-300 cursor-pointer"
                >
                  <Download className="w-3 h-3" /> JSON
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => downloadBvh(result.sequence)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 text-[8px] font-bold rounded border border-zinc-700 text-zinc-300 cursor-pointer"
                >
                  <Download className="w-3 h-3" /> BVH
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    downloadAsMd(
                      buildAsMdDocument(result, {
                        engine: result.engine,
                        qualityReport: result.qualityReport,
                      })
                    )
                  }
                  className="inline-flex items-center justify-center gap-1 py-1.5 text-[8px] font-bold rounded border border-cyan-500/40 text-cyan-100 cursor-pointer col-span-2"
                >
                  <Download className="w-3 h-3" /> Export .md (normalized)
                </button>
              </div>
              <button
                type="button"
                disabled={busy || !onSaveToLibrary}
                onClick={saveLibrary}
                className="w-full inline-flex items-center justify-center gap-1 py-2 text-[9px] font-bold rounded border border-amber-400/40 bg-amber-400/10 text-amber-100 cursor-pointer disabled:opacity-40"
              >
                <Library className="w-3.5 h-3.5" />
                Save to Animation Library
              </button>
              <p className="text-[8px] text-zinc-500 m-0">
                VMD: bake keys to timeline, then use Editor → Export VMD (deterministic fixed FPS).
                Change character without re-processing — motion is cached.
              </p>
            </>
          ) : (
            <p className="text-[9px] text-zinc-600 m-0">Nothing to export yet.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
