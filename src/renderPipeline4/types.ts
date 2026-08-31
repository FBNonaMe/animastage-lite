/**
 * AnimaStage Render Pipeline 4.0 — professional export + predictable scene isolation.
 * Viewport quality adapts independently; final render never inherits viewport downgrades.
 */

export type Rp4ResolutionPresetId =
  | '720p'
  | '1080p'
  | '2k'
  | '4k'
  | '8k'
  | 'custom';

export type Rp4FpsPresetId =
  | '24'
  | '25'
  | '30'
  | '50'
  | '60'
  | '90'
  | '120'
  | 'custom';

export type Rp4QualityPresetId =
  | 'draft'
  | 'preview'
  | 'standard'
  | 'high'
  | 'ultra'
  | 'cinematic'
  | 'master';

export type Rp4AntiAliasingId = 'fxaa' | 'smaa' | 'msaa' | 'taa' | 'disabled';

export type Rp4CodecId =
  | 'mp4_h264'
  | 'mp4_h265'
  | 'webm_vp9'
  | 'av1'
  | 'gif'
  | 'png_sequence'
  | 'exr_sequence';

export type Rp4BitrateModeId =
  | 'automatic'
  | 'low'
  | 'medium'
  | 'high'
  | 'very_high'
  | 'lossless'
  | 'manual';

export type Rp4BackgroundExportId = 'solid' | 'transparent' | 'alpha' | 'hdr';

export type Rp4RenderPassId =
  | 'beauty'
  | 'depth'
  | 'normal'
  | 'ao'
  | 'shadow'
  | 'reflection'
  | 'emission'
  | 'mask';

export interface Rp4QualityBudgets {
  shadowResolution: number;
  reflectionQuality: number;
  bloomQuality: number;
  dofQuality: number;
  antiAliasing: Rp4AntiAliasingId;
  textureResolutionScale: number;
  volumetricSamples: number;
  ssrQuality: number;
  ssaoQuality: number;
  supersample: 1 | 1.5 | 2 | 3;
  settleFrames: number;
}

export interface Rp4ResolutionSettings {
  preset: Rp4ResolutionPresetId;
  width: number;
  height: number;
}

export interface Rp4FpsSettings {
  preset: Rp4FpsPresetId;
  fps: number;
}

export interface Rp4BitrateSettings {
  mode: Rp4BitrateModeId;
  /** Manual Mbps when mode === 'manual'. */
  manualMbps: number;
}

export interface Rp4AudioExportSettings {
  backgroundMusic: boolean;
  voice: boolean;
  soundEffects: boolean;
  normalizeVolume: boolean;
}

export interface Rp4ExportPreview {
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  frameCount: number;
  estimatedFileSizeMb: number;
  estimatedRenderTimeSec: number;
  estimatedGpuUsagePct: number;
  estimatedMemoryMb: number;
  codec: Rp4CodecId;
  quality: Rp4QualityPresetId;
}

export interface Rp4SmartRenderSettings {
  /** Drop viewport effects when GPU is overloaded — never touches export. */
  enabled: boolean;
  /** Target interactive FPS before viewport downgrade. */
  targetFps: number;
  /** Current viewport-only scale (1 = full). */
  viewportScale: number;
}

export interface RenderPipeline4State {
  version: 4;
  enabled: boolean;
  quality: Rp4QualityPresetId;
  resolution: Rp4ResolutionSettings;
  fps: Rp4FpsSettings;
  antiAliasing: Rp4AntiAliasingId;
  codec: Rp4CodecId;
  bitrate: Rp4BitrateSettings;
  audio: Rp4AudioExportSettings;
  background: Rp4BackgroundExportId;
  solidBackgroundColor: string;
  passes: Rp4RenderPassId[];
  smartRender: Rp4SmartRenderSettings;
  /** Lock final export budgets — ignore viewport smart scale. */
  lockExportQuality: boolean;
}
