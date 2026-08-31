/**
 * Offline / Cinema / RP4 export session — keeps App.tsx thinner and restores
 * quality patches symmetrically after encode.
 */
import { useCallback } from 'react';
import type { AppState, ViewportFormat } from '../types';
import { prepareCinematicExportQuality } from '../cinematicRender/exportQuality';
import {
  DEFAULT_CINEMA_RENDER,
  prepareCinemaRender,
} from '../cinematicRender/cinemaMode';
import {
  DEFAULT_RENDER_PIPELINE_4,
  mergeRenderPipeline4,
  prepareRenderPipeline4Export,
  type RenderPipeline4State,
} from '../renderPipeline4';

type SetAppState = React.Dispatch<React.SetStateAction<AppState>>;

export interface CinemaExportVideoApi {
  busy: boolean;
  mode: string;
  cancel: () => void;
  startOffline: () => Promise<unknown>;
  startCinemaOffline: (opts: Record<string, unknown>) => Promise<unknown>;
}

export function useCinemaExportSession(opts: {
  appStateRef: React.MutableRefObject<AppState>;
  setAppState: SetAppState;
  viewportFormat: ViewportFormat;
  setViewportFormat: (f: ViewportFormat) => void;
  exportDurationSec: number;
  videoRecorder: CinemaExportVideoApi;
  prepareMetadata: (mode: string) => void;
  /** Shared with live-recording restore in App. */
  restoreRef: React.MutableRefObject<Partial<AppState> | null>;
}) {
  const {
    appStateRef,
    setAppState,
    viewportFormat,
    setViewportFormat,
    exportDurationSec,
    videoRecorder,
    prepareMetadata,
    restoreRef,
  } = opts;

  const applyRestore = useCallback(
    (restore: Partial<AppState> | null, prevFormat?: ViewportFormat) => {
      if (prevFormat != null) setViewportFormat(prevFormat);
      if (!restore) return;
      setAppState((prev) => ({
        ...prev,
        visualFx: restore.visualFx ?? prev.visualFx,
        sceneComposer: restore.sceneComposer ?? prev.sceneComposer,
        characterQuality: restore.characterQuality ?? prev.characterQuality,
        rtxModeEnabled: restore.rtxModeEnabled ?? prev.rtxModeEnabled,
        rtxSettings: restore.rtxSettings ?? prev.rtxSettings,
        reflectionSystem: restore.reflectionSystem ?? prev.reflectionSystem,
        asrp: restore.asrp ?? prev.asrp,
        cinemaRender: restore.cinemaRender ?? prev.cinemaRender,
        cinematicRender: restore.cinematicRender ?? prev.cinematicRender,
        cinematic: restore.cinematic ?? prev.cinematic,
        vcs: restore.vcs ?? prev.vcs,
        renderPipeline4: restore.renderPipeline4 ?? prev.renderPipeline4,
      }));
    },
    [setAppState, setViewportFormat]
  );

  const handleRenderMp4 = useCallback(() => {
    if (videoRecorder.busy && videoRecorder.mode === 'offline') {
      videoRecorder.cancel();
      return;
    }
    prepareMetadata('mp4_hq');
    const exportQ = prepareCinematicExportQuality(appStateRef.current, viewportFormat);
    if (exportQ.applied) {
      restoreRef.current = exportQ.restore;
      setAppState((prev) => ({ ...prev, ...exportQ.patch }));
    }
    void (async () => {
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
      try {
        await videoRecorder.startOffline();
      } finally {
        const restore = restoreRef.current;
        restoreRef.current = null;
        applyRestore(restore);
      }
    })();
  }, [
    appStateRef,
    applyRestore,
    prepareMetadata,
    setAppState,
    videoRecorder,
    viewportFormat,
  ]);

  const handleCinemaRender = useCallback(() => {
    if (videoRecorder.busy && videoRecorder.mode === 'offline') {
      videoRecorder.cancel();
      return;
    }
    prepareMetadata('mp4_hq');
    const prep = prepareCinemaRender(appStateRef.current);
    restoreRef.current = prep.restore;
    const prevFormat = viewportFormat;
    setAppState((prev) => ({ ...prev, ...prep.patch }));
    if (prep.videoOpts.viewportFormat && prep.videoOpts.viewportFormat !== viewportFormat) {
      setViewportFormat(prep.videoOpts.viewportFormat);
    }
    void (async () => {
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
      try {
        await videoRecorder.startCinemaOffline({
          fps: prep.videoOpts.fps,
          bitrateMbps: prep.videoOpts.bitrateMbps,
          targetWidth: prep.videoOpts.targetWidth,
          targetHeight: prep.videoOpts.targetHeight,
          viewportFormat: prep.videoOpts.viewportFormat,
          settleFrames: prep.videoOpts.settleFrames,
          supersample: prep.videoOpts.supersample,
          cinemaMode: true,
          frameAccumulation: prep.videoOpts.frameAccumulation,
          codecPreference: (appStateRef.current.cinemaRender ?? DEFAULT_CINEMA_RENDER).codec,
        });
      } finally {
        const restore = restoreRef.current;
        restoreRef.current = null;
        applyRestore(restore, prevFormat);
      }
    })();
  }, [
    appStateRef,
    applyRestore,
    prepareMetadata,
    setAppState,
    setViewportFormat,
    videoRecorder,
    viewportFormat,
  ]);

  const handlePatchRenderPipeline4 = useCallback(
    (patch: Partial<RenderPipeline4State>) => {
      setAppState((prev) => ({
        ...prev,
        renderPipeline4: mergeRenderPipeline4(prev.renderPipeline4, patch),
      }));
    },
    [setAppState]
  );

  const handleRp4ProfessionalExport = useCallback(() => {
    if (videoRecorder.busy && videoRecorder.mode === 'offline') {
      videoRecorder.cancel();
      return;
    }
    prepareMetadata('mp4_hq');
    const prep = prepareRenderPipeline4Export(
      appStateRef.current,
      exportDurationSec,
      appStateRef.current.renderPipeline4 ?? DEFAULT_RENDER_PIPELINE_4,
      viewportFormat
    );
    if (prep.containerNote) {
      console.info('[RP4]', prep.containerNote);
    }
    restoreRef.current = prep.restore;
    const prevFormat = viewportFormat;
    setAppState((prev) => ({ ...prev, ...prep.patch }));
    if (prep.videoOpts.viewportFormat && prep.videoOpts.viewportFormat !== viewportFormat) {
      setViewportFormat(prep.videoOpts.viewportFormat);
    }
    void (async () => {
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
      try {
        await videoRecorder.startCinemaOffline({
          fps: prep.videoOpts.fps,
          bitrateMbps: prep.videoOpts.bitrateMbps,
          targetWidth: prep.videoOpts.targetWidth,
          targetHeight: prep.videoOpts.targetHeight,
          viewportFormat: prep.videoOpts.viewportFormat,
          settleFrames: prep.videoOpts.settleFrames,
          supersample: prep.videoOpts.supersample,
          cinemaMode: true,
          frameAccumulation: prep.videoOpts.frameAccumulation,
          codecPreference: prep.videoOpts.codecPreference,
        });
      } finally {
        const restore = restoreRef.current;
        restoreRef.current = null;
        applyRestore(restore, prevFormat);
      }
    })();
  }, [
    appStateRef,
    applyRestore,
    exportDurationSec,
    prepareMetadata,
    setAppState,
    setViewportFormat,
    videoRecorder,
    viewportFormat,
  ]);

  return {
    handleRenderMp4,
    handleCinemaRender,
    handlePatchRenderPipeline4,
    handleRp4ProfessionalExport,
  };
}
