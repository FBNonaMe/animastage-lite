import { useCallback, useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import {
  detectSceneFxCapabilities,
  sceneFxCountForBackend,
  resolveRuntimeEffectId,
  type SceneFxBackend,
  type SceneFxInstance,
  type SceneStudioState,
} from '../../sceneStudio';
import { evaluateEffectIntensity, isEffectActiveAtFrame } from '../../sceneDirector/effectTimeline';
import { weatherKindFromEffectId } from '../../sceneStudio/runtime/weatherFx';
import WeatherFxLayer from './WeatherFxLayer';
import CharacterFxLayer, { type CharacterFxKind } from './CharacterFxLayer';
import SceneFxErrorBoundary from './SceneFxErrorBoundary';

interface SceneFxRuntimeLayerProps {
  sceneStudio: SceneStudioState;
  currentFrame?: number;
  maxFrames?: number;
  mobile?: boolean;
  /** Prefer WebGPU when reze-engine flag is on. */
  forceWebGpu?: boolean;
  /** Scene scale hint (MMD stages are ~20 units per character). */
  worldScale?: number;
  characterPosition?: [number, number, number] | null;
  /** Visual Quality 2.0 particle budget scale. */
  particleScale?: number;
  /** Snow/Rain depth layers. */
  depthLayers?: 1 | 2 | 3;
  onEffectRuntimeError?: (instanceId: string, message: string) => void;
}

function characterKind(effectId: string): CharacterFxKind | null {
  const resolved = resolveRuntimeEffectId(effectId);
  if (resolved.includes('aura') || resolved.includes('charge')) return 'aura';
  if (resolved.includes('magic_circle') || resolved.includes('hex')) return 'magic_circle';
  if (resolved.includes('trail') || resolved.includes('spectral')) return 'trail';
  return null;
}

function effectColor(fx: SceneFxInstance): string | undefined {
  const raw = fx.parameters?.color?.value;
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * Scene FX 2.0 runtime. World-space GPU particles depth-test against the scene,
 * so foreground weather is occluded by the character instead of being an overlay.
 * WebGPU only raises the particle budget today; WebGL stays the safe fallback.
 */
export default function SceneFxRuntimeLayer({
  sceneStudio,
  currentFrame = 0,
  maxFrames = 120,
  mobile = false,
  worldScale = 1,
  characterPosition = null,
  particleScale = 1,
  depthLayers = 1,
  onEffectRuntimeError,
  forceWebGpu = false,
}: SceneFxRuntimeLayerProps) {
  const { scene } = useThree();
  const [backend, setBackend] = useState<SceneFxBackend>('webgl');
  const backendPreference = forceWebGpu ? 'webgpu' : sceneStudio.backendPreference;

  useEffect(() => {
    let cancelled = false;
    void detectSceneFxCapabilities(backendPreference).then((caps) => {
      if (!cancelled) setBackend(caps.backend);
    });
    return () => {
      cancelled = true;
    };
  }, [backendPreference]);

  useEffect(() => {
    scene.userData.__sceneFxBackend = backend;
  }, [scene, backend]);

  const reportError = useCallback(
    (instanceId: string, message: string) => {
      onEffectRuntimeError?.(instanceId, message);
    },
    [onEffectRuntimeError]
  );

  const active = useMemo(
    () =>
      sceneStudio.fxStack.filter(
        (fx) => isEffectActiveAtFrame(fx, currentFrame, maxFrames)
      ),
    [sceneStudio.fxStack, currentFrame, maxFrames]
  );

  const weatherLayers = useMemo(
    () =>
      active
        .map((fx) => ({
          fx,
          kind: weatherKindFromEffectId(resolveRuntimeEffectId(fx.effectId)),
        }))
        .filter((entry): entry is { fx: SceneFxInstance; kind: NonNullable<typeof entry.kind> } =>
          Boolean(entry.kind)
        ),
    [active]
  );

  const characterLayers = useMemo(
    () =>
      active
        .map((fx) => ({ fx, kind: characterKind(fx.effectId) }))
        .filter((entry): entry is { fx: SceneFxInstance; kind: CharacterFxKind } =>
          Boolean(entry.kind)
        ),
    [active]
  );

  const budget = useMemo(
    () =>
      Math.max(
        64,
        Math.floor(
          sceneFxCountForBackend(
            sceneStudio.particles.requestedCount,
            backend,
            mobile
          ) * Math.max(0.2, particleScale)
        )
      ),
    [sceneStudio.particles.requestedCount, backend, mobile, particleScale]
  );

  if (!weatherLayers.length && !characterLayers.length) return null;

  const perLayerCount = Math.max(
    256,
    Math.floor(budget / Math.max(1, weatherLayers.length))
  );
  const controls = sceneStudio.weather;

  return (
    <group name="SceneFxRuntime">
      {weatherLayers.map(({ fx, kind }) => {
        const intensity =
          evaluateEffectIntensity(fx, currentFrame, maxFrames) *
          Math.max(0.15, controls.intensity || 1);
        return (
          <SceneFxErrorBoundary
            key={fx.id}
            effectId={fx.id}
            onError={reportError}
          >
            <WeatherFxLayer
              kind={kind}
              count={Math.round(
                perLayerCount * (0.5 + 0.5 * Math.max(0.1, controls.density || 1))
              )}
              intensity={intensity}
              speed={controls.speed || 1}
              directionDeg={controls.directionDeg || 0}
              turbulence={controls.turbulence || 0}
              worldScale={worldScale}
              depthLayers={kind === 'snow' || kind === 'rain' || kind === 'mist' ? depthLayers : 1}
            />
          </SceneFxErrorBoundary>
        );
      })}
      {characterLayers.map(({ fx, kind }) => (
        <SceneFxErrorBoundary key={fx.id} effectId={fx.id} onError={reportError}>
          <CharacterFxLayer
            kind={kind}
            intensity={evaluateEffectIntensity(fx, currentFrame, maxFrames)}
            color={effectColor(fx)}
            boneId={fx.targetBone ?? 'right_hand'}
            nearPosition={characterPosition}
          />
        </SceneFxErrorBoundary>
      ))}
    </group>
  );
}
