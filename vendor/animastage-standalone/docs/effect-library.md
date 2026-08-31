# Effect Library

The Effects Library combines native AnimeStage effects, reviewed adapters and
non-executable source references in one registry. Every entry has an ID,
semantic version, author, status, categories, renderer/language declarations,
requirements, license and provenance.

Runtime status is intentionally strict:

- `PRODUCTION_READY`: shipped native effect with completed acceptance.
- `GPU_TESTED`: reviewed adapter tested on the recorded browser/GPU path.
- `VERIFIED` / `DISCOVERED`: source evidence only; no execute button.
- `QUARANTINED` / `INCOMPATIBLE`: indexed for diagnostics but blocked.

Downloaded archives are pinned, hashed, inspected before extraction and split
into immutable `source`/`original`, reviewed `adapted`, and `quarantine`
locations. Nested archives and other unsafe/unsupported files are isolated.
Metadata-only licenses are never silently upgraded to bundle permission.

Run `node tools/effects/validate-effect-library.mjs` to validate unique IDs,
provenance, license policy, the pinned Ray revision and the original archive
SHA-256. Run `node tools/effects/verify-effect-source.mjs raycast.ray-mmd` for
the full extracted-file inventory verification.

`node tools/effects/build-effects-index.mjs` rebuilds the deterministic search
index. `node tools/effects/generate-previews.mjs` rebuilds the isolated GPU job
manifest; Shader Studio executes those jobs on the target device and persists
the resulting PNG Blobs.
