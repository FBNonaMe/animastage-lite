import { useMemo } from 'react';
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  HueSaturation,
  N8AO,
  SMAA,
  Sepia,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import type { ViewportFormat, VisualFxSettings } from '../types';
import type { RtxSettings } from '../utils/rtxSettings';
import { getLitePostFxTuning, resolveBloomParams } from '../postfx/litePostFxConfig';
import { getColorGrade } from '../visualFx/visualFxPresets';
import { usePostFxGlReady } from '../postfx/usePostFxGlReady';
import PostFxDeferredComposer from '../postfx/PostFxDeferredComposer';
import CustomLutPass from '../postfx/CustomLutPass';
import RayColorGradingPass from '../postfx/rayMmd/RayColorGradingPass';
import RayHdrBloomPass from '../postfx/rayMmd/RayHdrBloomPass';
import RayMmdSsrPass from '../postfx/rayMmd/RayMmdSsrPass';
import RayMmdVignettePass from '../postfx/rayMmd/RayMmdVignettePass';
import RayMmdLensPass from '../postfx/rayMmd/RayMmdLensPass';
import {
  RAY_MMD_COLOR_GRADE_NEUTRAL,
  RAY_MMD_BLOOM_NEUTRAL,
  RAY_MMD_SSR_NEUTRAL,
  RAY_MMD_VIGNETTE_NEUTRAL,
  RAY_MMD_LENS_NEUTRAL,
} from '../standaloneEffects/presets';
import ModelDofFocus from './ModelDofFocus';
import PostFxDirectRenderSync from './PostFxDirectRenderSync';
import { resolveAoPassParams } from '../renderPipeline2/apply';
import type { RenderPipeline2State } from '../renderPipeline2/types';

interface ScenePostProcessingProps {
  visualFx: VisualFxSettings;
  modelOffset?: { x: number; y: number; z: number };
  viewportFormat?: ViewportFormat;
  rtxModeEnabled?: boolean;
  rtxSettings?: RtxSettings;
  pauseRtx?: boolean;
  godRaySunRef?: React.RefObject<THREE.Mesh | null>;
  /** Render Pipeline 2.0 — AO mode profiles + bloom style. */
  renderPipeline2?: RenderPipeline2State | null;
}

export default function ScenePostProcessing({
  visualFx,
  modelOffset = { x: 0, y: 0, z: 0 },
  viewportFormat = '16:9',
  rtxModeEnabled = false,
  rtxSettings,
  pauseRtx = false,
  renderPipeline2 = null,
}: ScenePostProcessingProps) {
  const glReady = usePostFxGlReady();
  const focusTarget = useMemo(() => new THREE.Vector3(0, 11, 0), []);

  const tuning = useMemo(
    () => getLitePostFxTuning(visualFx, viewportFormat, rtxModeEnabled, pauseRtx),
    [visualFx, viewportFormat, rtxModeEnabled, pauseRtx]
  );

  const rtxLive = rtxModeEnabled && !pauseRtx;
  const colorGrade = useMemo(
    () => getColorGrade(visualFx.colorGrade ?? 'neutral'),
    [visualFx.colorGrade]
  );
  const useCustomLut = Boolean(
    visualFx.customLutUrl &&
      visualFx.customLutName &&
      visualFx.customLutEnabled !== false
  );
  const rayGrade = visualFx.rayMmdColorGrade ?? RAY_MMD_COLOR_GRADE_NEUTRAL;
  const rayBloom = visualFx.rayMmdBloom ?? RAY_MMD_BLOOM_NEUTRAL;
  const raySsr = visualFx.rayMmdSsr ?? RAY_MMD_SSR_NEUTRAL;
  const rayVignette = visualFx.rayMmdVignette ?? RAY_MMD_VIGNETTE_NEUTRAL;
  const rayLens = visualFx.rayMmdLens ?? RAY_MMD_LENS_NEUTRAL;
  const rayGradeActive =
    rayGrade.enabled && rayGrade.amount > 0.0001 && !useCustomLut;
  const rayBloomActive = rayBloom.enabled && rayBloom.amount > 0.0001;
  const raySsrActive = raySsr.enabled && raySsr.amount > 0.0001;
  const rayVignetteActive = rayVignette.enabled && rayVignette.amount > 0.0001;
  const rayLensActive = rayLens.enabled && rayLens.dispersion > 0.0001;
  const colorGradeActive =
    !useCustomLut &&
    !rayGradeActive &&
    visualFx.colorGrade != null &&
    visualFx.colorGrade !== 'neutral';
  const bloomParams = useMemo(
    () => resolveBloomParams(visualFx, tuning, rtxSettings, rtxLive),
    [visualFx, tuning, rtxSettings, rtxLive]
  );
  const aoProfile = useMemo(
    () => (renderPipeline2?.enabled ? resolveAoPassParams(renderPipeline2) : null),
    [renderPipeline2]
  );

  const handleFocusPoint = useMemo(
    () => (point: THREE.Vector3) => {
      focusTarget.copy(point);
    },
    [focusTarget]
  );

  const showBloom =
    tuning.bloom && (visualFx.bloomEnabled || rtxLive) && !rayBloomActive;
  const vignetteOpacity = visualFx.vignetteEnabled
    ? (visualFx.vignetteIntensity ?? 0.4) * 0.85
    : 0;

  const needsNormalPass = false;

  const liteAoRadius = aoProfile?.enabled
    ? aoProfile.aoRadius
    : Math.max(2.5, tuning.ssaoRadius * 16);
  const liteAoIntensity = aoProfile?.enabled ? aoProfile.intensity : tuning.ssaoIntensity;
  const liteAoHalfRes = aoProfile?.enabled ? aoProfile.halfRes : visualFx.ssaoHalfRes !== false;
  const liteAoFalloff = aoProfile?.enabled ? aoProfile.distanceFalloff : 0.9;
  const liteAoQuality = aoProfile?.enabled ? aoProfile.quality : 'medium';
  const showSsao = aoProfile ? aoProfile.enabled : tuning.ssao;

  const showChromatic = tuning.chromatic && !rayLensActive;
  const showBuiltInVignette =
    tuning.vignette && vignetteOpacity > 0.01 && !rayVignetteActive;

  const hasPasses =
    rtxLive ||
    showSsao ||
    tuning.dof ||
    showBloom ||
    rayBloomActive ||
    raySsrActive ||
    showChromatic ||
    colorGradeActive ||
    rayGradeActive ||
    useCustomLut ||
    rayVignetteActive ||
    rayLensActive ||
    showBuiltInVignette ||
    tuning.smaa;

  const composerActive = tuning.enableComposer && glReady && hasPasses;

  const chromaticOffset = useMemo(
    () =>
      new THREE.Vector2(
        visualFx.chromaticAberration ?? 0.001,
        visualFx.chromaticAberration ?? 0.001
      ),
    [visualFx.chromaticAberration]
  );

  const composerKey = useMemo(
    () =>
      [
        viewportFormat,
        rtxLive ? 'rtx' : 'lite',
        showSsao ? `ao-${aoProfile?.quality ?? 'm'}` : '',
        tuning.dof ? 'dof' : '',
        showBloom ? `bloom-${renderPipeline2?.bloom.style ?? 'c'}` : '',
        rayBloomActive ? 'ray-bloom' : '',
        raySsrActive ? 'ray-ssr' : '',
        rayLensActive ? 'ray-lens' : '',
        rayVignetteActive ? 'ray-vig' : '',
        colorGradeActive ? 'grade' : '',
        rayGradeActive ? 'ray-grade' : '',
        useCustomLut ? `lut-${visualFx.customLutName}` : '',
        'vq2',
        tuning.smaa ? 'smaa' : '',
        showBuiltInVignette ? 'vig' : '',
      ].join('-'),
    [
      viewportFormat,
      rtxLive,
      showSsao,
      aoProfile?.quality,
      tuning.dof,
      showBloom,
      rayBloomActive,
      raySsrActive,
      rayLensActive,
      rayVignetteActive,
      renderPipeline2?.bloom.style,
      colorGradeActive,
      rayGradeActive,
      useCustomLut,
      visualFx.customLutName,
      tuning.smaa,
      showBuiltInVignette,
    ]
  );

  const bloomRadius =
    renderPipeline2?.bloom.style === 'soft'
      ? Math.max(bloomParams.radius, 0.85)
      : renderPipeline2?.bloom.style === 'multi_res'
        ? Math.max(bloomParams.radius, 0.95)
        : bloomParams.radius;

  const bloomPass = showBloom ? (
    <Bloom
      key="bloom"
      intensity={bloomParams.intensity}
      luminanceThreshold={bloomParams.threshold}
      luminanceSmoothing={renderPipeline2?.bloom.style === 'soft' ? 0.95 : 0.85}
      mipmapBlur
      radius={bloomRadius}
    />
  ) : null;

  const gradeBrightness =
    colorGrade.brightness + (visualFx.gradeExposure ?? 0) * 0.08;
  const gradeContrast =
    colorGrade.contrast + (visualFx.gradeContrast ?? 0) * 0.1;
  const gradeSat =
    colorGrade.saturation + (visualFx.gradeSaturation ?? 0) * 0.15;

  const gradePass = (
    <>
      {colorGradeActive && (
        <>
          <HueSaturation
            key="hue"
            hue={colorGrade.hue + (visualFx.gradeTemperature ?? 0) * 0.04}
            saturation={gradeSat}
          />
          <BrightnessContrast
            key="bc"
            brightness={gradeBrightness}
            contrast={gradeContrast}
          />
          {(colorGrade.sepia ?? 0) > 0.01 ? (
            <Sepia key="sepia" intensity={colorGrade.sepia} />
          ) : null}
        </>
      )}
      {useCustomLut && visualFx.customLutUrl && visualFx.customLutName ? (
        <CustomLutPass
          key="custom-lut"
          url={visualFx.customLutUrl}
          fileName={visualFx.customLutName}
          intensity={visualFx.customLutIntensity ?? 1}
        />
      ) : null}
      {rayGradeActive ? <RayColorGradingPass key="ray-mmd-grade" settings={rayGrade} /> : null}
      {rayLensActive ? <RayMmdLensPass key="ray-mmd-lens" settings={rayLens} /> : null}
    </>
  );

  return (
    <>
      <PostFxDirectRenderSync composerEnabled={composerActive} />
      {tuning.dof && composerActive && (
        <ModelDofFocus enabled modelOffset={modelOffset} onFocusPoint={handleFocusPoint} />
      )}
      <PostFxDeferredComposer
        enabled={composerActive}
        composerKey={composerKey}
        multisampling={tuning.multisampling}
        enableNormalPass={needsNormalPass}
      >
        {rtxLive && rtxSettings ? (
          <N8AO
            aoRadius={rtxSettings.aoRadius}
            distanceFalloff={0.85}
            intensity={rtxSettings.aoIntensity}
            quality={rtxSettings.aoQuality}
            halfRes={rtxSettings.halfResAo}
          />
        ) : showSsao ? (
          <N8AO
            aoRadius={liteAoRadius}
            distanceFalloff={liteAoFalloff}
            intensity={liteAoIntensity}
            quality={liteAoQuality}
            halfRes={liteAoHalfRes}
            depthAwareUpsampling
          />
        ) : null}

        {raySsrActive ? <RayMmdSsrPass key="ray-mmd-ssr" settings={raySsr} /> : null}

        {/* VQ 2.0 / TZ §42: AO → SSR → Bloom → DOF → Grade/LUT → Lens → Vignette → SMAA */}
        {bloomPass}

        {rayBloomActive ? <RayHdrBloomPass key="ray-mmd-bloom" settings={rayBloom} /> : null}

        {tuning.dof && (
          <DepthOfField
            target={focusTarget}
            focusDistance={visualFx.dofFocusDistance ?? 0.03}
            focalLength={visualFx.dofFocalLength ?? 0.008}
            bokehScale={visualFx.dofBokehScale ?? 1.1}
            height={480}
          />
        )}

        {gradePass}

        {showChromatic && (
          <ChromaticAberration
            offset={chromaticOffset}
            radialModulation
            modulationOffset={0.4}
          />
        )}

        {rayVignetteActive ? (
          <RayMmdVignettePass key="ray-mmd-vignette" settings={rayVignette} />
        ) : null}

        {showBuiltInVignette && (
          <Vignette eskil={false} offset={0.2} darkness={vignetteOpacity} />
        )}

        {tuning.smaa && <SMAA />}
      </PostFxDeferredComposer>
    </>
  );
}
