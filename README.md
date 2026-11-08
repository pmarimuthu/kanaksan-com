# kanaksan.com

Main hub for the Kanaksan suite. Mobile-first, static HTML, near-zero JavaScript.

## Layout

1. **Header** – logo, Apps menu (native HTML popover: bottom sheet on mobile, dropdown on desktop), About, theme toggle
2. **Spotlight** – dynamic content (image) or a fallback when there is no content
3. **Footer** – short description, live apps, GitHub, LinkedIn, Privacy

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (Node 22+) |
| `npm run dev` | Local dev server at http://localhost:4321 |
| `npm test` | Unit tests for the Spotlight resolver |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |

## Where to change things

| What | File |
|---|---|
| Apps list, status (`live` / `beta` / `soon`), profile links | `src/data/products.json` |
| Spotlight content (Phase 1, local) | `src/config/spotlight.json` |
| Colours (light/dark tokens) | `src/layouts/Base.astro` (`:root` block) |
| SEO title, description, JSON-LD | `src/layouts/Base.astro` |

### Spotlight value

```json
{
  "type": "image",
  "src": "https://<https-url>/HappyDiwali.jpg",
  "srcMobile": "",
  "alt": "Happy Diwali from Kanaksan",
  "caption": "Happy Diwali!",
  "link": "",
  "startAt": "2026-11-08T00:00:00+05:30",
  "endAt": "2026-11-10T23:59:59+05:30"
}
```

The fallback is shown when the value is missing, empty, `"type": "none"`, invalid JSON,
not `https`, has no `alt`, or is outside the `startAt`–`endAt` window.
The decision is made on the server, so the browser never sees a loading state or a swap.

## Roadmap

- **Phase 1 (this):** static skeleton, Apps menu, Spotlight + fallback, footer, light/dark, SEO basics
- **Phase 2:** `@astrojs/vercel` + ISR; Spotlight from Firebase Remote Config (server-side); maintenance mode via Vercel Edge Config (HTTP 503 + Retry-After)
- **Phase 3:** Tamil route (`/ta`), hreflang, Lighthouse CI gate
- **Phase 4:** same maintenance switch on learn, calendar, vote, docs, avs, author
