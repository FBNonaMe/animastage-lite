# AnimaStage Effects Library

This directory is managed by the versioned Effects Platform.

- `builtin/` contains AnimaStage-owned effects.
- `third-party/` contains packages grouped by original author/ecosystem.
- `imported/` contains user-indexed packages.
- `generated/` contains generated adapters only.
- `previews/` and `cache/` are disposable derived data.
- `licenses/` contains normalized license and terms metadata.

Third-party packages use `source/`, immutable `original/`, and separate
`adapted/` directories. Files in `original/` must never be rewritten.
