/* ScoutSheet landing, redesign. Vanilla JS, no build, no dependencies. The page works without it:
 * no-JS visitors get both downloads, the first hero screenshot and every annotated screenshot. */
'use strict';
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Config ----------
  var DL = {
    windows: { url: 'https://github.com/absalom12/scoutsheetfm/releases/latest/download/ScoutSheet-windows.zip', label: 'Windows' },
    mac: { url: 'https://github.com/absalom12/scoutsheetfm/releases/latest/download/ScoutSheet-mac.zip', label: 'Mac' }
  };

  // ---------- Who's visiting: Windows, Mac, or a phone/tablet that can't install it ----------
  var ua = navigator.userAgent || '';
  var touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS reports itself as a Mac
  var phone = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || touchMac;
  var os = phone ? null : /Windows/i.test(ua) ? 'windows' : /Macintosh|Mac OS X/i.test(ua) ? 'mac' : null;

  if (phone) {
    $('[data-cta]').hidden = true;
    $('[data-cta-phone]').hidden = false;
  } else if (os) {
    var other = os === 'mac' ? 'windows' : 'mac';
    var SUB = { windows: 'Unzip, then run ScoutSheet.exe', mac: 'Apple Silicon, signed by Apple' };
    [['primary', os], ['secondary', other]].forEach(function (pair) {
      var b = $('[data-dl="' + pair[0] + '"]'), id = pair[1];
      b.href = DL[id].url;
      $('[data-dl-text]', b).textContent = 'Download for ' + DL[id].label;
      $('[data-dl-sub]', b).textContent = SUB[id];
    });
    $('[data-dl="' + (os === 'mac' ? 'primary' : 'secondary') + '"]').parentNode.appendChild($('[data-dl-intel]'));
    var d = $('[data-dl="dock"]');
    d.href = DL[os].url; $('[data-dl-text]', d).textContent = 'Download for ' + DL[os].label;
  }
  if (os) $$('.dl[data-os="' + os + '"]').forEach(function (a) { a.classList.add('detected'); });

  // Phone: share the page to yourself, or copy the link.
  $$('[data-share]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = location.href.split('#')[0];
      if (navigator.share) { navigator.share({ title: 'ScoutSheet', text: 'Scouting dashboard for my FM26 save, install on my computer', url: url }).catch(function () {}); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = 'Link copied. Open it on your computer.'; },
        function () { b.textContent = url; });
    });
  });
  if (phone) { var dk = $('[data-dl="dock"]'); dk.removeAttribute('href'); dk.setAttribute('role', 'button'); dk.setAttribute('data-share', ''); $('[data-dl-text]', dk).textContent = 'Send to my computer'; }


  // ---------- Header + dock ----------
  var top = $('.top');
  var onScroll = function () { top.classList.toggle('scrolled', window.scrollY > 8); };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  var dock = $('[data-dock]'), seen = { cta: true, install: false };
  if ('IntersectionObserver' in window) {
    var dio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var w = e.target.dataset.watch; seen[w] = e.isIntersecting || (w === 'cta' && e.boundingClientRect.top > 0); });
      dock.hidden = seen.cta || seen.install;
    });
    var ctaEl = phone ? $('[data-cta-phone]') : $('[data-cta]');
    ctaEl.dataset.watch = 'cta'; $('#install').dataset.watch = 'install';
    dio.observe(ctaEl); dio.observe($('#install'));
  }

  // ---------- Hero: one save, three lenses ----------
  var LENS = {
    full: { tag: 'Full', text: 'CA and PA, straight from the save.' },
    fair: { tag: 'Fair play', text: 'No CA, no PA. Key visible attributes, like a scout report.' },
    moneyball: { tag: 'Moneyball', text: 'Ranked by match output. Key stats per 90.' }
  };
  var ORDER = ['full', 'fair', 'moneyball'];
  var stage = $('#hero-stage');
  var tabs = $$('.lenses [role="tab"]'), cur = 'full', auto = !reduce, timer = null, DWELL = 5200;
  function setLens(id, user) {
    if (user) stopAuto();
    var L = LENS[id], prev = cur; cur = id;
    tabs.forEach(function (t) { var on = t.dataset.lens === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      var tm = $('.timer', t); tm.classList.remove('run'); if (on && auto) { void tm.offsetWidth; tm.classList.add('run'); } });
    stage.setAttribute('aria-labelledby', 'lens-' + id);
    document.body.setAttribute('data-lens', id);
    $$('.lens-img', stage).forEach(function (im) { im.classList.remove('prev'); if (im.dataset.lens === prev && prev !== id) { im.classList.remove('on'); im.classList.add('prev'); } });
    var img = $('.lens-img[data-lens="' + id + '"]', stage);
    if (prev !== id) { img.classList.remove('on'); void img.offsetWidth; }
    img.classList.add('on');
    var sc = $('.scanline', stage); sc.classList.remove('run'); if (prev !== id && !reduce) { void sc.offsetWidth; sc.classList.add('run'); }
    $('[data-lt-tag]').textContent = L.tag; $('[data-lt-text]').textContent = L.text;
    if (auto) { clearTimeout(timer); timer = setTimeout(function () { setLens(ORDER[(ORDER.indexOf(cur) + 1) % 3]); }, DWELL); }
  }
  function stopAuto() { auto = false; clearTimeout(timer); $$('.lenses .timer').forEach(function (t) { t.classList.remove('run'); }); }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { setLens(t.dataset.lens, true); });
    t.addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (n) { e.preventDefault(); var nt = tabs[(i + n + 3) % 3]; setLens(nt.dataset.lens, true); nt.focus(); }
    });
  });
  // Keyboard or assistive-tech focus on the modes stops autoplay, like a click does (WCAG 2.2.2).
  $('.lens-col').addEventListener('focusin', stopAuto); stage.addEventListener('focusin', stopAuto);
  // Autoplay only while the hero is on screen, and never after the visitor has picked a lens.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { var vis = es[0].isIntersecting;
      if (!vis) { clearTimeout(timer); } else if (auto) { setLens(cur); } }, { threshold: .35 }).observe(stage);
  }
  stage.addEventListener('pointerenter', function () { if (auto) { clearTimeout(timer); $$('.lenses .timer').forEach(function (t) { t.style.animationPlayState = 'paused'; }); } });
  stage.addEventListener('pointerleave', function () { if (auto) { $$('.lenses .timer').forEach(function (t) { t.style.animationPlayState = ''; }); setLens(ORDER[(ORDER.indexOf(cur) + 1) % 3]); } });
  setLens('full');

  // ---------- Install: first-launch tabs, preselected for the visitor's OS ----------
  var osTabs = $$('[data-os-tab]');
  function setOS(id, focus) {
    osTabs.forEach(function (t) { var on = t.dataset.osTab === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on; if (on && focus) t.focus(); });
  }
  osTabs.forEach(function (t, i) {
    t.addEventListener('click', function () { setOS(t.dataset.osTab); });
    t.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setOS(osTabs[(i + 1) % 2].dataset.osTab, true); } });
  });
  if (os) setOS(os);
})();

