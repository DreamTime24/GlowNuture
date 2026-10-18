/* Resolve bundled media beside this frontend when opened locally or below a URL prefix. */
(() => {
  'use strict';
  const script = document.currentScript?.src ? document.currentScript :
    Array.from(document.scripts).find(node => {
      try { return new URL(node.src, document.baseURI).pathname.endsWith('/media-paths.js'); }
      catch (_) { return false; }
    });
  const base = script?.src ? new URL('../', script.src) : new URL('./', document.baseURI);
  window.GNMediaURL = value => {
    if(typeof value !== 'string' || !/^(?:\/|\.\/)(?:assets|media)\//.test(value))return value;
    try {
      const url = new URL(value.replace(/^(?:\/|\.\/)/, ''), base);
      return /^https?:$/.test(url.protocol) && url.origin === location.origin
        ? url.pathname + url.search + url.hash : url.href;
    } catch (_) { return value; }
  };
})();
