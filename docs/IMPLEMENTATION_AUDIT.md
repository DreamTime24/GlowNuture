# Implementation audit — 16 October 2026

The complete 97-line, 21,930-byte GlowNuture_Codex_Master_Prompt.md was read. The supplied GlowNuture-Commerce.zip (SHA-256 a20836f44d58d58e658bd9ad58306536271c4b649d99cbcebc60f2da5654408e) matched all 97 original tracked files at the start of this implementation. This audit extends the earlier CODEBASE_AUDIT.md; earlier test counts are historical.

## Reproduced defects and changes

| Finding | Evidence before | Implemented correction |
| --- | --- | --- |
| Inventory staff could publish by forging active/content_verified flags | Authenticated inventory_manager POST returned 201 with a published product; new regression initially failed | Flags are rejected; revision-bound owner/delegated-admin transitions, source/supplier/rights checklist and MFA enforce publication on the backend |
| Images could be hotlinked without persistence or a rights record | Product image fields accepted external URLs; earlier uploads had no approval lifecycle | Managed sanitized WebP assets, five responsive sizes, SHA-256 integrity, product binding, permission metadata, private staff preview and approved-only public media |
| Imports were synchronous and provider-specific | Old Ordinary route imported within a web request | SQL-backed bounded jobs, per-source serialization, leases, retries/backoff, stable source IDs, content digests and reviewable diffs |
| Source refresh could be mistaken for local stock or price | External catalog was publicly accessible as a separate reference collection | Public Ordinary endpoints now expose only owner-published local products and actual BDT prices. External price/stock fields never populate store price/inventory |
| Admin had publish/verification checkboxes | Product form could directly set flags | Distinct review inspector, evidence, 14 required confirmations, separate verify/publish actions, history and visible revision |
| Product option selection hid an available base SKU | Only variant options appeared when variants existed | Base product is selectable with its own price/stock/ID; crawler offers have per-SKU BDT price and availability |
| Failed main image could strand responsive sources | Single URL fallback only | Clear srcset on failure, try approved gallery candidates, then one local placeholder; stable dimensions and eager detail image |
| Catalog errors lacked actionable checks | HTTP detail object became a generic failure | Safe message/check lists in GNApi; validation responses never echo submitted credentials |
| Media did not have a restore acceptance path | Database backup existed; media had no integrity manifest | Private media archive + checksum-verified restore into a new directory; existing destinations never overwritten |

Two issues found while testing the new implementation were fixed: timezone-sensitive SQL synchronization during a repeated import, and an upload response that unnecessarily included queued input rows. Lease reclamation is guarded before committing source changes.

## Preserved

FastAPI, SQLAlchemy models and all existing migration files remain. Firebase remains the identity provider; server sessions, role checks, staff MFA, CSRF and origin checks remain authoritative. Existing paisa arithmetic, transactional stock reservation/release, batch costs, coupons, COD records, gateway validation, customer orders, returns, notifications, accounting and role-scoped admin sections remain covered by regression tests.

The ivory/sage/rose/charcoal design, Bangla typography, responsive storefront, Nuri authentication illustration and original base stylesheets remain. catalog-studio.css is additive; no generic storefront replacement was introduced.

The additive migration preserves prior live verified records using an explicit legacy marker. It does not invent owner evidence. Drafts remain drafts, archives remain archived, and all prices, stock, photographs, users and orders are retained. Any material edit removes that grandfather marker and requires the new workflow. A populated previous-version upgrade test verifies this behavior.

## Phase disposition

| Requested area | Code delivered | Verification / remaining boundary |
| --- | --- | --- |
| Product APIs / CSV / JSON | Free Open Beauty Facts, owner files, authorized supplier adapter, rotated Ordinary adapter | Real SQL/HTTP-handler tests; live OBF connection failed DNS in this environment |
| Verification | DRAFT → NEEDS_REVIEW → VERIFIED → PUBLISHED; reject/archive/restore/history | Forgery, stale revision, staff/MFA, rights and missing-image tests |
| Images | Sanitization, optimization, private previews, managed publication, galleries, health checks, credits | Actual image decode/GET/integrity tests; no owner photos or live third-party rights presumed |
| Storefront / admin | Responsive image/card refinements, source/job console, approval inspector, operations page | JSDOM interaction tests; visual browser/device checks remain pending |
| Authentication | Firebase SDK bridge and server session/MFA controls preserved | Offline provider fixtures, actual backend authorization; live owner Firebase access unavailable |
| Orders / payments | Server-calculated BDT, stock safety, COD, existing SSLCommerz sandbox implementation preserved | Provider-fixture signatures/validation tests; no merchant credentials/live transactions used |
| Hosting | Canonical glownuture.com Nginx, ASGI systemd services, Compose workers, readiness, backups/rollback instructions | Exact Namecheap plan requires owner login; templates not installed/deployed |
| Production operations | DB readiness, worker heartbeats, bounded errors, backup/restore scripts | Local/disposable checks only; no uptime/offsite backup service activated |

## Explicit limits

No real products, stock counts, reviews, prices, supplier authority or photograph permissions were invented. No product was published to production. No card number/CVV is stored in the source. The earlier exposed private Parse key must be revoked/rotated by the owner. Firebase web configuration is public configuration; Admin SDK credentials remain server-only.

No Namecheap purchase, DNS change, Firebase Console change, production migration, public deployment, live payment, external refund, courier booking or message/email to another person was performed. Account access and real commercial/legal approvals are recorded in OWNER_ACTION_REQUIRED.md.

The exact Namecheap plan cannot be inferred from an expiry date. The screenshot and sign-in wall establish an access dependency, not Shared/VPS status. Official Shared Hosting documentation states ASGI is unsupported; the prepared deployment preserves FastAPI on an approved ASGI-capable server.
