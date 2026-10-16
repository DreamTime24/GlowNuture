# glownuture.com / Namecheap deployment preparation

**Status: prepared, not deployed. Exact hosting plan remains unverified.**

The supplied screenshot shows hosting associated with glownuture.com, expiry 13 November 2026, a domain held in another Namecheap account and account 2FA disabled. It does not identify the hosting plan. The account URL opened to a username/password sign-in wall; no credentials were entered and no account settings changed.

The owner must open Hosting List → Manage and provide the exact product name/type, supported OS/runtime, SSH/root access, resources, control panel and current deployment details. Domain DNS changes require access to the separate account holding the domain.

Official compatibility reference:
https://www.namecheap.com/support/knowledgebase/article.aspx/10048/2182/how-to-work-with-python-app/

Namecheap Shared Hosting does not officially support ASGI applications. This project uses FastAPI/ASGI. Do not put it behind a WSGI adapter and call that a supported full deployment.

## Hosting decision

| Verified plan | Supported architecture |
| --- | --- |
| Shared hosting | Keep registrar/domain/email as appropriate; use an owner-approved ASGI-capable VPS or managed runtime for FastAPI, workers, PostgreSQL and persistent media |
| VPS / Dedicated with suitable access | Inspect OS, available resources, installed services, backups and costs; then use the prepared ASGI deployment |
| Unknown | No production cutover or hosting purchase; inspect exact plan first |

Preferred layout: https://glownuture.com serves both frontend and /api through one reverse proxy. This preserves secure same-origin cookies, CSRF and Firebase redirects. Hosting the static files separately with a cross-origin API is a separate architecture change requiring cookie/CORS/auth review; the current code should not be copied into public_html as a complete working shop.

## Prepared components

- ops/nginx.conf: canonical apex, WWW redirect, HTTP redirect/ACME path, TLS 1.2/1.3, loopback upstream, SSE passthrough and upload bounds.
- ops/glownuture-api.service: non-root single API process.
- ops/glownuture-catalog.service: durable import and image-health worker.
- ops/glownuture-notifications.service: notifications and expired reservation reconciliation.
- docker-compose.yml: alternative local PostgreSQL 17 stack, migration job, API readiness and both workers; persistent SQL/media.
- scripts/backup_database.py, backup_media.py, restore_media.py: explicit private backups and a non-overwriting media restore.
- /api/health: process liveness. /api/ready: real database query. Admin → Operations health: SQL worker heartbeats and recorded failures.

These templates were not installed. Nginx/systemd/Docker execution is not verified in this workspace. PostgreSQL DDL is generated/tested; no PostgreSQL daemon was available here. Run the prepared GitHub Actions PostgreSQL suite or an isolated approved staging DB before cutover.

## Environment and files

Suggested release layout:
- /srv/glownuture/releases/<release-id>: immutable source + its own .venv.
- /srv/glownuture/current: symlink to the approved release.
- /srv/glownuture/shared/media: persistent photos shared by API/worker.
- /etc/glownuture/store.env: private environment, readable only by the service account.
- Private backups outside the web root, separately encrypted and access controlled.

Set APP_ENV=production, ALLOWED_ORIGIN=https://glownuture.com, COOKIE_SECURE=true and PostgreSQL DATABASE_URL. Keep LOCAL_AUTH_ENABLED=false, AUTO_CREATE_SCHEMA=false, SEED_DEMO_PRODUCTS=false, ENFORCE_ADMIN_MFA=true. Configure MEDIA_ROOT to the persistent shared path. Keep CHECKOUT_ENABLED=false until real seller, policy, inventory, authentication and payment acceptance are complete.

Supply strong PII encryption/HMAC keys via an approved secret manager/environment. Preserve existing encryption keys when restoring an existing database. Configure Firebase public web fields separately; server Admin SDK uses ADC/workload identity or an existing private credential outside the repository. Rotated Parse credentials stay server-side; reads from Open Beauty Facts need no private key.

Use a private PostgreSQL network/TLS policy, least-privilege app account, a separately controlled migration identity and a measured connection limit. Do not reuse a production database as TEST_DATABASE_URL; tests only accept a separate database named glownuture_test.

## Staging and launch sequence

1. Owner verifies hosting type, costs and account access; enables Namecheap 2FA and confirms recovery methods.
2. Inventory current DNS, SSL, email/MX/TXT, existing databases/media and backups read-only. Do not change mail routing.
3. Owner approves an ASGI server or use of an existing compatible server. No purchase is made by these files.
4. Create an isolated staging environment, its own DB/secrets/Firebase domains and private access. Keep checkout/live payments disabled. Add X-Robots-Tag: noindex at the staging proxy; do not expose real customer data.
5. Install locked dependencies and run tests. Back up the existing database/media before migration; restore a copy into staging and test the additive upgrade.
6. Run alembic upgrade head once, then alembic check, before starting the new API/workers. Do not use create_all or seed_demo_products in production.
7. Install/review the proxy and service templates. Obtain an approved certificate covering glownuture.com and www.glownuture.com; run nginx -t before reload. Verify ACME automatic renewal and perform its dry run.
8. Confirm /api/ready, recent heartbeats for both workers, private draft media, public verified image variants, login/MFA, BDT checkout totals and permitted sandbox callback validation. Staging basic authentication must not unintentionally block approved gateway callbacks.
9. Owner verifies genuine products/supplier invoices/photos/expiry/stock/prices and approves legal seller details/policies.
10. Obtain explicit production cutover approval before changing A/AAAA/CNAME or nameservers. Keep current mail records. Point only the required records to the verified server; remove obsolete AAAA only after inspecting it.
11. Verify authoritative DNS, apex/WWW redirects, HTTPS, Firebase authorized domains/redirects and callbacks. Enable checkout only after final acceptance. Live SSLCommerz remains off without approved merchant credentials and explicit live authorization.

Firebase authorized domains should include the approved apex, WWW if used, and isolated staging hostname. Facebook OAuth redirect remains the configured Firebase auth handler; configure it in the actual app dashboard rather than pasting an auth handler into a secret field.

## Verification commands

From an approved release (after installing Python 3.12 and creating its .venv):

~~~sh
python -m pip install -r backend/requirements.lock
npm ci --ignore-scripts
npm run check:frontend
npm run test:frontend
cd backend
python -m pytest -q
python -m alembic upgrade head
python -m alembic check
python -m app.manage doctor
~~~

The pytest suite is isolated; it does not prove real Firebase/provider credentials work. Do not run test-mode environment settings against live data.

For the systemd layout, the owner/operator reviews and installs the three unit files, sets ownership/permissions and starts all services only after the migration succeeds. For local development, scripts/run_local.py starts all three processes and handles shutdown.

## Backups, monitoring and rollback

Take a consistent DB/media backup while writes/imports/uploads are paused. Database helper uses pg_dump for PostgreSQL or SQLite's backup API locally. Media helper includes all draft and approved files with checksums. Store backups off-host using an approved encrypted backup service; no offsite schedule was activated here. The owner sets an RPO/RTO and retention policy and verifies a restore rehearsal.

~~~sh
python scripts/backup_database.py /private/backups/store-unique.dump
python scripts/backup_media.py /private/backups/media-unique.tar.gz
python scripts/restore_media.py /private/backups/media-unique.tar.gz /private/restore/new-media
~~~

Run these with the approved server environment/current working directory so DATABASE_URL and MEDIA_ROOT refer to the intended store. PostgreSQL restore uses pg_restore into a NEW isolated DB, with a matching restored media directory and the preserved encryption keys. Verify counts, orders, exact totals, image hashes and permissions before a separately approved switch.

Monitoring should check readiness, HTTPS renewal, worker heartbeat age (>3 minutes is flagged in admin), failed imports/notifications, broken media, payment-review cases, disk/database capacity and backup age. Send alerts only to owner-approved destinations. No external monitoring account or message was created.

Rollback: stop writes/checkout and workers, retain a fresh backup, switch the application release symlink to the previously validated compatible release, and restart/check readiness. The new schema is additive; prefer forward fixes or compatible app rollback. Do not downgrade/drop the new catalog tables on a live database containing approvals/import history. If a full DB rollback is required, restore the matched backup into a new DB/media pair and reconcile orders placed after the backup before an approved cutover.

Single API process remains intentional: rate limits and realtime fan-out are process-local. Horizontal scaling requires a shared limiter/event broker and shared/object media design first.
