import { test, expect } from "@playwright/test";

// Icon-first UI contract: controls are icons with a tooltip, never an unlabeled glyph.
//  - every interactive element has an accessible name
//  - every icon-only control has aria-label === its tooltip text, and its icon is aria-hidden
//  - tooltips follow WCAG 1.4.13: appear on hover and keyboard focus, stay while hovered, dismiss with Esc
//  - primary marketing CTAs keep a visible text label next to their icon
const PAGES = [
  ["home", "/"],
  ["blog", "/blog"],
  ["post", "/blog/the-elevator-pitch-for-business-entrepreneurs"],
  ["admin", "/admin"],
  ["404", "/blog/does-not-exist"],
];

const audit = () => {
  const visibleText = (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll("svg,[data-tip],.sr-only,[aria-hidden=true]").forEach((n) => n.remove());
    return c.textContent.replace(/\s+/g, " ").trim();
  };
  const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const problems = [];
  let iconOnly = 0;
  for (const el of document.querySelectorAll("a[href], button, summary")) {
    if (!isVisible(el)) continue;
    const label = el.getAttribute("aria-label");
    const text = visibleText(el);
    const srText = el.textContent.replace(/\s+/g, " ").trim();
    const where = `${el.tagName.toLowerCase()}[${label || text || srText || "?"}]`;
    if (!label && !srText) problems.push(`${where}: no accessible name`);
    if (!text) {
      // icon-only control
      iconOnly++;
      if (!label) problems.push(`${where}: icon-only without aria-label`);
      const wrap = el.parentElement;
      const tip = wrap && wrap.querySelector(":scope > [data-tip]");
      if (el.tagName !== "SUMMARY") {
        if (!tip) problems.push(`${where}: icon-only without a tooltip`);
        else if (tip.textContent.trim() !== label) problems.push(`${where}: tooltip "${tip.textContent.trim()}" differs from aria-label "${label}"`);
      }
    }
    for (const svg of el.querySelectorAll("svg")) {
      if (!svg.closest("[aria-hidden=true]") && svg.getAttribute("aria-hidden") !== "true") problems.push(`${where}: svg icon not aria-hidden`);
    }
  }
  for (const el of document.querySelectorAll("input:not([type=hidden]), select, textarea")) {
    if (!isVisible(el)) continue;
    const named = el.getAttribute("aria-label") || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest("label");
    if (!named) problems.push(`${el.tagName.toLowerCase()}[${el.name || el.placeholder}]: no accessible name`);
  }
  return { problems, iconOnly };
};

for (const [vp, w, h] of [["desktop", 1440, 900], ["mobile", 375, 812]]) {
  for (const [name, path] of PAGES) {
    test(`icon audit: ${name} @ ${vp}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { problems, iconOnly } = await page.evaluate(audit);
      expect(problems, problems.join("\n")).toEqual([]);
      expect(iconOnly, "page should use icon-only controls").toBeGreaterThan(0);
    });
  }
}

test.describe("tooltips", () => {
  const trigger = (page) => page.locator('header nav a[aria-label="Pricing"]');
  const tip = (page) => page.locator('header span:has(> a[aria-label="Pricing"]) > [data-tip]');

  test("hover shows the label, leaving hides it, and the pointer can move onto the tooltip", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(tip(page)).toBeHidden();
    await trigger(page).hover();
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toHaveText("Pricing");
    // hoverable (WCAG 1.4.13): moving onto the tooltip keeps it open
    const box = await tip(page).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(tip(page)).toBeVisible();
    await page.mouse.move(10, 600);
    await expect(tip(page)).toBeHidden();
  });

  test("keyboard focus shows the label; Esc dismisses it without moving focus; blur resets", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await trigger(page).focus();
    await expect(tip(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
    await page.locator('header nav a[aria-label="FAQ"]').focus(); // blur the first one
    await trigger(page).focus();
    await expect(tip(page)).toBeVisible(); // dismissal does not stick after blur
  });

  test("desktop nav is icon-only; mobile menu pairs each icon with its label", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    for (const link of await page.locator("header nav a").all()) {
      const visible = await link.evaluate((el) => {
        const c = el.cloneNode(true);
        c.querySelectorAll("svg,[data-tip]").forEach((n) => n.remove());
        return c.textContent.trim();
      });
      expect(visible, "no visible text inside an icon-only nav link").toBe("");
      expect(await link.locator("svg").count()).toBe(1);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.locator("header summary").click();
    for (const l of await page.locator("header details a").all()) {
      expect((await l.textContent()).trim().length, "mobile links show text").toBeGreaterThan(2);
      expect(await l.locator("svg").count()).toBe(1);
    }
  });

  test("primary calls to action keep a visible label beside the icon", async ({ page }) => {
    await page.goto("/");
    for (const name of ["Book free consultation", "Enroll now", "Book a free appointment", "Read all articles"]) {
      const cta = page.getByRole("link", { name }).first();
      await expect(cta).toBeVisible();
      expect(await cta.locator("svg").count(), name).toBeGreaterThanOrEqual(1);
    }
  });

  test("blog search and admin actions are icon buttons with matching tooltips", async ({ page }) => {
    await page.goto("/blog");
    await page.getByRole("button", { name: "Search" }).hover();
    await expect(page.locator("span:has(> button[aria-label='Search']) > [data-tip]")).toBeVisible();
    await page.goto("/admin");
    await page.getByRole("button", { name: "Edit" }).first().hover();
    await expect(page.locator("span:has(> button[aria-label='Edit']) > [data-tip]").first()).toHaveText("Edit");
    await expect(page.getByRole("button", { name: "Create post" })).toBeVisible();
  });

  test("reduced motion: tooltips do not animate", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const prop = await page.locator("[data-tip]").first().evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(prop).toBe("none"); // motion-reduce:transition-none
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const prop2 = await page.locator("[data-tip]").first().evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(prop2).not.toBe("none"); // ...and animates again for everyone else
  });
});
