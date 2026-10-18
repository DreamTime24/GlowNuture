# Owner product approval playbook

## Roles and states

An inventory_manager can create/edit drafts, upload permitted photographs, import feeds and submit for review. Only the business owner (super_admin) or an explicitly delegated admin can verify, publish, reject, unpublish or archive. All protected admin endpoints require an active server-owned role and privileged staff MFA.

DRAFT → NEEDS_REVIEW → VERIFIED → PUBLISHED is enforced in services/product_policy.py. REJECTED can be corrected and resubmitted. ARCHIVED can be restored as a draft; historical orders are retained.

Each product has a revision. Material content, price, variant or image/rights changes invalidate approval. Review requests must name the current revision; concurrent edits return 409. Stock-only movements preserve approval but checkout always uses actual current, unexpired stock. A customer cannot set approval internals through any mutation schema.

## Practical setup

1. Sign in through the configured Firebase project. Grant the exact existing owner UID through the server CLI; enable/enroll staff MFA and sign in again.
2. Add the real supplier under Suppliers. Keep sourcing and invoice notes private.
3. Open Catalog sources. For the three supplied files, the `super_admin` can use **Import supplied catalogs** after checking the source/metadata reuse confirmation; the server registers or reuses three separate authorized file sources. For other files, register an owner-authorized CSV/JSON/XLSX source per dataset. Supplier APIs need their own authorization.
4. For the free reference API, choose “Prefill free Open Beauty Facts terms”, review the linked upstream licenses, then explicitly authorize. Reads require no paid API key. Community data is reference information, not evidence that a genuine item was supplied.
5. The supplied-catalog button queues three jobs (500 + 12 + 227 rows). For manual imports, upload one complete CSV/JSON/XLSX file (1 MB / 500 rows; CSV/JSON must be UTF-8) to its matching source, or queue 1–5 API pages. The worker processes a file in 100-row pages. Keep both workers running. The page shows actual queued/running/completed/failed job state, counts and retries. Supplied competitor prices remain private reference values, not the store's BDT price.
6. Open Product review. Inspect each product. Set the actual local BDT price, physical unreserved stock, SKU, size, category, full ingredients, instructions, warnings, condition and expiry in Products. External data never fills financial/inventory fields.
7. Open the inspector’s private image gallery. Source image thumbnails/links are unverified staff-only candidates; the owner/admin can fill the existing permitted URL form from a candidate. Upload your own or explicitly permitted photographs, record rights holder/license/evidence, confirm product/variant match, and choose the main/gallery images. An authorized HTTPS URL can then be copied into managed storage by an owner/admin.
8. Run “Check stored images”. Correct all readiness checks. Photograph and ingredient verification require human examination.
9. Submit the saved draft for owner review. The owner selects the real active supplier, records evidence and explicitly checks all 14 confirmations.
10. Verify, then inspect the saved VERIFIED revision and explicitly publish it in the separate form.

Only public-eligible products enter catalog, crawler pages, quotes and checkout. Technical validation is not an authenticity certificate. Owner evidence remains a business responsibility.

## Required owner confirmations

Genuine product; authorized supplier; catalog source reuse terms; correct name/brand/size/variant; image match; image rights; description/claims; ingredients; instructions/warnings; condition; expiry; physical inventory; actual BDT selling price; SKU/category and required details.

The backend additionally validates real managed image files and dimensions, permission records, required product information, positive price, genuine compare-price ordering, condition, expiry and quarantine of expired batches.

## Refreshes, duplicates and rejection

Refresh stores source snapshots and field-level differences. Verified local content, BDT price, physical inventory, images and approval remain intact. “Apply selected metadata” is explicit and restarts approval; protected fields cannot be copied from feeds.

Source + stable external ID is idempotent. Valid GTINs surface possible cross-source duplicates. An owner can link a source record to an exact existing product/revision with a reason. Linking does not merge inventory, remove the former draft or rewrite historical orders.

Reject with a useful reason. Unpublish a live product before rejecting it. Archive retains records. Correcting image rights invalidates that product’s approval. Do not bulk “verify” records based solely on imported fields.

## API entry points

| Operation | Endpoint |
| --- | --- |
| Review queue / inspector | GET /api/admin/approval-queue, GET /api/admin/products/{id}/approval |
| Versioned transition | POST /api/admin/products/{id}/review |
| Source registration | POST /api/admin/catalog/sources |
| Owner-only supplied catalog import | POST /api/admin/catalog/bundled-imports |
| File / API import | POST /api/admin/catalog/uploads, POST /api/admin/catalog/jobs |
| Job progress / retry | GET /api/admin/catalog/jobs/{id}, POST …/{id}/retry |
| Source snapshots / selected apply | GET /api/admin/products/{id}/sources, POST /api/admin/catalog/items/{id}/apply |
| Duplicate candidates / mapping | GET /api/admin/catalog/duplicates, POST /api/admin/catalog/items/{id}/link |

The legacy Ordinary import route now queues an authorized source job. It never publishes products or bypasses the rotation gate.
