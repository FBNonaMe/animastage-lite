# MME compatibility

AnimeStage does not emulate Direct3D 9, PMD plugins or MikuMikuEffect. MME
source is handled in three explicit levels:

1. **Preserved source** — the verified original archive and directory layout.
2. **Structural inspection** — includes, parameters, techniques, passes,
   render states and known semantics are parsed without executing code.
3. **Reviewed adapter** — an effect becomes runnable only after its behavior is
   deliberately implemented against AnimeStage render services and tested.

There is no blind HLSL-to-GLSL string replacement. DX9 semantics, controller
objects, render targets, implicit states and multi-pass ordering require an
adapter. Unknown or unresolved semantics remain visible in inspection reports
and keep the source metadata-only.

Ray-MMD 1.5.2 is pinned to commit
`a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8`. The full source is preserved
under its MIT terms. Color Grading and HDR Bloom are reviewed WebGL2 adapters;
the rest of Ray-MMD is not presented as web-compatible.

KH40 sources are indexed by official repository URL and revision. Repository
rules prohibit intact redistribution, so the standalone contains metadata and
license records only, not copied archives.
