"""
Compile MJML templates to HTML using the MJML API.
Run: python -m apps.api.email.compile_templates
  or: python apps/api/email/compile_templates.py
"""
import os
import sys
from pathlib import Path
import httpx

MJML_API_URL = "https://api.mjml.io/v1/render"
APP_ID = "24c4a848-cae3-47fe-95e3-2dd700cd84e2"
SECRET_KEY = "8e8d3c13-d02d-489e-8881-bd7cf9fcc5ac"

MJML_DIR = Path(__file__).parent / "templates" / "mjml"
OUT_DIR = Path(__file__).parent / "templates"


def compile_one(mjml_path: Path) -> bool:
    mjml_source = mjml_path.read_text(encoding="utf-8")
    resp = httpx.post(
        MJML_API_URL,
        auth=(APP_ID, SECRET_KEY),
        json={"mjml": mjml_source},
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"  ERROR {resp.status_code}: {resp.text[:200]}")
        return False

    data = resp.json()
    errors = data.get("errors", [])
    if errors:
        for e in errors:
            print(f"  WARN: {e}")

    html = data.get("html", "")
    if not html:
        print("  ERROR: empty HTML response")
        return False

    out_path = OUT_DIR / (mjml_path.stem + ".html")
    out_path.write_text(html, encoding="utf-8")
    print(f"  OK  -> {out_path.name}")
    return True


def main():
    if not MJML_DIR.exists():
        print(f"MJML source dir not found: {MJML_DIR}")
        sys.exit(1)

    mjml_files = sorted(MJML_DIR.glob("*.mjml"))
    if not mjml_files:
        print("No .mjml files found.")
        sys.exit(1)

    print(f"Compiling {len(mjml_files)} templates via MJML API...\n")
    ok = err = 0
    for f in mjml_files:
        print(f"[{f.name}]")
        if compile_one(f):
            ok += 1
        else:
            err += 1

    print(f"\nDone: {ok} compiled, {err} failed.")
    if err:
        sys.exit(1)


if __name__ == "__main__":
    main()
