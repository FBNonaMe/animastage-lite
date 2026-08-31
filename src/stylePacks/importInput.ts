import { getFileRelativePath, getFilesAsync } from '../utils/mmdFiles';

/** MMD / MME shader-related extensions accepted for folder or loose-file import. */
export const MMD_SHADER_EXTENSIONS = new Set(['fx', 'fxsub', 'fxh', 'conf', 'x']);

export function isMmdShaderExtension(ext: string): boolean {
  return MMD_SHADER_EXTENSIONS.has(ext.toLowerCase().replace(/^\./, ''));
}

export function isMmdShaderFileName(name: string): boolean {
  const lower = name.toLowerCase().replace(/\\/g, '/');
  const base = lower.split('/').pop() ?? lower;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return false;
  return isMmdShaderExtension(base.slice(dot + 1));
}

/** Ensure folder picks retain relative paths for nested Resources/*.fxsub. */
export function prepareStyleImportFiles(files: File[]): File[] {
  return files.map((file) => {
    const rel = getFileRelativePath(file).replace(/\\/g, '/').replace(/^\/+/, '');
    if (rel === file.name && !(file as File & { _mmdRelativePath?: string })._mmdRelativePath) {
      return file;
    }
    const tagged = file as File & { _mmdRelativePath?: string };
    if (tagged._mmdRelativePath === rel) return file;
    Object.defineProperty(file, '_mmdRelativePath', { value: rel, enumerable: false });
    return file;
  });
}

export function filterStyleRelevantFiles(files: File[]): File[] {
  const prepared = prepareStyleImportFiles(files);
  return prepared.filter((f) => {
    const rel = getFileRelativePath(f).toLowerCase();
    if (isMmdShaderFileName(rel)) return true;
    if (/\.(webp|png|jpg|jpeg|dds)$/i.test(rel)) return true;
    if (rel.endsWith('manifest.json') || rel.endsWith('config.json')) return true;
    if (rel.endsWith('shader.vert') || rel.endsWith('shader.frag')) return true;
    return false;
  });
}

export async function readImportFilesFromDrop(dataTransfer: DataTransfer): Promise<File[]> {
  const fromItems = await getFilesAsync(dataTransfer);
  if (fromItems.length > 0) return fromItems;
  return Array.from(dataTransfer.files ?? []);
}

export function isSingleZipImport(files: File[]): File | null {
  if (files.length !== 1) return null;
  const f = files[0]!;
  if (!f.name.toLowerCase().endsWith('.zip')) return null;
  return f;
}
