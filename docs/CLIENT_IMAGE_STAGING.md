# GlowNuture — local product-image staging (not a deployment)

The uploaded `Videos.rar` has **not** been verified/extracted into this GitHub workspace. Do not claim that any of its images are already matched or published. This utility prepares a review manifest using **actual files on the owner's PC**.

Run from repository root with Python 3.12+ after extracting the image archive:

```powershell
py scripts/prepare_product_image_manifest.py --csv "C:\path\to\products.csv" --images "C:\path\to\extracted_images" --output "image_review_manifest.csv"
```

The image folder may contain JPG, PNG and WebP files in nested folders. Supported CSV headers include `Product Name`, `Brand`, `Barcode`, `Direct Image URL`, and `Product Source Link` as well as lowercase scraper variants.

Matching is intentionally **conservative**: only one-to-one exact normalized product-name/file-stem matches become `CANDIDATE_REVIEW`. Similar-looking or ambiguous matches remain `REVIEW_REQUIRED`. This does not verify product identity, shade, size, variant, ownership, authenticity, price, inventory, image rights, or ingredient claims.

After reviewing the manifest, use the **existing authenticated owner catalog workflow** documented in `docs/PRODUCT_APPROVAL_PLAYBOOK.md` to upload permitted, correct product media. The import API already supports owner-authorized feeds; it doesn't auto-publish them. The current frontend/backend are FastAPI + HTML/JS, **not** the separate locally described Node.js archive.

Do not copy images straight into the Firebase static preview or bypass MediaAsset review. Do not fill unavailable prices, ratings, reviews, or stock. Never add misleading purchasing functionality to external showcase items.

## Deployment caveat

The GitHub workflow on `main` deploys a clearly labelled **static preview**, not the production API. Hosting the real interactive store requires the running FastAPI backend, database, media storage, Firebase authentication and carefully checked production settings. Branch changes won't auto-deploy to the live Firebase channel until deliberately merged and the workflow executes.
