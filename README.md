# ScoutSheet: landing page

Static landing page for **[ScoutSheet](https://github.com/absalom12/scoutsheetfm)**, a local web app that scouts, values and shortlists players straight from a Football Manager 2026 save file.

**Live:** https://scoutsheet.fm (Cloudflare Workers static assets)

## Stack

Plain HTML, CSS and vanilla JS. No framework, no build step, no dependencies.

```
index.html     page markup, SEO and Open Graph tags
style.css      styles
script.js      small interactions
assets/        logo, favicons, og.jpg
fonts/         Barlow + Barlow Condensed (SIL OFL 1.1), self-hosted woff2, latin + latin-ext
img/           app screenshots and crops (WebP)
```

## Run locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000.

## Screenshots

`img/` holds real captures of the app (3024 px wide Retina PNGs), exported to WebP (quality 80). Desktop hero: v0.5.0, January 2028 save, cropped to 3024×1650. The other images are v0.4.4 captures of a Bristol Rovers save, January 2028.

- Hero, desktop: `full`, `fair`, `moneyball` at two widths (`*-1600.webp`, `*-3024.webp`), served with `srcset`.
- Hero, phone: `full-m`, `fair-m`, `moneyball-m`: the name column and the mode columns, cut side by side.
- Feature crops at native Retina size (2x display): `club-pitch`, `okou-pitch` (+ `okou-pitch-m` for phones), `paz-map`.

## Deploy

Hosted on Cloudflare as a Worker named `fm26-scout-site` serving static assets from the repo root (config in `wrangler.jsonc`, exclusions in `.assetsignore`).

```bash
npx wrangler deploy
```

## License

Code: MIT, same as the app. Football Manager is a trademark of Sports Interactive / SEGA; this project is unofficial and not affiliated with them.
