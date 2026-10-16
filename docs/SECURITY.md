# Security model and limits

## Implemented boundaries

- Private Parse/merchant/SMTP/Admin credentials are server-side environment or ADC only. Public Firebase web config/site/VAPID keys are not Admin authentication.
- Firebase Admin checks project audience/issuer and revocation. Protected account requests check disabled/revoked identity. New users are customers; database roles and six permission sets control staff endpoints.
- Opaque random sessions use hashed database tokens, HttpOnly, SameSite=Lax cookies; production uses Secure/__Host cookies. Writes require exact allowed Origin and a session-bound CSRF token. Staff Firebase sessions require a verified second factor.
- Customer/address/contact/supplier/device payloads use authenticated Fernet encryption. Phone/identity lookups use separate HMAC secrets. Local development passwords use Argon2; production local auth is rejected.
- Checkout totals are recomputed. Numeric values, constrained SQL updates, locks and uniqueness protect stock, idempotency, callbacks, refunds and accounting references.
- Public tracking requires an unguessable private code and does not expose a recipient address. Signed-in orders, invoices and lists enforce ownership. Staff access requires permission/MFA.
- Responses use no-store for /api, CSP, frame denial, nosniff and referrer/permissions policy; production adds HSTS. Main UI scripts use external files; single-file catalog gets a content hash policy.
- Body/upload limits, re-encoded image uploads, sanitized URLs, escaped text and CSV formula escaping bound common injection paths.
- Owner approval is revision-bound and server-enforced. Inventory staff cannot forge publishing flags. Supplier evidence and all 14 confirmations are required; stale review and material edits cannot retain approval.
- Supplier header credentials are encrypted/redacted. Provider/media requests pin validated public IPs with hostname TLS verification, reject redirects/private DNS/query secrets and enforce response limits. Imports never set local prices/stock or publish products.
- New media is private until approved; UUID paths, actual MIME decoding, single-frame/pixel/byte limits, metadata stripping, managed product binding and checksum health checks protect the pipeline. Permission evidence stays private; public credits/attribution remain visible.
- Firebase rules deny client writes and cross-user reads. They are prepared files, not deployed/verified rules.

## Secrets and release hygiene

Do not put a card number, CVV, PIN, Parse key or service-account JSON in HTML, git, examples, logs or screenshots. Rotate the exposed Parse key in its provider console. No original private Parse key or bank card data is needed to install the project.

Keep backend/.env outside version control and backups protected. The environment loader reads application settings from backend/.env; GOOGLE_APPLICATION_CREDENTIALS must be exported in the **server process environment** when using an existing approved private credential file. Prefer workload identity/ADC on an approved server.

Fernet encryption protects selected application fields, not every database column or the whole server. Order IDs, monetary ledger data, role/operational metadata and encrypted-message relationships remain in SQL. Use encrypted disks/backups and restricted database access as well. Keys on the same compromised server do not protect against that server compromise.

Account deletion removes the identity, account lists, addresses, tokens, sessions, notifications and queued jobs and anonymizes the profile. Restricted order/financial records remain for required business retention. It is not a blanket deletion of transaction history.

## Outstanding deployment work

reCAPTCHA needs the correct key type, allowed domains and matching server secret; App Check needs a separate configured provider key and rollout. They default off so the supplied unverified site key cannot silently break all checkout. Rate limiting still applies, but production should add trusted edge/shared limits. Test anti-abuse controls before launch.

In-process request limits/SSE assume one API process. Trust forwarded client IPs only from your own reverse proxy. A public proxy must not allow callers to inject trusted forwarding headers. Notifications are at-least-once and FCM partial failures need reconciliation.

Local media storage needs a durable owner-approved volume or an object-storage implementation before multiple instances. No cloud storage upload adapter or public bucket was provisioned. Default Firebase Storage client rules deny everything.

Dependency audit has a point-in-time scope; no “bug-free”, “unhackable”, PCI certification or legal compliance claim is made. Provider credential responses in integration tests are fixtures; SQL, authorization, image processing/serving and backup restoration checks execute real local code. Browser/mobile/accessibility review, production penetration review, PostgreSQL concurrency acceptance, incident response and restoration rehearsal remain required.
