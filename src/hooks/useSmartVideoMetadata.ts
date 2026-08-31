import { useCallback, useRef, useState } from 'react';
import type { AppState, ViewportFormat } from '../types';
import type { InstalledStylePack } from '../stylePacks/types';
import {
  applySocialPresetToMetadata,
  collectProjectContext,
  detectAppLocale,
  generateSmartMetadata,
} from '../smartMetadata';
import type {
  ExportFormatId,
  SmartMetadataLocale,
  SmartVideoMetadata,
  SocialPlatformId,
} from '../smartMetadata/types';

export interface UseSmartVideoMetadataOptions {
  appState: AppState;
  viewportFormat: ViewportFormat;
  exportDurationSec: number;
  activeStyleId?: string;
  installedStylePacks?: InstalledStylePack[];
  onPersist: (metadata: SmartVideoMetadata) => void;
}

function defaultPlatform(format: ViewportFormat): SocialPlatformId {
  return format === '9:16' ? 'youtube_shorts' : 'youtube';
}

export function useSmartVideoMetadata({
  appState,
  viewportFormat,
  exportDurationSec,
  activeStyleId,
  installedStylePacks = [],
  onPersist,
}: UseSmartVideoMetadataOptions) {
  const metadata = appState.exportMetadata ?? null;
  const [visible, setVisible] = useState(false);
  const lastExportModeRef = useRef<ExportFormatId>('mp4_hq');

  const buildAndGenerate = useCallback(
    (
      exportMode: ExportFormatId,
      opts?: {
        locale?: SmartMetadataLocale;
        platform?: SocialPlatformId;
        seed?: number;
        selectedTitleIndex?: number;
      }
    ): SmartVideoMetadata => {
      lastExportModeRef.current = exportMode;
      const locale = opts?.locale ?? metadata?.locale ?? detectAppLocale();
      const ctx = collectProjectContext({
        appState,
        viewportFormat,
        exportDurationSec,
        exportMode,
        activeStyleId,
        installedStylePacks,
        locale,
      });

      const next = generateSmartMetadata(ctx, {
        locale,
        platform: opts?.platform ?? metadata?.platform ?? defaultPlatform(viewportFormat),
        seed: opts?.seed ?? Date.now(),
        selectedTitleIndex: opts?.selectedTitleIndex ?? metadata?.selectedTitleIndex ?? 0,
      });

      onPersist(next);
      setVisible(true);
      return next;
    },
    [
      appState,
      viewportFormat,
      exportDurationSec,
      activeStyleId,
      installedStylePacks,
      metadata?.locale,
      metadata?.platform,
      metadata?.selectedTitleIndex,
      onPersist,
    ]
  );

  const prepareForExport = useCallback(
    (exportMode: ExportFormatId) => {
      buildAndGenerate(exportMode, { seed: Date.now(), selectedTitleIndex: 0 });
    },
    [buildAndGenerate]
  );

  const regenerate = useCallback(() => {
    buildAndGenerate(lastExportModeRef.current, {
      locale: metadata?.locale ?? detectAppLocale(),
      platform: metadata?.platform ?? defaultPlatform(viewportFormat),
      seed: Date.now(),
      selectedTitleIndex: metadata?.selectedTitleIndex ?? 0,
    });
  }, [buildAndGenerate, metadata, viewportFormat]);

  const setLocale = useCallback(
    (locale: SmartMetadataLocale) => {
      buildAndGenerate(lastExportModeRef.current, {
        locale,
        platform: metadata?.platform ?? defaultPlatform(viewportFormat),
        seed: Date.now(),
        selectedTitleIndex: 0,
      });
    },
    [buildAndGenerate, metadata?.platform, viewportFormat]
  );

  const setPlatform = useCallback(
    (platform: SocialPlatformId) => {
      if (!metadata) return;
      const ctx = collectProjectContext({
        appState,
        viewportFormat,
        exportDurationSec,
        exportMode: metadata.exportMode,
        activeStyleId,
        installedStylePacks,
        locale: metadata.locale,
      });
      const refreshed = generateSmartMetadata(ctx, {
        locale: metadata.locale,
        platform,
        seed: metadata.generationSeed,
        selectedTitleIndex: metadata.selectedTitleIndex,
      });
      const next = applySocialPresetToMetadata(
        { ...metadata, platform, hashtags: refreshed.hashtags },
        platform
      );
      onPersist(next);
    },
    [
      metadata,
      appState,
      viewportFormat,
      exportDurationSec,
      activeStyleId,
      installedStylePacks,
      onPersist,
    ]
  );

  const selectTitle = useCallback(
    (index: number) => {
      if (!metadata) return;
      const next = applySocialPresetToMetadata(
        { ...metadata, selectedTitleIndex: index },
        metadata.platform
      );
      onPersist(next);
    },
    [metadata, onPersist]
  );

  const restore = useCallback((saved: SmartVideoMetadata | null | undefined) => {
    if (saved) {
      onPersist(saved);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [onPersist]);

  return {
    metadata,
    visible,
    setVisible,
    prepareForExport,
    regenerate,
    setLocale,
    setPlatform,
    selectTitle,
    restore,
  };
}
