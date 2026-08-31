import * as THREE from "../vendor/three/build/three.module.js";
import { writeVmdFromClip } from "./VmdWriter.js";

const active = (layer) => !!layer && layer.enabled && !layer.muted && layer.weight > 0;

export class PerformanceBaker {
  constructor(runtime, options = {}) {
    this.runtime = runtime;
    this.sampleBasePose = options.sampleBasePose || ((_mesh, _time, read) => read());
    this.getDuration = options.getDuration || (() => 0);
  }

  _duration(options) {
    const timelineDuration = Number(this.runtime.timeline.bridge()?.duration?.()) || 0;
    return Math.max(1 / 30, Number(options?.duration) || Number(this.getDuration(this.runtime.mesh)) || timelineDuration || 1);
  }

  buildBoneClip(name = "Performance Bones", options = {}) {
    const fps = Math.max(1, Math.min(120, Number(options.fps) || 30)), duration = this._duration(options), frameCount = Math.ceil(duration * fps) + 1;
    const handLayer = this.runtime.stack.get("handPose"), gazeLayer = this.runtime.stack.get("gaze");
    const bones = new Map();
    if (active(handLayer)) for (const binding of this.runtime.hands.bindings) bones.set(binding.bone, this.runtime.mesh.skeleton.bones.indexOf(binding.bone));
    if (active(gazeLayer)) for (const binding of this.runtime.gaze.bindings) bones.set(binding.bone, this.runtime.mesh.skeleton.bones.indexOf(binding.bone));
    if (!bones.size) return null;
    const times = new Float32Array(frameCount), values = new Map();
    for (const bone of bones.keys()) values.set(bone, new Float32Array(frameCount * 4));
    const gazeState = { eyeYaw: this.runtime.gaze.eyeYaw, eyePitch: this.runtime.gaze.eyePitch, headYaw: this.runtime.gaze.headYaw, headPitch: this.runtime.gaze.headPitch, clock: this.runtime.gaze.clock };
    const gazeBindingState = this.runtime.gaze.bindings.map((binding) => ({ binding, yaw: binding.yaw, pitch: binding.pitch }));
    this.runtime.gaze.eyeYaw = this.runtime.gaze.eyePitch = this.runtime.gaze.headYaw = this.runtime.gaze.headPitch = this.runtime.gaze.clock = 0;
    for (const state of gazeBindingState) { state.binding.yaw = 0; state.binding.pitch = 0; }
    const dt = 1 / fps;
    try {
      for (let frame = 0; frame < frameCount; frame++) {
        const time = Math.min(duration, frame / fps); times[frame] = time;
        this.sampleBasePose(this.runtime.mesh, time, () => {
          this.runtime.hands.beginFrame(); this.runtime.gaze.beginFrame();
          if (active(handLayer)) this.runtime.hands.evaluate(handLayer, time);
          if (active(gazeLayer)) this.runtime.gaze.evaluate(gazeLayer, dt, time);
          for (const [bone] of bones) {
            const output = values.get(bone), offset = frame * 4;
            output[offset] = bone.quaternion.x; output[offset + 1] = bone.quaternion.y; output[offset + 2] = bone.quaternion.z; output[offset + 3] = bone.quaternion.w;
            if (frame > 0) {
              const previous = offset - 4, dot = output[previous] * output[offset] + output[previous + 1] * output[offset + 1] + output[previous + 2] * output[offset + 2] + output[previous + 3] * output[offset + 3];
              if (dot < 0) { output[offset] *= -1; output[offset + 1] *= -1; output[offset + 2] *= -1; output[offset + 3] *= -1; }
            }
          }
          this.runtime.gaze.beginFrame(); this.runtime.hands.beginFrame();
        });
      }
    } finally {
      Object.assign(this.runtime.gaze, gazeState);
      for (const state of gazeBindingState) { state.binding.yaw = state.yaw; state.binding.pitch = state.pitch; }
    }
    const tracks = [];
    for (const [bone, index] of bones) if (index >= 0) tracks.push(new THREE.QuaternionKeyframeTrack(`.bones[${index}].quaternion`, times, values.get(bone)));
    return tracks.length ? new THREE.AnimationClip(name, duration, tracks) : null;
  }

  buildMorphClip(name = "Performance Face", options = {}) {
    const fps = Math.max(1, Math.min(120, Number(options.fps) || 30)), duration = this._duration(options), frameCount = Math.ceil(duration * fps) + 1;
    const rig = this.runtime.facialRig; if (!rig.count) return null;
    const times = new Float32Array(frameCount), values = Array.from({ length: rig.count }, () => new Float32Array(frameCount));
    const layers = {
      expression: this.runtime.stack.get("facialBase"), emotion: this.runtime.stack.get("emotion"), speech: this.runtime.stack.get("speech"),
      blink: this.runtime.stack.get("blink"), micro: this.runtime.stack.get("microExpression"), capture: this.runtime.stack.get("capture"), manual: this.runtime.stack.get("manualCorrection"),
      eyes: this.runtime.stack.get("eyeAppearance"),
    };
    const blinkState = this.runtime.blink.toJSON(), microClock = this.runtime.microExpressions.clock;
    const previewPlaying = this.runtime.lipSync.previewPlaying, previewTime = this.runtime.lipSync.previewTime;
    this.runtime.blink.restore(blinkState); this.runtime.microExpressions.clock = 0; this.runtime.lipSync.previewPlaying = false;
    const dt = 1 / fps;
    try {
      for (let frame = 0; frame < frameCount; frame++) {
        const time = Math.min(duration, frame / fps); times[frame] = time;
        this.sampleBasePose(this.runtime.mesh, time, () => {
          this.runtime.eyeAppearance?.beginFrame?.(); rig.beginFrame(); rig.prepareFrame();
          if (active(layers.expression)) this.runtime.expressions.evaluate(layers.expression, time);
          if (active(layers.emotion)) this.runtime.emotions.evaluate(layers.emotion, time);
          if (active(layers.speech)) this.runtime.lipSync.evaluate(layers.speech, dt, time);
          if (active(layers.eyes)) this.runtime.eyeAppearance.evaluate(layers.eyes, dt, time);
          if (active(layers.blink)) this.runtime.blink.evaluate(layers.blink, dt, time);
          if (active(layers.micro)) this.runtime.microExpressions.evaluate(layers.micro, dt, time);
          if (active(layers.capture)) this.runtime.faceCapture.evaluate(layers.capture, dt, time);
          if (active(layers.manual)) this.runtime.manualCorrections.evaluate(layers.manual, time);
          rig.finishFrame();
          for (let morph = 0; morph < rig.count; morph++) values[morph][frame] = Number(this.runtime.mesh.morphTargetInfluences[morph]) || 0;
          this.runtime.eyeAppearance?.beginFrame?.(); rig.beginFrame();
        });
      }
    } finally {
      this.runtime.blink.restore(blinkState); this.runtime.microExpressions.clock = microClock;
      this.runtime.lipSync.previewPlaying = previewPlaying; this.runtime.lipSync.previewTime = previewTime;
      this.runtime.eyeAppearance?.beginFrame?.();
    }
    const tracks = [];
    for (let morph = 0; morph < rig.count; morph++) {
      let used = false, first = values[morph][0];
      for (let frame = 0; frame < frameCount; frame++) if (Math.abs(values[morph][frame]) > 1e-6 || Math.abs(values[morph][frame] - first) > 1e-6) { used = true; break; }
      if (used) tracks.push(new THREE.NumberKeyframeTrack(`.morphTargetInfluences[${morph}]`, times, values[morph]));
    }
    return tracks.length ? new THREE.AnimationClip(name, duration, tracks) : null;
  }

  buildAll(name = "Baked Performance", options = {}) {
    const bones = this.buildBoneClip(`${name} Bones`, options), face = this.buildMorphClip(`${name} Face`, options);
    const tracks = [...(bones?.tracks || []), ...(face?.tracks || [])];
    const duration = Math.max(bones?.duration || 0, face?.duration || 0);
    return tracks.length ? new THREE.AnimationClip(name, duration, tracks) : null;
  }

  morphExportReport() {
    const records = this.runtime.morphRegistry?.all?.() || [];
    const animated = this.runtime.timeline?.animatedMorphIndices?.() || new Set();
    let missingTargets = 0, unsupportedAnimated = 0;
    for (const record of records) {
      if (!record.exportCompatible) missingTargets++;
      if (animated.has(record.targetInfluenceIndex) && !record.runtimeSupported) unsupportedAnimated++;
    }
    return {
      nativeModelMorphs: records.filter((record) => record.exportCompatible).length,
      animatedRawMorphs: animated.size,
      semanticChannelsBaked: this.runtime.facialRig.supportedChannels().length,
      missingVmdTargets: missingTargets,
      proceduralOnlyControls: unsupportedAnimated,
    };
  }

  exportVmd(name = "Baked Performance", options = {}) {
    const clip = this.buildAll(name, { ...options, fps: options.fps || 30 });
    return clip ? writeVmdFromClip(this.runtime.mesh, clip, { ...options, fps: options.fps || 30, modelName: options.modelName || this.runtime.mesh.name, morphRegistry: this.runtime.morphRegistry }) : null;
  }
}
