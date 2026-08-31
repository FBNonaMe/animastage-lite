import { DiagnosticCollector } from "../core/Diagnostics.js";
import { LEGACY_MATERIAL_EFFECTS } from "./builtin/legacy-material-effects.js";
import { RAY_MMD_ADAPTED_EFFECTS } from "./builtin/ray-mmd-adapted-effects.js";
import { OFFICIAL_EFFECT_SOURCES } from "./discovery/EffectSourceRegistry.js";
import { EffectCompatibilityService } from "./compatibility/EffectCapabilityProbe.js";
import { EffectPassProfiler } from "./diagnostics/EffectPassProfiler.js";
import { EffectSourceWorkbench, ShaderCompilationService } from "./compiler/ShaderCompilationService.js";
import { createLegacyShaderStudioAdapter } from "./integration/LegacyShaderStudioBridge.js";
import { importEffectArchive } from "./loaders/EffectArchiveImporter.js";
import { EffectsRegistry } from "./registry/EffectsRegistry.js";
import { EffectPreviewCache } from "./preview/EffectPreviewCache.js";
import { EffectPreviewService } from "./preview/EffectPreviewService.js";
import { EffectPreviewPersistentStore } from "./preview/EffectPreviewPersistentStore.js";
import { WebGL2ShaderBackend } from "./renderers/webgl2/WebGL2ShaderBackend.js";
import { WebGPUShaderBackend } from "./renderers/webgpu/WebGPUShaderBackend.js";
import { EffectRuntime } from "./runtime/EffectRuntime.js";
import { EffectStack } from "./runtime/EffectStack.js";
import { EffectsLibraryPanel } from "./ui/EffectsLibraryPanel.js";
import { createEffectReleaseAcceptance } from "./testing/EffectReleaseAcceptance.js";
import { CURRENT_BROWSER_ACCEPTANCE } from "./testing/CurrentBrowserAcceptance.js";

export function createEffectsPlatform({ shaderStudio, postProcessing = null, diagnostics = null } = {}) {
  const collector = diagnostics || new DiagnosticCollector({ capacity: 1500 });
  const registry = new EffectsRegistry();
  const profiler = new EffectPassProfiler({ diagnostics: collector });
  const adapter = createLegacyShaderStudioAdapter(shaderStudio, { postProcessing, profiler });
  const compatibility = new EffectCompatibilityService({ registry, adapter, diagnostics: collector });
  const runtime = new EffectRuntime({ registry, adapter, diagnostics: collector });
  const stack = new EffectStack({ registry, runtime, adapter, compatibility, diagnostics: collector });
  const previewCache = new EffectPreviewCache();
  const previewStore = new EffectPreviewPersistentStore();
  const previews = new EffectPreviewService({ registry, adapter, compatibility, diagnostics: collector, cache: previewCache, persistentStore: previewStore });
  const compiler = new ShaderCompilationService({
    diagnostics: collector,
    backends: [new WebGL2ShaderBackend(), new WebGPUShaderBackend()],
  });
  const sourceWorkbench = new EffectSourceWorkbench({ compiler, diagnostics: collector });
  const panel = new EffectsLibraryPanel({ registry, runtime, stack, adapter, compatibility, profiler, previews, compiler, sourceWorkbench });

  for (const entry of LEGACY_MATERIAL_EFFECTS) {
    registry.register(entry.manifest, entry.implementation, { source: "builtin" });
  }
  for (const entry of RAY_MMD_ADAPTED_EFFECTS) {
    registry.register(entry.manifest, entry.implementation, { source: "ray-mmd-adapted" });
  }
  for (const source of OFFICIAL_EFFECT_SOURCES) {
    // Source references are intentionally non-runnable. A downloaded HLSL/MME
    // archive is evidence and input for an adapter, not a WebGL effect by itself.
    registry.register(source.manifest, null, { source: source.officialUrl });
  }

  const api = Object.freeze({
    version: "2.0.0-effects-final",
    registry,
    runtime,
    stack,
    adapter,
    diagnostics: collector,
    compatibility,
    profiler,
    previews,
    previewCache,
    previewStore,
    compiler,
    sourceWorkbench,
    acceptance(options = {}) { return createEffectReleaseAcceptance(api, { browserEvidence: CURRENT_BROWSER_ACCEPTANCE, ...options }); },
    panel,
    mount() {
      shaderStudio.setLibraryExtension?.((container) => panel.render(container));
      return api;
    },
    importArchive(file, options = {}) {
      return importEffectArchive(file, {
        JSZip: options.JSZip || globalThis.JSZip,
        ...options,
      });
    },
    updateFrame(frameContext, options = {}) {
      return runtime.evaluateFrame(frameContext, options);
    },
    indexPackage(effectPackage, implementation = null) {
      if (effectPackage?.schema !== "animestage.effect-package/v1") {
        throw new TypeError("Cannot index an invalid effect package");
      }
      const definition = registry.register(effectPackage.manifest, implementation, { source: "imported" });
      if (effectPackage.inspection.quarantined.length) {
        collector.emit({
          severity: "warning",
          code: "EFFECT_PACKAGE_FILES_QUARANTINED",
          message: `${effectPackage.inspection.quarantined.length} unsafe file(s) were isolated; safe effect files remain indexed`,
          stageId: definition.key,
          details: { files: effectPackage.inspection.quarantined },
        });
      }
      return definition;
    },
    report() {
      return Object.freeze({
        version: api.version,
        registered: registry.size,
        activeInstances: runtime.instances.length,
        stackEntries: stack.size,
        effectGraph: stack.graph.toJSON(),
        resources: runtime.resourceStats,
        compatibility: compatibility.context,
        performance: profiler.getReport(),
        previews: previews.stats,
        shaderCompiler: compiler.stats,
        sourceWorkbench: sourceWorkbench.report,
        acceptance: createEffectReleaseAcceptance(api, { browserEvidence: CURRENT_BROWSER_ACCEPTANCE }),
        quarantined: registry.quarantined.length,
        diagnostics: collector.events,
      });
    },
  });
  return api;
}
