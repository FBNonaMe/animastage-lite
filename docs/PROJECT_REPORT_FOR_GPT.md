# AnimaStage Lite — Full Project Report (for analysis)

Copy this file into ChatGPT / Claude and ask: "analyze the project based on this document."

---

## 1. What this project is

**AnimaStage Lite** is a web app (browser studio) for working with **MikuMikuDance (MMD)** without installing MMD on Windows. Users open the site, load **PMX/PMD** models and **VMD** motions, configure the scene, physics, camera, timeline, and can **export video** (including vertical **9:16** for Shorts/Reels/TikTok).

| | Value |
|---|---|
| npm name | `animastage-lite@1.0.0` |
| Repository | https://github.com/FBNonaMe/animastage-lite |
| Demo | https://animastage-lite.app |
| Studio | https://animastage-lite.app/app |
| Local folder (working name) | `web-mmd-suite` |

**Important:** there is a separate product **AnimaStage Pro** (different repo, heavier render pipeline). In Lite, the sidebar **"Pro"** item is **not** a separate Pro site — it is **extended modules inside Lite** (mocap, AI, collab, animation layers).

| | Lite (this repo) | Pro (sibling product) |
|---|---|---|
| Site | animastage-lite.app | animastagepro.dev |
| GitHub | FBNonaMe/animastage-lite | gtausa197-svg/AnimaStage-Pro |
| Focus | Fast preview, Shorts, low-end PCs | Full cinematic pipeline |
| Render | WebGL 2 + RTX Lite (bloom, DOF, weather) | Full EffectComposer (SSAO, DOF, volumetrics) |
| Characters | Single scene focus | Multiple characters, VMD per character |
| Timeline | VMD, dopesheet, curves, export VMD | Dual timeline (VMD + cinematic camera) |

---

## 2. Tech stack

| Layer | Technologies |
|------|------------|
| UI | React 19, TypeScript, Tailwind CSS 4, Lucide icons |
| Build | Vite 6 |
| 3D | Three.js 0.184, React Three Fiber, @react-three/drei, postprocessing |
| MMD | `mmd-parser`, three-stdlib (MMD loader) |
| Physics | Bullet via Ammo.js WASM (+ Jolt code in `src/physics/`) |
| Video | WebCodecs + mp4-muxer (HQ), MediaRecorder (Live) |
| AI (optional) | Google Gemini (`@google/genai`) |
| Mocap | MediaPipe (`@mediapipe/tasks-vision`) |
| Collab | Yjs + y-webrtc |
| Routing | Custom SPA router without React Router (`RootRouter.tsx`) |

**Browser requirements:** WebGL 2. For MP4 HQ, Chrome/Edge is preferred (WebCodecs H.264).

---

## 3. Entry points and pages

```
/              → LandingPage.tsx (marketing, CTA)
/app           → App.tsx (main studio)
/app?demo=1    → studio with Miku preset and hint
```

- `src/main.tsx` — React mount
- `src/RootRouter.tsx` — landing vs studio routing
- `index.html` — SEO, Open Graph, viewport-fit=cover

**Local dev:**

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # → dist/
npm run lint     # tsc --noEmit
```

---

## 4. Studio architecture

```
┌──────────────────────────────────────────────────────────┐
│ TopMenu — File, FX, physics, export (desktop / mobile)   │
├──────────┬───────────────────────────────────────────────┤
│ Sidebar  │ Viewport (R3F Canvas, MMDModelWrapper)        │
│ models,  │ 3D scene, gizmo, background, 16:9 / 9:16      │
│ morphs,  ├───────────────────────────────────────────────┤
│ Pro      │ EditorTimelineShell                           │
│ panels   │ Timeline | Dopesheet | Curves                 │
└──────────┴───────────────────────────────────────────────┘
│ MobileStudioBar (<768px): Menu, Panel, Play, Time, FX    │
└──────────────────────────────────────────────────────────┘
```

**State hub:** `App.tsx` — large `AppState` (models, frames, physics, FX, camera, timeline).

**Key files:**

| File | Role |
|------|------|
| `App.tsx` | App state, collab, video recording, UI layout |
| `components/MMDModelWrapper.tsx` | PMX/VMD, skeleton, morphs, physics, animation layers |
| `components/Viewport.tsx` | Canvas, overlays, drag-drop |
| `components/Timeline.tsx` | Timeline, transport, keyframes |
| `components/TimelineLogic.ts` | Track logic and interpolation |
| `components/CameraLogic.ts` | Camera keys |
| `components/Sidebar.tsx` | Scene panel and Pro modules |
| `components/TopMenu.tsx` | File/FX menu |
| `templates/animationTemplates.ts` | Motion templates (dance, camera, emote…) |
| `video/mmdVideoRecorder.ts` | MP4 export |
| `hooks/useVideoRecorder.ts` | Live/HQ recording |
| `hooks/useCollab.ts` | Collaboration |
| `mocap/videoMocap.ts` | Video → keys |
| `ai/motionAi.ts` | Gemini → keys |
| `collab/collabSync.ts` | Yjs/WebRTC sync |
| `types.ts` | TypeScript types for AppState |

---

## 5. Core features

### Scene and models
- Drag & drop PMX, PMD, VMD, textures, HDR
- Presets (Miku, Kizuna) or custom model
- Gizmo: root move, bone rotation
- Morphs (eyes, mouth, brows)

### Animation
- VMD playback
- Timeline: morphs + simplified bones + camera track
- Dopesheet and curve editor (Bezier)
- Templates: Studio / +Body / +Camera / +Combo / Templates
- VMD export (`editor/vmdExport.ts`)
- Undo/redo, stretch, simplify track

### Camera
- Free (orbit) and MMD (VMD / keyframes)
- Camera bookmarks, 2.39 letterbox
- 16:9 ↔ 9:16 toggle (FX and quality tuned for Shorts)

### Visual (RTX Lite)
- Bloom, DOF, vignette, weather, HDR IBL, toon + outline
- FX panel in TopMenu

### Physics
- Bullet WASM, modes: `anytime` / `playtime` / `off`
- Wind, MMD Lite presets

### Video
- MP4 HQ — WebCodecs
- Live — MediaRecorder
- Clean frame without gizmo/grid
- 1080×1920 in 9:16 mode

### Sidebar → Pro (modules inside Lite)
| Module | Path | Purpose |
|--------|------|---------|
| Animation layers | `editor/animationLayers.ts` | Layer animations, solo/mute |
| Mocap | `mocap/videoMocap.ts` | Video → keys (MediaPipe) |
| AI motion | `ai/motionAi.ts` | Gemini → keys |
| Collab | `collab/`, `hooks/useCollab.ts` | Yjs/WebRTC |

---

## 6. Folder structure

```
web-mmd-suite/
├── src/                          # ~145 .ts/.tsx files
│   ├── App.tsx
│   ├── RootRouter.tsx
│   ├── types.ts
│   ├── pages/LandingPage.tsx
│   ├── components/
│   │   ├── MMDModelWrapper.tsx
│   │   ├── Viewport.tsx
│   │   ├── Sidebar.tsx, TopMenu.tsx
│   │   ├── Timeline.tsx, TimelineToolsBar.tsx
│   │   ├── TemplatePicker.tsx, MobileTemplateSheet.tsx
│   │   ├── MobileStudioBar.tsx
│   │   └── editor/               # Dopesheet, Curves, AdvancedStudioPanel
│   ├── hooks/
│   ├── editor/                   # undo, vmd export, clips
│   ├── templates/
│   ├── video/
│   ├── mocap/, ai/, collab/
│   ├── physics/                  # Jolt worker (parallel to Ammo)
│   ├── postfx/, visualFx/, camera/, utils/
│   └── main.tsx
├── docs/
│   ├── ANIMASTAGE_LITE.md
│   ├── REZE_INTEGRATION.md
│   └── PROJECT_REPORT_FOR_GPT.md   # this file
├── public/                       # studio-screenshot.png, static assets
├── android/                      # native shell (not the main web app)
├── README.md, SECURITY.md
├── .env.example
└── package.json
```

**Note:** `AnimeStageLite/animastage-lite/` is an outdated copy. **Active code lives in the root `src/`.**

---

## 7. Application state (AppState)

One large React state in `App.tsx` (no Redux):

- `models[]` — PMX, keyframes, VMD flags, morphs, layers
- `currentFrame`, `maxFrames`, `isPlaying`, `playSpeed`
- `physicsMode`, `mmdLite`
- `cameraMode`, `cameraKeyframes`, camera VMD
- `visualFx`, `rtxSettings`, `characterQuality`, `renderTier`
- `sceneBackground`, `sceneHdr`
- `timelineActiveTrack`
- UI: `showLeftSidebar`, `showTimelinePanel`, mobile nav state

Playhead: `utils/playhead.ts` + ref for smooth rAF.

---

## 8. UI: desktop vs mobile

**Breakpoint:** `max-width: 767px` (`hooks/useMediaQuery.ts` → `useIsMobileStudio()`).

| Area | Desktop (≥768px) | Mobile (<768px) |
|---------|------------------|-----------------|
| Sidebar | Column, collapse | Drawer + overlay |
| TopMenu | Dropdown File/FX | Hamburger + sheets |
| Timeline tools | 5× TemplatePicker + Layer + Clear + Frame | **Templates** button → bottom sheet (`MobileTemplateSheet`) |
| Timeline tracks | Left list (w-56) | Horizontal chips, one active track |
| Bottom bar | — | `MobileStudioBar`: Menu, Panel, Play, Time, FX |
| Viewport | Full labels | Compact buttons |

**Dev principle:** desktop in `hidden md:flex` / `variant="desktop"`; mobile changes must not break desktop.

**Recent mobile work:**
- Timeline adaptation (narrow frames, track chips)
- Portal for TemplatePicker on desktop (menus not clipped)
- Mobile: one bottom sheet instead of 5 dropdown menus
- iPhone safe area (`viewport-fit=cover`, env(safe-area-inset-*))

---

## 9. Environment variables

```env
VITE_GEMINI_API_KEY=...           # AI motion (optional)
VITE_COLLAB_SIGNALING=wss://...   # WebRTC signaling (optional)
```

`.env` is gitignored. `VITE_*` values end up in the client bundle — do not commit production keys.

---

## 10. Dependencies and licenses

- Lite code — open source (LICENSE in repo)
- PMX/VMD/textures — rights belong to content authors
- Pro — separate repository and license

---

## 11. Tests and code quality

- Almost no automated tests
- `npm run lint` = `tsc --noEmit` only
- Large monolith `App.tsx` (~1000 lines)
- Two physics stacks (Ammo + Jolt) — know which one is active in production

---

## 12. Deep analysis areas (tasks for AI)

1. Refactor `App.tsx` — context, split state
2. 9:16 performance on weak GPUs
3. Fallback when WebCodecs is unavailable
4. Client-side API key security
5. Mobile UX — little space for viewport + timeline
6. Test coverage for critical paths (VMD load, export)
7. Lite vs Pro consistency — feature roadmap
8. Accessibility (keyboard, screen readers)
9. i18n (UI is English-only)
10. Remove/isolate legacy `AnimeStageLite/` folder

---

## 13. Sample analysis prompts

```
Based on this report:
1. Draw a data-flow diagram from PMX load to MP4 export.
2. Find the 10 biggest technical debts and prioritize them.
3. Propose an App.tsx refactor plan without breaking features.
4. Compare Lite vs Pro and draft a roadmap.
5. What is still not adapted for 375px mobile?
6. Assess security risks (VITE_* in bundle, collab).
```

---

## 14. One-line summary

**Browser MMD studio on React + Three.js** with timeline, Bullet physics, RTX Lite FX, 9:16 Shorts export, and optional mocap/AI/collab modules; landing at `/`, studio at `/app`; separate **AnimaStage Pro** product; mobile studio layout added recently, desktop should behave as before.

---

*Document generated for GPT/Claude handoff. Repository: animastage-lite / web-mmd-suite.*
