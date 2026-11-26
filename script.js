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
    $('[data-cta-phone]').hidden = false; $('[data-inst-phone]').hidden = false;
  } else if (os) {
    var other = os === 'mac' ? 'windows' : 'mac';
    var SUB = { windows: 'Unzip, then run ScoutSheet.exe', mac: 'Apple Silicon' };
    [['primary', os], ['secondary', other]].forEach(function (pair) {
      var b = $('[data-dl="' + pair[0] + '"]'), id = pair[1];
      b.href = DL[id].url;
      $('[data-dl-text]', b).textContent = 'Download for ' + DL[id].label;
      $('[data-dl-sub]', b).textContent = SUB[id];
    });
    var d = $('[data-dl="dock"]');
    d.href = DL[os].url; $('[data-dl-text]', d).textContent = 'Download for ' + DL[os].label;
  }
  if (os) $$('.dl[data-os="' + os + '"]').forEach(function (a) { a.classList.add('detected'); });

  // Phone: share the page to yourself, or copy the link.
  $$('[data-share]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = location.href.split('#')[0];
      if (navigator.share) { navigator.share({ title: 'ScoutSheet', text: 'Scouting dashboard for my FM27 save, install on my computer', url: url }).catch(function () {}); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { ($('[data-share-text]', b) || b).textContent = 'Link copied. Open it on your computer.'; },
        function () { ($('[data-share-text]', b) || b).textContent = url; });
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
    full: { tag: 'Full', text: 'Every number, CA and PA included.' },
    fair: { tag: 'Fair play', text: 'Only what your scouts would see.' },
    moneyball: { tag: 'Moneyball', text: 'Match results only, no attributes.' }
  };
  var ORDER = ['full', 'fair', 'moneyball'];
  var stage = $('#hero-stage');
  var tabs = $$('.lenses [role="tab"]'), cur = 'full', auto = !reduce, timer = null, DWELL = 3000;
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
    $('[data-lt-tag]').textContent = L.tag; $('[data-lt-tip]').setAttribute('data-tip', L.text);
    $$('.hcell').forEach(function (c) { var b = $('b', c), on = c.dataset['in'].split(' ').indexOf(id) > -1;  // values a mode hides are hatched, and out of the page text
      if (!c.dataset.v) c.dataset.v = b.textContent;
      c.classList.toggle('hid', !on); b.textContent = on ? c.dataset.v : '';
      if (on) { c.removeAttribute('data-tip'); c.removeAttribute('tabindex'); } else { c.setAttribute('data-tip', 'Hidden in ' + L.tag + '.'); c.tabIndex = 0; } });
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

  // ---------- Tools: three tabs, one capture at a time (without JS all three show) ----------
  var tools = $('[data-tools]'), tts = $$('[role="tab"]', tools);
  function setTool(i, focus) { tts.forEach(function (t, k) { var on = k === i; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on; if (on && focus) t.focus(); }); }
  tts.forEach(function (t, i) {
    t.addEventListener('click', function () { setTool(i); });
    t.addEventListener('keydown', function (e) { var n = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (n) { e.preventDefault(); setTool((i + n + 3) % 3, true); } });
  });
  tools.classList.add('js'); setTool(0);

  // ---------- Tooltips: hover, keyboard focus, tap; one at a time; kept inside the viewport ----------
  var tip = $('#tip'), open = null, touch = false, says = document.createElement('div');
  says.className = 'vh'; document.body.appendChild(says);
  $$('[data-tip]').forEach(function (el, i) { var s = document.createElement('span'); s.id = 'tip-' + i; s.textContent = el.getAttribute('data-tip'); says.appendChild(s); el.setAttribute('aria-describedby', s.id); });
  function showTip(el) { open = el; tip.textContent = el.getAttribute('data-tip'); tip.hidden = false;
    var r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, x = Math.max(12, Math.min(r.left, innerWidth - w - 12)), y = r.top - h - 8;
    if (y < 76) y = Math.min(r.bottom + 8, innerHeight - h - 12);
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)'; }
  function hideTip() { open = null; tip.hidden = true; }
  var tipOf = function (e) { return e.target.closest ? e.target.closest('[data-tip]') : null; };
  document.addEventListener('pointerover', function (e) { var el = tipOf(e); if (el && e.pointerType === 'mouse') showTip(el); });
  document.addEventListener('pointerout', function (e) { if (tipOf(e) && e.pointerType === 'mouse') hideTip(); });
  document.addEventListener('focusin', function (e) { var el = tipOf(e); if (el && el.matches(':focus-visible')) showTip(el); });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('pointerdown', function (e) { touch = e.pointerType !== 'mouse'; if (open && !tipOf(e)) hideTip(); }, true);
  document.addEventListener('click', function (e) { var el = tipOf(e); if (el && touch) { if (open === el) hideTip(); else showTip(el); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('scroll', hideTip, { passive: true });

  // ---------- Demo video: a link that opens a player; without JS the link opens the file ----------
  var dlg = $('#demoDlg'), dv = $('video', dlg);
  $$('[data-demo]').forEach(function (a) { a.addEventListener('click', function (e) { if (!dlg.showModal) return; e.preventDefault(); dlg.showModal(); dv.play().catch(function () {}); }); });
  dlg.addEventListener('close', function () { dv.pause(); });

  // ---------- Analyst capture: plays on wide screens only, never under reduced motion (the poster stays) ----------
  var loop = $('#ana-loop');
  if (loop && !reduce && getComputedStyle(loop).display !== 'none') { loop.setAttribute('autoplay', ''); loop.play().catch(function () {}); }

  // ---------- Phone: the dock sits above the cookie banner until it is answered ----------
  var cb = $('[data-consent]');
  function lift() { if (cb && !cb.hidden) document.documentElement.style.setProperty('--cb', Math.round(innerHeight - cb.getBoundingClientRect().top + 8) + 'px'); }
  if (cb) { new MutationObserver(lift).observe(cb, { attributes: true, attributeFilter: ['hidden'] }); window.addEventListener('resize', lift); lift(); }
})();

