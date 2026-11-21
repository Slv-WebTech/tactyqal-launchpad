# Changelog

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are milestones of this repo (no packages are published).

## [Unreleased]

### Added
- MIT `LICENSE` (code only; third-party brand content is not relicensed) and `license` fields in all three `package.json` files.
- Brand kit: logo, wordmark, README banner, favicon set (`.ico`, SVG, Apple touch, 192/512), Open Graph/Twitter card, GitHub social preview, README screenshots; reproducible via `e2e/scripts/generate-brand-assets.mjs`.
- SEO/social metadata: tagline, meta description, keywords, canonical URL, Open Graph + Twitter cards, per-post article metadata, theme colour, web manifest, `robots.txt`, dynamic sitemap.
- Project documentation: premium README, `CONTEXT.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, per-package READMEs.
- Repository governance: issue and PR templates, `CODEOWNERS`, Dependabot, branch ruleset.
- GitHub Actions CI pipeline: Backend (coverage-gated), Frontend, E2E (functional + accessibility) and Security (audit + secret scan) jobs.

### Fixed
- **Visitors no longer see developer instructions when the API is asleep.** The home and blog pages showed "Start the blog API (see README)" / "Start it with `npm start`", and a post page showed a misleading *Page not found*. All three now show a friendly retry card that re-requests the page automatically (every 9 s, 6 times) and then offers a manual "Try again"; the admin message is plain language too.
- Server-side API calls time out after 8 s so a cold-starting API cannot hang a page.

### Changed (UI)
- **Icon-first interface.** Navigation, search, pagination, back links and every admin action are now icon-only buttons with a tooltip on hover and keyboard focus (WCAG 1.4.13: dismissible with Esc, hoverable, persistent) and an `aria-label`. Primary CTAs and the mobile menu keep a text label beside the icon. Emoji and glyph characters (`✓`, `+`, `←`, `☰`, story emoji) are replaced by Lucide icons; the post meta line, section headings, footer contact details and admin fields gained leading icons. New shared component `IconAction`.
- 16 new e2e tests (`icons.spec.js`): accessible-name and tooltip audit on every page at desktop and mobile, tooltip hover/focus/Esc behaviour, CTA labels, reduced motion. Visual baselines refreshed deliberately after reviewing the new UI (nav-hover baseline now includes the tooltip).

### Fixed (admin)
- The edit form is **disabled until the post has loaded** (status message, `aria-busy`, locked controls). Before, typing in the half-second before the data arrived was overwritten by the late response. Cancelling a load discards its response, other Edit buttons are disabled meanwhile, and Create/Save is locked while saving, so a double click can no longer create two posts. Covered by 3 new e2e tests (mutation-checked against the old page).

### Changed
- Page titles use a template (`%s | Tactyqal Labs`).
- `frontend/next.config.mjs` makes `distDir` overridable (used by the offline e2e build).

## [1.4.0] - 2026-11-20: QA hardening

### Added
- OpenAPI 3.1 contract (`docs/openapi.json`) enforced by backend contract tests; live contract spec.
- Seeded fuzzer: 600 hostile requests per seed, asserts no 5xx, JSON-only replies, no leaked internals, DB integrity.
- axe-core WCAG 2.1 A/AA scans (10 page/viewport combinations) plus keyboard and 320 px reflow checks.
- Visual regression: 18 baselines (3 viewports × 5 pages + interaction states), thresholds verified by mutation.
- Core Web Vitals and payload budget script (`e2e/perf/vitals.mjs`); live read-only suites; QA report.

### Fixed
- Malformed percent-encoding in a URL (`/posts/%E0%A4%A`) returned `500`; now `400`.
- Accessibility: footer/hero/status/Delete contrast, unlabeled admin controls (incl. a critical `select-name`), skipped heading level on the blog list.
- Visual threshold was too lenient (same-brightness hue change passed); tightened.
- E2E cleanup: one failing test could leave posts behind and cascade into others.

## [1.3.0] - 2026-11-19: Theme

### Changed
- Whole UI retheme to the sage `#9BA685` / olive `#637545` / forest `#455230` / cream `#EBEBD8` palette via design tokens; contrast verified; new favicon.

## [1.2.0] - 2026-11-09: Backend hardening

### Security
- **Writes closed by default**: no `ADMIN_KEY` ⇒ `401` on every write; `ALLOW_OPEN_WRITES=1` dev opt-in, refused in production; keys ≥ 24 chars, constant-time compare; drafts hidden from anonymous users.

### Changed
- List queries read no post bodies and use a covering index (`sort_at`); deep pages 2.3 s → ~45 ms under load.
- Tags load in the same query; statements prepared once; ISO timestamps everywhere; automatic migration for older databases.

### Fixed
- Create/update are transactional (no orphan posts); graceful shutdown; `/api/ready`; `X-Powered-By` removed.
- Flaky test port selection (`fetch` blocks some ports).

### Added
- Backend audit (`docs/BACKEND_AUDIT.md`) with measurements.

## [1.1.0] - 2026-11-06: Test suite and first bug sweep

### Added
- 26 backend unit/edge tests, 7 renderer tests, 36 Playwright e2e tests, live smoke suite.

### Fixed
- Numeric titles collided with ids; `%`/`_` search wildcards; tag type validation; oversize body `500` → `413`; drafts leaking by id/slug; admin page ignored the key on reads; mobile overflow on `/admin`; long unbroken strings; missing favicon.
- Upgraded to Next.js 16.4.5 (cleared audit findings).

## [1.0.0] - 2026-11-06: Initial submission

### Added
- Next.js homepage redesign with blog, post and admin pages.
- Express + SQLite blog API: posts, tags, CRUD, search, pagination.
- Deployed to Vercel (site) and Render (API); public GitHub repository.
