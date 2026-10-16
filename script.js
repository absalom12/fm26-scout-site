/* FM26 Scout landing, redesign. Vanilla JS, no build, no dependencies. The page works without it:
 * no-JS visitors get both downloads, the first hero screenshot and every tour step with its own screenshot. */
'use strict';
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Config ----------
  var DL = {
    windows: { url: 'https://github.com/absalom12/fm26-scout/releases/latest/download/FM26-Scout-windows.zip', label: 'Windows' },
    mac: { url: 'https://github.com/absalom12/fm26-scout/releases/latest/download/FM26-Scout-mac.zip', label: 'Mac' }
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
    var SUB = { windows: 'Unzip, then run FM26-Scout.exe', mac: 'Apple Silicon (M1 or later)' };
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
      if (navigator.share) { navigator.share({ title: 'FM26 Scout', text: 'Scouting dashboard for my FM26 save, install on my computer', url: url }).catch(function () {}); return; }
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

  // ---------- Camera: zoom a screenshot so a focus box (in % of the image) fills its frame ----------
  function zoom(inner, frame, f, maxS) {
    var Wc = frame.clientWidth, Hc = frame.clientHeight, Wi = Wc, Hi = inner.offsetHeight || Wc / 1.9;
    var fw = f[2] / 100 * Wi, fh = f[3] / 100 * Hi;
    var s = Math.max(1, Math.min(maxS || 2.6, .94 * Wc / fw, .94 * Hc / fh));
    var cx = (f[0] + f[2] / 2) / 100 * Wi, cy = (f[1] + f[3] / 2) / 100 * Hi;
    var tx = Wc / 2 - s * cx, ty = Hc / 2 - s * cy;
    tx = Math.min(0, Math.max(Wc - s * Wi, tx));
    ty = s * Hi <= Hc ? (Hc - s * Hi) / 2 : Math.min(0, Math.max(Hc - s * Hi, ty));
    inner.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
    inner.style.setProperty('--s', s.toFixed(3));
  }
  var parse = function (v) { return v.split(',').map(Number); };

  // ---------- Hero: one save, three lenses ----------
  var LENS = {
    full: { tag: 'Full', text: 'CA and PA, straight from the save.', phone: [3, 19, 50, 44] },
    fair: { tag: 'Fair play', text: 'Hidden info is off. You scout with what the game shows.', phone: [3, 19, 50, 44] },
    moneyball: { tag: 'Moneyball', text: 'A performance score built only from match stats.', phone: [3, 19, 46, 44] }
  };
  var ORDER = ['full', 'fair', 'moneyball'];
  var stage = $('#hero-stage'), hInner = $('.scene-inner', stage), hFrame = $('.monitor', stage);
  var tabs = $$('.lenses [role="tab"]'), cur = 'full', auto = !reduce, timer = null, DWELL = 5200;
  var small = window.matchMedia('(max-width: 720px)');

  function frameHero() { if (small.matches) zoom(hInner, hFrame, LENS[cur].phone, 2.6); else { hInner.style.transform = ''; hInner.style.setProperty('--s', 1); } }
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
    frameHero();
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

  // ---------- Tour: sticky monitor on desktop, pre-zoomed screenshots in each step on mobile ----------
  var steps = $$('.step'), stageEl = $('[data-stage]'), desk = window.matchMedia('(min-width: 1081px)');
  steps.forEach(function (st) {
    var w = document.createElement('div'); w.className = 'scene-wrap'; w.dataset.step = st.dataset.step;
    w.appendChild($('.scene-inner', st).cloneNode(true)); stageEl.appendChild(w);
  });
  function frameAll() {
    steps.forEach(function (st) {
      var fig = $('.scene', st), f = parse(fig.dataset.focus);
      if (!desk.matches) zoom($('.scene-inner', fig), fig, f, 2.4);
      var w = $('.scene-wrap[data-step="' + st.dataset.step + '"]', stageEl);
      if (desk.matches) zoom($('.scene-inner', w), stageEl, f, 1.7);
    });
  }
  function activate(id) {
    steps.forEach(function (s) { s.classList.toggle('on', s.dataset.step === id); });
    $$('.scene-wrap', stageEl).forEach(function (w) { w.classList.toggle('on', w.dataset.step === id); });
  }
  activate(steps[0].dataset.step);
  if ('IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) activate(e.target.dataset.step); }); },
      { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { sio.observe(s); });
  }
  var rT; window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(function () { frameAll(); frameHero(); }, 120); });
  window.addEventListener('load', function () { frameAll(); frameHero(); });
  frameAll();

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
