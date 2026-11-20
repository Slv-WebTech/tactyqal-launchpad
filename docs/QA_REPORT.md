# QA Report: Tactyqal Labs homepage + blog API

Tested 20 Nov 2026. Build: commit `266ed63` (frontend on Vercel, API on Render). Environment: Windows, Chrome. All numbers below are from runs executed in this session.

> **Status update (2026-11-20):** documentation, brand assets, SEO metadata and repository governance (CI, templates, ruleset) were added after this report. Test counts here are still accurate; see [CONTEXT.md](../CONTEXT.md) for the current state and [CHANGELOG.md](../CHANGELOG.md) for history.

## 1. Executive summary

**Verdict: ship-ready for a hiring demo, with one open production item.** The deployed API still runs code from before today's fix: a malformed URL such as `/posts/%E0%A4%A` returns 520 (Cloudflare error) instead of 400. The fix is committed and tested; Render needs one manual deploy (my deploy click was blocked by the permission system, so it is not done).

| Area | Result |
|---|---|
| Backend unit/integration/contract/fuzz | 45/45 pass; 98.6% line, 95.0% branch coverage |
| Frontend unit | 7/7 pass; 100% on the renderer |
| Browser e2e (local build) | 64/64, run twice: 36 functional, 12 accessibility, 16 visual |
| Live site (browser) | 51/52 pass; the 1 failure is traffic mitigation from Vercel (see section 6) |
| Live API contract | 2/3 pass; failure = the undeployed fix above |
| Dependency audit | 0 vulnerabilities (backend, frontend, e2e) |
| Performance (live, mobile 4x CPU + 4G) | LCP 1.0–1.3 s, CLS 0, ~155 KB per page |

Defects found and fixed this round: 1 API bug, 7 accessibility defects, 1 weak test threshold, 1 test-pollution cascade. Earlier rounds fixed 7 more (draft leakage, numeric-slug collision, non-atomic writes, deep-pagination slowness, and others).

## 2. UI testing (live browser)

- **Visual regression:** 5 pages × 3 viewports (375, 768, 1440) plus 3 interaction states, 18 baselines (2.3 MB), compared with Playwright snapshots. Stable across repeats. The same baselines pass against the **deployed** site, so production matches the tested build.
- **Does the check actually catch regressions?** I tested the test. At the initial tolerance (`threshold 0.2`), changing the brand colour to purple passed, because the comparison is luminance-weighted and the colours had similar brightness. I tightened it to 0.05 / 0.1% of pixels. Now a wrong brand colour **and** a 2 px header shift both fail, and the reverted code passes.
- **Accessibility (axe-core WCAG 2.1 A/AA + best practices):** 5 pages × 2 viewports. First run found 7 real defects that my manual contrast math had missed: footer logo text at 3.3:1, hero stat labels over a lighter glow, olive "published" status text and red Delete (just under 4.5:1), a status `<select>` with no accessible name (critical), and a heading jump h1→h3 on the blog list. All fixed; 12/12 now pass, including keyboard focus-ring checks and 320 px reflow.
- **Responsive:** zero horizontal overflow at 320/375/768/1440 on every page; mobile menu, FAQ, anchors and internal links verified.
- **Not covered:** Firefox and Safari (only Chrome was run), real devices, screen-reader testing, and RTL layout beyond content rendering.

## 3. API security and contract verification

There was no predefined spec, so I wrote `docs/openapi.json` (OpenAPI 3.1, 11 operations) from the API's behaviour and enforce it: every response must use a declared status and validate against its schema. Schemas use `additionalProperties: false`, so a leaked internal field fails the build; the contract test also fails if any spec operation has no test.

- **Fuzzing:** a seeded fuzzer sends 600 hostile requests per seed (junk paths, malformed encodings, SQL/XSS strings, nested JSON, wrong content types, array/primitive bodies, lone surrogates). Across 8 seeds (4,800 requests): zero 5xx, always JSON, no stack/SQL leakage, database integrity check "ok", no orphan rows. It found one bug within 60 requests: malformed percent-encoding in a path produced a 500; now a 400.
- **AuthN/AuthZ:** writes are closed by default (no `ADMIN_KEY` ⇒ every write returns 401); key must be ≥24 chars; constant-time comparison; drafts hidden from anonymous users by id, slug and list. Verified on the live API with a throwaway post: anonymous/wrong key → 401 on POST/PUT/PATCH/DELETE; key → create, edit, delete work.
- **OWASP API Top 10:** injection safe (all queries parameterised; hostile search strings tested); mass assignment blocked (field whitelist, `additionalProperties:false` outputs); error responses leak nothing (tested with an injected DB fault); broken object-level authorization is not applicable (single tenant), draft access enforced.
- **Open gaps:** no rate limiting or security headers (helmet/CSP) on the API; `cover_image` accepts any string including `javascript:` (latent: the UI does not render it); no CSRF concern because auth is header-based, no cookies.

## 4. Business logic evaluation

Covered by 26 edge-case tests: slug generation (unicode, numeric, symbols, collisions, rename), tag normalisation and cascade deletion, search (`%`/`_` literals), pagination bounds, draft↔published transitions (`published_at` set once and stable), read-time calculation, 20 concurrent creates, and **atomicity**: a forced tag-insert failure now rolls back the whole post and leaves old tags intact (before: orphan post). Known logic limits, documented in `docs/BACKEND_AUDIT.md`: no optimistic concurrency (last write wins), non-idempotent `POST`, renaming breaks old URLs.

## 5. Performance

- **Frontend (live, median of 5 cold runs, mobile profile):** TTFB 220–330 ms, FCP/LCP 1.0–1.3 s, CLS 0.000, TBT 0–152 ms, 9–19 requests, 154–160 KB (140 KB is framework JS). Desktop LCP 0.4–1.1 s. All inside the budget I set (LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms, ≤ 400 KB). Watch item: mobile home TBT 152 ms is close to the cap.
- **Backend:** list queries no longer read post bodies and use a covering index; tags load in one query; statements are prepared once. Deep page (page 400, 5,000 posts, 50 concurrent): 2.3 s → ~45 ms per request, 4 → ~210 req/s. Direct SQL at 20,000 rows: 237 ms → 0.03 ms with keyset pagination (offset version: 0.8 ms). Single-post lookups unchanged (4.5–4.9 µs vs 5.1–5.3 µs).
- **Not done:** k6 load test (script is in the audit doc, not run), memory/soak profiling.

## 6. User experience feedback

**End user**
- When the API is asleep or down (Render free tier takes ~50 s to wake), the **home page shows a developer message** ("Start the blog API (see README)") and `/blog` says "Start it with `npm start` in /backend". Customers should never see this. *Recommend:* friendly copy plus a retry, and cache the last good response.
- Homepage copy retains aggressive claims ("results guaranteed", "guaranteed admission"); a reviewer may question them.
- Visual quality is consistent on-palette; contrast and focus states are good.

**Senior QA / admin**
- Admin works, but: no unsaved-changes warning, no loading state, key field is not remembered (by design), list capped at 50 with no pagination, success banner has no auto-dismiss.
- Free-tier database resets on restart, so posts created in `/admin` are not permanent.
- **Test-infrastructure finding:** my own automated traffic (thousands of requests) triggered Vercel's bot challenge against my IP (`403`, `X-Vercel-Mitigated: challenge`), which caused the live link-check failure. This is temporary; live suites should throttle and the link test should sample, not crawl.

## 7. Unit test outcomes

45 backend tests across 5 files, 7 frontend tests, all passing; deterministic (random ports now avoid `fetch`'s blocked ports, which caused one rare flake). Uncovered: `config.js` lines 23–26 (a log helper), plus `server.js`/`seed.js` (boot path, checked manually in 6 configurations: no env, production without key, strong key, weak key, open-writes in production refused, dev opt-in). Mutation testing was **not run**; the visual-test mutation check above is the only mutation evidence.

## 8. Recommendations (prioritised)

1. **Now:** manually deploy the latest commit on Render (adds the 400 fix); re-run `live/contract.spec.js` (expect 3/3).
2. Replace developer-facing "API unreachable" messages with end-user copy.
3. Add helmet + CSP and rate limiting on the API; validate `cover_image` as http(s).
4. Add CI gates (not implemented here): PR must pass backend tests with ≥95% line / 90% branch, frontend build, e2e + axe (zero violations), visual diff; nightly run of live suites at low frequency. Generate Linux baselines in CI (current baselines are Windows/Chrome).
5. Add Firefox/WebKit projects, Stryker mutation testing (target ≥70% mutation score on `app.js`), ESLint with complexity ≤10, and a k6 job.
6. Phase plan: week 1 items 1–3; week 2 CI + cross-browser; week 3 mutation + load + dashboards.

## 9. Commands

```
cd backend  && npm test                       # unit, edge, contract, fuzz  (FUZZ_SEED=… FUZZ_N=… to vary)
cd frontend && npm test                       # renderer unit tests
cd e2e && npx playwright test                 # functional + a11y + visual on a fresh local build
cd e2e && npx playwright test visual --update-snapshots   # after an intended UI change
cd e2e && npx playwright test -c live-site.config.js      # read-only, against production (throttle it)
cd e2e && npx playwright test -c live.config.js           # live smoke + contract
cd e2e && node perf/vitals.mjs                # Core Web Vitals + payload budgets
```
