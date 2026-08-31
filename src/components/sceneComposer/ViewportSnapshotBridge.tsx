import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { captureViewportSnapshot } from '../../utils/viewportSnapshot';
import { isWebGlContextReady } from '../../postfx/isWebGlContextReady';

/** Registers a capture fn — never calls gl.render (breaks EffectComposer). */
export default function ViewportSnapshotBridge({
  onReady,
}: {
  onReady?: (capture: () => string | null) => void;
}) {
  const { gl, invalidate } = useThree();
  const lastSnapRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onReady) return;
    onReady(() => {
      if (!isWebGlContextReady(gl)) {
        return lastSnapRef.current;
      }
      invalidate();
      const snap = captureViewportSnapshot(gl.domElement);
      if (snap) lastSnapRef.current = snap;
      return snap ?? lastSnapRef.current;
    });
  }, [gl, invalidate, onReady]);

  return null;
}
