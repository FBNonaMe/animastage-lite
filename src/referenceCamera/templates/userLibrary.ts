/**
 * User camera template library — localStorage persist, import/export.
 */
import type { CameraKeyframe } from '../../types';
import type {
  CameraTemplateDef,
  CameraTemplateFolder,
  UserCameraTemplate,
} from './types';
import { CAMERA_TEMPLATE_STORAGE_KEY } from './types';
import { BUILTIN_CAMERA_TEMPLATES } from './builtinCatalog';

interface StoredLibrary {
  version: 1;
  folders: CameraTemplateFolder[];
  templates: UserCameraTemplate[];
}

function emptyLib(): StoredLibrary {
  return { version: 1, folders: [], templates: [] };
}

function readStore(): StoredLibrary {
  try {
    const raw = localStorage.getItem(CAMERA_TEMPLATE_STORAGE_KEY);
    if (!raw) return emptyLib();
    const parsed = JSON.parse(raw) as StoredLibrary;
    if (!parsed || parsed.version !== 1) return emptyLib();
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      templates: Array.isArray(parsed.templates) ? parsed.templates : [],
      version: 1,
    };
  } catch {
    return emptyLib();
  }
}

function writeStore(lib: StoredLibrary): void {
  localStorage.setItem(CAMERA_TEMPLATE_STORAGE_KEY, JSON.stringify(lib));
}

export function listUserFolders(): CameraTemplateFolder[] {
  return readStore().folders;
}

export function listUserTemplates(folderId?: string | null): UserCameraTemplate[] {
  const all = readStore().templates;
  if (folderId === undefined) return all;
  if (folderId === null) return all.filter((t) => !t.folderId);
  return all.filter((t) => t.folderId === folderId);
}

export function createFolder(name: string): CameraTemplateFolder {
  const lib = readStore();
  const folder: CameraTemplateFolder = {
    id: `folder_${Date.now().toString(36)}`,
    name: name.trim() || 'New folder',
  };
  lib.folders.push(folder);
  writeStore(lib);
  return folder;
}

export function renameFolder(id: string, name: string): void {
  const lib = readStore();
  const f = lib.folders.find((x) => x.id === id);
  if (f) f.name = name.trim() || f.name;
  writeStore(lib);
}

export function deleteFolder(id: string): void {
  const lib = readStore();
  lib.folders = lib.folders.filter((f) => f.id !== id);
  lib.templates = lib.templates.map((t) =>
    t.folderId === id ? { ...t, folderId: null } : t
  );
  writeStore(lib);
}

export function saveUserTemplate(input: {
  name: string;
  description?: string;
  keyframes: CameraKeyframe[];
  folderId?: string | null;
  base?: Partial<CameraTemplateDef>;
}): UserCameraTemplate {
  const lib = readStore();
  const now = Date.now();
  const tpl: UserCameraTemplate = {
    id: `user_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    label: input.name.trim() || 'My Camera',
    description: input.description?.trim() || 'Saved camera animation',
    category: 'user',
    builtin: false,
    motion: input.base?.motion ?? 'orbit',
    durationScale: input.base?.durationScale ?? 1,
    baseFov: input.base?.baseFov ?? 40,
    radiusMul: input.base?.radiusMul ?? 1,
    heightFrac: input.base?.heightFrac ?? 0.5,
    lookFrac: input.base?.lookFrac ?? 0.45,
    easing: input.base?.easing ?? 'cinematic',
    framing: input.base?.framing ?? 'auto_reframe',
    followTarget: input.base?.followTarget ?? 'chest',
    dofStrength: input.base?.dofStrength ?? 0.15,
    speed: input.base?.speed ?? 1,
    preferredAspects: input.base?.preferredAspects ?? ['16:9', '9:16'],
    safe: input.base?.safe ?? { min: 6, max: 40, preferred: 14 },
    styleTags: ['user', ...(input.base?.styleTags ?? [])],
    folderId: input.folderId ?? null,
    bakedKeyframes: input.keyframes.map((k) => ({
      ...k,
      position: [...k.position] as [number, number, number],
      rotation: [...k.rotation] as [number, number, number],
      target: k.target ? ([...k.target] as [number, number, number]) : undefined,
    })),
    createdAt: now,
    updatedAt: now,
  };
  lib.templates.push(tpl);
  writeStore(lib);
  return tpl;
}

export function renameUserTemplate(id: string, name: string): void {
  const lib = readStore();
  const t = lib.templates.find((x) => x.id === id);
  if (t) {
    t.label = name.trim() || t.label;
    t.updatedAt = Date.now();
  }
  writeStore(lib);
}

export function moveUserTemplate(id: string, folderId: string | null): void {
  const lib = readStore();
  const t = lib.templates.find((x) => x.id === id);
  if (t) {
    t.folderId = folderId;
    t.updatedAt = Date.now();
  }
  writeStore(lib);
}

export function deleteUserTemplate(id: string): void {
  const lib = readStore();
  lib.templates = lib.templates.filter((t) => t.id !== id);
  writeStore(lib);
}

export function getUserTemplate(id: string): UserCameraTemplate | undefined {
  return readStore().templates.find((t) => t.id === id);
}

export function exportLibraryJson(): string {
  return JSON.stringify(readStore(), null, 2);
}

export function exportTemplateJson(id: string): string | null {
  const tpl = getUserTemplate(id) ?? BUILTIN_CAMERA_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return null;
  return JSON.stringify({ version: 1, template: tpl }, null, 2);
}

export function importLibraryJson(json: string): { folders: number; templates: number } {
  const data = JSON.parse(json) as Partial<StoredLibrary> & {
    template?: UserCameraTemplate;
  };
  const lib = readStore();
  let folders = 0;
  let templates = 0;

  if (data.template && data.template.bakedKeyframes) {
    const t = {
      ...data.template,
      id: `user_${Date.now().toString(36)}`,
      builtin: false as const,
      category: 'user' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    lib.templates.push(t);
    templates = 1;
  } else {
    for (const f of data.folders ?? []) {
      if (!lib.folders.some((x) => x.id === f.id)) {
        lib.folders.push(f);
        folders++;
      }
    }
    for (const t of data.templates ?? []) {
      if (!t.bakedKeyframes) continue;
      lib.templates.push({
        ...t,
        id: `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        builtin: false,
        category: 'user',
        updatedAt: Date.now(),
        createdAt: t.createdAt ?? Date.now(),
      });
      templates++;
    }
  }
  writeStore(lib);
  return { folders, templates };
}

/** Apply a user-baked template, remapping frames to duration. */
export function keyframesFromUserTemplate(
  tpl: UserCameraTemplate,
  durationFrames: number
): CameraKeyframe[] {
  const keys = tpl.bakedKeyframes;
  if (keys.length === 0) return [];
  const t0 = keys[0].frame;
  const t1 = keys[keys.length - 1].frame;
  const span = Math.max(1, t1 - t0);
  const outSpan = Math.max(1, durationFrames - 1);
  return keys.map((k) => ({
    ...k,
    id: `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    frame: Math.round(((k.frame - t0) / span) * outSpan),
    position: [...k.position] as [number, number, number],
    rotation: [...k.rotation] as [number, number, number],
    target: k.target ? ([...k.target] as [number, number, number]) : undefined,
  }));
}
