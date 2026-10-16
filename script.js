// Highlight the download button that matches the visitor's system. Both buttons stay visible.
(function () {
  var ua = navigator.userAgent || "";
  var os = /Windows/i.test(ua) ? "windows" : /Macintosh|Mac OS X/i.test(ua) && !/Mobile/i.test(ua) ? "mac" : null;
  if (os) {
    document.querySelector('.btn[data-os="' + os + '"]').classList.add("detected");
    document.getElementById("os-" + os).classList.add("detected");
  }
})();

// Recruitment-style tabs (arrow keys move between tabs).
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
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
