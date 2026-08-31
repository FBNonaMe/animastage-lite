# Third-Party Notices

AnimeStage incorporates and adapts third-party open-source software. This
document lists that software and the licenses under which it is used. The full
license texts are in `docs/licenses/`.

---

## StarRailNPRShader

- **Project:** StarRail NPR Shader — Fan-made shaders for Unity URP attempting
  to replicate the shading of Honkai: Star Rail.
- **Author / Copyright:** Copyright (C) 2023 Stalo `<stalowork@163.com>`
- **Repository:** https://github.com/stalomeow/StarRailNPRShader
- **License:** GNU General Public License v3.0 (GPL-3.0-or-later)
- **License text:** [`docs/licenses/StarRailNPRShader-LICENSE.md`](docs/licenses/StarRailNPRShader-LICENSE.md)
- **Attribution and compliance record:** [`docs/licenses/StarRailNPRShader.md`](docs/licenses/StarRailNPRShader.md)

### Usage in AnimeStage

AnimeStage's **Anime NPR** render mode is a **source port** of the
StarRailNPRShader HLSL shading mathematics into WebGL2 GLSL ES 3.00, executed
inside AnimeStage's Three.js renderer. The lighting equations (ramp diffuse
with light-map AO, Blinn–Phong stylized specular with light-map threshold,
screen-space rim-light mask, and the head-direction face SDF shadow) are
translated from the original HLSL, preserving their mathematics and functional
behavior. Unity/URP-specific engine plumbing was rewritten for Three.js.

Because AnimeStage links and distributes this GPL-3.0 shading logic, the
combined AnimeStage work that includes the Anime NPR engine is licensed under
**GPL-3.0-or-later**. See `LICENSE` (a verbatim copy of GPL-3.0) and the
per-file port record in
[`docs/ports/StarRailNPRShader-Port-Map.md`](docs/ports/StarRailNPRShader-Port-Map.md).

Ported AnimeStage source files carry a GPL header identifying the derivation
and the original copyright. Modifications are documented in the port map.

### No affiliation / trademark note

StarRailNPRShader and AnimeStage are fan projects and are not affiliated with,
endorsed by, or sponsored by miHoYo / HoYoverse / COGNOSPHERE. "Honkai: Star
Rail" is a trademark of its respective owner and is referenced only to describe
the visual style the shaders emulate.

---

## Ray-MMD 1.5.2 source archive

- **Project:** Ray-MMD
- **Author / Copyright:** Copyright (C) 2016-2018 Rui
- **Repository:** https://github.com/ray-cast/ray-mmd
- **Pinned release:** `1.5.2` (`a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8`)
- **License:** MIT
- **Archive SHA-256:** `5b8c095a4d77c0a6f259829c2cbdb1a279a5d993217e3f277f578a9cf7328494`
- **License text:** [`assets/effects-library/licenses/ray-mmd-MIT.txt`](assets/effects-library/licenses/ray-mmd-MIT.txt)

The original HLSL/Direct3D 9 MME source is retained byte-for-byte for
provenance and future adapter work. It is not presented as a WebGL/WebGPU
runtime effect. AnimaStage includes two separately identified, GPU-tested,
scoped WebGL adapters derived from that source: Ray-MMD Color Grading and
Ray-MMD HDR Bloom. They do not claim full Ray-MMD pipeline compatibility and
are not yet labelled production-ready.

The KH40 repositories listed in the Effects Library are source references
only. Their unchanged archives are not bundled because the repository rules
prohibit intact redistribution; MES40 and Shadekai also prohibit commercial
use.

---

## Other bundled components

| Component | License | Notes |
|---|---|---|
| Rapier JavaScript 0.20.0 (`@dimforge/rapier3d-compat`) | Apache-2.0 | Aether Dynamics rigid-body/contact backend; upstream license at `vendor/aether-dynamics/rapier/LICENSE-RAPIER.txt` |
| three.js (r166, vendored) | MIT | rendering library |
| Three-js-Anime-Shader (WuWa-style toon) | MIT | earlier Anime Toon model, retained as "Legacy Anime" |
| reze-engine (M_Face NPR helpers) | MIT | "Deep Space" theme helpers |
| UnityURPToonLitShaderExample (NiloCat) | MIT | original toon cel-band / outline math |
| Donitzo three.js volume renderer | MIT | referenced for volumetric fog |

MIT components remain under MIT; their notices are preserved in the respective
adapted source files. The GPL-3.0 obligation applies to the combined work as a
whole once the GPL-licensed Anime NPR engine is included in a build.
