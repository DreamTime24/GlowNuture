# Database and migrations

## Engines and models

PostgreSQL is required when APP_ENV=production; the application rejects SQLite in production. SQLite enables foreign keys and a busy timeout for local development. No database contents or old owner data are in the package.

The schema has 35 tables:

| Area | Tables |
| --- | --- |
| Identity | users, sessions, addresses, customer_state |
| Catalog/stock | products, variants, inventory_movements, batches, stock_allocations |
| Procurement | suppliers, purchases, purchase_items |
| Orders/money | orders, order_items, payments, shipments, refunds, return_requests, ledger |
| Customer/content | reviews, support_messages, newsletter_subscriptions, business_records |
| Operations | notifications, push_subscriptions, outbox, import_logs, audit_logs |
| Verified catalog | catalog_sources, catalog_item_sources, catalog_import_jobs, product_approval_events, media_assets, operational_heartbeats |

Product images/ingredients/source snapshots use bounded JSON/URL fields. Category/brand labels are on products and publishable business_records; they are not separate relational taxonomy tables. Settings with private secrets remain environment variables. Roles are constrained on users, not accepted from client token custom fields.

Constraints cover unique SKU/slug/source identity, session/token hashes, checkout idempotency, provider validation references, ledger references, nonnegative stock/amounts, role values and verified review uniqueness. Monetary fields are Numeric(12,2); quote calculations use integer paisa. Order items snapshot selling price and exact allocated-batch line cost. Tracked units use the related purchase-line cost; unbatched units use the configured acquisition cost. Any unknown unit cost makes profit incomplete, even when other units in that line have a positive cost.

## Fresh setup

From backend:

~~~bash
../.venv/bin/python -m alembic upgrade head
../.venv/bin/python -m alembic current
../.venv/bin/python -m alembic check
~~~

Initial revision: 0895e25ebd15. Cost snapshot revision: 7ba1d85a24ef, adding exact line cost_total and cost_complete snapshots. Current head: 83849398735f, after additive e87a89c26a85 (approval/media/imports) and source-job partial uniqueness. The additive migration backfills existing rows from their recorded unit cost × quantity; it cannot reconstruct a different historical batch cost that was never recorded. Startup checks that schema revision equals the current head. AUTO_CREATE_SCHEMA is development/test-only and must stay false on deployed servers.

The additive catalog migration preserves previously active+verified products as PUBLISHED/legacy_approved, retains drafts/archives and does not fabricate approval history. A populated upgrade test verifies product prices/stock/image links, users, orders and cost snapshots survive. Material edits require the new owner workflow.

An older unversioned legacy database requires an explicit data mapping/migration after backup. Do not blindly stamp the revision or run downgrade on real data. Test migrations on a disposable copy, including encrypted field/key compatibility.

## Backups and restoration

Run scripts/backup_database.py from backend with an explicit new private target path. SQLite uses its backup API; PostgreSQL uses an installed pg_dump and passes the password through the process environment. The script refuses to overwrite an existing target. Use a pg_dump version compatible with the server. Protect the output and keep Fernet/HMAC keys separately.

An offsite schedule, retention policy, managed snapshot/PITR and restoration rehearsal are owner deployment work. For PostgreSQL, restore a custom dump into an **empty isolated staging database** with pg_restore; never use --clean against production to test. Compare row counts, totals, encryption reads and migrations before accepting a backup. SQLite restore verification can inspect a copy without touching the source.

Restoring only SQL without its encryption/HMAC keys loses usable customer records and lookup continuity. Replacing keys arbitrarily is not key rotation; migration/re-encryption is required.

## Verification limits

SQLite migrations and real SQL HTTP/concurrency tests were run locally. PostgreSQL offline migration SQL can be compiled, but no live PostgreSQL daemon/Cloud SQL account was available here. A manual GitHub Actions workflow provisions the isolated glownuture_test database for the same suite; it has not been triggered. TEST_DATABASE_URL refuses non-PostgreSQL URLs and databases not named glownuture_test; tests drop/create only their disposable database.
