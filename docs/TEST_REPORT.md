# Test report — 2026-10-15

Historical report: see [TEST_REPORT_FINAL.md](TEST_REPORT_FINAL.md) and [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md) for the 16 October 2026 implementation and current results.


Environment: Linux x64, CPython 3.12 virtual environment, SQLite SQLAlchemy database, Node with JSDOM. No public deployment. No live provider credentials were used. Results below describe executed checks, not intended acceptance.

## Executed results

| Check | Result | Scope |
| --- | --- | --- |
| Python pytest | **62 passed**, 1 dependency deprecation warning | Actual FastAPI HTTP handlers, real isolated SQL transactions, CLI operations; external providers replaced with explicit fixtures |
| Frontend node:test | **15 passed**, 0 failed, 6.13 s | JSDOM/event logic, fixture HTTP; no real browser layout |
| JavaScript syntax | 9 external files passed | Standalone inline script also executed by its DOM tests |
| Alembic fresh upgrade/check, downgrade/base, upgrade/check | Passed | Disposable SQLite database; rollback never run on owner data |
| Migrated application lifespan/startup | Passed | Root, manifest, messaging worker, health and catalog 200; private backend .env path 404; OAuth loader origin allowed by CSP without inline JavaScript |
| SQLite backup/restore acceptance | Passed | Content/integrity match, private POSIX mode, existing target refused unchanged |
| Offline PostgreSQL migration DDL | Compiled | 30 CREATE TABLE statements including Alembic's version table; this is **not** a live PostgreSQL test |
| Fresh dependency resolver dry-run | Passed | --ignore-installed with the exact lock; resolution only, not a native Windows install |
| pip check | Passed | No broken installed dependency requirements |
| pip-audit pinned app lock | No known vulnerabilities | 70 dependency entries considered; platform-only requirements may be skipped on Linux |
| pip-audit installed development environment | No known vulnerabilities | 89 installed dependency entries, including audit tooling; point-in-time advisory results |
| npm audit | No known vulnerabilities | npm dependency graph including JSDOM dev dependencies |
| Theme preservation | Passed | Four supplied CSS files byte-identical to owner ZIP |
| Targeted release-secret scan | Passed | Private Parse pattern, private-key payloads and likely card-number formats; one initial loose numeric match was reviewed as SVG path coordinates |

The Starlette warning concerns its deprecated httpx-based TestClient integration. Tests execute successfully with the locked httpx dependency required by Firebase Admin. It is recorded rather than suppressed. npm also reports an inherited host http-proxy configuration warning; its commands exit successfully.

## Backend cases

- Server-only product/coupon/delivery/tax totals, changed-total rejection, invalid quantities and approval/stock gates.
- Duplicate checkout keys and mismatched payloads, simultaneous stock competition, cancellation/expiry stock/coupon release once.
- Actual variant SKU/price/stock, purchase receiving idempotency, dated batches, expiry/quarantine and batch restoration. Mixed-batch exact cost and partially unknown costs are checked through delivery/profit/return ledger flows.
- Firebase Admin verifier calls check_revoked and checks issuer/audience/project; six roles, forged client role rejection, staff MFA and disabled/revoked account handling. SDK/identity network calls are fixture-controlled.
- Profile/address/order ownership, private tracking/invoice access, encrypted fields, CSRF/origin, invalid local credentials and disabled production local authentication.
- Product API response envelopes, missing fields/images, request method/headers/body, retries/timeouts, duplicate imports and preservation of local overrides.
- Hosted payment safe-URL/single-initiation behavior, forged/modified callbacks, provider amount/currency/reference mismatches, valid/duplicate/failed/late capture handling. Merchant HTTP is stubbed, not a live sandbox payment.
- Delivered-purchase review enforcement/moderation, return decisions, refund limits/confirmation/idempotency, full and tiny partial-refund ledger reconciliation.
- Contact/newsletter consent, unsafe media rejection, CSV escaping, push ownership/preferences and outbox behavior with fixture providers.
- Revoked-session logout, account deletion removing private account state while retaining restricted orders, production settings, crawler draft exclusion, startup/migration/backup checks.

## Frontend cases

- Empty or failed catalog never substitutes demo inventory; retry and social/product-image rendering.
- Broken image fallback, hostile upstream text escaping, cart limits and ID/quantity persistence.
- Nuri Firebase email UI, unavailable Facebook button, guest checkout payload/consent/idempotency and variant preservation.
- Customer denied staff UI, auth-scene lifecycle cleanup and core route navigation without runtime exceptions.
- Separate single-file catalog: both data envelopes, image fallback including placeholder failure, retry recovery, and file:// instructions without private provider calls.

## Not executed / not certified

- Live Parse with a rotated key; Firebase email/OAuth/verification/reset, Admin ADC permissions, TOTP provider, reCAPTCHA/App Check, FCM/SMTP or RTDB delivery.
- A live PostgreSQL daemon or existing Cloud SQL inspection. Manual PostgreSQL GitHub Actions is prepared, **not run**.
- SSLCommerz sandbox/live merchant flow, actual bank settlement or monetary refund. Tests do not send or return money.
- Live courier booking/tracking/COD settlement. The implemented workflow records separately booked real shipments manually.
- Native Windows batch execution; Docker image build/Compose; Nginx/TLS deployment; managed cloud media/backup/monitoring.
- Real Chrome/Safari/Firefox or mobile rendering, keyboard/screen-reader acceptance, Lighthouse/Core Web Vitals, load/soak/penetration testing.

Passing fixture tests does not make live credentials, provider approvals, physical stock, legal policies or production infrastructure ready. See OWNER_ACTION_REQUIRED.md and CODEBASE_AUDIT.md for remaining setup and feature scope.

## Reproduce

From project root: npm ci --ignore-scripts, npm run check:frontend, npm run test:frontend. From backend: ../.venv/bin/python -m pytest -q. The test suite uses a fresh temporary SQLite database unless TEST_DATABASE_URL points to an isolated PostgreSQL database named glownuture_test. Never point it at an owner/live database.
