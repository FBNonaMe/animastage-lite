import type { CameraKeyframe, CameraSnapshot, TimelineKeyframe, VisualFxSettings } from '../types';
import { DEFAULT_VISUAL_FX as BASE_VISUAL_FX } from '../visualFx/visualFxPresets';
import { getStageTargetTuple } from '../scene/cameraFraming';

export type AnimationTemplateCategory = 'camera' | 'character' | 'combo' | 'emote' | 'dance';

export interface TemplateVisualFx {
  bloom?: boolean;
  bloomIntensity?: number;
  bloomThreshold?: number;
}

export interface AnimationTemplate {
  id: string;
  name: string;
  description: string;
  category: AnimationTemplateCategory;
  generateCameraKeyframes?: (maxFrames: number) => CameraKeyframe[];
  generateModelKeyframes?: (maxFrames: number) => TimelineKeyframe[];
  visualFx?: TemplateVisualFx;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

let templateIdSeq = 0;

function createCameraTplId(frame: number): string {
  templateIdSeq += 1;
  return `cam_tpl_${frame}_${templateIdSeq}`;
}

function createModelTplId(frame: number, track: string): string {
  templateIdSeq += 1;
  return `mdl_tpl_${track}_${frame}_${templateIdSeq}`;
}

/** Spherical orbit around stage target — matches MMD default character height. */
export function orbitCameraSnapshot(
  distance: number,
  yawDeg: number,
  pitchDeg: number,
  fov: number,
  target?: [number, number, number]
): CameraSnapshot {
  const yaw = yawDeg * DEG2RAD;
  const pitch = Math.max(pitchDeg, -12) * DEG2RAD;
  const [cx, cy, cz] = target ?? getStageTargetTuple();

  const position: [number, number, number] = [
    cx + distance * Math.cos(pitch) * Math.sin(yaw),
    cy + distance * Math.sin(pitch),
    cz + distance * Math.cos(pitch) * Math.cos(yaw),
  ];

  const dx = cx - position[0];
  const dy = cy - position[1];
  const dz = cz - position[2];
  const rotationY = Math.atan2(dx, dz) * RAD2DEG;
  const distXZ = Math.sqrt(dx * dx + dz * dz);
  const rotationX = -Math.atan2(dy, distXZ) * RAD2DEG;

  return {
    position,
    rotation: [rotationX, rotationY, 0],
    fov,
    target: [cx, cy, cz],
  };
}

function cameraKeyframe(frame: number, snap: CameraSnapshot): CameraKeyframe {
  return {
    id: createCameraTplId(frame),
    frame,
    position: [...snap.position],
    rotation: [...snap.rotation],
    fov: snap.fov,
    target: [...snap.target],
  };
}

function cameraPath(
  maxFrames: number,
  samples: Array<{ t: number; distance: number; yaw: number; pitch: number; fov: number }>,
  stageTarget?: [number, number, number]
): CameraKeyframe[] {
  const target = stageTarget ?? getStageTargetTuple();
  return samples
    .map(({ t, distance, yaw, pitch, fov }) => {
      const frame = Math.round(t * maxFrames);
      return cameraKeyframe(frame, orbitCameraSnapshot(distance, yaw, pitch, fov, target));
    })
    .sort((a, b) => a.frame - b.frame);
}

function modelKeys(
  entries: Array<{ frame: number; track: TimelineKeyframe['track']; value: number }>
): TimelineKeyframe[] {
  return entries
    .map(({ frame, track, value }) => ({
      id: createModelTplId(frame, track),
      frame,
      track,
      value,
    }))
    .sort((a, b) => a.frame - b.frame || a.track.localeCompare(b.track));
}

function neutralPoseFrame0(): TimelineKeyframe[] {
  return modelKeys([
    { frame: 0, track: 'bone_head_y', value: 0 },
    { frame: 0, track: 'bone_neck_x', value: 0 },
    { frame: 0, track: 'bone_spine_y', value: 0 },
    { frame: 0, track: 'bone_spine_z', value: 0 },
    { frame: 0, track: 'bone_waist_y', value: 0 },
    { frame: 0, track: 'bone_l_arm_x', value: 0 },
    { frame: 0, track: 'bone_l_arm_z', value: 0 },
    { frame: 0, track: 'bone_r_arm_x', value: 0 },
    { frame: 0, track: 'bone_r_arm_z', value: 0 },
    { frame: 0, track: 'morph_mouth', value: 0.1 },
    { frame: 0, track: 'morph_eyes', value: 0 },
    { frame: 0, track: 'morph_brow', value: 0 },
  ]);
}

/** Torso + hips sway — no direct leg rotation (breaks MMD IK). */
function bodyDanceBeat(
  frame: number,
  phaseRad: number,
  intensity = 1
): TimelineKeyframe[] {
  const s = Math.sin(phaseRad);
  const c = Math.cos(phaseRad);
  return modelKeys([
    { frame, track: 'bone_waist_y', value: s * 14 * intensity },
    { frame, track: 'bone_spine_y', value: c * 10 * intensity },
    { frame, track: 'bone_spine_z', value: s * 6 * intensity },
    { frame, track: 'bone_neck_x', value: -s * 5 * intensity },
  ]);
}

function mergeWithNeutralStart(keys: TimelineKeyframe[]): TimelineKeyframe[] {
  const animated = keys.filter((k) => k.frame > 0);
  return [...neutralPoseFrame0(), ...animated].sort(
    (a, b) => a.frame - b.frame || a.track.localeCompare(b.track)
  );
}

function generateWaveModelKeyframes(maxFrames: number): TimelineKeyframe[] {
  const waveFrames = [30, 60, 90, 120].filter((f) => f <= maxFrames);
  const keys: TimelineKeyframe[] = [];

  waveFrames.forEach((frame, index) => {
    const wave = Math.sin((frame / Math.max(maxFrames, 1)) * Math.PI * 2);
    keys.push(
      ...modelKeys([
        { frame, track: 'morph_eyes', value: index % 2 === 0 ? 0 : 0.85 },
        { frame, track: 'bone_head_y', value: wave * 20 },
        { frame, track: 'bone_spine_y', value: wave * 10 },
        { frame, track: 'bone_waist_y', value: wave * 14 },
        { frame, track: 'bone_l_arm_x', value: 15 + wave * 10 },
        { frame, track: 'bone_l_arm_z', value: wave * 40 },
        { frame, track: 'bone_r_arm_z', value: -wave * 35 },
      ])
    );
  });

  return mergeWithNeutralStart(keys);
}

function generateNodKeyframes(maxFrames: number): TimelineKeyframe[] {
  const ticks = [0, 12, 24, 36, 48, 60, 72].filter((f) => f <= maxFrames);
  return modelKeys(
    ticks.flatMap((frame, i) => [
      { frame, track: 'bone_head_y' as const, value: i % 2 === 0 ? 0 : 18 },
    ])
  );
}

function generateLookAroundKeyframes(maxFrames: number): TimelineKeyframe[] {
  const ticks = [0, 30, 60, 90, 120].filter((f) => f <= maxFrames);
  const values = [-35, 35, -25, 30, 0];
  return modelKeys(
    ticks.map((frame, i) => ({
      frame,
      track: 'bone_head_y' as const,
      value: values[i] ?? 0,
    }))
  );
}

function generateBlinkKeyframes(maxFrames: number): TimelineKeyframe[] {
  const ticks = [0, 8, 16, 40, 48, 56, 90, 98, 106].filter((f) => f <= maxFrames);
  return modelKeys(
    ticks.map((frame, i) => ({
      frame,
      track: 'morph_eyes' as const,
      value: i % 2 === 0 ? 0 : 1,
    }))
  );
}

function generateSurprisedKeyframes(maxFrames: number): TimelineKeyframe[] {
  return modelKeys(
    (
      [
        { frame: 0, track: 'morph_eyes', value: 0 },
        { frame: 0, track: 'morph_mouth', value: 0.1 },
        { frame: 0, track: 'morph_brow', value: 0 },
        { frame: 15, track: 'morph_eyes', value: 1 },
        { frame: 15, track: 'morph_mouth', value: 0.75 },
        { frame: 15, track: 'morph_brow', value: 0.8 },
        { frame: 60, track: 'morph_eyes', value: 1 },
        { frame: 60, track: 'morph_mouth', value: 0.75 },
        { frame: 60, track: 'morph_brow', value: 0.8 },
        { frame: maxFrames, track: 'morph_eyes', value: 0 },
        { frame: maxFrames, track: 'morph_mouth', value: 0.1 },
        { frame: maxFrames, track: 'morph_brow', value: 0 },
      ] as Array<{ frame: number; track: TimelineKeyframe['track']; value: number }>
    ).filter((e) => e.frame <= maxFrames)
  );
}

function generateGreetingKeyframes(maxFrames: number): TimelineKeyframe[] {
  const keys = generateNodKeyframes(maxFrames);
  const mid = Math.min(45, maxFrames);
  return [
    ...keys,
    ...modelKeys([
      { frame: 0, track: 'bone_l_arm_z', value: 0 },
      { frame: mid, track: 'bone_l_arm_z', value: 40 },
      { frame: maxFrames, track: 'bone_l_arm_z', value: 0 },
      { frame: 0, track: 'morph_mouth', value: 0.2 },
      { frame: mid, track: 'morph_mouth', value: 0.55 },
      { frame: maxFrames, track: 'morph_mouth', value: 0.2 },
    ]),
  ];
}

/** Reference length for motion templates at 30 FPS (~50s product rolls). */
export const MOTION_TEMPLATE_TIMELINE_FRAMES = 1500;

/** Beat interval at ~100 BPM on 30 fps — fewer keys, smoother eval. */
const EMOTE_BEAT = 20;

function generateGrooveEmoteKeyframes(maxFrames: number): TimelineKeyframe[] {
  const keys: TimelineKeyframe[] = [];
  for (let frame = EMOTE_BEAT; frame <= maxFrames; frame += EMOTE_BEAT) {
    const phase = Math.floor(frame / EMOTE_BEAT) % 4;
    const armL = phase === 0 ? 42 : phase === 2 ? -18 : 8;
    const armR = phase === 1 ? -42 : phase === 3 ? 18 : -8;
    const head = phase % 2 === 0 ? -14 : 14;
    const phaseRad = (frame / EMOTE_BEAT) * Math.PI * 0.5;
    keys.push(
      ...bodyDanceBeat(frame, phaseRad, 0.85),
      ...modelKeys([
        { frame, track: 'bone_l_arm_x', value: phase === 0 ? 28 : phase === 2 ? 12 : 18 },
        { frame, track: 'bone_r_arm_x', value: phase === 1 ? -28 : phase === 3 ? -12 : -18 },
        { frame, track: 'bone_l_arm_z', value: armL },
        { frame, track: 'bone_r_arm_z', value: armR },
        { frame, track: 'bone_head_y', value: head },
        { frame, track: 'morph_mouth', value: phase === 0 ? 0.5 : 0.12 },
        { frame, track: 'morph_eyes', value: 0 },
      ])
    );
  }
  return mergeWithNeutralStart(keys);
}

function generateSideSwingEmoteKeyframes(maxFrames: number): TimelineKeyframe[] {
  const keys: TimelineKeyframe[] = [];
  const swingBeat = 8;
  for (let frame = swingBeat; frame <= maxFrames; frame += swingBeat) {
    const phase = Math.floor(frame / swingBeat) % 2;
    const phaseRad = (frame / swingBeat) * Math.PI;
    keys.push(
      ...bodyDanceBeat(frame, phaseRad, 1.1),
      ...modelKeys([
        { frame, track: 'bone_l_arm_x', value: phase === 0 ? 35 : -20 },
        { frame, track: 'bone_r_arm_x', value: phase === 0 ? -35 : 20 },
        { frame, track: 'bone_l_arm_z', value: phase === 0 ? 55 : -35 },
        { frame, track: 'bone_r_arm_z', value: phase === 0 ? -55 : 35 },
        { frame, track: 'bone_head_y', value: phase === 0 ? 8 : -8 },
        { frame, track: 'morph_mouth', value: 0.25 },
      ])
    );
  }
  return mergeWithNeutralStart(keys);
}

function generateVictoryFlexKeyframes(maxFrames: number): TimelineKeyframe[] {
  const keys: TimelineKeyframe[] = [];
  for (let frame = 20; frame <= maxFrames; frame += 20) {
    const i = Math.floor(frame / 20);
    const up = i % 2 === 0;
    const s = Math.sin((frame / 20) * Math.PI);
    keys.push(
      ...modelKeys([
        { frame, track: 'bone_waist_y', value: s * 14 },
        { frame, track: 'bone_spine_y', value: up ? 10 : -5 },
        { frame, track: 'bone_spine_z', value: up ? -8 : 5 },
        { frame, track: 'bone_neck_x', value: up ? -6 : 4 },
        { frame, track: 'bone_l_arm_x', value: up ? 45 : 15 },
        { frame, track: 'bone_r_arm_x', value: up ? -45 : -15 },
        { frame, track: 'bone_l_arm_z', value: up ? 55 : 18 },
        { frame, track: 'bone_r_arm_z', value: up ? -55 : -18 },
        { frame, track: 'bone_head_y', value: up ? 0 : 10 },
        { frame, track: 'morph_mouth', value: up ? 0.6 : 0.3 },
        { frame, track: 'morph_brow', value: up ? 0.3 : 0 },
        { frame, track: 'morph_eyes', value: 0 },
      ])
    );
  }
  return mergeWithNeutralStart(keys);
}

function generateHypeBounceKeyframes(maxFrames: number): TimelineKeyframe[] {
  const keys: TimelineKeyframe[] = [];
  for (let frame = EMOTE_BEAT; frame <= maxFrames; frame += EMOTE_BEAT) {
    const bounce = Math.sin((frame / Math.max(maxFrames, 1)) * Math.PI * 4);
    const phaseRad = (frame / EMOTE_BEAT) * Math.PI * 0.5;
    keys.push(
      ...bodyDanceBeat(frame, phaseRad, 1.2),
      ...modelKeys([
        { frame, track: 'bone_head_y', value: bounce * 22 },
        { frame, track: 'bone_l_arm_x', value: 20 + bounce * 18 },
        { frame, track: 'bone_r_arm_x', value: -20 - bounce * 18 },
        { frame, track: 'bone_l_arm_z', value: bounce * 25 },
        { frame, track: 'bone_r_arm_z', value: -bounce * 25 },
        { frame, track: 'morph_mouth', value: 0.35 + Math.abs(bounce) * 0.35 },
        { frame, track: 'morph_eyes', value: frame % (EMOTE_BEAT * 2) === 0 ? 0.7 : 0 },
      ])
    );
  }
  return mergeWithNeutralStart(keys);
}

function generateCornerPoseKeyframes(maxFrames: number): TimelineKeyframe[] {
  return modelKeys(
    (
      [
        { frame: 0, track: 'bone_l_arm_z', value: 0 },
        { frame: 0, track: 'bone_r_arm_z', value: 0 },
        { frame: 0, track: 'bone_waist_y', value: 0 },
        { frame: 15, track: 'bone_l_arm_x', value: 30 },
        { frame: 15, track: 'bone_l_arm_z', value: 70 },
        { frame: 15, track: 'bone_r_arm_z', value: -35 },
        { frame: 15, track: 'bone_waist_y', value: 18 },
        { frame: 15, track: 'bone_spine_y', value: -12 },
        { frame: 15, track: 'bone_spine_z', value: 8 },
        { frame: 15, track: 'morph_mouth', value: 0.4 },
        { frame: 60, track: 'bone_l_arm_x', value: 30 },
        { frame: 60, track: 'bone_l_arm_z', value: 70 },
        { frame: 60, track: 'bone_r_arm_z', value: -35 },
        { frame: 60, track: 'bone_waist_y', value: 18 },
        { frame: 60, track: 'bone_spine_y', value: -12 },
        { frame: maxFrames, track: 'bone_l_arm_z', value: 0 },
        { frame: maxFrames, track: 'bone_r_arm_z', value: 0 },
        { frame: maxFrames, track: 'bone_waist_y', value: 0 },
      ] as Array<{ frame: number; track: TimelineKeyframe['track']; value: number }>
    ).filter((e) => e.frame <= maxFrames)
  );
}

function generateFullBodyDanceKeyframes(maxFrames: number): TimelineKeyframe[] {
  const keys: TimelineKeyframe[] = [];
  const beat = 15;
  for (let frame = beat; frame <= maxFrames; frame += beat) {
    const t = frame / Math.max(maxFrames, 1);
    const phaseRad = t * Math.PI * 6;
    const s = Math.sin(phaseRad);
    const c = Math.cos(phaseRad);
    const step = Math.floor(frame / beat) % 4;
    keys.push(
      ...modelKeys([
        { frame, track: 'bone_waist_y', value: s * 16 },
        { frame, track: 'bone_spine_y', value: c * 12 },
        { frame, track: 'bone_spine_z', value: s * 8 },
        { frame, track: 'bone_neck_x', value: -s * 8 },
        { frame, track: 'bone_head_y', value: c * 12 },
        { frame, track: 'bone_l_arm_x', value: step === 0 ? 32 : step === 2 ? 12 : 18 + s * 8 },
        { frame, track: 'bone_r_arm_x', value: step === 1 ? -32 : step === 3 ? -12 : -18 - s * 8 },
        { frame, track: 'bone_l_arm_z', value: s * 32 },
        { frame, track: 'bone_r_arm_z', value: -s * 32 },
        { frame, track: 'morph_mouth', value: 0.2 + Math.abs(s) * 0.35 },
        { frame, track: 'morph_eyes', value: frame % (beat * 3) === 0 ? 0.5 : 0 },
      ])
    );
  }
  return mergeWithNeutralStart(keys);
}

function generateFlythroughCamera(
  maxFrames: number,
  profile: 'rollercoaster' | 'skydive' | 'drone' | 'epic' | 'concert'
): CameraKeyframe[] {
  const steps = profile === 'concert' ? 10 : 8;
  const keys: CameraKeyframe[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const frame = Math.round(t * maxFrames);
    let distance = 26;
    let yaw = 0;
    let pitch = 10;
    let fov = 45;

    switch (profile) {
      case 'rollercoaster':
        yaw = -120 + t * 720;
        pitch = -25 + Math.sin(t * Math.PI * 4) * 40;
        distance = 18 + Math.cos(t * Math.PI * 3) * 16;
        fov = 42 + Math.sin(t * Math.PI * 2) * 18;
        break;
      case 'skydive':
        yaw = 30 + t * 200;
        pitch = 55 - t * 65;
        distance = 50 - t * 32;
        fov = 52 - t * 14;
        break;
      case 'drone':
        yaw = t * 450;
        pitch = 5 + Math.sin(t * Math.PI * 5) * 22;
        distance = 20 + Math.sin(t * Math.PI * 2) * 12;
        fov = 48;
        break;
      case 'epic':
        yaw = -60 + t * 280;
        pitch = -20 + t * 45;
        distance = 40 - t * 22;
        fov = 50 - t * 12;
        break;
      case 'concert':
        yaw = t * 360 * 1.5;
        pitch = 8 + Math.sin(t * Math.PI * 6) * 28;
        distance = 24 + Math.cos(t * Math.PI * 4) * 10;
        fov = 40 + Math.sin(t * Math.PI * 3) * 12;
        break;
    }

    keys.push(cameraKeyframe(frame, orbitCameraSnapshot(distance, yaw, pitch, fov)));
  }

  return keys;
}

const BLOOM_MILD: TemplateVisualFx = { bloom: true, bloomIntensity: 0.35, bloomThreshold: 0.58 };
const BLOOM_GLOW: TemplateVisualFx = { bloom: true, bloomIntensity: 0.48, bloomThreshold: 0.52 };
const BLOOM_NEON: TemplateVisualFx = { bloom: true, bloomIntensity: 0.58, bloomThreshold: 0.48 };

export const ANIMATION_TEMPLATES: AnimationTemplate[] = [
  {
    id: 'cam_duo_wide',
    name: 'Duo Wide (Static)',
    description: 'Frames both characters — wider FOV and pull-back.',
    category: 'camera',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [{ t: 0, distance: 42, yaw: 0, pitch: 10, fov: 58 }]),
  },
  {
    id: 'cam_duo_orbit',
    name: 'Duo Half Orbit',
    description: 'Slow arc around the center of two dancers.',
    category: 'camera',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [
        { t: 0, distance: 40, yaw: -60, pitch: 12, fov: 56 },
        { t: 0.5, distance: 38, yaw: 0, pitch: 10, fov: 54 },
        { t: 1, distance: 40, yaw: 60, pitch: 12, fov: 56 },
      ]),
  },
  {
    id: 'cam_wide_static',
    name: 'Wide Shot (Static)',
    description: 'Full-body establishing shot, fixed camera.',
    category: 'camera',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [{ t: 0, distance: 34, yaw: 0, pitch: 8, fov: 45 }]),
  },
  {
    id: 'cam_dolly_in',
    name: 'Slow Dolly In',
    description: 'Smooth push toward the character.',
    category: 'camera',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [
        { t: 0, distance: 38, yaw: 0, pitch: 6, fov: 45 },
        { t: 0.5, distance: 24, yaw: 0, pitch: 8, fov: 42 },
        { t: 1, distance: 16, yaw: 0, pitch: 10, fov: 38 },
      ]),
  },
  {
    id: 'cam_orbit_half',
    name: 'Half Orbit (180°)',
    description: 'Camera arcs halfway around the model.',
    category: 'camera',
    generateCameraKeyframes: (max) => {
      const steps = [0, 0.25, 0.5, 0.75, 1];
      return cameraPath(
        max,
        steps.map((t) => ({
          t,
          distance: 28,
          yaw: -90 + t * 180,
          pitch: 10,
          fov: 45,
        }))
      );
    },
  },
  {
    id: 'cam_orbit_full',
    name: 'Full Orbit (360°)',
    description: 'Complete circle around the character.',
    category: 'camera',
    generateCameraKeyframes: (max) => {
      const steps = [0, 0.2, 0.4, 0.6, 0.8, 1];
      return cameraPath(
        max,
        steps.map((t) => ({
          t,
          distance: 30,
          yaw: t * 360,
          pitch: 12,
          fov: 45,
        }))
      );
    },
  },
  {
    id: 'cam_low_hero',
    name: 'Low Hero Angle',
    description: 'Low camera looking up — dramatic portrait.',
    category: 'camera',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [
        { t: 0, distance: 22, yaw: -25, pitch: -8, fov: 40 },
        { t: 1, distance: 18, yaw: -15, pitch: -6, fov: 38 },
      ]),
  },
  {
    id: 'cam_bird_eye',
    name: "Bird's Eye",
    description: 'High angle overview of the stage.',
    category: 'camera',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [
        { t: 0, distance: 36, yaw: 0, pitch: 42, fov: 50 },
        { t: 1, distance: 32, yaw: 20, pitch: 38, fov: 48 },
      ]),
  },
  {
    id: 'cam_side_track',
    name: 'Side Tracking',
    description: 'Lateral slide along the character.',
    category: 'camera',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [
        { t: 0, distance: 26, yaw: -70, pitch: 10, fov: 45 },
        { t: 0.5, distance: 26, yaw: 0, pitch: 10, fov: 45 },
        { t: 1, distance: 26, yaw: 70, pitch: 10, fov: 45 },
      ]),
  },
  {
    id: 'cam_portrait_close',
    name: 'Portrait Close-up',
    description: 'Tight face shot with narrow FOV.',
    category: 'camera',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [
        { t: 0, distance: 20, yaw: 0, pitch: 12, fov: 45 },
        { t: 0.5, distance: 12, yaw: 8, pitch: 14, fov: 32 },
        { t: 1, distance: 10, yaw: -5, pitch: 13, fov: 30 },
      ]),
  },
  {
    id: 'char_idle_blink',
    name: 'Idle Blink',
    description: 'Subtle eye-blink loop for idle poses.',
    category: 'character',
    generateModelKeyframes: generateBlinkKeyframes,
  },
  {
    id: 'char_wave',
    name: 'Wave Arms',
    description: 'Classic wave with head sway.',
    category: 'character',
    generateModelKeyframes: generateWaveModelKeyframes,
  },
  {
    id: 'char_nod',
    name: 'Nod Yes',
    description: 'Repeated head nod.',
    category: 'character',
    generateModelKeyframes: generateNodKeyframes,
  },
  {
    id: 'char_look_around',
    name: 'Look Around',
    description: 'Head turns left and right.',
    category: 'character',
    generateModelKeyframes: generateLookAroundKeyframes,
  },
  {
    id: 'char_surprised',
    name: 'Surprised',
    description: 'Wide eyes, open mouth, raised brows.',
    category: 'character',
    generateModelKeyframes: generateSurprisedKeyframes,
  },
  {
    id: 'char_greeting',
    name: 'Greeting',
    description: 'Nod + raised hand + smile.',
    category: 'character',
    generateModelKeyframes: generateGreetingKeyframes,
  },
  {
    id: 'cam_fly_rollercoaster',
    name: 'Flying — Rollercoaster',
    description: 'Wild looping camera with pitch and FOV swings.',
    category: 'camera',
    visualFx: BLOOM_MILD,
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'rollercoaster'),
  },
  {
    id: 'cam_fly_skydive',
    name: 'Flying — Sky Dive',
    description: 'Starts high above, swoops down toward the character.',
    category: 'camera',
    visualFx: BLOOM_MILD,
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'skydive'),
  },
  {
    id: 'cam_fly_drone',
    name: 'Flying — Drone Orbit',
    description: 'Fast aerial orbit with bobbing height.',
    category: 'camera',
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'drone'),
  },
  {
    id: 'cam_fly_epic',
    name: 'Flying — Epic Sweep',
    description: 'Low-to-high cinematic sweep with bloom glow.',
    category: 'camera',
    visualFx: BLOOM_GLOW,
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'epic'),
  },
  {
    id: 'char_groove_emote',
    name: 'Lobby Groove',
    description: 'Rhythmic arm groove inspired by battle-lobby emotes.',
    category: 'dance',
    generateModelKeyframes: generateGrooveEmoteKeyframes,
  },
  {
    id: 'char_side_swing',
    name: 'Side Swing Emote',
    description: 'Fast alternating arm swing dance pattern.',
    category: 'dance',
    generateModelKeyframes: generateSideSwingEmoteKeyframes,
  },
  {
    id: 'char_victory_flex',
    name: 'Victory Flex',
    description: 'Arms-up celebration bounce.',
    category: 'dance',
    generateModelKeyframes: generateVictoryFlexKeyframes,
  },
  {
    id: 'char_hype_bounce',
    name: 'Hype Bounce',
    description: 'Energetic bounce with smile bursts.',
    category: 'dance',
    generateModelKeyframes: generateHypeBounceKeyframes,
  },
  {
    id: 'char_corner_pose',
    name: 'Corner Pose',
    description: 'Stylized L-shape arm pose hold.',
    category: 'dance',
    generateModelKeyframes: generateCornerPoseKeyframes,
  },
  {
    id: 'char_full_dance',
    name: 'Full Body Dance',
    description: 'Hips, torso and arms — smooth rhythm dance loop.',
    category: 'dance',
    generateModelKeyframes: generateFullBodyDanceKeyframes,
  },
  {
    id: 'combo_showcase',
    name: 'Showcase (Orbit + Wave)',
    description: 'Full orbit camera with arm wave.',
    category: 'combo',
    generateCameraKeyframes: (max) => {
      const steps = [0, 0.25, 0.5, 0.75, 1];
      return cameraPath(
        max,
        steps.map((t) => ({
          t,
          distance: 28,
          yaw: t * 360,
          pitch: 10,
          fov: 45,
        }))
      );
    },
    generateModelKeyframes: generateWaveModelKeyframes,
  },
  {
    id: 'combo_cinematic',
    name: 'Cinematic Intro',
    description: 'Dolly in + surprised reaction.',
    category: 'combo',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [
        { t: 0, distance: 40, yaw: -15, pitch: 5, fov: 48 },
        { t: 0.35, distance: 28, yaw: -5, pitch: 8, fov: 44 },
        { t: 0.7, distance: 18, yaw: 0, pitch: 10, fov: 38 },
        { t: 1, distance: 14, yaw: 5, pitch: 11, fov: 35 },
      ]),
    generateModelKeyframes: generateSurprisedKeyframes,
  },
  {
    id: 'combo_greeting_wide',
    name: 'Greeting Wide',
    description: 'Wide static shot + greeting pose.',
    category: 'combo',
    generateCameraKeyframes: (max) =>
      cameraPath(max, [{ t: 0, distance: 34, yaw: 0, pitch: 8, fov: 45 }]),
    generateModelKeyframes: generateGreetingKeyframes,
  },
  {
    id: 'emote_battle_highlight',
    name: 'Battle Highlight ✦',
    description: 'Flying drone cam + lobby groove + neon bloom.',
    category: 'emote',
    visualFx: BLOOM_NEON,
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'drone'),
    generateModelKeyframes: generateGrooveEmoteKeyframes,
  },
  {
    id: 'emote_victory_royale',
    name: 'Victory Royale ✦',
    description: 'Epic sky sweep + victory flex + strong bloom.',
    category: 'emote',
    visualFx: BLOOM_NEON,
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'epic'),
    generateModelKeyframes: generateVictoryFlexKeyframes,
  },
  {
    id: 'emote_roller_dance',
    name: 'Roller Dance ✦',
    description: 'Rollercoaster camera + side swing emote + glow.',
    category: 'emote',
    visualFx: BLOOM_GLOW,
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'rollercoaster'),
    generateModelKeyframes: generateSideSwingEmoteKeyframes,
  },
  {
    id: 'emote_concert_finale',
    name: 'Concert Finale ✦',
    description: 'Concert fly cam + hype bounce + max bloom.',
    category: 'emote',
    visualFx: BLOOM_NEON,
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'concert'),
    generateModelKeyframes: generateHypeBounceKeyframes,
  },
  {
    id: 'emote_skydive_flex',
    name: 'Sky Flex Drop ✦',
    description: 'Sky dive camera + victory flex — FN-style intro shot.',
    category: 'emote',
    visualFx: BLOOM_GLOW,
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'skydive'),
    generateModelKeyframes: generateVictoryFlexKeyframes,
  },
  {
    id: 'emote_corner_spotlight',
    name: 'Corner Spotlight ✦',
    description: 'Slow orbit + corner pose + cinematic bloom.',
    category: 'emote',
    visualFx: BLOOM_GLOW,
    generateCameraKeyframes: (max) =>
      cameraPath(max, [
        { t: 0, distance: 30, yaw: -80, pitch: 5, fov: 48 },
        { t: 0.5, distance: 22, yaw: 20, pitch: 12, fov: 42 },
        { t: 1, distance: 18, yaw: 60, pitch: 8, fov: 38 },
      ]),
    generateModelKeyframes: generateCornerPoseKeyframes,
  },
  {
    id: 'emote_party_dance',
    name: 'Party Dance ✦',
    description: 'Drone orbit + full body dance + neon bloom.',
    category: 'emote',
    visualFx: BLOOM_NEON,
    generateCameraKeyframes: (max) => generateFlythroughCamera(max, 'drone'),
    generateModelKeyframes: generateFullBodyDanceKeyframes,
  },
];

export function getAnimationTemplate(id: string): AnimationTemplate | undefined {
  return ANIMATION_TEMPLATES.find((t) => t.id === id);
}

export function templateHasCamera(id: string): boolean {
  const t = getAnimationTemplate(id);
  return Boolean(t?.generateCameraKeyframes);
}

export function getTemplatesByCategory(category: AnimationTemplateCategory): AnimationTemplate[] {
  return ANIMATION_TEMPLATES.filter((t) => t.category === category);
}

/** Templates with body / morph keyframes (for motion picker in viewport). */
export const MOTION_TEMPLATE_CATEGORIES: AnimationTemplateCategory[] = [
  'dance',
  'character',
  'combo',
  'emote',
];

export function getMotionAnimationTemplates(): AnimationTemplate[] {
  return ANIMATION_TEMPLATES.filter((t) => Boolean(t.generateModelKeyframes));
}

export function getMotionTemplatesByCategory(
  category: AnimationTemplateCategory
): AnimationTemplate[] {
  return getMotionAnimationTemplates().filter((t) => t.category === category);
}

export const TEMPLATE_CATEGORY_LABELS: Record<AnimationTemplateCategory, string> = {
  camera: 'Camera',
  character: 'Character',
  combo: 'Camera + Character',
  emote: 'Emote + Bloom ✦',
  dance: 'Body Dance',
};

/** Dance hub: body moves + camera + combos + bloom emotes. */
export const DANCE_PICKER_CATEGORIES: AnimationTemplateCategory[] = [
  'dance',
  'camera',
  'combo',
  'emote',
];

/** Character expressions & gestures (non-dance). */
export const CHARACTER_PICKER_CATEGORIES: AnimationTemplateCategory[] = ['character'];

export const DEFAULT_VISUAL_FX: VisualFxSettings = {
  ...BASE_VISUAL_FX,
  bloomEnabled: false,
  bloomIntensity: 0.28,
  bloomThreshold: 0.88,
  toneExposure: 0.95,
  dofEnabled: false,
  dofFocusDistance: 0.028,
  dofFocalLength: 0.01,
  dofBokehScale: 1,
};

/** 9:16 — only slightly lower exposure (no auto blur / bloom). */
export const CINEMATIC_VERTICAL_FX: VisualFxSettings = {
  ...DEFAULT_VISUAL_FX,
  toneExposure: 0.92,
};

export function visualFxFromTemplate(fx?: TemplateVisualFx): VisualFxSettings {
  if (!fx?.bloom) {
    return { ...DEFAULT_VISUAL_FX };
  }
  return {
    ...DEFAULT_VISUAL_FX,
    bloomEnabled: true,
    bloomIntensity: fx.bloomIntensity ?? 1.2,
    bloomThreshold: fx.bloomThreshold ?? 0.25,
    ssaoEnabled: false,
    godRaysEnabled: false,
    dofEnabled: false,
  };
}
