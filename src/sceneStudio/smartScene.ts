/**
 * One-click Smart Scene: resolves mood, weather, FX, aspect and shot framing
 * into a single plan. The plan is data only — callers decide when to apply it.
 */
import type { ViewportFormat } from '../types';
import type { ShotPresetId } from '../shotComposer/types';
import { buildSceneMoodPatch, type SceneStudioSourceState } from './applyPreset';
import { createSceneFxInstance } from './library';
import { getSceneMoodPreset } from './presets';
import type { SceneMoodPresetId, SceneStudioApplyPatch } from './types';

export type SmartSceneCharacterFx = 'aura' | 'magic_circle' | 'trail';

export interface SmartSceneOptions {
  mood: SceneMoodPresetId;
  aspectRatio?: ViewportFormat;
  shotPreset?: ShotPresetId;
  characterFx?: SmartSceneCharacterFx[];
  targetBone?: string | null;
}

export interface SmartSceneContext {
  hasCharacter: boolean;
  hasStage: boolean;
}

export interface SmartScenePlan {
  patch: SceneStudioApplyPatch;
  /** Framing to hand over to Shot Composer, or null when no character exists. */
  shot: { shotPreset: ShotPresetId; aspect: ViewportFormat } | null;
  notes: string[];
}

const CHARACTER_FX_EFFECT: Record<SmartSceneCharacterFx, string> = {
  aura: 'character.aura',
  magic_circle: 'character.magic_circle',
  trail: 'character.hand_trail',
};

export function buildSmartScenePlan(
  options: SmartSceneOptions,
  source: SceneStudioSourceState,
  context: SmartSceneContext
): SmartScenePlan {
  const preset = getSceneMoodPreset(options.mood);
  const patch = buildSceneMoodPatch(options.mood, source);
  const notes: string[] = [];

  const resolvedAspect = options.aspectRatio;
  if (resolvedAspect) patch.viewportFormat = resolvedAspect;

  const requestedFx = context.hasCharacter ? (options.characterFx ?? []) : [];
  if (!context.hasCharacter && (options.characterFx?.length ?? 0) > 0) {
    notes.push('Character FX skipped — no character in the scene');
  }

  if (requestedFx.length) {
    const baseOrder = patch.sceneStudio.fxStack.length;
    patch.sceneStudio = {
      ...patch.sceneStudio,
      fxStack: [
        ...patch.sceneStudio.fxStack,
        ...requestedFx.map((kind, index) =>
          createSceneFxInstance(CHARACTER_FX_EFFECT[kind], {
            order: baseOrder + index,
            intensity: kind === 'aura' ? 0.75 : 1,
            targetBone: kind === 'trail' ? (options.targetBone ?? 'right_hand') : null,
          })
        ),
      ],
    };
  }

  if (!context.hasStage) {
    notes.push('No environment imported — weather uses the default world volume');
  }

  const shotPreset = options.shotPreset ?? 'full_body';
  notes.push(`${preset.name} · ${preset.weather.weather}`);

  return {
    patch,
    shot: context.hasCharacter
      ? { shotPreset, aspect: resolvedAspect ?? '16:9' }
      : null,
    notes,
  };
}
