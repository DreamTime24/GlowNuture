# Final test report — 16 October 2026

## Verified passing checks

| Check | Observed result | Evidence |
| --- | --- | --- |
| Backend full pytest suite | **111 passed**, one upstream Starlette TestClient/httpx deprecation warning | evidence/backend-pytest.txt |
| Frontend syntax | **10 JavaScript files** checked successfully | evidence/check-frontend.txt |
| Frontend JSDOM interaction suite | **23 passed**, zero failures | evidence/test-frontend.txt |
| Actual local Alembic upgrade/current/check | Head **83849398735f**, no new upgrade operations | evidence/migrations.txt |
| Fresh schema up/down/up + real application startup | Passed as part of backend suite, on disposable SQLite | tests/test_operations.py |
| Populated previous-version upgrade | Prior live/draft/archive, prices, stock, image links, users, orders and line costs preserved | tests/test_operations.py |
| PostgreSQL offline DDL | Boolean defaults and partial unique source-job index compiled | tests/test_operations.py |
| Database backup roundtrip | Exact value/integrity, private permissions, overwrite refusal | tests/test_operations.py |
| Media backup/restore | SHA-256 equality, existing destination refusal, malicious archive path rejection | tests/test_catalog_acceptance.py |
| Python source compilation | app, migrations and scripts compiled successfully | Executed compileall -q |
| Diff whitespace check | git diff --check passed | Release check |
| npm dependency audit | Zero known vulnerabilities, including development dependencies | evidence/dependency-audits.txt |
| Locked Python dependency audit | No known vulnerabilities found | evidence/dependency-audits.txt |

These checks execute the actual local backend/SQL/image/backup code. Provider responses and Firebase identity claims in integration tests are explicit fixtures. JSDOM verifies DOM and events, not browser layout or successful external image downloads.

## New regression coverage

- Original publish-flag escalation reproduced before the fix; now rejected for inventory staff and forged internal fields.
- Draft → review → verified → published, private image preview, actual WebP GET, crawler eligibility, missing rights/image requirements and staff MFA.
- Stale product revision and variant material edit cannot retain publication.
- Managed image bound to another product cannot be reused as if it matched.
- Missing/corrupt responsive derivative is detected; affected managed products cannot enter public catalog/checkout after health failure.
- Actual unbatched expiry blocks stock checkout.
- Public image credits preserve attribution while private permission evidence stays private.
- Import creates unpriced zero-stock drafts; malicious financial/approval fields cannot cross into local store data.
- Same request replay and same source product are idempotent; active source jobs serialize.
- Refresh preserves owner-verified local title/price/stock/images/publication and records candidate differences.
- CSV BOM/header/size rules, bounded provider shapes, retry/backoff/resume, revoked source authority and partial-scan removal safety.
- A reclaimed lease prevents the old worker from committing stale changes.
- OBF read adapter sends no private API key and retains image candidates without automatically copying/publishing photos.
- Unsafe URL/IP/mixed public-private DNS/redirect/oversized response/invalid media/unauthorized remote image paths are rejected.
- Import input rows, credential blobs and request hashes are not returned in job responses.
- Public source credits cannot expose an executable legacy URL.
- Push service worker gets its public Firebase configuration at runtime; no source key is embedded and server secrets are excluded.
- Brand decoration still loads when actual product media uses an external persistent MEDIA_ROOT.
- Admin UI has a separate owner checklist; no old publish checkboxes, no prechecked source authorization and actual revision in transition requests.
- Responsive fallback clears srcset, tries an alternative and then a local placeholder.
- Base SKU and variants retain separate price/stock/ID through selection/cart.
- Public Ordinary collection shows BDT; standalone rendering refuses to relabel a foreign reference price as BDT.

Existing authentication/ownership/CSRF, paisa/coupon/order/reservation/inventory, payment signature/validation, accounting, notification, review and return regression tests remain in the full suite.

## Live / environment checks

| Operation | Actual outcome |
| --- | --- |
| Real free Open Beauty Facts API request | Attempted directly; failed with DNS_FAILURE in this environment. No live provider success claimed |
| Namecheap account inspection | Sign-in wall observed; screenshot lacks exact plan. No credentials/settings/DNS changed |
| Live Firebase/Admin/OAuth/email verification/reset/MFA | Not verified against the owner's project; authorized server identity/account setup unavailable |
| Real supplier/Parse import | Not performed; old private key must be rotated and owner authorization/egress verified |
| Real approved product photographs | None supplied/verified. QA photographs are generated only in isolated tests and never used as real merchandise |
| SSLCommerz sandbox/live transactions | Live provider test not performed; no merchant credentials used; live mode remains off |
| SMTP/FCM/courier delivery | Not live verified; manual record UI does not claim booking, payment transfer or delivery |
| PostgreSQL daemon / Cloud SQL | No daemon/account available; offline DDL and a manual PostgreSQL CI workflow are prepared, not claimed as a completed PostgreSQL integration run |
| Nginx/systemd/Docker/TLS/DNS | Configuration prepared; runtime installation/cutover/renewal not performed |
| Desktop/mobile browser rendering | Not performed; see supported browser tooling limit below |

## Browser tooling limit

The available cloud browser was usable for the independently requested Namecheap account inspection, where it showed a login wall. It is not an approved substitute for the workspace's managed preview workflow.

The installed Sites skill, /root/.codex/plugins/cache/openai-curated-remote/sites/1.0.1/skills/sites/SKILL.md, states: “If $control-browser is unavailable, skip browser QA: do not start a preview server, install a browser, or improvise another browser-control path.” This session does not expose that browser-control skill. No preview server/browser installation or visual/mobile test was invented. Automated DOM and real backend/image checks were completed instead.

Before launch, test actual mobile/desktop viewports (375, 768, 1440px), keyboard/focus, reduced motion, touch targets, real approved photos, gallery/cart/checkout stability and performance on the authorized staging host.

## Release meaning

This is tested source and deployment preparation, not evidence that the real store is live, legally approved, authenticated against production providers or ready to accept real money. Complete OWNER_ACTION_REQUIRED.md and the staging acceptance in DEPLOY_GLOWNUTURE_NAMECHEAP.md before requesting a production cutover.
