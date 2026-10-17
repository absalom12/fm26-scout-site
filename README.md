# FM26 Scout: landing page

Static landing page for **[FM26 Scout](https://github.com/absalom12/fm26-scout)**, a local web app that scouts, values and shortlists players straight from a Football Manager 2026 save file.

**Live:** _URL added after the first Cloudflare Pages deploy._

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

Hosted on Cloudflare Pages, project `fm26-scout-site`, served from the repo root (no build command, no output directory).

```bash
npx wrangler pages deploy . --project-name fm26-scout-site
```

## License

Code: MIT, same as the app. Football Manager is a trademark of Sports Interactive / SEGA; this project is unofficial and not affiliated with them.
