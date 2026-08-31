export const SITE_URL = 'https://animastage-lite.app';

export const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.webmmd.suite';

/** Shipped with `npm run build:android` → public/app-debug.apk (sideload fallback) */
export const ANDROID_RELEASE = {
  url: '/app-debug.apk',
  directUrl: `${SITE_URL}/app-debug.apk`,
  downloadName: 'AnimaStage-Lite-1.4.0-portrait.apk',
  version: '1.4.0',
  versionCode: 10,
  buildLabel: 'Aug 2026',
  sizeMb: 19.6,
  sizeHint: '~20 MB',
  minAndroid: 'Android 6.0+ (API 23)',
  orientation: 'Portrait (vertical)',
  packageId: 'com.webmmd.suite',
  privacyPolicyUrl: `${SITE_URL}/privacy-policy.html`,
  playStore: {
    status: 'published' as const,
    url: GOOGLE_PLAY_URL,
  },
  /** Shared with web — shown on landing for both platforms. */
  whatsNew: [
    'UI 3.0 Studio — Scene Studio 2.0, FX panel, multi-tab timeline',
    'Cinematic FX — HDR bloom, color grade, SSR, vignette, lens dispersion',
    'Anime NPR render mode · Path Tracer Lab with OIDN denoise',
    'Director Workflow — cast, clips, music, effect timeline & curves',
    'Smart Pose presets in Pose Library',
    'Motion Capture 2.0 — WHAM video → keys / BVH export',
    'OpenRouter AI · Dynamic Sky · CapCut-style Android dock',
    'Android targetSdk 36 · 9:16 Shorts framing by default',
  ],
  highlights: [
    'Full studio — not a demo: open, import, edit, export',
    'Same engine on Web and Google Play (portrait on phone)',
    'PMX/PMD/VMD + GLB, UI 3.0 timeline, Scene Studio, Cinematic FX',
    'Director Workflow, Smart Pose, mocap 2.0, Path Tracer Lab',
    'Client-side only — files stay on your device, no account',
  ],
  requirements: [
    'Phone or tablet held upright (portrait); app stays vertical',
    'Install from Google Play (recommended) or sideload the APK',
    'WebGL2-capable device; 4 GB+ RAM recommended for heavy PMX',
    'Chrome-based WebView — best on Android 10+',
  ],
  installSteps: [
    'Open Google Play and search for AnimaStage Lite, or use the button on this page.',
    'Tap Install and wait for the download to finish.',
    'Launch the app — the studio opens in portrait mode.',
    'Use Scene Studio for moods, FX for Cinematic FX / export, More → WHAM Mocap.',
  ],
  sideloadInstallSteps: [
    'Download app-debug.apk from the sideload link (~20 MB).',
    'If blocked: Settings → Security → allow install from your browser or Files app.',
    'Open the APK and tap Install.',
    'Launch AnimaStage Lite — same studio as the Play Store build.',
  ],
} as const;

export function isPlayStorePublished(): boolean {
  return (
    ANDROID_RELEASE.playStore.status === 'published' &&
    ANDROID_RELEASE.playStore.url != null
  );
}

export function getGooglePlayUrl(): string {
  return ANDROID_RELEASE.playStore.url ?? GOOGLE_PLAY_URL;
}
