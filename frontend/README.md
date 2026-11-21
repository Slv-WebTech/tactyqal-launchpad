<div align="center">
<img src="../docs/assets/logo.svg" width="72" alt="Tactyqal Labs"/>

# Web

**Next.js 16 · React 19 · Tailwind 4: the Tactyqal Labs homepage, blog and admin.**
</div>

## Run

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm run dev                    # http://localhost:3000
npm test                       # markdown renderer unit tests
npm run build && npm start     # production build
```

`NEXT_PUBLIC_*` values are inlined **at build time**: rebuild after changing them.

## Structure

| Path | What |
|---|---|
| `app/page.js` | Homepage sections (hero, success stories, program, why us, tools, testimonials, blog, pricing, FAQ, contact) |
| `app/blog/` | Blog index (search, tags, pagination) and post page |
| `app/admin/page.js` | Admin UI: create, edit, publish, delete; key field for protected API. The form is locked (`fieldset disabled`, `aria-busy`, "Loading post…") while a post loads or saves, and a cancelled load can never overwrite it |
| `app/layout.js` | Title template, description, Open Graph/Twitter, theme colour |
| `app/{manifest,robots,sitemap}.js` | Web manifest, robots (admin disallowed), dynamic sitemap |
| `app/{favicon.ico,icon.svg,apple-icon.png,opengraph-image.png}` | Generated brand assets |
| `app/globals.css` | **Design tokens**: sage/olive/forest/cream palette and remapped neutrals |
| `components/IconAction.js` | **The icon-first building block**: `IconAction` (icon-only link/button, `aria-label` + tooltip) and `Tip` (WCAG 1.4.13 tooltip: hover, focus, Esc). Use it for every control; never ship an unlabeled icon |
| `components/` | Navbar (icon nav; CSS-only mobile menu with labels), Footer, PostCard, `ApiRetry` (friendly auto-retrying state when the API is asleep) |
| `lib/` | API client (8 s timeout, reports `offline` instead of throwing), safe markdown renderer |

Design rules: AA contrast for every text pair, visible focus rings, one `h1` per page with ordered headings, labelled form controls. Tests live in [`../e2e`](../e2e).
