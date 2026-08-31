# Effect development

## Add a native effect

1. Create an `animestage.effect/v1` manifest with a stable reverse-domain ID
   and semantic version.
2. Declare the exact slot, renderers, languages, passes, capabilities,
   requirements, parameters, license and provenance.
3. Implement `create(context)` with `validate`, `activate`, optional
   `updateParameters`/`updateFrame`, and `deactivate` hooks.
4. Allocate GPU/listener resources only through the supplied resource scope.
5. Register the definition; never modify Shader Studio DOM as an effect API.

## Shader source

Use `ShaderSource` subclasses. Includes are package-relative, cycle checked,
depth bounded and source mapped. WGSL routes to WebGPU; GLSL routes to the
isolated WebGL2 compiler. HLSL/MME must first become a reviewed adapter.

Use optional parameter annotations:

```glsl
// @param exposure float min=0 max=4 step=0.01 default=1 label="Exposure"
uniform float exposure;
```

## Required tests

Test manifest rejection, dependency cycles, ownership, apply rollback,
parameter rollback, deterministic frame updates, resource disposal, compiler
failure rollback, preview isolation, preset/session restoration and repeated
add/remove cycles. A release adapter also needs real browser/GPU visual and
performance evidence; do not promote an entire upstream archive because one
adapter passed.
