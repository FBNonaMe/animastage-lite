import { createEmptyKeyframes } from '../components/TimelineLogic';
import type { BoneState, MMDModel, MorphState } from '../types';
import type { InstantDemoScene } from './types';

const DEFAULT_BONES: BoneState[] = [
  { id: 'head', name: 'Head Rig', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'neck', name: 'Neck Rig', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'spine', name: 'Upper Body', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'waist', name: 'Hips / Waist', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'arm_L', name: 'Left Shoulder', rotationX: 0, rotationY: 0, rotationZ: 0 },
  { id: 'arm_R', name: 'Right Shoulder', rotationX: 0, rotationY: 0, rotationZ: 0 },
];

const DEFAULT_MORPHS: MorphState = {
  eyes: 0,
  mouth: 0.1,
  brow: 0,
};

const PRESET_NAMES: Record<InstantDemoScene['modelPreset'], string> = {
  miku: 'Hatsune Miku (Demo)',
  kizuna: 'Kizuna AI (Demo)',
};

export function buildInstantDemoModel(demo: InstantDemoScene, modelId: string): MMDModel {
  return {
    id: modelId,
    name: PRESET_NAMES[demo.modelPreset],
    type: demo.modelPreset,
    visible: true,
    morphs: { ...DEFAULT_MORPHS },
    bones: JSON.parse(JSON.stringify(DEFAULT_BONES)) as BoneState[],
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    keyframes: createEmptyKeyframes(),
    vmdPlaybackEnabled: false,
    hasVmdAnimation: false,
    activeTemplateId: null,
  };
}
