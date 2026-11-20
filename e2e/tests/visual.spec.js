import { test, expect } from "@playwright/test";

// Visual regression: full-page screenshots compared against committed baselines in tests/visual.spec.js-snapshots/.
// Threshold: at most 0.1% of pixels may differ, per-pixel colour tolerance 0.05 (0.2 let a same-brightness hue change slip through in a mutation check).
// Update baselines deliberately after an intended UI change:  npx playwright test visual --update-snapshots
const SHOTS = [
  ["home", "/"],
  ["blog", "/blog"],
  ["post", "/blog/the-elevator-pitch-for-business-entrepreneurs"],
  ["admin", "/admin"],
  ["not-found", "/blog/does-not-exist"],
];
const VIEWPORTS = [["mobile", 375, 812], ["tablet", 768, 1024], ["desktop", 1440, 900]];

test.describe.configure({ mode: "serial" });

for (const [vp, w, h] of VIEWPORTS) {
  for (const [name, path] of SHOTS) {
    test(`visual: ${name} @ ${vp}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important} html{scroll-behavior:auto!important}" });
      await expect(page).toHaveScreenshot(`${name}-${vp}.png`, { fullPage: true, maxDiffPixelRatio: 0.001, threshold: 0.05 });
    });
  }
}

test("visual: interactive states (nav hover, open FAQ, open mobile menu)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator("header nav a", { hasText: "Pricing" }).hover();
  await expect(page.locator("header")).toHaveScreenshot("state-nav-hover.png", { maxDiffPixelRatio: 0.001, threshold: 0.05 });
  await page.locator("#faq details").first().locator("summary").click();
  await expect(page.locator("#faq")).toHaveScreenshot("state-faq-open.png", { maxDiffPixelRatio: 0.001, threshold: 0.05 });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.locator("header summary").click();
  await expect(page.locator("header")).toHaveScreenshot("state-mobile-menu.png", { maxDiffPixelRatio: 0.001, threshold: 0.05 });
});
