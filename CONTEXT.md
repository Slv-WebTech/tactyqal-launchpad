# Project context

*The single page to read before changing anything. Last updated 2026-11-20. Contains no secrets: credentials live only in hosting environment variables.*

## 1. What and why

**Tactyqal Launchpad** is a submission to the Tactyqal Labs *Fullstack Developer Intern* hire-a-thon (2 tasks + a live demo/video + a public repo):

1. **Homepage redesign** of tactyqal.com (the original is CodeIgniter) with a modern, responsive, accessible UI.
2. **Blog backend** to replace the separate WordPress blog: database schema, CRUD API, and a demo UI.

Everything is built to be demonstrable: a live URL, a repo others can run in two commands, and tests that prove the claims.

## 2. Architecture at a glance

| Piece | Tech | Hosting | Notes |
|---|---|---|---|
| `frontend/` | Next.js 16 (App Router), React 19, Tailwind 4 | Vercel (auto-deploys from `main`) | Server components, SEO metadata, no client JS except `/admin` |
| `backend/` | Express 4, `node:sqlite` (Node ≥ 22.5) | Render free tier (**manual deploy**) | ESM, no native modules, prepared statements, transactions |
| `e2e/` | Playwright, axe-core, ajv | local + CI | Functional, accessibility, visual, live smoke/contract, perf budgets |
| `docs/` | OpenAPI 3.1, reports, brand assets | n/a | `openapi.json` is enforced by backend tests |

Data model: `posts` (slug unique, status `draft|published`, ISO timestamps, internal `sort_at`) ↔ `post_tags` ↔ `tags`. Index `idx_posts_list(status, sort_at DESC, id DESC)` covers list ordering.

## 3. Decisions that are easy to undo by accident

| Decision | Why |
|---|---|
| **Writes are closed by default.** No `ADMIN_KEY` ⇒ every write is `401`. `ALLOW_OPEN_WRITES=1` is dev-only and refused in production | A missing env var once left the live API open. The default must fail safe |
| ISO-8601 timestamps everywhere + `sort_at` column | Mixed formats mis-ordered lists; `COALESCE(...)` in `ORDER BY` defeated the index (deep page 2.3 s → ~45 ms) |
| Create/update run inside `BEGIN IMMEDIATE … COMMIT` | A failed tag insert used to leave an orphan post |
| Numeric slugs are prefixed (`post-2024`) | `/posts/:idOrSlug` would otherwise confuse them with ids |
| `additionalProperties: false` in OpenAPI response schemas | Leaking an internal column fails the build |
| Four-colour palette, neutral scale remapped in `globals.css` | One block controls the brand; contrast verified (axe + script) |
| Visual diff threshold `0.05` / `0.1 %` | At `0.2` a same-brightness colour change passed (mutation-checked) |
| Playwright e2e uses ports **4100/3500** | Windows reserves 3071–3170 on some machines |
| Live tests are throttled and read-only | Heavy automated traffic made Vercel challenge the tester's IP |

## 4. Environments and configuration

| Variable | Where | Meaning |
|---|---|---|
| `ADMIN_KEY` | API | Write/draft access, ≥ 24 chars, sent as `x-admin-key`. **Never commit; set in the host dashboard** |
| `ALLOW_OPEN_WRITES=1` | API (dev only) | Opens writes for local work. Refused with `NODE_ENV=production` |
| `NODE_ENV=production` | API | Enforces the rules above |
| `PORT`, `DB_FILE` | API | Default `4000`, `blog.db` (`:memory:` in tests) |
| `NEXT_PUBLIC_API_URL` | frontend (build-time) | API base, e.g. `http://localhost:4000/api` |
| `NEXT_PUBLIC_SITE_URL` | frontend | Canonical site URL for metadata/sitemap |

`NEXT_PUBLIC_*` values are **inlined at build time**: rebuild after changing them (a stale `.next` pointing at the wrong API looks like "API unreachable").

## 5. How to work here

```bash
cd backend  && npm test                     # 45 tests incl. contract + fuzz  (FUZZ_SEED, FUZZ_N)
cd frontend && npm test && npm run build    # 7 tests + production build
cd e2e && npx playwright test               # 64 tests (builds the app, boots both servers on a fresh DB)
cd e2e && npx playwright test visual --update-snapshots   # only after an intended UI change
cd e2e && node scripts/generate-brand-assets.mjs          # regenerate icons, social cards, screenshots
```

Conventions: Conventional Commits, PRs into `main`, tests required for behaviour changes, no secrets in code, docs, logs or screenshots. Visual baselines are Windows/Chrome; CI skips them.

## 6. Current state (2026-11-20)

- ✅ Frontend live at https://tactyqal-launchpad.vercel.app; API live at https://tactyqal-launchpad-api.onrender.com/api (writes locked with an admin key).
- ✅ Tests: backend 45, frontend 7, local browser 64 (36 functional, 12 accessibility, 16 visual), live site 52, live API 19. `npm audit`: 0 vulnerabilities.
- ✅ SEO/social metadata, manifest, robots, sitemap, favicon set, Open Graph card.
- ✅ Render runs the latest API code (deployed 2026-11-20). Verified live: malformed percent-encoding that reaches the app returns a JSON `400`. Some forms (`%ZZ`, `%00`, trailing `%`) are rejected earlier by Cloudflare/Render's edge (HTML `400` or `520`), which the app cannot influence.
- ⚠️ Free tier: ~50 s cold start; SQLite resets on restart, so hosted posts are not durable.

## 7. Known issues and backlog (priority order)

1. End-user copy: the home/blog pages show developer text ("Start the blog API…") when the API is asleep. Replace with friendly copy + retry.
2. API: rate limiting, `helmet`/CSP, `cover_image` must be an http(s) URL.
3. Concurrency & retries: `ETag`/`If-Match`, `Idempotency-Key`, slug redirect history.
4. Scale: PostgreSQL, FTS (`tsvector`/FTS5), keyset pagination.
5. Test depth: Firefox/WebKit projects, Stryker mutation testing (≥ 70 % on `app.js`), k6 load job, Linux visual baselines in CI.
6. Marketing copy review ("results guaranteed", "guaranteed admission").

Full reasoning and measured numbers: [`docs/BACKEND_AUDIT.md`](docs/BACKEND_AUDIT.md), [`docs/QA_REPORT.md`](docs/QA_REPORT.md).

## 8. License

MIT (see `LICENSE`), code only. The Tactyqal Labs name and marketing content come from the company's site and are not relicensed.

## 9. Glossary

**Closed by default**: writes disabled unless explicitly enabled. **Contract test**: validates every API response against `docs/openapi.json`. **Visual baseline**: committed reference screenshot in `e2e/tests/visual.spec.js-snapshots/`. **Live suite**: read-only checks against production.
