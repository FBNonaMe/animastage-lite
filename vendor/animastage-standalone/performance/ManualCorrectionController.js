export class ManualCorrectionController {
  constructor(facialRig, morphRegistry = null) {
    this.rig = facialRig;
    this.morphRegistry = morphRegistry;
    this.morphs = new Float32Array(facialRig.count);
    this.mode = "additive";
    this.listeners = new Set();
  }
  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  _emit(reason) { for (const listener of this.listeners) { try { listener(reason, this); } catch (_) {} } }
  setMorph(index, value) {
    if (!Number.isInteger(index) || index < 0 || index >= this.morphs.length) return false;
    const record = this.morphRegistry?.get?.(index);
    const min = Number.isFinite(record?.minValue) ? Math.min(-1, record.minValue) : -1;
    const max = Number.isFinite(record?.maxValue) ? Math.max(1, record.maxValue) : 1;
    this.morphs[index] = Math.max(min, Math.min(max, Number(value) || 0));
    this._emit(`morph:${index}`);
    return true;
  }
  resetMorphs() { this.morphs.fill(0); this._emit("reset"); }
  evaluate(layer, time) { this.rig.applyRawMorphs(layer, this.morphs, this.mode, time); }
  toJSON() { return { mode: this.mode, morphs: Array.from(this.morphs) }; }
  restore(data) { if (!data) return false; this.mode = data.mode === "override" ? "override" : "additive"; if (Array.isArray(data.morphs)) for (let i = 0; i < this.morphs.length; i++) this.setMorph(i, data.morphs[i]); return true; }
}
