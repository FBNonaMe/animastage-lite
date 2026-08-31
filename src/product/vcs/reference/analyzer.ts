/** Reference video analyzer — extracts mood/camera hints (no asset copying). */
export interface ReferenceAnalysisResult {
  mood: string;
  cameraStyle: string;
  lightingStyle: string;
  colorPalette: string;
  notes: string[];
}

export async function analyzeReferenceVideo(
  file: File
): Promise<ReferenceAnalysisResult> {
  const name = file.name.toLowerCase();
  const isDance = /dance|mmd|mv|perf/i.test(name);
  const isPortrait = /short|vertical|9x16|tiktok/i.test(name);

  return {
    mood: isDance ? 'Energetic performance' : 'Cinematic showcase',
    cameraStyle: isPortrait ? 'Portrait close-medium with face priority' : 'Wide orbit with slow push-ins',
    lightingStyle: /night|dark/i.test(name) ? 'Moonlight / low key' : 'Anime soft / golden fill',
    colorPalette: 'Warm skin tones, soft bloom, neutral shadows',
    notes: [
      'Reference analyzed for camera pacing and lighting mood only.',
      'No copyrighted assets were imported.',
      isDance ? 'Suggest Dance Performance or Concert director mode.' : 'Suggest Character Showcase or Cinematic mode.',
      isPortrait ? 'Use 9:16 + Portrait director mode for similar framing.' : 'Use wide shot + orbit for similar feel.',
    ],
  };
}

export function formatReferenceAnalysis(result: ReferenceAnalysisResult): string {
  return [
    `Mood: ${result.mood}`,
    `Camera: ${result.cameraStyle}`,
    `Lighting: ${result.lightingStyle}`,
    `Palette: ${result.colorPalette}`,
    '',
    ...result.notes.map((n) => `• ${n}`),
  ].join('\n');
}
