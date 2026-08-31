import * as THREE from 'three';
import type { ModelAnalysisReport } from './types';
import { parseModelBuffer, type ParsedPmxSummary } from './parsePmx';
import { validateParsedModel } from './validateModel';

interface MmdGeometryUserData {
  format?: string;
  textures?: string[];
  rigidBodies?: Array<{ type?: number; name?: string }>;
  constraints?: unknown[];
  iks?: unknown[];
  bones?: Array<{ name?: string }>;
  morphs?: Array<{ name?: string; type?: number }>;
  materials?: Array<{ name?: string; faceCount?: number; textureIndex?: number }>;
}

function meshCounts(mesh: THREE.SkinnedMesh): {
  vertexCount: number;
  triangleCount: number;
} {
  const pos = mesh.geometry.getAttribute('position');
  const vertexCount = pos?.count ?? 0;
  const index = mesh.geometry.getIndex();
  const triangleCount = index
    ? index.count / 3
    : vertexCount
      ? vertexCount / 3
      : 0;
  return { vertexCount, triangleCount: Math.floor(triangleCount) };
}

function summaryFromMesh(mesh: THREE.SkinnedMesh): ParsedPmxSummary {
  const mmd = mesh.geometry.userData.MMD as MmdGeometryUserData | undefined;
  const { vertexCount, triangleCount } = meshCounts(mesh);

  const morphDict = mesh.morphTargetDictionary;
  const morphNames = morphDict ? Object.keys(morphDict) : [];

  let materialCount = 0;
  mesh.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      materialCount += mats.length;
    }
  });

  return {
    format: mmd?.format === 'pmd' ? 'pmd' : mmd?.format === 'pmx' ? 'pmx' : 'pmx',
    textures: mmd?.textures ?? [],
    materials:
      mmd?.materials?.map((m) => ({
        name: m.name ?? 'Material',
        faceCount: m.faceCount ?? 0,
        textureIndex: m.textureIndex ?? -1,
      })) ?? [],
    bones:
      mmd?.bones?.map((b) => ({ name: b.name ?? 'bone' })) ??
      (mesh.skeleton?.bones ?? []).map((b) => ({ name: b.name })),
    morphs:
      mmd?.morphs?.map((m) => ({ name: m.name ?? 'morph', type: m.type })) ??
      morphNames.map((name) => ({ name })),
    rigidBodies: (mmd?.rigidBodies ?? []).map((r) => ({
      type: r.type ?? 0,
      name: r.name,
    })),
    constraints: mmd?.constraints ?? [],
    vertexCount,
    metadata: { triangleCountFromMesh: triangleCount },
  };
}

export async function analyzeModelFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  fileMap?: Record<string, string>
): Promise<ModelAnalysisReport> {
  const parsed = await parseModelBuffer(buffer, fileName);
  return validateParsedModel(parsed, { modelFileName: fileName, fileMap });
}

function isPmxOrPmdFileName(fileName?: string): boolean {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return lower.endsWith('.pmx') || lower.endsWith('.pmd');
}

/** Binary glTF magic `glTF` — never feed these buffers to mmd-parser. */
function bufferLooksLikeGltf(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const u8 = new Uint8Array(buffer, 0, 4);
  return u8[0] === 0x67 && u8[1] === 0x6c && u8[2] === 0x54 && u8[3] === 0x46;
}

export function analyzeLoadedMesh(
  mesh: THREE.SkinnedMesh,
  options: {
    modelFileName?: string;
    fileMap?: Record<string, string>;
    pmxBuffer?: ArrayBuffer | null;
  } = {}
): Promise<ModelAnalysisReport> {
  const { vertexCount, triangleCount } = meshCounts(mesh);
  const mmd = mesh.geometry.userData.MMD as MmdGeometryUserData | undefined;
  const ikCount = mmd?.iks?.length ?? 0;

  const fromMesh = () =>
    validateParsedModel(summaryFromMesh(mesh), {
      modelFileName: options.modelFileName,
      fileMap: options.fileMap,
      meshVertexCount: vertexCount,
      meshTriangleCount: triangleCount,
      ikCount,
    });

  const buf = options.pmxBuffer;
  if (
    buf &&
    options.modelFileName &&
    isPmxOrPmdFileName(options.modelFileName) &&
    !bufferLooksLikeGltf(buf)
  ) {
    return parseModelBuffer(buf, options.modelFileName)
      .then((parsed) =>
        validateParsedModel(parsed, {
          modelFileName: options.modelFileName,
          fileMap: options.fileMap,
          meshVertexCount: vertexCount,
          meshTriangleCount: triangleCount,
          ikCount,
        })
      )
      .catch(() => fromMesh());
  }

  return Promise.resolve(fromMesh());
}
