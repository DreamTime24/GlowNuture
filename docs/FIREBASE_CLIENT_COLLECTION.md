# GlowNuture — reviewed client collection for Firebase

**Current scope:** This is a genuine working, **read-only** product-discovery page at \`/collection/\`. It does NOT accept orders and does not pretend the static Firebase preview is the production FastAPI store. The original \`frontend/\` and all order/customer/payment services are preserved.

## 1. Put your real product information in CSV

Edit \`client_catalog/approved_products.csv\`. One row per **actual identified product**. The template includes headers, not pretend products.

Columns:

- \`product_id\`: stable unique ID (your own SKU or exact barcode).
- \`name\`, \`brand\`, \`category\`, \`size\`: exact packaging identity/variant.
- \`description_bn\` or \`description_en\`: human-verified description, not a claim made up from an image.
- \`ingredients\`: only known and verified ingredients. Keep blank if uncertain.
- \`source_url\`: optional HTTPS reference for origin/packaging.
- \`local_image\`: **relative path inside** \`client_catalog/images/\` (example \`ordinary/niacinamide-30ml.jpg\`). Case sensitive on Firebase build.
- \`image_credit\`: photographer/rights holder and required attribution.
- \`product_approved\`: set \`yes\` only after checking the identity, size and description.
- \`image_rights_approved\`: set \`yes\` only if you own or have suitable permission to host this image publicly.
- \`image_match_approved\`: set \`yes\` only if the photograph is of the **same product, shade and size**.
- \`price_bdt\`: only an actual owner-confirmed selling price.
- \`price_verified\`: set \`yes\` only if \`price_bdt\` is approved as current. Otherwise no price is shown.

**All three approval fields must be \`yes\` for a row to appear.** Any missing/invalid image blocks publication of that row. Nothing automatically appears in the checkout inventory. No purchased stock, image rights, fake prices or claims are inferred from the source feed. The 500-item Open Beauty Facts export can be a starting *reference*, but its empty BDT/stock cells and unverified images are not release approval.

## Convert your existing CSV to a review sheet (optional)

Use the earlier GlowNuture 500-product CSV or \`ogerio_products.csv\`. This command maps product names, brands, descriptions and exact-name **candidate** images to an unapproved review CSV:

\`\`\`powershell
py -3.12 scripts/prepare_client_catalog_from_csv.py --csv "C:\path\to\your_products.csv" --images "client_catalog\images" --output "client_catalog\review_candidates.csv"
\`\`\`

All approval flags default to \`no\` and the owner selling price stays blank. Review the file, verify image rights and exact product variants, then copy only approved records into \`client_catalog/approved_products.csv\`. This command never overwrites existing reviewed CSV files.

## 2. Add matching real photos

Extract your image ZIP/RAR **on your PC** and copy the photos to \`client_catalog/images/\`. Edit \`local_image\` for the real match, check licensing, then approve each row. The image matching manifest generator is also available:

\`\`\`powershell
py scripts/prepare_product_image_manifest.py --csv "C:\path\to\source.csv" --images "C:\path\to\photos" --output "image_review_manifest.csv"
\`\`\`

That manifest's \`CANDIDATE_REVIEW\` **is not an approval**. No images from the previously uploaded \`Videos.rar\` have been extracted/verified in this environment.

## 3. Build and inspect before hosting

At the repository root on Windows, install Python 3.12 and run:

\`\`\`powershell
py -3.12 scripts/build_firebase_preview.py
py -3.12 scripts/doctor.py --mode firebase-preview
py -3.12 -m unittest discover -s tests -p "test_client*.py" -v
\`\`\`

The static files will be in \`build/firebase-preview/\`, with the collection at \`build/firebase-preview/collection/index.html\` and products in \`collection/catalog.json\`. You must serve these via HTTP, not double-click the HTML file.

Check the browser at \`http://localhost:PORT/collection/\`, not just the file tree. Verify images, mobile layout, no false prices, working filters and product details.

## 4. Publish to Firebase

\`\`\`powershell
npm i -g firebase-tools
firebase login
firebase use glownuture-f157c
firebase deploy --only hosting --project glownuture-f157c
\`\`\`

The \`firebase.json\` **already** points to \`build/firebase-preview\`. Confirm you are in the intended Firebase account/project and have the rights to publish images before deploying.

> Important: \`.github/workflows/deploy-firebase-hosting.yml\` on main can automatically deploy a static preview from GitHub when the configured service-account secret is present. Merging a branch may publish without a manual \`firebase deploy\`. Do not merge until the catalog and rights are reviewed.

## Production checkout isn't enabled by Firebase static hosting

The original private APIs, Firebase Auth server verification, inventory, and payment checks need a running FastAPI/PostgreSQL/worker deployment. This collection alone is for client-facing **product discovery only**. It does not misrepresent an unfinished checkout as operational.

To make the entire shop live, separately deploy the backend using the established \`docs/DEPLOY_GLOWNUTURE_NAMECHEAP.md\` playbook and verify it end-to-end.
