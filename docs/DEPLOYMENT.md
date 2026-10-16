# Deployment preparation — বাংলা

For glownuture.com / Namecheap, the current authoritative plan is [DEPLOY_GLOWNUTURE_NAMECHEAP.md](DEPLOY_GLOWNUTURE_NAMECHEAP.md). Exact account plan remains unverified; Shared Hosting does not officially support ASGI. No production action is authorized by these templates.

এই repository থেকে কোনো public deployment, purchase, billing change বা paid resource creation করা হয়নি। Owner-এর master prompt অনুযায়ী এগুলোর আগে explicit approval প্রয়োজন। নিচের files review করার উপযোগী প্রস্তুতি; deployed infrastructure নয়।

## Existing Google Cloud SQL আগে দেখুন

এই session-এ Cloud SQL inventory/credentials পাওয়া যায়নি, তাই existing instance-এর status/engine অনুমান করা হয়নি। Owner/authorised operator Google Cloud Console-এ দেখবেন: project, PostgreSQL engine/version, running status, region, private connectivity/connector, storage/backup settings, connection limits, quota ও recurring cost। Existing instance MySQL হলে PostgreSQL URL বসিয়ে সেটি ব্যবহার করা যাবে না। Reuse/new resource decision ওই তথ্য ও budget approval-এর পরে।

## Server configuration

Use a supported Python 3.12 runtime, private PostgreSQL, encrypted durable media/backups and HTTPS reverse proxy. Frontend and /api must share one approved origin. Do not serve the older repository-root HTML as the production app.

APP_ENV=production, DATABASE_URL=postgresql+psycopg://…, ALLOWED_ORIGIN=https://approved-domain, COOKIE_SECURE=true, ENFORCE_ADMIN_MFA=true। LOCAL_AUTH_ENABLED, SEED_DEMO_PRODUCTS, AUTO_CREATE_SCHEMA সব false। Keep CHECKOUT_ENABLED=false until seller/policies/inventory/provider acceptance pass.

Put secrets in an approved secret manager/environment. For PostgreSQL TLS use appropriate connection options, e.g. sslmode=verify-full and approved CA. Don’t paste database passwords into shell history. URL-encode reserved password characters. Use separate development/staging/production secrets and databases.

Run migrations once with a controlled maintenance/rollback plan before starting the app. Production needs permission-restricted API/worker identities and a minimal-privilege database user appropriate for the operation.

## Prepared files

| File | Purpose / limit |
| --- | --- |
| backend/Dockerfile | Correct full-stack copy layout, pinned Python dependencies, non-root runtime, one API process |
| docker-compose.yml | Local PostgreSQL 17 + migration job + API + notification and catalog workers, persistent SQL/media; API bound only to loopback |
| ops/nginx.conf | Owner-domain/TLS placeholders; proxies API/assets, forwards origin and keeps SSE unbuffered |
| .github/workflows/verify-commerce.yml | Manual verification with isolated PostgreSQL, JS tests and migrations; no deployment |
| firebase.json and firebase/* | Prepared deny-by-default rules; inspect existing rules before any authorised deployment |
| scripts/backup_database.py | Explicit local backup; no offsite schedule or cloud provisioning |

For local Compose, first generate backend/.env and supply a private POSTGRES_PASSWORD in your terminal/process environment. The Compose file refuses a blank password. Use a URL-safe generated password or encode the connection URL consistently. Then docker compose up --build. Docker build/Compose execution was not verified in this environment.

The container base images and GitHub Action major tags are examples, not immutable digest pins. Before production, review/pin approved image/action digests and scan the built image.

## Launch acceptance

Verify authoritative DNS/TLS, Firebase allowed domains/ADC/providers/MFA, approved seller/policies, real stock/cost, sandbox and live gateway callbacks/settlement, courier booking/returns/COD, opted-in email/FCM, anti-abuse controls, private backups/restoration, mobile browsers and accessibility/performance. Configure monitoring of /api/health, application failures, unpaid reservations, failed outbox jobs and payment-review cases. Logs must omit PII, tokens and secret provider URLs.

Run app.manage doctor and review every TODO; its output is a checklist, not an automatic production approval. No scheduled backup, Cloud SQL connector, object-storage adapter or production monitoring service was silently enabled.

For horizontal scale, implement shared rate limits, SSE/event fan-out and shared media first. Preserve the SQL transaction/idempotency safeguards.
