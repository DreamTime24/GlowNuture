# Frontend integration

Serve frontend/index.html through app.main:app at the same origin as /api. The older repository-root static HTML is not the supported entry point for this full-stack version.

Script order is deliberate: api-client.js → app.js → glow-motion.js → glow-auth.js → firebase-bridge.js → commerce-ui.js → glow-admin.js. Do not bypass the API with a private provider key or a browser-admin flag.

The four original theme CSS files stay unchanged. commerce.css adds card images/ingredients, forms, comparison and account/admin details. The Nuri/mandala scene and original motion remain. Actual product images use object-fit:contain and fallback safely; SVG illustrations remain decorative.

Browser storage v3 contains only catalog IDs, quantities, selections and browsing lists; legacy v2 profile/order storage is cleared. Server sessions, recipient data, authoritative money and stock do not live in LocalStorage. Signed-in list changes sync to customer_state.

The standalone catalog lives at catalog/index.html and is served at /ordinary-catalog with an inline-script hash policy. It uses the backend proxy and has no private key. Keep its CSP hash generation if editing its script.

JSDOM checks exercise DOM/event behavior with fixture HTTP. They do not replace browser layout, OAuth, mobile, accessibility or Core Web Vitals verification.
