import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { countSceneTriangles } from '../utils/sceneStats';
import { tickAdaptiveQuality } from '../perf/adaptiveQuality';
import { tickGpuAdaptiveQuality } from '../perf/gpuAdaptive';
import { STABLE_FPS_MAX_DELTA_MS } from '../perf/stableFps';
import { tickStablePerfResponse } from '../perf/stablePerfResponse';
import {
  tickPerfGovernor,
  getPerfGovernorScale,
  getPerfGovernorFxGate,
} from '../perf/controller/perfGovernor';
import {
  recordFrameDelta,
  getPerfSnapshot,
} from '../perf/perfStore';
import {
  setSceneTriangleCount,
  syncTriangleStressGovernor,
} from '../perf/sceneTriangleStress';
import { setGovernorPhysicsCap } from '../perf/physicsQualityControl';
import { isRecordingCapture } from '../video/recordingCapture';

export interface ViewportPerfSnapshot {
  fps: string;
  frameMs: string;
  cpuMs: string;
  gpuMs: string;
  perfLevel: string;
  status: string;
  tris: string;
  /** Internal render scale from auto perf governor (100 = native tier). */
  autoScale: string;
}

interface ViewportPerfMonitorProps {
  onUpdate: (stats: ViewportPerfSnapshot) => void;
  intervalMs?: number;
  isRecordingVideo?: boolean;
}

/** Smoothed FPS / frame budget HUD + adaptive quality controllers. */
export default function ViewportPerfMonitor({
  onUpdate,
  intervalMs = 400,
  isRecordingVideo = false,
}: ViewportPerfMonitorProps) {
  const { scene } = useThree();
  const lastHudMs = useRef(0);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useFrame((_, delta) => {
    const deltaMs = Math.min(Math.max(0, delta * 1000), STABLE_FPS_MAX_DELTA_MS);
    const ready = recordFrameDelta(deltaMs);
    if (!ready) return;

    const now = performance.now();
    const snap = getPerfSnapshot();
    const recording = isRecordingVideo || isRecordingCapture();

    tickPerfGovernor(snap.fps, now, recording);
    // Cloth/hair throttle under governor — skipped during capture so export stays full-rate.
    if (!recording) {
      const gate = getPerfGovernorFxGate();
      setGovernorPhysicsCap(gate.reducePhysics ? 1 : null);
    } else {
      setGovernorPhysicsCap(null);
    }
    tickAdaptiveQuality(snap.frameMsAvg);
    tickStablePerfResponse(snap.frameMsAvg, snap.fps, now, recording);
    tickGpuAdaptiveQuality(
      snap.frameMsAvg,
      snap.cpuMsDisplay,
      snap.gpuMsDisplay,
      snap.budgetExceeded
    );

    if (now - lastHudMs.current < intervalMs) return;
    lastHudMs.current = now;

    const tris = countSceneTriangles(scene);
    setSceneTriangleCount(tris);
    syncTriangleStressGovernor();

    const scalePct = Math.round(getPerfGovernorScale() * 100);
    onUpdateRef.current({
      fps: String(snap.fps),
      frameMs: snap.frameMs.toFixed(1),
      cpuMs: Math.round(snap.cpuMsDisplay).toString(),
      gpuMs: Math.round(snap.gpuMsDisplay).toString(),
      perfLevel: snap.perfLevel,
      status: snap.displayBottleneck,
      tris: tris.toLocaleString(),
      autoScale: `${scalePct}%`,
    });
  }, 1000);

  return null;
}
