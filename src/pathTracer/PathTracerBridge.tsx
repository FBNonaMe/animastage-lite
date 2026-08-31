import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { AppState } from '../types';
import { DEFAULT_PATH_TRACER_SETTINGS } from '../types';
import { bakeSceneForPathTracer, cameraFromThree, focusDistFromBaked } from './meshBake';
import { PathTracerEngine } from './PathTracerEngine';
import { resolvePathTracerTierConfig } from './pathTracerTierConfig';
import { PathTracerQualityGovernor } from './pathTracerAdaptive';
import { bakedSceneSignature, pathTracerMotionKey } from './sceneFingerprint';
import {
  isPathTracerSettled,
  PATH_TRACER_LAB_SAFE_LIMITS,
} from './pathTracerSafety';
import type { PathTracerRenderSettings, PathTracerSceneData, PathTracerLabHudStats } from './types';
import { loadOidnDenoiser, oidnIsSupported, type OidnDenoiser } from './oidn/OidnClient';

interface PathTracerBridgeProps {
  appState: AppState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  pathTracerCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
  isRecordingVideo?: boolean;
  resetToken?: number;
  onHudUpdate?: (stats: PathTracerLabHudStats) => void;
  /** Import / PMX load in progress — skip all GPU work. */
  sceneBusy?: boolean;
  /** performance.now() threshold before first bake. */
  modelSettleUntil?: number;
}

function hasVisibleModels(appState: AppState): boolean {
  return appState.models.some((m) => m.visible);
}

function buildRenderSettings(
  appState: AppState,
  labWithScene: boolean,
  adaptive?: {
    enableDenoise: boolean;
    denoiseMaxRadius: number;
    samplesPerFrame: number;
    maxBounces: number;
  }
): PathTracerRenderSettings {
  const tier = resolvePathTracerTierConfig(appState.renderTier, labWithScene);
  const pt = appState.pathTracer ?? DEFAULT_PATH_TRACER_SETTINGS;
  const userBounces = Math.min(5, Math.max(1, pt.bounces));
  const oidnOn = pt.oidnEnabled === true;
  const preferOidn = pt.oidnPreferAi !== false;
  const baseDenoise = adaptive?.enableDenoise ?? tier.enableDenoise;
  return {
    visualFx: appState.visualFx,
    bounces: labWithScene
      ? Math.min(userBounces, adaptive?.maxBounces ?? tier.maxBounces, tier.maxBounces)
      : tier.maxBounces,
    samplesPerFrame: adaptive?.samplesPerFrame ?? 1,
    denoise: oidnOn && preferOidn ? false : baseDenoise,
    denoiseMaxRadius: adaptive?.denoiseMaxRadius ?? tier.denoiseMaxRadius,
    bloom: tier.enableBloom,
    bloomThreshold: appState.visualFx.bloomThreshold ?? 0.85,
    bloomStrength: tier.enableBloom
      ? (appState.visualFx.bloomIntensity ?? 0.45) * 0.2
      : 0,
    exposure: labWithScene ? pt.exposure : tier.exposure,
    vignetteStrength: appState.visualFx.vignetteEnabled
      ? appState.visualFx.vignetteIntensity * 0.25
      : 0.12,
    floorY: 0,
    resolutionScale: tier.resolutionScale,
    textureSize: tier.textureSize,
    maxTextures: tier.maxTextures,
    maxInternalWidth: tier.maxInternalWidth,
    maxInternalHeight: tier.maxInternalHeight,
    sunIntensityScale: tier.sunIntensityScale,
    enableNEE: tier.enableNEE,
    sunAltDeg: labWithScene ? pt.sunAltDeg : undefined,
    sunAzimuth: -0.65,
  };
}

function bakeOptions(
  appState: AppState,
  labWithScene: boolean,
  maxTriangles?: number
) {
  const tier = resolvePathTracerTierConfig(appState.renderTier, labWithScene);
  return {
    maxTriangles: maxTriangles ?? tier.maxTriangles,
    maxTextures: tier.maxTextures,
    skipAlphaMaterials: tier.skipAlphaMaterials,
  };
}

function setOverlayVisible(
  canvas: HTMLCanvasElement | null | undefined,
  visible: boolean,
  sampleCount = 0,
  labMode = false
): void {
  if (!canvas) return;
  if (!visible || sampleCount <= 0) {
    canvas.style.opacity = '0';
    canvas.style.zIndex = '-1';
    return;
  }
  const fade = labMode
    ? Math.min(1, sampleCount < 4 ? 0.25 + sampleCount * 0.15 : 0.85 + Math.min(0.15, sampleCount / 200))
    : Math.min(1, sampleCount / 8);
  canvas.style.opacity = String(fade);
  canvas.style.zIndex = '55';
  canvas.style.pointerEvents = 'none';
}

export default function PathTracerBridge({
  appState,
  containerRef,
  pathTracerCanvasRef,
  isRecordingVideo = false,
  resetToken = 0,
  onHudUpdate,
  sceneBusy = false,
  modelSettleUntil = 0,
}: PathTracerBridgeProps) {
  const { scene, camera, size } = useThree();
  const engineRef = useRef<PathTracerEngine | null>(null);
  const gpuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const uploadTickRef = useRef(0);
  const cachedSceneRef = useRef<PathTracerSceneData | null>(null);
  const bakedSigRef = useRef('');
  const motionKeyRef = useRef('');
  const lastCamPosRef = useRef(new THREE.Vector3());
  const lastCamQuatRef = useRef(new THREE.Quaternion());
  const cameraTrackingInitRef = useRef(false);
  const lastPreviewMsRef = useRef(0);
  const uploadBusyRef = useRef(false);
  const governorRef = useRef<PathTracerQualityGovernor | null>(null);
  const appliedScaleRef = useRef(-1);
  const fpsAccRef = useRef(0);
  const fpsNRef = useRef(0);
  const lastFpsMsRef = useRef(0);
  const frameMsRef = useRef(16);
  const lastCameraStillRef = useRef(true);
  const effectiveBouncesRef = useRef(3);
  const oidnRef = useRef<OidnDenoiser | null>(null);
  const oidnOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const oidnBusyRef = useRef(false);
  const lastOidnFrameRef = useRef(0);

  const labWithScene =
    appState.pathTracerLabEnabled && hasVisibleModels(appState);
  const tierCfg = resolvePathTracerTierConfig(appState.renderTier, labWithScene);

  const pt = appState.pathTracer ?? DEFAULT_PATH_TRACER_SETTINGS;

  const pathTraceVideo = isRecordingVideo;
  const pathTracePreview =
    tierCfg.previewEnabled &&
    appState.rtxModeEnabled &&
    !appState.isPlaying &&
    !appState.pathTracerLabEnabled;
  const pathTraceLab = labWithScene && !appState.isPlaying;
  const pathTraceActive = pathTracePreview || pathTraceVideo || pathTraceLab;

  useEffect(() => {
    if (pathTraceLab && !governorRef.current) {
      governorRef.current = new PathTracerQualityGovernor(
        tierCfg.resolutionScale,
        tierCfg.maxTriangles,
        PATH_TRACER_LAB_SAFE_LIMITS
      );
    }
    if (!pathTraceLab) {
      governorRef.current = null;
      appliedScaleRef.current = -1;
    }
  }, [pathTraceLab, tierCfg.resolutionScale, tierCfg.maxTriangles]);

  useEffect(() => {
    if (!pathTraceActive) {
      setOverlayVisible(pathTracerCanvasRef?.current, false);
      engineRef.current?.dispose();
      engineRef.current = null;
      initPromiseRef.current = null;
      gpuCanvasRef.current?.remove();
      gpuCanvasRef.current = null;
      if (pathTracerCanvasRef) pathTracerCanvasRef.current = null;
      cachedSceneRef.current = null;
      return;
    }

    let cancelled = false;
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 w-full h-full pointer-events-none';
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 0.2s';
    containerRef.current?.appendChild(canvas);
    gpuCanvasRef.current = canvas;
    if (pathTracerCanvasRef) pathTracerCanvasRef.current = canvas;

    const oidnOverlay = document.createElement('canvas');
    oidnOverlay.className = 'absolute inset-0 w-full h-full pointer-events-none';
    oidnOverlay.style.opacity = '0';
    oidnOverlay.style.zIndex = '56';
    containerRef.current?.appendChild(oidnOverlay);
    oidnOverlayRef.current = oidnOverlay;

    if (appState.pathTracer?.oidnEnabled && oidnIsSupported()) {
      void loadOidnDenoiser().then((d) => {
        oidnRef.current = d;
      });
    }

    const engine = new PathTracerEngine(canvas);
    engineRef.current = engine;
    initPromiseRef.current = PathTracerEngine.isSupported()
      .then(async (ok) => {
        if (!ok || cancelled) return;
        await engine.init();
        if (cancelled) return;
        engine.setSettings(buildRenderSettings(appState, labWithScene));
        engine.resize(size.width, size.height, tierCfg.resolutionScale);
        appliedScaleRef.current = tierCfg.resolutionScale;
      })
      .catch((err) => {
        console.warn('[PathTracer] Init failed:', err);
      });

    return () => {
      cancelled = true;
      engine.dispose();
      canvas.remove();
      oidnOverlayRef.current?.remove();
      oidnOverlayRef.current = null;
      gpuCanvasRef.current = null;
      if (pathTracerCanvasRef) pathTracerCanvasRef.current = null;
      engineRef.current = null;
      initPromiseRef.current = null;
      cachedSceneRef.current = null;
    };
  }, [pathTraceActive, containerRef, pathTracerCanvasRef, labWithScene]);

  useEffect(() => {
    if (!appState.pathTracer?.oidnEnabled || !oidnIsSupported()) {
      oidnRef.current?.abort();
      oidnRef.current = null;
      if (oidnOverlayRef.current) oidnOverlayRef.current.style.opacity = '0';
      if (pathTracerCanvasRef?.current) pathTracerCanvasRef.current.style.opacity = '';
      return;
    }
    void loadOidnDenoiser().then((d) => {
      oidnRef.current = d;
    });
  }, [appState.pathTracer?.oidnEnabled, pathTracerCanvasRef]);

  useEffect(() => {
    void initPromiseRef.current?.then(() => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setSettings(buildRenderSettings(appState, labWithScene));
      const scale =
        pathTraceLab && governorRef.current
          ? governorRef.current.tick(16, true, pt.bounces)
              .resolutionScale
          : tierCfg.resolutionScale;
      if (Math.abs(scale - appliedScaleRef.current) > 0.02) {
        engine.resize(size.width, size.height, scale);
        appliedScaleRef.current = scale;
      }
    });
  }, [
    size.width,
    size.height,
    appState.renderTier,
    appState.pathTracer,
    labWithScene,
    pathTraceLab,
  ]);

  useEffect(() => {
    if (!pathTraceActive) {
      setOverlayVisible(pathTracerCanvasRef?.current, false);
    }
  }, [pathTraceActive, pathTracerCanvasRef]);

  useEffect(() => {
    cachedSceneRef.current = null;
    bakedSigRef.current = '';
    motionKeyRef.current = '';
    uploadTickRef.current = 0;
    cameraTrackingInitRef.current = false;
    governorRef.current?.reset(tierCfg.resolutionScale, tierCfg.maxTriangles);
    engineRef.current?.resetAccumulation();
    setOverlayVisible(pathTracerCanvasRef?.current, false);
  }, [appState.models.length, pathTracerCanvasRef, tierCfg.maxTriangles]);

  useEffect(() => {
    engineRef.current?.resetAccumulation();
    cameraTrackingInitRef.current = false;
  }, [resetToken]);

  useEffect(() => {
    engineRef.current?.resetAccumulation();
    cameraTrackingInitRef.current = false;
  }, [pt.bounces, pt.exposure, pt.sunAltDeg]);

  useFrame((_, delta) => {
    if (pathTraceLab) return;
    runPathTracerTick(delta);
  });

  useEffect(() => {
    if (!pathTraceLab || !pathTraceActive) {
      return;
    }
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const delta = Math.min(0.1, (t - last) / 1000);
      last = t;
      runPathTracerTick(delta);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pathTraceLab, pathTraceActive]);

  function runPathTracerTick(delta: number) {
    if (!pathTraceActive) return;

    const now = performance.now();
    frameMsRef.current = Math.min(120, delta * 1000 || 16);

    if (sceneBusy || !isPathTracerSettled(now, modelSettleUntil)) {
      if (pathTraceLab && onHudUpdate) {
        onHudUpdate({
          spp: 0,
          fps: 0,
          bounces: pt.bounces,
          mode: 'scene',
          triangleCount: 0,
          qualityHint: sceneBusy ? 'Import…' : 'Stabilizing…',
        });
      }
      return;
    }

    if (pathTraceLab && governorRef.current) {
      if (!governorRef.current.canSubmit(now)) return;
    }

    if (!pathTraceLab && pathTracePreview) {
      if (now - lastPreviewMsRef.current < tierCfg.previewIntervalMs) return;
      if (uploadBusyRef.current) return;

      const engine = engineRef.current;
      if (engine && engine.getSampleCount() >= tierCfg.previewMaxSamples) {
        setOverlayVisible(
          pathTracerCanvasRef?.current,
          true,
          engine.getSampleCount(),
          false
        );
        return;
      }
    }

    if (uploadBusyRef.current) return;
    uploadBusyRef.current = true;
    const frameStart = now;

    void (async () => {
      try {
        await initPromiseRef.current;
        const engine = engineRef.current;
        if (!engine?.isReady()) return;

        const persp = camera as THREE.PerspectiveCamera;
        persp.updateMatrixWorld(true);

        const motionKey = pathTracerMotionKey(appState);
        const motionChanged = motionKey !== motionKeyRef.current;
        if (motionChanged) motionKeyRef.current = motionKey;

        let cameraStill = true;
        if (!cameraTrackingInitRef.current) {
          cameraTrackingInitRef.current = true;
          lastCamPosRef.current.copy(persp.position);
          lastCamQuatRef.current.copy(persp.quaternion);
        } else if (
          cameraMovedEnough(
            persp,
            lastCamPosRef.current,
            lastCamQuatRef.current,
            pathTraceLab
          )
        ) {
          lastCamPosRef.current.copy(persp.position);
          lastCamQuatRef.current.copy(persp.quaternion);
          engine.resetAccumulation();
          cameraStill = false;
        }

        lastCameraStillRef.current = cameraStill;

        const adaptive =
          pathTraceLab && governorRef.current
            ? governorRef.current.tick(
                frameMsRef.current,
                cameraStill,
                pt.bounces
              )
            : null;
        if (adaptive) {
          effectiveBouncesRef.current = adaptive.maxBounces;
        }

        if (
          adaptive &&
          Math.abs(adaptive.resolutionScale - appliedScaleRef.current) > 0.025
        ) {
          engine.resize(size.width, size.height, adaptive.resolutionScale);
          appliedScaleRef.current = adaptive.resolutionScale;
        }

        const settings = buildRenderSettings(appState, labWithScene, adaptive ?? undefined);
        engine.setSettings({
          ...settings,
          samplesPerFrame: pathTraceVideo
            ? tierCfg.videoSamplesPerFrame
            : adaptive?.samplesPerFrame ?? settings.samplesPerFrame,
        });

        const baked = cachedSceneRef.current;
        engine.setCamera(
          cameraFromThree(persp, {
            aperture:
              (pathTraceLab ? pt.aperture : 0) ||
              (appState.visualFx.dofEnabled && !pathTraceVideo ? 0.015 : 0),
            focusDist: baked ? focusDistFromBaked(persp, baked) : 15,
          })
        );

        uploadTickRef.current += 1;
        const periodicUpload =
          uploadTickRef.current % tierCfg.sceneUploadIntervalFrames === 0;
        const needUpload =
          pathTraceVideo ||
          !cachedSceneRef.current ||
          motionChanged ||
          periodicUpload;

        if (needUpload) {
          scene.updateMatrixWorld(true);
          try {
            const fresh = bakeSceneForPathTracer(
              scene,
              bakeOptions(appState, labWithScene, adaptive?.maxTriangles)
            );
            const sig = bakedSceneSignature(fresh);
            if (sig !== bakedSigRef.current || motionChanged) {
              cachedSceneRef.current = fresh;
              bakedSigRef.current = sig;
              await engine.uploadScene(fresh);
              if (!engine.isReady()) return;
              if (motionChanged) {
                engine.resetAccumulation();
              }
            }
          } catch (err) {
            console.warn('[PathTracer] Scene bake/upload failed:', err);
            return;
          }
        }

        const triCount = cachedSceneRef.current?.triangles.length ?? 0;
        if (triCount === 0) {
          setOverlayVisible(pathTracerCanvasRef?.current, false);
          onHudUpdate?.({
            spp: 0,
            fps: 0,
            bounces: effectiveBouncesRef.current,
            mode: 'scene',
            triangleCount: 0,
          });
          return;
        }

        const atMax =
          !pathTraceLab && engine.getSampleCount() >= tierCfg.previewMaxSamples;

        if (!atMax) {
          engine.renderFrame();
          if (pathTraceLab) governorRef.current?.recordSubmit(performance.now());
        }

        const spp = engine.getSampleCount();
        setOverlayVisible(pathTracerCanvasRef?.current, true, spp, pathTraceLab);

        if (
          appState.pathTracer?.oidnEnabled &&
          oidnRef.current &&
          spp >= 12 &&
          lastCameraStillRef.current &&
          !oidnBusyRef.current &&
          engine.getSampleCount() - lastOidnFrameRef.current >= 8
        ) {
          oidnBusyRef.current = true;
          lastOidnFrameRef.current = spp;
          const src = engine.getCanvas();
          void oidnRef.current
            .denoiseCanvas(src)
            .then((out) => {
              const overlay = oidnOverlayRef.current;
              if (!overlay) return;
              overlay.width = out.width;
              overlay.height = out.height;
              const ctx = overlay.getContext('2d');
              if (!ctx) return;
              ctx.clearRect(0, 0, out.width, out.height);
              ctx.drawImage(out, 0, 0);
              overlay.style.opacity = String(
                Math.min(1, 0.35 + Math.min(spp, 128) / 180)
              );
              if (pathTracerCanvasRef?.current) {
                pathTracerCanvasRef.current.style.opacity = '0';
              }
            })
            .catch((err) => {
              console.warn('[PathTracer] OIDN pass failed:', err);
            })
            .finally(() => {
              oidnBusyRef.current = false;
            });
        }

        const elapsed = performance.now() - frameStart;
        fpsAccRef.current += 1000 / Math.max(elapsed, 1);
        fpsNRef.current += 1;
        let fps = 0;
        if (performance.now() - lastFpsMsRef.current > 450) {
          fps = Math.round(fpsAccRef.current / fpsNRef.current);
          fpsAccRef.current = 0;
          fpsNRef.current = 0;
          lastFpsMsRef.current = performance.now();
        }

        if (pathTraceLab && onHudUpdate) {
          const gov = governorRef.current;
          onHudUpdate({
            spp,
            fps,
            bounces: effectiveBouncesRef.current,
            mode: 'scene',
            triangleCount: triCount,
            qualityHint: gov
              ? `Auto ${Math.round(gov.fps)} FPS · res ${(appliedScaleRef.current * 100).toFixed(0)}% · ${effectiveBouncesRef.current}b`
              : undefined,
          });
        }

        lastPreviewMsRef.current = performance.now();
      } finally {
        uploadBusyRef.current = false;
      }
    })();
  }

  return null;
}

function cameraMovedEnough(
  cam: THREE.PerspectiveCamera,
  lastPos: THREE.Vector3,
  lastQuat: THREE.Quaternion,
  labMode: boolean
): boolean {
  const posEps = labMode ? 0.06 : 0.02;
  const angEps = labMode ? 0.01 : 0.004;
  if (cam.position.distanceToSquared(lastPos) > posEps * posEps) return true;
  return cam.quaternion.angleTo(lastQuat) > angEps;
}

export function shouldUsePathTracer(
  appState: AppState,
  webgpu: boolean,
  sceneBusy = false
): boolean {
  if (!webgpu || sceneBusy) return false;
  if (appState.pathTracerLabEnabled && hasVisibleModels(appState)) return true;
  return (
    appState.rtxModeEnabled &&
    !appState.isPlaying &&
    appState.renderTier === 'pro'
  );
}
