import { defineConfig } from "@playwright/test";

// Read-only smoke tests against the deployed site + API. Never writes data.
//   npx playwright test -c live.config.js
export default defineConfig({
  testDir: "./live",
  timeout: 90_000, // Render free tier can take ~50s to wake
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.LIVE_WEB || "https://tactyqal-launchpad.vercel.app",
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
  },
});
