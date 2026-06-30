# Store graphics for Google Play

Required assets before submitting **AnimaStage Lite** (`com.webmmd.suite`).

## Required files

| Asset | Size | Format | Filename suggestion |
|-------|------|--------|---------------------|
| App icon | **512 × 512** | 32-bit PNG | `icon-512.png` |
| Feature graphic | **1024 × 500** | JPG or PNG | `feature-graphic-1024x500.png` |
| Phone screenshots | min **2** | JPG or PNG, max 8 MB each | `screenshot-01.png`, `screenshot-02.png` |

## Screenshot tips

- Use **portrait** captures (9:16) — the app is portrait-first.
- Show: 3D viewport with model, timeline, or FX panel.
- Avoid copyrighted characters in marketing unless you own the rights.
- Minimum long edge: **1080 px** recommended.

## Source art in repo

- Launcher icon layers: `android/app/src/main/res/mipmap-*/ic_launcher*.png`
- Scale `mipmap-xxxhdpi/ic_launcher.png` to 512×512 for Play icon.

## Feature graphic ideas

- Dark background `#0f1115`
- Text: **AnimaStage Lite** + tagline *MMD studio in your pocket*
- Optional: neon MMD character from splash (`android/app/src/main/res/drawable/splash.png`)

## After export

Upload directly in Play Console → **Main store listing** → Graphics.

Do not commit large PNGs to git if > 2 MB; keep sources here locally.
