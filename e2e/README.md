<div align="center">
<img src="../docs/assets/logo.svg" width="72" alt="Tactyqal Labs"/>

# End-to-end, accessibility, visual & live checks
</div>

```bash
npm install
npx playwright test                              # 64 tests on a fresh local build (API :4100, web :3500, in-memory DB)
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
| Accessibility | `tests/a11y.spec.js` | Zero tolerance for axe violations at 375 and 1440 px |
| Visual | `tests/visual.spec.js` | Baselines are **Windows + Chrome**; CI skips them. Thresholds were mutation-checked |
| Live | `live/*.spec.js` | Read-only; `retries: 1` for transport blips; heavy traffic can trigger the host's bot challenge |

Requires Google Chrome (`channel: "chrome"`). Ports 4100/3500 avoid Windows' reserved range.
