# Effects Platform final report

## Release state

The Effects Platform is wired into the production `mmd_rtx.html` entry point.
Version `2.0.0-effects-final` contains registry, dependency resolution,
ownership, deterministic stack/graph, transactional apply and parameter
rollback, resource tracking, archive quarantine, previews, profiling,
session persistence, native shader workbench and release acceptance reporting.

## Library inventory

| Item | Count |
| --- | ---: |
| Indexed catalog entries | 12 |
| Runnable effects/adapters | 5 |
| Native production-ready material effects | 3 |
| GPU-tested Ray-MMD adapters | 2 |
| Official third-party source references | 7 |
| Bundled verified upstream archives | 1 |
| Metadata-only licensed sources | 6 |
| Preserved Ray-MMD archive files | 857 |
| Rejected nested archive entries | 2 |
| MME/FX files structurally parsed | 515 |
| Parser errors | 0 |
| Known unresolved literal include references | 2 |

The Ray-MMD 1.5.2 archive SHA-256 is
`5b8c095a4d77c0a6f259829c2cbdb1a279a5d993217e3f277f578a9cf7328494`.
Original source and reviewed adapters are stored separately.

## Runtime compatibility

- Native materials: Raster, Anime NPR, RTX material bridge; production-ready.
- Ray Color Grading and HDR Bloom: WebGL2 EffectComposer adapters; GPU-tested
  in the real application and isolated-preview path.
- WGSL user source: native WebGPU module compilation with line/column
  diagnostics, lazy adapter/device creation and atomic workbench staging.
- GLSL user source: isolated WebGL2 compile/link with atomic staging.
- HLSL/MME: safe source preservation and structural inspection only. Execution
  requires a reviewed adapter.

## Verification

The release suite covers malformed manifests and packages, unsafe paths,
dependency cycles, ownership conflicts, apply rollback, live-parameter
rollback, deterministic frames, stack/graph persistence, 100-cycle resource
cleanup, performance budgets, image-diff evidence contracts, MME inspection,
preview isolation/deduplication/persistence, native compiler caching and failed
shader rollback. Library validation also checks provenance, license policy,
revision and archive hash.

Real browser acceptance is repeated on the current AMD WebGL2/WebGPU device.
Adapter labels intentionally remain `GPU_TESTED` until separately signed AMD,
Intel and NVIDIA image/performance evidence exists. This is a release policy,
not an unimplemented runtime path; the platform does not claim untested
hardware coverage.

## Deliberate boundaries

AnimeStage is not a Direct3D 9/MME emulator. It does not execute arbitrary MME
archives, nested tools or unknown controller semantics. External sources whose
licenses prohibit redistribution remain catalog references. These boundaries
prevent a shader package from corrupting the live scene or silently violating
an author’s terms.
