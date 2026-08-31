import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  ListFilter,
} from 'lucide-react';
import { AppState, TimelineTrackId, TimelineActiveTrack, TemplateApplyMode } from '../types';
import {
  TIMELINE_TRACK_IDS,
  TIMELINE_TRACK_LABELS,
  countTimelineKeyframes,
  getKeyframesForTrack,
} from './TimelineLogic';
import { countCameraKeyframes } from './CameraLogic';
import TimelineToolsBar from './TimelineToolsBar';
import { playheadRef, MMD_FPS } from '../utils/playhead';
import { useStudioLayout } from '../hooks/useStudioLayout';

const FRAME_WIDTH_DESKTOP = 24;
const FRAME_WIDTH_MOBILE = 16;
/** @deprecated Use `frameWidth` in Timeline — module alias avoids HMR ReferenceError */
const FRAME_WIDTH = FRAME_WIDTH_DESKTOP;
const VIRTUAL_BUFFER_DESKTOP = 40;
const VIRTUAL_BUFFER_MOBILE = 16;

function useVisibleFrameRange(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  maxFrames: number,
  frameWidth: number,
  buffer = VIRTUAL_BUFFER_DESKTOP
) {
  const [range, setRange] = useState({ start: 0, end: Math.min(maxFrames, 120) });

  const updateRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const start = Math.max(0, Math.floor(el.scrollLeft / frameWidth) - buffer);
    const end = Math.min(
      maxFrames,
      Math.ceil((el.scrollLeft + el.clientWidth) / frameWidth) + buffer
    );
    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [scrollRef, maxFrames, frameWidth, buffer]);

  useEffect(() => {
    updateRange();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateRange, { passive: true });
    const ro = new ResizeObserver(updateRange);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateRange);
      ro.disconnect();
    };
  }, [updateRange]);

  return range;
}

function playheadOffset(frame: number, frameWidth: number) {
  return frame * frameWidth + frameWidth / 2 - 1;
}

function TimelinePlayhead({
  isPlaying,
  pausedFrame,
  frameWidth,
}: {
  isPlaying: boolean;
  pausedFrame: number;
  frameWidth: number;
}) {
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;

    if (!isPlaying) {
      line.style.transform = `translateX(${playheadOffset(pausedFrame, frameWidth)}px)`;
      return;
    }

    let raf = 0;
    const tick = () => {
      if (lineRef.current) {
        lineRef.current.style.transform = `translateX(${playheadOffset(playheadRef.current, frameWidth)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, pausedFrame, frameWidth]);

  return (
    <div
      ref={lineRef}
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none will-change-transform"
      style={{ left: 0, transform: `translateX(${playheadOffset(pausedFrame, frameWidth)}px)` }}
    >
      <div className="w-2.5 h-2.5 bg-red-500 rotate-45 border border-zinc-950 shadow -mt-1" />
    </div>
  );
}

function LiveFrameCounter({
  isPlaying,
  pausedFrame,
  maxFrames,
  onSetFrame,
}: {
  isPlaying: boolean;
  pausedFrame: number;
  maxFrames: number;
  onSetFrame: (frame: number) => void;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const span = spanRef.current;
    if (!span) return;

    let raf = 0;
    const tick = () => {
      if (spanRef.current) {
        spanRef.current.textContent = String(Math.floor(playheadRef.current));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  if (!isPlaying) {
    return (
      <input
        type="number"
        min={0}
        max={maxFrames}
        value={pausedFrame}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!Number.isNaN(val)) {
            onSetFrame(Math.min(maxFrames, Math.max(0, val)));
          }
        }}
        className="w-10 bg-zinc-900/60 text-xs font-mono font-bold text-[#39c5bb] text-center border border-zinc-800 rounded outline-none py-0.5"
      />
    );
  }

  return (
    <span
      ref={spanRef}
      className="w-10 inline-block text-center text-xs font-mono font-bold text-[#39c5bb]"
    >
      {pausedFrame}
    </span>
  );
}

interface TimelineProps {
  appState: AppState;
  setCurrentFrame: (frame: number) => void;
  setMaxFrames: (frames: number) => void;
  setIsPlaying: (playing: boolean) => void;
  onRegisterKeyframe: (modelId: string) => void;
  onDeleteKeyframe: (modelId: string, trackName: string, frame: number) => void;
  onSelectTrack: (track: TimelineActiveTrack) => void;
  onApplyTemplate: (templateId: string, mode?: TemplateApplyMode) => void;
  onClearAllKeyframes: () => void;
  onSetVmdPlaybackEnabled?: (modelId: string, enabled: boolean) => void;
}

const TRACK_DEFINITIONS = [
  { id: 'camera' as const, label: 'Camera Track', group: 'CAM' },
  ...TIMELINE_TRACK_IDS.map((id) => ({
    id,
    label: TIMELINE_TRACK_LABELS[id],
    group: id.startsWith('morph_') ? 'MORPH' : 'BONE',
  })),
];

const TRACK_SHORT_LABELS: Record<string, string> = {
  camera: 'Cam',
  morph_eyes: 'Eyes',
  morph_mouth: 'Mouth',
  morph_brow: 'Brow',
  bone_head_y: 'Head Y',
  bone_neck_x: 'Neck X',
  bone_spine_y: 'Spine Y',
  bone_spine_z: 'Lean Z',
  bone_waist_y: 'Hips Y',
  bone_l_arm_x: 'L Arm X',
  bone_l_arm_z: 'L Arm Z',
  bone_r_arm_x: 'R Arm X',
  bone_r_arm_z: 'R Arm Z',
};

export default function Timeline({
  appState,
  setCurrentFrame,
  setMaxFrames,
  setIsPlaying,
  onRegisterKeyframe,
  onDeleteKeyframe,
  onSelectTrack,
  onApplyTemplate,
  onClearAllKeyframes,
  onSetVmdPlaybackEnabled,
}: TimelineProps) {
  const { currentFrame, maxFrames, isPlaying, models, selectedObjectId, timelineActiveTrack, cameraKeyframes } =
    appState;
  const activeModel = models.find((m) => m.id === selectedObjectId);
  const [applyMode, setApplyMode] = useState<TemplateApplyMode>('merge');
  const { isProMobile, isMobileLayout } = useStudioLayout();
  const isMobile = isMobileLayout;
  const showTrackRail = !isMobile || isProMobile;
  const [zoomScale, setZoomScale] = useState(1);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const baseFrameWidth = isProMobile ? 14 : isMobile ? FRAME_WIDTH_MOBILE : FRAME_WIDTH_DESKTOP;
  const frameWidth = Math.round(baseFrameWidth * zoomScale);

  const onTimelineTouchStart = useCallback((e: React.TouchEvent) => {
    // Pinch-zoom only with two fingers — single-finger stays horizontal scrub/pan.
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), scale: zoomScale };
    } else {
      pinchRef.current = null;
    }
  }, [zoomScale]);

  const onTimelineTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    e.preventDefault();
    const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
    const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
    const dist = Math.hypot(dx, dy);
    if (pinchRef.current.dist < 8) return;
    const next = Math.min(2.5, Math.max(0.55, (pinchRef.current.scale * dist) / pinchRef.current.dist));
    setZoomScale(next);
  }, []);

  const onTimelineTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  }, []);

  const applyWithMode = (templateId: string) => onApplyTemplate(templateId, applyMode);
  const modelKeyCount = activeModel ? countTimelineKeyframes(activeModel.keyframes) : 0;
  const cameraKeyCount = countCameraKeyframes(cameraKeyframes);
  const vmdActive =
    Boolean(activeModel?.hasVmdAnimation) && activeModel?.vmdPlaybackEnabled !== false;
  const vmdClipName =
    activeModel?.vmdFileNames?.[
      Math.min(
        Math.max(0, activeModel.activeVmdIndex ?? (activeModel.vmdFileNames?.length ?? 1) - 1),
        Math.max(0, (activeModel.vmdFileNames?.length ?? 1) - 1)
      )
    ] ?? 'VMD Motion';

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const totalKeys = modelKeyCount + cameraKeyCount;
  const totalWidth = (maxFrames + 1) * frameWidth;
  const { start: visStart, end: visEnd } = useVisibleFrameRange(
    timelineScrollRef,
    maxFrames,
    frameWidth,
    isMobile ? VIRTUAL_BUFFER_MOBILE : VIRTUAL_BUFFER_DESKTOP
  );

  const visibleFrames = useMemo(() => {
    const frames: number[] = [];
    for (let i = visStart; i <= visEnd; i++) frames.push(i);
    return frames;
  }, [visStart, visEnd]);

  useEffect(() => {
    if (!isMobile || timelineActiveTrack) return;
    onSelectTrack('morph_eyes');
  }, [isMobile, timelineActiveTrack, onSelectTrack]);

  useEffect(() => {
    if (isPlaying) return;
    const container = timelineScrollRef.current;
    if (!container) return;
    const targetScroll = currentFrame * frameWidth - container.clientWidth / 2 + frameWidth * 4;
    container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'auto' });
  }, [currentFrame, isPlaying, frameWidth]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const container = timelineScrollRef.current;
      if (container) {
        const targetScroll =
          playheadRef.current * frameWidth - container.clientWidth / 2 + frameWidth * 4;
        container.scrollLeft = Math.max(0, targetScroll);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, frameWidth]);

  const transportBtn =
    'cursor-pointer text-zinc-300 bg-[#1e212a] border border-zinc-800 hover:bg-zinc-800 hover:text-white flex items-center justify-center rounded transition-all shrink-0';
  const transportBtnMd = `${transportBtn} p-1 px-2`;
  const transportBtnSm = `${transportBtn} p-1.5 min-w-[36px] min-h-[36px]`;

  return (
    <div
      className={`bg-[#16181d] select-none flex flex-col w-full text-zinc-100 font-sans ${
        isProMobile
          ? 'flex-1 min-h-0 h-full border-0 shadow-none'
          : 'border-t border-zinc-800 h-full min-h-0 shadow-lg'
      }`}
      id="mmd-timeline"
    >
      {/* Transport + frame (mobile: stacked; desktop: one row) */}
      <div className="shrink-0 border-b border-zinc-800 bg-[#16181d] px-2 py-1 md:px-2.5 md:py-0 md:h-9 flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-0 overflow-visible">
        <div className="flex items-center gap-0.5 md:gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCurrentFrame(0)}
            className={isMobile ? transportBtnSm : transportBtnMd}
            aria-label="First frame"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
            className={isMobile ? transportBtnSm : transportBtnMd}
            aria-label="Previous frame"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`cursor-pointer text-xs font-bold border rounded flex items-center gap-1 shadow-sm shrink-0 ${
              isMobile ? 'p-1.5 min-w-[44px] min-h-[36px] justify-center' : 'p-1.5 px-3.5 gap-1.5'
            } ${
              isPlaying
                ? 'bg-red-950/40 border-red-500/50 text-red-400'
                : 'bg-emerald-950/40 border-emerald-500/40 text-[#4ade80]'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span className="hidden md:inline">{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentFrame(0);
            }}
            className={isMobile ? transportBtnSm : `${transportBtnMd} gap-1`}
            aria-label="Stop"
          >
            <Square className="w-3.5 h-3.5 fill-zinc-400" />
            <span className="hidden md:inline">STOP</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentFrame(Math.min(maxFrames, currentFrame + 1))}
            className={isMobile ? transportBtnSm : transportBtnMd}
            aria-label="Next frame"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentFrame(maxFrames)}
            className={isMobile ? transportBtnSm : transportBtnMd}
            aria-label="Last frame"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1 bg-[#111317] border border-zinc-800 rounded px-2 py-1 font-mono text-xs ml-1 shrink-0 md:hidden">
            <span className="text-[9px] text-zinc-500 font-bold">FR</span>
            <LiveFrameCounter
              isPlaying={isPlaying}
              pausedFrame={currentFrame}
              maxFrames={maxFrames}
              onSetFrame={setCurrentFrame}
            />
            <span className="text-zinc-600">/</span>
            <input
              type="number"
              min={10}
              value={maxFrames}
              onChange={(e) => setMaxFrames(Math.max(10, parseInt(e.target.value, 10) || 120))}
              className="w-9 bg-zinc-900/60 text-[10px] font-mono text-zinc-300 font-bold text-center border border-zinc-800 rounded outline-none py-0.5"
              aria-label="Total frames"
            />
          </div>

        </div>

        {/* Mobile: compact tools + bottom-sheet templates */}
        <div className="md:hidden w-full overflow-x-auto py-1 touch-pan-x">
          <TimelineToolsBar
            variant="mobile"
            applyMode={applyMode}
            onToggleApplyMode={() => setApplyMode((m) => (m === 'merge' ? 'replace' : 'merge'))}
            applyWithMode={applyWithMode}
            hasModel={Boolean(activeModel)}
            vmdActive={vmdActive}
            modelKeyCount={modelKeyCount}
            cameraKeyCount={cameraKeyCount}
            onClearAllKeyframes={onClearAllKeyframes}
            timelineActiveTrack={timelineActiveTrack}
            onRegisterKeyframe={() => onRegisterKeyframe(activeModel?.id ?? '')}
          />
        </div>

        <div className="hidden md:flex items-center space-x-2 min-w-0 overflow-visible">
          <TimelineToolsBar
            variant="desktop"
            applyMode={applyMode}
            onToggleApplyMode={() => setApplyMode((m) => (m === 'merge' ? 'replace' : 'merge'))}
            applyWithMode={applyWithMode}
            hasModel={Boolean(activeModel)}
            vmdActive={vmdActive}
            modelKeyCount={modelKeyCount}
            cameraKeyCount={cameraKeyCount}
            onClearAllKeyframes={onClearAllKeyframes}
            timelineActiveTrack={timelineActiveTrack}
            onRegisterKeyframe={() => onRegisterKeyframe(activeModel?.id ?? '')}
          />

          <div className="flex items-center space-x-1.5 bg-[#111317] border border-zinc-800 rounded px-2.5 py-1 font-mono text-xs shrink-0">
            <span className="text-[10px] text-zinc-450 font-bold">FRAME:</span>
            <LiveFrameCounter
              isPlaying={isPlaying}
              pausedFrame={currentFrame}
              maxFrames={maxFrames}
              onSetFrame={setCurrentFrame}
            />
            <span className="text-zinc-600">/</span>
            <input
              type="number"
              min={10}
              value={maxFrames}
              onChange={(e) => setMaxFrames(Math.max(10, parseInt(e.target.value, 10) || 120))}
              className="w-10 bg-zinc-900/60 text-xs font-mono text-zinc-450 font-bold text-center border border-zinc-800 rounded outline-none py-0.5"
            />
          </div>
        </div>
      </div>

      {/* Legacy mobile chips — hidden when Pro Mobile shows track rail */}
      {isMobile && !showTrackRail ? (
        <div className="shrink-0 border-b border-zinc-800 bg-[#121418] px-1.5 py-1 overflow-x-auto">
          <div className="flex gap-1 min-w-min">
            {TRACK_DEFINITIONS.map((track) => {
              const isActive = timelineActiveTrack === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onSelectTrack(track.id as TimelineActiveTrack)}
                  className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                    isActive
                      ? 'bg-[#39c5bb]/15 border-[#39c5bb]/50 text-[#39c5bb]'
                      : 'bg-[#1a1d24] border-zinc-800 text-zinc-400'
                  }`}
                  title={track.label}
                >
                  {TRACK_SHORT_LABELS[track.id] ?? track.group}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {showTrackRail ? (
          <div
            className={`timeline-track-rail border-r border-[#22252c] bg-[#121418] flex-col shrink-0 min-h-0 flex ${
              isProMobile ? 'w-[7.25rem]' : 'hidden md:flex w-44'
            }`}
          >
            <div
              className={`border-b border-zinc-800 flex items-center justify-between font-bold text-[#39c5bb] uppercase bg-[#1c1e24] shrink-0 ${
                isProMobile ? 'h-7 px-2 text-[8px]' : 'h-7 px-2 text-[9px]'
              }`}
            >
              <span className="truncate">{isProMobile ? 'Tracks' : 'Tracks'}</span>
              <ListFilter className={`text-zinc-500 shrink-0 ${isProMobile ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-850 min-h-0">
              {vmdActive ? (
                <div
                  className={`flex items-center justify-between gap-1 border-b border-zinc-850 ${
                    isProMobile ? 'h-7 px-1.5' : 'h-7 px-2'
                  } bg-amber-500/10 border-l-2 border-l-amber-400`}
                >
                  <span
                    className={`truncate font-semibold leading-tight text-amber-200 ${
                      isProMobile ? 'text-[9px]' : 'text-[11px]'
                    }`}
                    title={vmdClipName}
                  >
                    Motion (VMD)
                  </span>
                  <button
                    type="button"
                    className={`text-amber-100 bg-amber-950/50 border border-amber-700/50 font-bold uppercase rounded-sm shrink-0 cursor-pointer hover:bg-amber-900/60 ${
                      isProMobile ? 'text-[7px] px-0.5 py-px' : 'text-[8px] px-1.5 py-0.5'
                    }`}
                    title="Turn off imported VMD so timeline keys / bone edits control the pose"
                    onClick={() => {
                      if (activeModel?.id && onSetVmdPlaybackEnabled) {
                        onSetVmdPlaybackEnabled(activeModel.id, false);
                      }
                    }}
                  >
                    Use timeline
                  </button>
                </div>
              ) : null}
              {TRACK_DEFINITIONS.map((track) => {
                const isActive = timelineActiveTrack === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => onSelectTrack(track.id as TimelineActiveTrack)}
                    className={`flex items-center justify-between hover:bg-zinc-800/50 border-b border-zinc-850 cursor-pointer ${
                      isProMobile ? 'h-7 px-1.5' : 'h-7 px-2'
                    } ${isActive ? 'bg-[#39c5bb]/10 border-l-2 border-l-[#39c5bb]' : ''}`}
                  >
                    <span
                      className={`truncate font-semibold pr-1 leading-tight ${
                        isProMobile ? 'text-[9px]' : 'text-[11px] pr-1'
                      } ${isActive ? 'text-[#39c5bb]' : 'text-zinc-300'}`}
                    >
                      {track.label}
                    </span>
                    <span
                      className={`text-[#39c5bb]/80 bg-zinc-900 border border-zinc-800 font-mono uppercase rounded-sm shrink-0 ${
                        isProMobile ? 'text-[7px] px-0.5 py-px' : 'text-[8px] px-1 py-0.5'
                      }`}
                    >
                      {track.group}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div
          ref={timelineScrollRef}
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden bg-[#0e0f12] relative touch-pan-x"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2d35 #0e0f12' }}
          onTouchStart={isMobile ? onTimelineTouchStart : undefined}
          onTouchMove={isMobile ? onTimelineTouchMove : undefined}
          onTouchEnd={isMobile ? onTimelineTouchEnd : undefined}
          onTouchCancel={isMobile ? onTimelineTouchEnd : undefined}
        >
          <div className="min-w-max h-full flex flex-col" style={{ width: totalWidth }}>
            <div className="h-7 border-b border-zinc-850 bg-[#16181d] flex relative shrink-0">
              <div
                className="absolute top-0 bottom-0 flex"
                style={{ left: visStart * frameWidth }}
              >
                {visibleFrames.map((frame) => {
                  const tickEvery = isMobile ? 5 : 10;
                  const isTick = frame % tickEvery === 0;
                  const isCurrent = !isPlaying && frame === currentFrame;
                  return (
                    <div
                      key={frame}
                      onClick={() => setCurrentFrame(frame)}
                      className="shrink-0 h-full flex flex-col justify-end items-center relative cursor-pointer border-r border-zinc-900/30 hover:bg-zinc-800/30"
                      style={{ width: frameWidth }}
                    >
                      <div className={`w-px bg-zinc-700 ${isTick ? 'h-3 md:h-3.5 bg-zinc-500' : 'h-1 md:h-1.5'}`} />
                      {isTick && (
                        <span className="text-[8px] md:text-[9px] font-mono font-bold text-zinc-400 absolute bottom-1 md:bottom-3">
                          {frame}
                        </span>
                      )}
                      {isCurrent && (
                        <div className="absolute inset-0 bg-teal-500/10 pointer-events-none" />
                      )}
                    </div>
                  );
                })}
              </div>
              <TimelinePlayhead
                isPlaying={isPlaying}
                pausedFrame={currentFrame}
                frameWidth={frameWidth}
              />
            </div>

            <div
              className={`flex-1 overflow-y-auto min-h-0 ${
                isProMobile ? 'min-h-[140px]' : 'max-md:max-h-[28dvh]'
              }`}
            >
              {vmdActive ? (
                <div className="h-7 flex relative border-b border-amber-900/30 bg-amber-500/5">
                  <div
                    className="absolute top-1 bottom-1 rounded-sm bg-gradient-to-r from-amber-500/70 to-amber-400/40 border border-amber-400/40 flex items-center px-2 z-[5] pointer-events-none"
                    style={{
                      left: `${frameWidth * 0.15}px`,
                      width: `${Math.max(frameWidth * 4, (maxFrames - 0.3) * frameWidth)}px`,
                    }}
                  >
                    <span className="text-[8px] md:text-[9px] font-bold text-amber-50 truncate">
                      {vmdClipName} · live VMD — press Use timeline or Add Key to unlock keys
                    </span>
                  </div>
                </div>
              ) : null}
              {TRACK_DEFINITIONS.map((track) => {
                const isCameraTrack = track.id === 'camera';
                const trackKeys = isCameraTrack
                  ? cameraKeyframes.map((kf) => ({
                      id: kf.id,
                      frame: kf.frame,
                      value: kf.fov,
                    }))
                  : activeModel
                    ? getKeyframesForTrack(activeModel.keyframes, track.id as TimelineTrackId)
                    : [];

                const rowHiddenOnMobile =
                  isMobile &&
                  !isProMobile &&
                  timelineActiveTrack != null &&
                  timelineActiveTrack !== track.id;

                return (
                  <div
                    key={track.id}
                    className={`h-7 flex relative border-b border-zinc-900/40 ${
                      rowHiddenOnMobile ? 'max-md:hidden' : ''
                    }`}
                  >
                    <div
                      className="absolute top-0 bottom-0 flex"
                      style={{ left: visStart * frameWidth }}
                    >
                      {visibleFrames.map((frame) => (
                        <div
                          key={frame}
                          className={`shrink-0 h-full border-r border-zinc-900/35 ${
                            !isPlaying && frame === currentFrame ? 'bg-red-500/5' : ''
                          } ${timelineActiveTrack === track.id ? 'bg-teal-500/5' : ''}`}
                          style={{ width: frameWidth }}
                          onClick={() => setCurrentFrame(frame)}
                          onDoubleClick={() => {
                            onSelectTrack(track.id as TimelineActiveTrack);
                            if (isCameraTrack || activeModel) {
                              onRegisterKeyframe(activeModel?.id ?? '');
                            }
                          }}
                        />
                      ))}
                    </div>

                    {trackKeys.map((keyframe) => {
                      const isCurrentKF = keyframe.frame === currentFrame;
                      return (
                        <div
                          key={keyframe.id}
                          className="absolute top-1/2 -translate-y-1/2 z-10 cursor-pointer group/kf"
                          style={{
                            left: `${keyframe.frame * frameWidth + Math.max(4, frameWidth * 0.25)}px`,
                          }}
                          title={`Frame ${keyframe.frame}: ${keyframe.value.toFixed(2)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentFrame(keyframe.frame);
                          }}
                        >
                          <div
                            className={`w-2.5 h-2.5 rotate-45 border transition-all ${
                              isCameraTrack
                                ? isCurrentKF
                                  ? 'bg-[#e879ff] border-white scale-125 shadow-lg shadow-[#e879ff]/30'
                                  : 'bg-violet-500 hover:bg-[#e879ff] border-violet-600 shadow-md'
                                : isCurrentKF
                                  ? 'bg-[#ff3385] border-white scale-125 shadow-lg shadow-[#ff3385]/30'
                                  : 'bg-teal-500 hover:bg-[#39c5bb] border-teal-600 shadow-md'
                            }`}
                          />
                          <div className="hidden group-hover/kf:flex absolute bg-zinc-950 border border-zinc-800 text-[9px] w-36 -top-11 left-1/2 -translate-x-1/2 pointer-events-auto items-center justify-between gap-1.5 z-50 rounded shadow-2xl px-1.5 py-1">
                            <span className="font-mono text-zinc-300">
                              Fr {keyframe.frame} ({keyframe.value.toFixed(1)})
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isCameraTrack) {
                                  onDeleteKeyframe(activeModel?.id ?? '', 'camera', keyframe.frame);
                                } else if (activeModel) {
                                  onDeleteKeyframe(activeModel.id, track.id, keyframe.frame);
                                }
                              }}
                              className="text-[#ff3385] hover:text-white font-extrabold"
                            >
                              DEL
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`shrink-0 border-t border-zinc-800 bg-[#121418] flex items-center justify-between font-mono text-zinc-400 ${
          isProMobile
            ? 'px-2 py-1.5 text-[8px] min-h-[32px]'
            : 'px-2 py-0.5 md:px-3 md:py-0 md:h-6 text-[8px] md:text-[10px]'
        }`}
      >
        {isProMobile ? (
          <div className="flex flex-col gap-0.5 min-w-0 flex-1 leading-tight">
            <span>
              MMD timeline: <span className="text-[#39c5bb] font-bold">{MMD_FPS}</span> fps · Smooth
              playback: <span className="text-[#39c5bb] font-bold">display refresh</span>
            </span>
            <span>Sample Mode: Linear Interpolation</span>
          </div>
        ) : (
          <>
            <span className="md:hidden truncate">
              {MMD_FPS} fps · Linear
              {timelineActiveTrack && (
                <>
                  {' '}
                  ·{' '}
                  <span className="text-[#e879ff]">
                    {TRACK_SHORT_LABELS[timelineActiveTrack] ?? timelineActiveTrack}
                  </span>
                </>
              )}
            </span>
            <div className="hidden md:flex items-center space-x-4">
              <span>
                MMD timeline: <span className="text-[#39c5bb] font-bold">{MMD_FPS}</span> fps · Smooth
                playback: <span className="text-[#39c5bb] font-bold">display refresh</span>
              </span>
              <span>Sample Mode: Linear Interpolation</span>
            </div>
          </>
        )}
        <span className="shrink-0 ml-2 md:ml-0">
          {activeModel || cameraKeyframes.length > 0 ? (
            <>
              <span className="text-[#39c5bb] font-bold">{totalKeys}</span>
              <span className="hidden sm:inline"> keyframes · </span>
              <span className="sm:hidden"> keys · </span>
              <span className="text-[#39c5bb] font-bold">{TRACK_DEFINITIONS.length}</span>
              <span className="hidden md:inline"> tracks</span>
              {timelineActiveTrack && (
                <span className="hidden md:inline">
                  {' '}
                  · active:{' '}
                  <span className="text-[#e879ff] font-bold">{timelineActiveTrack}</span>
                </span>
              )}
            </>
          ) : (
            'Stage clear'
          )}
        </span>
      </div>
    </div>
  );
}
