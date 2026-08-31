import { EffectComposer } from '@react-three/postprocessing';
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { isWebGlContextReady } from './isWebGlContextReady';
import { usePostFxGlReady } from './usePostFxGlReady';
import {
  getGraphicsEpoch,
  isGpuSuspended,
  isWebGlContextLostActive,
  subscribeGraphicsSystem,
} from '../render/graphicsSystemStore';

/** Consecutive ready frames before arming (demand frameloop). */
const WARMUP_FRAMES = 16;
/** Extra frames after warmup before mounting passes (avoids null contextAttributes.alpha). */
const MOUNT_DELAY_FRAMES = 8;
/** After GPU remount, keep EffectComposer off so the new context settles. */
const POST_RECOVERY_COOLDOWN_MS = 1200;

interface PostFxDeferredComposerProps {
  enabled: boolean;
  composerKey: string;
  multisampling?: number;
  enableNormalPass?: boolean;
  children: ReactNode;
}

function graphicsBlocksComposer(): boolean {
  return isGpuSuspended() || isWebGlContextLostActive();
}

/**
 * Mount EffectComposer only after WebGL context is stable for N frames.
 * addPass reads getContextAttributes().alpha — throws if context is null.
 */
export default function PostFxDeferredComposer({
  enabled,
  composerKey,
  multisampling = 0,
  enableNormalPass = false,
  children,
}: PostFxDeferredComposerProps) {
  const { gl, invalidate } = useThree();
  const glReady = usePostFxGlReady();
  const [mounted, setMounted] = useState(false);
  const [graphicsOk, setGraphicsOk] = useState(() => !graphicsBlocksComposer());
  const [graphicsEpoch, setGraphicsEpoch] = useState(() => getGraphicsEpoch());
  const [cooldownDone, setCooldownDone] = useState(true);
  const readyFramesRef = useRef(0);
  const skipFirstEpochCooldownRef = useRef(true);

  useEffect(() => {
    return subscribeGraphicsSystem(() => {
      setGraphicsEpoch(getGraphicsEpoch());
      const ok = !graphicsBlocksComposer();
      setGraphicsOk(ok);
      if (!ok) {
        readyFramesRef.current = 0;
        setMounted(false);
      }
    });
  }, []);

  useEffect(() => {
    if (skipFirstEpochCooldownRef.current) {
      skipFirstEpochCooldownRef.current = false;
      setCooldownDone(true);
      return;
    }
    setCooldownDone(false);
    readyFramesRef.current = 0;
    setMounted(false);
    const timer = window.setTimeout(() => setCooldownDone(true), POST_RECOVERY_COOLDOWN_MS);
    return () => window.clearTimeout(timer);
  }, [graphicsEpoch]);

  useEffect(() => {
    readyFramesRef.current = 0;
    setMounted(false);
  }, [enabled, glReady, gl, composerKey, graphicsOk, cooldownDone]);

  useFrame(() => {
    if (!enabled || !glReady || !graphicsOk || !cooldownDone || graphicsBlocksComposer()) {
      readyFramesRef.current = 0;
      if (mounted) setMounted(false);
      return;
    }

    if (!isWebGlContextReady(gl)) {
      readyFramesRef.current = 0;
      if (mounted) setMounted(false);
      invalidate();
      return;
    }

    readyFramesRef.current += 1;
    const threshold = WARMUP_FRAMES + MOUNT_DELAY_FRAMES;

    if (readyFramesRef.current < threshold) {
      if (mounted) setMounted(false);
      invalidate();
      return;
    }

    if (!mounted) {
      if (isWebGlContextReady(gl) && !graphicsBlocksComposer()) {
        setMounted(true);
      }
    }
  });

  if (
    !enabled ||
    !glReady ||
    !graphicsOk ||
    !cooldownDone ||
    !mounted ||
    graphicsBlocksComposer()
  ) {
    return null;
  }

  if (!isWebGlContextReady(gl)) {
    return null;
  }

  return (
    <EffectComposer
      key={composerKey}
      multisampling={multisampling}
      enableNormalPass={enableNormalPass}
    >
      {Children.toArray(children).filter(Boolean)}
    </EffectComposer>
  );
}
