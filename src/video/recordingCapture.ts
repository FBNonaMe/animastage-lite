/** Global capture mode — hide gizmos/grid chrome during video export (mmd_rtx CAPTURE). */
import { Vector2, type WebGLRenderer } from 'three';
import type { CameraSnapshot } from '../types';

const _captureSize = new Vector2();

export const recordingCaptureState = {
  active: false,
  hideDebug: true,
  /** Cinema Render — max quality, supersample, full post FX. */
  cinemaMode: false,
  /** Live MediaRecorder — user may keep orbiting; do not freeze framing. */
  interactive: false,
  settleFrames: 1,
  maxDpr: 2,
  targetWidth: 0,
  targetHeight: 0,
  supersample: 1,
  /** Three renderer — used to lock internal resolution for supersampling. */
  renderer: null as WebGLRenderer | null,
  savedSize: null as { width: number; height: number; pixelRatio: number } | null,
  /**
   * Live viewport camera frozen when capture starts — prevents free orbit / MY CAM
   * framing from being overwritten by keyframes, autofocus, or default stage cam.
   */
  frozenCamera: null as CameraSnapshot | null,
};

export function beginRecordingCapture(opts?: {
  cinemaMode?: boolean;
  interactive?: boolean;
  settleFrames?: number;
  maxDpr?: number;
  targetWidth?: number;
  targetHeight?: number;
  supersample?: number;
}): void {
  const alreadyActive = recordingCaptureState.active;
  recordingCaptureState.active = true;
  recordingCaptureState.cinemaMode = Boolean(opts?.cinemaMode);
  recordingCaptureState.interactive = Boolean(opts?.interactive);
  recordingCaptureState.settleFrames = opts?.settleFrames ?? 1;
  recordingCaptureState.maxDpr = opts?.maxDpr ?? 2;
  recordingCaptureState.targetWidth = opts?.targetWidth ?? 0;
  recordingCaptureState.targetHeight = opts?.targetHeight ?? 0;
  recordingCaptureState.supersample = opts?.supersample ?? 1;
  // Preserve frozen camera across nested begin() (useVideoRecorder + encoder).
  if (!alreadyActive) {
    recordingCaptureState.frozenCamera = null;
  }
}

export function endRecordingCapture(): void {
  const gl = recordingCaptureState.renderer;
  const saved = recordingCaptureState.savedSize;
  if (gl && saved) {
    try {
      gl.setPixelRatio(saved.pixelRatio);
      gl.setSize(saved.width, saved.height, false);
    } catch {
      /* ignore */
    }
  }
  recordingCaptureState.active = false;
  recordingCaptureState.cinemaMode = false;
  recordingCaptureState.interactive = false;
  recordingCaptureState.settleFrames = 1;
  recordingCaptureState.maxDpr = 2;
  recordingCaptureState.targetWidth = 0;
  recordingCaptureState.targetHeight = 0;
  recordingCaptureState.supersample = 1;
  recordingCaptureState.savedSize = null;
  recordingCaptureState.frozenCamera = null;
  // Keep renderer ref — Viewport owns setCaptureRenderer / clear on unmount.
  // Do not null it here so a follow-up export can still lock size without remount.
}

/** Clear renderer pointer (Viewport unmount / WebGL context loss). */
export function clearCaptureRenderer(): void {
  recordingCaptureState.renderer = null;
  recordingCaptureState.savedSize = null;
}

export function isRecordingCapture(): boolean {
  return recordingCaptureState.active;
}

export function isCinemaRenderCapture(): boolean {
  return recordingCaptureState.active && recordingCaptureState.cinemaMode;
}

/** Live MediaRecorder — realtime path; must not use offline export boosts. */
export function isInteractiveRecordingCapture(): boolean {
  return recordingCaptureState.active && recordingCaptureState.interactive;
}

/** Offline MP4 / Cinema — may raise quality and refresh probes every frame. */
export function isOfflineExportCapture(): boolean {
  return recordingCaptureState.active && !recordingCaptureState.interactive;
}

export function setFrozenCaptureCamera(snapshot: CameraSnapshot | null): void {
  recordingCaptureState.frozenCamera = snapshot
    ? {
        position: [...snapshot.position] as [number, number, number],
        rotation: [...snapshot.rotation] as [number, number, number],
        fov: snapshot.fov,
        target: [...snapshot.target] as [number, number, number],
      }
    : null;
}

export function getFrozenCaptureCamera(): CameraSnapshot | null {
  return recordingCaptureState.frozenCamera;
}

/** Accept R3F / Three renderer instances without fighting structural getSize typings. */
export function setCaptureRenderer(gl: unknown): void {
  recordingCaptureState.renderer = (gl as WebGLRenderer | null) ?? null;
}

/** Lock drawing buffer to target × supersample for Cinema Render. */
export function applyCinemaInternalResolution(): void {
  if (!recordingCaptureState.cinemaMode) return;
  const gl = recordingCaptureState.renderer;
  const tw = recordingCaptureState.targetWidth;
  const th = recordingCaptureState.targetHeight;
  const ss = Math.max(1, recordingCaptureState.supersample);
  if (!gl || tw < 2 || th < 2) return;

  const internalW = Math.max(2, Math.round((tw * ss) / 2) * 2);
  const internalH = Math.max(2, Math.round((th * ss) / 2) * 2);

  if (!recordingCaptureState.savedSize) {
    gl.getSize(_captureSize);
    recordingCaptureState.savedSize = {
      width: _captureSize.x,
      height: _captureSize.y,
      pixelRatio: gl.getPixelRatio(),
    };
  }

  const el = gl.domElement;
  if (el.width === internalW && el.height === internalH) return;
  gl.setPixelRatio(1);
  gl.setSize(internalW, internalH, false);
}
