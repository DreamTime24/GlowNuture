# GlowNuture Commerce

> **START HERE (বাংলা): [docs/INFRASTRUCTURE_START_HERE_BN.md](docs/INFRASTRUCTURE_START_HERE_BN.md)** — correct folder, Windows local setup, optional Firebase *static preview*, GitHub branch workflow and full-stack production requirements. Do not deploy the preview as a functioning store.


Existing FastAPI + SQLAlchemy + Firebase + vanilla JavaScript beauty storefront, extended with owner-verified catalog imports and persistent product media. The original ivory/sage/rose design and Bangla storefront remain.

**Prepared for glownuture.com; not deployed or approved for live transactions.** Exact Namecheap hosting type still requires owner account verification. Shared Hosting does not officially support this FastAPI/ASGI backend; see the hosting playbook.

## Run locally

On Windows, `CHECK_SETUP.bat` shows read-only diagnostics and `run-local.bat` prepares the local environment. `BUILD_PREVIEW.bat` prepares only a visually marked static Firebase demo; it does not serve `/api`, payments, stock, login or checkout. Both Firebase Hosting configurations point to the generated `build/firebase-preview` directory, so build and check it before any preview-channel deployment. Infrastructure change/limitations: [docs/INFRASTRUCTURE_CHANGELOG.md](docs/INFRASTRUCTURE_CHANGELOG.md).


Python 3.12 is required. On Windows, run run-local.bat. On other supported systems:

~~~sh
python -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock
.venv/bin/python scripts/setup_local.py
.venv/bin/python scripts/run_local.py
~~~

Open http://127.0.0.1:8000. The launcher migrates the local DB and starts API + notification worker + catalog worker. Do not overwrite an existing .env or encryption keys. First-time defaults keep checkout closed, demo seeds off and Firebase unconfigured until the owner's public web settings and server credentials are supplied.

Firebase identity is verified server-side; signing in never grants a staff role from browser flags. Owner role assignment uses an exact existing Firebase UID and the protected server CLI. Staff MFA remains enforced.

## Working catalog

- Free Open Beauty Facts reference adapter; no private read key required.
- Owner UTF-8 CSV/JSON feeds and authorized supplier GET/POST APIs.
- Existing Ordinary/Parse integration behind rotated server-key configuration.
- Durable paginated jobs, source identity/deduplication, retries, content diffs and manual duplicate mapping.
- All new products start DRAFT and UNVERIFIED, with zero local price/stock and no auto-published photographs.
- Owner review checks source/supplier, identity, image rights/match, description/INCI, expiry, SKU/category, physical inventory and actual BDT selling price.
- Separate revision-bound submit → verify → publish actions. Material edits invalidate approval.
- Private photo previews, sanitized responsive WebP, galleries, stored credits and integrity checks.
- Public catalog, SEO and checkout admit only eligible owner-published products. Store prices are BDT; no foreign reference price is relabelled or converted into an invented local selling price.

The prior approved live catalog is preserved by an additive migration marker. No owner products, orders, users, stock or prices were deleted. No production products or reviews were fabricated.

## Commerce and operations

Server-side exact paisa totals, coupons, stock reservations, expired-batch protection, COD records, existing SSLCommerz sandbox callbacks/validation, receipts, returns, refunds records and account history remain. Customer settings, email verification/reset and notifications retain Firebase/server authorization. External refunds/courier bookings are operational records unless a separately configured provider actually confirms the action.

Admin includes products/approval, catalog sources/jobs, inventory/expiry, suppliers/purchases, orders/shipping, returns, customers/support, verified reviews, coupons/content/policies, accounting, staff/audit, integration status and worker operations.

## Check

~~~sh
npm ci --ignore-scripts
npm run check:frontend
npm run test:frontend
cd backend
python -m pytest -q
python -m alembic check
~~~

Use a disposable test database. The final evidence report identifies actual local checks and external tests that could not be performed. JSDOM tests are not visual browser or live-provider tests.

## Documentation

| Document | Purpose |
| --- | --- |
| docs/IMPLEMENTATION_AUDIT.md | Reproduced defects, corrections, preserved behavior and phase boundaries |
| docs/PRODUCT_APPROVAL_PLAYBOOK.md | Owner/staff review workflow and API entry points |
| docs/PRODUCT_API.md | Free/source adapters, file format, pagination and refresh rules |
| docs/IMAGE_DIAGNOSTICS.md | Rights, private/public media, responsive derivatives, network and backup diagnostics |
| docs/DEPLOY_GLOWNUTURE_NAMECHEAP.md | Exact-plan decision, glownuture.com, ASGI deployment, staging, backups and rollback |
| docs/OWNER_ACTION_REQUIRED.md | Precise account, supplier, credential and legal owner steps |
| docs/TEST_REPORT_FINAL.md | Current test results, evidence and live-verification limits |
| docs/FIREBASE_SETUP.md | Firebase/Admin SDK/MFA provider setup |
| docs/SECURITY.md | Security model and remaining production controls |

Do not deploy the older repository-root static HTML as this complete application. The supported entry is backend/app/main.py serving frontend/index.html at /. No standalone HTML can securely replace the private backend, database, workers and merchant validation.
