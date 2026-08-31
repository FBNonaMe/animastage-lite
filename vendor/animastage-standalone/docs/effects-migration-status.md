# Effects migration status

## Connected in the real application

- Effects Library and Shader Studio run inside `mmd_rtx.html`; no decorative
  demo page is used.
- Three native material modes remain connected through the existing material
  bridge: Original MMD Materials, Figure PBR and MMD 2.0.
- Ray-MMD Color Grading is connected as a post-processing pass with ten
  reflected parameters and six original tone operators.
- Ray-MMD HDR Bloom is connected as a five-level post-processing pass with five
  reflected parameters.
- Multiple post effects can stay active at once. Disabling one instance keeps
  all unrelated instances and legacy renderer settings intact.
- Shader Studio now has Library, Stack, Inspector, Graph, Performance,
  Previews, Source and Diagnostics views connected to the real runtime.
- The stack supports reorder, duplicate, enable/disable, remove, clear and
  transactional JSON preset import/export.
- Session v3 persists the complete stack and restores it inside the same
  two-phase scene transaction as characters and animation layers.

## Acceptance completed

- Runtime validation, parameter defaults and all supported parameter types.
- Rejection of unknown, malformed and out-of-range values.
- Activation rollback and live-update rollback after simulated renderer errors.
- Independent post-effect layer removal and neutralization of the final layer.
- Real browser/GPU activation of both Ray-MMD adapters in AnimeStage.
- Live Color Grading parameter update in the generated inspector.
- Bloom and Color Grading active together, followed by independent removal.
- Browser acceptance completed with zero console errors and zero warnings from
  this effect path.
- Browser acceptance repeated with two active GPU effects, one duplicate and
  one independent removal; the stack and graph remained correct with a clean
  console.
- Deterministic live/offline frame uniforms and seeded random streams.
- 100 consecutive effect add/remove cycles with zero tracked live resources.
- MME structural inspection tested on preserved Ray-MMD 1.5.2 `.fx` source.
- WebGL2 capability probing now distinguishes effect features from renderer
  requirements and checks numeric GPU limits before activation.
- Every Effect Platform post pass has bounded CPU profiling and optional native
  GPU timer-query profiling. The Shader Studio Performance view shows average,
  p95, budget and the exact active GPU/backend.
- Deterministic image comparison reports mismatch ratio, MAE, RMSE, PSNR and
  SSIM; reports can be SHA-256 digested and ECDSA-signed for release evidence.
- Browser acceptance on the current AMD WebGL2 device measured Ray-MMD HDR
  Bloom and Color Grading together through real GPU timer queries with no new
  Effect Platform console errors.
- Ray-MMD cards now use real 320×180 thumbnails rendered by the adapted passes
  on a separate WebGL renderer, scene, camera and EffectComposer.
- Preview requests are parameter-keyed, concurrently deduplicated and stored in
  a bounded LRU plus persistent IndexedDB Blob storage. Eviction and manual
  clear both revoke owned object URLs; normal restarts reuse generated images.
- Browser acceptance generated both Ray previews, verified their dimensions,
  cleared and regenerated the cache, and confirmed the live Effect Stack stayed
  at zero layers and zero passes throughout preview rendering.
- The Source workspace now compiles WGSL through a native WebGPU module and
  GLSL through an isolated WebGL2 program. Reflection reports entry points,
  bindings, uniforms and parameter annotations.
- Failed shader compiles keep the previous staged revision and report precise
  diagnostics instead of changing the live renderer.
- Favorites and Recent library filters are connected to registry state.

The two Ray-MMD adapters are labelled `GPU_TESTED`, not `PRODUCTION_READY`.

## Source and provenance state

- Ray-MMD 1.5.2 official archive is pinned to commit
  `a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8`.
- Archive SHA-256 is
  `5b8c095a4d77c0a6f259829c2cbdb1a279a5d993217e3f277f578a9cf7328494`.
- The unchanged source is preserved separately from AnimaStage adapters.
- Six KH40 repositories are indexed as source references only. Their repository
  rules prevent bundling unchanged shader archives in this project.

## Known limitations

- This is not a full MME interpreter, PMD plugin host or Direct3D 9 emulator.
- Ray-MMD lighting, material pipeline, shadows, environment, star streaks,
  ghosts, depth pipelines and auxiliary controller objects are not ported by
  these two adapters.
- The current Ray adapters target the WebGL `EffectComposer`. WGSL has a native
  WebGPU compile backend, while HLSL/MME still require reviewed semantic ports.
- `GPU_TESTED` covers the current browser/GPU path. Cross-device release testing
  is still required before a `PRODUCTION_READY` label.

## Release-policy follow-up

Capture and sign the deterministic image/performance matrix on representative
AMD, Intel and NVIDIA devices before promoting either Ray adapter from
`GPU_TESTED` to `PRODUCTION_READY`. Any additional upstream module remains a
separate reviewed adapter; the whole archive is never promoted implicitly.
