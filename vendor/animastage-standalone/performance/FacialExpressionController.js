import { FACIAL_CHANNELS, FACIAL_CHANNEL_INDEX, createFacialBuffer, facialObjectToBuffer } from "./FacialChannels.js";

const expression = (channels, behavior = {}) => Object.freeze({ channels: Object.freeze(channels), behavior: Object.freeze(behavior) });

export const EXPRESSION_PRESETS = Object.freeze({
  neutral: expression({}, { blinkRate: 1, eyeContact: 0.65 }),
  soft_smile: expression({ mouthSmileLeft: 0.35, mouthSmileRight: 0.35, cheekSquintLeft: 0.1, cheekSquintRight: 0.1 }, { blinkRate: 0.9, eyeContact: 0.72 }),
  happy: expression({ mouthSmileLeft: 0.72, mouthSmileRight: 0.72, cheekSquintLeft: 0.35, cheekSquintRight: 0.35, browOuterUpLeft: 0.18, browOuterUpRight: 0.18 }, { blinkRate: 1.05, eyeContact: 0.75, headMotion: 0.25 }),
  laughing: expression({ mouthSmileLeft: 0.9, mouthSmileRight: 0.9, jawOpen: 0.55, eyeSquintLeft: 0.55, eyeSquintRight: 0.55, cheekSquintLeft: 0.5, cheekSquintRight: 0.5 }, { blinkRate: 0.7, headMotion: 0.42 }),
  shy: expression({ mouthSmileLeft: 0.24, mouthSmileRight: 0.32, cheekSquintLeft: 0.14, cheekSquintRight: 0.14, browInnerUp: 0.18 }, { blinkRate: 1.2, eyeContact: 0.35, gazeAvoidance: 0.7, headTilt: 0.35, fingerTension: 0.2 }),
  embarrassed: expression({ mouthSmileLeft: 0.28, mouthSmileRight: 0.2, cheekPuff: 0.32, browInnerUp: 0.28, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 }, { blinkRate: 1.35, eyeContact: 0.28, gazeAvoidance: 0.78 }),
  sad: expression({ mouthFrownLeft: 0.62, mouthFrownRight: 0.62, browInnerUp: 0.58, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 }, { blinkRate: 0.8, eyeContact: 0.25, headTilt: -0.18 }),
  crying: expression({ mouthFrownLeft: 0.78, mouthFrownRight: 0.78, browInnerUp: 0.82, eyeSquintLeft: 0.5, eyeSquintRight: 0.5, jawOpen: 0.18 }, { blinkRate: 1.5, eyeContact: 0.15 }),
  angry: expression({ browDownLeft: 0.82, browDownRight: 0.82, eyeSquintLeft: 0.38, eyeSquintRight: 0.38, mouthPressLeft: 0.5, mouthPressRight: 0.5 }, { blinkRate: 0.55, eyeContact: 0.92, tension: 0.8 }),
  annoyed: expression({ browDownLeft: 0.48, browDownRight: 0.42, eyeSquintLeft: 0.28, eyeSquintRight: 0.22, mouthFrownLeft: 0.24, mouthPressRight: 0.2 }, { blinkRate: 0.72, eyeContact: 0.6 }),
  surprised: expression({ eyeWideLeft: 0.86, eyeWideRight: 0.86, browInnerUp: 0.75, browOuterUpLeft: 0.58, browOuterUpRight: 0.58, jawOpen: 0.55 }, { blinkRate: 0.35, eyeContact: 0.9 }),
  frightened: expression({ eyeWideLeft: 0.72, eyeWideRight: 0.72, browInnerUp: 0.8, mouthStretchLeft: 0.35, mouthStretchRight: 0.35, jawOpen: 0.25 }, { blinkRate: 1.45, gazeAvoidance: 0.45, tension: 0.9 }),
  tired: expression({ eyeSquintLeft: 0.38, eyeSquintRight: 0.38, browInnerUp: 0.1, mouthFrownLeft: 0.1, mouthFrownRight: 0.1 }, { blinkRate: 0.7, slowBlink: 0.7, fatigue: 0.75 }),
  confident: expression({ mouthSmileLeft: 0.24, mouthSmileRight: 0.18, browOuterUpLeft: 0.18, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 }, { blinkRate: 0.72, eyeContact: 0.95, dominance: 0.75 }),
  suspicious: expression({ browDownLeft: 0.34, browOuterUpRight: 0.22, eyeSquintLeft: 0.38, eyeSquintRight: 0.15, mouthPressLeft: 0.18 }, { blinkRate: 0.62, gazeAvoidance: 0.2 }),
  disgusted: expression({ noseSneerLeft: 0.55, noseSneerRight: 0.45, browDownLeft: 0.42, browDownRight: 0.42, mouthFrownLeft: 0.45, mouthFrownRight: 0.45 }, { blinkRate: 0.75 }),
  sleepy: expression({ eyeSquintLeft: 0.62, eyeSquintRight: 0.62, jawOpen: 0.08 }, { blinkRate: 0.55, slowBlink: 1, fatigue: 0.95 }),
  romantic: expression({ mouthSmileLeft: 0.38, mouthSmileRight: 0.38, eyeSquintLeft: 0.16, eyeSquintRight: 0.16, cheekPuff: 0.12 }, { blinkRate: 0.82, eyeContact: 0.88, headTilt: 0.2 }),
  nervous: expression({ browInnerUp: 0.35, mouthStretchLeft: 0.16, mouthStretchRight: 0.12, mouthSmileLeft: 0.08, mouthSmileRight: 0.14 }, { blinkRate: 1.5, gazeAvoidance: 0.62, tension: 0.7, fingerTension: 0.35 }),
  determined: expression({ browDownLeft: 0.52, browDownRight: 0.52, eyeSquintLeft: 0.2, eyeSquintRight: 0.2, mouthPressLeft: 0.36, mouthPressRight: 0.36 }, { blinkRate: 0.58, eyeContact: 0.95, dominance: 0.7 }),
  empty: expression({ eyeWideLeft: 0.12, eyeWideRight: 0.12 }, { blinkRate: 0.55, eyeContact: 0.5, headMotion: 0.05 }),
  yandere: expression({ mouthSmileLeft: 0.5, mouthSmileRight: 0.5, eyeWideLeft: 0.48, eyeWideRight: 0.48, browDownLeft: 0.15, browDownRight: 0.15 }, { blinkRate: 0.45, eyeContact: 1, tension: 0.65 }),
  tsundere: expression({ browDownLeft: 0.42, browDownRight: 0.38, mouthFrownLeft: 0.18, mouthSmileRight: 0.16, cheekPuff: 0.18 }, { blinkRate: 0.82, eyeContact: 0.28, gazeAvoidance: 0.58 }),
  anime_smug: expression({ mouthSmileLeft: 0.42, mouthSmileRight: 0.18, eyeSquintLeft: 0.32, eyeSquintRight: 0.2, browOuterUpLeft: 0.2 }, { blinkRate: 0.6, eyeContact: 0.85, dominance: 0.8 }),
});

export class FacialExpressionController {
  constructor(rig) {
    this.rig = rig;
    this.preset = "neutral";
    this.intensity = 1;
    this.coefficients = createFacialBuffer();
    this.manual = createFacialBuffer();
    this.behavior = { ...EXPRESSION_PRESETS.neutral.behavior };
    this.listeners = new Set();
    this._rebuild();
  }

  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  _emit() { for (const listener of this.listeners) { try { listener(this); } catch (_) {} } }

  _rebuild() {
    facialObjectToBuffer(EXPRESSION_PRESETS[this.preset]?.channels || {}, this.coefficients);
    this.behavior = { ...(EXPRESSION_PRESETS[this.preset]?.behavior || {}) };
  }

  setPreset(name) { if (!EXPRESSION_PRESETS[name]) return false; this.preset = name; this._rebuild(); this._emit(); return true; }
  setIntensity(value) { this.intensity = Math.max(0, Math.min(1, Number(value) || 0)); this._emit(); }
  setChannel(name, value) { const index = FACIAL_CHANNEL_INDEX[name]; if (index === undefined) return false; this.manual[index] = Math.max(-1, Math.min(1, Number(value) || 0)); this._emit(); return true; }
  resetManual() { this.manual.fill(0); this._emit(); }

  evaluate(layer, time) {
    const keyedIntensity = layer?.tracks?.has("expression.intensity")
      ? layer.sample("expression.intensity", time, this.intensity)
      : this.intensity;
    for (let i = 0; i < this.coefficients.length; i++) {
      const fallback = this.coefficients[i] * keyedIntensity + this.manual[i];
      const channel = `channel.${FACIAL_CHANNELS[i]}`;
      this.coefficients[i] = layer?.tracks?.has(channel) ? layer.sample(channel, time, fallback) : fallback;
    }
    this.rig.applyCoefficients(layer, this.coefficients, time);
    this._rebuild();
  }

  toJSON() { return { preset: this.preset, intensity: this.intensity, manual: Array.from(this.manual) }; }
  restore(data) {
    if (!data) return false;
    this.setPreset(EXPRESSION_PRESETS[data.preset] ? data.preset : "neutral");
    this.intensity = Math.max(0, Math.min(1, Number(data.intensity) || 0));
    if (Array.isArray(data.manual)) for (let i = 0; i < this.manual.length; i++) this.manual[i] = Number(data.manual[i]) || 0;
    return true;
  }
}
