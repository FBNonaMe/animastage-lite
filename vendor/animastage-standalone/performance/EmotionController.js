import { FACIAL_CHANNEL_INDEX, createFacialBuffer } from "./FacialChannels.js";

const EMOTION_PRESETS = Object.freeze({
  neutral: [0, 0, 0], happy: [0.8, 0.55, 0.25], sad: [-0.75, -0.45, -0.35],
  angry: [-0.7, 0.8, 0.75], shy: [0.28, -0.2, -0.65], nervous: [-0.35, 0.65, -0.45],
  confident: [0.48, 0.3, 0.8], frightened: [-0.82, 0.86, -0.7], tired: [-0.18, -0.82, -0.25],
  romantic: [0.72, -0.08, 0.05], playful: [0.68, 0.72, 0.15], cold: [-0.15, -0.52, 0.55],
});

function set(buffer, name, value) { const i = FACIAL_CHANNEL_INDEX[name]; if (i !== undefined) buffer[i] = value; }

export class EmotionController {
  constructor(rig) {
    this.rig = rig;
    this.valence = 0;
    this.arousal = 0;
    this.dominance = 0;
    this.intensity = 0.7;
    this.coefficients = createFacialBuffer();
    this.listeners = new Set();
    this.behavior = { blinkRate: 1, gazeAvoidance: 0, tension: 0, fatigue: 0, eyeContact: 0.65 };
  }

  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  _emit() { for (const listener of this.listeners) { try { listener(this); } catch (_) {} } }

  setPad(valence, arousal, dominance = this.dominance) {
    this.valence = Math.max(-1, Math.min(1, Number(valence) || 0));
    this.arousal = Math.max(-1, Math.min(1, Number(arousal) || 0));
    this.dominance = Math.max(-1, Math.min(1, Number(dominance) || 0));
    this._updateBehavior(); this._emit();
  }

  setPreset(name) {
    const values = EMOTION_PRESETS[name];
    if (!values) return false;
    this.setPad(values[0], values[1], values[2]);
    return true;
  }

  setIntensity(value) { this.intensity = Math.max(0, Math.min(1, Number(value) || 0)); this._emit(); }

  _updateBehavior() {
    const negative = Math.max(0, -this.valence), positive = Math.max(0, this.valence);
    this.behavior.blinkRate = Math.max(0.45, Math.min(1.8, 1 + Math.max(0, this.arousal) * 0.35 + negative * 0.25 - Math.max(0, this.dominance) * 0.18));
    this.behavior.gazeAvoidance = Math.max(0, -this.dominance) * 0.45 + negative * 0.2;
    this.behavior.tension = Math.max(0, this.arousal) * (0.35 + negative * 0.5);
    this.behavior.fatigue = Math.max(0, -this.arousal) * 0.8;
    this.behavior.eyeContact = Math.max(0.1, Math.min(1, 0.62 + this.dominance * 0.3 + positive * 0.08 - this.behavior.gazeAvoidance));
  }

  evaluate(layer, time) {
    const c = this.coefficients; c.fill(0);
    const value = (name, fallback) => layer?.tracks?.has(name) ? layer.sample(name, time, fallback) : fallback;
    const valence = value("emotion.valence", this.valence);
    const arousal = value("emotion.arousal", this.arousal);
    const dominance = value("emotion.dominance", this.dominance);
    const intensity = value("emotion.intensity", this.intensity);
    const p = Math.max(0, valence) * intensity;
    const n = Math.max(0, -valence) * intensity;
    const high = Math.max(0, arousal) * intensity;
    const low = Math.max(0, -arousal) * intensity;
    const dom = Math.max(0, dominance) * intensity;
    const sub = Math.max(0, -dominance) * intensity;
    set(c, "mouthSmileLeft", p * (0.58 + high * 0.18)); set(c, "mouthSmileRight", p * (0.58 + high * 0.18));
    set(c, "cheekSquintLeft", p * 0.24); set(c, "cheekSquintRight", p * 0.24);
    set(c, "mouthFrownLeft", n * 0.55); set(c, "mouthFrownRight", n * 0.55); set(c, "browInnerUp", n * 0.42 + sub * 0.18);
    set(c, "eyeWideLeft", high * (0.34 + n * 0.22)); set(c, "eyeWideRight", high * (0.34 + n * 0.22));
    set(c, "browOuterUpLeft", high * 0.28); set(c, "browOuterUpRight", high * 0.28);
    set(c, "eyeSquintLeft", low * 0.28 + dom * 0.12); set(c, "eyeSquintRight", low * 0.28 + dom * 0.12);
    set(c, "browDownLeft", dom * n * 0.48); set(c, "browDownRight", dom * n * 0.48);
    set(c, "mouthPressLeft", dom * n * 0.3); set(c, "mouthPressRight", dom * n * 0.3);
    this.rig.applyCoefficients(layer, c, time);
  }

  toJSON() { return { valence: this.valence, arousal: this.arousal, dominance: this.dominance, intensity: this.intensity }; }
  restore(data) { if (!data) return false; this.intensity = Math.max(0, Math.min(1, Number(data.intensity) || 0)); this.setPad(data.valence, data.arousal, data.dominance); return true; }
}

export { EMOTION_PRESETS };
