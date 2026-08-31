import { PERFORMANCE_LAYER_ORDER } from "./PerformanceConstants.js";
import { PerformanceLayer } from "./PerformanceLayer.js";

const LABELS = Object.freeze({
  handPose: "Hand Pose",
  fingerProcedural: "Finger Procedural",
  facialBase: "Facial Base",
  emotion: "Emotion",
  speech: "Speech / Viseme",
  eyeAppearance: "Eye Appearance",
  gaze: "Eyes & Gaze",
  blink: "Blink",
  microExpression: "Micro Expression",
  capture: "Webcam Capture",
  manualCorrection: "Manual Correction",
});

export class PerformanceStack {
  constructor() {
    this.layers = PERFORMANCE_LAYER_ORDER.map((id) => new PerformanceLayer(id, { label: LABELS[id] }));
    this.byId = new Map(this.layers.map((layer) => [layer.id, layer]));
    this.evaluators = new Map();
  }

  get(id) { return this.byId.get(id) || null; }

  setEvaluator(id, evaluator) {
    if (!this.byId.has(id)) throw new Error(`Unknown performance layer: ${id}`);
    if (typeof evaluator !== "function") this.evaluators.delete(id);
    else this.evaluators.set(id, evaluator);
  }

  evaluate(deltaTime, time) {
    let hasSolo = false;
    for (const layer of this.layers) if (layer.solo && layer.enabled && !layer.muted) { hasSolo = true; break; }
    for (const layer of this.layers) {
      if (!layer.enabled || layer.muted || layer.weight <= 0 || (hasSolo && !layer.solo)) continue;
      const evaluator = this.evaluators.get(layer.id);
      if (evaluator) evaluator(layer, deltaTime, time);
    }
  }

  reset() { for (const layer of this.layers) layer.reset(); }

  toJSON() { return this.layers.map((layer) => layer.toJSON()); }

  restore(data) {
    if (!Array.isArray(data)) return false;
    for (const item of data) this.byId.get(item?.id)?.restore(item);
    return true;
  }
}
