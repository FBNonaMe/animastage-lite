import { DEFAULT_RENDER_PIPELINE_2 } from './defaults';
import {
  applyRenderPipeline2,
  mergeRenderPipeline2,
  resolveAoPassParams,
  type RenderPipeline2ApplyResult,
} from './apply';
import { detectRenderBackend, isMobileClient } from './backend';
import { scalePipelineForDevice } from './quality';
import {
  RENDER_PIPELINE_2_PRESETS,
  applyPresetToState,
  getRenderPipeline2Preset,
} from './presets';

export type * from './types';
export {
  DEFAULT_RENDER_PIPELINE_2,
  applyRenderPipeline2,
  mergeRenderPipeline2,
  resolveAoPassParams,
  detectRenderBackend,
  isMobileClient,
  scalePipelineForDevice,
  RENDER_PIPELINE_2_PRESETS,
  applyPresetToState,
  getRenderPipeline2Preset,
};
export type { RenderPipeline2ApplyResult };
