// Mark the download button and install steps that match the visitor's system. Both buttons stay visible.
(function () {
  var ua = navigator.userAgent || "";
  var os = /Windows/i.test(ua) ? "windows" : /Macintosh|Mac OS X/i.test(ua) && !/Mobile/i.test(ua) ? "mac" : null;
  if (!os) return;
  document.querySelectorAll('.btn[data-os="' + os + '"]').forEach(function (b) { b.classList.add("detected"); });
  document.getElementById("os-" + os).classList.add("detected");
})();

// Recruitment-style tabs. Arrow keys move between tabs; the section accent follows the mode, as in the app.
(function () {
  var section = document.getElementById("modes");
  var tabs = Array.prototype.slice.call(section.querySelectorAll('[role="tab"]'));
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    section.setAttribute("data-mode", tab.getAttribute("data-mode"));
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(t); });
    t.addEventListener("keydown", function (e) {
      var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (n) { e.preventDefault(); select(tabs[(i + n + tabs.length) % tabs.length], true); }
    });
  });
})();

// On narrow screens the screenshots scroll sideways: start each one on its first marked area.
(function () {
  function focusFrames() {
    document.querySelectorAll(".frame").forEach(function (f) {
      var hl = f.querySelector(".hl");
      if (hl && f.scrollWidth > f.clientWidth + 1) f.scrollLeft = Math.max(0, hl.offsetLeft - 24);
    });
  }
  if (window.matchMedia("(max-width: 759px)").matches) {
    focusFrames();
    window.addEventListener("load", focusFrames);
    // frames inside hidden mode panels measure zero until shown
    document.querySelectorAll('[role="tab"]').forEach(function (t) { t.addEventListener("click", focusFrames); });
  }
})();
