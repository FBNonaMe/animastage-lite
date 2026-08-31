# Standalone bundle import

AnimaStage Standalone modules that are **not in `src/`** are vendored under:

```
vendor/animastage-standalone/
public/vendor/animastage-standalone/   ← junction → vendor (Vite static)
```

## What was imported (~136 MB, 1093 files)

| Module | In Lite `src/`? |
|--------|-----------------|
| **anime-npr** — Star Rail NPR shaders | No |
| **animestage-next** — effects platform / MME | No |
| **assets/effects-library** — Ray-MMD, catalogs | **Partial** — catalog + Ray-MMD grade in FX panel |
| **smart-pose** | No |
| **offline-render** | No (Lite has WebCodecs export) |
| **oidn** denoise WASM | No |
| **rtx-engine**, **weather-system**, **mocap-system** (root `.js`) | Partial (separate TS implementations) |
| **physics/** standalone Rapier glue | Partial (`src/physics`) |

## Use in code

```ts
import { STANDALONE_PATHS } from '@/src/config/standaloneBundle';
// fetch(`${STANDALONE_PATHS.effectsLibrary}/catalog/...`)
```

Vite alias: `@standalone` → `vendor/animastage-standalone`

## Re-sync from `E:\1122\...`

```bash
npm run sync:standalone
```

## Preview legacy standalone UI

```bash
cd vendor/animastage-standalone
node serve.mjs
```

Open `http://localhost:…/mmd_rtx.html`

## Integrated into Lite (React)

| Standalone module | Lite path |
|-------------------|-----------|
| Ray-MMD Color Grading | `src/postfx/rayMmd/` |
| Effects catalog loader | `src/standaloneEffects/` |
| FX UI | FX Studio → **Standalone effects** |

Quick try: FX Studio → **Standalone effects** → preset **ACES film**.

## License

Anime NPR is **GPL-3.0**. See `vendor/animastage-standalone/THIRD_PARTY_NOTICES.standalone.md` before shipping ported code.
