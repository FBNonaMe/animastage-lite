# Third-Party Notices

AnimaStage Lite integrates ideas and optional dependencies from external projects.
This file documents licensing boundaries for contributors and distributors.

## reze-design

- **Project:** [AmyangXYZ/reze-design](https://github.com/AmyangXYZ/reze-design)
- **License:** GNU Affero General Public License v3.0 (AGPL-3.0)
- **Usage in AnimaStage:** Architectural reference only (Director workflow, effect registry patterns, timeline UX).
- **Policy:** Do **not** copy AGPL source code, WGSL shaders, or verbatim UI into this repository.
  Implement features as clean-room code following AnimaStage conventions.

## reze-engine

- **Project:** [AmyangXYZ/reze-engine](https://github.com/AmyangXYZ/reze-engine)
- **License:** MIT
- **Usage in AnimaStage:** Optional runtime dependency for future WebGPU / VMD / physics experiments.
- **Policy:** May be added as an npm dependency when wired behind a feature flag.
  Include MIT copyright notice in this file when the dependency is added to `package.json`.
- **Director flag:** `sceneDirector.rezeEngineEnabled` prefers WebGPU for Scene FX when the browser supports it.
  This is a clean-room integration path — not a copy of AGPL reze-design.

## AnimaStage original modules

Scene Studio 2.0, Visual Quality 2.0, AI Scene Director, Animation Library, and Director Workflow
are original AnimaStage implementations unless otherwise noted in source file headers.

## AnimaStage Standalone reference bundle

- **Location:** `vendor/animastage-standalone/` (symlinked to `public/vendor/animastage-standalone/` for dev)
- **Source:** AnimaStage Standalone package (legacy `mmd_rtx.html` runtime)
- **Usage:** Reference and future porting only — not linked into the React app by default.
- **Full notices:** [`vendor/animastage-standalone/THIRD_PARTY_NOTICES.standalone.md`](vendor/animastage-standalone/THIRD_PARTY_NOTICES.standalone.md)

Notable bundled third-party material in the reference bundle:

| Component | License | Notes |
|-----------|---------|-------|
| StarRailNPRShader (anime-npr) | GPL-3.0-or-later | HLSL→GLSL port; GPL applies if linked into distributed builds |
| Ray-MMD 1.5.2 archive | MIT | Source archive + WebGL adapters in effects-library |
| Rapier (Aether Dynamics) | Apache-2.0 | `vendor/animastage-standalone/vendor/` (reference copy) |
| three.js (vendored r166 in bundle) | MIT | Legacy standalone pin; Lite uses npm `three` |
| Ray-MMD 1.5.2 (color grading adapter) | MIT | Ported to `src/postfx/rayMmd/` — see standalone bundle `assets/effects-library/` |
| OIDN WASM | Intel OIDN license | Denoise helper for path tracer experiments |
| reze-engine NPR helpers | MIT | Deep Space theme helpers |

Re-sync: `powershell -File scripts/sync-standalone-bundle.ps1`

