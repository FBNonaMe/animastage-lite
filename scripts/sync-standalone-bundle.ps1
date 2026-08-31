# Sync AnimaStage Standalone reference bundle into vendor/animastage-standalone
param(
  [string]$Source = "E:\1122\AnimaStage-Standalone\AnimaStage-Standalone",
  [string]$Dest = (Join-Path $PSScriptRoot "..\vendor\animastage-standalone")
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $Source)) {
  Write-Error "Source not found: $Source"
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$dirs = @(
  'anime-npr', 'animestage-next', 'smart-pose', 'physics', 'offline-render',
  'performance', 'lut', 'docs', 'tools'
)
foreach ($d in $dirs) {
  $from = Join-Path $Source $d
  if (Test-Path $from) {
    robocopy $from (Join-Path $Dest $d) /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  }
}

New-Item -ItemType Directory -Force -Path (Join-Path $Dest "assets") | Out-Null
robocopy (Join-Path $Source "assets\effects-library") (Join-Path $Dest "assets\effects-library") /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

New-Item -ItemType Directory -Force -Path (Join-Path $Dest "vendor") | Out-Null
robocopy (Join-Path $Source "vendor\oidn") (Join-Path $Dest "vendor\oidn") /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

$rootFiles = @(
  '.animastage-package-manifest.json', 'anim-timeline.js', 'anime-npr-post.js', 'anime-npr.js',
  'anime-toon.js', 'animestage-ui-controller.js', 'asset-zip-extractor.js', 'engine2-fx-pass.js',
  'map-builder-optim.js', 'map-light-shadow-optim.js', 'mmd-character-motion.js', 'mmd-universal-rig.js',
  'mmd_rtx.html', 'mocap-system.js', 'oidn-denoise.js', 'oidn-fallback.js', 'patch-rtx-renderer.js',
  'rtx-engine.js', 'rtx-lens-system.js', 'rtx-light-sampler.js', 'rtx-material-studio.js',
  'rtx-render-pipeline-controller.js', 'rtx-render-quality.js', 'serve.mjs', 'Start-Web-Server.cmd',
  'weather-fog-pass.js', 'weather-surface.js', 'weather-system.js', 'LICENSE'
)
foreach ($f in $rootFiles) {
  $from = Join-Path $Source $f
  if (Test-Path $from) { Copy-Item $from (Join-Path $Dest $f) -Force }
}
Copy-Item (Join-Path $Source "THIRD_PARTY_NOTICES.md") (Join-Path $Dest "THIRD_PARTY_NOTICES.standalone.md") -Force

$publicLink = Join-Path $PSScriptRoot "..\public\vendor\animastage-standalone"
$publicVendor = Join-Path $PSScriptRoot "..\public\vendor"
New-Item -ItemType Directory -Force -Path $publicVendor | Out-Null
if (Test-Path $publicLink) { Remove-Item $publicLink -Force -Recurse -ErrorAction SilentlyContinue }
cmd /c mklink /J "$publicLink" "$Dest" | Out-Null

Write-Host "Synced standalone bundle -> $Dest"
Write-Host "Public junction -> $publicLink"
