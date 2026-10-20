'use strict';
/* Google Analytics, only after the visitor accepts. The choice is kept in localStorage for 6 months (CNIL), then asked
 * again; "Cookie settings" reopens it. GA cookies last 13 months at most, with no ads features. */
(function () {
  var GA_ID = 'G-ZBGXZV2K1D';
  var box = document.querySelector('[data-consent]');
  var SIX_MONTHS = 182 * 864e5;
  var get = function () {
    try { var c = JSON.parse(localStorage.getItem('consent')); return Date.now() - c.t < SIX_MONTHS ? c.v : null; } catch (e) { return null; }
  };
  var set = function (v) { try { localStorage.setItem('consent', JSON.stringify({ v: v, t: Date.now() })); } catch (e) {} };
  var loaded = false;
  function load() {
    if (loaded) return; loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID, { cookie_expires: 395 * 86400, allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }
  function choose(v) {
    set(v); box.hidden = true;
    stat(v === 'yes' ? 'consent_yes' : 'consent_no');
    if (v === 'yes') return load();
    if (loaded) { // withdrawn: drop the _ga cookies; the script already running stops on the next page load
      document.cookie.split(';').forEach(function (c) {
        var n = c.split('=')[0].trim();
        if (/^_ga/.test(n)) document.cookie = n + '=; Max-Age=0; path=/; domain=.' + location.hostname.replace(/^www\./, '');
      });
    }
  }
  var c = get();
  if (c === 'yes') load(); else if (c !== 'no') { box.hidden = false; stat('banner'); }
  document.querySelector('[data-consent-yes]').onclick = function () { choose('yes'); };
  document.querySelector('[data-consent-no]').onclick = function () { choose('no'); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-consent-open]'), function (b) { b.onclick = function () { box.hidden = false; box.querySelector('button').focus(); }; });
})();
