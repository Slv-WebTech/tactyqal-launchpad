import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// When the API is asleep or down, visitors must see a friendly retry state, never developer instructions
// ("npm start", "see README"), never a blank hole, and never a misleading 404.
// These tests run against a second build of the site whose API address points at a dead port (see playwright.config.js).
const OFFLINE = "http://localhost:3501";
const DEV_TEXT = /npm start|README|backend|localhost|unreachable|API\b/i;

test.describe("API asleep or unreachable", () => {
  test("home: blog preview shows a friendly waking-up state with a retry button", async ({ page }) => {
    await page.goto(OFFLINE + "/");
    const box = page.locator("#blog [role=status]");
    await expect(box).toContainText("waking up");
    await expect(box.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.locator("#blog")).not.toContainText(DEV_TEXT);
    await expect(page.locator("h1")).toContainText("impacts millions"); // the rest of the page is unaffected
  });

  test("blog index: friendly state, search stays usable, no developer text anywhere on the page", async ({ page }) => {
    await page.goto(OFFLINE + "/blog");
    await expect(page.locator("main [role=status]")).toContainText("waking up");
    await expect(page.getByPlaceholder("Search articles…")).toBeVisible();
    await expect(page.locator("main")).not.toContainText(DEV_TEXT);
    await expect(page.getByText("No articles found.")).toHaveCount(0);
  });

  test("post page: shows a retry state (HTTP 200), not a misleading 404", async ({ page }) => {
    const res = await page.goto(OFFLINE + "/blog/the-elevator-pitch-for-business-entrepreneurs");
    expect(res.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Loading your article");
    await expect(page.locator("[role=status]")).toContainText("Fetching the article");
    await expect(page.getByText("Page not found")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "All articles" })).toBeVisible();
    await expect(page).toHaveTitle(/Loading article/);
  });

  test("retry button re-requests the page and stays usable while the API is still down", async ({ page }) => {
    await page.goto(OFFLINE + "/blog");
    let refreshes = 0;
    page.on("request", (r) => { if (r.url().includes("/blog") && r.headers()["rsc"] === "1") refreshes++; });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.poll(() => refreshes, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.locator("[role=status]")).toBeVisible();
  });

  test("retry state is announced politely, keyboard operable and passes axe", async ({ page }) => {
    for (const path of ["/", "/blog", "/blog/some-post"]) {
      await page.goto(OFFLINE + path);
      await expect(page.locator("[role=status]").first()).toHaveAttribute("aria-live", "polite");
      await page.getByRole("button", { name: "Try again" }).focus();
      await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`), path).toEqual([]);
    }
  });

  test("after the automatic retries run out it says so kindly and offers a manual retry", async ({ page }) => {
    await page.clock.install();
    await page.goto(OFFLINE + "/blog");
    await expect(page.locator("[role=status]")).toContainText("waking up");
    for (let i = 0; i < 8; i++) { await page.clock.runFor(9500); await page.waitForTimeout(150); } // 6 auto-retries x 9 s
    await expect(page.locator("[role=status]")).toContainText("taking a short break");
    await expect(page.locator("main")).not.toContainText(DEV_TEXT);
    await page.getByRole("button", { name: "Try again" }).click(); // manual retry restarts the cycle
    await expect(page.locator("[role=status]")).toContainText("waking up");
  });

  test("mobile: retry card fits the screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ["/", "/blog", "/blog/x"]) {
      await page.goto(OFFLINE + path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0);
    }
  });

  test("the sitemap still lists the static pages when the API is down", async ({ request }) => {
    const res = await request.get(OFFLINE + "/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("/blog</loc>");
  });
});
