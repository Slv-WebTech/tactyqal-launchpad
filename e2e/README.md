<div align="center">
<img src="../docs/assets/logo.svg" width="72" alt="Tactyqal Labs"/>

# End-to-end, accessibility, visual & live checks
</div>

```bash
npm install
npx playwright test                              # 91 tests on a fresh local build (API :4100, web :3500, in-memory DB)
npx playwright test offline                      # API-down experience (second build on :3501 pointing at a dead API)
npx playwright test a11y                         # axe WCAG A/AA + keyboard + reflow
npx playwright test visual --update-snapshots    # refresh baselines after an INTENDED UI change
npx playwright test -c live-site.config.js       # read-only browser suite against production (throttle it)
npx playwright test -c live.config.js            # live API smoke + OpenAPI contract
LIVE_ADMIN_KEY=<key> npx playwright test -c live.config.js   # also runs authenticated checks (never commit the key)
node perf/vitals.mjs                             # Core Web Vitals + payload budgets
node scripts/generate-brand-assets.mjs           # icons, social cards, README screenshots
```

| Suite | Files | Notes |
|---|---|---|
| Functional | `tests/site.spec.js`, `tests/admin-flow.spec.js` | Homepage, nav, FAQ, blog, admin journey, XSS, resilience; test data is cleaned up even after failures |
| API-down | `tests/offline.spec.js` | Friendly retry card on home, blog and post pages; no developer text; fake-clock test of the auto-retry cycle; axe + keyboard + 320 px |
| Icon-first | `tests/icons.spec.js` | Every control has an accessible name; icon-only controls have a matching tooltip and `aria-hidden` icons; tooltip hover/focus/Esc behaviour; primary CTAs keep their label; reduced motion |
| Accessibility | `tests/a11y.spec.js` | Zero tolerance for axe violations at 375 and 1440 px |
| Visual | `tests/visual.spec.js` | Baselines are **Windows + Chrome**; CI skips them. Thresholds were mutation-checked |
| Live | `live/*.spec.js` | Read-only; `retries: 1` for transport blips; heavy traffic can trigger the host's bot challenge |

Requires Google Chrome (`channel: "chrome"`). Ports 4100/3500/3501 avoid Windows' reserved range.
