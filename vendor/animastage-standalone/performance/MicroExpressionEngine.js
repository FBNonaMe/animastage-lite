import { FACIAL_CHANNEL_INDEX, createFacialBuffer } from "./FacialChannels.js";

export const PERSONALITY_PRESETS = Object.freeze({
  calm: { speed: 0.55, asymmetry: 0.18, tension: 0.08 }, energetic: { speed: 1.45, asymmetry: 0.32, tension: 0.3 },
  shy: { speed: 0.85, asymmetry: 0.38, tension: 0.25 }, confident: { speed: 0.72, asymmetry: 0.16, tension: 0.2 },
  cold: { speed: 0.42, asymmetry: 0.08, tension: 0.12 }, nervous: { speed: 1.65, asymmetry: 0.45, tension: 0.55 },
  playful: { speed: 1.2, asymmetry: 0.5, tension: 0.22 }, aggressive: { speed: 1.05, asymmetry: 0.25, tension: 0.72 },
  elegant: { speed: 0.62, asymmetry: 0.12, tension: 0.1 }, robotic: { speed: 0.2, asymmetry: 0, tension: 0 },
});

export class MicroExpressionEngine {
  constructor(rig) {
    this.rig = rig;
    this.enabled = true;
    this.intensity = 0.4;
    this.personality = "calm";
    this.tension = 0;
    this.fatigue = 0;
    this.speaking = 0;
    this.clock = 0;
    this.coefficients = createFacialBuffer();
  }

  setPersonality(name) { if (!PERSONALITY_PRESETS[name]) return false; this.personality = name; return true; }
  setContext(context = {}) { if (Number.isFinite(context.tension)) this.tension = Math.max(0, Math.min(1, context.tension)); if (Number.isFinite(context.fatigue)) this.fatigue = Math.max(0, Math.min(1, context.fatigue)); if (Number.isFinite(context.speaking)) this.speaking = Math.max(0, Math.min(1, context.speaking)); }

  supportReport() {
    const generated = ["browInnerUp", "mouthSmileLeft", "mouthSmileRight", "mouthPressLeft", "mouthPressRight", "eyeSquintLeft", "eyeSquintRight", "jawOpen"];
    const supported = new Set(this.rig?.supportedChannels?.() || []);
    const mapped = generated.filter((channel) => supported.has(channel));
    return { generated: generated.length, mapped: mapped.length, channels: mapped };
  }

  evaluate(layer, deltaTime, time) {
    const intensity = layer?.tracks?.has("micro.intensity") ? layer.sample("micro.intensity", time, this.intensity) : this.intensity;
    if (!this.enabled || intensity <= 0) return;
    this.clock += Math.max(0, Math.min(0.1, Number(deltaTime) || 0));
    const preset = PERSONALITY_PRESETS[this.personality];
    const t = this.clock * preset.speed;
    // These are final semantic morph coefficients, not radians.  The previous
    // constants were scaled twice (here and again by the facial graph), so the
    // default 0.25 intensity produced only ~0.2-0.5% morph influence: below the
    // visible response range of most PMX faces.  Keep the motion genuinely
    // micro, but make the default land in the useful 1-3% range.
    const amp = intensity * (0.55 + this.tension * 0.35 + this.fatigue * 0.1);
    const slow = Math.sin(t * 0.73 + 0.41) * 0.5 + Math.sin(t * 0.31 + 2.3) * 0.5;
    const medium = Math.sin(t * 1.37 + 1.1) * 0.6 + Math.sin(t * 0.91 + 4.2) * 0.4;
    const asym = preset.asymmetry;
    const c = this.coefficients; c.fill(0);
    c[FACIAL_CHANNEL_INDEX.browInnerUp] = Math.max(0, slow) * 0.22 * amp;
    c[FACIAL_CHANNEL_INDEX.mouthSmileLeft] = Math.max(0, medium) * 0.12 * amp * (1 + asym);
    c[FACIAL_CHANNEL_INDEX.mouthSmileRight] = Math.max(0, -medium) * 0.12 * amp * (1 - asym * 0.4);
    c[FACIAL_CHANNEL_INDEX.mouthPressLeft] = Math.max(0, -slow) * 0.09 * (preset.tension + this.tension) * amp;
    c[FACIAL_CHANNEL_INDEX.mouthPressRight] = Math.max(0, -slow) * 0.082 * (preset.tension + this.tension) * amp;
    c[FACIAL_CHANNEL_INDEX.eyeSquintLeft] = (0.5 + 0.5 * Math.sin(t * 0.43 + 0.2)) * 0.085 * amp;
    c[FACIAL_CHANNEL_INDEX.eyeSquintRight] = (0.5 + 0.5 * Math.sin(t * 0.47 + 1.7)) * 0.085 * amp;
    c[FACIAL_CHANNEL_INDEX.jawOpen] = (0.5 + 0.5 * Math.sin(t * 0.22)) * 0.055 * amp * (1 - this.speaking);
    this.rig.applyCoefficients(layer, c, time);
  }

  captureTransientState() {
    return {
      clock: this.clock,
      tension: this.tension,
      fatigue: this.fatigue,
      speaking: this.speaking,
      coefficients: Float32Array.from(this.coefficients),
    };
  }

  restoreTransientState(state) {
    if (!state) return false;
    this.clock = Number(state.clock) || 0;
    this.tension = Math.max(0, Math.min(1, Number(state.tension) || 0));
    this.fatigue = Math.max(0, Math.min(1, Number(state.fatigue) || 0));
    this.speaking = Math.max(0, Math.min(1, Number(state.speaking) || 0));
    this.coefficients.fill(0);
    if (state.coefficients) this.coefficients.set(state.coefficients.subarray?.(0, this.coefficients.length) || state.coefficients);
    return true;
  }

  resetTransientState() {
    this.clock = 0;
    this.tension = 0;
    this.fatigue = 0;
    this.speaking = 0;
    this.coefficients.fill(0);
  }

  toJSON() { return { enabled: this.enabled, intensity: this.intensity, personality: this.personality }; }
  restore(data) { if (!data) return false; this.enabled = data.enabled !== false; this.intensity = Math.max(0, Math.min(1, Number(data.intensity) || 0)); this.personality = PERSONALITY_PRESETS[data.personality] ? data.personality : "calm"; return true; }
}
