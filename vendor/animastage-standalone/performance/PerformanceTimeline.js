import { FACIAL_CHANNELS } from "./FacialChannels.js";
import { FINGER_NAMES } from "./PerformanceConstants.js";
import { MASTER_KEYS } from "./HandPresetLibrary.js";

function cloneJSON(value) { return JSON.parse(JSON.stringify(value)); }

const HAND_LAYER_IDS = new Set(["handPose", "fingerProcedural"]);
const FACE_LAYER_IDS = new Set([
  "facialBase", "emotion", "speech", "eyeAppearance", "gaze", "blink",
  "microExpression", "capture", "manualCorrection",
]);

export class PerformanceTimeline {
  constructor(runtime, options = {}) {
    this.runtime = runtime;
    this.getBridge = options.getTimelineBridge || (() => null);
    this.undoStack = [];
    this.redoStack = [];
    this.clipboard = null;
    this.maxUndo = 60;
    this._restoring = false;
    this._faceAutoKey = false;
    this._handAutoKey = false;
    this.listeners = new Set();
    this._unsub = [
      runtime.hands.onChange((reason, hands) => {
        const side = String(reason).includes(":right:") ? "right" : String(reason).includes(":left:") ? "left" : "both";
        if (!this._restoring && this.handAutoKeyEnabled()) this.keyHand(hands.state.symmetry ? "both" : side, false);
      }),
      runtime.expressions.onChange(() => { if (!this._restoring && this.faceAutoKeyEnabled()) this.keyFace(false); }),
      runtime.emotions.onChange(() => { if (!this._restoring && this.faceAutoKeyEnabled()) this.keyEmotion(false); }),
    ];
    if (runtime.manualCorrections?.onChange) this._unsub.push(runtime.manualCorrections.onChange((reason) => {
      if (this._restoring || !this.faceAutoKeyEnabled()) return;
      const influenceIndex = Number(String(reason).match(/^morph:(\d+)$/)?.[1]);
      const record = Number.isInteger(influenceIndex)
        ? runtime.morphRegistry?.records?.find?.((item) => item.targetInfluenceIndex === influenceIndex)
        : null;
      if (record) this.keyMorph(record.index, null, false);
      else this.keyCurrentMorphs(false);
    }));
  }

  dispose() { for (const unsubscribe of this._unsub) unsubscribe?.(); this._unsub.length = 0; this.listeners.clear(); }
  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  _emit(reason = "changed") { for (const listener of this.listeners) { try { listener(reason, this); } catch (_) {} } }
  bridge() { try { return this.getBridge?.() || null; } catch (_) { return null; } }
  time() { return Math.max(0, Number(this.bridge()?.time?.()) || 0); }
  autoKeyEnabled(scope = "all") {
    if (scope === "face") return this.faceAutoKeyEnabled();
    if (scope === "hand" || scope === "hands" || scope === "fingers") return this.handAutoKeyEnabled();
    return this.faceAutoKeyEnabled() || this.handAutoKeyEnabled();
  }
  faceAutoKeyEnabled() { return !!this._faceAutoKey; }
  handAutoKeyEnabled() { return !!this._handAutoKey; }
  setFaceAutoKey(value) { this._faceAutoKey = !!value; this._emit("face-auto-key"); return this._faceAutoKey; }
  setHandAutoKey(value) { this._handAutoKey = !!value; this._emit("hand-auto-key"); return this._handAutoKey; }
  setAutoKey(scope, value) {
    if (scope === "face") return this.setFaceAutoKey(value);
    if (scope === "hand" || scope === "hands" || scope === "fingers") return this.setHandAutoKey(value);
    this.setFaceAutoKey(value); return this.setHandAutoKey(value);
  }
  toJSON() { return { faceAutoKey: this._faceAutoKey, handAutoKey: this._handAutoKey }; }
  restore(data) {
    if (!data) return false;
    this._faceAutoKey = !!data.faceAutoKey;
    this._handAutoKey = !!data.handAutoKey;
    this._emit("settings-restored");
    return true;
  }

  _snapshot() {
    return {
      layers: this.runtime.stack.toJSON(),
      hands: this.runtime.hands.toJSON(), expressions: this.runtime.expressions.toJSON(), emotions: this.runtime.emotions.toJSON(),
      gaze: this.runtime.gaze.toJSON(), blink: this.runtime.blink?.toJSON?.(), microExpressions: this.runtime.microExpressions?.toJSON?.(),
      eyeAppearance: this.runtime.eyeAppearance?.toJSON?.(),
      manualCorrections: this.runtime.manualCorrections?.toJSON?.(), autoGrip: this.runtime.autoGrip?.toJSON?.(),
      morphRegistry: this.runtime.morphRegistry?.toJSON?.(),
    };
  }
  _restoreSnapshot(snapshot) {
    if (Array.isArray(snapshot)) return this.runtime.stack.restore(snapshot);
    this.runtime.stack.restore(snapshot?.layers);
    this.runtime.hands.restore(snapshot?.hands); this.runtime.expressions.restore(snapshot?.expressions); this.runtime.emotions.restore(snapshot?.emotions);
    this.runtime.gaze.restore(snapshot?.gaze); this.runtime.blink?.restore?.(snapshot?.blink); this.runtime.microExpressions?.restore?.(snapshot?.microExpressions);
    this.runtime.eyeAppearance?.restore?.(snapshot?.eyeAppearance);
    this.runtime.manualCorrections?.restore?.(snapshot?.manualCorrections); this.runtime.autoGrip?.restore?.(snapshot?.autoGrip);
    this.runtime.morphRegistry?.restore?.(snapshot?.morphRegistry);
    return true;
  }
  _pushUndo() {
    this.undoStack.push(cloneJSON(this._snapshot()));
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack.length = 0;
  }
  checkpoint() { this._pushUndo(); return true; }
  discardCheckpoint() { if (!this.undoStack.length) return false; this.undoStack.pop(); return true; }

  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(cloneJSON(this._snapshot()));
    this._restoring = true; this._restoreSnapshot(this.undoStack.pop()); this._restoring = false;
    this._emit("undo"); return true;
  }

  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(cloneJSON(this._snapshot()));
    this._restoring = true; this._restoreSnapshot(this.redoStack.pop()); this._restoring = false;
    this._emit("redo"); return true;
  }

  keyHand(side = "both", undoable = true, interpolation = "smooth") {
    const layer = this.runtime.stack.get("handPose"); if (!layer) return false;
    if (undoable) this._pushUndo();
    const sides = side === "both" ? ["left", "right"] : [side];
    const time = this.time();
    for (const handSide of sides) {
      const hand = this.runtime.hands.state.hands[handSide]; if (!hand) continue;
      for (const key of MASTER_KEYS) layer.setKey(`${handSide}.master.${key}`, time, hand.master[key], interpolation);
      for (const digit of FINGER_NAMES) for (const [key, value] of Object.entries(hand.fingers[digit])) layer.setKey(`${handSide}.${digit}.${key}`, time, value, interpolation);
    }
    this._emit("hand-key"); return true;
  }

  keyFace(undoable = true, interpolation = "smooth") {
    const layer = this.runtime.stack.get("facialBase"); if (!layer) return false;
    if (undoable) this._pushUndo();
    const time = this.time(), expression = this.runtime.expressions;
    layer.setKey("expression.intensity", time, expression.intensity, interpolation);
    for (let i = 0; i < FACIAL_CHANNELS.length; i++) {
      const value = expression.coefficients[i] * expression.intensity + expression.manual[i];
      layer.setKey(`channel.${FACIAL_CHANNELS[i]}`, time, value, interpolation);
    }
    this._emit("face-key"); return true;
  }

  keyEmotion(undoable = true, interpolation = "smooth") {
    const layer = this.runtime.stack.get("emotion"); if (!layer) return false;
    if (undoable) this._pushUndo();
    const time = this.time(), emotion = this.runtime.emotions;
    layer.setKey("emotion.valence", time, emotion.valence, interpolation);
    layer.setKey("emotion.arousal", time, emotion.arousal, interpolation);
    layer.setKey("emotion.dominance", time, emotion.dominance, interpolation);
    layer.setKey("emotion.intensity", time, emotion.intensity, interpolation);
    this._emit("face-key"); return true;
  }

  keyGaze(undoable = true, interpolation = "smooth") {
    const layer = this.runtime.stack.get("gaze"); if (!layer) return false;
    if (undoable) this._pushUndo();
    const time = this.time(), gaze = this.runtime.gaze;
    const target = gaze._resolveTarget?.() ? gaze._target : gaze.worldTarget;
    layer.setKey("target.x", time, target.x, interpolation);
    layer.setKey("target.y", time, target.y, interpolation);
    layer.setKey("target.z", time, target.z, interpolation);
    this._emit("face-key"); return true;
  }

  keyEyeAppearance(side = "both", undoable = true, interpolation = "smooth") {
    const layer = this.runtime.stack.get("eyeAppearance"), eyes = this.runtime.eyeAppearance; if (!layer || !eyes) return false;
    if (undoable) this._pushUndo(); const time = this.time(), sides = side === "both" ? ["left", "right"] : [side];
    for (const targetSide of sides) for (const [control, value] of Object.entries(eyes.state[targetSide] || {})) {
      if (Number.isFinite(value)) layer.setKey(`${targetSide}.${control}`, time, value, interpolation);
    }
    this._emit("face-key"); return true;
  }

  keyBlink(type = "normal", undoable = true) {
    const layer = this.runtime.stack.get("blink"); if (!layer) return false;
    if (undoable) this._pushUndo();
    const time = this.time();
    const duration = type === "slow" ? 0.42 : 0.16;
    const strength = type === "half" ? 0.5 : 1;
    const left = type !== "winkRight", right = type !== "winkLeft";
    for (const [channel, active] of [["blink.left", left], ["blink.right", right]]) {
      if (!active) continue;
      layer.setKey(channel, Math.max(0, time - 0.001), 0, "linear");
      layer.setKey(channel, time + duration * 0.38, strength, "smooth");
      layer.setKey(channel, time + duration, 0, "smooth");
    }
    this._emit("face-key"); return true;
  }

  keyMicro(undoable = true) {
    const layer = this.runtime.stack.get("microExpression"); if (!layer) return false;
    if (undoable) this._pushUndo();
    const changed = layer.setKey("micro.intensity", this.time(), this.runtime.microExpressions.intensity, "smooth");
    if (changed) this._emit("face-key");
    return changed;
  }

  keyMorph(index, value = null, undoable = true, interpolation = "smooth") {
    const record = this.runtime.morphRegistry?.get?.(index);
    const layer = this.runtime.stack.get("manualCorrection");
    if (!record || !layer || !record.runtimeSupported) return false;
    if (undoable) this._pushUndo();
    const next = value == null
      ? Number(this.runtime.manualCorrections?.morphs?.[record.targetInfluenceIndex]) || 0
      : Number(value) || 0;
    const changed = layer.setKey(`rawMorph.${record.targetInfluenceIndex}`, this.time(), next, interpolation);
    if (changed) this._emit("face-key");
    return changed;
  }

  keyCurrentMorphs(undoable = true, interpolation = "smooth") {
    const registry = this.runtime.morphRegistry, manual = this.runtime.manualCorrections;
    if (!registry || !manual) return false;
    if (undoable) this._pushUndo();
    let changed = false;
    for (const record of registry.records || []) {
      if (!record.runtimeSupported || record.targetInfluenceIndex < 0) continue;
      const value = Number(manual.morphs?.[record.targetInfluenceIndex]) || 0;
      if (Math.abs(value) <= 1e-6 && !this.isMorphAnimated(record.index)) continue;
      changed = this.keyMorph(record.index, value, false, interpolation) || changed;
    }
    if (!changed && undoable) this.undoStack.pop();
    return changed;
  }

  keyFaceBundle(undoable = true, interpolation = "smooth") {
    if (undoable) this._pushUndo();
    let changed = false;
    changed = this.keyFace(false, interpolation) || changed;
    changed = this.keyEmotion(false, interpolation) || changed;
    changed = this.keyGaze(false, interpolation) || changed;
    changed = this.keyEyeAppearance("both", false, interpolation) || changed;
    changed = this.keyMicro(false) || changed;
    changed = this.keyCurrentMorphs(false, interpolation) || changed;
    if (!changed && undoable) this.undoStack.pop();
    if (changed) this._emit("face-bundle-key");
    return changed;
  }

  _layersForScope(scope = "all") {
    if (scope === "face") return this.runtime.stack.layers.filter((layer) => FACE_LAYER_IDS.has(layer.id));
    if (scope === "hand" || scope === "hands" || scope === "fingers") return this.runtime.stack.layers.filter((layer) => HAND_LAYER_IDS.has(layer.id));
    return this.runtime.stack.layers;
  }

  keyTimes(scope = "all") {
    const times = new Set();
    for (const layer of this._layersForScope(scope)) for (const keys of layer.tracks.values()) {
      for (const key of keys) times.add(Number(key.time).toFixed(5));
    }
    return [...times].map(Number).sort((a, b) => a - b);
  }

  moveKey(scope, from, to, tolerance = 0.03) {
    const source = Number(from), destination = Math.max(0, Number(to) || 0);
    let changed = false;
    for (const layer of this._layersForScope(scope)) for (const [channel, keys] of layer.tracks) {
      const at = keys.findIndex((key) => Math.abs(key.time - source) <= tolerance);
      if (at < 0) continue;
      const moved = { ...keys[at], time: destination };
      keys.splice(at, 1);
      const clash = keys.findIndex((key) => Math.abs(key.time - destination) < 1e-5);
      if (clash >= 0) keys[clash] = moved;
      else keys.push(moved);
      keys.sort((a, b) => a.time - b.time);
      if (!keys.length) layer.tracks.delete(channel);
      changed = true;
    }
    if (changed) this._emit(`${scope}-key-moved`);
    return changed;
  }

  deleteKey(scope, time, tolerance = 0.03) {
    let changed = false;
    for (const layer of this._layersForScope(scope)) for (const [channel, keys] of [...layer.tracks]) {
      for (let i = keys.length - 1; i >= 0; i--) if (Math.abs(keys[i].time - time) <= tolerance) { keys.splice(i, 1); changed = true; }
      if (!keys.length) layer.tracks.delete(channel);
    }
    if (changed) this._emit(`${scope}-key-deleted`);
    return changed;
  }

  clearKeys(scope = "all") {
    let changed = false;
    for (const layer of this._layersForScope(scope)) if (layer.tracks.size) { layer.tracks.clear(); changed = true; }
    if (changed) this._emit(`${scope}-keys-cleared`);
    return changed;
  }

  snapshotTracks() { return cloneJSON(this.runtime.stack.toJSON()); }
  restoreTracks(snapshot) {
    this._restoring = true;
    const changed = this.runtime.stack.restore(cloneJSON(snapshot));
    this._restoring = false;
    if (changed) this._emit("tracks-restored");
    return changed;
  }

  deleteMorphKey(index, tolerance = 1 / 60) {
    const record = this.runtime.morphRegistry?.get?.(index);
    const layer = this.runtime.stack.get("manualCorrection");
    if (!record || !layer) return false;
    this._pushUndo();
    const changed = layer.deleteKey(`rawMorph.${record.targetInfluenceIndex}`, this.time(), tolerance);
    if (!changed) this.undoStack.pop();
    if (changed) this._emit("face-key-deleted");
    return changed;
  }

  isMorphAnimated(index) {
    const record = this.runtime.morphRegistry?.get?.(index);
    return !!record && !!this.runtime.stack.get("manualCorrection")?.tracks?.has(`rawMorph.${record.targetInfluenceIndex}`);
  }

  animatedMorphIndices() {
    const output = new Set();
    for (const channel of this.runtime.stack.get("manualCorrection")?.tracks?.keys?.() || []) {
      const match = String(channel).match(/^rawMorph\.(\d+)$/);
      if (match) output.add(Number(match[1]));
    }
    return output;
  }

  deleteAtPlayhead(tolerance = 1 / 60) {
    const time = this.time(); let changed = false; this._pushUndo();
    for (const layer of this.runtime.stack.layers) for (const [channel, keys] of [...layer.tracks]) {
      for (let i = keys.length - 1; i >= 0; i--) if (Math.abs(keys[i].time - time) <= tolerance) { keys.splice(i, 1); changed = true; }
      if (!keys.length) layer.tracks.delete(channel);
    }
    if (!changed) this.undoStack.pop();
    if (changed) this._emit("keys-deleted");
    return changed;
  }

  copyAtPlayhead(tolerance = 1 / 60) {
    const time = this.time(), values = {};
    for (const layer of this.runtime.stack.layers) for (const [channel, keys] of layer.tracks) {
      const key = keys.find((item) => Math.abs(item.time - time) <= tolerance);
      if (key) (values[layer.id] ||= {})[channel] = { value: key.value, interpolation: key.interpolation };
    }
    this.clipboard = Object.keys(values).length ? values : null;
    return !!this.clipboard;
  }

  pasteAtPlayhead({ mirrorHands = false } = {}) {
    if (!this.clipboard) return false;
    this._pushUndo(); const time = this.time();
    for (const [layerId, channels] of Object.entries(this.clipboard)) {
      const layer = this.runtime.stack.get(layerId); if (!layer) continue;
      for (const [original, key] of Object.entries(channels)) {
        const channel = mirrorHands ? original.replace(/^(left|right)\./, (side) => `${side.startsWith("left") ? "right" : "left"}.`) : original;
        layer.setKey(channel, time, key.value, key.interpolation);
      }
    }
    this._emit("keys-pasted"); return true;
  }

  scaleTime(factor, origin = 0) {
    factor = Number(factor); if (!Number.isFinite(factor) || factor <= 0) return false;
    this._pushUndo();
    for (const layer of this.runtime.stack.layers) for (const keys of layer.tracks.values()) {
      for (const key of keys) key.time = Math.max(0, origin + (key.time - origin) * factor);
      keys.sort((a, b) => a.time - b.time);
    }
    this._emit("keys-scaled"); return true;
  }

  stats() {
    let channels = 0, keys = 0;
    const layers = {};
    for (const layer of this.runtime.stack.layers) {
      let layerKeys = 0; for (const list of layer.tracks.values()) layerKeys += list.length;
      if (layerKeys) layers[layer.id] = layerKeys;
      channels += layer.tracks.size; keys += layerKeys;
    }
    return { channels, keys, layers };
  }
}
