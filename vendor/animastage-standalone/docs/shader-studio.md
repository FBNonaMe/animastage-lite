# Shader Studio

Shader Studio is the real Effects Platform workspace mounted inside
`mmd_rtx.html`. It is not a demo page. The workspace has Library, Stack,
Inspector, Graph, Performance, Previews, Source and Diagnostics views.

## Native source workbench

The Source view contains a native shader editor with WGSL/WebGPU and
GLSL/WebGL2 routes. Compilation is lazy and isolated:

- GLSL compiles and links on a private WebGL2 canvas. It never touches the
  live renderer, scene, camera or composer.
- WGSL creates a real `GPUShaderModule` on a lazily requested WebGPU device and
  consumes `getCompilationInfo()` messages with line and column information.
- HLSL and MME `.fx` remain structural source inputs. They are never executed
  or mislabeled as GLSL.
- `@param` annotations and native bindings/uniforms are reflected into a stable
  parameter contract.

`Compile & stage` is an atomic double-buffer operation. A successful compile
becomes the current workbench revision. A failed compile records diagnostics
and preserves the previous revision. Auto compile uses the same path after a
short debounce, so partially typed source cannot corrupt the viewport.

## Effect Stack

The Stack is ordered, deterministic and transactional. Reorder, duplicate,
enable, disable, remove, clear, import and export all go through the runtime
instead of changing renderer objects directly. Parameters are validated before
the adapter sees them. Apply and live-parameter failures restore the captured
state.

## Previews and diagnostics

Preview rendering uses a separate WebGL renderer, scene, camera and composer.
Results are stored in a bounded memory LRU and, when IndexedDB is available, a
persistent Blob store. Cache keys include effect version, parameters,
dimensions, renderer, revision and seed. Diagnostics identify effect, source,
backend, stage and compiler line/column without flooding the normal console.
