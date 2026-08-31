import { useCallback, useEffect, useRef, useState } from 'react';
import type { CharacterQuality, VisualFxSettings } from '../types';
import type { SceneComposerState } from '../sceneComposer/types';
import { applyStyleById, type StyleApplyResult } from './applyStyle';
import { builtinStyleKey, packStyleKey } from './builtins';
import {
  checkAllStylePackUpdates,
  installStylePackFromImport,
  installStylePackFromUrl,
} from './installStylePack';
import {
  loadStylePackState,
  removeInstalledPack,
  saveStylePackState,
  upsertInstalledPack,
} from './storage';
import type { InstalledStylePack, StylePackUpdateInfo } from './types';
import {
  applyGalleryConfig,
  galleryStyleKey,
  generateRandomGalleryConfig,
  loadGalleryExtras,
  saveGalleryExtras,
  toggleFavorite,
  addUserPreset,
  removeUserPreset,
  duplicateUserPreset,
  downloadVisualPreset,
  serializeVisualPreset,
  userStyleKey,
  type GalleryApplyResult,
  type StyleGalleryExtras,
  type UserVisualPreset,
} from './gallery';
import type { AutoLuminousLevel } from '../types';

export interface VisualStyleSnapshot {
  visualFx: VisualFxSettings;
  characterQuality: CharacterQuality;
  activeStyleId: string;
  sceneComposer?: SceneComposerState;
  autoLuminousLevel?: AutoLuminousLevel;
}

export interface UseVisualStylesOptions {
  visualFx: VisualFxSettings;
  characterQuality: CharacterQuality;
  sceneComposer: SceneComposerState;
  replaceVisualFx: (next: VisualFxSettings) => void;
  setCharacterQuality: (quality: CharacterQuality) => void;
  onGalleryApplied?: (result: GalleryApplyResult) => void;
}

export function useVisualStyles({
  visualFx,
  characterQuality,
  sceneComposer,
  replaceVisualFx,
  setCharacterQuality,
  onGalleryApplied,
}: UseVisualStylesOptions) {
  const [activeStyleId, setActiveStyleId] = useState(() => loadStylePackState().activeStyleId);
  const [installed, setInstalled] = useState<InstalledStylePack[]>(() => loadStylePackState().installed);
  const [extras, setExtras] = useState<StyleGalleryExtras>(() => loadGalleryExtras());
  const [updates, setUpdates] = useState<StylePackUpdateInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const snapshotRef = useRef<VisualStyleSnapshot | null>(null);
  const composerRef = useRef(sceneComposer);
  composerRef.current = sceneComposer;

  const persist = useCallback((nextActive: string, nextInstalled: InstalledStylePack[]) => {
    saveStylePackState({ activeStyleId: nextActive, installed: nextInstalled });
  }, []);

  const persistExtras = useCallback((next: StyleGalleryExtras) => {
    setExtras(next);
    saveGalleryExtras(next);
  }, []);

  const takeSnapshot = useCallback((): VisualStyleSnapshot => {
    return { visualFx, characterQuality, activeStyleId, sceneComposer: composerRef.current };
  }, [visualFx, characterQuality, activeStyleId]);

  const restoreSnapshot = useCallback(
    (snap: VisualStyleSnapshot) => {
      replaceVisualFx(snap.visualFx);
      setCharacterQuality(snap.characterQuality);
      setActiveStyleId(snap.activeStyleId);
      persist(snap.activeStyleId, installed);
    },
    [replaceVisualFx, setCharacterQuality, persist, installed]
  );

  const commitApplyResult = useCallback(
    (styleId: string, result: StyleApplyResult, installedList = installed) => {
      replaceVisualFx(result.visualFx);
      if (result.characterQuality) setCharacterQuality(result.characterQuality);
      if (result.gallery) onGalleryApplied?.(result.gallery);
      setActiveStyleId(styleId);
      persist(styleId, installedList);
    },
    [installed, replaceVisualFx, setCharacterQuality, onGalleryApplied, persist]
  );

  const applyStyleId = useCallback(
    (styleId: string, installedList = installed): boolean => {
      const result = applyStyleById(styleId, installedList, composerRef.current);
      if (!result) return false;
      commitApplyResult(styleId, result, installedList);
      return true;
    },
    [installed, commitApplyResult]
  );

  const selectStyle = useCallback(
    (styleId: string) => {
      const snap = takeSnapshot();
      try {
        const ok = applyStyleId(styleId);
        if (!ok) {
          setError('That style is no longer available.');
          restoreSnapshot(snap);
          return;
        }
        setError(null);
        setStatus(null);
      } catch {
        restoreSnapshot(snap);
        setError('Could not apply style — restored your previous look.');
      }
    },
    [applyStyleId, takeSnapshot, restoreSnapshot]
  );

  const applyRandomStyle = useCallback(() => {
    const snap = takeSnapshot();
    try {
      const config = generateRandomGalleryConfig(Date.now());
      const styleId = galleryStyleKey(`random-${Date.now()}`);
      const gallery = applyGalleryConfig(styleId, config, composerRef.current);
      replaceVisualFx(gallery.visualFx);
      if (gallery.characterQuality) setCharacterQuality(gallery.characterQuality);
      onGalleryApplied?.(gallery);
      setActiveStyleId(styleId);
      setStatus('Random style applied.');
      setError(null);
    } catch {
      restoreSnapshot(snap);
      setError('Random style failed — restored previous look.');
    }
  }, [takeSnapshot, restoreSnapshot, replaceVisualFx, setCharacterQuality, onGalleryApplied]);

  const saveCurrentStyle = useCallback(
    (name: string) => {
      const config = {
        fx: { ...visualFx },
        characterQuality,
        autoLuminous: 'auto' as const,
      };
      const preset: UserVisualPreset = {
        id: `user-${Date.now()}`,
        name: name.trim() || 'My Style',
        savedAt: Date.now(),
        styleId: activeStyleId,
        config,
      };
      const next = addUserPreset(extras, preset);
      persistExtras(next);
      setStatus(`Saved "${preset.name}" to Creator Presets.`);
    },
    [visualFx, characterQuality, activeStyleId, extras, persistExtras]
  );

  const exportCurrentVisualPreset = useCallback(
    (name: string) => {
      downloadVisualPreset(
        serializeVisualPreset(name, {
          fx: { ...visualFx },
          characterQuality,
        }, activeStyleId)
      );
      setStatus('Downloaded .visualpreset file.');
    },
    [visualFx, characterQuality, activeStyleId]
  );

  const toggleFavoriteStyle = useCallback(
    (styleId: string) => {
      persistExtras(toggleFavorite(extras, styleId));
    },
    [extras, persistExtras]
  );

  const selectUserPreset = useCallback(
    (presetId: string) => {
      selectStyle(userStyleKey(presetId));
    },
    [selectStyle]
  );

  const deleteUserPreset = useCallback(
    (presetId: string) => {
      persistExtras(removeUserPreset(extras, presetId));
      if (activeStyleId === userStyleKey(presetId)) {
        applyStyleId(builtinStyleKey('default'));
      }
    },
    [extras, persistExtras, activeStyleId, applyStyleId]
  );

  const duplicateUserPresetById = useCallback(
    (presetId: string) => {
      persistExtras(duplicateUserPreset(extras, presetId));
      setStatus('Preset duplicated.');
    },
    [extras, persistExtras]
  );

  const installImport = useCallback(
    async (files: File[]) => {
      const snap = takeSnapshot();
      setBusy(true);
      setError(null);
      setStatus('Installing style…');
      try {
        const result = await installStylePackFromImport(files);
        if (!result.ok || !result.pack) {
          restoreSnapshot(snap);
          setError(result.error ?? 'Installation failed.');
          setStatus(null);
          return;
        }
        const nextInstalled = upsertInstalledPack(installed, result.pack);
        setInstalled(nextInstalled);
        const styleId = packStyleKey(result.pack.manifest.id);
        const applied = applyStyleId(styleId, nextInstalled);
        if (!applied) {
          restoreSnapshot(snap);
          setError('Installed but could not apply — restored previous style.');
          return;
        }
        setStatus(`"${result.pack.manifest.name}" is ready.`);
        void checkAllStylePackUpdates(nextInstalled).then(setUpdates);
      } catch {
        restoreSnapshot(snap);
        setError('Installation failed — restored your previous style.');
        setStatus(null);
      } finally {
        setBusy(false);
      }
    },
    [installed, takeSnapshot, restoreSnapshot, applyStyleId]
  );

  const installZip = useCallback(
    async (file: File) => {
      await installImport([file]);
    },
    [installImport]
  );

  const installUrl = useCallback(
    async (url: string) => {
      const snap = takeSnapshot();
      setBusy(true);
      setError(null);
      setStatus('Downloading style…');
      try {
        const result = await installStylePackFromUrl(url);
        if (!result.ok || !result.pack) {
          restoreSnapshot(snap);
          setError(result.error ?? 'Remote install failed.');
          setStatus(null);
          return;
        }
        const nextInstalled = upsertInstalledPack(installed, result.pack);
        setInstalled(nextInstalled);
        const styleId = packStyleKey(result.pack.manifest.id);
        const applied = applyStyleId(styleId, nextInstalled);
        if (!applied) {
          restoreSnapshot(snap);
          setError('Downloaded but could not apply — restored previous style.');
          return;
        }
        setStatus(`"${result.pack.manifest.name}" installed from link.`);
        void checkAllStylePackUpdates(nextInstalled).then(setUpdates);
      } catch {
        restoreSnapshot(snap);
        setError('Remote install failed — restored your previous style.');
        setStatus(null);
      } finally {
        setBusy(false);
      }
    },
    [installed, takeSnapshot, restoreSnapshot, applyStyleId]
  );

  const installUpdate = useCallback(
    async (info: StylePackUpdateInfo) => {
      const snap = takeSnapshot();
      setBusy(true);
      setError(null);
      setStatus('Installing update…');
      try {
        const result = await installStylePackFromUrl(info.zipUrl);
        if (!result.ok || !result.pack) {
          restoreSnapshot(snap);
          setError(result.error ?? 'Update failed.');
          setStatus(null);
          return;
        }
        if (result.pack.manifest.id !== info.packId) {
          restoreSnapshot(snap);
          setError('Update package id mismatch — kept your current style.');
          setStatus(null);
          return;
        }
        const nextInstalled = upsertInstalledPack(installed, result.pack);
        setInstalled(nextInstalled);
        applyStyleId(packStyleKey(info.packId), nextInstalled);
        setUpdates((prev) => prev.filter((u) => u.packId !== info.packId));
        setStatus(`Updated to v${info.newVersion}.`);
      } catch {
        restoreSnapshot(snap);
        setError('Update failed — restored your previous style.');
        setStatus(null);
      } finally {
        setBusy(false);
      }
    },
    [installed, takeSnapshot, restoreSnapshot, applyStyleId]
  );

  const removePack = useCallback(
    (packId: string) => {
      const nextInstalled = removeInstalledPack(installed, packId);
      setInstalled(nextInstalled);
      if (activeStyleId === packStyleKey(packId)) {
        applyStyleId(builtinStyleKey('default'), nextInstalled);
      } else {
        persist(activeStyleId, nextInstalled);
      }
      setUpdates((prev) => prev.filter((u) => u.packId !== packId));
    },
    [installed, activeStyleId, applyStyleId, persist]
  );

  const exportPack = useCallback((packId: string) => {
    const pack = installed.find((p) => p.manifest.id === packId);
    if (!pack) return;
    downloadVisualPreset(
      serializeVisualPreset(pack.manifest.name, pack.config, packStyleKey(packId))
    );
    setStatus(`Exported "${pack.manifest.name}".`);
  }, [installed]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (activeStyleId !== builtinStyleKey('default')) {
      const ok = applyStyleId(activeStyleId);
      if (!ok) applyStyleId(builtinStyleKey('default'));
    }
  }, [activeStyleId, applyStyleId]);

  useEffect(() => {
    void checkAllStylePackUpdates(installed).then(setUpdates);
  }, [installed]);

  return {
    activeStyleId,
    installed,
    extras,
    updates,
    busy,
    status,
    error,
    selectStyle,
    applyRandomStyle,
    saveCurrentStyle,
    exportCurrentVisualPreset,
    toggleFavoriteStyle,
    selectUserPreset,
    deleteUserPreset,
    duplicateUserPresetById,
    installZip,
    installImport,
    installUrl,
    installUpdate,
    removePack,
    exportPack,
    clearStatus: () => {
      setStatus(null);
      setError(null);
    },
  };
}
