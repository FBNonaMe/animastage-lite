import { FACIAL_CHANNELS, FACIAL_CHANNEL_INDEX, createFacialBuffer } from "./FacialChannels.js";

const GRAPH = Object.freeze({
  eyeBlinkLeft: [["blinkLeft", 1], ["blink", 0.5]],
  eyeBlinkRight: [["blinkRight", 1], ["blink", 0.5]],
  eyeWideLeft: [["eyeWideLeft", 0.85], ["eyeWide", 0.425]], eyeWideRight: [["eyeWideRight", 0.85], ["eyeWide", 0.425]],
  eyeSquintLeft: [["eyeSquintLeft", 0.7], ["eyeSquint", 0.35], ["smile", 0.12]], eyeSquintRight: [["eyeSquintRight", 0.7], ["eyeSquint", 0.35], ["smile", 0.12]],
  irisSizeLeft: [["irisLargeLeft", 1], ["irisSmallLeft", -1], ["irisLarge", 0.5], ["irisSmall", -0.5]],
  irisSizeRight: [["irisLargeRight", 1], ["irisSmallRight", -1], ["irisLarge", 0.5], ["irisSmall", -0.5]],
  pupilSizeLeft: [["pupilLargeLeft", 1], ["pupilSmallLeft", -1], ["pupilLarge", 0.5], ["pupilSmall", -0.5]],
  pupilSizeRight: [["pupilLargeRight", 1], ["pupilSmallRight", -1], ["pupilLarge", 0.5], ["pupilSmall", -0.5]],
  corneaRadiusLeft: [["corneaLargeLeft", 1], ["corneaSmallLeft", -1], ["corneaLarge", 0.5], ["corneaSmall", -0.5]],
  corneaRadiusRight: [["corneaLargeRight", 1], ["corneaSmallRight", -1], ["corneaLarge", 0.5], ["corneaSmall", -0.5]],
  eyeHighlightLeft: [["eyeHighlightOnLeft", 1], ["eyeHighlightOffLeft", -1], ["eyeHighlightOn", 0.5], ["eyeHighlightOff", -0.5]],
  eyeHighlightRight: [["eyeHighlightOnRight", 1], ["eyeHighlightOffRight", -1], ["eyeHighlightOn", 0.5], ["eyeHighlightOff", -0.5]],
  browInnerUp: [["browUp", 0.82], ["sad", 0.18]],
  browOuterUpLeft: [["browUp", 0.55]], browOuterUpRight: [["browUp", 0.55]],
  browDownLeft: [["browDown", 0.62], ["angry", 0.22]], browDownRight: [["browDown", 0.62], ["angry", 0.22]],
  cheekPuff: [["cheek", 0.9]], cheekSquintLeft: [["cheek", 0.42], ["smile", 0.12]], cheekSquintRight: [["cheek", 0.42], ["smile", 0.12]],
  jawOpen: [["mouthA", 0.58], ["mouthO", 0.28]],
  mouthClose: [["mouthA", -0.3], ["mouthO", -0.3]],
  mouthFunnel: [["mouthO", 0.72], ["mouthU", 0.28]], mouthPucker: [["mouthU", 0.85], ["mouthO", 0.18]],
  mouthSmileLeft: [["smile", 0.52], ["mouthCorner", 0.55], ["cheek", 0.16]],
  mouthSmileRight: [["smile", 0.52], ["mouthCorner", 0.55], ["cheek", 0.16]],
  mouthFrownLeft: [["sad", 0.5], ["mouthCorner", -0.32]], mouthFrownRight: [["sad", 0.5], ["mouthCorner", -0.32]],
  mouthDimpleLeft: [["mouthCorner", 0.32]], mouthDimpleRight: [["mouthCorner", 0.32]],
  mouthStretchLeft: [["mouthI", 0.42]], mouthStretchRight: [["mouthI", 0.42]],
  mouthPressLeft: [["angry", 0.18], ["mouthA", -0.18]], mouthPressRight: [["angry", 0.18], ["mouthA", -0.18]],
  mouthUpperUpLeft: [["mouthA", 0.2]], mouthUpperUpRight: [["mouthA", 0.2]],
  mouthLowerDownLeft: [["mouthA", 0.28]], mouthLowerDownRight: [["mouthA", 0.28]],
  tongueOut: [["tongue", 1]],
  visemeA: [["mouthA", 1]], visemeI: [["mouthI", 1]], visemeU: [["mouthU", 1]], visemeE: [["mouthE", 1]], visemeO: [["mouthO", 1]],
  visemeClosed: [["mouthA", -0.45], ["mouthI", -0.4], ["mouthU", -0.4], ["mouthE", -0.4], ["mouthO", -0.45]],
});

export class UniversalFacialRig {
  constructor(mesh, profile, morphRegistry = null) {
    this.mesh = mesh;
    this.profile = profile;
    this.morphRegistry = morphRegistry;
    this.influences = mesh?.morphTargetInfluences || [];
    this.count = this.influences.length;
    this.base = new Float32Array(this.count);
    this.work = new Float32Array(this.count);
    this.applied = new Float32Array(this.count);
    this.wasApplied = new Uint8Array(this.count);
    this.compiled = Array.from({ length: FACIAL_CHANNELS.length }, () => []);
    this.prepared = false;
    this._compile();
  }

  _compile() {
    for (const [channel, edges] of Object.entries(GRAPH)) {
      const channelIndex = FACIAL_CHANNEL_INDEX[channel];
      if (channelIndex === undefined) continue;
      const seen = new Set();
      for (const [role, graphWeight] of edges) {
        const suffix = channel.endsWith("Left") ? "Left" : channel.endsWith("Right") ? "Right" : "";
        if (suffix) {
          const specificRole = role === "blink" ? `blink${suffix}` : `${role}${suffix}`;
          if (!role.endsWith(suffix) && this.profile?.morphs?.[specificRole]?.length) continue;
        }
        for (const binding of this.profile?.morphs?.[role] || []) {
          const index = binding.targetMorphIndex;
          if (!Number.isInteger(index) || index < 0 || index >= this.count || seen.has(index)) continue;
          seen.add(index);
          this.compiled[channelIndex].push({ index, weight: graphWeight * (Number(binding.weight) || 1), confidence: binding.confidence });
        }
      }
    }
  }

  _clamp(index, value) {
    const record = this.morphRegistry?.get?.(index);
    const min = Number.isFinite(record?.minValue) ? record.minValue : 0;
    const max = Number.isFinite(record?.maxValue) ? record.maxValue : 1;
    return Math.max(min, Math.min(max, value));
  }

  _blend(index, contribution, layerWeight, blendMode) {
    if (blendMode === "override") this.work[index] += (contribution - this.work[index]) * layerWeight;
    else if (blendMode === "maximum") this.work[index] = Math.max(this.work[index], contribution * layerWeight);
    else if (blendMode === "multiply") this.work[index] *= 1 + contribution * layerWeight;
    else this.work[index] += contribution * layerWeight;
  }

  beginFrame() {
    for (let i = 0; i < this.count; i++) {
      if (this.wasApplied[i] && Math.abs((this.influences[i] || 0) - this.applied[i]) < 1e-5) this.influences[i] = this.base[i];
      this.wasApplied[i] = 0;
    }
    this.prepared = false;
  }

  prepareFrame() {
    if (this.prepared) return;
    for (let i = 0; i < this.count; i++) this.base[i] = this.work[i] = Number(this.influences[i]) || 0;
    this.prepared = true;
  }

  applyCoefficients(layer, coefficients, time = 0) {
    this.prepareFrame();
    const layerWeight = Math.max(0, Math.min(1, layer?.weight ?? 1));
    for (let channelIndex = 0; channelIndex < this.compiled.length; channelIndex++) {
      const edges = this.compiled[channelIndex];
      if (!edges.length) continue;
      const channelName = FACIAL_CHANNELS[channelIndex];
      let value = Number(coefficients[channelIndex]) || 0;
      if (layer?.tracks?.has(channelName)) value = layer.sample(channelName, time, value);
      if (Math.abs(value) < 1e-6) continue;
      for (const edge of edges) {
        if (layer?.morphMask?.size && !layer.morphMask.has(edge.index) && !layer.morphMask.has(channelName)) continue;
        const contribution = value * edge.weight;
        this._blend(edge.index, contribution, layerWeight, layer?.blendMode);
      }
    }
    for (let i = 0; i < this.count; i++) {
      const next = this._clamp(i, this.work[i]);
      if (Math.abs(next - this.base[i]) < 1e-7) continue;
      this.influences[i] = next;
      this.wasApplied[i] = 1;
    }
  }

  applyRawMorphs(layer, corrections, mode = "additive", time = 0) {
    this.prepareFrame();
    const layerWeight = Math.max(0, Math.min(1, layer?.weight ?? 1));
    for (let i = 0; i < this.count; i++) {
      const channel = `rawMorph.${i}`;
      let value = Number(corrections?.[i]) || 0;
      if (layer?.tracks?.has(channel)) value = layer.sample(channel, time, value);
      if (Math.abs(value) < 1e-7) continue;
      if (layer?.morphMask?.size && !layer.morphMask.has(i) && !layer.morphMask.has(channel)) continue;
      this._blend(i, value, layerWeight, mode === "override" ? "override" : layer?.blendMode);
    }
    for (let i = 0; i < this.count; i++) {
      const next = this._clamp(i, this.work[i]);
      if (Math.abs(next - this.base[i]) < 1e-7) continue;
      this.influences[i] = next; this.wasApplied[i] = 1;
    }
  }

  finishFrame() {
    if (!this.prepared) return;
    for (let i = 0; i < this.count; i++) if (this.wasApplied[i]) this.applied[i] = Number(this.influences[i]) || 0;
  }

  supportedChannels() {
    const output = [];
    for (let i = 0; i < this.compiled.length; i++) if (this.compiled[i].length) output.push(FACIAL_CHANNELS[i]);
    return output;
  }

  projectCoefficients(coefficients, output) {
    output.fill(0);
    for (let channelIndex = 0; channelIndex < this.compiled.length; channelIndex++) {
      const value = Number(coefficients[channelIndex]) || 0;
      if (Math.abs(value) < 1e-7) continue;
      for (const edge of this.compiled[channelIndex]) output[edge.index] += value * edge.weight;
    }
    for (let i = 0; i < output.length; i++) output[i] = this._clamp(i, output[i]);
    return output;
  }

  createBuffer() { return createFacialBuffer(); }
}
