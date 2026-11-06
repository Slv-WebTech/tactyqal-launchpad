# Tactyqal Labs — Hire-a-thon submission

Two tasks, one repo:

| Folder | Task | Stack |
|---|---|---|
| `frontend/` | **Task 1** homepage redesign + blog UI + admin demo | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| `backend/` | **Task 2** blog backend (DB schema + REST API) | Node.js 22.5+, Express, SQLite (`node:sqlite`) |

## Live demo

- Site: https://tactyqal-launchpad.vercel.app
- Blog API: https://tactyqal-launchpad-api.onrender.com/api/posts
- Note: the API runs on Render's free tier. It sleeps when idle (first request can take ~50s) and its SQLite file resets to the seed posts on restart.

## Run it

```bash
# terminal 1 — API on :4000 (auto-seeds 6 posts on first run)
cd backend && npm install && npm start

# terminal 2 — site on :3000
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

Pages: `/` homepage · `/blog` (search, tag filter, pagination) · `/blog/:slug` · `/admin` (create/edit/delete UI).

Tests: `cd backend && npm test`.

## Blog API

Base URL `http://localhost:4000/api`

| Method | Path | Notes |
|---|---|---|
| GET | `/posts` | `?q=` search, `?tag=`, `?status=published\|draft\|all` (default published), `?page=&limit=` → `{data, meta}` |
| GET | `/posts/:idOrSlug` | full post incl. content |
| POST | `/posts` | `{title*, excerpt, content, author, cover_image, status, tags[]}`; slug is generated and de-duplicated |
| PUT / PATCH | `/posts/:idOrSlug` | partial update; renaming regenerates slug; first publish stamps `published_at` |
| DELETE | `/posts/:idOrSlug` | 204 |
| GET | `/tags` | tags with published-post counts |

Writes are open by default for easy demoing. Set `ADMIN_KEY=...` and send header `x-admin-key` to protect them.

## Database design

`posts` (slug unique, status draft/published, read_minutes auto-computed, timestamps) ↔ `post_tags` ↔ `tags`.
Many-to-many tags, an index on `(status, published_at)`, cascade deletes. Plain SQL, so moving to PostgreSQL means swapping the driver and `AUTOINCREMENT` for `SERIAL`/identity.

## Design decisions

- **Why replace WordPress for the blog:** one stack and one deploy, content served from a typed API, and the homepage can render live posts (see the "Blog" section of `/`).
- **Homepage:** keeps the existing site's content and section order (success stories, 8-week program, why us, tools, testimonials, blog, pricing, FAQ, contact) with a modern dark hero, cards, responsive grid, CSS-only mobile menu and accessible `<details>` FAQ — mostly server components, ~105 kB first-load JS.
- Blog content is a safe markdown subset rendered after HTML-escaping (no XSS from post bodies).

## Production notes / next steps

Real auth (JWT/sessions) instead of a shared key, image uploads, PostgreSQL + migrations, a WordPress → API import script, SEO (sitemap, OG tags).

## Deploying

- **Frontend (Vercel):** import the repo, set root directory to `frontend`, add env var `NEXT_PUBLIC_API_URL=https://<your-api-host>/api`.
- **Backend (Render/Railway/Fly):** root directory `backend`, build `npm install`, start `npm start`, Node 22.5+. Mount a persistent disk and set `DB_FILE` to a path on it (SQLite is a single file). Set `ADMIN_KEY` in production.
