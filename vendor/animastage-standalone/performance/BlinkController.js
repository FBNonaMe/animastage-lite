import { FACIAL_CHANNEL_INDEX, createFacialBuffer } from "./FacialChannels.js";

function xorshift32(state) {
  let x = state | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return x >>> 0;
}

export class BlinkController {
  constructor(rig, seed = 0x41c64e6d) {
    this.rig = rig;
    this.enabled = true;
    this.auto = true;
    this.rate = 1;
    this.strength = 1;
    this.seed = seed >>> 0;
    this.randomState = this.seed || 1;
    this.clock = 0;
    this.nextBlink = 2.4;
    this.phase = -1;
    this.duration = 0.16;
    this.hold = 0.025;
    this.side = "both";
    this.pendingDouble = false;
    this.behavior = { blinkRate: 1, fatigue: 0, tension: 0 };
    this.coefficients = createFacialBuffer();
    this.listeners = new Set();
    this._schedule();
  }

  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  _emit() { for (const listener of this.listeners) { try { listener(this); } catch (_) {} } }
  _random() { this.randomState = xorshift32(this.randomState); return this.randomState / 0xffffffff; }

  _schedule(short = false) {
    const effectiveRate = Math.max(0.25, this.rate * (this.behavior.blinkRate || 1));
    const dryness = 0.78 + this._random() * 0.55;
    const base = short ? 0.12 + this._random() * 0.12 : (3.5 * dryness) / effectiveRate;
    this.nextBlink = this.clock + base;
  }

  setBehavior(behavior) {
    if (!behavior) return;
    if (Number.isFinite(behavior.blinkRate)) this.behavior.blinkRate = behavior.blinkRate;
    if (Number.isFinite(behavior.fatigue)) this.behavior.fatigue = behavior.fatigue;
    if (Number.isFinite(behavior.tension)) this.behavior.tension = behavior.tension;
  }
  setRate(value) { this.rate = Math.max(0.1, Math.min(3, Number(value) || 1)); this._schedule(); this._emit(); }

  trigger(type = "normal") {
    this.phase = 0;
    this.side = type === "winkLeft" ? "left" : type === "winkRight" ? "right" : "both";
    const fatigue = Math.max(0, Math.min(1, this.behavior.fatigue || 0));
    this.duration = type === "slow" ? 0.42 : type === "half" ? 0.2 : 0.15 + fatigue * 0.14;
    this.hold = type === "slow" ? 0.12 : 0.02 + fatigue * 0.04;
    this.strength = type === "half" ? 0.5 : 1;
    this.pendingDouble = type === "double";
    this._emit();
  }

  evaluate(layer, deltaTime, time) {
    if (!this.enabled) return;
    const dt = Math.max(0, Math.min(0.1, Number(deltaTime) || 0));
    this.clock += dt;
    if (this.auto && this.phase < 0 && this.clock >= this.nextBlink) this.trigger(this.behavior.fatigue > 0.7 && this._random() < 0.35 ? "slow" : "normal");
    this.coefficients.fill(0);
    if (this.phase >= 0) {
      this.phase += dt;
      const close = this.duration * 0.38;
      const openStart = close + this.hold;
      let value;
      if (this.phase < close) { const u = this.phase / close; value = u * u * (3 - 2 * u); }
      else if (this.phase < openStart) value = 1;
      else { const u = (this.phase - openStart) / Math.max(1e-4, this.duration - openStart); value = 1 - u * u * (3 - 2 * u); }
      value = Math.max(0, Math.min(1, value)) * this.strength;
      if (this.side !== "right") this.coefficients[FACIAL_CHANNEL_INDEX.eyeBlinkLeft] = value;
      if (this.side !== "left") this.coefficients[FACIAL_CHANNEL_INDEX.eyeBlinkRight] = value;
      if (this.phase >= this.duration) {
        this.phase = -1;
        if (this.pendingDouble) { this.pendingDouble = false; this._schedule(true); }
        else if (this.auto && this.behavior.tension > 0.55 && this._random() < 0.2) this._schedule(true);
        else this._schedule();
      }
    }
    if (layer?.tracks?.has("blink.left")) this.coefficients[FACIAL_CHANNEL_INDEX.eyeBlinkLeft] = Math.max(this.coefficients[FACIAL_CHANNEL_INDEX.eyeBlinkLeft], layer.sample("blink.left", time, 0));
    if (layer?.tracks?.has("blink.right")) this.coefficients[FACIAL_CHANNEL_INDEX.eyeBlinkRight] = Math.max(this.coefficients[FACIAL_CHANNEL_INDEX.eyeBlinkRight], layer.sample("blink.right", time, 0));
    this.rig.applyCoefficients(layer, this.coefficients, time);
  }

  /** Runtime-only state for deterministic render transactions. */
  captureTransientState() {
    return {
      randomState: this.randomState >>> 0,
      clock: this.clock,
      nextBlink: this.nextBlink,
      phase: this.phase,
      duration: this.duration,
      hold: this.hold,
      side: this.side,
      pendingDouble: this.pendingDouble,
      strength: this.strength,
      behavior: { ...this.behavior },
      coefficients: Float32Array.from(this.coefficients),
    };
  }

  restoreTransientState(state) {
    if (!state) return false;
    this.randomState = (Number(state.randomState) >>> 0) || 1;
    this.clock = Number(state.clock) || 0;
    this.nextBlink = Number(state.nextBlink) || 0;
    this.phase = Number.isFinite(Number(state.phase)) ? Number(state.phase) : -1;
    this.duration = Math.max(0, Number(state.duration) || 0);
    this.hold = Math.max(0, Number(state.hold) || 0);
    this.side = ["left", "right", "both"].includes(state.side) ? state.side : "both";
    this.pendingDouble = !!state.pendingDouble;
    this.strength = Math.max(0, Number(state.strength) || 0);
    Object.assign(this.behavior, state.behavior || {});
    this.coefficients.fill(0);
    if (state.coefficients) this.coefficients.set(state.coefficients.subarray?.(0, this.coefficients.length) || state.coefficients);
    return true;
  }

  resetTransientState() {
    this.randomState = this.seed || 1;
    this.clock = 0;
    this.phase = -1;
    this.duration = 0.16;
    this.hold = 0.025;
    this.side = "both";
    this.pendingDouble = false;
    this.strength = 1;
    this.behavior = { blinkRate: 1, fatigue: 0, tension: 0 };
    this.coefficients.fill(0);
    this._schedule();
  }

  toJSON() { return { enabled: this.enabled, auto: this.auto, rate: this.rate, seed: this.seed }; }
  restore(data) { if (!data) return false; this.enabled = data.enabled !== false; this.auto = data.auto !== false; this.rate = Math.max(0.1, Math.min(3, Number(data.rate) || 1)); this.seed = Number(data.seed) >>> 0; this.randomState = this.seed || 1; this.clock = 0; this.phase = -1; this._schedule(); return true; }
}
