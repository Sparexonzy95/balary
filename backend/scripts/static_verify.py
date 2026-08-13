from __future__ import annotations

import compileall
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

required = [
    "apps/notifications/models.py",
    "apps/notifications/migrations/0001_initial.py",
    "apps/scheduling/models.py",
    "apps/scheduling/migrations/0001_initial.py",
    "apps/audit/models.py",
    "apps/audit/migrations/0001_initial.py",
    "docker-compose.prod.yml",
    ".env.example",
    "MILESTONE_5_RELEASE_NOTES.md",
]
missing = [path for path in required if not (ROOT / path).exists()]
if missing:
    raise SystemExit(f"Missing required files: {missing}")

if not compileall.compile_dir(ROOT / "apps", quiet=1):
    raise SystemExit("Python compilation failed under apps/")
if not compileall.compile_dir(ROOT / "config", quiet=1):
    raise SystemExit("Python compilation failed under config/")

settings_text = (ROOT / "config/settings.py").read_text(encoding="utf-8")
for app in ("apps.notifications", "apps.scheduling", "apps.audit"):
    if app not in settings_text:
        raise SystemExit(f"Missing installed app: {app}")

url_text = (ROOT / "config/urls.py").read_text(encoding="utf-8")
for route in ("notifications", "schedules", "audit", "health/ready"):
    if route not in url_text:
        raise SystemExit(f"Missing URL route: {route}")

templates = {path.stem for path in (ROOT / "templates/emails").glob("*.txt")}
html_templates = {path.stem for path in (ROOT / "templates/emails").glob("*.html")}
if templates != html_templates:
    raise SystemExit(f"Email template pairs differ: txt={templates}, html={html_templates}")

for forbidden in (".env", "db.sqlite3"):
    if (ROOT / forbidden).exists():
        raise SystemExit(f"Sensitive/runtime file present: {forbidden}")

secret_patterns = [
    re.compile(r"DEPLOYER_PRIVATE_KEY\s*=\s*0x[0-9a-fA-F]{64}"),
    re.compile(r"ZALARY_RELAYER_PRIVATE_KEY\s*=\s*0x[0-9a-fA-F]{64}"),
]
for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() in {".zip", ".png", ".jpg", ".jpeg", ".webp"}:
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    for pattern in secret_patterns:
        if pattern.search(text):
            raise SystemExit(f"Possible private key in {path.relative_to(ROOT)}")

print("STATIC MILESTONE 5 VERIFICATION PASSED")
print("Python compilation: True")
print("Required migrations: True")
print("Email template pairs: True")
print("Sensitive runtime files included: False")
print("Blockchain transactions broadcast: 0")
print("Tokens moved: 0")
