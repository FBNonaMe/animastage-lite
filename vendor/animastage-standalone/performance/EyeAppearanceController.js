import * as THREE from "../vendor/three/build/three.module.js";
import { FACIAL_CHANNEL_INDEX, createFacialBuffer } from "./FacialChannels.js";

const SIDES = ["left", "right"];
const CONTROL_LIMITS = Object.freeze({
  eyeballRadius: [0.85, 1.15], irisRadius: [0.5, 1.5], pupilRadius: [0.35, 1.65],
  corneaRadius: [0.85, 1.15], corneaGloss: [0, 1], scleraBrightness: [0.5, 1.5],
  irisBrightness: [0.5, 1.5], highlightStrength: [0, 2], tintStrength: [0, 1],
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function signedRadius(value, min, max) {
  value = clamp(value, min, max);
  return value >= 1 ? (value - 1) / Math.max(1e-6, max - 1) : (value - 1) / Math.max(1e-6, 1 - min);
}
function makeSideState() {
  return {
    eyeballRadius: 1, irisRadius: 1, pupilRadius: 1, corneaRadius: 1,
    corneaGloss: 0.55, scleraBrightness: 1, irisBrightness: 1,
    highlightStrength: 1, irisTint: "#ffffff", tintStrength: 0,
  };
}
function copyState(value) { return JSON.parse(JSON.stringify(value)); }
function closeVector(a, b) { return a.distanceToSquared(b) < 1e-12; }

function classifyEyeMaterial(material) {
  const name = String(material?.name || "").normalize("NFKC").toLowerCase();
  if (!name || /まつげ|睫|lash|eyelash|眉|brow/.test(name)) return null;
  if (/白目|sclera/.test(name)) return "sclera";
  if (/角膜|cornea/.test(name)) return "cornea";
  if (/ハイライト|highlight|catchlight/.test(name)) return "highlight";
  if (/虹彩|瞳孔|瞳|iris|pupil|eyeball|(^|[^a-z])eye([^a-z]|$)/.test(name)) return "iris";
  return null;
}

export class EyeAppearanceController {
  constructor(mesh, profile, facialRig) {
    this.mesh = mesh;
    this.profile = profile;
    this.rig = facialRig;
    this.enabled = true;
    this.linked = true;
    this.state = { left: makeSideState(), right: makeSideState() };
    this.evaluated = { left: makeSideState(), right: makeSideState() };
    this.coefficients = createFacialBuffer();
    this.boneBindings = [];
    this.materialBindings = [];
    this._tint = new THREE.Color();
    this._tintRight = new THREE.Color();
    this._compileBones();
    this._compileMaterials();
  }

  _compileBones() {
    const bones = this.mesh?.skeleton?.bones || [], seen = new Set();
    const add = (side, part, mapping) => {
      const index = mapping?.targetBoneIndex;
      if (!Number.isInteger(index) || !bones[index]) return;
      const key = `${side}:${part}:${index}`;
      if (seen.has(key)) return;
      seen.add(key);
      this.boneBindings.push({ side, part, bone: bones[index], base: new THREE.Vector3(), applied: new THREE.Vector3(), hasLast: false });
    };
    for (const side of SIDES) {
      add(side, "eyeball", this.profile?.eyes?.[side]);
      for (const part of ["iris", "pupil", "cornea"]) add(side, part, this.profile?.eyeParts?.[side]?.[part]);
    }
  }

  _compileMaterials() {
    const materials = Array.isArray(this.mesh?.material) ? this.mesh.material : this.mesh?.material ? [this.mesh.material] : [];
    for (const material of materials) {
      const kind = classifyEyeMaterial(material);
      if (!kind || !material?.color?.isColor) continue;
      this.materialBindings.push({
        material, kind, hasLast: false,
        baseColor: new THREE.Color(), appliedColor: new THREE.Color(), resultColor: new THREE.Color(),
        baseEmissive: material.emissive?.isColor ? new THREE.Color() : null,
        appliedEmissive: material.emissive?.isColor ? new THREE.Color() : null,
        resultEmissive: material.emissive?.isColor ? new THREE.Color() : null,
        baseRoughness: Number.isFinite(material.roughness) ? material.roughness : null,
        appliedRoughness: null,
      });
    }
  }

  beginFrame() {
    for (const binding of this.boneBindings) {
      if (binding.hasLast && closeVector(binding.bone.scale, binding.applied)) binding.bone.scale.copy(binding.base);
      binding.hasLast = false;
    }
    for (const binding of this.materialBindings) {
      if (!binding.hasLast) continue;
      if (binding.material.color.equals(binding.appliedColor)) binding.material.color.copy(binding.baseColor);
      if (binding.baseEmissive && binding.material.emissive.equals(binding.appliedEmissive)) binding.material.emissive.copy(binding.baseEmissive);
      if (binding.appliedRoughness !== null && Math.abs(binding.material.roughness - binding.appliedRoughness) < 1e-7) binding.material.roughness = binding.baseRoughness;
      binding.hasLast = false;
    }
  }

  setLinked(value) {
    this.linked = !!value;
    if (this.linked) this.state.right = copyState(this.state.left);
  }

  setControl(side, control, value) {
    if (!this.state[side] || !(control in this.state[side])) return false;
    if (control === "irisTint") this.state[side][control] = /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#ffffff";
    else {
      const limits = CONTROL_LIMITS[control];
      this.state[side][control] = limits ? clamp(value, limits[0], limits[1]) : Number(value) || 0;
    }
    if (this.linked) this.state[side === "left" ? "right" : "left"] = copyState(this.state[side]);
    return true;
  }

  reset(side = "both") {
    const targets = side === "both" ? SIDES : [side];
    for (const target of targets) if (this.state[target]) this.state[target] = makeSideState();
  }

  _setCoefficient(name, value) {
    const index = FACIAL_CHANNEL_INDEX[name];
    if (index !== undefined) this.coefficients[index] = clamp(value, -1, 1);
  }

  _applyBoneScales(layerWeight) {
    for (const binding of this.boneBindings) {
      const state = this.evaluated[binding.side], factor = state[`${binding.part}Radius`] ?? 1;
      binding.base.copy(binding.bone.scale);
      const weighted = 1 + (factor - 1) * layerWeight;
      binding.bone.scale.copy(binding.base).multiplyScalar(weighted);
      binding.applied.copy(binding.bone.scale); binding.hasLast = true;
    }
  }

  _applyMaterials(layerWeight) {
    const left = this.evaluated.left, right = this.evaluated.right;
    const irisBrightness = (left.irisBrightness + right.irisBrightness) * 0.5;
    const scleraBrightness = (left.scleraBrightness + right.scleraBrightness) * 0.5;
    const highlightStrength = (left.highlightStrength + right.highlightStrength) * 0.5;
    const gloss = (left.corneaGloss + right.corneaGloss) * 0.5;
    const tintStrength = (left.tintStrength + right.tintStrength) * 0.5 * layerWeight;
    this._tint.set(left.irisTint).lerp(this._tintRight.set(right.irisTint), 0.5);
    for (const binding of this.materialBindings) {
      const material = binding.material; binding.baseColor.copy(material.color);
      const brightness = binding.kind === "sclera" ? scleraBrightness : binding.kind === "iris" ? irisBrightness : 1;
      binding.resultColor.copy(binding.baseColor).multiplyScalar(1 + (brightness - 1) * layerWeight);
      if (binding.kind === "iris" && tintStrength > 0) binding.resultColor.lerp(this._tint, tintStrength);
      material.color.copy(binding.resultColor); binding.appliedColor.copy(material.color);
      if (binding.baseEmissive) {
        binding.baseEmissive.copy(material.emissive);
        binding.resultEmissive.copy(binding.baseEmissive).multiplyScalar(1 + (highlightStrength - 1) * layerWeight);
        material.emissive.copy(binding.resultEmissive); binding.appliedEmissive.copy(material.emissive);
      }
      if (binding.baseRoughness !== null && binding.kind === "cornea") {
        binding.baseRoughness = material.roughness;
        material.roughness = binding.baseRoughness + (0.04 - binding.baseRoughness) * gloss * layerWeight;
        binding.appliedRoughness = material.roughness;
      }
      binding.hasLast = true;
    }
  }

  evaluate(layer, _deltaTime = 0, time = 0) {
    if (!this.enabled) return;
    const weight = clamp(layer?.weight ?? 1, 0, 1);
    if (weight <= 0) return;
    for (const side of SIDES) {
      for (const control of Object.keys(CONTROL_LIMITS)) {
        const fallback = this.state[side][control], channel = `${side}.${control}`;
        this.evaluated[side][control] = layer?.tracks?.has(channel) ? layer.sample(channel, time, fallback) : fallback;
      }
      this.evaluated[side].irisTint = this.state[side].irisTint;
    }
    this.coefficients.fill(0);
    for (const side of SIDES) {
      const suffix = side === "left" ? "Left" : "Right", state = this.evaluated[side];
      this._setCoefficient(`irisSize${suffix}`, signedRadius(state.irisRadius, 0.5, 1.5));
      this._setCoefficient(`pupilSize${suffix}`, signedRadius(state.pupilRadius, 0.35, 1.65));
      this._setCoefficient(`corneaRadius${suffix}`, signedRadius(state.corneaRadius, 0.85, 1.15));
      this._setCoefficient(`eyeHighlight${suffix}`, state.highlightStrength - 1);
    }
    this.rig.applyCoefficients(layer, this.coefficients, time);
    this._applyBoneScales(weight);
    this._applyMaterials(weight);
    this.mesh.skeleton?.update?.();
  }

  supportReport() {
    const morphRoles = ["irisLarge", "irisSmall", "pupilLarge", "pupilSmall", "corneaLarge", "corneaSmall", "eyeHighlightOn", "eyeHighlightOff"];
    return {
      eyeBones: this.boneBindings.filter((item) => item.part === "eyeball").length,
      partBones: this.boneBindings.filter((item) => item.part !== "eyeball").length,
      eyeMaterials: this.materialBindings.length,
      morphRoles: morphRoles.filter((role) => this.profile?.morphs?.[role]?.length).length,
    };
  }

  toJSON() { return { enabled: this.enabled, linked: this.linked, state: copyState(this.state) }; }
  restore(data) {
    if (!data) return false;
    this.enabled = data.enabled !== false; this.linked = data.linked !== false;
    for (const side of SIDES) for (const [control, fallback] of Object.entries(makeSideState())) {
      const value = data.state?.[side]?.[control];
      if (control === "irisTint") this.state[side][control] = /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : fallback;
      else this.state[side][control] = Number.isFinite(value) ? value : fallback;
    }
    return true;
  }

  dispose() { this.beginFrame(); }
}
