/* Bitacora DOM: accesos pequenos al documento. */
(() => {
  "use strict";

  window.BitacoraModules = window.BitacoraModules || {};

  const $ = (sel, scope = document) => scope?.querySelector?.(sel) || null;
  const $$ = (sel, scope = document) => Array.from(scope?.querySelectorAll?.(sel) || []);
  const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

  window.BitacoraModules.dom = { $, $$, on };
})();
