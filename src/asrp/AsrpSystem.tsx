/**
 * ASRP runtime — V2 frame-aware Silhouette POM + anime material shading.
 */
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { AppState, ViewportFormat } from '../types';
import { DEFAULT_ASRP } from './defaults';
import { getAsrpQualityProfile } from './quality';
import {
  applyAsrpToObject,
  buildPomBagFromSettings,
  isAsrpActive,
} from './applyAsrp';
import { syncSilhouettePomUniforms } from './silhouettePom';
import { resolveAsrpFrame } from './v2/resolveFrame';
import { applyAsrpMaterialShadingToObject } from './v2/materialShading';
import {
  AsrpVolumetricAtmosphere,
  AsrpMotionBlurLite,
  AsrpAdvancedPassFlags,
  AsrpPropDistanceLod,
} from './v2/advancedPasses';

export interface AsrpSystemProps {
  appState: AppState;
  exporting?: boolean;
  viewportFormat?: ViewportFormat;
  cinema?: boolean;
  /** Visual Quality 2.0 atmosphere owns fog — skip ASRP Fog. */
  skipVolumetricFog?: boolean;
}

export default function AsrpSystem({
  appState,
  exporting = false,
  viewportFormat = '16:9',
  cinema = false,
  skipVolumetricFog = false,
}: AsrpSystemProps) {
  const { scene, camera } = useThree();
  const frame = useMemo(
    () =>
      resolveAsrpFrame(appState, viewportFormat, {
        exporting,
        cinema,
      }),
    [appState, viewportFormat, exporting, cinema]
  );

  const settings = {
    ...(appState.asrp ?? DEFAULT_ASRP),
    ...frame.asrpOverrides,
  };
  const rtxLite = settings.pipeline === 'rtx_lite' || appState.rtxModeEnabled;

  const quality = useMemo(
    () =>
      getAsrpQualityProfile(settings, {
        exporting: exporting || cinema,
        rtxLite,
      }),
    [settings, exporting, cinema, rtxLite]
  );

  useEffect(() => {
    applyAsrpMaterialShadingToObject(scene, {
      mode: frame.budgets.materialShading,
      strength: frame.budgets.animeShadingStrength,
    });
    if (frame.pipeline === 'classic') return;
    if (!frame.budgets.pomEnabled) return;
    applyAsrpToObject(scene, settings, {
      exporting: exporting || cinema,
      rtxLite,
    });
  }, [
    scene,
    settings,
    exporting,
    cinema,
    rtxLite,
    appState.models.length,
    frame.pipeline,
    frame.budgets.pomEnabled,
    frame.budgets.materialShading,
    frame.budgets.animeShadingStrength,
  ]);

  useFrame(() => {
    if (frame.pipeline === 'classic' || !frame.budgets.pomEnabled) {
      syncSilhouettePomUniforms(scene, {
        enabled: 0,
        heightScale: 0,
        minLayers: 4,
        maxLayers: 8,
        minViewZ: 0.05,
        silhouette: 0,
        softSilhouette: 1,
        normalBlend: 1,
        fade: 0,
        heightMap: null,
      });
      return;
    }

    const dist = camera.position.length();
    let fade = 1;
    if (dist > quality.distanceFadeStart) {
      fade =
        1 -
        (dist - quality.distanceFadeStart) /
          Math.max(0.001, quality.distanceFadeEnd - quality.distanceFadeStart);
      fade = THREE.MathUtils.clamp(fade, 0, 1);
    }

    syncSilhouettePomUniforms(scene, buildPomBagFromSettings(settings, quality, fade));
  });

  return (
    <>
      {skipVolumetricFog ? null : <AsrpVolumetricAtmosphere frame={frame} />}
      <AsrpMotionBlurLite frame={frame} />
      <AsrpAdvancedPassFlags frame={frame} />
      <AsrpPropDistanceLod enabled={frame.mobile || frame.budgets.shadowTier === 'low'} />
    </>
  );
}
