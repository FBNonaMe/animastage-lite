$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot
$src = Join-Path $PSScriptRoot 'upstream'
git clone --depth 1 https://github.com/gravsh/universal-watermark-remover.git $src
if ($LASTEXITCODE -ne 0) { throw 'Source download failed' }
python -m pip install --upgrade pip
python -m pip install "numpy==1.26.4" "opencv-python==4.11.0.86" "Pillow==11.3.0" "requests>=2.32" "PySide6>=6.8,<7" "onnxruntime-directml>=1.22,<2" "imageio-ffmpeg>=0.6,<1" "pyinstaller>=6.15,<7"
if ($LASTEXITCODE -ne 0) { throw 'Desktop dependencies install failed' }
python -m pip install "torch==2.10.0" --index-url https://download.pytorch.org/whl/cu128
if ($LASTEXITCODE -ne 0) { throw 'CUDA 12.8 PyTorch install failed' }
python $PSScriptRoot/patch_runtime.py $src
if ($LASTEXITCODE -ne 0) { throw 'Patching failed' }
Push-Location $src
try {
  python -m unittest discover -s tests -q
  if ($LASTEXITCODE -ne 0) { throw 'Upstream tests failed' }
  @'
from pathlib import Path
from release_models import RELEASE_MODELS, ensure_release_model, verify_release_model
root = Path("packed_models")
root.mkdir(exist_ok=True)
for model in RELEASE_MODELS.values():
    print("Fetching", model.key, flush=True)
    output = ensure_release_model(model, root)
    assert verify_release_model(output, model)
    print("Verified", output.name, flush=True)
'@ | Set-Content -Path prefetch_embedded.py -Encoding UTF8
  python prefetch_embedded.py
  if ($LASTEXITCODE -ne 0) { throw 'Verified model download failed' }
  $args = @(
    '--noconfirm','--clean','--onefile','--windowed',
    '--name','WatermarkStudio',
    '--icon','assets/icons/app.ico',
    '--collect-all','torch',
    '--collect-all','onnxruntime',
    '--collect-all','imageio_ffmpeg',
    '--add-data','assets;assets',
    '--add-data','packed_models;models',
    '--runtime-hook','extract_models_hook.py',
    '--hidden-import','cv2',
    '--exclude-module','torchvision',
    '--exclude-module','torchaudio',
    '--exclude-module','matplotlib',
    'UniversalWatermarkRemover.py'
  )
  python -m PyInstaller @args
  if ($LASTEXITCODE -ne 0) { throw 'PyInstaller build failed' }
  if (-not (Test-Path dist/WatermarkStudio.exe)) { throw 'EXE missing' }
  $smoke = Start-Process -FilePath (Resolve-Path dist/WatermarkStudio.exe) -ArgumentList '--smoke-test' -Wait -PassThru
  if ($smoke.ExitCode -ne 0) { throw "EXE smoke test failed with exit code $($smoke.ExitCode)" }
} finally {
  Pop-Location
}
