/* Preserves Nuri and the mandala; Firebase manages identity. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const SAY = {
  idle: "Hi, I'm Nuri. Ready when you are.", typing: "Take your time.", shy: "I won't look, promise.",
  peek: "Okay... just one quick peek.", think: "Checking with the server...", happy: "You're in. Welcome!",
  sad: "That didn't match. Want to try again?", wave: "New here? Let's set you up."
};

const ticks = Array.from({ length: 72 }, (_, i) => `<line x1="250" y1="14" x2="250" y2="${i % 6 ? 24 : 36}" transform="rotate(${i * 5} 250 250)"/>`).join("");
const petals = Array.from({ length: 12 }, (_, i) => `<path d="M250 70c22 34 22 66 0 100-22-34-22-66 0-100Z" transform="rotate(${i * 30} 250 250)"/>`).join("");
const MANDALA = `<svg viewBox="0 0 500 500" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" aria-hidden="true">
  <g><circle cx="250" cy="250" r="236"/><circle cx="250" cy="250" r="226" stroke-dasharray="2 6"/>${ticks}</g>
  <g><circle cx="250" cy="250" r="176"/>${petals}<circle cx="250" cy="250" r="60" stroke-dasharray="4 5"/></g></svg>`;

const NURI = `<svg class="nuri" data-state="idle" viewBox="0 0 240 262" role="img" aria-label="Nuri, a friendly sprout in a pot">
  <ellipse cx="120" cy="252" rx="78" ry="8" fill="#000" opacity=".2"/>
  <g class="sprout"><path d="M120 106C120 82 118 62 122 40" stroke="#4E6149" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M120 72C92 72 74 56 70 34c26-2 46 12 50 38z" fill="#6F8468"/><path d="M122 54c24 2 42-12 48-34-24-4-44 10-48 34z" fill="#8FA588"/>
    <path d="M118 66C100 60 88 52 80 40M124 46c14-2 28-10 36-20" stroke="#fff" stroke-opacity=".45" stroke-width="1.5" fill="none"/></g>
  <g class="body"><path d="M44 126c0-14 22-22 76-22s76 8 76 22l-20 104c-2 10-26 16-56 16s-54-6-56-16z" fill="#F7E8EA" stroke="#C0838C" stroke-width="3"/>
    <ellipse cx="120" cy="108" rx="78" ry="15" fill="#ead2d6" stroke="#C0838C" stroke-width="3"/><ellipse cx="120" cy="106" rx="62" ry="8" fill="#5b4a3f"/>
    <path d="M62 212c40 10 76 10 116 0" stroke="#C0838C" stroke-opacity=".35" stroke-width="2" fill="none"/>
    <circle cx="74" cy="186" r="9" fill="#C0838C" opacity=".4"/><circle cx="166" cy="186" r="9" fill="#C0838C" opacity=".4"/>
    <g><circle cx="92" cy="160" r="14" fill="#fff"/><circle class="pupil" cx="92" cy="160" r="7" fill="#221F1C"/><circle class="pupil" cx="95" cy="157" r="2" fill="#fff"/><circle class="lid" cx="92" cy="160" r="14.5"/></g>
    <g><circle cx="148" cy="160" r="14" fill="#fff"/><circle class="pupil" cx="148" cy="160" r="7" fill="#221F1C"/><circle class="pupil" cx="151" cy="157" r="2" fill="#fff"/><circle class="lid" cx="148" cy="160" r="14.5"/></g>
    <path class="mouth m-idle" d="M108 188q12 10 24 0" stroke="#221F1C" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path class="mouth m-happy" d="M104 184q16 24 32 0z" fill="#221F1C"/>
    <ellipse class="mouth m-think" cx="120" cy="192" rx="6" ry="4" fill="#221F1C"/>
    <path class="mouth m-sad" d="M108 196q12-10 24 0" stroke="#221F1C" stroke-width="3" stroke-linecap="round" fill="none"/></g>
  <path class="arm arm-l" d="M54 172C30 170 14 190 18 212c24 2 40-18 36-40z" fill="#6F8468" stroke="#4E6149" stroke-width="2"/>
  <path class="arm arm-r" d="M186 172c24-2 40 18 36 40-24 2-40-18-36-40z" fill="#6F8468" stroke="#4E6149" stroke-width="2"/>
  ${[[30, 40], [210, 56], [196, 18], [48, 120], [214, 130], [120, 8]].map(([x, y], k) => `<path class="spark" style="--k:${k}" d="M${x} ${y - 9}l2.5 6.5L${x + 9} ${y}l-6.5 2.5L${x} ${y + 9}l-2.5-6.5L${x - 9} ${y}l6.5-2.5z" fill="#F7E8EA"/>`).join("")}
</svg>`;

const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const SHIELD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
const pw = (name, auto) => `<div class="gn-pw"><input class="input" name="${name}" type="password" required minlength="8" autocomplete="${auto}" placeholder="At least 8 characters"/><button type="button" aria-label="Show password" aria-pressed="false">${EYE}</button></div>`;

const TEMPLATE = `<div class="gn-auth">
  <section class="gn-auth-scene" aria-hidden="false"><div class="gn-lat"></div><div class="gn-lat2"></div><div class="gn-mandala">${MANDALA}</div>
    <div class="gn-stage">${NURI}<p class="nuri-say" aria-live="polite">${SAY.idle}</p></div>
    <div class="gn-scene-copy"><h2>Skin care that starts with a calm morning.</h2><p>Sign in to track orders, keep your wishlist and check out faster.</p></div></section>
  <section class="gn-auth-form"><h1>Your account</h1><p class="muted">Track orders and save the products you love.</p>
    <div class="co-card">
      <div style="display:flex;gap:6px;background:var(--surface-2);padding:4px;border-radius:var(--r-full);margin-bottom:20px">
        <button class="btn btn-sm auth-tab active" data-action="auth-tab" data-tab="login" style="flex:1">Sign in</button>
        <button class="btn btn-sm auth-tab" data-action="auth-tab" data-tab="register" style="flex:1">Create account</button></div>
      <form data-form="login" data-firebase="login" id="loginForm">
        <label class="field"><span class="lbl">Email <span class="req">*</span></span><input class="input en" type="email" name="email" required placeholder="name@email.com" autocomplete="email"></label>
        <label class="field"><span class="lbl">Password <span class="req">*</span></span>${pw("password", "current-password")}</label>
        <div data-recaptcha="login"></div><button class="btn btn-primary btn-block btn-lg" type="submit">Sign in</button></form>
      <form data-form="register" data-firebase="register" id="registerForm" style="display:none">
        <label class="field"><span class="lbl">Full name <span class="req">*</span></span><input class="input" name="name" required autocomplete="name" placeholder="Your name"/></label>
        
        <label class="field"><span class="lbl">Email <span class="req">*</span></span><input class="input en" name="email" type="email" required autocomplete="email" placeholder="name@email.com"/></label>
        <label class="field"><span class="lbl">Password <span class="req">*</span></span>${pw("password", "new-password")}</label>
        <label class="gn-checkbox"><input type="checkbox" required><span>I accept the <a href="#/page/terms">terms</a> and <a href="#/page/privacy">privacy policy</a>.</span></label><div data-recaptcha="login"></div><button class="btn btn-primary btn-block btn-lg" type="submit">Create account</button></form>
      <div class="gn-social-login"><button class="btn btn-outline" data-firebase-action="google">Google</button><button class="btn btn-outline" data-firebase-action="facebook" disabled>Facebook · setup pending</button></div>
      <details><summary>Forgot password?</summary><form data-firebase="reset"><label class="field"><span class="lbl">Email</span><input class="input en" name="email" type="email" required autocomplete="email"></label><button class="btn btn-outline btn-block" type="submit">Reset email</button></form></details>
      <p class="gn-auth-note">${SHIELD}<span>Firebase manages your password. The store verifies identity server-side and uses an HttpOnly cookie. Verify your email before ordering.</span></p>
    </div></section></div>`;

function mount() {
  const app = $("#app");
  if (!app || !$("#loginForm", app) || $(".gn-auth", app)) return;
  app.innerHTML=TEMPLATE;
  GNConfigReady.then(cfg=>{
    const google=$('[data-firebase-action="google"]',app),facebook=$('[data-firebase-action="facebook"]',app);
    if(google)google.disabled=!cfg.firebase?.google;
    if(facebook){facebook.disabled=!cfg.firebase?.facebook;facebook.textContent=cfg.firebase?.facebook?'Facebook':'Facebook · setup pending';}
  });
  document.dispatchEvent(new CustomEvent('gn-auth-mounted'));
  const listenerController=new AbortController();
  const scene = $(".gn-auth-scene", app), nuri = $(".nuri", app), say = $(".nuri-say", app);
  if (window.GNMotion) GNMotion.floaters($(".gn-stage", app).parentElement);

  let lock = 0;                                                       // keeps a result state on screen for a moment
  const set = (s, force) => {
    if (!force && Date.now() < lock) return;
    if (nuri.dataset.state === s) return;
    nuri.dataset.state = s; say.textContent = SAY[s];
    if (force) lock = Date.now() + 1800;
  };
  const look = (x, y) => {                                            // pupils follow a target point
    const r = nuri.getBoundingClientRect(), dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height * .6);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
    nuri.style.setProperty("--px", (dx / d * 5 * k).toFixed(2)); nuri.style.setProperty("--py", (dy / d * 4 * k).toFixed(2));
  };
  const onMove = e => {
    look(e.clientX, e.clientY);
    const r = scene.getBoundingClientRect();
    scene.style.setProperty("--mx", clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1).toFixed(3));
    scene.style.setProperty("--my", clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1).toFixed(3));
  };
  addEventListener("pointermove", onMove, { passive: true });
  const cleanup = new MutationObserver(() => { if (!scene.isConnected) { listenerController.abort();removeEventListener("pointermove", onMove); cleanup.disconnect(); } });
  cleanup.observe(app, { childList: true });

  app.addEventListener("focusin", e => {
    const t = e.target;
    if (t.type === "password") set(t.type === "password" && t.closest(".gn-pw").querySelector("button").getAttribute("aria-pressed") === "true" ? "peek" : "shy");
    else if (t.matches("input")) { set("typing"); const r = t.getBoundingClientRect(); look(r.left + r.width * .3, r.top); }
  }, {signal:listenerController.signal});
  app.addEventListener("focusout", () => setTimeout(() => { if (!$("input:focus", app)) set("idle"); }, 60),{signal:listenerController.signal});
  app.addEventListener("input", e => { if (e.target.matches("input:not([type=password])")) { const r = e.target.getBoundingClientRect(), v = e.target.value.length; look(r.left + Math.min(r.width, 24 + v * 9), r.top + 40); } }, {signal:listenerController.signal});
  app.addEventListener("click", e => {
    const eye = e.target.closest(".gn-pw button");
    if (eye) { const input = eye.parentElement.querySelector("input"), show = input.type === "password"; input.type = show ? "text" : "password"; eye.setAttribute("aria-pressed", show); eye.setAttribute("aria-label", show ? "Hide password" : "Show password"); set(show ? "peek" : "shy"); input.focus(); }
    const tab = e.target.closest("[data-tab]"); if (tab) set(tab.dataset.tab === "register" ? "wave" : "idle", true);
  }, {signal:listenerController.signal});
  app.addEventListener("submit", () => set("think", true), {capture:true,signal:listenerController.signal});

  const toasts = $("#toasts");                                        // app.js reports the server result as a toast
  if (toasts) {
    const seen = new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => {
      if (!scene.isConnected || n.nodeType !== 1) return;
      lock = 0; set(/err|danger|error/i.test(n.className) ? "sad" : "happy", true);
      if (n.textContent) say.textContent = /err|danger|error/i.test(n.className) ? n.textContent.trim() : SAY.happy;
    })));
    seen.observe(toasts, { childList: true });
    new MutationObserver(() => { if (!scene.isConnected) seen.disconnect(); }).observe(app, { childList: true });
  }
}

let t; const app = $("#app");
if (app) new MutationObserver(() => { clearTimeout(t); t = setTimeout(mount, 30); }).observe(app, { childList: true });
document.addEventListener("DOMContentLoaded", mount);
if (document.readyState !== "loading") mount();
})();
