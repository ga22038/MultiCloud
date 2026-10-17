"""Package public source plus the student lab changes; never collect the workspace recursively."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode("utf-8").split("\0")
extra = [
    "INICIAR-LABORATORIO.md", "lab.example.json", "scripts/lab.mjs",
    "scripts/package-student-lab.py", "docs/laboratorio-personal.md",
    "docs/subdominios-alumnos.md", "app/src/learning/StudentLab.tsx",
    "app/src/learning/StudentLab.module.css", "app/src/learning/rubric.json",
    "app/public/laboratorio-personal.md",
]
extra += [str(p.relative_to(root)).replace("\\", "/") for p in (root / "scripts/lab").rglob("*") if p.is_file()]
files = sorted(set(f for f in tracked + extra if f))
denied_parts = {".git", ".secrets", ".terraform", "node_modules", "output", "tmp", "__pycache__"}
def allowed(name):
    p = Path(name)
    return not p.is_absolute() and ".." not in p.parts and not denied_parts.intersection(p.parts) and p.name not in {"lab.json", "AGENTS.md"} and not p.name.endswith((".tfstate", ".tfvars", ".tfvars.json", ".pem", ".key", ".pfx", ".p12", ".log", ".pyc")) and (not p.name.startswith(".env") or p.name == ".env.example")

files = [f for f in files if allowed(f) and (root / f).is_file()]
assert (root / "app/public/laboratorio-personal.md").read_bytes() == (root / "docs/laboratorio-personal.md").read_bytes(), "Sincroniza la guía descargable con docs/laboratorio-personal.md."
out = root / "output/laboratorio-personal"
out.mkdir(parents=True, exist_ok=True)
dest = out / "MultiCloud-laboratorios-personales.zip"
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for f in files:
        z.write(root / f, "MultiCloud-laboratorios-personales/" + f)
with zipfile.ZipFile(dest) as z:
    assert z.testzip() is None
    assert all(allowed(str(Path(f).relative_to("MultiCloud-laboratorios-personales"))) for f in z.namelist())
    assert "MultiCloud-laboratorios-personales/scripts/lab.mjs" in z.namelist()
manifest = {"artifact": dest.name, "files": len(files), "bytes": dest.stat().st_size, "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(), "scope": "Public source; no credentials, Terraform state, dependencies or student evidence. Cloud end-to-end not executed."}
(out / "paquete.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps(manifest, indent=2))
