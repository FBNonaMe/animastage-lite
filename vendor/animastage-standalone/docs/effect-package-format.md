# AnimaStage effect package format

## Manifest

Runtime effects use schema `animestage.effect/v1`. A manifest is normalized and
deep-frozen before it enters the registry.

```js
{
  schema: "animestage.effect/v1",
  id: "publisher.package.effect-name",
  version: "1.0.0",
  name: "Effect name",
  description: "What this scoped adapter does",
  author: { name: "Author", original: "Original author", url: "https://..." },
  kind: "post-process",
  slot: "post.unique-slot",
  status: "ADAPTED",
  categories: ["post processing"],
  tags: ["bloom"],
  renderers: ["webgl2", "raster"],
  languages: ["glsl", "native"],
  capabilities: ["live-parameters", "transactional-rollback"],
  dependencies: [{ id: "publisher.dependency", range: "^1.0.0", optional: false }],
  passes: [{
    id: "package.pass-id",
    kind: "post-process",
    reads: ["scene-color"],
    writes: ["graded-color"],
    after: [],
    before: []
  }],
  license: {
    type: "MIT",
    redistributionAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: true,
    noticeFiles: ["LICENSE.txt"]
  },
  textures: [],
  preview: {
    enabled: true,
    renderer: "isolated-webgl2",
    width: 320,
    height: 180,
    background: "#11101f",
    cacheRevision: "adapter1"
  },
  entryPoints: {
    postPass: "package.pass-id",
    original: "Shader/Original.fxsub",
    adapted: "adapted/effect-pass.js"
  },
  compatibility: {
    sourceRuntime: "MikuMikuEffect / Direct3D 9",
    adapterRuntime: "AnimaStage EffectComposer / WebGL2",
    scope: "Explicit supported subset"
  },
  parameters: [],
  provenance: {
    sourceUrl: "https://...",
    downloadUrl: "https://...",
    sourceType: "official-github-adapted",
    archiveVersion: "1.0.0",
    revision: "full commit hash",
    sha256: "64 lowercase hexadecimal characters",
    licenseUrl: "https://...",
    terms: "License and redistribution note"
  }
}
```

IDs are lowercase dotted/dashed identifiers. Versions use semantic versioning.
Kinds currently include material, post-process, lighting, environment, weather,
particle, camera, utility and preset-stack.

## Reflected parameters

Each parameter has `id`, `type`, `label` and `default`. Numeric parameters can
also specify `min`, `max`, `step` and `unit`; enum parameters require `options`.
The supported types are:

- `float`, `int`, `bool`, `angle`
- `vec2`, `vec3`, `vec4`, `range`, `matrix`
- `color`, `enum`
- `texture`, `cubemap`, `curve`

Unknown parameters, invalid enum values, malformed vectors, non-finite numbers
and values outside declared bounds are rejected before they reach the renderer.
Validated values are immutable. The Effects Library UI reflects the manifest
into controls automatically, so an adapter does not need a separate hard-coded
inspector.

## Preview contract

Preview dimensions must be integers from 32 through 2048 and the background is
a `#RRGGBB` color. Enabling preview metadata does not make an effect runnable:
the reviewed adapter must implement isolated rendering and return a Blob marked
`isolated: true`. The runtime rejects any result that does not make that
isolation guarantee. `cacheRevision` must change whenever an adapter changes
the visual output without changing the effect package version.

## Implementation contract

An implementation exposes `create(context)` and returns lifecycle hooks:

```js
{
  restoreOnDisable: false,
  validate() {},
  activate() {},
  updateParameters(nextValues) {},
  deactivate() {}
}
```

`validate` must fail before destructive GPU work when a renderer, target or pass
is unavailable. `activate` and `updateParameters` may throw; the runtime records
the diagnostic and rolls back. `deactivate` must release only resources or
layers owned by that instance.

## Package layout

```text
third-party/<owner>/<repository>/<revision>/
  original/             immutable extracted source
  adapted/              AnimaStage ports and adapter notes
  provenance.json       source URL, revision and hashes
  inspection.json       accepted, quarantined and rejected files
  archive.zip           verified official archive when redistribution permits
```

Executable files from archives are never launched. Unsupported source stays in
the immutable package for provenance or is isolated according to the inspection
record. A package must not present an unported HLSL/DX9 source as a native WebGL
effect.

## Effect Stack and pass graph

An ordered runtime stack uses `animestage.effect-stack/v1`; portable presets
use `animestage.effect-stack-preset/v1`. Entries store the package ID and
semantic version, explicit owner and target identities, parameters, label and
enabled state. They never store renderer pointers.

Before a stack is committed, its declared passes are built into an immutable
`animestage.effect-graph/v1`. The graph rejects missing resources, unresolved
ordering constraints, cycles and conflicting output writers before the live
composer is changed. Full-stack restore is transactional: if one layer fails,
every partially activated layer is removed and the previous stack is rebuilt.

## Shader source and MME inspection

`ShaderSource` has explicit GLSL, WGSL, HLSL, MME-FX and native variants. It
normalizes line endings, rejects package-path escapes and NUL bytes, creates a
stable cache key, resolves includes with cycle/depth checks, and produces a
line-level source map for compiler diagnostics.

Imported `.fx` files receive a structural MME report covering parameters,
semantics, techniques, passes, render states and explicit supported/partial/
unsupported features. This report is metadata only. Raw HLSL/MME remains
non-executable until a reviewed backend adapter exists.
