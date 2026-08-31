# One-time setup: create release keystore + android/keystore.properties
# Run from project root: npm run setup:android-signing

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AndroidDir = Join-Path $Root "android"
$KeystoreProps = Join-Path $AndroidDir "keystore.properties"
$JavaPropsFile = Join-Path $AndroidDir "java.properties"
$DefaultKeystoreDir = Join-Path $env:USERPROFILE "keys"
$DefaultKeystorePath = Join-Path $DefaultKeystoreDir "webmmd-release.keystore"
$DefaultAlias = "webmmd"
$storePassword = $null

function Import-JavaHomeFromProperties {
  if ($env:JAVA_HOME) { return }
  if (-not (Test-Path -LiteralPath $JavaPropsFile)) { return }

  $lines = Get-Content -LiteralPath $JavaPropsFile -ErrorAction SilentlyContinue
  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
    if ($trimmed -match "^java\.home=(.+)$") {
      $env:JAVA_HOME = $Matches[1].Trim().Trim('"')
      break
    }
  }
}

Import-JavaHomeFromProperties

function Test-KeytoolPath([string]$Path) {
  return $Path -and (Test-Path -LiteralPath $Path)
}

function Find-WhereExe([string]$Name) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $output = cmd /c "where $Name 2>nul"
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($output)) {
      return $null
    }
    return ($output -split "`r?`n" | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -First 1).Trim()
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Find-Keytool {
  $candidates = New-Object System.Collections.Generic.List[string]

  if ($env:JAVA_HOME) {
    $candidates.Add((Join-Path $env:JAVA_HOME "bin\keytool.exe"))
  }

  $candidates.Add("C:\Program Files\Java\jdk-23\bin\keytool.exe")

  $cmd = Get-Command keytool -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) {
    $candidates.Add($cmd.Source)
  }

  $where = Find-WhereExe "keytool"
  if ($where) {
    $candidates.Add($where)
  }

  $javaCmd = Get-Command java -ErrorAction SilentlyContinue
  if ($javaCmd -and $javaCmd.Source) {
    $javaBin = Split-Path -Path $javaCmd.Source -Parent
    $candidates.Add((Join-Path $javaBin "keytool.exe"))
    $javaHome = Split-Path $javaBin -Parent
    $candidates.Add((Join-Path $javaHome "bin\keytool.exe"))
  }

  $studioRoots = @(
    (Join-Path ${env:ProgramFiles} "Android\Android Studio"),
    (Join-Path ${env:ProgramFiles(x86)} "Android\Android Studio"),
    (Join-Path ${env:ProgramFiles} "Android\Android Studio Preview"),
    (Join-Path $env:LOCALAPPDATA "Programs\Android\Android Studio"),
    (Join-Path $env:LOCALAPPDATA "Android\Android Studio")
  )

  foreach ($studioRoot in $studioRoots) {
    if (-not $studioRoot -or -not (Test-Path -LiteralPath $studioRoot)) { continue }
    $candidates.Add((Join-Path $studioRoot "jbr\bin\keytool.exe"))
    $candidates.Add((Join-Path $studioRoot "jre\bin\keytool.exe"))
  }

  if (Test-Path -LiteralPath "C:\Program Files\Java") {
    Get-ChildItem -LiteralPath "C:\Program Files\Java" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $candidates.Add((Join-Path $_.FullName "bin\keytool.exe"))
    }
  }

  foreach ($candidate in $candidates) {
    if (Test-KeytoolPath $candidate) {
      return $candidate
    }
  }

  return $null
}

function Read-PasswordPlain {
  param([string]$Prompt)
  $secure = Read-Host $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

Write-Host ""
Write-Host "AnimaStage Lite - Android signing setup" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $KeystoreProps) {
  $overwrite = Read-Host "android/keystore.properties already exists. Overwrite? (y/N)"
  if ($overwrite -ne "y" -and $overwrite -ne "Y") {
    Write-Host "Cancelled."
    exit 0
  }
}

$keytool = Find-Keytool
if (-not $keytool) {
  Write-Host "keytool was not found automatically." -ForegroundColor Yellow
  if ($env:JAVA_HOME) {
    Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor DarkGray
    Write-Host "Expected: $(Join-Path $env:JAVA_HOME 'bin\keytool.exe')" -ForegroundColor DarkGray
  }
  Write-Host ""
  Write-Host "Common locations:" -ForegroundColor DarkGray
  Write-Host "  Android Studio: ...\Android Studio\jbr\bin\keytool.exe"
  Write-Host "  JDK:            ...\Java\jdk-*\bin\keytool.exe"
  Write-Host ""
  $manual = Read-Host "Paste full path to keytool.exe (or Enter to exit)"
  if ([string]::IsNullOrWhiteSpace($manual)) {
    exit 1
  }
  $keytool = $manual.Trim().Trim('"')
  if (-not (Test-KeytoolPath $keytool)) {
    Write-Host "File not found: $keytool" -ForegroundColor Red
    exit 1
  }
}

Write-Host "Using keytool: $keytool" -ForegroundColor DarkGray
Write-Host ""

$keystoreInput = Read-Host "Keystore path [$DefaultKeystorePath]"
if ([string]::IsNullOrWhiteSpace($keystoreInput)) {
  $keystorePath = $DefaultKeystorePath
} else {
  $keystorePath = $keystoreInput.Trim().Trim('"')
}

$aliasInput = Read-Host "Key alias [$DefaultAlias]"
if ([string]::IsNullOrWhiteSpace($aliasInput)) {
  $keyAlias = $DefaultAlias
} else {
  $keyAlias = $aliasInput.Trim()
}

if (Test-Path -LiteralPath $keystorePath) {
  Write-Host "Keystore already exists: $keystorePath" -ForegroundColor Yellow
  $useExisting = Read-Host "Use existing keystore? (Y/n)"
  if ($useExisting -eq "n" -or $useExisting -eq "N") {
    Write-Host "Choose a different path or delete the old file first."
    exit 1
  }
} else {
  $keystoreDir = Split-Path -Path $keystorePath -Parent
  if ($keystoreDir -and -not (Test-Path -LiteralPath $keystoreDir)) {
    New-Item -ItemType Directory -Path $keystoreDir -Force | Out-Null
  }

  Write-Host ""
  Write-Host "Create a STRONG password and save it. Without it you cannot update the app in Play Store." -ForegroundColor Yellow
  $storePassword = Read-PasswordPlain -Prompt "Keystore password"
  $keyPasswordConfirm = Read-PasswordPlain -Prompt "Confirm keystore password"
  if ($storePassword -ne $keyPasswordConfirm) {
    Write-Host "Passwords do not match." -ForegroundColor Red
    exit 1
  }

  $dname = Read-Host "Certificate name (CN) [AnimaStage Lite]"
  if ([string]::IsNullOrWhiteSpace($dname)) {
    $dname = "AnimaStage Lite"
  }

  $dnameValue = "CN=$dname, OU=Mobile, O=FBNonaMe, C=RU"

  Write-Host ""
  Write-Host "Creating keystore..." -ForegroundColor Cyan
  & $keytool -genkeypair -v -keystore $keystorePath -alias $keyAlias -keyalg RSA -keysize 2048 -validity 10000 -storepass $storePassword -keypass $storePassword -dname $dnameValue

  if ($LASTEXITCODE -ne 0) {
    Write-Host "keytool failed." -ForegroundColor Red
    exit $LASTEXITCODE
  }

  Write-Host "Keystore created." -ForegroundColor Green
}

Write-Host ""
if (-not $storePassword) {
  $storePassword = Read-PasswordPlain -Prompt "Enter keystore password (for keystore.properties)"
}

$gradleStorePath = $keystorePath -replace '\\', '/'
$propsLines = @(
  "storeFile=$gradleStorePath"
  "storePassword=$storePassword"
  "keyAlias=$keyAlias"
  "keyPassword=$storePassword"
)

Set-Content -Path $KeystoreProps -Value $propsLines -Encoding ASCII
Write-Host ""
Write-Host "Wrote android/keystore.properties" -ForegroundColor Green
Write-Host "Keystore: $keystorePath"
Write-Host ""
Write-Host "Next: npm run release:android" -ForegroundColor Cyan
Write-Host "Backup the .keystore file and passwords in a safe place." -ForegroundColor Yellow
Write-Host ""
