"""Standard-library infrastructure tests: no network, Docker, Firebase or secrets."""
from __future__ import annotations

import base64
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from importlib.util import module_from_spec, spec_from_file_location

ROOT = Path(__file__).resolve().parents[1]


def load(name: str, relative: str):
    spec = spec_from_file_location(name, ROOT / relative)
    module = module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


preview = load("preview_build", "scripts/build_firebase_preview.py")
doctor = load("infra_doctor", "scripts/doctor.py")


class InfrastructureTests(unittest.TestCase):
    def test_existing_source_entry_points(self):
        for name in doctor.REQUIRED_PATHS:
            with self.subTest(name=name):
                self.assertTrue((ROOT / name).is_file(), name)

    def test_hosting_preview_never_points_to_source_or_repo(self):
        data = json.loads((ROOT / "firebase.preview.json").read_text(encoding="utf-8"))
        self.assertEqual(data["hosting"]["public"], "build/firebase-preview")
        self.assertFalse(data["hosting"].get("rewrites"))

    def test_preview_builder_injects_banner_but_never_changes_source(self):
        original = (ROOT / "frontend/index.html").read_bytes()
        # Destination is forced underneath build/, so temporary test output is contained.
        parent = ROOT / "build"
        parent.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as tmp:
            dest = Path(tmp) / "preview"
            preview.build(dest)
            built = (dest / "index.html").read_text(encoding="utf-8")
            self.assertIn("data-glownuture-preview-banner", built)
            self.assertTrue((dest / "assets" / "app.js").is_file())
            self.assertFalse((dest / ".env").exists())
            self.assertFalse((dest / "backend").exists())
            self.assertFalse((dest / "media" / "assets").exists())
            self.assertIn("data-glownuture-preview-banner", (dest / "catalog" / "index.html").read_text(encoding="utf-8"))
            self.assertEqual((ROOT / "frontend/index.html").read_bytes(), original)

    def test_preview_rejects_destination_outside_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                preview.build(Path(tmp) / "preview")

    def test_preview_symlink_to_private_file_is_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            secret = root / "private.txt"
            secret.write_text("private")
            public = root / "public"
            public.mkdir()
            try:
                (public / "linked.txt").symlink_to(secret)
            except (OSError, NotImplementedError):
                self.skipTest("System does not permit symlinks")
            self.assertIn("linked.txt", preview._ignore_private(str(public), ["linked.txt"]))

    def test_local_doctor_reports_missing_env_without_secret_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in doctor.REQUIRED_PATHS:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture")
            errors, _, _ = doctor.audit("local", root)
            self.assertTrue(any("backend/.env" in message for message in errors))

            secret = base64.urlsafe_b64encode(os.urandom(32)).decode()
            env_path = root / "backend/.env"
            env_path.write_text(
                "APP_ENV=development\nDATABASE_URL=sqlite:///./commerce.db\n"
                "ALLOWED_ORIGIN=http://127.0.0.1:8000\n"
                f"PII_ENCRYPTION_KEY={secret}\nPII_HMAC_KEY={os.urandom(32).hex()}\n"
            )
            errors, _, good = doctor.audit("local", root)
            self.assertFalse(errors, errors)
            self.assertTrue(good)
            all_messages = "\n".join(errors + good)
            self.assertNotIn(secret, all_messages)

    def test_production_rejects_unsafe_local_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in doctor.REQUIRED_PATHS:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture")
            (root / "backend/.env").write_text(
                "APP_ENV=production\nDATABASE_URL=sqlite:///./db.sqlite\n"
                "ALLOWED_ORIGIN=http://localhost:8000\nCOOKIE_SECURE=false\n"
                "PII_ENCRYPTION_KEY=" + base64.urlsafe_b64encode(os.urandom(32)).decode() + "\n"
                "PII_HMAC_KEY=" + os.urandom(32).hex() + "\n"
                "LOCAL_AUTH_ENABLED=true\nENFORCE_ADMIN_MFA=false\n"
            )
            errors, _, _ = doctor.audit("production", root)
            self.assertTrue(any("PostgreSQL" in line for line in errors))
            self.assertTrue(any("HTTPS" in line for line in errors))
            self.assertTrue(any("LOCAL_AUTH_ENABLED" in line for line in errors))
            self.assertTrue(any("ENFORCE_ADMIN_MFA" in line for line in errors))


if __name__ == "__main__":
    unittest.main()
