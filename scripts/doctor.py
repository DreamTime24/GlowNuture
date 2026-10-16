"""Offline, read-only GlowNuture infrastructure checks. No secrets are printed."""
from __future__ import annotations

import argparse
import base64
import importlib.util
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
STATIC_BUILD = ROOT / "build" / "firebase-preview"
REQUIRED_PATHS = (
    "frontend/index.html", "frontend/assets/app.js", "frontend/assets/api-client.js",
    "backend/app/main.py", "backend/app/worker.py", "backend/app/catalog_worker.py",
    "backend/migrations/env.py", "backend/requirements.lock", "docker-compose.yml",
    "ops/nginx.conf", "scripts/run_local.py", "run-local.bat",
)
PYTHON_PACKAGES = {"fastapi": "fastapi", "sqlalchemy": "sqlalchemy", "alembic": "alembic", "pydantic_settings": "pydantic-settings", "firebase_admin": "firebase-admin", "pwdlib": "pwdlib", "psycopg": "psycopg"}
PRIVATE_EXTENSIONS = {".env", ".pem", ".key", ".p12", ".db", ".sqlite", ".sqlite3"}


def env_map(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if re.fullmatch(r"[A-Z][A-Z0-9_]*", key.strip()):
            values[key.strip()] = value.strip().strip('"\'')
    return values


def audit(mode: str, root: Path = ROOT) -> tuple[list[str], list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    good: list[str] = []
    for name in REQUIRED_PATHS:
        if not (root / name).is_file():
            errors.append(f"Missing project file: {name}")
    if not errors:
        good.append("Frontend, backend, workers, migrations and runtime entry points exist")

    # File-secret check: never publicly host the entire repo or an API .env.
    public_directories = (root / "frontend", root / "build" / "firebase-preview")
    for public_dir in public_directories:
        if public_dir.is_dir():
            for path in public_dir.rglob("*"):
                if not path.is_file():
                    continue
                stem = path.name.lower()
                if (path.suffix.lower() in PRIVATE_EXTENSIONS or stem.startswith(("service-account", "serviceaccountkey", "credentials"))):
                    errors.append(f"Private-looking file under public assets: {path.relative_to(root)}")

    if mode == "firebase-preview":
        config_path = root / "firebase.preview.json"
        if not config_path.is_file():
            errors.append("Missing firebase.preview.json")
        else:
            try:
                data = json.loads(config_path.read_text(encoding="utf-8"))
                hosting = data["hosting"]
                if hosting.get("public") != "build/firebase-preview":
                    errors.append("Preview must serve only build/firebase-preview")
                if hosting.get("rewrites"):
                    errors.append("Static preview must not pretend that it hosts a working /api")
                if not errors:
                    good.append("Firebase preview points to an isolated generated directory")
            except (KeyError, ValueError, TypeError):
                errors.append("Invalid firebase.preview.json")
        if not (root / "build" / "firebase-preview" / "index.html").is_file():
            warnings.append("Preview not built. Run: py -3.12 scripts\\build_firebase_preview.py (or python scripts/build_firebase_preview.py)")
        else:
            html = (root / "build" / "firebase-preview" / "index.html").read_text(encoding="utf-8")
            if "data-glownuture-preview-banner" not in html:
                errors.append("Preview disclaimer is missing. Rebuild it before publishing")
            else:
                good.append("Static preview visibly disclaims disabled backend/checkout")
        warnings.append("This preview is NOT functional e-commerce; do not connect a production domain")
        return errors, warnings, good

    if sys.version_info[:2] != (3, 12):
        warnings.append("Python 3.12 is the tested runtime; this interpreter is " + sys.version.split()[0])
    dependencies = [label for module, label in PYTHON_PACKAGES.items() if importlib.util.find_spec(module) is None]
    if dependencies:
        warnings.append("Missing backend Python packages: " + ", ".join(dependencies) + "; install requirements.lock in Python 3.12 venv")
    else:
        good.append("Backend dependency entry points available (versions not validated)")

    values = env_map(root / "backend" / ".env")
    if not values:
        errors.append("Missing backend/.env. Run setup_local.py once; never copy placeholder keys into production")
        return errors, warnings, good
    good.append("Private backend/.env file exists (contents not displayed)")
    secret = values.get("PII_ENCRYPTION_KEY", "")
    try:
        secret_bytes = base64.urlsafe_b64decode(secret.encode())
        if len(secret_bytes) != 32:
            raise ValueError
    except (ValueError, TypeError):
        errors.append("PII_ENCRYPTION_KEY is missing or malformed; preserve any existing used key")
    hmac = values.get("PII_HMAC_KEY", "")
    if len(hmac) < 32 or hmac.startswith("REPLACE"):
        errors.append("PII_HMAC_KEY needs a generated strong secret")
    origin = urlsplit(values.get("ALLOWED_ORIGIN", ""))
    if (origin.scheme not in {"http", "https"} or not origin.hostname or origin.path != "" or origin.query or origin.fragment):
        errors.append("ALLOWED_ORIGIN needs an absolute scheme + host, without path")
    else:
        good.append("ALLOWED_ORIGIN has a valid URL shape")
    if mode == "production":
        if values.get("APP_ENV", "") != "production":
            errors.append("Production check requires APP_ENV=production")
        if not values.get("DATABASE_URL", "").startswith("postgresql+"):
            errors.append("Production needs a verified PostgreSQL connection, not SQLite")
        if values.get("COOKIE_SECURE", "").lower() != "true" or origin.scheme != "https":
            errors.append("Production requires HTTPS origin and COOKIE_SECURE=true")
        if values.get("LOCAL_AUTH_ENABLED", "false").lower() == "true":
            errors.append("LOCAL_AUTH_ENABLED must be false in production")
        if values.get("SEED_DEMO_PRODUCTS", "false").lower() == "true":
            errors.append("SEED_DEMO_PRODUCTS must be false in production")
        if values.get("AUTO_CREATE_SCHEMA", "false").lower() == "true":
            errors.append("AUTO_CREATE_SCHEMA must be false in production")
        if values.get("ENFORCE_ADMIN_MFA", "true").lower() != "true":
            errors.append("ENFORCE_ADMIN_MFA must remain true")
        if values.get("FIREBASE_ENABLED", "false").lower() != "true":
            warnings.append("Firebase is disabled; real sign-in will not function")
        if values.get("CHECKOUT_ENABLED", "false").lower() == "true":
            warnings.append("Checkout enabled: requires separate verified business, payments, stock and legal review")
        warnings.append("Passing this offline check does NOT prove live TLS/DNS/DB, OAuth, payment or deployment readiness")
    else:
        if values.get("APP_ENV", "development") == "production":
            warnings.append("You are running production configuration in local mode")
        good.append("Local configuration has been checked without exposing secrets")
    return errors, warnings, good


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("local", "firebase-preview", "production"), default="local")
    args = parser.parse_args()
    errors, warnings, passes = audit(args.mode)
    print(f"GlowNuture infrastructure check [{args.mode}]")
    for value in passes:
        print("[PASS] " + value)
    for value in warnings:
        print("[WARN] " + value)
    for value in errors:
        print("[FAIL] " + value)
    print(f"Results: {len(passes)} passes, {len(warnings)} warnings, {len(errors)} failures")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
