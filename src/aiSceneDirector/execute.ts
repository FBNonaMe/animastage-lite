/**
 * Execute validated Scene Commands through existing AnimaStage systems.
 * No arbitrary JS — only allowlisted patches and shot intents.
 */
import type { AppState, MMDModel, ViewportFormat } from '../types';
import { buildSceneMoodPatch } from '../sceneStudio/applyPreset';
import { createSceneFxInstance } from '../sceneStudio/library';
import { defaultEffectWindow } from '../sceneDirector/effectTimeline';
import {
  applyCinematicLightingPreset,
  type CinematicLightingPresetId,
} from '../sceneStudio/lighting';
import { normalizeSceneComposerLights } from '../sceneComposer';
import { getPhysicsPreset, type PhysicsPresetId } from '../physics/physicsPresets';
import type { ShotPresetId } from '../shotComposer/types';
import type { SceneMoodPresetId } from '../sceneStudio/types';
import type { AiScenePlan, SceneCommand } from './types';

export interface AiDirectorExecuteResult {
  appState: AppState;
  /** Shot Composer intents for the host to run after state apply. */
  shot: {
    shotPreset: ShotPresetId;
    aspect: ViewportFormat;
    autoFrame: boolean;
    placeMode: boolean;
    placement: string;
  } | null;
  animationAssetId: string | null;
  characterId: string | null;
  messages: string[];
}

function placeCharacter(
  models: MMDModel[],
  characterId: string | null,
  placement: string,
  stage: MMDModel | undefined
): MMDModel[] {
  if (!characterId) return models;
  const stageX = stage?.positionX ?? 0;
  const stageY = stage?.positionY ?? 0;
  const stageZ = stage?.positionZ ?? 0;
  const offsetX =
    placement === 'left' ? -4 : placement === 'right' ? 4 : 0;
  const offsetZ =
    placement === 'foreground' || placement === 'near_camera'
      ? 4
      : placement === 'background' || placement === 'far_camera'
        ? -6
        : 0;

  return models.map((m) => {
    if (m.id !== characterId) return m;
    return {
      ...m,
      positionX: stageX + offsetX,
      positionY: stageY,
      positionZ: stageZ + offsetZ,
    };
  });
}

export function executeSceneCommands(
  prev: AppState,
  plan: AiScenePlan,
  commands: SceneCommand[]
): AiDirectorExecuteResult {
  let next: AppState = { ...prev };
  const messages: string[] = [];
  let shot: AiDirectorExecuteResult['shot'] = null;
  let animationAssetId: string | null = null;
  let characterId: string | null = plan.characterId;

  for (const command of commands) {
    switch (command.action) {
      case 'setMood': {
        const moodId = String(command.payload.moodPresetId ?? '') as SceneMoodPresetId;
        if (!moodId) break;
        const patch = buildSceneMoodPatch(moodId, {
          sceneStudio: next.sceneStudio,
          dynamicSky: next.dynamicSky,
          sceneComposer: next.sceneComposer,
          visualFx: next.visualFx,
        });
        next = {
          ...next,
          sceneStudio: patch.sceneStudio,
          dynamicSky: patch.dynamicSky,
          sceneComposer: {
            ...patch.sceneComposer,
            lights: normalizeSceneComposerLights(patch.sceneComposer.lights),
          },
          visualFx: patch.visualFx,
        };
        messages.push(`Mood · ${moodId}`);
        break;
      }
      case 'setEnvironment': {
        const environmentId = String(command.payload.environmentId ?? '');
        if (!environmentId) break;
        next = { ...next, selectedObjectId: environmentId };
        messages.push('Environment selected');
        break;
      }
      case 'setCharacter': {
        characterId = String(command.payload.characterId ?? '') || characterId;
        if (characterId) {
          next = { ...next, selectedObjectId: characterId };
          messages.push('Character selected');
        }
        break;
      }
      case 'placeCharacter': {
        const placement = String(command.payload.placement ?? 'center');
        const id = String(command.payload.characterId ?? characterId ?? '');
        const stage = [...next.models].reverse().find((m) => m.assetKind === 'stage');
        next = {
          ...next,
          models: placeCharacter(next.models, id || null, placement, stage),
          selectedObjectId: id || next.selectedObjectId,
        };
        messages.push(`Placement intent · ${placement}`);
        break;
      }
      case 'setAspect':
      case 'setRenderAspect': {
        // Host applies viewportFormat via callback — stash on shot intent.
        const aspect = String(command.payload.aspectRatio ?? '') as ViewportFormat;
        if (!shot) {
          shot = {
            shotPreset: (plan.shotPreset ?? 'full_body') as ShotPresetId,
            aspect: aspect || '16:9',
            autoFrame: false,
            placeMode: false,
            placement: plan.placement,
          };
        } else {
          shot.aspect = aspect || shot.aspect;
        }
        messages.push(`Aspect · ${aspect}`);
        break;
      }
      case 'createShot': {
        const shotPreset = String(command.payload.shotPreset ?? 'full_body') as ShotPresetId;
        const aspect = String(command.payload.aspectRatio ?? plan.aspectRatio ?? '16:9') as ViewportFormat;
        shot = {
          shotPreset,
          aspect,
          autoFrame: true,
          placeMode: plan.placement !== 'keep',
          placement: plan.placement,
        };
        messages.push(`Shot · ${shotPreset}`);
        break;
      }
      case 'setWeather': {
        const timeHours =
          typeof command.payload.timeHours === 'number' ? command.payload.timeHours : null;
        const weather = command.payload.weather != null ? String(command.payload.weather) : null;
        const fog = command.payload.fog != null ? String(command.payload.fog) : null;
        const sky = { ...(next.dynamicSky ?? {}) };
        if (timeHours != null) {
          sky.timeHours = timeHours;
          sky.presetId = null;
          sky.enabled = true;
        }
        if (weather) {
          sky.weather = weather as typeof sky.weather;
          sky.enabled = true;
        }
        const composer = { ...next.sceneComposer };
        if (fog === 'light' || fog === 'medium' || fog === 'heavy') {
          composer.fogEnabled = true;
          composer.fogDensity = fog === 'heavy' ? 0.55 : fog === 'medium' ? 0.35 : 0.18;
        } else if (fog === 'none') {
          composer.fogEnabled = false;
        }
        next = {
          ...next,
          dynamicSky: sky as AppState['dynamicSky'],
          sceneComposer: composer,
          sceneStudio: next.sceneStudio
            ? {
                ...next.sceneStudio,
                weather: {
                  ...next.sceneStudio.weather,
                  weather: (weather as typeof next.sceneStudio.weather.weather) ?? next.sceneStudio.weather.weather,
                  intensity:
                    weather === 'storm' || weather === 'rain'
                      ? Math.max(next.sceneStudio.weather.intensity, 0.8)
                      : next.sceneStudio.weather.intensity,
                },
              }
            : next.sceneStudio,
        };
        messages.push('Weather / time updated');
        break;
      }
      case 'setLighting': {
        const lightingPresetId = String(
          command.payload.lightingPresetId ?? ''
        ) as CinematicLightingPresetId;
        if (!lightingPresetId) break;
        next = {
          ...next,
          sceneComposer: {
            ...next.sceneComposer,
            lights: applyCinematicLightingPreset(
              normalizeSceneComposerLights(next.sceneComposer.lights),
              lightingPresetId
            ),
          },
          sceneStudio: next.sceneStudio
            ? { ...next.sceneStudio, autoCharacterLights: true }
            : next.sceneStudio,
        };
        messages.push(`Lighting · ${lightingPresetId}`);
        break;
      }
      case 'setFx': {
        const fxIds = Array.isArray(command.payload.fxIds)
          ? command.payload.fxIds.map(String)
          : [];
        if (!fxIds.length || !next.sceneStudio) break;
        const existing = next.sceneStudio.fxStack.filter((fx) => !fxIds.includes(fx.effectId));
        const added = fxIds.map((effectId, order) =>
          createSceneFxInstance(
            effectId,
            {
              order: existing.length + order,
              window: defaultEffectWindow(next.maxFrames),
            },
            next.maxFrames
          )
        );
        next = {
          ...next,
          sceneStudio: {
            ...next.sceneStudio,
            fxStack: [...existing, ...added],
          },
        };
        messages.push(`FX · ${fxIds.join(', ')}`);
        break;
      }
      case 'addEffect': {
        const effectId = String(command.payload.effectId ?? '');
        if (!effectId || !next.sceneStudio) break;
        const window = defaultEffectWindow(next.maxFrames);
        if (typeof command.payload.startFrame === 'number') {
          window.startFrame = Math.max(0, Math.floor(command.payload.startFrame));
        }
        if (typeof command.payload.endFrame === 'number') {
          window.endFrame = Math.max(window.startFrame + 1, Math.floor(command.payload.endFrame));
        }
        if (typeof command.payload.blendIn === 'number') {
          window.blendIn = Math.max(0, Math.floor(command.payload.blendIn));
        }
        if (typeof command.payload.blendOut === 'number') {
          window.blendOut = Math.max(0, Math.floor(command.payload.blendOut));
        }
        const instance = createSceneFxInstance(
          effectId,
          {
            order: next.sceneStudio.fxStack.length,
            window,
            targetModelId: characterId ?? next.selectedObjectId,
            intensity:
              typeof command.payload.intensity === 'number'
                ? Number(command.payload.intensity)
                : undefined,
          },
          next.maxFrames
        );
        next = {
          ...next,
          sceneStudio: {
            ...next.sceneStudio,
            fxStack: [...next.sceneStudio.fxStack, instance],
          },
          sceneDirector: next.sceneDirector
            ? {
                ...next.sceneDirector,
                selectedEffectInstanceId: instance.id,
              }
            : next.sceneDirector,
        };
        messages.push(`Added effect · ${effectId} (${window.startFrame}–${window.endFrame})`);
        break;
      }
      case 'removeEffect': {
        const effectId = String(command.payload.effectId ?? '');
        const instanceId = String(command.payload.instanceId ?? '');
        if (!next.sceneStudio) break;
        const before = next.sceneStudio.fxStack.length;
        const removedIds = new Set<string>();
        next = {
          ...next,
          sceneStudio: {
            ...next.sceneStudio,
            fxStack: next.sceneStudio.fxStack.filter((fx) => {
              if (instanceId) {
                if (fx.id === instanceId) removedIds.add(fx.id);
                return fx.id !== instanceId;
              }
              if (effectId) {
                if (fx.effectId === effectId) removedIds.add(fx.id);
                return fx.effectId !== effectId;
              }
              return true;
            }),
          },
        };
        if (next.sceneStudio.fxStack.length < before) {
          const clearedSelection =
            next.sceneDirector?.selectedEffectInstanceId &&
            removedIds.has(next.sceneDirector.selectedEffectInstanceId);
          if (clearedSelection && next.sceneDirector) {
            next = {
              ...next,
              sceneDirector: {
                ...next.sceneDirector,
                selectedEffectInstanceId: null,
              },
            };
          }
          messages.push(`Removed effect · ${instanceId || effectId}`);
        }
        break;
      }
      case 'setPhysicsPreset': {
        const physicsPresetId = String(command.payload.physicsPresetId ?? '') as PhysicsPresetId;
        if (!physicsPresetId) break;
        const preset = getPhysicsPreset(physicsPresetId);
        next = {
          ...next,
          physicsMode: preset.physicsMode,
          mmdLite: {
            ...next.mmdLite,
            ...preset.mmdLite,
            physicsPresetId: preset.id,
            physicsWarmup: preset.physicsWarmup,
          },
        };
        messages.push(`Physics preset · ${preset.label}`);
        break;
      }
      case 'setMaterialStyle': {
        const materialStyle = String(command.payload.materialStyle ?? '');
        if (!materialStyle || !next.sceneStudio) break;
        next = {
          ...next,
          sceneStudio: {
            ...next.sceneStudio,
            materialStyle: materialStyle as typeof next.sceneStudio.materialStyle,
          },
        };
        messages.push(`Material style · ${materialStyle}`);
        break;
      }
      case 'applyAnimation': {
        animationAssetId = String(command.payload.animationAssetId ?? '') || null;
        characterId = String(command.payload.characterId ?? characterId ?? '') || characterId;
        if (animationAssetId) messages.push('Animation queued');
        break;
      }
      case 'setCameraMovement': {
        messages.push(`Camera movement · ${String(command.payload.movement ?? 'none')}`);
        break;
      }
      default:
        break;
    }
  }

  return {
    appState: next,
    shot,
    animationAssetId,
    characterId,
    messages,
  };
}
