# Adapter status

The verified original source remains immutable.

## Runtime-tested adapters

- `ray-color-grading-pass.js` — WebGL/EffectComposer adaptation of the color-correction and tone-operator formulas from `Shader/ColorGrading.fxsub`. Color-space output remains owned by AnimaStage's final `OutputPass`, avoiding double sRGB conversion.
- `ray-bloom-pass.js` — WebGL/EffectComposer adaptation of `Shader/PostProcessBloom.fxsub`, retaining five half-resolution levels, threshold modes, separable Gaussian blur and weighted recombination.

This is a scoped backend adaptation, not a claim that the complete Ray-MMD DX9 pipeline runs unchanged in WebGL.
