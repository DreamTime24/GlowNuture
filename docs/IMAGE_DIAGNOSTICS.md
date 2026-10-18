# Image integration and diagnostics

## Storage contract

MEDIA_ROOT must point to a persistent private directory shared by the API and catalog worker. Development defaults to frontend/media. Compose uses the named media volume; systemd examples use /srv/glownuture/shared/media via the environment.

Every new photograph is a MediaAsset with a product binding, source URL, rights holder, license, permission evidence, redistribution flag and approval reference. Original filenames are not trusted. The upload is decoded, checked against its MIME, oriented and stripped of metadata. Only single-frame JPEG/PNG/WebP is accepted, up to 5 MB and 15 megapixels.

The pipeline creates UUID directories containing main (max 1600px), thumb (160px), small (320px), medium (640px) and large (960px) WebP files. Smaller originals are never enlarged. Every size has byte count, dimensions and SHA-256 metadata. Verification requires a real main photograph with both dimensions at least 256px.

Draft photographs are served through authenticated, no-store /api/admin/media/{id}/preview. Public /media/assets/... requests require an approved asset belonging to a currently eligible published product. Do not bypass this route with an Nginx public directory alias. The old local links of grandfathered live products are preserved.

## Upload product photos

From Admin → Products, choose “Upload / manage images” for the product. In its review inspector, upload a JPEG, PNG or WebP photograph (up to 5 MB), record the rights details, and confirm the exact product match. The server creates optimized WebP sizes; select the main image and gallery, then complete the normal review and publish workflow. This self-hosted path has no per-image API fee and avoids unreliable hotlinks or random, potentially misleading product imagery.

## Free image/reference API

Open Beauty Facts integration is available without a private read key. Source data can include image candidates; importing metadata does not automatically download or publish photographs. Select the correct reference, check license/attribution and physical product/variant match, then use the authorized URL importer to store a permitted copy.

The upstream project distinguishes database/content licensing from image licensing. Its documentation describes image attribution/share-alike obligations and warns that packaging elements can involve other rights. Record the applicable permission/license and original source for each photograph; do not treat an arbitrary website image as free.

Primary references:
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/

Public product details expose credits/license/source and indicate resizing/WebP conversion. Private invoice/permission evidence is not returned publicly. No paid stock-photo account or API key was purchased.

## Diagnose a product

Open Product review → inspector → “Check stored images”. Checks persist actual local health results. A background worker rechecks up to three previously approved assets older than an hour on each tick.

| Result | Meaning / remedy |
| --- | --- |
| missing_main_image | Upload an accurate, permitted main photograph and select it |
| unmanaged_external | A hotlink is not a persistent approved image; copy a permitted source through the rights workflow |
| unregistered_local | Register/upload the actual file rather than inventing a URL |
| wrong_product | Asset belongs to another product; upload the correct photograph |
| missing_or_invalid | A derivative is absent or fails hash/format/dimension validation; restore the matching backup or replace/review |
| HTTP_301/302/403/404 from authorized copy | Redirect/blocked hotlink/unavailable source; obtain a direct permitted HTTPS image or upload an authorized file |
| NONPUBLIC_DESTINATION / UNSAFE_URL | Rejected private/loopback/link-local/credential-bearing URL; never work around the network guard |
| DNS_FAILURE / NETWORK_OR_TLS_FAILURE | Server cannot resolve/connect/validate TLS; diagnose hosting egress without weakening TLS |

External copies pin a validated public IP while retaining TLS hostname verification. All resolved addresses must be public. Redirects and environment proxies are rejected; response size, content type and time are bounded. No automatic crawl or restricted-site scraping is performed.

Health can detect missing/corrupt files and binding errors. It cannot identify a visually wrong product or prove legal rights; the owner’s image-match and rights checks provide those decisions. Integrity failures make new managed products ineligible until corrected. Existing legacy hotlinks remain a migration review item.

## Frontend reliability

Homepage/category/search/detail/cart/compare cards use actual API image URLs, responsive srcset/sizes when available, meaningful alt text, fixed intrinsic dimensions and object-fit containment. Detail main image is eager; other images lazy-load. On error the renderer clears responsive sources, tries gallery alternatives and finally uses the local no-image SVG. Products without an image use that same local placeholder instead of an external random-photo service. The placeholder is not a product photograph.

Catalog request errors are separate from image errors: a failed `/api/products` request means the backend catalog did not return successfully. The storefront reports the HTTP status when the response has no useful error detail; check `/api/health`, `/api/ready` and server logs before retrying.

Tests exercise generated, conspicuously labelled QA photographs in disposable directories, actual WebP responses and private/public access. These are not production product assets. JSDOM tests verify DOM/handlers; real device geometry, visual matching and real owner photographs remain owner acceptance checks.

## Backup and restore

Back up the database and MEDIA_ROOT consistently during an import/upload maintenance window. New media backup and restore helpers use a checksum manifest, private output files and a new restoration directory. They never overwrite existing media. Restore the matching DB/media pair into staging, run image health checks and only then approve a cutover. Keep encryption keys separately; backups contain private draft media and operational data.
