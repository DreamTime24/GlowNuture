# Product sources and free API integration

## Contracts

| Source | Authentication | Import behavior |
| --- | --- | --- |
| Owner CSV / JSON / XLSX | Staff session + MFA; source authorized by owner/admin | Maximum 1 MB / 500 rows; CSV and JSON must be UTF-8; 100 rows per worker page |
| Authorized supplier API | Optional encrypted X-API-Key or Authorization header | Public HTTPS; GET start/limit or POST JSON start/limit; 12 rows per page |
| The Ordinary / Parse | Rotated PARSE_API_KEY + PARSE_KEY_ROTATION_CONFIRMED=true on server | Existing fixed POST endpoint, 12 rows, bounded response; never send the key to frontend |
| Open Beauty Facts | No private key for reads | Fixed public structured-search endpoint, 12 metadata references per page; owner reviews reuse terms |

Open Beauty Facts uses https://world.openbeautyfacts.org/api/v2/search for structured search. Current upstream documentation recommends v3 for supported new operations but still lists structured search as a v2 operation; the adapter does not invent a v3 search route. API accuracy/coverage and availability are not guaranteed. API usage form, attribution and applicable license requirements remain the operator's responsibility.

Primary references:
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/

## Feed shape

JSON accepts an array or data.products / data / products / items. CSV and XLSX need named, unique headers (at most 60). XLSX reads its first nonempty worksheet; the supplied workbook puts products first, so its later notes sheet is not imported. Generic rows need a stable external_id/id/product_id/sku/valid GTIN and name/title/product_name/name_en. The three supplied formats below have dedicated header adapters. Example **generic headers only**, not production products:

~~~csv
external_id,name,brand,size,category,description,ingredients,usage,gtin,image_url,source_url
~~~

Ingredients can be a JSON array, newline/semicolon-separated text or provider ingredient text. Supported candidate fields include Bangla/English title, brand, size/unit, category, descriptions, ingredients, instructions, warnings, origin, checksum-valid GTIN, HTTPS source/image references and variant identity/size/SKU.

The normalized DTO strips executable markup and bounds text, arrays and URLs. Candidate photos are references only. Price, cost, stock, active and verification flags are not copied into store fields, even if maliciously present in a file. Source metadata is not automatically a supplier authorization or an image license.

## Supplied catalog files

The import accepts each supplied file as one complete upload. Each dataset gets a **different owner-authorized file source key**, even when products overlap. A full 500-row file becomes a job of up to five 100-row worker pages; staff do not need to split it manually. The upload limit is 1,000,000 bytes and 500 data rows. CSV/JSON use UTF-8; XLSX is read from its first product sheet. A rejected file should be corrected and uploaded whole again.

| File and recognized headers | Imported draft/reference fields | Still needs owner verification |
| --- | --- | --- |
| `GlowNuture_500_Products_Website.csv` (500 rows): `Product Name`, `Barcode`, `Direct Image URL` | Name, brand, size, Bangla description and source page. Barcode is a stable source ID; 487 of the 500 supplied barcodes pass the GTIN checksum and become GTINs. HTTPS direct image URL is an **unverified candidate**. `BD Price ৳` and `TP ৳`, if present, remain reference fields; `Ingredients (truncated)` remains source metadata. | Its supplied GlowNuture price and stock columns are blank. The ingredient excerpt is not a verified full INCI list. Confirm exact image, rights, real selling price and physical stock. |
| `The_Ordinary_GlowNuture_BD_Catalog.xlsx` (12 rows): `Product name`, `Retail price (৳)`, `Retailer source link` | The Ordinary name, size, category, Bangla description, retailer page and retailer price/MRP/TP **as reference values only**. Eleven rows have retailer price observations. Product identity is derived consistently from brand, name and size. The notes sheet is ignored. | Retailer prices are not GlowNuture selling prices; listed MRP is not an official verified MRP. The sheet supplies no approved product images or confirmed stock. |
| `Shajgoj_BDT_Product_Price_Catalog.csv` (227 rows): `product`, `observed_price_BDT`, `source_page` | Brand, product, size, category, short description, usage and source page. Observed price, MRP and other-page price remain **competitor reference values only**. Identity is derived consistently from brand, name and size. | Category/source links are not approved product photographs. Confirm exact product, actual GlowNuture price and physical stock. |

The parser stores submitted price observations in `reference_prices_bdt` and review notes in `source_metadata` on the private source snapshot. It never uses them as the store's `price`, `compare`, `acquisition_cost` or `stock`. Imported products start as unpublished drafts with zero local price and stock. Re-uploading the same source and identity updates its candidate snapshot without overwriting verified local content; possible cross-source GTIN duplicates require a manual identity decision.

For the supplied datasets bundled with the backend release, sign in to the running FastAPI store as the business owner (`super_admin`), open **Admin → Catalog sources → Import supplied catalogs**, review source/metadata reuse terms, and check the confirmation before submitting. No file selection is needed for this action. `POST /api/admin/catalog/bundled-imports` registers or reuses **three dedicated authorized file sources** and queues **three separate jobs** (500 + 12 + 227 rows). The request carries a 32-character hexadecimal replay-safe `request_id`; repeating the same request does not create another set of imports. Keep the catalog worker running and watch the recorded job counts/status. The confirmation covers source/metadata reuse review; it does **not** grant image rights or approve products.

Alternatively, authorized staff can register and authorize one **file** source per dataset in Admin → Catalog sources, then upload each whole CSV/XLSX file under its matching source through `POST /api/admin/catalog/uploads`. Files saved in GitHub alone do not load into the store database; the API and worker must run.

Open **Product review** for each draft. Source image thumbnails and links are staff-only, unverified candidates. An owner/admin may fill the permitted HTTPS URL form from a candidate, but must first verify rights holder, license/permission evidence, redistribution permission and exact product/variant match. The managed image stays private until the product is explicitly published. Set the real local BDT price, physical stock, verified ingredient and usage details, supplier and expiry evidence; then submit, verify and explicitly publish the saved revision.

## Workflow and safety

The owner authorizes sources in Admin → Catalog sources, either explicitly or through the confirmed bundled import action. Supplier credentials are encrypted with the existing PII encryption key and redacted from all responses. Query-string secrets are rejected; use a private header. Ordinary credentials are server environment only. No key is needed for free OBF reads.

Each job uses a 32-hex request ID. Replaying the same request returns the existing job; changing its payload returns 409. A database partial unique index permits one queued/running job per source. Jobs process one page per tick; cursor/counts/errors survive restarts. Retries use bounded exponential backoff, and manual retry resumes a failed job. A stale lease cannot commit after reclamation.

Source + external ID is unique; digest-equal repeats create no duplicate. Refresh records candidate diffs and last-seen availability. Only an exhausted scan beginning at offset zero marks unseen source references unavailable; no scan changes local inventory or unpublishes a local product. Partial scans do not infer removal.

A reviewer may explicitly apply selected non-financial metadata, which invalidates approval. Duplicate GTIN suggestions require a manual owner decision and reason before changing a source mapping; no products, stock or orders are automatically merged/deleted.

HTTP integrations reject redirects, unsafe/private DNS destinations, query credentials, oversized/type-invalid responses and TLS failures. Credentials are never returned in job payloads or generic error messages.

## Public endpoint

/api/catalog/ordinary and /ordinary-catalog now serve only owner-published local The Ordinary products with actual BDT selling prices. Enable the optional collection with CATALOG_REFERENCE_ENABLED=true only after review. /api/products remains the normal shop. Neither endpoint exposes raw imported drafts or a foreign reference selling price.

## Current live verification

A direct request to the real free OBF endpoint was attempted on 16 October 2026 and failed DNS resolution in this execution environment. Provider-shape/retry tests use explicitly isolated fixtures. No claim is made that a real supplier catalog or photograph was fetched successfully. Verify outbound DNS/HTTPS and applicable API terms on the approved staging server.
