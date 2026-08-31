import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, CameraSnapshot, MMDModel, ViewportFormat } from '../types';
import { createShot, makeShotAnchor } from './createShot';
import { getCachedEnvAnalysis } from './envAnalysis';
import { reframeForAspect } from './framing';
import { resolveCharacterYawDeg } from './orientation';
import { getShotCameraPreset } from './presets';
import { resolveCharacterHeight } from './scale';
import { loadShotComposerState, nextShotName, saveShotComposerPersisted } from './storage';
import { interpolateCameraSnapshot } from './transitions';
import type {
  CharacterOrientMode,
  PlacementHit,
  ShotComposerState,
} from './types';

interface UseShotComposerOpts {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  viewportFormat: ViewportFormat;
  onViewportFormatChange: (format: ViewportFormat) => void;
  flyToCamera: (snapshot: CameraSnapshot) => void;
  captureCamera: () => CameraSnapshot | null;
  showToast?: (msg: string, ms?: number) => void;
}

function sameHit(a: PlacementHit | null, b: PlacementHit | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.walkable === b.walkable &&
    a.position[0] === b.position[0] &&
    a.position[1] === b.position[1] &&
    a.position[2] === b.position[2] &&
    a.normal[0] === b.normal[0] &&
    a.normal[1] === b.normal[1] &&
    a.normal[2] === b.normal[2]
  );
}

/** Fields worth writing to localStorage — ghost/mode churn must not trigger writes. */
function persistSignature(s: ShotComposerState): string {
  return JSON.stringify([
    s.aspect,
    s.shotPreset,
    s.cameraPreset,
    s.scaleMode,
    s.customHeight,
    s.orientMode,
    s.framingFocus,
    s.guides,
    s.savedShots,
    s.activeShotId,
    s.transitionEase,
    s.transitionMs,
    s.floorYOverride,
    s.keepUpright,
  ]);
}

export function useShotComposer({
  appState,
  setAppState,
  viewportFormat,
  onViewportFormatChange,
  flyToCamera,
  captureCamera,
  showToast,
}: UseShotComposerOpts) {
  const [shotComposer, setShotComposer] = useState<ShotComposerState>(() =>
    loadShotComposerState()
  );

  const transitionRef = useRef<number | null>(null);
  const liveCamRef = useRef<[number, number, number]>([0, 12, 30]);
  const persistRef = useRef<string>('');

  // Latest values kept in refs so every handler below can stay referentially stable.
  const stateRef = useRef(shotComposer);
  stateRef.current = shotComposer;
  const appRef = useRef(appState);
  appRef.current = appState;
  const bridgeRef = useRef({
    setAppState,
    viewportFormat,
    onViewportFormatChange,
    flyToCamera,
    captureCamera,
    showToast,
  });
  bridgeRef.current = {
    setAppState,
    viewportFormat,
    onViewportFormatChange,
    flyToCamera,
    captureCamera,
    showToast,
  };

  useEffect(() => {
    const sig = persistSignature(shotComposer);
    if (sig === persistRef.current) return;
    persistRef.current = sig;
    saveShotComposerPersisted(shotComposer);
  }, [shotComposer]);

  useEffect(
    () => () => {
      if (transitionRef.current) cancelAnimationFrame(transitionRef.current);
    },
    []
  );

  const patchShotComposer = useCallback((patch: Partial<ShotComposerState>) => {
    setShotComposer((prev) => {
      let changed = false;
      for (const key of Object.keys(patch) as (keyof ShotComposerState)[]) {
        if (patch[key] !== prev[key]) {
          changed = true;
          break;
        }
      }
      return changed ? { ...prev, ...patch } : prev;
    });
  }, []);

  const selectedCharacter = useCallback((): MMDModel | null => {
    const state = appRef.current;
    const chars = state.models.filter(
      (m) => m.assetKind !== 'stage' && m.assetKind !== 'prop'
    );
    return chars.find((m) => m.id === state.selectedObjectId) ?? chars[0] ?? null;
  }, []);

  const setMode = useCallback((mode: ShotComposerState['mode']) => {
    setShotComposer((prev) =>
      prev.mode === mode && prev.ghostHit === null
        ? prev
        : { ...prev, mode, ghostHit: null }
    );
  }, []);

  const onGhostHit = useCallback((hit: PlacementHit | null) => {
    setShotComposer((prev) => (sameHit(prev.ghostHit, hit) ? prev : { ...prev, ghostHit: hit }));
  }, []);

  const runCreateShot = useCallback(
    (characterOverride?: MMDModel) => {
      const sc = stateRef.current;
      const bridge = bridgeRef.current;
      const character = characterOverride ?? selectedCharacter();
      if (!character) {
        bridge.showToast?.('Select a character first', 2000);
        return;
      }

      const live = bridge.captureCamera();
      if (live) liveCamRef.current = live.position;

      const result = createShot({
        character,
        aspect: sc.aspect || bridge.viewportFormat,
        shotPreset: sc.shotPreset,
        cameraPreset: sc.cameraPreset,
        scaleMode: sc.scaleMode,
        customHeight: sc.customHeight,
        orientMode: sc.orientMode,
        framingFocus: sc.framingFocus,
        keepUpright: sc.keepUpright,
        liveCameraPosition: liveCamRef.current,
      });

      if (result.aspect !== bridge.viewportFormat) {
        bridge.onViewportFormatChange(result.aspect);
      }

      bridge.setAppState((prev) => ({
        ...prev,
        selectedObjectId: character.id,
        models: prev.models.map((m) =>
          m.id === character.id
            ? {
                ...m,
                rotationX: result.characterRotation.rotationX,
                rotationY: result.characterRotation.rotationY,
                rotationZ: result.characterRotation.rotationZ,
              }
            : m
        ),
      }));

      bridge.flyToCamera(result.camera);
      setShotComposer((prev) => ({
        ...prev,
        mode: 'idle',
        ghostHit: null,
        lastWarnings: result.warnings,
        aspect: result.aspect,
      }));
      bridge.showToast?.(
        result.warnings.length ? `Shot ready · ${result.warnings[0]!.message}` : 'Shot created',
        2200
      );
    },
    [selectedCharacter]
  );

  const onConfirmPlace = useCallback(
    (hit: PlacementHit) => {
      const sc = stateRef.current;
      const bridge = bridgeRef.current;
      const character = selectedCharacter();

      if (sc.mode === 'place_camera') {
        const look: [number, number, number] = character
          ? [character.positionX, character.positionY + 10, character.positionZ]
          : [hit.position[0], hit.position[1] + 10, hit.position[2]];
        const lift = character
          ? resolveCharacterHeight(sc.scaleMode, sc.customHeight) * 0.55
          : 8;
        const position: [number, number, number] = [
          hit.position[0],
          hit.position[1] + lift,
          hit.position[2],
        ];
        const yaw = (Math.atan2(look[0] - position[0], look[2] - position[2]) * 180) / Math.PI;
        bridge.flyToCamera({ position, rotation: [0, yaw, 0], fov: 40, target: look });
        setMode('idle');
        bridge.showToast?.('Camera placed', 1600);
        return;
      }

      if (!character) {
        bridge.showToast?.('Select a character first', 2000);
        return;
      }

      bridge.setAppState((prev) => ({
        ...prev,
        selectedObjectId: character.id,
        models: prev.models.map((m) =>
          m.id === character.id
            ? {
                ...m,
                positionX: hit.position[0],
                positionY: hit.position[1],
                positionZ: hit.position[2],
              }
            : m
        ),
      }));

      if (sc.mode === 'create_shot') {
        runCreateShot({
          ...character,
          positionX: hit.position[0],
          positionY: hit.position[1],
          positionZ: hit.position[2],
        });
      } else {
        setMode('idle');
        bridge.showToast?.('Character placed', 1600);
      }
    },
    [runCreateShot, selectedCharacter, setMode]
  );

  const onSetAspect = useCallback(
    (aspect: ViewportFormat) => {
      const sc = stateRef.current;
      const bridge = bridgeRef.current;
      bridge.onViewportFormatChange(aspect);
      patchShotComposer({ aspect });

      const character = selectedCharacter();
      if (!character) return;
      const height = resolveCharacterHeight(sc.scaleMode, sc.customHeight);
      bridge.flyToCamera(
        reframeForAspect(
          [character.positionX, character.positionY, character.positionZ],
          height,
          sc.shotPreset,
          aspect
        )
      );
    },
    [patchShotComposer, selectedCharacter]
  );

  const onOrient = useCallback(
    (mode: CharacterOrientMode) => {
      const sc = stateRef.current;
      const bridge = bridgeRef.current;
      patchShotComposer({ orientMode: mode });

      const character = selectedCharacter();
      if (!character) return;
      const live = bridge.captureCamera();
      const rot = resolveCharacterYawDeg(mode, {
        currentYaw: character.rotationY ?? 0,
        cameraPosition: live?.position ?? liveCamRef.current,
        characterFeet: [character.positionX, character.positionY, character.positionZ],
        keepUpright: sc.keepUpright,
      });
      bridge.setAppState((prev) => ({
        ...prev,
        models: prev.models.map((m) =>
          m.id === character.id
            ? {
                ...m,
                rotationX: rot.rotationX,
                rotationY: rot.rotationY,
                rotationZ: rot.rotationZ,
              }
            : m
        ),
      }));
    },
    [patchShotComposer, selectedCharacter]
  );

  const onSaveShot = useCallback(() => {
    const sc = stateRef.current;
    const bridge = bridgeRef.current;
    const character = selectedCharacter();
    if (!character) {
      bridge.showToast?.('Select a character first', 2000);
      return;
    }
    const cam = bridge.captureCamera();
    if (!cam) {
      bridge.showToast?.('Camera not ready', 1600);
      return;
    }
    const anchor = makeShotAnchor(nextShotName(sc.savedShots), sc, character, cam);
    setShotComposer((prev) => ({
      ...prev,
      savedShots: [...prev.savedShots, anchor].slice(-40),
      activeShotId: anchor.id,
    }));
    bridge.showToast?.(`Saved ${anchor.name}`, 1600);
  }, [selectedCharacter]);

  const onApplyShot = useCallback((shotId: string) => {
    const sc = stateRef.current;
    const bridge = bridgeRef.current;
    const shot = sc.savedShots.find((s) => s.id === shotId);
    if (!shot) return;

    const from = bridge.captureCamera();
    if (shot.aspect !== bridge.viewportFormat) bridge.onViewportFormatChange(shot.aspect);

    if (shot.characterId) {
      bridge.setAppState((prev) => ({
        ...prev,
        selectedObjectId: shot.characterId,
        models: prev.models.map((m) =>
          m.id === shot.characterId
            ? {
                ...m,
                positionX: shot.characterPosition[0],
                positionY: shot.characterPosition[1],
                positionZ: shot.characterPosition[2],
                rotationY: shot.characterRotationY,
                worldScale: shot.characterScale,
              }
            : m
        ),
      }));
    }

    setShotComposer((prev) => ({
      ...prev,
      activeShotId: shotId,
      aspect: shot.aspect,
      shotPreset: shot.shotPreset,
      cameraPreset: shot.cameraPreset,
    }));

    if (!from || sc.transitionMs <= 0) {
      bridge.flyToCamera(shot.camera);
      return;
    }

    if (transitionRef.current) cancelAnimationFrame(transitionRef.current);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / sc.transitionMs);
      bridgeRef.current.flyToCamera(
        interpolateCameraSnapshot(from, shot.camera, t, sc.transitionEase)
      );
      transitionRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    transitionRef.current = requestAnimationFrame(tick);
  }, []);

  const onDeleteShot = useCallback((shotId: string) => {
    setShotComposer((prev) => ({
      ...prev,
      savedShots: prev.savedShots.filter((s) => s.id !== shotId),
      activeShotId: prev.activeShotId === shotId ? null : prev.activeShotId,
    }));
  }, []);

  const onEnvAnalyzed = useCallback((stageId: string) => {
    const cached = getCachedEnvAnalysis(stageId);
    if (!cached) return;
    setShotComposer((prev) =>
      prev.envAnalysis?.analyzedAt === cached.analyzedAt &&
      prev.envAnalysis?.stageModelId === cached.stageModelId
        ? prev
        : { ...prev, envAnalysis: cached }
    );
  }, []);

  const onCancelPlace = useCallback(() => setMode('idle'), [setMode]);

  const onCreateShot = useCallback(() => {
    if (!selectedCharacter()) {
      bridgeRef.current.showToast?.('Select a character first', 2000);
      return;
    }
    setMode('create_shot');
    bridgeRef.current.showToast?.(
      'Click where the character should stand — shot will frame automatically',
      2800
    );
  }, [selectedCharacter, setMode]);

  const onPlaceCharacterMode = useCallback(() => {
    setMode(stateRef.current.mode === 'place_character' ? 'idle' : 'place_character');
  }, [setMode]);

  const onPlaceCameraMode = useCallback(() => {
    setMode(stateRef.current.mode === 'place_camera' ? 'idle' : 'place_camera');
  }, [setMode]);

  const onAutoFrame = useCallback(() => {
    const character = selectedCharacter();
    if (!character) {
      bridgeRef.current.showToast?.('Select a character first', 2000);
      return;
    }
    runCreateShot(character);
  }, [runCreateShot, selectedCharacter]);

  const applyCameraPresetQuick = useCallback(
    (presetId: string) => {
      const preset = getShotCameraPreset(presetId as never);
      patchShotComposer({
        cameraPreset: preset.id,
        shotPreset: preset.shotPreset,
        aspect: preset.aspect,
      });
      bridgeRef.current.onViewportFormatChange(preset.aspect);
    },
    [patchShotComposer]
  );

  const characterHeight = resolveCharacterHeight(
    shotComposer.scaleMode,
    shotComposer.customHeight
  );

  return useMemo(
    () => ({
      shotComposer,
      patchShotComposer,
      characterHeight,
      setMode,
      onGhostHit,
      onConfirmPlace,
      onCancelPlace,
      onCreateShot,
      onPlaceCharacterMode,
      onPlaceCameraMode,
      onAutoFrame,
      onSaveShot,
      onApplyShot,
      onDeleteShot,
      onSetAspect,
      onOrient,
      onEnvAnalyzed,
      applyCameraPresetQuick,
    }),
    [
      shotComposer,
      patchShotComposer,
      characterHeight,
      setMode,
      onGhostHit,
      onConfirmPlace,
      onCancelPlace,
      onCreateShot,
      onPlaceCharacterMode,
      onPlaceCameraMode,
      onAutoFrame,
      onSaveShot,
      onApplyShot,
      onDeleteShot,
      onSetAspect,
      onOrient,
      onEnvAnalyzed,
      applyCameraPresetQuick,
    ]
  );
}
