/** Lightweight PMX/PMD parse for analysis only — does not load geometry. */

export interface ParsedPmxSummary {
  format: 'pmx' | 'pmd';
  textures: string[];
  materials: Array<{ name: string; faceCount: number; textureIndex: number }>;
  bones: Array<{
    name: string;
    englishName?: string;
    parentIndex?: number;
    position?: number[];
  }>;
  morphs: Array<{ name: string; type?: number }>;
  rigidBodies: Array<{ type: number; name?: string; boneIndex?: number }>;
  constraints: unknown[];
  iks?: Array<{ target: number; effector: number; links: number[] }>;
  vertexCount: number;
  metadata?: Record<string, unknown>;
}

type PmxLike = {
  metadata?: Record<string, unknown>;
  textures?: string[];
  materials?: Array<{ name?: string; faceCount?: number; textureIndex?: number }>;
  bones?: Array<{
    name?: string;
    englishName?: string;
    parentIndex?: number;
    position?: number[];
  }>;
  morphs?: Array<{ name?: string; type?: number }>;
  rigidBodies?: Array<{ type?: number; name?: string; boneIndex?: number }>;
  constraints?: unknown[];
  iks?: Array<{ target?: number; effector?: number; links?: Array<{ index?: number }> }>;
  vertices?: unknown[];
};

async function getParserCtor(): Promise<new () => { parsePmx: (b: ArrayBuffer, ltr?: boolean) => PmxLike; parsePmd: (b: ArrayBuffer, ltr?: boolean) => PmxLike }> {
  const mod = await import('mmd-parser');
  const ParserCtor =
    (mod as { Parser?: new () => { parsePmx: (b: ArrayBuffer) => PmxLike; parsePmd: (b: ArrayBuffer) => PmxLike } })
      .Parser ??
    (mod as { default?: { Parser?: new () => { parsePmx: (b: ArrayBuffer) => PmxLike; parsePmd: (b: ArrayBuffer) => PmxLike } } })
      .default?.Parser;
  if (!ParserCtor) {
    throw new Error('mmd-parser Parser not available');
  }
  return ParserCtor;
}

export async function parseModelBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ParsedPmxSummary> {
  const ParserCtor = await getParserCtor();
  const parser = new ParserCtor();
  const lower = fileName.toLowerCase();
  const isPmd = lower.endsWith('.pmd');
  const raw = isPmd ? parser.parsePmd(buffer, true) : parser.parsePmx(buffer, true);

  return {
    format: isPmd ? 'pmd' : 'pmx',
    textures: (raw.textures ?? []).map((t) => (typeof t === 'string' ? t : String(t))),
    materials: (raw.materials ?? []).map((m) => ({
      name: m.name ?? 'Material',
      faceCount: m.faceCount ?? 0,
      textureIndex: m.textureIndex ?? -1,
    })),
    bones: (raw.bones ?? []).map((b) => ({
      name: b.name ?? 'bone',
      englishName: b.englishName,
      parentIndex: b.parentIndex,
      position: b.position,
    })),
    morphs: (raw.morphs ?? []).map((m) => ({ name: m.name ?? 'morph', type: m.type })),
    rigidBodies: (raw.rigidBodies ?? []).map((r, i) => ({
      type: r.type ?? 0,
      name: r.name,
      boneIndex: (r as { boneIndex?: number }).boneIndex ?? i,
    })),
    constraints: raw.constraints ?? [],
    iks: (raw.iks ?? []).map((ik) => ({
      target: ik.target ?? -1,
      effector: ik.effector ?? -1,
      links: (ik.links ?? []).map((l) => l.index ?? -1).filter((idx) => idx >= 0),
    })),
    vertexCount: raw.vertices?.length ?? 0,
    metadata: raw.metadata,
  };
}
