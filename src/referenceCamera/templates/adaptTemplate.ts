/**
 * Smart template adaptation — height, aspect, duration, constraints.
 */
import type { ViewportFormat } from '../../types';
import { isPortraitFormat } from '../../utils/characterQuality';
import { smoothCameraKeyframes } from '../smoothCamera';
import { applyPortraitKeepInFrame } from '../framing';
import type { CameraTemplateDef, TemplateAdaptContext, AppliedCameraTemplate } from './types';
import { generateTemplateKeyframes } from './generateTemplate';
import { evaluateCinematicCameraAtFrame } from '../cinematicInterp';

const REF_HEIGHT = 16;

export function estimateCharacterHeight(focusY: number, explicit?: number): number {
  if (explicit && explicit > 1) return explicit;
  // MMD models often focus near chest ~10 with height ~16–18
  return Math.max(10, Math.min(28, focusY * 1.55));
}

function aspectFovBoost(format: ViewportFormat): number {
  if (format === '9:16' || format === '4:5') return 1.08;
  if (format === '21:9') return 0.96;
  if (format === '1:1') return 1.02;
  return 1;
}

function aspectRadiusMul(format: ViewportFormat): number {
  if (isPortraitFormat(format)) return 1.22;
  if (format === '21:9') return 1.08;
  return 1;
}

/**
 * Apply a cinematic template with automatic adaptation.
 */
export function applyCameraTemplate(
  tpl: CameraTemplateDef,
  ctx: TemplateAdaptContext
): AppliedCameraTemplate {
  const height = estimateCharacterHeight(ctx.focus[1], ctx.characterHeight);
  const scaleRatio = height / REF_HEIGHT;
  const frames = Math.max(
    48,
    Math.round(ctx.durationFrames * tpl.durationScale)
  );
  const preferred = tpl.safe.preferred * scaleRatio * aspectRadiusMul(ctx.viewportFormat);
  const minDist = Math.max(
    tpl.safe.min * scaleRatio * 0.85,
    ctx.minDistance ?? tpl.safe.min * scaleRatio * 0.75
  );
  const maxDist = Math.min(
    tpl.safe.max * scaleRatio * 1.15,
    ctx.maxDistance ?? tpl.safe.max * scaleRatio * 1.25
  );
  const radius = Math.max(minDist, Math.min(maxDist, preferred * tpl.radiusMul));

  let keys = generateTemplateKeyframes(tpl, {
    focus: ctx.focus,
    height,
    frames,
    radius,
    minDist,
    maxDist,
    fovBoost: aspectFovBoost(ctx.viewportFormat),
  });

  // Portrait: pull samples through keep-in-frame
  if (isPortraitFormat(ctx.viewportFormat) || tpl.preferredAspects.includes('9:16')) {
    if (isPortraitFormat(ctx.viewportFormat)) {
      keys = keys.map((k) => {
        const snap = applyPortraitKeepInFrame(
          {
            position: [...k.position],
            rotation: [...k.rotation],
            fov: k.fov,
            target: k.target ? [...k.target] : [...ctx.focus],
          },
          ctx.focus,
          height
        );
        return {
          ...k,
          position: snap.position,
          target: snap.target,
          fov: snap.fov,
          focusDistance: Math.hypot(
            snap.position[0] - snap.target[0],
            snap.position[1] - snap.target[1],
            snap.position[2] - snap.target[2]
          ),
        };
      });
    }
  }

  keys = smoothCameraKeyframes(keys);

  // Remap frames to full timeline span while preserving relative timing
  if (keys.length >= 2 && frames !== ctx.durationFrames) {
    const t0 = keys[0].frame;
    const t1 = keys[keys.length - 1].frame;
    const span = Math.max(1, t1 - t0);
    const outSpan = Math.max(1, ctx.durationFrames - 1);
    keys = keys.map((k) => ({
      ...k,
      frame: Math.round(((k.frame - t0) / span) * outSpan),
    }));
  }

  const notes = [
    `Adapted to height ${height.toFixed(1)}`,
    `aspect ${ctx.viewportFormat}`,
    `${keys.length} keys`,
    `radius ~${radius.toFixed(1)}`,
  ].join(' · ');

  return {
    templateId: tpl.id,
    keyframes: keys,
    framing: tpl.framing,
    safe: {
      min: minDist,
      max: maxDist,
      preferred: radius,
    },
    notes,
  };
}

/** Lightweight path preview samples for UI thumbnails / scrub. */
export function previewTemplatePath(
  tpl: CameraTemplateDef,
  ctx: TemplateAdaptContext,
  samples = 8
): [number, number, number][] {
  const applied = applyCameraTemplate(tpl, ctx);
  const keys = applied.keyframes;
  if (keys.length === 0) return [];
  const last = keys[keys.length - 1].frame;
  const fallback = {
    position: keys[0].position,
    rotation: keys[0].rotation,
    fov: keys[0].fov,
    target: keys[0].target ?? ctx.focus,
  };
  const pts: [number, number, number][] = [];
  for (let i = 0; i < samples; i++) {
    const frame = Math.round((i / Math.max(1, samples - 1)) * last);
    const snap = evaluateCinematicCameraAtFrame(keys, frame, fallback);
    pts.push(snap.position);
  }
  return pts;
}
