# Owner-only actions before opening the real store

Implementation is prepared in source; no production cutover, DNS change, provider account creation, live payment or product publication was performed.

| Area | Exact owner action |
| --- | --- |
| Namecheap plan | Hosting List → Manage: verify exact plan/type, SSH/root/runtime/resources and current hosted data. The screenshot does not establish Shared/VPS status |
| Domain access | Sign in to the separate Namecheap account holding glownuture.com; inspect authoritative DNS and preserve email/MX/TXT. Approve any DNS change only after staging acceptance |
| Account security | Enable Namecheap 2FA and recovery methods yourself; no account settings were changed |
| Backend hosting | Approve an existing compatible ASGI server or a specific plan/cost. Shared Hosting does not officially support this FastAPI backend |
| Firebase | Put the supplied public web configuration in environment variables; enable the actual auth providers, required authorized domains and staff MFA. Configure existing server ADC/workload identity or an existing private Admin credential outside source |
| First owner | Sign in once, then grant super_admin to that exact Firebase UID using python -m app.manage grant-role --firebase-uid EXACT_UID --role super_admin --confirm on the authorized server. Re-sign in with MFA |
| Parse | Revoke/rotate the previously exposed private key in the provider account; configure the replacement only in the server secret environment and set PARSE_KEY_ROTATION_CONFIRMED=true |
| Free API | In Catalog sources, use Open Beauty Facts prefill; review/authorize metadata and image reuse terms. Reads require no paid key. Complete any upstream usage registration and attribution/share-alike obligations applicable to your use |
| Suppliers / media | Provide genuine supplier/purchase evidence and own/permitted photographs. Check exact physical product, variant, expiry and permission source. No arbitrary web image becomes authorized by being publicly visible |
| Store catalog | Set actual BDT prices and physical stock, then explicitly verify and publish each revision through the owner checklist |
| Seller / policies | Supply real business/seller name, address, support phone/email and owner-approved terms, privacy, delivery and returns policies. Confirm applicable business/tax/consumer obligations with the relevant authority |
| Payments | Supply approved SSLCommerz sandbox credentials and verify real sandbox callbacks/refunds/settlement workflow. Leave SSLCOMMERZ_LIVE=false until merchant approval and explicit live authorization |
| Notifications / courier | Configure consent-based SMTP/FCM and approve real courier processes. Manual records do not book a shipment or move money |
| Backup / monitoring | Approve off-host encrypted backup destination/retention/RPO/RTO, run a full DB+media restore rehearsal, and choose an alert destination |
| Final acceptance | Run real Firebase login/reset/email verification/staff MFA, real provider egress, sandbox checkout, PostgreSQL tests, desktop/mobile browser and TLS/DNS/renewal checks on staging before approving cutover |

Keep CHECKOUT_ENABLED=false until seller policies, approved products, real inventory, customer authentication and operational acceptance are complete. No debit-card number or CVV is required for product images or gateway setup; the application does not collect/store either.

The free provider adapter, encrypted credential fields, environment template, approval queue and deployment files are already prepared. Account ownership, private credentials, contractual supplier/image rights and legal/merchant approvals cannot be manufactured in code.

See DEPLOY_GLOWNUTURE_NAMECHEAP.md for concrete server commands and approval boundaries; PRODUCT_APPROVAL_PLAYBOOK.md explains day-to-day catalog operations.
