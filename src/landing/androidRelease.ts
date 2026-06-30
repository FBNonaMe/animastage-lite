export const SITE_URL = 'https://animastage-lite.app';

export const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.webmmd.suite';

/** Shipped with `npm run build:android` → public/app-debug.apk (sideload fallback) */
export const ANDROID_RELEASE = {
  url: '/app-debug.apk',
  directUrl: `${SITE_URL}/app-debug.apk`,
  downloadName: 'AnimaStage-Lite-1.2.3-portrait.apk',
  version: '1.2.3',
  versionCode: 6,
  buildLabel: '01.06.2026',
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
  whatsNew: [
    'Improved stability and performance on Android 15 / 16',
    'Export via FX tab — MP4 saved through the Share menu',
    'Portrait studio: Scene, Control, Camera, FX tabs',
    'Client-side PMX/PMD/VMD — no account required',
  ],
  highlights: [
    'Opens straight into Studio — no marketing page on launch',
    'Portrait-first mobile shell — Scene, Control, Camera, FX tabs',
    'Same PMX/PMD/VMD import, timeline, Camera Studio, and MP4 export as the browser',
    'Client-side only — files stay on your device, no account required',
    'Available on Google Play and as optional sideload APK',
  ],
  requirements: [
    'Phone or tablet held upright (portrait); app stays vertical',
    'Install from Google Play (recommended) or sideload the debug APK',
    'WebGL2-capable device; 4 GB+ RAM recommended for heavy PMX',
    'Chrome-based WebView — best on Android 10+',
  ],
  installSteps: [
    'Open Google Play and search for AnimaStage Lite, or use the button on this page.',
    'Tap Install and wait for the download to finish.',
    'Launch the app — the studio opens in portrait mode.',
    'Use Scene to load PMX, Play to preview motion, FX to export MP4.',
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
