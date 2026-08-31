# AnimaStage Effects Platform architecture

## Purpose

The Effects Platform keeps effect discovery, provenance, validation, runtime
activation and renderer integration separate. An original MME archive can be
verified without being executable, while an adapted effect can advance through
runtime and GPU testing without overstating compatibility with its source.

## Runtime flow

```text
EffectSourceRegistry / package catalog
                 |
                 v
          EffectRegistry
                 |
                 v
 EffectRuntime -> EffectInstance -> renderer adapter
       |                              |-- material target
       |                              `-- post-processing layer
       `-- diagnostics + rollback
```

The editor-facing path adds an ordered transactional layer:

```text
EffectStack -> EffectGraph -> renderer pass order
     |             |-- resource requirements
     |             |-- dependency/order validation
     `-- Session v3 / stack presets
```

- `EffectRegistry` stores normalized, immutable manifests and implementations.
- `EffectRuntime` creates instances, validates targets and parameters, and owns
  activation, live updates and disable operations.
- `EffectInstance` stores one independent set of validated parameter values.
- `LegacyShaderStudioBridge` exposes the existing material system and the new
  post-processing bridge through one narrow adapter surface.
- `PostProcessingEffectBridge` owns only Effects Platform layers. It never
  resets unrelated legacy sliders or another active effect.
- `EffectStack` gives every placement a stable ID, so duplicates of the same
  package remain independent and can be reordered, disabled or removed alone.
- `EffectGraph` performs mutation-free pass validation before the composer is
  reordered.
- `EffectFrameState` derives time and random samples from the explicit
  `FrameContext`; offline output never reads wall-clock time or `Math.random`.
- `EffectResourceTracker` inventories every allocated cleanup record and keeps
  failed disposals visible as possible leaks.
- `EffectPassProfiler` wraps only Effect Platform-owned composer passes. It uses
  `EXT_disjoint_timer_query_webgl2` when available and falls back to CPU timing
  without changing shader code, render targets or pass order.
- `EffectCapabilityProbe` separates effect-provided capabilities from actual
  device requirements, records WebGL features/limits and blocks an unsupported
  adapter before scene mutation. A declared fallback is selected only when the
  substitute is independently compatible.
- `EffectPreviewService` resolves and validates reflected parameters without
  entering runtime activation. Its provider contract accepts only results
  explicitly marked `isolated: true`.
- `EffectPreviewCache` owns a deterministic parameter/revision key, concurrent
  request deduplication, bounded LRU storage and every generated object URL.

## Transaction and rollback rules

Before activation, the runtime captures the adapter state. Validation and GPU
activation happen inside the same transaction. If either fails, the captured
state is restored and the instance is marked failed. A live parameter update
also keeps the previous immutable value set and restores it if the renderer
rejects the update.

Post effects are layered per instance and per pass ID. The newest layer for a
pass drives that pass. Removing one effect reveals the previous layer; removing
the final layer neutralizes only that pass. This prevents one effect from
silently disabling another effect or resetting the complete composer.

## Framegraph integration

The current WebGL integration adds narrowly scoped Ray-MMD bloom and color
grading passes to the existing `EffectComposer`. Pass objects are provided
lazily to the Effects Platform, so the registry can start before the renderer
finishes constructing the composer. Final display conversion remains owned by
AnimaStage's output pass; the color-grading adapter does not perform an extra
sRGB conversion.

The current bridge now accepts graph order changes and reorders only the
passes owned by the Effects Platform. Existing engine passes remain under the
legacy composer owner. Live and offline renders both call the same per-frame
effect evaluation boundary; offline rendering supplies explicit frame index,
FPS, time, seed and scene revision.

## Isolated previews

Preview rendering is a second, deliberately disconnected render graph. The
current WebGL provider creates a private canvas, renderer, scene, camera,
EffectComposer and fresh adapted pass, renders a deterministic neutral test
scene, copies the result to a PNG Blob and disposes every GPU resource. It does
not capture, apply, reorder or disable the live Effect Stack and it never reads
the active model or main composer targets.

Only manifests with an explicit validated `preview` contract are eligible.
The cache key includes package version, complete normalized parameters,
dimensions, preview backend, adapter cache revision and deterministic seed.
This prevents stale thumbnails after adapter changes and lets identical
concurrent UI requests share one GPU render.

## Shader-language boundary

Compiler input is represented by `ShaderSource` variants for GLSL, WGSL, HLSL,
MME-FX and native adapters. Include expansion rejects cycles, missing files and
package escape paths while retaining source maps. The MME compatibility layer
parses common FX structure and returns honest compatibility diagnostics; it is
not a regex HLSL-to-GLSL translator and never marks inspected source runnable.

## Session and failure isolation

Session v3 stores the Effect Stack alongside character animation layers. Import
preflights files, transforms, effects, dependencies, parameters and the pass
graph before scene mutation. If effect activation fails after character staging,
the session transaction restores the prior characters, camera and complete
effect stack.

## Source integrity

Downloaded originals live under `assets/effects-library/third-party` with
provenance and inspection records. Original archives and extracted source are
not edited in place. WebGL ports live under a distinct `adapted` directory and
identify the exact original entry point, revision, license and SHA-256 archive
hash in their manifests.

## Status meaning

- `VERIFIED`: official archive and extracted-file hashes were checked.
- `ADAPTED`: an AnimaStage implementation exists, but runtime proof is pending.
- `RUNTIME_TESTED`: runtime transactions and parameters passed tests.
- `GPU_TESTED`: the real application compiled and exercised the effect on GPU.
- `PRODUCTION_READY`: the adapter has additionally completed the full release
  acceptance matrix. The two current Ray-MMD adapters remain `GPU_TESTED`.

Verification never implies WebGL/WebGPU compatibility, and a scoped adapter
never implies compatibility with the complete original effect suite.

## Visual release acceptance

`EffectVisualAcceptance` compares deterministic RGBA frames using mismatch
ratio, MAE, RMSE, PSNR and luminance SSIM. Acceptance reports are stable JSON,
can be SHA-256 digested and optionally signed with ECDSA P-256. Promotion to
`PRODUCTION_READY` therefore has a machine-verifiable artifact rather than a
manual screenshot claim.
