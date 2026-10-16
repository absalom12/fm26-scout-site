# FM26 Scout site

Static landing page for [FM26 Scout](https://github.com/absalom12/fm26-scout). No build step.

Preview: `python3 -m http.server 8000` in this folder, then open http://localhost:8000.

Screenshots in `img/` are real captures of the app, exported from 3024×1652 PNGs to WebP at two widths (`*-1600.webp`, `*-3024.webp`) and served with `srcset`. The hero shows `full`, `fair` and `moneyball`; the tour uses `club`, `offer` and `search`.

## TODO
- Make `og:image` an absolute URL once the domain is known.
