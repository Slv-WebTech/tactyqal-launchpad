import { defineConfig } from "@playwright/test";

// Runs the READ-ONLY browser tests (site, a11y, visual) against the deployed site.
//   npx playwright test -c live-site.config.js
// Skips the one test that submits a write (live writes are closed and would return 401).
const WEB = process.env.LIVE_WEB || "https://tactyqal-launchpad.vercel.app";
process.env.E2E_API ||= process.env.LIVE_API || "https://tactyqal-launchpad-api.onrender.com/api";

export default defineConfig({
  testDir: "./tests",
  testMatch: /(site|a11y|visual).spec.js/,
  grepInvert: /server validation errors/,
  timeout: 90_000,
  workers: 1,
  retries: 1, // remote host: one retry for transport blips (ECONNRESET); retried tests are reported as "flaky", not hidden
  reporter: [["list"]],
  use: { baseURL: WEB, channel: "chrome", headless: true, screenshot: "only-on-failure", trace: "retain-on-failure" },
});
