import * as THREE from "../vendor/three/build/three.module.js";
import { FACIAL_CHANNEL_INDEX, createFacialBuffer } from "./FacialChannels.js";

const PHONEME_TO_CHANNELS = Object.freeze({
  A: [["visemeA", 1]], AA: [["visemeA", 1]], AH: [["visemeA", 0.9]],
  I: [["visemeI", 1]], IH: [["visemeI", 0.85]], Y: [["visemeI", 0.65]],
  U: [["visemeU", 1]], UW: [["visemeU", 1]],
  E: [["visemeE", 1]], EH: [["visemeE", 0.9]],
  O: [["visemeO", 1]], OH: [["visemeO", 0.95]],
  M: [["visemeClosed", 1]], B: [["visemeClosed", 1]], P: [["visemeClosed", 1]],
  F: [["visemeI", 0.35], ["mouthLowerDownLeft", 0.2], ["mouthLowerDownRight", 0.2]],
  V: [["visemeI", 0.35], ["mouthLowerDownLeft", 0.2], ["mouthLowerDownRight", 0.2]],
  L: [["visemeA", 0.25], ["visemeI", 0.2]],
  S: [["visemeI", 0.38]], Z: [["visemeI", 0.38]],
  T: [["visemeI", 0.26], ["visemeA", 0.12]], D: [["visemeI", 0.26], ["visemeA", 0.12]],
  K: [["visemeA", 0.3]], G: [["visemeA", 0.3]], R: [["visemeO", 0.32], ["visemeA", 0.18]],
  CH: [["visemeI", 0.35], ["visemeU", 0.28]], J: [["visemeI", 0.35], ["visemeU", 0.28]], SH: [["visemeI", 0.35], ["visemeU", 0.28]],
  REST: [["visemeClosed", 0.15]], CLOSED: [["visemeClosed", 1]],
});

function normalizePhoneme(value) { return String(value || "REST").trim().toUpperCase().replace(/[^A-Z]/g, "") || "REST"; }

function sampleKeys(keys, time) {
  if (!keys?.length || time < keys[0].time || time > keys[keys.length - 1].time) return 0;
  if (keys.length === 1) return keys[0].value;
  let lo = 0, hi = keys.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (keys[mid].time <= time) lo = mid; else hi = mid; }
  const a = keys[lo], b = keys[hi];
  const u = (time - a.time) / Math.max(1e-7, b.time - a.time);
  const smooth = u * u * (3 - 2 * u);
  return a.value + (b.value - a.value) * smooth;
}

function reduceNumericKeys(keys, tolerance) {
  if (keys.length < 3) return keys;
  const output = [keys[0]];
  for (let i = 1; i < keys.length - 1; i++) {
    const a = output[output.length - 1], b = keys[i], c = keys[i + 1];
    const u = (b.time - a.time) / Math.max(1e-7, c.time - a.time);
    const expected = a.value + (c.value - a.value) * u;
    if (Math.abs(expected - b.value) > tolerance || (b.important && !a.important)) output.push(b);
  }
  output.push(keys[keys.length - 1]);
  return output;
}

export class LipSyncController {
  constructor(rig) {
    this.rig = rig;
    this.enabled = true;
    this.intensity = 0.82;
    this.attack = 0.075;
    this.release = 0.11;
    this.keyReduction = 0.025;
    this.duration = 0;
    this.tracks = new Map();
    this.coefficients = createFacialBuffer();
    this.morphScratch = new Float32Array(rig.count);
    this.waveform = new Float32Array(0);
    this.previewPlaying = false;
    this.previewTime = 0;
    this.listeners = new Set();
  }

  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  _emit(reason) { for (const listener of this.listeners) { try { listener(reason, this); } catch (_) {} } }
  clear() { this.tracks.clear(); this.duration = 0; this.previewPlaying = false; this.previewTime = 0; this.waveform = new Float32Array(0); this._emit("clear"); }

  setPhonemeTimeline(events, options = {}) {
    this.tracks.clear();
    const attack = Math.max(0.01, Number(options.attack ?? this.attack));
    const release = Math.max(0.01, Number(options.release ?? this.release));
    this.duration = 0;
    for (const event of events || []) {
      const time = Math.max(0, Number(event.time) || 0);
      const eventDuration = Math.max(0.025, Number(event.duration) || 0.1);
      const strength = Math.max(0, Math.min(1.5, Number(event.strength) || 1));
      const mapping = PHONEME_TO_CHANNELS[normalizePhoneme(event.phoneme)] || PHONEME_TO_CHANNELS.REST;
      for (const [channel, weight] of mapping) {
        let keys = this.tracks.get(channel); if (!keys) { keys = []; this.tracks.set(channel, keys); }
        keys.push({ time: Math.max(0, time - attack), value: 0 });
        keys.push({ time, value: strength * weight, important: /M|B|P|F|V/.test(normalizePhoneme(event.phoneme)) });
        keys.push({ time: time + eventDuration, value: strength * weight });
        keys.push({ time: time + eventDuration + release, value: 0 });
      }
      this.duration = Math.max(this.duration, time + eventDuration + release);
    }
    for (const [channel, keys] of this.tracks) {
      keys.sort((a, b) => a.time - b.time || b.value - a.value);
      const merged = [];
      for (const key of keys) {
        const last = merged[merged.length - 1];
        if (last && Math.abs(last.time - key.time) < 1e-5) { if (key.value > last.value) Object.assign(last, key); }
        else merged.push(key);
      }
      this.tracks.set(channel, reduceNumericKeys(merged, this.keyReduction));
    }
    this._emit("phonemes"); return this.tracks.size > 0;
  }

  analyzeAmplitude(samples, sampleRate, options = {}) {
    if (!(samples instanceof Float32Array) || !samples.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return false;
    const frameSize = Math.max(32, Math.round(sampleRate * (options.windowSeconds || 0.02)));
    const hop = Math.max(16, Math.round(frameSize * 0.5));
    const frameCount = Math.max(1, Math.floor((samples.length - frameSize) / hop) + 1);
    const amplitude = new Float32Array(frameCount);
    let peak = 1e-6;
    for (let frame = 0; frame < frameCount; frame++) {
      let sum = 0; const start = frame * hop;
      for (let i = 0; i < frameSize && start + i < samples.length; i++) { const value = samples[start + i]; sum += value * value; }
      const rms = Math.sqrt(sum / frameSize); amplitude[frame] = rms; peak = Math.max(peak, rms);
    }
    const noiseFloor = peak * 0.06;
    const keys = [];
    let smoothed = 0;
    for (let frame = 0; frame < frameCount; frame++) {
      const normalized = Math.max(0, (amplitude[frame] - noiseFloor) / Math.max(1e-6, peak - noiseFloor));
      smoothed += (normalized - smoothed) * (normalized > smoothed ? 0.62 : 0.28);
      keys.push({ time: (frame * hop) / sampleRate, value: Math.pow(smoothed, 0.72) });
    }
    this.tracks.clear(); this.tracks.set("jawOpen", reduceNumericKeys(keys, this.keyReduction));
    this.tracks.set("visemeA", reduceNumericKeys(keys.map((key) => ({ time: key.time, value: key.value * 0.72 })), this.keyReduction));
    this.duration = samples.length / sampleRate;
    const waveformSize = Math.min(2048, Math.max(128, Math.ceil(this.duration * 60)));
    this.waveform = new Float32Array(waveformSize);
    const stride = samples.length / waveformSize;
    for (let i = 0; i < waveformSize; i++) {
      const from = Math.floor(i * stride), to = Math.min(samples.length, Math.floor((i + 1) * stride)); let value = 0;
      for (let j = from; j < to; j++) value = Math.max(value, Math.abs(samples[j])); this.waveform[i] = value;
    }
    this._emit("amplitude"); return true;
  }

  playPreview() { this.previewTime = 0; this.previewPlaying = true; }
  stopPreview() { this.previewPlaying = false; this.previewTime = 0; }

  sample(time, output = this.coefficients) {
    output.fill(0);
    for (const [channel, keys] of this.tracks) { const index = FACIAL_CHANNEL_INDEX[channel]; if (index !== undefined) output[index] = sampleKeys(keys, time) * this.intensity; }
    return output;
  }

  evaluate(layer, deltaTime, time) {
    if (!this.enabled || !this.tracks.size) return;
    let sampleTime = time;
    if (this.previewPlaying) { this.previewTime += Math.max(0, Math.min(0.1, Number(deltaTime) || 0)); sampleTime = this.previewTime; if (this.previewTime > this.duration) this.stopPreview(); }
    this.rig.applyCoefficients(layer, this.sample(sampleTime), sampleTime);
  }

  buildMorphClip(name = "Lip Sync", fps = 30) {
    if (!this.duration || !this.tracks.size || !this.rig.count) return null;
    const frames = Math.ceil(this.duration * fps) + 1;
    const times = new Float32Array(frames);
    const values = Array.from({ length: this.rig.count }, () => new Float32Array(frames));
    for (let frame = 0; frame < frames; frame++) {
      const time = Math.min(this.duration, frame / fps); times[frame] = time;
      this.rig.projectCoefficients(this.sample(time), this.morphScratch);
      for (let morph = 0; morph < this.rig.count; morph++) values[morph][frame] = this.morphScratch[morph];
    }
    const tracks = [];
    for (let morph = 0; morph < values.length; morph++) {
      let nonZero = false; for (let frame = 0; frame < frames; frame++) if (values[morph][frame] > 1e-5) { nonZero = true; break; }
      if (nonZero) tracks.push(new THREE.NumberKeyframeTrack(`.morphTargetInfluences[${morph}]`, times, values[morph]));
    }
    return tracks.length ? new THREE.AnimationClip(name, this.duration, tracks) : null;
  }

  captureTransientState() {
    return {
      previewPlaying: this.previewPlaying,
      previewTime: this.previewTime,
      coefficients: Float32Array.from(this.coefficients),
      morphScratch: Float32Array.from(this.morphScratch),
    };
  }
  restoreTransientState(state) {
    if (!state) return false;
    this.previewPlaying = !!state.previewPlaying;
    this.previewTime = Math.max(0, Number(state.previewTime) || 0);
    this.coefficients.fill(0); this.morphScratch.fill(0);
    if (state.coefficients) this.coefficients.set(state.coefficients.subarray?.(0, this.coefficients.length) || state.coefficients);
    if (state.morphScratch) this.morphScratch.set(state.morphScratch.subarray?.(0, this.morphScratch.length) || state.morphScratch);
    return true;
  }
  resetTransientState() {
    this.previewPlaying = false;
    this.previewTime = 0;
    this.coefficients.fill(0); this.morphScratch.fill(0);
  }

  toJSON() { return { enabled: this.enabled, intensity: this.intensity, attack: this.attack, release: this.release, duration: this.duration, tracks: Object.fromEntries(this.tracks), waveform: Array.from(this.waveform) }; }
  restore(data) { if (!data) return false; this.enabled = data.enabled !== false; this.intensity = Math.max(0, Math.min(1.5, Number(data.intensity) || 0)); this.attack = Math.max(0.01, Number(data.attack) || 0.075); this.release = Math.max(0.01, Number(data.release) || 0.11); this.duration = Math.max(0, Number(data.duration) || 0); this.tracks.clear(); for (const [channel, keys] of Object.entries(data.tracks || {})) this.tracks.set(channel, (keys || []).map((key) => ({ time: Number(key.time) || 0, value: Number(key.value) || 0, important: !!key.important }))); this.waveform = Float32Array.from(data.waveform || []); return true; }
}

export { PHONEME_TO_CHANNELS, reduceNumericKeys };
