# Bump Android version across project files.
# Usage: .\scripts\bump-android-version.ps1 -VersionName 1.2.4 -VersionCode 7

param(
  [Parameter(Mandatory = $true)]
  [string]$VersionName,
  [Parameter(Mandatory = $true)]
  [int]$VersionCode
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$versionProps = Join-Path $Root "android\version.properties"
Set-Content -Path $versionProps -Value @(
  "VERSION_CODE=$VersionCode"
  "VERSION_NAME=$VersionName"
) -Encoding ASCII
Write-Host "Updated $versionProps"

$androidRelease = Join-Path $Root "src\landing\androidRelease.ts"
if (Test-Path $androidRelease) {
  $content = Get-Content $androidRelease -Raw
  $content = $content -replace "version: '[^']+'", "version: '$VersionName'"
  $content = $content -replace 'versionCode: \d+', "versionCode: $VersionCode"
  $content = $content -replace "downloadName: '[^']+'", "downloadName: 'AnimaStage-Lite-$VersionName-portrait.apk'"
  Set-Content -Path $androidRelease -Value $content -NoNewline
  Write-Host "Updated src/landing/androidRelease.ts"
}

$playListing = Join-Path $Root "store\play-listing.txt"
if (Test-Path $playListing) {
  $listing = Get-Content $playListing -Raw
  $listing = $listing -replace '(?m)^## Release notes v[\d.]+', "## Release notes v$VersionName"
  Set-Content -Path $playListing -Value $listing -NoNewline
  Write-Host "Updated store/play-listing.txt release notes header"
}

Write-Host ""
Write-Host "Done. versionCode=$VersionCode versionName=$VersionName"
Write-Host "Next: npm run release:android"
