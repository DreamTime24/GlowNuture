# Architecture

## Request and data ownership

The existing frontend is served from the same origin as FastAPI. Product cards, account screens and admin forms call /api through assets/api-client.js. Firebase browser SDK signs the customer in; the API validates the ID token with the Admin SDK, checks issuer/audience/revocation, and creates an opaque HttpOnly session. The browser never assigns a role.

PostgreSQL is the production source of truth for users, stock, orders, money, customer lists, reviews and notifications. SQLite is the local-development substitute. Realtime Database contains only a server-written notification projection under notifications/{uid}; clients cannot write it.

## Source map

| Path | Responsibility |
| --- | --- |
| frontend/index.html and assets/app.js | Existing router, layout, cart, checkout and account views |
| assets/glow-*.css/js | Retained theme/motion/auth scene; protected admin UI |
| assets/firebase-bridge.js | Firebase identity, TOTP, optional captcha/App Check/analytics/FCM |
| assets/commerce-ui.js and commerce.css | Catalog reference, comparison, policies, profile/security and notifications |
| frontend/catalog/index.html | Separate one-file vanilla catalog; server proxy only |
| backend/app/api/platform.py | Auth, products, checkout, orders, payments, reviews, accounts and main staff routes |
| backend/app/api/business.py | Suppliers/purchases/batches/media, content and operational administration |
| backend/app/services/commerce.py | Paisa calculation, transactional reservation, status/ledger operations |
| backend/app/services/payments.py | Hosted gateway initiation and verified callbacks |
| backend/app/services/catalog.py | Bounded private Parse fetch, normalization, draft import/deduplication |
| backend/app/services/firebase.py | ADC/Admin identity verification, captcha, FCM and notification projection |
| backend/app/worker.py | Reservation expiry and leased SQL notification jobs |
| backend/app/manage.py | Owner role grant, diagnostics, expiry and notification retry |
| backend/app/seo.py | Crawler-facing product pages, sitemap, robots and llms.txt |
| backend/migrations | Alembic schema history |

## Money and stock

Amounts use Numeric and Decimal in persistence; quotes expose integer paisa. The browser submits expected_total_minor, but the API recalculates every line, discount, delivery and tax. A changed total is rejected for review.

Orders reserve actual stock atomically. PostgreSQL row locks plus conditional updates serialize competing stock/coupon use. Dated batches are allocated in expiry order; expired stock is excluded. The order snapshots exact total cost from each allocated purchase batch without rounding a blended per-unit average. Unbatched units use the configured product cost; unknown units suppress profit totals. Cancellation/expired unpaid reservations release once, including batch allocations and coupon use.

Checkout idempotency is a hashed random key plus a payload/account fingerprint. Reusing the key for another payload is rejected. Hosted-payment initiation is marked before the provider call; an uncertain timeout requires reconciliation instead of creating repeated sessions automatically.

## Privacy and scaling

Customer payloads, saved addresses, contact messages, supplier contacts and device tokens are encrypted. Lookup/session tokens are hashed or HMACed. Device browsing storage contains IDs/quantities only; current profiles, order receipts and private tracking tokens remain in memory.

Rate limiting and SSE use one API process. Compose runs one worker per API container. Multiple instances need shared rate limiting, shared media and a Redis/event-stream fan-out before scaling. Outbox delivery is at-least-once; FCM partial-success/SMTP timeouts can still produce duplicate or missed device messages and need provider reconciliation.
