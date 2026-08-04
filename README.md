# Sounds Like

An interactive **artist similarity tree**. Seed an artist and branch outward through Last.fm's crowd-sourced "similar artists" — click a node to expand it, or drag it into the centre ring. Similarity (`match`) drives how close nodes sit; a hard collision constraint keeps every label readable.

Descended from Jonathan Harris & Sep Kamvar's *We Feel Fine*. Static frontend + one Netlify function proxy. No build step.

```
public/            static frontend (index.html + app.js) — deploys as-is
netlify/functions/ similar.ts (artist.getSimilar) · search.ts (artist.search)
netlify.toml       publish dir, /api/* → functions redirect, CDN cache
.github/workflows/ deploy.yml — GitHub Actions → Netlify (production)
```

## Deploy — the staged plan

### 1 · Get it live via GitHub Actions (runs on mock data)

1. Push this folder to a new GitHub repo (`main` branch).
2. Create a Netlify site — either in the dashboard (*Add new site → Deploy manually*, drop the folder once) or `npx netlify-cli sites:create`. You only need the site to **exist** to get its **Site ID** and its URL (`https://<name>.netlify.app`). Claim a custom name under *Site configuration → Change site name* if you want a stable URL.
3. Add two **GitHub repo secrets** (Settings → Secrets and variables → Actions):
   - `NETLIFY_AUTH_TOKEN` — Netlify → User settings → *Applications → Personal access tokens*.
   - `NETLIFY_SITE_ID` — the site's API ID (Site configuration → General).
4. Turn **off** Netlify's own auto-build for the site (so Actions owns deploys, no double-deploy).
5. Push to `main`. The workflow deploys `public/` + the functions. Visit the site — the tree runs on the built-in demo set.

### 2 · Add the Last.fm key

- Get a key at <https://www.last.fm/api/account/create>. Read methods (`artist.getSimilar` / `artist.search`) need **only the key** — no OAuth, no callback URL.
- Netlify → Site configuration → **Environment variables** → add `LASTFM_API_KEY`. (Server-side only; never shipped to the browser.)

### 3 · Wire it up

- In [`public/app.js`](public/app.js) set **`USE_API = true`** and push. `fetchSimilar` / `fetchSearch` already return the same shape as the mock, so that flag is the whole switch. Now the graph and the search box hit real Last.fm across every artist.

## Local dev

```bash
npm install
cp .env.example .env      # add your LASTFM_API_KEY
npm run dev               # netlify dev — serves public/ + functions at /api/*
npm run typecheck         # checks the functions
```

With `USE_API = false` you don't even need a key to run the frontend.

## Notes

- **Similarity, not influence.** Last.fm `getSimilar` is undirected crowd similarity (with a `match` score), not directional "influence" — a real gap in the open music APIs, out of scope here.
- **No artist images.** Last.fm stopped serving them (~2019), so nodes are typographic by design.
- **Rate/etiquette.** Function responses are CDN-cached (`max-age=300`) to stay within Last.fm's limits; the function sends a proper `User-Agent`.
