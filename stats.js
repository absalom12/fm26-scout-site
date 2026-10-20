'use strict';
/* Cookieless measurement, exempt from consent (CNIL): no cookie, no ID, no IP kept. The Worker only adds to per-day
 * totals for each page: visible seconds per page view, and how the cookie banner was answered. */
(function () {
  var since = Date.now(), first = true;
  window.stat = function (k, extra) {
    try { navigator.sendBeacon('/stats', JSON.stringify(Object.assign({ k: k, p: location.pathname }, extra))); } catch (e) {}
  };
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { since = Date.now(); return; }
    stat('time', { s: Math.round((Date.now() - since) / 1000), f: first });
    first = false;
  });
})();
