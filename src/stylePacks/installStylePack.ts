import { extractZipToFiles } from '../utils/assetImport';
import { fetchRemoteJson, fetchRemoteStylePackBytes } from './fetchRemoteStylePack';
import {
  filterStyleRelevantFiles,
  isSingleZipImport,
  prepareStyleImportFiles,
} from './importInput';
import { parseStylePackFiles } from './parsePackage';
import type { InstalledStylePack, StyleInstallResult, StylePackUpdateInfo } from './types';
import { isNewerVersion } from './validate';

export async function installStylePackFromFiles(
  files: File[],
  sourceUrl?: string
): Promise<StyleInstallResult> {
  try {
    const pack = await parseStylePackFiles(files, sourceUrl);
    return { ok: true, pack };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not install style package.';
    return { ok: false, error: message };
  }
}

export async function installStylePackFromZip(
  file: File,
  sourceUrl?: string
): Promise<StyleInstallResult> {
  try {
    const files = await extractZipToFiles(file);
    if (files.length === 0) {
      return { ok: false, error: 'ZIP archive is empty.' };
    }
    return installStylePackFromFiles(files, sourceUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read ZIP archive.';
    return { ok: false, error: message };
  }
}

/** ZIP, shader folder, or loose .fx / .fxsub / .fxh files. */
export async function installStylePackFromImport(
  rawFiles: File[],
  sourceUrl?: string
): Promise<StyleInstallResult> {
  if (rawFiles.length === 0) {
    return { ok: false, error: 'No files selected.' };
  }

  const zipOnly = isSingleZipImport(rawFiles);
  if (zipOnly) {
    return installStylePackFromZip(zipOnly, sourceUrl);
  }

  const prepared = prepareStyleImportFiles(rawFiles);
  const relevant = filterStyleRelevantFiles(prepared);
  if (relevant.length === 0) {
    return {
      ok: false,
      error:
        'No shader files found. Select a folder or files with .fx, .fxsub, .fxh, or a Visual Style .zip.',
    };
  }

  return installStylePackFromFiles(relevant, sourceUrl);
}

export async function installStylePackFromUrl(url: string): Promise<StyleInstallResult> {
  try {
    const bytes = await fetchRemoteStylePackBytes(url, { allowMmdShaderRepo: true });
    const file = new File([bytes], 'style-pack.zip', { type: 'application/zip' });
    return installStylePackFromZip(file, url.trim());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not download style pack.';
    return { ok: false, error: message };
  }
}

export async function checkStylePackUpdate(
  pack: InstalledStylePack
): Promise<StylePackUpdateInfo | null> {
  const updateUrl = pack.manifest.updateUrl?.trim();
  if (!updateUrl) return null;
  try {
    const data = await fetchRemoteJson<{ version?: string; zipUrl?: string }>(updateUrl);
    if (!data) return null;
    const newVersion = typeof data.version === 'string' ? data.version.trim() : '';
    const zipUrl = typeof data.zipUrl === 'string' ? data.zipUrl.trim() : '';
    if (!newVersion || !zipUrl) return null;
    if (!isNewerVersion(pack.manifest.version, newVersion)) return null;
    return {
      packId: pack.manifest.id,
      currentVersion: pack.manifest.version,
      newVersion,
      zipUrl,
    };
  } catch {
    return null;
  }
}

export async function checkAllStylePackUpdates(
  installed: InstalledStylePack[]
): Promise<StylePackUpdateInfo[]> {
  const results = await Promise.all(installed.map((pack) => checkStylePackUpdate(pack)));
  return results.filter((r): r is StylePackUpdateInfo => r !== null);
}
