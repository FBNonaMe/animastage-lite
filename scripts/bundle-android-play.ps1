# Build signed Android App Bundle (AAB) for Google Play Console.
# Prerequisites: android/keystore.properties (run: npm run setup:android-signing)

param(
  [switch]$SkipWebBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$AndroidDir = Join-Path $Root "android"
$KeystoreProps = Join-Path $AndroidDir "keystore.properties"
$JavaPropsFile = Join-Path $AndroidDir "java.properties"
$VersionProps = Join-Path $AndroidDir "version.properties"

function Import-JavaHome {
  if ($env:JAVA_HOME) { return }
  if (-not (Test-Path -LiteralPath $JavaPropsFile)) { return }
  foreach ($line in Get-Content -LiteralPath $JavaPropsFile) {
    $trimmed = $line.Trim()
    if ($trimmed -match "^java\.home=(.+)$") {
      $env:JAVA_HOME = $Matches[1].Trim().Trim('"')
      break
    }
  }
}

function Read-VersionProps {
  $code = 1
  $name = "1.0.0"
  if (Test-Path -LiteralPath $VersionProps) {
    foreach ($line in Get-Content -LiteralPath $VersionProps) {
      $trimmed = $line.Trim()
      if ($trimmed -match "^VERSION_CODE=(.+)$") { $code = [int]$Matches[1].Trim() }
      if ($trimmed -match "^VERSION_NAME=(.+)$") { $name = $Matches[1].Trim() }
    }
  }
  return @{ Code = $code; Name = $name }
}

function Sync-WebAssets {
  $dist = Join-Path $Root "dist"
  $public = Join-Path $Root "android\app\src\main\assets\public"

  if (-not (Test-Path $dist)) {
    throw "dist/ not found. Run npm run build first."
  }

  Write-Host ">> Copying dist -> Android assets (excluding *.apk)..." -ForegroundColor Cyan
  if (Test-Path $public) { Remove-Item $public -Recurse -Force }
  New-Item -ItemType Directory -Path $public -Force | Out-Null
  Get-ChildItem -Path $dist -Force | Where-Object { $_.Extension -ne '.apk' } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $public -Recurse -Force
  }

  $nestedApk = Join-Path $public "app-debug.apk"
  if (Test-Path $nestedApk) { Remove-Item $nestedApk -Force }

  $assetsMb = [math]::Round(
    (Get-ChildItem $public -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB,
    1
  )
  Write-Host "   Web assets: $assetsMb MB"
  if ($assetsMb -gt 25) {
    Write-Warning "Web assets over 25 MB - check for accidental binaries in dist/."
  }
}

Import-JavaHome

if (-not (Test-Path -LiteralPath $KeystoreProps)) {
  Write-Host ""
  Write-Host "Missing android/keystore.properties" -ForegroundColor Red
  Write-Host "Run once: npm run setup:android-signing"
  Write-Host "Or copy android/keystore.properties.example -> android/keystore.properties"
  Write-Host ""
  exit 1
}

$npm = "C:\Program Files\nodejs\npm.cmd"
$npx = "C:\Program Files\nodejs\npx.cmd"
if (-not (Test-Path $npm)) {
  $npm = "npm"
  $npx = "npx"
}

Set-Location $Root

if (-not $SkipWebBuild) {
  Write-Host ">> Building web (dist/)..." -ForegroundColor Cyan
  & $npm run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Sync-WebAssets

Write-Host ">> Capacitor sync android..." -ForegroundColor Cyan
& $npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">> Gradle bundleRelease..." -ForegroundColor Cyan
Push-Location $AndroidDir
& .\gradlew.bat bundleRelease
$gradleExit = $LASTEXITCODE
Pop-Location
if ($gradleExit -ne 0) { exit $gradleExit }

$version = Read-VersionProps
$srcAab = Join-Path $AndroidDir "app\build\outputs\bundle\release\app-release.aab"
$releasesDir = Join-Path $Root "store\releases"
New-Item -ItemType Directory -Path $releasesDir -Force | Out-Null
$dstAab = Join-Path $releasesDir ("AnimaStage-Lite-v{0}-{1}.aab" -f $version.Name, $version.Code)

if (Test-Path -LiteralPath $srcAab) {
  Copy-Item -LiteralPath $srcAab -Destination $dstAab -Force
  $mb = [math]::Round((Get-Item $dstAab).Length / 1MB, 2)
  $sizeLabel = "$mb MB"
  Write-Host ""
  Write-Host "Release AAB ready:" -ForegroundColor Green
  Write-Host "  $srcAab"
  Write-Host "  $dstAab ($sizeLabel)"
  Write-Host ""
  Write-Host "Upload to Play Console -> Testing -> Internal testing -> Create release"
  Write-Host "Package: com.webmmd.suite | versionCode $($version.Code) | versionName $($version.Name)"
} else {
  Write-Error "AAB not found at $srcAab"
  exit 1
}
