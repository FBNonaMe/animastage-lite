import type { VmdMotionData } from './types';

async function getParserCtor(): Promise<
  new () => { parseVmd: (buf: ArrayBuffer, raw: boolean) => VmdMotionData }
> {
  const mod = await import('mmd-parser');
  const ParserCtor =
    (mod as { Parser?: new () => { parseVmd: (b: ArrayBuffer, r: boolean) => VmdMotionData } }).Parser ??
    (mod as { default?: { Parser?: new () => { parseVmd: (b: ArrayBuffer, r: boolean) => VmdMotionData } } })
      .default?.Parser;
  if (!ParserCtor) throw new Error('mmd-parser Parser not available');
  return ParserCtor;
}

export async function parseVmdBuffer(buffer: ArrayBuffer): Promise<VmdMotionData> {
  const ParserCtor = await getParserCtor();
  const parser = new ParserCtor();
  return parser.parseVmd(buffer, true);
}

/** Mutate VMD motion bone names using UMCE remap table. */
export function applyVmdBoneRemap(
  vmd: VmdMotionData,
  remapTable: Record<string, string>
): void {
  if (!vmd.motions?.length) return;
  for (const motion of vmd.motions) {
    const mapped = remapTable[motion.boneName];
    if (mapped && mapped !== motion.boneName) {
      motion.boneName = mapped;
    }
  }
}
