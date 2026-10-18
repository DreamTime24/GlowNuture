(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const grid = $("#grid"), status = $("#status"), count = $("#count");
  const search = $("#search"), brand = $("#brand"), sort = $("#sort"), categories = $("#categories");
  const prev = $("#prev"), next = $("#next"), pageLabel = $("#page");
  const dialog = $("#details"), content = $("#details-body");
  const PER_PAGE = 16;
  let products = [], category = "", page = 1;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function approvedImage(value) {
    if (typeof value !== "string" || !/^\.\/images\/[a-f0-9]{20}\.(jpg|png|webp)$/.test(value)) return "";
    return value;
  }
  function imageFor(item) {
    const wrapper = el("button", "photo");
    wrapper.type = "button";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = String(item.name || "Product");
    img.src = approvedImage(item.image) || "/assets/no-image.svg";
    img.onerror = () => {
      img.onerror = null;
      wrapper.classList.add("missing");
      img.removeAttribute("src");
    };
    const missing = el("i", "", "Photo unavailable");
    wrapper.append(img, missing);
    return wrapper;
  }
  function priceText(item) {
    return typeof item.price_bdt === "number" && Number.isFinite(item.price_bdt) && item.price_bdt > 0
      ? "৳" + item.price_bdt.toLocaleString("en-BD", { maximumFractionDigits: 2 }) + " · BDT"
      : "Ask for current price";
  }
  function safeLink(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch (_) {
      return "";
    }
  }
  function detail(item) {
    content.replaceChildren();
    const photo = document.createElement("img");
    photo.src = approvedImage(item.image) || "/assets/no-image.svg";
    photo.alt = item.name;
    photo.onerror = () => { photo.onerror = null; photo.removeAttribute("src"); };
    const tag = el("div", "micro", item.brand);
    const title = el("h2", "", item.name);
    title.id = "dialog-title";
    content.append(photo, tag, title);
    if (item.size) content.append(el("div", "micro", item.size));
    content.append(el("p", "", item.description));
    if (item.ingredients) {
      content.append(el("h3", "", "Ingredients / উপাদান"));
      content.append(el("p", "", item.ingredients));
    }
    content.append(el("p", "", priceText(item)));
    content.append(el("p", "", "Availability and final price must be confirmed with GlowNuture. This page does not accept orders."));
    content.append(el("p", "", "Photo credit: " + item.image_credit));
    const link = safeLink(item.source_url);
    if (link) {
      const holder = el("div", "links");
      const a = el("a", "", "Product information source ↗");
      a.href = link; a.rel = "noopener noreferrer"; a.target = "_blank";
      holder.append(a); content.append(holder);
    }
    dialog.showModal();
  }
  function card(item) {
    const article = el("article", "product"), pictureButton = imageFor(item);
    const copy = el("div", "copy");
    const micro = el("div", "micro", item.brand);
    const title = el("h3", "", item.name);
    const meta = el("div", "meta", [item.category, item.size].filter(Boolean).join(" · "));
    const price = el("div", "price", priceText(item));
    const view = el("button", "view", "View product details ↗");
    view.type = "button";
    view.addEventListener("click", () => detail(item));
    pictureButton.setAttribute("aria-label", "View " + item.name);
    pictureButton.addEventListener("click", () => detail(item));
    copy.append(micro, title, meta, price, view);
    article.append(pictureButton, copy);
    return article;
  }
  function matchingProducts() {
    const q = search.value.trim().toLocaleLowerCase();
    const b = brand.value;
    const filtered = products.filter(p =>
      (!q || [p.name, p.brand, p.category, p.ingredients].some(x => String(x || "").toLocaleLowerCase().includes(q))) &&
      (!category || p.category === category) && (!b || p.brand === b));
    const field = sort.value === "brand" ? "brand" : "name";
    filtered.sort((a, b) => String(a[field] || "").localeCompare(String(b[field] || ""), "en"));
    return filtered;
  }
  function paint() {
    const filtered = matchingProducts();
    const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    page = Math.max(1, Math.min(page, pages));
    const slice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const fragment = document.createDocumentFragment();
    for (const p of slice) fragment.append(card(p));
    grid.replaceChildren(fragment);
    count.textContent = filtered.length + " products";
    pageLabel.textContent = filtered.length ? "Page " + page + " of " + pages : "";
    prev.disabled = page <= 1;
    next.disabled = page >= pages;
    status.textContent = !products.length ? "Our reviewed collection is being prepared. For availability, contact our team on Facebook."
      : !filtered.length ? "No products found. Try another keyword or filter." : "";
  }
  function initFilters() {
    for (const value of Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort()) {
      const option = el("option", "", value);
      option.value = value; brand.append(option);
    }
    const values = ["", ...Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort()];
    for (const value of values) {
      const button = el("button", "", value || "All products");
      button.type = "button";
      button.setAttribute("aria-pressed", String(category === value));
      button.addEventListener("click", () => {
        category = value; page = 1;
        for (const child of categories.children) child.setAttribute("aria-pressed", String(child === button));
        paint();
      });
      categories.append(button);
    }
  }
  async function load() {
    try {
      const response = await fetch("./catalog.json", { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("The catalog is currently unavailable.");
      const data = await response.json();
      if (!Array.isArray(data.products) || data.catalog_type !== "read_only") throw new Error("Invalid collection data.");
      products = data.products.filter(p => p && typeof p.name === "string" && typeof p.brand === "string" && p.purchasable === false);
      initFilters();
      paint();
    } catch (_) {
      status.textContent = "We couldn't load the collection right now. Please try again later.";
      count.textContent = "";
    }
  }
  search.addEventListener("input", () => { page = 1; paint(); });
  brand.addEventListener("change", () => { page = 1; paint(); });
  sort.addEventListener("change", () => { page = 1; paint(); });
  prev.addEventListener("click", () => { if (page > 1) { page--; paint(); } });
  next.addEventListener("click", () => { page++; paint(); });
  $("#close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  load();
})();
