"""Runtime fixes for CUDA Blackwell and portable verified model extraction."""
from pathlib import Path
import os
import shutil
import sys
import hashlib

def install_compat(root):
    gpu = root / "gpu"
    gpu.mkdir(exist_ok=True)
    (gpu / "__init__.py").write_text("", encoding="utf-8")
    (gpu / "enable_gpu.py").write_text("""
def is_cuda_available():
    try:
        import torch
        if not torch.cuda.is_available():
            return False
        a = torch.rand(32, 32, device='cuda')
        _ = torch.fft.rfft2(a)
        torch.cuda.synchronize()
        return True
    except Exception:
        return False

def is_torch_directml_installed():
    try:
        import torch_directml
        return True
    except ImportError:
        return False
""", encoding="utf-8")
    runtime = root / "app_runtime.py"
    s = runtime.read_text(encoding="utf-8")
    s = s.replace("models_dir=data_dir / \"models\",", "models_dir=Path(__import__('os').environ.get('LOCALAPPDATA', str(data_dir))) / 'WatermarkStudio' / 'models',")
    runtime.write_text(s, encoding="utf-8")

def write_hook(root):
    (root / "extract_models_hook.py").write_text('''
import os
import sys
import shutil
import hashlib
from pathlib import Path
specs = {
  "lama_int8.onnx": ("1941214c210399eb815eb2d32570ba91d5e6c4ac3de4c939bd3fb09300454972", 61512617),
  "big-lama.pt": ("344c77bbcb158f17dd143070d1e789f38a66c04202311ae3a258ef66667a9ea9", 205669692),
}
base = Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "WatermarkStudio" / "models"
base.mkdir(parents=True, exist_ok=True)
for filename, (digest, length) in specs.items():
    dest = base / filename
    src = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "models" / filename
    if not src.is_file():
        continue
    def verified(p):
        if not p.exists() or p.stat().st_size != length:
            return False
        h = hashlib.sha256()
        with p.open("rb") as f:
            for chunk in iter(lambda:f.read(1024*1024),b""):
                h.update(chunk)
        return h.hexdigest() == digest
    if not verified(dest):
        if not verified(src):
            raise RuntimeError("Bundled model checksum mismatch: " + filename)
        temp = base / (filename + ".partial")
        shutil.copyfile(src, temp)
        if not verified(temp):
            raise RuntimeError("Copied model checksum mismatch: " + filename)
        temp.replace(dest)
''', encoding="utf-8")

if __name__ == "__main__":
    root=Path(sys.argv[1])
    install_compat(root)
    write_hook(root)
