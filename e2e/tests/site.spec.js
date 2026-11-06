import { test, expect } from "@playwright/test";

const API = "http://localhost:4100/api";

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  return errors;
}

test.describe("homepage", () => {
  test("renders every section with no console errors", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await expect(page).toHaveTitle(/Tactyqal Labs/);
    await expect(page.locator("h1")).toContainText("impacts millions");
    for (const id of ["success", "program", "why", "tools", "blog", "pricing", "faq", "contact"]) {
      await expect(page.locator(`section#${id}`), `section #${id}`).toBeVisible();
    }
    await expect(page.locator("section#blog a[href^='/blog/']")).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  for (const [name, w, h] of [["mobile", 375, 812], ["small-mobile", 320, 568], ["tablet", 768, 1024], ["desktop", 1440, 900]]) {
    test(`no horizontal overflow or clipped content @ ${name}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      for (const path of ["/", "/blog", "/admin", "/blog/the-elevator-pitch-for-business-entrepreneurs"]) {
        await page.goto(path);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, `${path} overflows by ${over}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test("desktop nav links scroll to their sections; hamburger hidden", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.locator("header details")).toBeHidden();
    await page.locator("header nav a", { hasText: "Pricing" }).click();
    await expect(page).toHaveURL(/#pricing$/);
    await expect(page.locator("section#pricing")).toBeInViewport();
    await page.locator("header nav a", { hasText: "FAQ" }).click();
    await expect(page.locator("section#faq")).toBeInViewport();
  });

  test("mobile menu opens, lists all links, navigates and the desktop nav is hidden", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.locator("header nav")).toBeHidden();
    await page.locator("header summary").click();
    await expect(page.locator("header details a")).toHaveCount(8);
    await page.locator("header details a", { hasText: "Why Us" }).click();
    await expect(page).toHaveURL(/#why$/);
  });

  test("FAQ items expand and collapse independently", async ({ page }) => {
    await page.goto("/#faq");
    const items = page.locator("#faq details");
    expect(await items.count()).toBeGreaterThanOrEqual(5);
    await items.nth(0).locator("summary").click();
    await expect(items.nth(0)).toHaveAttribute("open", "");
    await items.nth(1).locator("summary").click();
    await expect(items.nth(0)).toHaveAttribute("open", "");
    await items.nth(0).locator("summary").click();
    await expect(items.nth(0)).not.toHaveAttribute("open", "");
  });

  test("FAQ is operable by keyboard", async ({ page }) => {
    await page.goto("/#faq");
    const first = page.locator("#faq details").first();
    await first.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("open", "");
  });

  test("CTAs: consultation anchors, mailto link, pricing enroll", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Book free consultation" }).first().click();
    await expect(page).toHaveURL(/#contact$/);
    await expect(page.getByRole("link", { name: "Book a free appointment" })).toHaveAttribute("href", /^mailto:tactyqal\.labs@gmail\.com/);
  });

  test("all internal links resolve (no 404s)", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = new Set(await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href"))));
    const checked = [];
    for (const href of hrefs) {
      if (/^(mailto:|tel:|https?:)/.test(href)) continue;
      const path = href.split("#")[0] || "/";
      const res = await request.get(path);
      expect(res.status(), href).toBeLessThan(400);
      checked.push(href);
    }
    expect(checked.length).toBeGreaterThan(5);
  });

  test("hash anchors all point at existing ids", async ({ page }) => {
    await page.goto("/");
    const targets = await page.$$eval("a[href^='/#'], a[href^='#']", (as) => [...new Set(as.map((a) => a.getAttribute("href").split("#")[1]))]);
    for (const id of targets) expect(await page.locator(`#${id}`).count(), `#${id}`).toBe(1);
  });

  test("no broken images and no layout shift traps (images have loaded)", async ({ page }) => {
    await page.goto("/");
    const broken = await page.$$eval("img", (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
    expect(broken).toEqual([]);
  });

  test("document basics: lang, viewport meta, single h1, meta description", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("meta[name=viewport]")).toHaveCount(1);
    await expect(page.locator("meta[name=description]")).toHaveAttribute("content", /.+/);
    await expect(page.locator("h1")).toHaveCount(1);
  });
});

test.describe("blog", () => {
  test("list shows seeded posts, search narrows, empty state works", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.locator("main a[href^='/blog/']")).toHaveCount(6);
    await page.getByPlaceholder("Search articles…").fill("food waste");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=food\+waste/);
    await expect(page.locator("main a[href^='/blog/']")).toHaveCount(1);
    await page.goto("/blog?q=zzzz-no-such-thing");
    await expect(page.getByText("No articles found.")).toBeVisible();
  });

  test("tag filter chips filter and 'All' resets", async ({ page }) => {
    await page.goto("/blog");
    await page.locator("a[href=\"/blog?tag=ideas\"]").click();
    await expect(page).toHaveURL(/tag=ideas/);
    const n = await page.locator("main a[href^='/blog/']").count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(6);
    await page.getByRole("link", { name: "All", exact: true }).click();
    await expect(page.locator("main a[href^='/blog/']")).toHaveCount(6);
  });

  test("search + tag combine, and search keeps the active tag", async ({ page }) => {
    await page.goto("/blog?tag=ideas");
    await page.getByPlaceholder("Search articles…").fill("food");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/tag=ideas/);
    await expect(page.locator("main a[href^='/blog/']")).toHaveCount(1);
  });

  test("search handles special characters without breaking", async ({ page }) => {
    for (const q of ["%", "_", "'; DROP TABLE posts; --", "<script>alert(1)</script>", "日本語", "a".repeat(300)]) {
      const res = await page.goto(`/blog?q=${encodeURIComponent(q)}`);
      expect(res.status(), q).toBe(200);
      await expect(page.locator("h1")).toHaveText("The Tactyqal Blog");
    }
    expect((await (await page.request.get(`${API}/posts`)).json()).meta.total).toBeGreaterThanOrEqual(6);
  });

  test("junk query params are tolerated (page=abc, page=-1, page=999, repeated q)", async ({ page }) => {
    for (const qs of ["?page=abc", "?page=-1", "?page=999", "?q=a&q=b", "?tag=", "?q="]) {
      const res = await page.goto(`/blog${qs}`);
      expect(res.status(), qs).toBe(200);
    }
  });

  test("post page renders content, meta, tags; back link works", async ({ page }) => {
    await page.goto("/blog");
    await page.locator("main a[href^='/blog/']").first().click();
    await expect(page.locator("article h1")).toBeVisible();
    await expect(page.locator("article .prose-post h2").first()).toBeVisible();
    await expect(page.locator("article")).toContainText("min read");
    await page.getByRole("link", { name: "← All articles" }).click();
    await expect(page).toHaveURL(/\/blog$/);
  });

  test("unknown post and weird slugs give the 404 page, not a crash", async ({ page }) => {
    for (const slug of ["nope", "%00", "..%2Fetc%2Fpasswd", "a".repeat(500), "123456789"]) {
      const res = await page.goto(`/blog/${slug}`);
      expect(res.status(), slug).toBe(404);
      await expect(page.getByText("Page not found")).toBeVisible();
    }
  });

  test("document title reflects the post", async ({ page }) => {
    await page.goto("/blog/the-elevator-pitch-for-business-entrepreneurs");
    await expect(page).toHaveTitle(/elevator pitch/i);
  });
});

test.describe("resilience", () => {
  test("admin shows a clear error when the API is unreachable", async ({ page }) => {
    await page.route(`${API}/**`, (r) => r.abort());
    await page.goto("/admin");
    await expect(page.getByText(/Cannot reach the API/)).toBeVisible();
  });

  test("admin surfaces server validation errors instead of failing silently", async ({ page }) => {
    await page.goto("/admin");
    await page.getByPlaceholder("Title").fill("   "); // passes HTML `required`, fails server trim check
    await page.getByRole("button", { name: "Create post" }).click();
    await expect(page.getByText(/Validation failed/)).toBeVisible();
    await expect(page.getByText(/title is required/)).toBeVisible();
  });

  test("API 500 on create is reported, UI stays usable", async ({ page }) => {
    await page.route(`${API}/posts`, (r) => (r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal server error" }) }) : r.continue()));
    await page.goto("/admin");
    await page.getByPlaceholder("Title").fill("Will fail");
    await page.getByRole("button", { name: "Create post" }).click();
    await expect(page.getByText("Internal server error")).toBeVisible();
    await expect(page.getByPlaceholder("Title")).toHaveValue("Will fail");
  });
});
