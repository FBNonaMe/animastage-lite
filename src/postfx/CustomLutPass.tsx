import { LUT } from '@react-three/postprocessing';
import { BlendFunction, LUT3DEffect } from 'postprocessing';
import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { parseLutFromUrl } from '../utils/lutParser';

interface CustomLutPassProps {
  url: string;
  fileName: string;
  intensity?: number;
}

/** Loads a .cube / .3dl LUT and applies it in the post stack. */
export default function CustomLutPass({ url, fileName, intensity = 1 }: CustomLutPassProps) {
  const effectRef = useRef<LUT3DEffect>(null);
  const [texture, setTexture] = useState<THREE.Data3DTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: THREE.Data3DTexture | null = null;

    parseLutFromUrl(url, fileName)
      .then((tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        loaded = tex;
        setTexture(tex);
      })
      .catch((err) => {
        console.warn('[LUT] Failed to load:', fileName, err);
        if (!cancelled) setTexture(null);
      });

    return () => {
      cancelled = true;
      loaded?.dispose();
      setTexture((prev) => {
        if (prev && prev !== loaded) prev.dispose();
        return null;
      });
    };
  }, [url, fileName]);

  useEffect(() => {
    const effect = effectRef.current;
    if (!effect) return;
    effect.blendMode.opacity.value = Math.min(1, Math.max(0, intensity));
  }, [intensity, texture]);

  if (!texture) return null;

  return (
    <LUT
      ref={effectRef}
      lut={texture}
      blendFunction={BlendFunction.NORMAL}
      tetrahedralInterpolation
    />
  );
}
