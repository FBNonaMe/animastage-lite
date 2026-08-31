import type { RenderPipeline4State } from './types';

export const DEFAULT_RENDER_PIPELINE_4: RenderPipeline4State = {
  version: 4,
  enabled: true,
  quality: 'standard',
  resolution: {
    preset: '1080p',
    width: 1920,
    height: 1080,
  },
  fps: {
    preset: '30',
    fps: 30,
  },
  antiAliasing: 'smaa',
  codec: 'mp4_h264',
  bitrate: {
    mode: 'automatic',
    manualMbps: 40,
  },
  audio: {
    backgroundMusic: true,
    voice: true,
    soundEffects: true,
    normalizeVolume: true,
  },
  background: 'solid',
  solidBackgroundColor: '#141820',
  passes: ['beauty'],
  smartRender: {
    enabled: true,
    targetFps: 30,
    viewportScale: 1,
  },
  lockExportQuality: true,
};
