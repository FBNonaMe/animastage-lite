/**
 * Generate cinematic keyframes from a template definition + adapted scale.
 */
import type { CameraKeyframe } from '../../types';
import type { CameraTemplateDef } from './types';

type V3 = [number, number, number];

function kid(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function lookAt(focus: V3, frac: number, height: number): V3 {
  return [focus[0], focus[1] - height * 0.5 + height * frac, focus[2]];
}

function orbit(focus: V3, radius: number, yaw: number, y: number): V3 {
  return [focus[0] + Math.sin(yaw) * radius, y, focus[2] + Math.cos(yaw) * radius];
}

function key(
  frame: number,
  position: V3,
  target: V3,
  tpl: CameraTemplateDef,
  fov: number,
  extra?: Partial<CameraKeyframe>
): CameraKeyframe {
  const dist = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2]);
  return {
    id: kid(),
    frame,
    position,
    rotation: [0, 0, extra?.roll ?? 0],
    fov,
    target: [...target],
    easing: extra?.easing ?? tpl.easing,
    speed: extra?.speed ?? tpl.speed,
    followTarget: extra?.followTarget ?? tpl.followTarget,
    focusDistance: dist,
    dofStrength: extra?.dofStrength ?? tpl.dofStrength,
    ...extra,
  };
}

export interface GenerateScale {
  focus: V3;
  height: number;
  frames: number;
  radius: number;
  minDist: number;
  maxDist: number;
  fovBoost: number;
}

/**
 * Build a smooth multi-key path for the template motion kind.
 */
export function generateTemplateKeyframes(
  tpl: CameraTemplateDef,
  scale: GenerateScale
): CameraKeyframe[] {
  const { focus, height, frames, radius, fovBoost } = scale;
  const f = (t: number) => Math.max(0, Math.min(frames - 1, Math.round(t * (frames - 1))));
  const look = lookAt(focus, tpl.lookFrac, height);
  const baseY = focus[1] - height * 0.5 + height * tpl.heightFrac;
  const fov0 = tpl.baseFov * fovBoost;
  const fov1 = (tpl.endFov ?? tpl.baseFov) * fovBoost;
  const r = Math.max(scale.minDist, Math.min(scale.maxDist, radius));

  switch (tpl.motion) {
    case 'orbit':
    case 'orbit_fast': {
      const sweep = tpl.motion === 'orbit_fast' ? Math.PI * 1.35 : Math.PI * 1.1;
      const n = tpl.motion === 'orbit_fast' ? 6 : 5;
      return Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        const yaw = -0.25 + t * sweep;
        const y = baseY + Math.sin(t * Math.PI) * height * 0.08;
        return key(f(t), orbit(focus, r, yaw, y), look, tpl, fov0, {
          easing: i === 0 ? 'easeOut' : 'catmull',
          speed: tpl.speed,
        });
      });
    }
    case 'orbit_360': {
      const n = 7;
      return Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        const yaw = t * Math.PI * 2;
        const y = baseY + Math.sin(t * Math.PI * 2) * height * 0.06;
        return key(f(t), orbit(focus, r, yaw, y), look, tpl, fov0, { easing: 'cinematic' });
      });
    }
    case 'spiral': {
      const n = 6;
      return Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        const yaw = t * Math.PI * 1.6;
        const rad = r * (1.15 - t * 0.25);
        const y = focus[1] - height * 0.35 + height * (0.2 + t * 0.75);
        return key(f(t), orbit(focus, rad, yaw, y), lookAt(focus, 0.35 + t * 0.2, height), tpl, fov0);
      });
    }
    case 'arc': {
      return [0, 0.33, 0.66, 1].map((t) => {
        const yaw = -0.55 + t * 1.2;
        const y = baseY + Math.sin(t * Math.PI) * height * 0.1;
        return key(f(t), orbit(focus, r, yaw, y), look, tpl, fov0, { easing: 'hermite' });
      });
    }
    case 'crane_up':
      return [
        key(f(0), orbit(focus, r * 1.1, 0.2, focus[1] - height * 0.35), look, tpl, fov0, {
          easing: 'easeOut',
        }),
        key(f(0.45), orbit(focus, r, 0.4, baseY), look, tpl, lerp(fov0, fov1, 0.4)),
        key(
          f(1),
          orbit(focus, r * 0.95, 0.55, focus[1] + height * 0.55),
          lookAt(focus, 0.3, height),
          tpl,
          fov1,
          { easing: 'easeIn', followTarget: 'full' }
        ),
      ];
    case 'drone':
      return [
        key(f(0), orbit(focus, r, 0, focus[1] + height * 0.9), lookAt(focus, 0.2, height), tpl, fov0),
        key(f(0.5), orbit(focus, r * 0.95, Math.PI * 0.55, focus[1] + height * 0.75), lookAt(focus, 0.25, height), tpl, fov0),
        key(f(1), orbit(focus, r * 0.9, Math.PI * 1.05, focus[1] + height * 0.6), lookAt(focus, 0.3, height), tpl, fov1),
      ];
    case 'push_in':
      return [
        key(f(0), orbit(focus, r * 1.25, 0.15, baseY), look, tpl, fov0, { easing: 'easeOut' }),
        key(f(0.55), orbit(focus, r * 0.85, 0.2, baseY + height * 0.04), lookAt(focus, Math.min(0.75, tpl.lookFrac + 0.08), height), tpl, lerp(fov0, fov1, 0.5)),
        key(f(1), orbit(focus, Math.max(scale.minDist, r * 0.55), 0.25, baseY + height * 0.06), lookAt(focus, Math.min(0.82, tpl.lookFrac + 0.15), height), tpl, fov1, {
          easing: 'easeIn',
          followTarget: 'face',
        }),
      ];
    case 'pull_out':
      return [
        key(f(0), orbit(focus, Math.max(scale.minDist, r * 0.55), 0.2, baseY + height * 0.05), lookAt(focus, 0.6, height), tpl, fov0, {
          followTarget: 'face',
          easing: 'easeOut',
        }),
        key(f(0.5), orbit(focus, r * 0.9, 0.3, baseY), look, tpl, lerp(fov0, fov1, 0.5)),
        key(f(1), orbit(focus, r * 1.35, 0.4, baseY - height * 0.05), lookAt(focus, 0.35, height), tpl, fov1, {
          followTarget: 'full',
          easing: 'easeIn',
        }),
      ];
    case 'zoom_in':
    case 'zoom_out': {
      const pos = orbit(focus, r, 0.18, baseY);
      return [
        key(f(0), pos, look, tpl, fov0, { easing: 'easeInOut' }),
        key(f(0.5), pos, look, tpl, lerp(fov0, fov1, 0.5)),
        key(f(1), pos, look, tpl, fov1),
      ];
    }
    case 'dolly': {
      const side = 0.12;
      return [
        key(f(0), orbit(focus, r * 1.2, side, baseY), look, tpl, fov0),
        key(f(0.5), orbit(focus, r, side + 0.05, baseY), look, tpl, fov0, { easing: 'hermite' }),
        key(f(1), orbit(focus, r * 0.75, side + 0.1, baseY), look, tpl, fov1),
      ];
    }
    case 'pan':
      return [
        key(f(0), orbit(focus, r, -0.55, baseY), lookAt(focus, tpl.lookFrac, height), tpl, fov0),
        key(f(0.5), orbit(focus, r, 0.05, baseY), look, tpl, fov0, { easing: 'cinematic' }),
        key(f(1), orbit(focus, r, 0.65, baseY), lookAt(focus, tpl.lookFrac, height), tpl, fov0),
      ];
    case 'track_side':
      return [
        key(f(0), [focus[0] + r * 0.85, baseY, focus[2] + r * 0.35], look, tpl, fov0),
        key(f(0.5), [focus[0] + r * 0.8, baseY + height * 0.02, focus[2]], look, tpl, fov0, { easing: 'hermite' }),
        key(f(1), [focus[0] + r * 0.85, baseY, focus[2] - r * 0.4], look, tpl, fov0),
      ];
    case 'track_front':
      return [
        key(f(0), orbit(focus, r, 0.05, baseY), lookAt(focus, 0.55, height), tpl, fov0, { followTarget: 'face' }),
        key(f(0.5), orbit(focus, r * 0.95, 0.08, baseY), lookAt(focus, 0.55, height), tpl, fov0),
        key(f(1), orbit(focus, r * 0.9, 0.1, baseY), lookAt(focus, 0.55, height), tpl, fov0),
      ];
    case 'track_back':
      return [
        key(f(0), orbit(focus, r, Math.PI, baseY), lookAt(focus, 0.4, height), tpl, fov0, { followTarget: 'root' }),
        key(f(0.5), orbit(focus, r * 0.95, Math.PI + 0.08, baseY), lookAt(focus, 0.4, height), tpl, fov0),
        key(f(1), orbit(focus, r * 0.9, Math.PI + 0.15, baseY), lookAt(focus, 0.4, height), tpl, fov0),
      ];
    case 'follow_walk':
      return [
        key(f(0), [focus[0], baseY, focus[2] - r], lookAt(focus, 0.45, height), tpl, fov0, { followTarget: 'root' }),
        key(f(0.5), [focus[0] + height * 0.04, baseY + height * 0.02, focus[2] - r * 0.95], lookAt(focus, 0.45, height), tpl, fov0),
        key(f(1), [focus[0], baseY, focus[2] - r * 0.9], lookAt(focus, 0.45, height), tpl, fov0),
      ];
    case 'follow_run':
      return [
        key(f(0), [focus[0] + 0.3, baseY - height * 0.05, focus[2] - r * 0.85], lookAt(focus, 0.45, height), tpl, fov0, {
          speed: tpl.speed,
          followTarget: 'root',
        }),
        key(f(0.4), [focus[0] - 0.2, baseY, focus[2] - r * 0.75], lookAt(focus, 0.48, height), tpl, fov0 * 1.05),
        key(f(0.75), [focus[0] + 0.4, baseY + height * 0.03, focus[2] - r * 0.7], lookAt(focus, 0.45, height), tpl, fov0),
        key(f(1), [focus[0], baseY, focus[2] - r * 0.65], lookAt(focus, 0.45, height), tpl, fov0),
      ];
    case 'static_hold':
      return [
        key(f(0), orbit(focus, r, 0.18, baseY), look, tpl, fov0, { easing: 'easeOut' }),
        key(f(0.5), orbit(focus, r * 1.02, 0.22, baseY + height * 0.015), look, tpl, fov0),
        key(f(1), orbit(focus, r, 0.26, baseY), look, tpl, fov0, { easing: 'easeIn' }),
      ];
    case 'reveal':
      return [
        key(f(0), orbit(focus, r * 0.55, 0.2, baseY + height * 0.08), lookAt(focus, 0.7, height), tpl, fov0, {
          followTarget: 'face',
          easing: 'easeOut',
        }),
        key(f(0.55), orbit(focus, r * 0.95, 0.35, baseY), look, tpl, lerp(fov0, fov1, 0.55)),
        key(f(1), orbit(focus, r * 1.35, 0.5, baseY - height * 0.05), lookAt(focus, 0.35, height), tpl, fov1, {
          followTarget: 'full',
          easing: 'easeIn',
        }),
      ];
    case 'entrance':
      return [
        key(f(0), orbit(focus, r * 1.4, 0.35, focus[1] - height * 0.4), lookAt(focus, 0.55, height), tpl, fov0, {
          easing: 'easeOut',
        }),
        key(f(0.5), orbit(focus, r * 0.95, 0.28, baseY - height * 0.1), lookAt(focus, 0.6, height), tpl, lerp(fov0, fov1, 0.5)),
        key(f(1), orbit(focus, r * 0.7, 0.22, baseY), lookAt(focus, 0.65, height), tpl, fov1, {
          followTarget: 'face',
          easing: 'easeIn',
        }),
      ];
    case 'dynamic_cuts': {
      const poses: Array<{ yaw: number; rad: number; y: number; look: number; fov: number; roll?: number }> = [
        { yaw: -0.5, rad: 1.1, y: 0.4, look: 0.45, fov: fov0 },
        { yaw: 0.2, rad: 0.75, y: 0.6, look: 0.65, fov: fov0 * 0.9, roll: -3 },
        { yaw: 1.0, rad: 1.05, y: 0.35, look: 0.4, fov: fov0 * 1.05, roll: 4 },
        { yaw: 1.6, rad: 0.7, y: 0.7, look: 0.7, fov: fov0 * 0.85 },
        { yaw: 2.2, rad: 1.0, y: 0.5, look: 0.5, fov: fov0 },
      ];
      return poses.map((p, i) => {
        const t = i / (poses.length - 1);
        return key(
          f(t),
          orbit(focus, r * p.rad, p.yaw, focus[1] - height * 0.5 + height * p.y),
          lookAt(focus, p.look, height),
          tpl,
          p.fov,
          { roll: p.roll ?? 0, easing: 'catmull', speed: tpl.speed }
        );
      });
    }
    case 'ots':
      return [
        key(
          f(0),
          [focus[0] - r * 0.35, baseY + height * 0.08, focus[2] - r * 0.55],
          [focus[0] + r * 0.15, look[1], focus[2] + r * 0.2],
          tpl,
          fov0,
          { followTarget: 'face' }
        ),
        key(
          f(1),
          [focus[0] - r * 0.32, baseY + height * 0.09, focus[2] - r * 0.5],
          [focus[0] + r * 0.18, look[1], focus[2] + r * 0.22],
          tpl,
          fov0,
          { followTarget: 'face' }
        ),
      ];
    case 'low_hero':
      return [
        key(f(0), orbit(focus, r, 0.2, focus[1] - height * 0.42), lookAt(focus, 0.72, height), tpl, fov0, {
          easing: 'easeOut',
        }),
        key(f(0.55), orbit(focus, r * 0.85, 0.28, focus[1] - height * 0.3), lookAt(focus, 0.75, height), tpl, fov0),
        key(f(1), orbit(focus, r * 0.7, 0.32, focus[1] - height * 0.22), lookAt(focus, 0.78, height), tpl, fov1, {
          followTarget: 'face',
        }),
      ];
    case 'high_reveal':
      return [
        key(f(0), orbit(focus, r * 0.7, 0.15, focus[1] - height * 0.2), lookAt(focus, 0.6, height), tpl, fov0, {
          easing: 'easeOut',
        }),
        key(f(0.45), orbit(focus, r, 0.4, baseY + height * 0.2), look, tpl, lerp(fov0, fov1, 0.45)),
        key(f(1), orbit(focus, r * 1.2, 0.7, focus[1] + height * 0.55), lookAt(focus, 0.25, height), tpl, fov1, {
          followTarget: 'full',
          easing: 'easeIn',
        }),
      ];
    default:
      return [
        key(f(0), orbit(focus, r, 0.2, baseY), look, tpl, fov0),
        key(f(1), orbit(focus, r, 0.45, baseY), look, tpl, fov0),
      ];
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
