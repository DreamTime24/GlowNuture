# Infrastructure update — 16 October 2026

Scope: safe infrastructure and setup improvements to the provided `GlowNuture-Commerce-Verified-Catalog-20261016.zip`. This update deliberately **does not** rewrite the already substantial product, backend, auth, payment or database code. It does not deploy or change any external services.

## Confirmed observations in uploaded archive

- 157 ZIP entries (one project folder). `frontend/index.html` and `backend/app/main.py` implement a dynamic full-stack app. Separate API, relational DB, catalog/notification workers and Alembic migrations exist.
- `firebase.json` includes Firebase database/storage rules but has no Hosting target. The user's earlier CLI was being run from a *parent* directory, and its `public` setup does not represent this full-stack app.
- Existing GitHub workflow was **manual only**, so push/PR did not continuously validate changes.
- No existing `backend/.env` included; this is correct for safety, but first-run setup and readiness need to be explicit.

## Changes made

1. Added `scripts/build_firebase_preview.py` and `firebase.preview.json`. Preview output goes only to generated `build/firebase-preview/`, with a visible non-functional static preview warning. It copies only allowlisted frontend assets and three public brand SVG illustrations; runtime `/media/assets` (possibly private/unapproved product uploads) is excluded. Backend API is never presented as Firebase-hosted.
2. Added `scripts/doctor.py` (stdlib, read-only) with local/preview/production modes: structure, public-secret file presence, config shape, tested-runtime/dependency checks and release guardrails. No secret values are printed.
3. Added `CHECK_SETUP.bat` and `BUILD_PREVIEW.bat`. Updated existing `run-local.bat` to run diagnostics before launching services.
4. Enabled GitHub checks on push to `main`, PR and manual invocation (but **no deployment**). CI verifies Python infra tests, static preview build/guard, frontend checks, backend pytest and DB migrations.
5. Extended `.gitignore` for generated preview, Firebase local state and exported archives.
6. Added `tests/test_infrastructure.py` and a Bangla `INFRASTRUCTURE_START_HERE_BN.md` walkthrough. Kept the production service templates, migrations and existing pages intact.

## What this does *not* verify

- Live PostgreSQL service, production Docker containers or Windows Python 3.12 (this sandbox has Python 3.13).
- Full backend pytest: the sandbox lacks `firebase-admin`, `pwdlib`, `psycopg` and cannot reach package indexes; the archived prior test report is not a result of this update.
- Node JSDOM suite: `node_modules/` unavailable and package download inaccessible. JavaScript syntax check is available.
- Real Firebase deployment, GitHub auth, Namecheap DNS/hosting plan, OAuth, payment sandbox/checkout, licensed photos, live product stock, real mobile browser.
- No production domain/purchases can responsibly be considered live based on these files alone.

## Verified after changes

- Standard library infrastructure suite: `7 passed`.
- Python compileall (scripts and existing app): successful.
- Node JS syntax: `10 files` passed.
- `scripts/build_firebase_preview.py`: generated public-only demo directory.
- `scripts/doctor.py --mode firebase-preview`: `0 failures`, with expected preview limitation warning.

All claims are scoped to checks run during this update. Existing documents containing prior test results remain historical evidence.
