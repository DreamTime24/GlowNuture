# Product sources and free API integration

## Contracts

| Source | Authentication | Import behavior |
| --- | --- | --- |
| Owner CSV / JSON | Staff session + MFA; source authorized by owner/admin | UTF-8, maximum 1 MB / 500 rows; 100 rows per worker page |
| Authorized supplier API | Optional encrypted X-API-Key or Authorization header | Public HTTPS; GET start/limit or POST JSON start/limit; 12 rows per page |
| The Ordinary / Parse | Rotated PARSE_API_KEY + PARSE_KEY_ROTATION_CONFIRMED=true on server | Existing fixed POST endpoint, 12 rows, bounded response; never send the key to frontend |
| Open Beauty Facts | No private key for reads | Fixed public structured-search endpoint, 12 metadata references per page; owner reviews reuse terms |

Open Beauty Facts uses https://world.openbeautyfacts.org/api/v2/search for structured search. Current upstream documentation recommends v3 for supported new operations but still lists structured search as a v2 operation; the adapter does not invent a v3 search route. API accuracy/coverage and availability are not guaranteed. API usage form, attribution and applicable license requirements remain the operator's responsibility.

Primary references:
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/

## Feed shape

JSON accepts an array or data.products / data / products / items. CSV needs unique headers. Each row needs a stable external_id/id/product_id/sku/valid GTIN and name/title/product_name/name_en. Example **headers only**, not production products:

~~~csv
external_id,name,brand,size,category,description,ingredients,usage,gtin,image_url,source_url
~~~

Ingredients can be a JSON array, newline/semicolon-separated text or provider ingredient text. Supported candidate fields include Bangla/English title, brand, size/unit, category, descriptions, ingredients, instructions, warnings, origin, checksum-valid GTIN, HTTPS source/image references and variant identity/size/SKU.

The normalized DTO strips executable markup and bounds text, arrays and URLs. Candidate photos are references only. Price, cost, stock, active and verification flags are not copied into store fields, even if maliciously present in a file. Source metadata is not automatically a supplier authorization or an image license.

## Workflow and safety

Owner registers a source in Admin → Catalog sources. Supplier credentials are encrypted with the existing PII encryption key and redacted from all responses. Query-string secrets are rejected; use a private header. Ordinary credentials are server environment only. No key is needed for free OBF reads.

Each job uses a 32-hex request ID. Replaying the same request returns the existing job; changing its payload returns 409. A database partial unique index permits one queued/running job per source. Jobs process one page per tick; cursor/counts/errors survive restarts. Retries use bounded exponential backoff, and manual retry resumes a failed job. A stale lease cannot commit after reclamation.

Source + external ID is unique; digest-equal repeats create no duplicate. Refresh records candidate diffs and last-seen availability. Only an exhausted scan beginning at offset zero marks unseen source references unavailable; no scan changes local inventory or unpublishes a local product. Partial scans do not infer removal.

A reviewer may explicitly apply selected non-financial metadata, which invalidates approval. Duplicate GTIN suggestions require a manual owner decision and reason before changing a source mapping; no products, stock or orders are automatically merged/deleted.

HTTP integrations reject redirects, unsafe/private DNS destinations, query credentials, oversized/type-invalid responses and TLS failures. Credentials are never returned in job payloads or generic error messages.

## Public endpoint

/api/catalog/ordinary and /ordinary-catalog now serve only owner-published local The Ordinary products with actual BDT selling prices. Enable the optional collection with CATALOG_REFERENCE_ENABLED=true only after review. /api/products remains the normal shop. Neither endpoint exposes raw imported drafts or a foreign reference selling price.

## Current live verification

A direct request to the real free OBF endpoint was attempted on 16 October 2026 and failed DNS resolution in this execution environment. Provider-shape/retry tests use explicitly isolated fixtures. No claim is made that a real supplier catalog or photograph was fetched successfully. Verify outbound DNS/HTTPS and applicable API terms on the approved staging server.
