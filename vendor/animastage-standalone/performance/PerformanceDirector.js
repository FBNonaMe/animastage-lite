import { EMOTION_PRESETS } from "./EmotionController.js";
import { EXPRESSION_PRESETS } from "./FacialExpressionController.js";
import { FINGER_NAMES } from "./PerformanceConstants.js";

const TOP_KEYS = new Set(["duration", "emotion", "gaze", "face", "hands"]);
const EMOTION_KEYS = new Set(["type", "intensity"]), GAZE_KEYS = new Set(["target", "strength", "startTime", "worldPoint"]);
const FACE_KEYS = new Set(["expression", "intensity", "smile", "blink"]), HAND_KEYS = new Set(["pose", "tension", "curl"]);
const GAZE_TARGETS = new Set(["camera", "selected", "away_left", "away_right", "world"]);
const BLINK_TYPES = new Set(["normal", "slow", "double", "half", "winkLeft", "winkRight", "none"]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
function unknownKeys(object, allowed, path, errors) { for (const key of Object.keys(object || {})) if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed`); }

export function validatePerformanceCommand(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["Command must be an object"], value: null };
  unknownKeys(input, TOP_KEYS, "command", errors);
  const value = { duration: clamp(input.duration ?? 2.5, 0.1, 60) };
  if (input.emotion != null) {
    if (typeof input.emotion !== "object") errors.push("emotion must be an object");
    else {
      unknownKeys(input.emotion, EMOTION_KEYS, "emotion", errors);
      const type = String(input.emotion.type || "neutral");
      if (!EMOTION_PRESETS[type]) errors.push(`Unsupported emotion: ${type}`);
      value.emotion = { type, intensity: clamp(input.emotion.intensity ?? 0.7, 0, 1) };
    }
  }
  if (input.gaze != null) {
    if (typeof input.gaze !== "object") errors.push("gaze must be an object");
    else {
      unknownKeys(input.gaze, GAZE_KEYS, "gaze", errors);
      const target = String(input.gaze.target || "camera");
      if (!GAZE_TARGETS.has(target)) errors.push(`Unsupported gaze target: ${target}`);
      const worldPoint = Array.isArray(input.gaze.worldPoint) && input.gaze.worldPoint.length >= 3 ? input.gaze.worldPoint.slice(0, 3).map(Number) : null;
      if (target === "world" && !worldPoint?.every(Number.isFinite)) errors.push("world gaze requires worldPoint [x,y,z]");
      value.gaze = { target, strength: clamp(input.gaze.strength ?? 0.7, 0, 1), startTime: clamp(input.gaze.startTime ?? 0.15, 0, value.duration), ...(worldPoint ? { worldPoint } : {}) };
    }
  }
  if (input.face != null) {
    if (typeof input.face !== "object") errors.push("face must be an object");
    else {
      unknownKeys(input.face, FACE_KEYS, "face", errors);
      const expression = input.face.expression == null ? null : String(input.face.expression);
      if (expression && !EXPRESSION_PRESETS[expression]) errors.push(`Unsupported expression: ${expression}`);
      const blink = String(input.face.blink || "none"); if (!BLINK_TYPES.has(blink)) errors.push(`Unsupported blink: ${blink}`);
      value.face = { expression, intensity: clamp(input.face.intensity ?? 0.65, 0, 1), smile: clamp(input.face.smile ?? 0, 0, 1), blink };
    }
  }
  if (input.hands != null) {
    if (typeof input.hands !== "object") errors.push("hands must be an object");
    else {
      value.hands = {};
      for (const side of ["left", "right"]) if (input.hands[side] != null) {
        const hand = input.hands[side]; if (typeof hand !== "object") { errors.push(`hands.${side} must be an object`); continue; }
        unknownKeys(hand, HAND_KEYS, `hands.${side}`, errors);
        value.hands[side] = { pose: String(hand.pose || "relaxed"), tension: clamp(hand.tension ?? 0, 0, 1), curl: clamp(hand.curl ?? 0, 0, 1) };
      }
      for (const key of Object.keys(input.hands)) if (!value.hands[key]) errors.push(`hands.${key} is not allowed`);
    }
  }
  return { ok: errors.length === 0, errors, value: errors.length ? null : value };
}

const has = (text, terms) => terms.some((term) => text.includes(term));
export function parsePerformanceText(text) {
  const source = String(text || "").trim(), lower = source.toLowerCase();
  const duration = clamp(Number(lower.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|seconds|сек)/)?.[1]) || 2.5, 0.1, 60);
  let emotion = "neutral";
  for (const [name, terms] of [
    ["shy", ["shy", "bashful", "сором", "ніяков"]], ["happy", ["happy", "joy", "раді", "весел"]],
    ["sad", ["sad", "сум", "печал"]], ["angry", ["angry", "furious", "зл", "сердит"]],
    ["nervous", ["nervous", "anxious", "нерв", "тривож"]], ["confident", ["confident", "впевнен"]],
    ["frightened", ["frightened", "afraid", "scared", "налякан", "боїться"]], ["romantic", ["romantic", "tender", "романтич", "ніжн"]],
    ["tired", ["tired", "sleepy", "втом", "сонн"]],
  ]) if (has(lower, terms)) { emotion = name; break; }
  const command = { duration, emotion: { type: emotion, intensity: emotion === "neutral" ? 0.4 : 0.68 } };
  if (has(lower, ["look away", "looks away", "відвод", "відверта", "убік"])) command.gaze = { target: has(lower, ["right", "прав"]) ? "away_right" : "away_left", strength: 0.7, startTime: 0.18 };
  else if (has(lower, ["camera", "камер"])) command.gaze = { target: "camera", strength: 0.82, startTime: 0.12 };
  else if (has(lower, ["object", "prop", "предмет", "об'єкт"])) command.gaze = { target: "selected", strength: 0.76, startTime: 0.16 };
  const smile = has(lower, ["smile", "smiles", "усміх", "посміх"]) ? (has(lower, ["soft", "gently", "легк", "м'яко"]) ? 0.32 : 0.55) : 0;
  let blink = "none";
  if (has(lower, ["slow blink", "slowly blink", "повільно морг"])) blink = "slow";
  else if (has(lower, ["double blink", "двічі морг"])) blink = "double";
  else if (has(lower, ["wink", "підморг"])) blink = has(lower, ["right", "прав"]) ? "winkRight" : "winkLeft";
  else if (has(lower, ["blink", "морг"])) blink = "normal";
  if (smile || blink !== "none" || emotion !== "neutral") command.face = { expression: EXPRESSION_PRESETS[emotion] ? emotion : null, intensity: 0.65, smile, blink };
  if (has(lower, ["finger", "hand", "fist", "пальц", "рук", "кулак", "стиска"])) {
    const pose = has(lower, ["fist", "кулак"]) ? "fist" : has(lower, ["pray", "молит", "складені долоні"]) ? "praying" : "relaxed";
    const tension = has(lower, ["nervous", "tighten", "нерв", "стиска", "напруж"]) ? 0.32 : 0.12;
    command.hands = { left: { pose, tension, curl: tension * 0.5 }, right: { pose, tension, curl: tension * 0.5 } };
  }
  return validatePerformanceCommand(command);
}

function setTransition(layer, channel, start, end, target, fallback = 0) {
  layer.setKey(channel, start, layer.sample(channel, start, fallback), "smooth");
  layer.setKey(channel, end, target, "ease");
}

export class PerformanceDirector {
  constructor(runtime) { this.runtime = runtime; this.preview = null; this.userPresets = {}; }
  generate(text) { const result = parsePerformanceText(text); this.preview = result.ok ? result.value : null; return result; }
  setPreview(command) { const result = validatePerformanceCommand(command); this.preview = result.ok ? result.value : null; return result; }

  apply(command = this.preview, options = {}) {
    const checked = validatePerformanceCommand(command); if (!checked.ok) return checked;
    const value = checked.value, start = Math.max(0, Number(options.offset) || this.runtime.timeline.time()), blendEnd = start + Math.min(0.45, value.duration * 0.22);
    this.runtime.timeline.checkpoint();
    if (value.emotion) {
      const [valence, arousal, dominance] = EMOTION_PRESETS[value.emotion.type]; const layer = this.runtime.stack.get("emotion");
      setTransition(layer, "emotion.valence", start, blendEnd, valence, this.runtime.emotions.valence);
      setTransition(layer, "emotion.arousal", start, blendEnd, arousal, this.runtime.emotions.arousal);
      setTransition(layer, "emotion.dominance", start, blendEnd, dominance, this.runtime.emotions.dominance);
      setTransition(layer, "emotion.intensity", start, blendEnd, value.emotion.intensity, this.runtime.emotions.intensity);
    }
    if (value.face) {
      const layer = this.runtime.stack.get("facialBase"), preset = EXPRESSION_PRESETS[value.face.expression]?.channels || {};
      for (const [channel, target] of Object.entries(preset)) setTransition(layer, `channel.${channel}`, start, blendEnd, target * value.face.intensity, 0);
      if (value.face.smile > 0) for (const channel of ["mouthSmileLeft", "mouthSmileRight"]) setTransition(layer, `channel.${channel}`, start, blendEnd, value.face.smile, 0);
      if (value.face.blink !== "none") {
        const bridge = this.runtime.timeline.bridge(), previousTime = bridge?.time?.();
        const blinkLayer = this.runtime.stack.get("blink"), blinkStart = start + Math.min(value.duration * 0.55, 0.8), duration = value.face.blink === "slow" ? 0.42 : 0.16;
        const left = value.face.blink !== "winkRight", right = value.face.blink !== "winkLeft";
        if (left) { blinkLayer.setKey("blink.left", blinkStart, 0, "linear"); blinkLayer.setKey("blink.left", blinkStart + duration * 0.38, 1, "smooth"); blinkLayer.setKey("blink.left", blinkStart + duration, 0, "smooth"); }
        if (right) { blinkLayer.setKey("blink.right", blinkStart, 0, "linear"); blinkLayer.setKey("blink.right", blinkStart + duration * 0.38, 1, "smooth"); blinkLayer.setKey("blink.right", blinkStart + duration, 0, "smooth"); }
        void previousTime;
      }
    }
    if (value.gaze) {
      const layer = this.runtime.stack.get("gaze"), gaze = this.runtime.gaze, at = start + value.gaze.startTime;
      let target;
      if (value.gaze.target === "world") target = value.gaze.worldPoint;
      else if (value.gaze.target === "camera") { gaze.setTargetCamera(); gaze._resolveTarget(); target = gaze._target.toArray(); }
      else if (value.gaze.target === "selected" && gaze.setTargetSelectedObject()) { gaze._resolveTarget(); target = gaze._target.toArray(); }
      else {
        const p = gaze.primaryHead?.bone?.getWorldPosition(gaze._position) || gaze.worldTarget;
        target = [p.x + (value.gaze.target === "away_right" ? 8 : -8), p.y + 1.5, p.z - 5];
        gaze.setTargetWorld(target);
      }
      if (target) for (const [index, axis] of ["x", "y", "z"].entries()) setTransition(layer, `target.${axis}`, start, at, target[index], gaze.worldTarget[axis]);
    }
    if (value.hands) {
      const layer = this.runtime.stack.get("handPose");
      for (const side of ["left", "right"]) {
        const spec = value.hands[side]; if (!spec) continue;
        const preset = this.runtime.hands.presets.get(spec.pose) || this.runtime.hands.presets.get("relaxed");
        for (const [key, target] of Object.entries(preset.master || {})) setTransition(layer, `${side}.master.${key}`, start, blendEnd, target, this.runtime.hands.state.hands[side].master[key]);
        setTransition(layer, `${side}.master.tension`, start, blendEnd, spec.tension, this.runtime.hands.state.hands[side].master.tension);
        setTransition(layer, `${side}.master.curl`, start, blendEnd, spec.curl, this.runtime.hands.state.hands[side].master.curl);
        for (const digit of FINGER_NAMES) for (const [key, target] of Object.entries(preset.fingers?.[digit] || {})) setTransition(layer, `${side}.${digit}.${key}`, start, blendEnd, target, this.runtime.hands.state.hands[side].fingers[digit][key]);
      }
    }
    this.preview = value;
    return { ok: true, errors: [], value, start, end: start + value.duration };
  }

  savePreset(name, command = this.preview) { const key = String(name || "").trim(); const checked = validatePerformanceCommand(command); if (!key || !checked.ok) return false; this.userPresets[key] = checked.value; return true; }
  toJSON() { return { userPresets: JSON.parse(JSON.stringify(this.userPresets)) }; }
  restore(data) { this.userPresets = {}; for (const [name, command] of Object.entries(data?.userPresets || {})) { const checked = validatePerformanceCommand(command); if (checked.ok) this.userPresets[name] = checked.value; } return true; }
}
