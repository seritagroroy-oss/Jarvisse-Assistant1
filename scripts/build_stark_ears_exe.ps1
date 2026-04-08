$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$source = Join-Path $root "stark_ears.py"
if (-not (Test-Path $source)) {
  throw "stark_ears.py introuvable: $source"
}

$distDir = Join-Path $root "jarvisse-native-builds\\stark-ears"
$tmpDir = Join-Path $root ".tmp_pyinstaller"
$workDir = Join-Path $tmpDir "build"
$specDir = Join-Path $tmpDir "spec"

New-Item -ItemType Directory -Force $distDir | Out-Null
New-Item -ItemType Directory -Force $workDir | Out-Null
New-Item -ItemType Directory -Force $specDir | Out-Null

Write-Host "==> Build stark_ears.exe avec PyInstaller..."
python -m PyInstaller `
  --noconfirm `
  --onefile `
  --name stark_ears `
  --distpath $distDir `
  --workpath $workDir `
  --specpath $specDir `
  $source

if (-not (Test-Path (Join-Path $distDir "stark_ears.exe"))) {
  throw "Build termine sans stark_ears.exe"
}

Write-Host "==> OK: $distDir\\stark_ears.exe"
