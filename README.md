# FM26 Scout site

Static landing page for [FM26 Scout](https://github.com/absalom12/fm26-scout). No build step.

Preview: `python3 -m http.server 8000` in this folder, then open http://localhost:8000.

Screenshots in `assets/shots/` are real captures of the app (Bristol Rovers save, Jan 2028 game date), WebP. The numbered gold markers are `.hl` boxes positioned in percent of the image (`--x --y --w --h`); the matching text is the `ol.legend` under each screenshot.

## TODO
- Replace `https://x.com/TODO` (2 places in `index.html`, marked `data-todo="x-url"`) with the real X account.
- Make `og:image` an absolute URL once the domain is known.
