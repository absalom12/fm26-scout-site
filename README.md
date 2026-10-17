# FM26 Scout: landing page

Static landing page for **[FM26 Scout](https://github.com/absalom12/fm26-scout)**, a local web app that scouts, values and shortlists players straight from a Football Manager 2026 save file.

**Live:** https://fm26-scout-site.bien-vu-server.workers.dev (Cloudflare Workers static assets)

## Stack

Plain HTML, CSS and vanilla JS. No framework, no build step, no dependencies.

```
index.html     page markup, SEO and Open Graph tags
style.css      styles
script.js      small interactions
assets/        logo, favicons, og.jpg
img/           app screenshots (WebP, 1600 and 3024 px wide, served with srcset)
```

## Run locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000.

## Screenshots

`img/` holds real captures of the app, exported from 3024×1652 PNGs to WebP at two widths (`*-1600.webp`, `*-3024.webp`).

- Hero: `full`, `fair`, `moneyball`
- Tour: `club`, `offer`, `search`

To replace one, export both widths with the same name and keep the `srcset` in `index.html` in sync.

## Deploy

Hosted on Cloudflare as a Worker named `fm26-scout-site` serving static assets from the repo root (config in `wrangler.jsonc`, exclusions in `.assetsignore`).

```bash
npx wrangler deploy
```

## License

Code: MIT, same as the app. Football Manager is a trademark of Sports Interactive / SEGA; this project is unofficial and not affiliated with them.
