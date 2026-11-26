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

`img/` holds real captures of the app (3024 px wide Retina PNGs), exported to WebP (quality 80). All of them come from one FM27 save, April 2027, captured in November 2026.

- Hero, desktop: `full`, `fair`, `moneyball` at two widths (`*-1600.webp`, `*-3024.webp`), served with `srcset`.
- Hero, phone: `full-m`, `fair-m`, `moneyball-m`: the left part of the same captures.
- Tools: `club`, `player`, `price` (`*-1600.webp`, and `*-m.webp` crops for phones).
- Analyst: `analyst-real.mp4` with its poster, a full-size still and a phone crop, shared with `supporter.html`.

## Deploy

Hosted on Cloudflare as a Worker named `fm26-scout-site` serving static assets from the repo root (config in `wrangler.jsonc`, exclusions in `.assetsignore`).

```bash
npx wrangler deploy
```

## Recruitment Analyst

`analyst.js` is the server side of the app's Recruitment Analyst (licence check, free tries, cost cap). Its master prompt
is private and not in this repository: the Worker imports it from `analyst.prompt.js`, which git ignores. To run the
Worker yourself, copy `analyst.prompt.example.js` to `analyst.prompt.js` (a short, untuned prompt) and set your own
`ANTHROPIC_API_KEY` secret.

## License

Code: MIT, same as the app. Football Manager is a trademark of Sports Interactive / SEGA; this project is unofficial and not affiliated with them.
