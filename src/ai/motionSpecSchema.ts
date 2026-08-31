/**
 * JSON Schema for MotionSpec structured output (Interactions API response_format).
 */
import { MOTION_SPEC_BONES, MOTION_SPEC_EXPRESSIONS } from './motionSpec';

const rotKey = {
  type: 'object',
  properties: {
    t: { type: 'number', description: 'Time in seconds' },
    r: {
      type: 'array',
      items: { type: 'number' },
      minItems: 3,
      maxItems: 3,
      description: 'Euler degrees XYZ',
    },
  },
  required: ['t', 'r'],
  additionalProperties: false,
};

const posKey = {
  type: 'object',
  properties: {
    t: { type: 'number' },
    p: {
      type: 'array',
      items: { type: 'number' },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ['t', 'p'],
  additionalProperties: false,
};

const exprKey = {
  type: 'object',
  properties: {
    t: { type: 'number' },
    w: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['t', 'w'],
  additionalProperties: false,
};

const trackProps: Record<string, unknown> = {};
for (const bone of MOTION_SPEC_BONES) {
  trackProps[bone] = { type: 'array', items: rotKey };
}

const exprProps: Record<string, unknown> = {};
for (const name of MOTION_SPEC_EXPRESSIONS) {
  exprProps[name] = { type: 'array', items: exprKey };
}

export const MOTION_SPEC_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    duration: { type: 'number' },
    loop: { type: 'boolean' },
    tracks: {
      type: 'object',
      properties: trackProps,
      additionalProperties: false,
    },
    hips: { type: 'array', items: posKey },
    expressions: {
      type: 'object',
      properties: exprProps,
      additionalProperties: false,
    },
  },
  required: ['name', 'duration', 'loop', 'tracks'],
  additionalProperties: false,
};
