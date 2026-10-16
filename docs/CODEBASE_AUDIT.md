# Codebase audit and delivery scope

Historical report: see [TEST_REPORT_FINAL.md](TEST_REPORT_FINAL.md) and [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md) for the 16 October 2026 implementation and current results.


The owner upload contained a FastAPI scaffold and an established Bangla-first vanilla storefront, including pastel CSS, SVG artwork, Nuri/mandala auth and a dark admin layout. The pre-existing GitHub main branch instead contained an older flat static store. This change adds the uploaded full-stack source on a separate draft branch and keeps main/history intact.

## Verified problems and fixes

| Finding in the supplied source | Result |
| --- | --- |
| Demo inventory/browser order state could disagree with server data | Approved server catalog replaces even an empty local list; no demo products/coupons seeded |
| Wishlist access used an invalid property | Runtime failure corrected and covered by DOM tests |
| Auth/account screens described browser-only accounts | Firebase forms, server identity/session checks, profile/address APIs; obsolete browser auth marker removed |
| Checkout form did not reach its submit branch | Guest checkout now posts a server-quoted amount, numeric product IDs and idempotency key |
| Product art could appear as a product image | Actual remote/local images with contained layout and deterministic fallback |
| Private product API could be placed in frontend | Backend-only Parse request, bounded pages/retries, draft import and local overrides |
| Client totals/stock could be trusted | Paisa arithmetic, conditional SQL updates, reservations, expiry and cancellation release |
| Payment redirects could be mistaken for proof | Signature + merchant-side verification, duplicate/late-capture handling |
| Latest configured unit cost could differ from allocated batches | Exact line-total snapshots from each purchase batch, incomplete-cost flag and additive migration |
| Small partial refunds could leave a rounding remainder | Every paisa allocated against remaining recognized ledger buckets; end-to-end test |
| Account deletion referenced an unimported outbox model | Deletion now removes account lists/devices/jobs while retaining restricted financial records |
| Nuri listeners survived navigation | Auth lifecycle cleanup prevents stale scene listeners |
| Static delivery/ranking/demo copy overstated service status | Neutral delivery copy, offers label, accurate tracking FAQ, journal disabled pending review |
| Dependencies contained known advisories | Updated installed dependencies; pinned app dependency audit and JS audit rerun |

The four supplied theme files are retained byte-for-byte: app.css, glow-enhance.css, glow-motion.css, glow-auth.css. Additions are in commerce.css and functional scripts. Existing motion remains; reduced-motion rules are supported. An additive GN favicon is provided because no separate official logo file was supplied.

## Implementation boundaries

| Area | Present | Remaining |
| --- | --- | --- |
| Customer commerce | Approved browsing, variants, wishlist/comparison, server cart sync, guest/account checkout, tracking, reviews, return requests, receipts | Real device/browser acceptance |
| Identity | Firebase adapter, verification/reset, OAuth buttons, TOTP UI and server checks, six roles | Console providers/domains/ADC and live acceptance |
| Inventory | Suppliers, purchases, batches, expiry exclusion, quarantine, reservations/movements | Physical stock/accounting reconciliation by owner |
| Payments | Hosted SSLCommerz sandbox/live adapter, verification, manual external-refund records | Merchant credentials, sandbox and live bank settlement acceptance |
| Courier | Manually booked reference, status/events, shipping cost and delivered COD collection | Live Pathao/Steadfast/RedX API booking, polling/webhooks |
| Content | Plain-text policies, FAQs, banners, category/brand records; original category artwork/navigation | Rich editorial CMS, approved journal content and dedicated normalized taxonomy tables |
| Marketing | Dated/limited coupons, banners, opt-in subscriptions/preferences | Loyalty/referrals, mass email automation, flash-sale scheduler, Meta Pixel/CAPI |
| Accounting | Sales, acquisition-cost snapshots, delivery, processing fees, refunds, expenses, incomplete-profit warnings, CSV | Full double-entry accounts, tax filing, accounting PDF reports, sales charts/date filtering |
| Optional AI | Disabled by default, keyword lookup grounded in approved catalog | LLM chat/recommendation/drafting/report summarization |
| Operations | Docker/Compose, Nginx example, migration, local backup CLI, manual CI | Existing Cloud SQL inspection, durable cloud media, scheduled offsite backups, production alerts, PostgreSQL CI execution |

Category/brand data is stored as content records and product labels, not foreign-key taxonomy tables. Product image metadata lives on product JSON/URL fields. Cart/wishlist/comparison live in a related customer-state row; staff roles are constrained user fields. The 29-table schema is documented in DATABASE.md.

This is tested core commerce source, not a claim that every optional master-prompt feature or live integration is finished. External setup and the explicitly listed remaining modules must be completed before a full production acceptance sign-off.
