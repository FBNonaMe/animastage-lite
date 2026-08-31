# AnimaStage Standalone bundle (vendored reference)

Imported from `E:\1122\AnimaStage-Standalone\AnimaStage-Standalone` for modules that are **not yet ported** into the React/Vite Lite app (`src/`).

**Do not import these files directly into production React components without a porting plan.** They target the legacy standalone runtime (`mmd_rtx.html` + global scripts).

## Contents

| Path | Description |
|------|-------------|
| `anime-npr/` | Star Rail–style NPR character pipeline (GPL-3.0 port) |
| `animestage-next/` | Effects platform (registry, MME compat, WebGL2/WebGPU renderers) |
| `assets/effects-library/` | Ray-MMD archives, catalogs, licenses, previews |
| `smart-pose/` | Smart pose helpers |
| `physics/` | Aether / Rapier standalone integration |
| `offline-render/` | Frame-by-frame HQ export helpers |
| `performance/` | GPU/CPU budget probes |
| `lut/` | Color LUT assets |
| `vendor/oidn/` | OIDN denoise WASM (optional path tracer denoise) |
| `docs/` | Effects architecture, MME compatibility, shader studio notes |
| `*.js` (root) | RTX engine, weather, mocap, timeline, UI controller |
| `mmd_rtx.html` | Full standalone entry (reference) |

## Re-sync from source

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-standalone-bundle.ps1
```

## Licensing

See `THIRD_PARTY_NOTICES.standalone.md` and root `LICENSE` (GPL-3.0 for Anime NPR portions).
Lite app code in `src/` remains separate unless explicitly ported with license headers.

## Runtime preview (standalone HTML)

```powershell
cd vendor/animastage-standalone
node serve.mjs
# or Start-Web-Server.cmd
```

Open `mmd_rtx.html` in the browser.
