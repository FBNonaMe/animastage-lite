/**
 * Viewport-only Smart Render — never applied during Cinema / offline capture.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { AppState } from '../../types';
import {
  buildSmartViewportDowngrade,
  DEFAULT_RENDER_PIPELINE_4,
} from '../../renderPipeline4';
import { isRecordingCapture } from '../../video/recordingCapture';

export interface SmartRenderBridgeProps {
  appState: AppState;
  onApplyViewportPatch: (patch: Partial<AppState>) => void;
}

export default function SmartRenderBridge({
  appState,
  onApplyViewportPatch,
}: SmartRenderBridgeProps) {
  const frames = useRef(0);
  const elapsed = useRef(0);
  const lastScale = useRef(1);
  const coolDown = useRef(0);

  useFrame((_, dt) => {
    if (isRecordingCapture()) return;
    const rp4 = appState.renderPipeline4 ?? DEFAULT_RENDER_PIPELINE_4;
    if (!rp4.smartRender.enabled) return;

    frames.current += 1;
    elapsed.current += dt;
    coolDown.current = Math.max(0, coolDown.current - dt);
    if (elapsed.current < 1.2) return;

    const fps = frames.current / elapsed.current;
    frames.current = 0;
    elapsed.current = 0;

    if (coolDown.current > 0) return;

    if (fps >= rp4.smartRender.targetFps) {
      if (lastScale.current < 0.98 && rp4.smartRender.viewportScale < 0.98) {
        lastScale.current = 1;
        onApplyViewportPatch({
          renderPipeline4: {
            ...rp4,
            smartRender: { ...rp4.smartRender, viewportScale: 1 },
          },
        });
        coolDown.current = 2.5;
      }
      return;
    }

    const result = buildSmartViewportDowngrade(appState, fps);
    if (!result) return;
    if (Math.abs(result.scale - lastScale.current) < 0.08) return;
    lastScale.current = result.scale;
    onApplyViewportPatch(result.patch);
    coolDown.current = 2.5;
  });

  return null;
}
