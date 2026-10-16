/* Glow Nuture motion engine. Runs on top of app.js, re-applies after every hash-route render. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 66;
const fmt = n => Number(n).toLocaleString("en-US");
const TONES = { ivory: "var(--ivory)", white: "var(--surface)", sage: "var(--sage-soft)" };
const TILT = ".pcard,.cat-card,.jcard,.hero-visual";

/* ---------- Real-time client (Server-Sent Events) ---------- */
window.GNRealtime = {
  connect(path, handlers, onState) {
    if (!window.EventSource) return null;
    const es = new EventSource((window.GNApi ? GNApi.base : "") + path, { withCredentials: true });
    Object.entries(handlers).forEach(([name, fn]) =>
      es.addEventListener(name, e => { try { fn(JSON.parse(e.data), e); } catch (_) {} }));
    es.onopen = () => onState && onState("live");
    es.onerror = () => onState && onState(es.readyState === 2 ? "closed" : "reconnecting"); // browser retries on its own
    return es;
  }
};

/* ---------- Chrome: progress bar, pointer glow, ripple ---------- */
const bar = Object.assign(document.createElement("div"), { id: "gn-progress" });
const glow = Object.assign(document.createElement("div"), { className: "gn-cursor-glow" });
document.body.append(bar, glow);

addEventListener("pointermove", e => {
  glow.style.left = e.clientX + "px"; glow.style.top = e.clientY + "px"; glow.classList.add("active");
  const mx = ((e.clientX / innerWidth) - .5) * 2, my = ((e.clientY / innerHeight) - .5) * 2;
  $$(".gn-floats").forEach(f => { f.style.setProperty("--mx", mx.toFixed(3)); f.style.setProperty("--my", my.toFixed(3)); });
}, { passive: true });

document.addEventListener("pointerdown", e => {
  const b = e.target.closest?.(".btn,.icon-btn,.icon-mini"); if (!b) return;
  const r = b.getBoundingClientRect();
  b.classList.add("gn-ripple"); b.style.setProperty("--rx", e.clientX - r.left + "px"); b.style.setProperty("--ry", e.clientY - r.top + "px");
  b.classList.remove("rippling"); void b.offsetWidth; b.classList.add("rippling");
});

if (fine && !reduce) {
  document.addEventListener("pointermove", e => {
    const c = e.target.closest?.(TILT); if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    c.style.setProperty("--tx", (x * 7).toFixed(2) + "deg"); c.style.setProperty("--ty", (-y * 7).toFixed(2) + "deg"); c.style.setProperty("--lift", "-4px");
  }, { passive: true });
  document.addEventListener("pointerout", e => {
    const c = e.target.closest?.(TILT);
    if (c && !c.contains(e.relatedTarget)) ["--tx", "--ty"].forEach(k => c.style.setProperty(k, "0deg")), c.style.setProperty("--lift", "0px");
  });
}

/* ---------- Scroll-linked frame (one rAF, many effects) ---------- */
let raf = 0;
const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };
function frame() {
  raf = 0;
  const vh = innerHeight, vw = innerWidth, y = scrollY, hh = headerH();
  bar.style.transform = `scaleX(${clamp(y / Math.max(1, document.documentElement.scrollHeight - vh))})`;
  if (reduce) return;

  const hero = $("#app .hero");                                   // 11 scale out
  if (hero) { const p = clamp(y / (hero.offsetHeight * .9)); hero.style.transformOrigin = "50% 100%"; hero.style.transform = `scale(${1 - p * .1})`; hero.style.opacity = 1 - p * .75; }

  $$("[data-parallax]").forEach(el => {                           // 4 image parallax (measured on the parent so it never feeds back)
    const r = el.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
    el.style.translate = `0 ${(-(r.top + r.height / 2 - vh / 2) / vh * parseFloat(el.dataset.parallax) * 100).toFixed(1)}px`;
  });

  $$(".gn-hs").forEach(box => {                                   // 5 / 17 / 18 horizontal track + spotlight
    const pin = box.firstElementChild, track = pin.firstElementChild, dist = Math.max(0, track.scrollWidth - vw);
    const h = (dist + pin.offsetHeight) + "px"; if (box.style.getPropertyValue("--hs-h") !== h) box.style.setProperty("--hs-h", h);
    const p = dist ? clamp((hh - box.getBoundingClientRect().top) / dist) : 0;
    track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`;
    [...track.children].forEach(c => { const r = c.getBoundingClientRect(); c.style.setProperty("--spot", (1 - clamp(Math.abs(r.left + r.width / 2 - vw / 2) / (vw * .5))).toFixed(3)); });
  });

  const story = $("#gn-story");                                   // 6 + 15 pinned story with progress line
  if (story) {
    const r = story.getBoundingClientRect(), n = +story.dataset.n, p = clamp((hh - r.top) / (r.height - vh + hh)), a = Math.min(n - 1, Math.floor(p * n));
    story.style.setProperty("--p", p.toFixed(3));
    if (story.dataset.active != a) { story.dataset.active = a; $$(".gn-step,.gn-art,.gn-dot", story).forEach(el => el.classList.toggle("on", +el.dataset.i === a)); }
  }

  $$(".gn-tilt").forEach(c => {                                   // 10 scroll half of the 3D tilt
    const r = c.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
    c.style.setProperty("--depth", (clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1) * -4).toFixed(2) + "deg");
  });

  const ba = $(".gn-ba");                                         // 16 slider sweeps with scroll until the visitor takes over
  if (ba && !ba.dataset.user) { const r = $(".gn-ritual").getBoundingClientRect(); ba.style.setProperty("--pos", (18 + 64 * clamp((vh - r.top) / (vh + r.height))).toFixed(1) + "%"); }
}
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", schedule);

/* ---------- Observers ---------- */
const countUp = el => {                                           // 14 counter
  const to = +el.dataset.count; if (reduce) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  (function tick(t) { const k = clamp((t - t0) / 1600); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); })(t0);
};
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add("in"); io.unobserve(e.target);
  if (e.target.dataset.count !== undefined) countUp(e.target);
}), { threshold: .08, rootMargin: "0px 0px -6% 0px" });
const toneIO = new IntersectionObserver(es => es.forEach(e => {   // 20 background ivory -> white -> sage
  if (e.isIntersecting) document.documentElement.style.setProperty("--gn-bg", TONES[e.target.dataset.tone] || TONES.ivory);
}), { rootMargin: "-45% 0px -50% 0px" });
const navIO = new IntersectionObserver(es => es.forEach(e => {    // 19 active category follows the scroll
  if (e.isIntersecting) $$(".gn-catnav button").forEach(b => b.classList.toggle("on", b.dataset.target === e.target.id));
}), { rootMargin: "-40% 0px -55% 0px" });

/* ---------- Builders (home only, idempotent) ---------- */
const STEPS = [
  ["Cleanse", "Start with a clean slate", "Wash off the day without stripping your skin. Lukewarm water, one gentle minute, no scrubbing.", "./media/products/hero-cleanser.svg"],
  ["Treat", "Give it one job to focus on", "Pick a single serum for your biggest concern and stay with it for a few weeks before you judge it.", "./media/products/hero-serum.svg"],
  ["Protect", "Finish with sunscreen, every morning", "If you only keep one step, keep this one. A line the length of two fingers covers face and neck.", "./media/products/hero-sunscreen.svg"]
];
const SHAPES = [
  '<svg viewBox="0 0 32 32"><path d="M4 28C4 14 14 4 28 4c0 14-10 24-24 24z" fill="currentColor"/><path d="M6 26 22 10" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" fill="none"/></svg>',
  '<svg viewBox="0 0 32 32"><path d="M16 2c1 8 6 13 14 14-8 1-13 6-14 14-1-8-6-13-14-14 8-1 13-6 14-14z" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
];
const el = (tag, cls, html) => Object.assign(document.createElement(tag), { className: cls, innerHTML: html || "" });

function floaters(host) {                                         // 13
  if (reduce || $(".gn-floats", host)) return;
  const spec = [[6, 14, 34, 9, 0, 0, "sage"], [90, 10, 22, 7, -2, 1, "rose"], [48, 4, 18, 8, -4, 2, "sage"], [94, 62, 38, 11, -1, 0, "rose"], [3, 70, 26, 8, -5, 1, "sage"], [60, 88, 20, 10, -3, 2, "rose"], [28, 92, 30, 12, -6, 0, "sage"], [76, 36, 16, 6, -2, 1, "sage"]];
  host.prepend(el("div", "gn-floats", spec.map(([x, y, s, t, d, k, c], i) =>
    `<span class="gn-fl" style="--x:${x}%;--y:${y}%;--s:${s}px;--t:${t}s;--dl:${d}s;--c:var(--${c});--z:${14 + i * 5}">${SHAPES[k]}</span>`).join("")));
}

function buildStory(after) {                                      // 6 + 15
  if ($("#gn-story")) return;
  const s = el("section", "gn-story", `<div class="gn-story-pin"><div class="wrap gn-story-grid">
    <div class="gn-story-copy"><p class="lead">Your skin care journey, one step at a time</p>
      ${STEPS.map((x, i) => `<article class="gn-step" data-i="${i}"><h2>${x[1]}</h2><p>${x[2]}</p></article>`).join("")}
      <div class="gn-journey"><i></i>${STEPS.map((x, i) => `<span class="gn-dot" data-i="${i}">${x[0]}</span>`).join("")}</div></div>
    <div class="gn-story-art">${STEPS.map((x, i) => `<img class="gn-art" data-i="${i}" src="${x[3]}" alt="${x[0]} step product" loading="lazy">`).join("")}</div>
  </div></div>`);
  s.id = "gn-story"; s.dataset.n = STEPS.length; s.dataset.tone = "sage"; s.dataset.nav = "Journey"; s.style.setProperty("--n", STEPS.length);
  after.after(s); floaters($(".gn-story-art", s));
  $(".gn-story-art", s).style.position = "relative";
  s.dataset.active = "-1";
}

function buildRitual(anchor) {                                    // 16
  if ($(".gn-ritual")) return;
  const s = el("section", "section gn-ritual", `<div class="wrap"><h2>Two routines, one shelf</h2>
    <p class="sub">Drag the handle to compare. Mornings are about protection, nights are about repair.</p>
    <div class="gn-ba"><div class="gn-ba-pane gn-ba-night"><img src="./media/products/hero-serum.svg" alt="Night serum" loading="lazy"><span>Night</span></div>
    <div class="gn-ba-pane gn-ba-day"><img src="./media/products/hero-sunscreen.svg" alt="Morning sunscreen" loading="lazy"><span>Morning</span></div>
    <div class="gn-ba-handle" role="slider" tabindex="0" aria-label="Compare morning and night routine" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"></div></div></div>`);
  s.dataset.tone = "white"; s.dataset.nav = "Routines"; anchor.after(s);
  const ba = $(".gn-ba", s), h = $(".gn-ba-handle", s); let drag = false;
  const set = p => { p = clamp(p, 0, 100); ba.style.setProperty("--pos", p + "%"); h.setAttribute("aria-valuenow", Math.round(p)); };
  const at = x => { const r = ba.getBoundingClientRect(); set((x - r.left) / r.width * 100); };
  ba.addEventListener("pointerdown", e => { drag = true; ba.dataset.user = 1; ba.setPointerCapture(e.pointerId); at(e.clientX); });
  ba.addEventListener("pointermove", e => drag && at(e.clientX));
  ["pointerup", "pointercancel"].forEach(t => ba.addEventListener(t, () => drag = false));
  h.addEventListener("keydown", e => { const d = { ArrowLeft: -5, ArrowRight: 5 }[e.key]; if (d) { e.preventDefault(); ba.dataset.user = 1; set(parseFloat(getComputedStyle(ba).getPropertyValue("--pos")) + d); } });
}

let viewers = null;
function buildStats(anchor) {                                     // 14, numbers come from the server, never hard-coded
  if ($(".gn-stats") || anchor.dataset.stats) return;
  anchor.dataset.stats = 1;
  GNApi.get("/api/public/stats").then(st => {
    if (!anchor.isConnected || $(".gn-stats")) return;
    const items = [[st.products, "products in the shop"], [st.orders_delivered, "orders delivered"], [st.districts, "districts we deliver to"]].filter(i => i[0] > 0);
    const s = el("section", "section gn-stats", `<div class="wrap">${items.map(i => `<div><b data-count="${i[0]}">0</b><span>${i[1]}</span></div>`).join("")}
      <div><b data-live>${viewers ?? '—'}</b><span>connected browsers right now</span></div></div>`);
    s.dataset.tone = "sage"; anchor.after(s); observe();
  }).catch(() => {});
}

function buildCatNav() {                                          // 19
  if ($(".gn-catnav")) return;
  const names = ["Bestsellers", "New arrivals", "Skincare", "Everyday care"];
  let k = 0;
  $$("#app .section").forEach(sec => {
    if (sec.dataset.nav) return;
    if ($(".cat-grid", sec)) sec.dataset.nav = "Categories";
    else if ($(".prod-grid,.gn-hs", sec)) sec.dataset.nav = names[k++] || "Shop";
  });
  const secs = $$("#app [data-nav]"); if (secs.length < 3) return;
  secs.forEach((s, i) => { s.id = s.id || "gn-sec-" + i; navIO.observe(s); });
  const nav = el("nav", "gn-catnav", `<div class="wrap">${secs.map(s => `<button type="button" data-target="${s.id}">${s.dataset.nav}</button>`).join("")}</div>`);
  nav.setAttribute("aria-label", "Jump to a section");
  nav.addEventListener("click", e => { const b = e.target.closest("button"); if (b) $("#" + b.dataset.target).scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); });
  $("#app .trust").after(nav);
}

/* ---------- Tagging ---------- */
const skip = n => n.closest(".admin-shell,#gn-admin,.gn-hs-track,.gn-story,.gn-ba");
function tag(sel, fx) {
  $$(sel).forEach(n => {
    if (n.dataset.fx || skip(n)) return;
    n.dataset.fx = fx; n.style.setProperty("--i", Math.min(7, [...n.parentElement.children].indexOf(n)));
  });
}
function tagAll() {
  $$("#app .section").forEach(sec => {
    if (sec.dataset.fx || sec.id === "gn-story" || $(".gn-hs", sec) || sec.classList.contains("gn-ritual") || sec.classList.contains("gn-stats")) return;
    sec.dataset.fx = sec.classList.contains("section-alt") ? "blur" : "up";
  });
  tag("#app .co-card,#app .newsletter,#app .trust-item,#app .stat-card", "scale");
  tag("#app .pcard", "stagger");
  tag("#app .cat-card,#app .jcard", "rot");
  $$("#app .pcard img,#app .article img").forEach(i => { i.dataset.zoom = 1; });
  $$("#app .hv-inner,.gn-story-art .gn-art").forEach(i => { i.dataset.parallax = i.classList.contains("hv-inner") ? ".07" : ".05"; });
  $$("#app .hero h1,#app .section h2,#app .gn-ritual h2").forEach(h => {   // 7 text mask
    if (h.dataset.mask || h.closest(".admin-shell,#gn-admin")) return;
    h.dataset.mask = 1; h.innerHTML = `<span class="gn-mask"><span class="gn-mask-in">${h.innerHTML}</span></span>`;
  });
  $$(TILT).forEach(c => { if (!c.closest(".admin-shell,#gn-admin")) c.classList.add("gn-tilt", "gn-shine"); });
}
function buildTrack() {                                           // 5 / 17 / 18
  if (reduce) return;
  const g = $("#app .prod-grid");
  if (!g || g.dataset.hs || g.children.length < 4 || !$("#app .hero")) return;
  g.dataset.hs = 1;
  const box = el("div", "gn-hs"), pin = el("div", "gn-hs-pin");
  g.before(box); box.append(pin); pin.append(g); g.classList.add("gn-hs-track");
}
function observe() {
  $$("[data-fx]:not(.in),.gn-mask:not(.in),[data-zoom]:not(.in),[data-count]:not(.in)").forEach(n => io.observe(n));
  $$("[data-tone]").forEach(n => toneIO.observe(n));
}

function enhance() {
  const home = !!$("#app .hero");
  document.body.classList.toggle("gn-home", home);
  if (!home) document.documentElement.style.setProperty("--gn-bg", TONES.ivory);
  if (home) {
    const trust = $("#app .trust"), hero = $("#app .hero");
    if (trust) {
      hero.dataset.tone = "ivory"; trust.dataset.tone = "white"; floaters(hero);
      buildStory(trust);
      const prod = $$("#app .section").filter(s => $(".prod-grid", s)).pop();
      if (prod) { buildStats(prod); buildRitual(prod); }
      buildTrack(); buildCatNav();
    }
    $$("#app .section").forEach(s => { if (!s.dataset.tone) s.dataset.tone = s.classList.contains("section-alt") ? "white" : "ivory"; });
  }
  tagAll(); observe(); schedule();
}

let t; const app = $("#app");
if (app) new MutationObserver(() => { clearTimeout(t); t = setTimeout(enhance, 60); }).observe(app, { childList: true, subtree: true });
addEventListener("hashchange", () => setTimeout(enhance, 80));
document.addEventListener("DOMContentLoaded", enhance);
if (document.readyState !== "loading") enhance();

/* ---------- Live presence in the announcement bar ---------- */
let es = null, badge = null;
function live() {
  if (es || document.hidden) return;
  if (!badge && $("#announce .wrap")) { badge = el("span", "gn-badge-live", `<span data-live>${viewers ?? '—'}</span> browsers connected`); $("#announce .wrap").append(badge); }
  es = GNRealtime.connect("/api/realtime/stream", {
    hello: d => setViewers(d.viewers), presence: d => setViewers(d.viewers), product: d => {
      if(!window.GNStore)return;
      GNStore.syncProducts().then(()=>{if(!location.hash.startsWith("#/checkout"))GNStore.render();});
    }
  }, s => { if (badge) badge.style.opacity = s === "live" ? 1 : .45; });
}
function setViewers(n) { viewers = n; $$("[data-live]").forEach(x => x.textContent = n); }
document.addEventListener("visibilitychange", () => { if (document.hidden && es) { es.close(); es = null; } else live(); });
live();
window.GNMotion = { floaters };
})();
