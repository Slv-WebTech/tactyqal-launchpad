import { defineConfig } from "@playwright/test";

const API = "http://localhost:4100";
const WEB = "http://localhost:3500";

// Boots both apps on dedicated ports with a fresh in-memory DB, so e2e never touches real data.
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: WEB, channel: "chrome", headless: true, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    {
      command: "node src/server.js",
      cwd: "../backend",
      url: `${API}/api/health`,
      env: { PORT: "4100", DB_FILE: ":memory:", ALLOW_OPEN_WRITES: "1" }, // e2e writes via the API without a key (dev opt-in)
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run build && npm start -- -p 3500",
      cwd: "../frontend",
      url: WEB,
      env: { NEXT_PUBLIC_API_URL: `${API}/api` },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
