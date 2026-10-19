# Frontend integration

The storefront entry point is `frontend/index.html`. Its local catalog images and background videos work when `frontend/` is served at an HTTP origin root, under a nested path such as a PyCharm preview URL, or opened directly with `file://`. For the full application, serve it through `app.main:app` at the same origin as `/api`. `public/index.html` is the Firebase starter welcome page.

Script order is deliberate: api-client.js → media-paths.js → local-catalog.js → app.js → glow-motion.js → glow-auth.js → firebase-bridge.js → commerce-ui.js → catalog-console.js → glow-admin.js. `media-paths.js` exposes `GNMediaURL` to resolve bundled image, video and fallback URLs relative to the frontend's actual location. Do not bypass the API with a private provider key or a browser-admin flag.

The theme and existing motion remain. Product photos use white panels, consistent padding and `object-fit: contain` without cropping or changing the original image files. Categories, journal artwork and the skincare journey use local product photographs instead of bottle illustrations; functional SVG icons remain.

Browser storage v3 contains only catalog IDs, quantities, selections and browsing lists; legacy v2 profile/order storage is cleared. Server sessions, recipient data, authoritative money and stock do not live in LocalStorage. Signed-in list changes sync to customer_state.

The standalone collection lives at `frontend/catalog/index.html`, or `/ordinary-catalog` through FastAPI. It filters The Ordinary images from the same local catalog and needs no backend proxy. It supports the same HTTP, nested-path and direct-file media loading as the storefront. Its FastAPI response permits same-origin helper and catalog scripts plus exact hashes for its inline script; preserve that CSP hash generation when editing the page.

JSDOM checks exercise DOM/event behavior with fixture HTTP. They do not replace browser layout, OAuth, mobile, accessibility or Core Web Vitals verification.

## Local image catalog

The storefront catalog loads immediately from `assets/local-catalog.js`; browsing its images requires no API. Source JPEGs live in `frontend/assets/image/` and the four background MP4s in `frontend/assets/videos/`. Local rows have `source: 'local'` and `displayOnly: true`, with no prices, stock, cart or checkout actions. Account, orders and other live commerce features still require the backend.

`glownuture_morning.webp` and `glownuture_night.webp` in the image folder fill the morning/night comparison slider. These two editorial photos are excluded from product catalog generation. Drag, touch and keyboard controls remain available.

After adding, removing or renaming JPEGs, run this command from the project root:

```powershell
npm.cmd run build:catalog
```

The builder makes short ASCII filenames and records each imported filename in the generated row's `original_filename`. Card names and descriptions come from that readable filename, with descriptive replacements for the originally numbered or unnamed images. Unchanged image filenames retain their labels, URLs and IDs on rebuild. To change a label, rename its JPEG to the desired readable name and rebuild; a change to the generated filename also changes that image's URL and ID. Keep the generated manifest with the assets so the original-name mapping is preserved. Additional videos must also be added to the builder's `VIDEO_NAMES` playlist.

Build the static preview after rebuilding the catalog:

```powershell
python scripts/build_firebase_preview.py
```

This creates `build/firebase-preview/` with the catalog, images and videos. It does not publish the site.
