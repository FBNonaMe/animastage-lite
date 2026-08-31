import type { CanonicalBoneMatch, UmceDetectionSource } from './types';

let consoleEnabled = true;

export function setUmceConsoleEnabled(enabled: boolean): void {
  consoleEnabled = enabled;
}

export function umceLog(
  message: string,
  detail?: Record<string, string | number | boolean | undefined>
): void {
  if (!consoleEnabled) return;
  if (detail) {
    const parts = Object.entries(detail)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    console.info(`[UMCE] ${message}${parts ? ` ${parts}` : ''}`);
  } else {
    console.info(`[UMCE] ${message}`);
  }
}

export function umceLogBoneDetected(match: CanonicalBoneMatch): void {
  umceLog('Bone detected:', {
    bone: match.canonicalId,
    name: match.boneName,
    source: match.source,
    confidence: match.confidence,
  });
}

export function umceLogReportSummary(compatibility: number, warnings: number): void {
  umceLog(`Compatibility ${compatibility}%`, { warnings });
}

export function tierToSource(tier: string): UmceDetectionSource {
  if (tier === 'jp') return 'name_jp';
  if (tier === 'en') return 'name_en';
  if (tier === 'alias') return 'alias';
  return 'pattern';
}
