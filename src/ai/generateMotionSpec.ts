/**
 * Text → MotionSpec via OpenRouter + retarget to timeline.
 */
import type { TimelineKeyframe } from '../types';
import {
  MOTION_SPEC_BONES,
  finalizeMotionSpec,
  parseMotionSpecJson,
  type MotionSpec,
} from './motionSpec';
import { localMotionSpecFromPrompt } from './motionSpecPresets';
import {
  motionSpecSuggestedMaxFrames,
  motionSpecToTimelineKeyframes,
} from './motionSpecToTimeline';
import {
  formatGeminiError,
  generateGeminiText,
} from './geminiClient';
import { hasOpenRouterApiKey } from './openrouter';
import { MOTION_SPEC_JSON_SCHEMA } from './motionSpecSchema';

const FLAVORS = [
  'slightly playful timing',
  'a bit more reserved / polite',
  'crisper accents on the main beat',
  'softer ease-in / ease-out',
  'subtle head and chest follow-through',
];

function randomFlavor(): string {
  return FLAVORS[Math.floor(Math.random() * FLAVORS.length)]!;
}

export const MOTION_SPEC_SYSTEM_PROMPT = `You are a VRM humanoid motion designer.
Output ONLY a JSON object (no markdown, no explanation).

# Coordinate conventions (VRM 1.0 / T-pose rest)
- Character faces +Z. +X is character's left. +Y is up.
- Rotation is Euler degrees [X, Y, Z] (XYZ order) relative to T-pose.
- Arms start in T-pose stretched sideways:
  - Lower left arm: leftUpperArm Z ≈ -70
  - Lower right arm: rightUpperArm Z ≈ +70
  - Raise right arm: rightUpperArm Z ≈ -45..-60
  - Raise left arm: leftUpperArm Z ≈ +45..+60
  - Bend elbow: leftLowerArm / rightLowerArm (prefer Z; keep X ≈ 0)
- Bow / nod: positive X on spine/chest/neck/head
- Turn head left: positive head Y
- Jump: temporary hips.p.y +0.15..0.3 (meters). Squatting: hips.p.y negative.

# Available bones
${MOTION_SPEC_BONES.join(', ')}

# JSON schema
{
  "name": "ascii_id",
  "duration": number,
  "loop": boolean,
  "tracks": { "boneName": [ { "t": seconds, "r": [x,y,z] }, ... ] },
  "hips": [ { "t": seconds, "p": [dx,dy,dz] } ],
  "expressions": { "preset": [ { "t": seconds, "w": 0..1 } ] }
}

# Expressions
Use: happy, angry, sad, relaxed, surprised, blink, aa
Always add emotion-matching expressions + occasional blink (0→1→0 in ~0.15s).

# Rules
- Start from a natural lowered-arm pose (leftUpperArm Z=-70, rightUpperArm Z=+70 at t=0).
- Every used bone needs keys at t=0 and t=duration.
- duration 1.5..12 seconds. ~2-4 keys per second per active bone.
- Do NOT animate leftHand/rightHand or leftShoulder/rightShoulder (auto-handled).
- Keep knee (lowerLeg) X in 0..130 only (no hyperextension).
- Focus motion on a few lead joints; keep secondary joints subtle.
- Wave: keep upperArm raised ~45-60°, animate forearm bend (lowerArm) as the wave.

# Example quality bar (do NOT copy angles blindly) — bow:
{"name":"bow","duration":2.4,"loop":false,"tracks":{"leftUpperArm":[{"t":0,"r":[0,0,-70]},{"t":2.4,"r":[0,0,-70]}],"rightUpperArm":[{"t":0,"r":[0,0,70]},{"t":2.4,"r":[0,0,70]}],"spine":[{"t":0,"r":[0,0,0]},{"t":0.7,"r":[22,0,0]},{"t":1.6,"r":[22,0,0]},{"t":2.4,"r":[0,0,0]}],"neck":[{"t":0,"r":[0,0,0]},{"t":0.7,"r":[18,0,0]},{"t":1.6,"r":[18,0,0]},{"t":2.4,"r":[0,0,0]}]},"hips":[],"expressions":{"relaxed":[{"t":0.5,"w":0.4},{"t":1.6,"w":0.4},{"t":2.4,"w":0}]}}
`;

const REFINE_PROMPT = `Review and improve the motion JSON you produced.
Fix joint limits, unnatural elbows/shoulders, missing t=0/t=duration keys, flat timing, and missing expressions/blinks.
Keep the same motion intent and approximate duration.
Return ONLY the corrected JSON object.`;

export interface GenerateMotionSpecOptions {
  refine?: boolean;
  onProgress?: (message: string) => void;
}

export async function generateMotionSpecFromPrompt(
  prompt: string,
  options: GenerateMotionSpecOptions = {}
): Promise<{ spec: MotionSpec; source: 'ai' | 'local'; refined: boolean }> {
  // Default off — self-review doubles quota use and often triggers free-tier 429.
  const refine = options.refine === true;
  const local = localMotionSpecFromPrompt(prompt);
  // Known offline presets always win (no API needed / no quota).
  if (local) {
    options.onProgress?.(`Offline preset · ${local.name}`);
    return { spec: local, source: 'local', refined: false };
  }

  const ai = hasOpenRouterApiKey();

  if (!ai) {
    throw new Error(
      'No offline match. Try: wave, bow, nod, clap, cheer, dance, jump, laugh, sad… — or add an OpenRouter API key in AI Settings'
    );
  }

  options.onProgress?.('Generating motion spec…');
  const flavor = randomFlavor();
  const userMsg =
    `Create motion for: ${prompt}\n` +
    `(Performance flavor this time: ${flavor}. Prefer the user instruction if it conflicts.)`;

  let spec: MotionSpec;
  try {
    spec = finalizeMotionSpec(
      parseMotionSpecJson(
        await generateGeminiText(userMsg, {
          onProgress: options.onProgress,
          systemInstruction: MOTION_SPEC_SYSTEM_PROMPT,
          responseJsonSchema: MOTION_SPEC_JSON_SCHEMA,
        })
      )
    );
  } catch (err) {
    throw new Error(formatGeminiError(err));
  }

  let didRefine = false;
  if (refine) {
    options.onProgress?.('Self-review pass…');
    try {
      const refinedText = await generateGeminiText(
        `${userMsg}\n\nDraft JSON:\n${JSON.stringify(spec)}\n\n${REFINE_PROMPT}`,
        {
          onProgress: options.onProgress,
          systemInstruction: MOTION_SPEC_SYSTEM_PROMPT,
          responseJsonSchema: MOTION_SPEC_JSON_SCHEMA,
        }
      );
      spec = finalizeMotionSpec(parseMotionSpecJson(refinedText));
      didRefine = true;
    } catch {
      // Keep first pass if refine fails (including 429).
    }
  }

  return { spec, source: 'ai', refined: didRefine };
}

export interface GenerateMotionResult {
  keyframes: TimelineKeyframe[];
  spec: MotionSpec;
  source: 'ai' | 'local';
  refined: boolean;
  suggestedMaxFrames: number;
}

/** Full pipeline: prompt → MotionSpec → timeline keys. */
export async function generateTimelineFromMotionPrompt(
  prompt: string,
  maxFrames: number,
  options: GenerateMotionSpecOptions = {}
): Promise<GenerateMotionResult> {
  const { spec, source, refined } = await generateMotionSpecFromPrompt(prompt, options);
  const suggestedMaxFrames = Math.max(maxFrames, motionSpecSuggestedMaxFrames(spec));
  const keyframes = motionSpecToTimelineKeyframes(spec, suggestedMaxFrames);
  if (keyframes.length === 0) {
    throw new Error('Motion produced no timeline keys');
  }
  return { keyframes, spec, source, refined, suggestedMaxFrames };
}
