import { PostProcessingEffectBridge } from "./PostProcessingEffectBridge.js";

export function createLegacyShaderStudioAdapter(shaderStudio, { postProcessing = null, profiler = null } = {}) {
  if (!shaderStudio || typeof shaderStudio !== "object") {
    throw new TypeError("Legacy Shader Studio bridge requires a studio API");
  }
  const post = new PostProcessingEffectBridge(postProcessing, { profiler });
  const isPostInstance = (instance) => instance?.definition?.manifest?.kind === "post-process";
  return Object.freeze({
    capture: (instance) => isPostInstance(instance) ? post.capture() : shaderStudio.captureEffectState?.() ?? null,
    restore: (snapshot, instance) => isPostInstance(instance) ? post.restore(snapshot) : shaderStudio.restoreEffectState?.(snapshot),
    assertTarget: (target, instance = null) => {
      if (isPostInstance(instance) || target?.kind === "post-chain") {
        if (target?.ref !== post) throw new Error("The post-processing chain changed while applying the effect");
        return true;
      }
      const current = shaderStudio.getEffectTarget?.();
      if (!current) throw new Error("Load a model before applying an effect");
      if (target?.ref && current.ref && target.ref !== current.ref) {
        throw new Error(`Effect target changed from ${target.id} to ${current.id}`);
      }
      return true;
    },
    applyLegacyMode: (mode, target) => {
      const current = shaderStudio.getEffectTarget?.();
      if (!current) throw new Error("No active Shader Studio model");
      if (target?.ref && current.ref !== target.ref) throw new Error("The selected model changed while applying the effect");
      return shaderStudio.applyEffectMode?.(mode);
    },
    assertPostPass: (passId) => post.assertPass(passId),
    applyPostEffect: (instance, passId, parameters) => post.apply(instance, passId, parameters),
    updatePostEffect: (instance, parameters) => post.update(instance, parameters),
    removePostEffect: (instance) => post.remove(instance),
    reorderEffects: (instances, graph) => post.reorder(instances, graph),
    updateFrame: (frame) => post.updateFrame(frame),
    getCompatibilityContext: () => post.getCompatibilityContext(),
    getPerformanceReport: () => post.getPerformanceReport(),
    renderPreview: (definition, parameters, options) => {
      if (definition?.manifest?.kind === "post-process") {
        return post.renderPreview(definition, parameters, options);
      }
      if (typeof shaderStudio.renderEffectPreview === "function") {
        return shaderStudio.renderEffectPreview(definition, parameters, options);
      }
      throw new Error(`${definition?.manifest?.name || "This effect"} has no isolated preview adapter`);
    },
    getTarget: (manifest = null) => manifest?.kind === "post-process"
      ? post.getTarget()
      : shaderStudio.getEffectTarget?.() ?? null,
    postProcessing: post,
  });
}
