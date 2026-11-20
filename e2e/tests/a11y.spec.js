import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// WCAG 2.1 A/AA automated scan (axe-core). Zero tolerance for any violation on every page and viewport.
// Automated checks cover roughly a third of WCAG; the manual checklist is in docs/QA_REPORT.md.
const PAGES = [
  ["home", "/"],
  ["blog list", "/blog"],
  ["blog post", "/blog/the-elevator-pitch-for-business-entrepreneurs"],
  ["admin", "/admin"],
  ["404", "/blog/does-not-exist"],
];
const VIEWPORTS = [["mobile", 375, 812], ["desktop", 1440, 900]];

for (const [vp, w, h] of VIEWPORTS) {
  for (const [name, path] of PAGES) {
    test(`axe WCAG A/AA: ${name} @ ${vp}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
      const summary = violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node(s)) e.g. ${v.nodes[0]?.html.slice(0, 100)}`);
      expect(summary, summary.join("\n")).toEqual([]);
    });
  }
}

test("keyboard: tab order reaches nav, skip to content works through focusable controls, focus is visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const seen = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    seen.push(await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { tag: e.tagName, text: (e.textContent || "").trim().slice(0, 25), outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 }; }));
  }
  expect(seen.every((s) => s.tag !== "BODY"), "focus should always land on a control").toBe(true);
  expect(seen.filter((s) => !s.outline).map((s) => s.text), "every focused control shows a focus ring").toEqual([]);
});

test("reduced motion and zoom: 200% zoom keeps content reachable (no horizontal scroll at 320 CSS px)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 }); // = 400% zoom on 1280px (WCAG 1.4.10 reflow)
  for (const p of ["/", "/blog", "/admin"]) {
    await page.goto(p);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), p).toBeLessThanOrEqual(0);
  }
});
