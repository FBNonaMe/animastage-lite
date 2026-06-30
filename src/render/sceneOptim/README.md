## Scene Optimization Utilities — Complete Integration

### What was added

All functions from the external project (`webgl-scene-optim.js`) are integrated:

#### Structure
```
src/render/sceneOptim/
├── webglSceneOptim.ts       → 38 functions + 2 classes + all types
├── mainThreadScheduler.ts   → runWorkInSlices, scheduleIdleWork
├── index.ts                 → central export
└── USAGE_GUIDE.md          → detailed documentation
```

#### How to import

**Option 1: From the main render module**
```typescript
import {
  createOptimizedRenderer,
  freezeStaticObjectTree,
  DynamicResolutionGovernor,
  disposeMaterial,
} from '../render';
```

**Option 2: Directly from sceneOptim**
```typescript
import {
  createOptimizedRenderer,
  freezeStaticObjectTree,
} from '../render/sceneOptim';
```

---

### Available utilities

| Category | Functions | Use case |
|----------|-----------|----------|
| **Renderer** | `createOptimizedRenderer`, `applyPixelRatioCap`, `DynamicResolutionGovernor` | Create and tune the renderer |
| **Geometry** | `estimateGeometryBudget`, `createStaticBatchedGroup`, `createInstancedDecorations`, `freezeStaticObjectTree` | Geometry and draw-call optimization |
| **Materials** | `downgradeMaterial`, `applyMaterialDowngrade`, `clampTextureAnisotropy`, `auditTransparentMaterials` | Distance-based material downgrade |
| **Shadows** | `configureRendererShadows`, `fitDirectionalShadowCamera`, `applyShadowProxiesToMap`, `buildLowPolyProxyGeometry` | Shadow optimization |
| **Raycasting** | `createPickProxy`, `raycastPickProxies` | Invisible pick colliders |
| **Loading** | `createOptimizedGLTFLoader`, `optimizeLoadedGLTFScene`, `disposeMaterial`, `disposeObject3D` | Load and free GPU memory |
| **Analysis** | `estimateSceneComplexity`, `cleanupScene` | Scene complexity and full cleanup |
| **Scheduling** | `runWorkInSlices`, `scheduleIdleWork` | Spread heavy work across frames |

---

### Usage examples

**Create an optimized renderer:**
```typescript
const renderer = createOptimizedRenderer(document.body, {
  maxPixelRatio: 1.5,
  antialias: false,
  precision: 'mediump',
});
```

**Auto lower resolution when FPS drops:**
```typescript
const dprGov = new DynamicResolutionGovernor(renderer, {
  lowFps: 30,
  highFps: 56,
});

// In the render loop:
dprGov.tick(currentFps);
```

**Freeze static geometry:**
```typescript
freezeStaticObjectTree(cityProps, { skipSkinned: true });
```

**Distance-based material downgrade:**
```typescript
applyMaterialDowngrade(scene, {
  cameraPosition: camera.position,
  backdropDistance: 40,
  heroNames: ['character'],
});
```

**Shadow proxies for heavy meshes:**
```typescript
applyShadowProxiesToMap(scene, camera, { minTriangles: 5000 });
```

**Proper GPU memory cleanup:**
```typescript
disposeObject3D(oldModel, { scene, removeFromParent: true });
```

**Spread heavy work across frames:**
```typescript
await runWorkInSlices([
  () => processMaterials(mesh),
  () => applyQuality(mesh),
], 6);
```

---

### Highlights

- 38 functions + 2 classes ready to use
- Fully typed parameters and return values
- Constants: `PROXY_LAYER`, `MaterialTier`, `DEFAULT_MAX_ANISOTROPY`
- Does not change physics, animation, or timeline
- See `USAGE_GUIDE.md` for per-function examples
- Exported from `src/render/` and `src/render/sceneOptim/`

---

### Documentation

Full guide with examples:
```
src/render/sceneOptim/USAGE_GUIDE.md
```

---

### Ready to use

Import the functions you need and apply them to optimize your scene.
